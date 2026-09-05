/* ================================================================
   XBRL → FINAI mapping
   ----------------------------------------------------------------
   The hard part of live SEC data is that companies do not report the
   same concept under the same tag. Revenue alone appears as at least
   four different us-gaap tags depending on the filer, the year and
   how their accountants read ASC 606. Older filings use tags that
   have since been deprecated.

   The approach here is a FALLBACK CHAIN per concept: try the tags in
   order of preference and take the first that produces a value for
   the fiscal year in question. If none does, the field stays null —
   it is never estimated, never interpolated and never substituted
   from a neighbouring concept. A null renders as an em dash in the
   UI, which is the honest outcome.
   ================================================================ */

/** Preference-ordered tag chains. First hit wins, per fiscal year. */
const TAGS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
    "RevenuesNetOfInterestExpense"          // banks / broker-dealers
  ],
  costOfRevenue: [
    "CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold", "CostOfServices"
  ],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
  eps: ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted", "EarningsPerShareBasic"],
  da: [
    "DepreciationDepletionAndAmortization",
    "DepreciationAmortizationAndAccretionNet",
    "DepreciationAndAmortization",
    "Depreciation"
  ],
  ocf: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"
  ],
  capex: [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
    "PaymentsForCapitalImprovements",
    "PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets"
  ],
  cash: [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    "CashAndDueFromBanks"
  ],
  shortTermInvestments: ["ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"],
  receivables: ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"],
  inventory: ["InventoryNet"],
  currentAssets: ["AssetsCurrent"],
  totalAssets: ["Assets"],
  currentLiabilities: ["LiabilitiesCurrent"],
  longTermDebt: [
    "LongTermDebtNoncurrent", "LongTermDebt", "LongTermDebtAndCapitalLeaseObligations", "DebtLongtermAndShorttermCombinedAmount"
  ],
  shortTermDebt: [
    "LongTermDebtCurrent", "ShortTermBorrowings", "DebtCurrent", "CommercialPaper"
  ],
  equity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"
  ],
  dividends: ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"],
  buybacks: ["PaymentsForRepurchaseOfCommonStock"],
  shares: [
    "WeightedAverageNumberOfDilutedSharesOutstanding",
    "WeightedAverageNumberOfSharesOutstandingBasic",
    "CommonStockSharesOutstanding"
  ],
  // --- bank-specific ---
  nii: ["InterestIncomeExpenseNet", "InterestIncomeExpenseAfterProvisionForLoanLoss"],
  nir: ["NoninterestIncome"],
  provision: [
    "ProvisionForLoanLeaseAndOtherLosses",
    "ProvisionForCreditLosses",
    "ProvisionForLoanAndLeaseLosses"
  ],
  expense: ["NoninterestExpense", "OperatingExpenses", "BenefitsLossesAndExpenses"],
  pretax: [
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"
  ],
  deposits: ["Deposits", "InterestBearingDepositLiabilities"],
  loans: [
    "NotesReceivableNet",
    "LoansAndLeasesReceivableNetReportedAmount",
    "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss"
  ],
  tangibleEquity: ["StockholdersEquity"],
  goodwill: ["Goodwill"],
  intangibles: ["FiniteLivedIntangibleAssetsNet", "IntangibleAssetsNetExcludingGoodwill"]
};

/** SIC ranges that mean "this is a financial institution", which
 *  changes the entire analytical framework (no unlevered FCF DCF). */
function isFinancialSIC(sic){
  const n = parseInt(sic, 10);
  if(!n) return false;
  return (n >= 6020 && n <= 6220) || (n >= 6300 && n <= 6411) || n === 6199 || n === 6770;
}

/** Pull the value of one concept for one fiscal year.
 *  form: "10-K" annual figures only, taking the most recently FILED
 *  version of that fiscal year so restatements win over originals. */
function pickYear(facts, chain, fy, wantDuration){
  for(const tag of chain){
    const node = facts?.["us-gaap"]?.[tag] ?? facts?.["dei"]?.[tag];
    if(!node?.units) continue;
    const unitKey = Object.keys(node.units).find(u => u === "USD" || u === "USD/shares" || u === "shares");
    if(!unitKey) continue;
    const rows = node.units[unitKey].filter(r =>
      r.fy === fy && r.fp === "FY" && (r.form === "10-K" || r.form === "10-K/A")
    );
    // duration facts (income/cash flow) carry start+end; instant facts
    // (balance sheet) carry only end. Filter to the right kind so an
    // annual revenue is never confused with a quarterly one.
    const shaped = rows.filter(r => wantDuration ? (r.start && r.end && daysBetween(r.start, r.end) > 300)
                                                 : !r.start);
    const pool = shaped.length ? shaped : rows;
    if(!pool.length) continue;
    pool.sort((a,b) => (a.filed < b.filed ? 1 : -1));   // newest filing first
    const v = pool[0].val;
    if(v != null && !Number.isNaN(v)) return v;
  }
  return null;
}

function daysBetween(a, b){ return (new Date(b) - new Date(a)) / 86400000; }

const M = v => v == null ? null : v / 1e6;              // dollars → millions
const add = (a, b) => (a == null && b == null) ? null : (a || 0) + (b || 0);

/** Build one fiscal year row in the shape the FINAI engine expects. */
function buildYear(facts, fy, bank){
  const g = (k, dur = true) => pickYear(facts, TAGS[k], fy, dur);

  const rev = g("revenue");
  const ni  = g("netIncome");
  if(rev == null && ni == null) return null;            // nothing usable for this year

  if(bank){
    const nii = g("nii"), nir = g("nir");
    return {
      fy,
      nii: M(nii), nir: M(nir),
      rev: M(rev != null ? rev : add(nii, nir)),
      provision: M(g("provision")),
      expense:   M(g("expense")),
      pretax:    M(g("pretax")),
      ni: M(ni), eps: g("eps"),
      ta:  M(g("totalAssets", false)),
      eq:  M(g("equity", false)),
      deposits: M(g("deposits", false)),
      loans:    M(g("loans", false)),
      div: M(g("dividends")), bb: M(g("buybacks"))
    };
  }

  let gp = g("grossProfit");
  const cor = g("costOfRevenue");
  if(gp == null && rev != null && cor != null) gp = rev - cor;   // derived, not invented

  const ltd = g("longTermDebt", false), std = g("shortTermDebt", false);
  const cash = g("cash", false), sti = g("shortTermInvestments", false);

  return {
    fy,
    rev: M(rev), gp: M(gp),
    opInc: M(g("operatingIncome")),
    ni: M(ni), eps: g("eps"),
    da: M(g("da")), ocf: M(g("ocf")), capex: M(g("capex")),
    cash: M(add(cash, sti)),
    ar: M(g("receivables", false)), inv: M(g("inventory", false)),
    ca: M(g("currentAssets", false)), ta: M(g("totalAssets", false)),
    cl: M(g("currentLiabilities", false)),
    debt: M(add(ltd, std)),
    eq: M(g("equity", false)),
    div: M(g("dividends")), bb: M(g("buybacks"))
  };
}

/** Derive DCF assumptions from the company's own history.
 *  These are mechanical, not hand-tuned — and the UI says so. */
function deriveAssumptions(years, bank){
  if(bank || years.length < 2) return {dcfDefaults:null, waccInputs:null};
  const last = years[years.length - 1], first = years[0];
  const n = years.length - 1;

  let cagr = null;
  if(first.rev > 0 && last.rev > 0) cagr = Math.pow(last.rev / first.rev, 1/n) - 1;
  // clamp to a defensible forecast range, then fade toward GDP-like growth
  const g0 = Math.max(0.02, Math.min(0.25, cagr == null ? 0.06 : cagr * 0.7));
  const gT = 0.04;
  const growth = [0,1,2,3,4].map(i => +(g0 + (gT - g0) * (i / 4)).toFixed(4));

  const margins = years.filter(y => y.opInc != null && y.rev > 0).map(y => y.opInc / y.rev);
  const lastMargin = margins.length ? margins[margins.length - 1] : 0.10;
  const avgMargin  = margins.length ? margins.reduce((a,b) => a+b, 0) / margins.length : 0.10;
  // target the better of "recent" and "through-cycle average", lightly
  const target = Math.max(0.01, Math.min(0.55, (lastMargin + avgMargin) / 2));

  const pctOf = (k) => {
    const vals = years.filter(y => y[k] != null && y.rev > 0).map(y => Math.abs(y[k]) / y.rev);
    return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null;
  };

  return {
    dcfDefaults:{
      growth,
      ebitMarginTarget: +target.toFixed(4),
      tax: 0.24,
      daPct:    +(pctOf("da")    ?? 0.04).toFixed(4),
      capexPct: +(pctOf("capex") ?? 0.05).toFixed(4),
      nwcPct: 0.05,
      wacc: 0.090,
      tgr:  0.028
    },
    // Beta is not in EDGAR. 1.10 is a neutral placeholder and the UI
    // labels the WACC build-up as an assumption the user should set.
    waccInputs:{rf:0.042, erp:0.050, beta:1.10, kd:0.055, debtWeight:0.15}
  };
}

/** Assemble the full Company object the FINAI engine consumes. */
function mapCompany({facts, submissions, quote, ticker}){
  const sic  = submissions?.sic;
  const bank = isFinancialSIC(sic);

  // Which fiscal years does this filer actually have annual data for?
  const seen = new Set();
  const scan = TAGS.revenue.concat(TAGS.netIncome);
  for(const tag of scan){
    const node = facts?.["us-gaap"]?.[tag];
    if(!node?.units?.USD) continue;
    node.units.USD.forEach(r => {
      if((r.form === "10-K" || r.form === "10-K/A") && r.fp === "FY" && r.fy) seen.add(r.fy);
    });
  }
  const fys = [...seen].sort((a,b) => a-b).slice(-5);
  const years = fys.map(fy => buildYear(facts, fy, bank)).filter(Boolean);
  if(years.length < 2) {
    const err = new Error("Not enough annual XBRL data to build a model");
    err.code = "INSUFFICIENT_DATA";
    throw err;
  }

  const shares = quote?.sharesOutstanding
    ?? M(pickYear(facts, TAGS.shares, fys[fys.length-1], true))
    ?? null;

  const last = years[years.length - 1];
  let tangibleEquity = null;
  if(bank && last.eq != null){
    const gw = M(pickYear(facts, TAGS.goodwill, last.fy, false)) || 0;
    const it = M(pickYear(facts, TAGS.intangibles, last.fy, false)) || 0;
    tangibleEquity = last.eq - gw - it;
  }

  const filings = (submissions?.filings?.recent
    ? submissions.filings.recent.form.map((form, i) => ({
        type: form,
        date: submissions.filings.recent.filingDate[i],
        period: submissions.filings.recent.reportDate?.[i] || ""
      })).filter(f => ["10-K","10-Q","8-K"].includes(f.type)).slice(0, 6)
    : []);

  const { dcfDefaults, waccInputs } = deriveAssumptions(years, bank);

  return {
    ticker,
    name: submissions?.name || ticker,
    exchange: submissions?.exchanges?.[0] || "—",
    sector: bank ? "Financials" : (submissions?.sicDescription || "—"),
    industry: submissions?.sicDescription || "—",
    type: bank ? "financial" : "operating",
    fyEnd: submissions?.fiscalYearEnd ? monthName(submissions.fiscalYearEnd) : "—",
    currency: "USD",
    price: quote?.price ?? null,
    priceChg: quote?.changePct ?? null,
    shares,
    tangibleEquity,
    concentration: null,
    cyclical: false,
    regulated: bank,
    profile: submissions?.sicDescription
      ? `${submissions.name} is classified by the SEC under ${submissions.sicDescription} (SIC ${sic}). This profile is generated from EDGAR metadata; the curated demo companies carry a written business description, auto-mapped companies do not.`
      : "Profile generated from EDGAR metadata.",
    years,
    quarters: null,
    peers: [],                      // EDGAR carries no peer multiples — see README
    filings,
    dcfDefaults,
    waccInputs,
    _live: true,
    _sic: sic
  };
}

function monthName(fyEnd){
  const mm = parseInt(String(fyEnd).slice(0,2), 10);
  return ["January","February","March","April","May","June","July",
          "August","September","October","November","December"][mm-1] || "—";
}

module.exports = { mapCompany, isFinancialSIC, TAGS, buildYear, deriveAssumptions, pickYear };
