/* Offline tests for the XBRL mapper. These run without network access:
   the fixture reproduces the exact shape data.sec.gov returns, including
   the awkward cases that break naive mappers. */
const assert = require("assert");
const { mapCompany, isFinancialSIC, deriveAssumptions } = require("../lib/xbrl.js");
const { facts, submissions } = require("./fixture.js");

let pass = 0;
const t = (name, fn) => { try { fn(); console.log("  ✓ " + name); pass++; }
                          catch(e){ console.log("  ✗ " + name + " — " + e.message); process.exitCode = 1; } };

const c = mapCompany({facts: facts.facts, submissions,
  quote:{price:250, changePct:0.012, sharesOutstanding:5000}, ticker:"TEST"});

console.log("\nXBRL mapper");
t("builds five fiscal years", () => assert.strictEqual(c.years.length, 5));
t("follows tag drift across years (Revenues → RevenueFromContract…)", () => {
  assert.strictEqual(c.years[0].rev, 100000);   // old tag
  assert.strictEqual(c.years[4].rev, 190000);   // new tag
});
t("prefers the restated figure over the superseded original", () =>
  assert.strictEqual(c.years[4].rev, 190000));  // not 188000
t("ignores quarterly rows mixed into annual data", () =>
  assert.notStrictEqual(c.years[4].rev, 47000));
t("derives gross profit when no GrossProfit tag exists", () =>
  assert.strictEqual(c.years[4].gp, 190000 - 110000));
t("converts dollars to millions", () => assert.strictEqual(c.years[4].ni, 30000));
t("combines short- and long-term debt", () => assert.strictEqual(c.years[4].debt, 29000));
t("reads balance-sheet instants separately from durations", () =>
  assert.strictEqual(c.years[4].eq, 100000));
t("keeps EPS in dollars per share, not millions", () =>
  assert.strictEqual(c.years[4].eps, 6.00));
t("filters filings to 10-K/10-Q/8-K only", () =>
  assert.ok(c.filings.every(f => ["10-K","10-Q","8-K"].includes(f.type))));
t("carries the live quote through", () => assert.strictEqual(c.price, 250));
t("flags the company as live-mapped", () => assert.strictEqual(c._live, true));
t("leaves peers empty rather than inventing them", () =>
  assert.deepStrictEqual(c.peers, []));

console.log("\nNull safety");
t("missing concept yields null, never zero", () => {
  const stripped = JSON.parse(JSON.stringify(facts.facts));
  delete stripped["us-gaap"].NetCashProvidedByUsedInOperatingActivities;
  const c2 = mapCompany({facts: stripped, submissions, quote:null, ticker:"TEST"});
  assert.strictEqual(c2.years[4].ocf, null);
});
t("no quote leaves price null rather than 0", () => {
  const c3 = mapCompany({facts: facts.facts, submissions, quote:null, ticker:"TEST"});
  assert.strictEqual(c3.price, null);
});
t("too few years throws INSUFFICIENT_DATA", () => {
  const thin = {"us-gaap":{Revenues:{units:{USD:[
    {start:"2025-01-01",end:"2025-12-31",val:1e9,fy:2025,fp:"FY",form:"10-K",filed:"2026-02-01"}]}}}};
  assert.throws(() => mapCompany({facts:thin, submissions, quote:null, ticker:"X"}),
    e => e.code === "INSUFFICIENT_DATA");
});

console.log("\nSector classification");
t("bank SIC is detected", () => assert.ok(isFinancialSIC("6021")));
t("broker-dealer SIC is detected", () => assert.ok(isFinancialSIC("6211")));
t("semiconductor SIC is not financial", () => assert.ok(!isFinancialSIC("3674")));
t("financial company gets no DCF defaults", () => {
  const bank = mapCompany({facts:facts.facts, submissions:Object.assign({},submissions,{sic:"6021"}),
    quote:null, ticker:"BNK"});
  assert.strictEqual(bank.dcfDefaults, null);
  assert.strictEqual(bank.type, "financial");
});

console.log("\nDerived assumptions");
t("growth fades toward a terminal rate", () => {
  const g = c.dcfDefaults.growth;
  assert.ok(g[0] > g[4], "should decline");
  assert.strictEqual(g[4], 0.04);
});
t("growth is clamped to a defensible range", () => {
  const wild = deriveAssumptions([{fy:1,rev:1,opInc:0.1},{fy:2,rev:900,opInc:90}], false);
  assert.ok(wild.dcfDefaults.growth[0] <= 0.25, "capped at 25%");
});
t("capex and D&A are percentages of revenue", () => {
  assert.ok(c.dcfDefaults.capexPct > 0 && c.dcfDefaults.capexPct < 0.5);
  assert.ok(c.dcfDefaults.daPct > 0 && c.dcfDefaults.daPct < 0.5);
});
t("margin target stays within bounds", () => {
  assert.ok(c.dcfDefaults.ebitMarginTarget > 0 && c.dcfDefaults.ebitMarginTarget < 0.55);
});

console.log("\n" + pass + " assertions passed");
