# Deploying FINAI with live SEC data

Everything here is free: Vercel's Hobby tier, SEC EDGAR (no key, no quota), and Finnhub's free plan.

## What you're deploying

```
finai/
  public/index.html    the app
  api/company.js       serverless function — fetches EDGAR + quote
  lib/xbrl.js          XBRL → FINAI mapper
  test/                offline tests (no network needed)
  vercel.json
  .env.example
```

## Why a server is needed at all

The browser cannot call SEC EDGAR directly, for two independent reasons:

1. `data.sec.gov` sends no CORS headers, so a cross-origin request from a web page is blocked.
2. EDGAR requires a `User-Agent` header identifying the caller, and browser JavaScript is forbidden by the Fetch spec from setting that header. Requests without it get a 403.

Both restrictions disappear server-side. `api/company.js` is the smallest thing that solves it. It also keeps your Finnhub key off the client.

## Steps

**1. Get a Finnhub key** (optional but recommended)

Sign up free at [finnhub.io/register](https://finnhub.io/register). The free plan allows 60 calls per minute — far more than this app needs. Without a key, fundamentals still load; you just get no share price, so market cap, P/E and DCF upside show em dashes.

Note the free plan is licensed for personal use, which covers a portfolio project.

**2. Push to GitHub**

```bash
cd finai
git init && git add . && git commit -m "FINAI"
git remote add origin https://github.com/YOU/finai.git
git push -u origin main
```

**3. Import to Vercel**

Go to [vercel.com/new](https://vercel.com/new), import the repo, and add two environment variables before deploying:

| Variable | Value |
|---|---|
| `SEC_USER_AGENT` | `FINAI educational project your@email.com` — use a real address |
| `FINNHUB_API_KEY` | your key from step 1 |

Framework preset: **Other**. No build command, no output directory. Vercel picks up `api/company.js` automatically.

Deploy. You get a live URL in about a minute.

**4. Test it**

- Search `CELH` → loads instantly from the curated dataset, badged DEMO DATA
- Search `ORCL` or `WMT` or any US-listed ticker → loads from EDGAR, badged SEC EDGAR
- Search `ZZZZ` → clean "no SEC filer found" error

## Running locally

```bash
npm i -g vercel
vercel dev            # serves the page and the function together
npm test              # offline mapper tests, no network required
```

Opening `public/index.html` straight from disk also works — it falls back to the ten curated companies and says so when you search anything else.

## What to expect from live companies

Auto-mapping is genuinely imperfect, and the app is built to degrade honestly rather than paper over it:

- **Missing figures show as em dashes**, never estimates. If a company tags a concept unusually, that row is blank.
- **No peer set.** EDGAR publishes financial statements but not peer groups or peer multiples, so the comparables tab explains its absence rather than showing a one-row table.
- **DCF assumptions are derived mechanically** — growth fading from historical CAGR, margins from the company's own history, a placeholder beta of 1.10. Defensible starting points, not reviewed judgments. Every input is editable.
- **Banks and insurers** are detected by SIC code and correctly get no unlevered DCF.
- **Not covered:** foreign private issuers filing 20-F, IFRS reporters, recent IPOs without two years of XBRL, and private companies.

If a specific company maps badly, the fix is almost always adding a tag to the fallback chain in `lib/xbrl.js` — the chains are ordered by preference and documented inline.

## Cost

| | |
|---|---|
| Vercel Hobby | Free |
| SEC EDGAR | Free, no key, 10 req/sec |
| Finnhub free tier | Free, 60 calls/min |

Responses are cached for six hours per company and quotes for five minutes, so real usage stays far inside every limit.
