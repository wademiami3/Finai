/* ================================================================
   /api/company?ticker=XXXX
   ----------------------------------------------------------------
   The server half of FINAI's live-data path. It exists because a
   browser physically cannot call SEC EDGAR:

     1. data.sec.gov sends no CORS headers, so a cross-origin fetch
        from a web page is blocked outright.
     2. EDGAR requires a User-Agent header identifying the caller,
        and browser JavaScript is forbidden from setting that header.

   Both restrictions disappear server-side. This function fetches the
   filings, maps them into the shape the finance engine expects, adds
   a live quote, and returns JSON. API keys stay here and never reach
   the client.
   ================================================================ */

const { mapCompany } = require("../lib/xbrl.js");

// EDGAR asks that automated callers identify themselves with a contact
// address. Set SEC_USER_AGENT in your environment; the fallback is only
// so local development does not hard-fail.
const UA = process.env.SEC_USER_AGENT || "FINAI educational project (contact@example.com)";
const FINNHUB = process.env.FINNHUB_API_KEY || "";

// Simple in-process caches. Serverless instances are reused between
// invocations, so this meaningfully reduces load on EDGAR — which is a
// courtesy their rate limit expects, not just an optimisation.
let tickerMap = null, tickerMapAt = 0;
const companyCache = new Map();
const TTL = 1000 * 60 * 60 * 6;      // 6 hours — filings change rarely
const QUOTE_TTL = 1000 * 60 * 5;     // 5 minutes for prices

async function secFetch(url){
  const r = await fetch(url, {headers:{"User-Agent": UA, "Accept-Encoding":"gzip, deflate"}});
  if(!r.ok){
    const e = new Error(`SEC responded ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

/** ticker → CIK, from the SEC's own published mapping file. */
async function getCik(ticker){
  if(!tickerMap || Date.now() - tickerMapAt > 1000 * 60 * 60 * 24){
    const raw = await secFetch("https://www.sec.gov/files/company_tickers.json");
    tickerMap = {};
    Object.values(raw).forEach(r => { tickerMap[r.ticker.toUpperCase()] = r.cik_str; });
    tickerMapAt = Date.now();
  }
  return tickerMap[ticker] || null;
}

/** Live quote. Optional: without a key the app still works, it just
 *  cannot compute market cap, P/E or upside — and shows em dashes. */
const quoteCache = new Map();
async function getQuote(ticker){
  if(!FINNHUB) return null;
  const hit = quoteCache.get(ticker);
  if(hit && Date.now() - hit.at < QUOTE_TTL) return hit.data;
  try{
    const [q, prof] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB}`).then(r => r.json()),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB}`).then(r => r.json())
    ]);
    if(q?.c == null || q.c === 0) return null;
    const data = {
      price: q.c,
      changePct: q.dp != null ? q.dp / 100 : null,
      // Finnhub reports share count in millions, which is already the
      // unit the finance engine works in.
      sharesOutstanding: prof?.shareOutstanding ?? null,
      name: prof?.name || null
    };
    quoteCache.set(ticker, {at: Date.now(), data});
    return data;
  }catch{
    return null;   // a missing quote degrades the page, it does not break it
  }
}

module.exports = async (req, res) => {
  const ticker = String((req.query?.ticker) || "").toUpperCase().trim();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");

  if(!/^[A-Z.\-]{1,8}$/.test(ticker))
    return res.status(400).json({ok:false, code:"BAD_TICKER", message:"Enter a valid ticker symbol."});

  const cached = companyCache.get(ticker);
  if(cached && Date.now() - cached.at < TTL){
    const quote = await getQuote(ticker);
    const company = quote ? Object.assign({}, cached.data, {price:quote.price, priceChg:quote.changePct}) : cached.data;
    return res.status(200).json({ok:true, company, cached:true});
  }

  try{
    const cik = await getCik(ticker);
    if(!cik) return res.status(404).json({
      ok:false, code:"NOT_FOUND",
      message:`No SEC filer found for "${ticker}". FINAI covers companies that file with the SEC — US-listed issuers. Foreign private issuers filing 20-F and private companies are not available.`
    });

    const padded = String(cik).padStart(10, "0");
    const [facts, submissions, quote] = await Promise.all([
      secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`),
      secFetch(`https://data.sec.gov/submissions/CIK${padded}.json`),
      getQuote(ticker)
    ]);

    const company = mapCompany({facts: facts.facts, submissions, quote, ticker});
    companyCache.set(ticker, {at: Date.now(), data: company});
    return res.status(200).json({ok:true, company});

  }catch(err){
    if(err.code === "INSUFFICIENT_DATA")
      return res.status(422).json({
        ok:false, code:"INSUFFICIENT_DATA",
        message:`${ticker} files with the SEC, but FINAI could not assemble at least two years of annual XBRL data from those filings. This happens with recent IPOs, companies that report under IFRS, and filers using uncommon XBRL tags.`
      });
    if(err.status === 403)
      return res.status(502).json({ok:false, code:"SEC_BLOCKED", message:"SEC EDGAR rejected the request. Check that SEC_USER_AGENT is set to a real contact address."});
    if(err.status === 404)
      return res.status(404).json({ok:false, code:"NO_FACTS", message:`${ticker} has no XBRL financial data published on EDGAR.`});
    return res.status(500).json({ok:false, code:"FETCH_FAILED", message:"Could not reach SEC EDGAR. Try again in a moment."});
  }
};
