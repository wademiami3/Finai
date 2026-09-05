/* ================================================================
   /api/health
   ----------------------------------------------------------------
   Deployment diagnostics. Visit /api/health on the deployed site to
   see, in one response, whether the function is running, whether the
   environment variables actually reached it, and whether SEC EDGAR
   and the quote provider are reachable from this deployment.

   This exists because "live lookup isn't working" has several very
   different causes — the function not deploying, an unset variable,
   EDGAR rejecting the User-Agent — and they are indistinguishable
   from the front end.
   ================================================================ */

const UA = process.env.SEC_USER_AGENT || "";
const FINNHUB = process.env.FINNHUB_API_KEY || "";

module.exports = async (req, res) => {
  const out = {
    ok: true,
    functionRunning: true,
    node: process.version,
    env: {
      SEC_USER_AGENT: UA ? "set" : "MISSING",
      FINNHUB_API_KEY: FINNHUB ? "set" : "missing (optional — prices will be blank)"
    },
    checks: {}
  };

  // Does the User-Agent actually satisfy EDGAR? They want contact info.
  if(!UA) out.checks.userAgentFormat = "MISSING — EDGAR will reject every request with 403";
  else if(!/@/.test(UA)) out.checks.userAgentFormat = "WARNING — should contain a contact email, e.g. 'FINAI you@example.com'";
  else out.checks.userAgentFormat = "ok";

  // Live reachability test against a known filer (Apple, CIK 320193).
  try{
    const r = await fetch("https://data.sec.gov/submissions/CIK0000320193.json",
      {headers:{"User-Agent": UA || "FINAI health-check"}});
    out.checks.edgar = r.ok ? "ok" : `FAILED — SEC returned ${r.status}` +
      (r.status === 403 ? " (User-Agent rejected)" : "");
    if(r.ok){
      const j = await r.json();
      out.checks.edgarSample = `resolved CIK 320193 → ${j.name}`;
    }
  }catch(e){
    out.checks.edgar = "FAILED — could not reach data.sec.gov: " + e.message;
  }

  // Ticker → CIK map, the other EDGAR file the lookup depends on.
  try{
    const r = await fetch("https://www.sec.gov/files/company_tickers.json",
      {headers:{"User-Agent": UA || "FINAI health-check"}});
    if(r.ok){
      const j = await r.json();
      const n = Object.keys(j).length;
      const orcl = Object.values(j).find(x => x.ticker === "ORCL");
      out.checks.tickerMap = `ok — ${n} filers indexed` + (orcl ? `, ORCL → CIK ${orcl.cik_str}` : ", ORCL NOT FOUND");
    } else out.checks.tickerMap = `FAILED — ${r.status}`;
  }catch(e){
    out.checks.tickerMap = "FAILED — " + e.message;
  }

  if(FINNHUB){
    try{
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${FINNHUB}`);
      const j = await r.json();
      out.checks.quotes = (j && j.c) ? `ok — AAPL quote ${j.c}`
        : `FAILED — provider returned ${JSON.stringify(j).slice(0,120)}`;
    }catch(e){ out.checks.quotes = "FAILED — " + e.message; }
  } else out.checks.quotes = "skipped (no key)";

  const failed = Object.values(out.checks).some(v => String(v).startsWith("FAILED") || String(v).startsWith("MISSING"));
  out.ok = !failed;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(failed ? 500 : 200).json(out);
};
