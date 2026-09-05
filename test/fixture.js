// Synthetic companyfacts in the exact shape data.sec.gov returns,
// built to exercise the awkward cases: tag drift across years,
// restatements, quarterly rows mixed with annual, missing gross profit.
function dur(fy, val, tag, filed, start, end, form){
  return {start:start||`${fy}-01-01`, end:end||`${fy}-12-31`, val, fy, fp:"FY", form:form||"10-K", filed:filed||`${fy+1}-02-15`};
}
function inst(fy, val, filed){ return {end:`${fy}-12-31`, val, fy, fp:"FY", form:"10-K", filed:filed||`${fy+1}-02-15`}; }
const U = rows => ({units:{USD:rows}});
const S = rows => ({units:{"USD/shares":rows}});

const facts = {facts:{"us-gaap":{
  // revenue reported under an OLD tag for 2021-22 and a NEW tag after
  Revenues: U([dur(2021,100000000000), dur(2022,120000000000)]),
  RevenueFromContractWithCustomerExcludingAssessedTax: U([
    dur(2023,145000000000), dur(2024,170000000000),
    dur(2025,190000000000, null, "2026-02-15"),
    dur(2025,188000000000, null, "2026-01-05"),          // superseded original filing
    {start:"2025-07-01",end:"2025-09-30",val:47000000000,fy:2025,fp:"FY",form:"10-K",filed:"2026-02-15"} // a quarterly row that must NOT win
  ]),
  CostOfGoodsAndServicesSold: U([dur(2021,60000000000),dur(2022,72000000000),dur(2023,85000000000),dur(2024,99000000000),dur(2025,110000000000)]),
  OperatingIncomeLoss: U([dur(2021,18000000000),dur(2022,21000000000),dur(2023,27000000000),dur(2024,33000000000),dur(2025,38000000000)]),
  NetIncomeLoss: U([dur(2021,14000000000),dur(2022,16500000000),dur(2023,21000000000),dur(2024,26000000000),dur(2025,30000000000)]),
  DepreciationDepletionAndAmortization: U([dur(2021,5000000000),dur(2022,5400000000),dur(2023,5900000000),dur(2024,6300000000),dur(2025,6800000000)]),
  NetCashProvidedByUsedInOperatingActivities: U([dur(2021,20000000000),dur(2022,23000000000),dur(2023,29000000000),dur(2024,35000000000),dur(2025,40000000000)]),
  PaymentsToAcquirePropertyPlantAndEquipment: U([dur(2021,7000000000),dur(2022,8000000000),dur(2023,9000000000),dur(2024,11000000000),dur(2025,13000000000)]),
  CashAndCashEquivalentsAtCarryingValue: U([inst(2021,15000000000),inst(2022,17000000000),inst(2023,20000000000),inst(2024,24000000000),inst(2025,26000000000)]),
  AssetsCurrent: U([inst(2021,40000000000),inst(2022,45000000000),inst(2023,52000000000),inst(2024,60000000000),inst(2025,66000000000)]),
  Assets: U([inst(2021,120000000000),inst(2022,135000000000),inst(2023,155000000000),inst(2024,180000000000),inst(2025,200000000000)]),
  LiabilitiesCurrent: U([inst(2021,30000000000),inst(2022,33000000000),inst(2023,37000000000),inst(2024,42000000000),inst(2025,46000000000)]),
  LongTermDebtNoncurrent: U([inst(2021,25000000000),inst(2022,26000000000),inst(2023,27000000000),inst(2024,28000000000),inst(2025,29000000000)]),
  StockholdersEquity: U([inst(2021,50000000000),inst(2022,58000000000),inst(2023,70000000000),inst(2024,85000000000),inst(2025,100000000000)]),
  PaymentsOfDividendsCommonStock: U([dur(2021,2000000000),dur(2022,2200000000),dur(2023,2400000000),dur(2024,2600000000),dur(2025,2800000000)]),
  PaymentsForRepurchaseOfCommonStock: U([dur(2021,5000000000),dur(2022,6000000000),dur(2023,7000000000),dur(2024,8000000000),dur(2025,9000000000)]),
  EarningsPerShareDiluted: S([dur(2021,2.80),dur(2022,3.30),dur(2023,4.20),dur(2024,5.20),dur(2025,6.00)]),
  // NOTE: no GrossProfit tag at all — must be derived from revenue − COGS
}}};
const submissions = {name:"Testco Industries, Inc.", sic:"3674", sicDescription:"Semiconductors & Related Devices",
  exchanges:["NASDAQ"], fiscalYearEnd:"1231",
  filings:{recent:{form:["10-K","10-Q","8-K","4","10-Q"],filingDate:["2026-02-15","2025-10-30","2025-10-29","2025-10-01","2025-07-31"],reportDate:["2025-12-31","2025-09-30","2025-09-30","","2025-06-30"]}}};
module.exports = {facts, submissions};
