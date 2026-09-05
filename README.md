# FINAI — AI Investment Committee Copilot

**FINAI is an AI-powered investment research platform that combines financial statement analysis, valuation modeling, scenario analysis, and AI-generated investment insights.**

> ### CODE CALCULATES. AI INTERPRETS.
> Every valuation figure in this application is produced by a deterministic finance engine. The language model is handed those computed figures and asked to explain them — it never calculates or invents a number.

**Live demo:** _[paste your published link here]_

Ten curated companies with hand-built peer sets and reviewed assumptions, plus live lookup of **any SEC filer** via EDGAR.

---

## Overview

FINAI takes a ticker and produces what an analyst would actually bring to an investment committee: a financial dashboard, five years of statements, trading comparables, an editable DCF with a sensitivity grid, bull/base/bear scenarios, a ranked risk register, a scored committee framework, and a printable memo — plus a chat analyst grounded in that company's numbers.

The workflow it models is the one used in real equity research:

```
Public company → Financial statements → Ratio & trend analysis
   → Valuation (comps + DCF) → Scenario analysis
   → AI interpretation → Investment memo
```

---

## Screenshots

| | |
|---|---|
| `docs/01-dashboard.png` — Company dashboard | `docs/02-financials.png` — Financial performance & charts |
| `docs/03-dcf.png` — DCF and sensitivity grid | `docs/04-memo.png` — Investment committee memo |

---

## Key features

**Company dashboard** — 12 KPI cards covering market cap, enterprise value, revenue and growth, EBITDA and margin, net income, EPS, free cash flow, cash, debt and ROIC, with sector, industry and price.

**Historical financial statements** — Income statement, balance sheet and cash flow, five fiscal years each, formatted the way an analyst reads them: negatives in parentheses, subtotals emphasised, sticky first column.

**Financial charts** — Revenue and growth, margin profile, profitability, and cash generation. Hand-built SVG with tooltips; no charting library.

**Financial ratios** — Growth, CAGR, gross/operating/EBITDA/net margins, FCF margin and conversion, net debt/EBITDA, current ratio, ROE, ROIC, and the full multiple set.

**Trading comparables** — Peer table with median and mean, and the target's premium or discount to median. Financial-sector companies get an appropriate column set (ROE, P/TBV, dividend yield) rather than EV multiples.

**DCF valuation** — Five-year unlevered free cash flow model with a CAPM WACC build-up, mid-year convention, the full UFCF build, an enterprise-to-equity bridge, model diagnostics and a 5×5 sensitivity grid.

**Editable assumptions** — Revenue growth by year, terminal EBIT margin, tax rate, D&A, capex, working capital, WACC and terminal growth are all editable, and every dependent figure recalculates immediately.

**Scenario analysis** — Bull, base and bear, each a set of assumption deltas run through the same DCF code. Margin deltas are proportional rather than absolute, so a bear case is economically sensible for both a 55%-margin software business and a 4%-margin retailer.

**Investment thesis and risk analysis** — Both rule-driven. A thesis point or risk appears only when a metric, a disclosed concentration or the valuation gap triggers it, and each carries the figure that triggered it.

**Investment scorecard** — Eight weighted categories (Growth, Profitability, Balance Sheet, Cash Flow, Valuation, Competitive Position, Risk, Management) scored 1–10 from disclosed metric bands, producing a weighted score and a committee stance: ATTRACTIVE / WATCH / NEUTRAL / CAUTION / PASS.

**Ask the Analyst** — Chat scoped to the loaded company, answering questions such as why margins changed, what the biggest risks are, how free cash flow has moved, the bull and bear cases, which DCF assumptions matter most, and how the company compares with peers. Bank-specific answers are given where the industrial framework does not apply.

**Investment memo** — Sixteen-section committee memo including trading comparables and full DCF tables, print-ready to PDF, saved to a memo library.

**Watchlist** — Local-storage watchlist with metrics recomputed on every visit.

**Theme** — Dark institutional default, with a light mode for printing.

---

## Finance concepts demonstrated

Financial statement analysis · revenue growth and CAGR · margin analysis and decomposition · EBITDA and adjusted earnings · free cash flow and cash conversion · working capital · net debt and leverage · enterprise value versus equity value · trading multiples (P/E, EV/Revenue, EV/EBITDA, FCF yield, P/TBV) · comparable company analysis · discounted cash flow modelling · unlevered free cash flow · WACC and CAPM · terminal value and the Gordon growth model · mid-year discounting convention · sensitivity analysis · scenario construction · ROE and ROIC · DuPont-style return analysis · bank-specific analysis (net interest income, efficiency ratio, loan-to-deposit, provisions, P/TBV versus ROE) · investment thesis construction · risk assessment · investment committee frameworks.

**Where the model does not apply.** JPMorgan and Goldman Sachs deliberately get no unlevered FCF DCF. For a bank, debt is raw material rather than financing: there is no clean operating-versus-financing split, capex and working capital have no analogue, and enterprise value is not coherent when deposits sit on the balance sheet. The app explains this in place and points to residual income and P/TBV-versus-ROE instead. Knowing when a model does not apply is part of knowing the model.

---

## Data modes

FINAI runs in a hybrid mode:

- **Curated (10 companies)** — hand-built peer sets, reviewed DCF assumptions, written business profiles. Badged `DEMO DATA`; figures are approximate and the most recent year is an estimate.
- **Live (any SEC filer)** — mapped automatically from the company's filed annual reports on SEC EDGAR, with a live market quote. Badged `SEC EDGAR`.

The browser cannot call EDGAR directly: `data.sec.gov` sends no CORS headers, and browser JavaScript is forbidden from setting the `User-Agent` header EDGAR requires. A small serverless function (`api/company.js`) handles both, and keeps API keys off the client. See `DEPLOY.md`.

**The mapping problem.** Companies do not report the same concept under the same XBRL tag — revenue alone appears as `Revenues`, `RevenueFromContractWithCustomerExcludingAssessedTax`, `SalesRevenueNet` and others, and older filings use tags since deprecated. The mapper uses preference-ordered fallback chains per concept, prefers restated figures over superseded originals, and filters quarterly rows out of annual series. When no tag matches, the field stays `null` and renders as an em dash. Nothing is estimated to fill a gap.

Live companies carry no peer set (EDGAR publishes no peer multiples) and derive DCF assumptions mechanically from their own history. Both facts are stated in the interface.

## Technology used

- Static front end — vanilla JavaScript, no build step, no runtime dependencies
- One serverless function for SEC EDGAR access and quote fetching
- Hand-built SVG charting
- Browser local storage for watchlist and memos
- Provider-agnostic AI service layer, with a deterministic writer as the always-available fallback
- Port target: Next.js (App Router) + TypeScript + Tailwind + Recharts

Deployable to any static host, or opened directly from disk.

---

## Architecture

```
dataProvider   (lib/api)        pluggable data source — demo | live
fin            (lib/finance)    pure calculation primitives
engine         (lib/finance)    metrics, comps, scenarios, scoring, thesis, risks
aiService      (lib/ai)         model-agnostic interpretation layer
narrative      (lib/ai)         deterministic fallback writer
views          (components)     rendering only — no business logic
```

Rules the codebase holds to:

- Finance calculations never touch the DOM and are pure functions of their inputs
- Every calculation returns `null` on missing input, so the UI renders `—` instead of a fabricated number
- The data layer is a single seam: swapping demo for live data touches one function
- The AI layer sits behind an interface, so providers are interchangeable

### Next.js port structure

```
/app
  page.tsx                      landing + ticker search
  company/[ticker]/page.tsx     dashboard shell
  api/ai/route.ts               server-side model calls
  api/company/[ticker]/route.ts server-side data fetch
/components  /charts /financials /valuation /ai
/lib
  /api      provider.ts  edgar.ts  fmp.ts
  /finance  calculations.ts  engine.ts  dcf.ts
  /ai       aiService.ts  providers/  prompts.ts
/types      index.ts
```

`lib/finance/*` ports across unchanged — it is already pure and framework-free.

---

## How the financial calculation engine works

Every metric is a pure function with an explicit null contract:

```js
growthRate(current, prior)      // null if either is missing or prior is 0
cagr(begin, end, years)         // null if begin ≤ 0
ebitda(opInc, da)               // operating income + D&A
freeCashFlow(ocf, capex)        // operating cash flow − capex
netDebt(debt, cash)             // total debt − cash (negative = net cash)
enterpriseValue(mktCap, debt, cash)
roic(nopat, debt, equity, cash) // return on invested capital
```

No metric is ever estimated to fill a gap. If an input is missing the function returns `null` and the interface shows an em dash — which is why the bank rows show `—` for EBITDA and free cash flow rather than a plausible-looking figure.

---

## How the DCF works

A five-year unlevered free cash flow model:

```
Revenue_t     = Revenue_(t-1) × (1 + g_t)             g_t editable per year
EBIT margin_t = linear ramp from last reported margin to target margin
EBIT_t        = Revenue_t × EBIT margin_t
NOPAT_t       = EBIT_t × (1 − tax rate)
UFCF_t        = NOPAT_t + D&A_t − Capex_t − ΔNWC_t
                D&A and capex as % of revenue; ΔNWC as % of incremental revenue

Discount factor_t = 1 / (1 + WACC)^t        (t − 0.5 under mid-year convention)
Terminal value    = UFCF_5 × (1 + g_term) / (WACC − g_term)
Enterprise value  = Σ PV(UFCF) + PV(Terminal value)
Equity value      = Enterprise value − net debt
Value per share   = Equity value ÷ diluted shares
```

**WACC** is entered directly or built from CAPM: `Ke = rf + β × ERP`, then `WACC = Ke × We + Kd × (1 − t) × Wd`.

**Diagnostics** surfaced because they are the first things a reviewer asks: the share of enterprise value sitting in the terminal value, the implied terminal FCF multiple, the implied EV/EBITDA versus the trailing multiple, and the year-5 UFCF margin.

**Sensitivity** is a 5×5 grid of implied share price across ±100bps of WACC and terminal growth. A DCF is a range; presenting it as a single number is the mistake.

**Guards.** Terminal growth greater than or equal to WACC returns `null` rather than a negative or infinite value. A negative implied equity value renders as `n/m`, not as a negative share price.

**A note on the outputs.** On the demo dataset the model tends to imply values below market for the large-cap names. That is a real property of a Gordon-growth DCF at these discount rates, not a bug: at an 8–10% WACC and 2.5–3% terminal growth, mega-cap multiples embed more durable growth than a five-year fade assumes. Where the gap exceeds 55% the app says so explicitly and frames the three possible explanations — cash flows the forecast does not contain, a lower market risk premium, or a market that is wrong — rather than tuning assumptions backwards to match the share price.

---

## How AI is used

| Task | Producer |
|---|---|
| Growth, margins, EBITDA, FCF, EV, all multiples | Code |
| DCF, terminal value, sensitivity, scenarios | Code |
| Scorecard, committee stance, risk ranking, thesis triggers | Code |
| Analyst summary prose | Code, optionally rewritten by the model |
| Ask the Analyst answers | Model where available, deterministic writer otherwise |
| Memo executive summary | Code, optionally rewritten by the model |

The model receives a structured brief containing the computed figures, the peer table, the DCF output and the flagged risks. It is instructed to use only those figures, name the period for every number, distinguish reported fact from model assumption, and never give personalised investment advice. When the model is unavailable, the app falls back to the deterministic writer rather than to a blank screen — which is why every feature works with no API key.

---

## Demo companies

Ten companies across sectors and business models, chosen to exercise different parts of the analysis:

| Ticker | Company | Why it's included |
|---|---|---|
| CELH | Celsius Holdings | High-growth small cap, margin compression, customer concentration |
| AAPL | Apple | Mega-cap, high ROIC, mature growth |
| MSFT | Microsoft | High margin, heavy capex cycle |
| NVDA | NVIDIA | Extreme growth and margin expansion |
| AMZN | Amazon | Multi-segment, capital-intensive, thin consolidated margin |
| META | Meta Platforms | High margin with a major capex step-up |
| TSLA | Tesla | High multiple, decelerating growth — the case a DCF cannot support |
| COST | Costco | Low-margin retail, premium multiple |
| JPM | JPMorgan Chase | Universal bank — no DCF, deposit-funded |
| GS | Goldman Sachs | Investment bank — no DCF, market-sensitive revenue |

All data is **demo data**: approximate, rounded, not audited, and the most recent fiscal year of each series is an estimate. This is labelled in the interface, on every company page, in the footer and in the memo.

---

## Running it

**Offline (curated companies only)** — open `public/index.html` directly. No install, no key, no network.

**Full (live SEC lookup)** — deploy to Vercel with two environment variables:

```bash
SEC_USER_AGENT=FINAI educational project your@email.com   # EDGAR rejects requests without this
FINNHUB_API_KEY=                                          # optional; free tier, 60 calls/min
```

```bash
npm i -g vercel
vercel dev     # run locally
npm test       # offline mapper tests — 24 assertions, no network
```

Full instructions in `DEPLOY.md`. Everything stays on free tiers: Vercel Hobby, EDGAR (no key, no quota), Finnhub free.

---

## Limitations

- Curated figures are approximate and partly estimated; verify against filings before relying on anything
- Peer multiples for curated companies are demo values; live companies have no peer set at all
- Live mapping does not cover foreign private issuers (20-F), IFRS reporters, recent IPOs without two years of XBRL, or private companies
- Live DCF assumptions are derived mechanically, including a placeholder beta — they are starting points, not reviewed judgments
- No filing text extraction, no earnings-call transcripts, no segment data, no analyst estimates
- Bank analysis does not carry regulatory capital ratios (CET1), which no complete bank view would omit
- Quarterly data exists for one company in the demo set
- The scorecard bands are FINAI's own framework, not a rating methodology
- No authentication; watchlist and memos live in browser local storage

## Future improvements

- SEC EDGAR `companyfacts` ingestion with XBRL tag mapping for full-market coverage
- Residual income and dividend discount models for financials
- Reverse DCF: solve for the growth and margin the current price implies
- Segment-level revenue and margin analysis
- Filing full-text search with retrieval-grounded citations
- Multi-company screening across the scorecard
- Peer discovery by SIC code with computed peer multiples
- Broader XBRL tag coverage as specific companies are found to map poorly

---

## Disclaimer

**Built for educational and research purposes. Demo financial data may be approximate and should not be used as investment advice.**

Nothing this application produces is investment advice, a recommendation to buy or sell any security, or personalised to any investor's circumstances. Valuation outputs are the result of a transparent model run on editable assumptions — different assumptions produce different answers. Scores are an analytical framework for comparing companies on a consistent basis, not a rating. Always verify against primary sources.
