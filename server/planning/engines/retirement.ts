// server/planning/engines/retirement.ts
import type { RetirementInputs, RetirementProjection, RetirementYearRow } from "../types.js";
import { calculateFederalTax, calculateProvincialTax, calculateCPP, getCppMonthlyBenefit, getOasMonthlyBenefit, getRrifMinimumFactor, getMarginalRate } from "../data/taxData2024.js";

export function projectRetirement(inputs: RetirementInputs, locale = "en"): RetirementProjection {
  const { currentAge, retirementAge, planToAge, province, rrspBalance, tfsaBalance, nonRegBalance, annualRrspContribution, annualTfsaContribution, annualNonRegContribution, employmentIncome, desiredRetirementIncome, cppStartAge, oasStartAge, yearsInCanada, equityReturn, bondReturn, inflationRate, equityAllocation, pensionMonthly, rrifConversionAge } = inputs;
  const portfolioReturn = equityReturn * equityAllocation + bondReturn * (1 - equityAllocation);
  let rrsp = rrspBalance, tfsa = tfsaBalance, nonReg = nonRegBalance;
  const yearByYear: RetirementYearRow[] = [];
  for (let age = currentAge; age < retirementAge; age++) {
    const year = new Date().getFullYear() + (age - currentAge);
    rrsp  = (rrsp  + annualRrspContribution)  * (1 + portfolioReturn);
    tfsa  = (tfsa  + annualTfsaContribution)  * (1 + portfolioReturn);
    nonReg = (nonReg + annualNonRegContribution) * (1 + portfolioReturn);
    const tax = calculateFederalTax(employmentIncome) + calculateProvincialTax(employmentIncome, province) + calculateCPP(employmentIncome);
    yearByYear.push({ age, year, rrspBalance: Math.round(rrsp), tfsaBalance: Math.round(tfsa), nonRegBalance: Math.round(nonReg), totalBalance: Math.round(rrsp+tfsa+nonReg), withdrawalAmount: 0, cppIncome: 0, oasIncome: 0, pensionIncome: 0, totalIncome: employmentIncome, taxPayable: Math.round(tax), netIncome: Math.round(employmentIncome - tax) });
  }
  const rrspAtRetirement = Math.round(rrsp), tfsaAtRetirement = Math.round(tfsa), nonRegAtRetirement = Math.round(nonReg);
  const cppMonthly = getCppMonthlyBenefit(cppStartAge), oasMonthly = getOasMonthlyBenefit(oasStartAge, yearsInCanada);
  const cppAnnual = cppMonthly * 12, oasAnnual = oasMonthly * 12, pensionAnnual = pensionMonthly * 12;
  const cpp65Monthly = getCppMonthlyBenefit(65), cppDiff = cppMonthly - cpp65Monthly;
  const cppBreakevenAge = cppDiff !== 0 ? Math.round(cppStartAge + Math.abs(cpp65Monthly * (cppStartAge - 65) * 12 / cppDiff) / 12) : 65;
  const oas65Monthly = getOasMonthlyBenefit(65, yearsInCanada), oasDiff = oasMonthly - oas65Monthly;
  const oasBreakevenAge = oasDiff !== 0 ? Math.round(oasStartAge + Math.abs(oas65Monthly * (oasStartAge - 65) * 12 / oasDiff) / 12) : 65;
  let rRrsp = rrspAtRetirement, rTfsa = tfsaAtRetirement, rNonReg = nonRegAtRetirement;
  let portfolioDepletionAge: number | null = null, successfulYears = 0;
  const drawdownYears = planToAge - retirementAge;
  for (let age = retirementAge; age <= planToAge; age++) {
    const year = new Date().getFullYear() + (age - currentAge);
    const inflFactor = Math.pow(1 + inflationRate, age - retirementAge);
    const needed = desiredRetirementIncome * inflFactor;
    const cppY = age >= cppStartAge ? cppAnnual : 0;
    const oasY = age >= oasStartAge ? oasAnnual : 0;
    const govtIncome = cppY + oasY + pensionAnnual;
    const portNeeded = Math.max(0, needed - govtIncome);
    let rrspW = 0, tfsaW = 0, nonRegW = 0;
    if (age >= rrifConversionAge) { const min = rRrsp * getRrifMinimumFactor(age); rrspW = Math.min(rRrsp, Math.max(min, portNeeded)); }
    else { rrspW = Math.min(rRrsp, portNeeded); }
    let rem = portNeeded - rrspW;
    if (rem > 0) { nonRegW = Math.min(rNonReg, rem); rem -= nonRegW; }
    if (rem > 0) { tfsaW = Math.min(rTfsa, rem); }
    const totalW = rrspW + tfsaW + nonRegW, totalIncome = govtIncome + totalW;
    const taxable = rrspW + cppY + oasY + pensionAnnual;
    const taxPayable = Math.max(0, calculateFederalTax(taxable) + calculateProvincialTax(taxable, province));
    rRrsp   = Math.max(0, (rRrsp   - rrspW)   * (1 + portfolioReturn));
    rTfsa   = Math.max(0, (rTfsa   - tfsaW)   * (1 + portfolioReturn));
    rNonReg = Math.max(0, (rNonReg - nonRegW) * (1 + portfolioReturn));
    const totalBal = rRrsp + rTfsa + rNonReg;
    if (totalBal <= 0 && portfolioDepletionAge === null && age < planToAge) portfolioDepletionAge = age;
    else successfulYears++;
    yearByYear.push({ age, year, rrspBalance: Math.round(rRrsp), tfsaBalance: Math.round(rTfsa), nonRegBalance: Math.round(rNonReg), totalBalance: Math.round(totalBal), withdrawalAmount: Math.round(totalW), cppIncome: Math.round(cppY), oasIncome: Math.round(oasY), pensionIncome: Math.round(pensionAnnual), totalIncome: Math.round(totalIncome), taxPayable: Math.round(taxPayable), netIncome: Math.round(totalIncome - taxPayable) });
  }
  const successProbability = Math.round((successfulYears / Math.max(drawdownYears, 1)) * 100);
  const totalAtRetirement = rrspAtRetirement + tfsaAtRetirement + nonRegAtRetirement;
  const sustainableW = totalAtRetirement * 0.04;
  const totalAnnualGovt = cppAnnual + oasAnnual + pensionAnnual;
  const marginalNow = getMarginalRate(employmentIncome, province), marginalRet = getMarginalRate(desiredRetirementIncome, province);
  let rrspVsTfsaRecommendation: "rrsp" | "tfsa" | "split" = "split", rrspVsTfsaRationale = "";
  if (marginalNow > marginalRet + 0.05) { rrspVsTfsaRecommendation = "rrsp"; rrspVsTfsaRationale = locale==="fr"
    ? `Le taux marginal actuel (${(marginalNow*100).toFixed(1)}%) est nettement supérieur au taux de retraite projeté (${(marginalRet*100).toFixed(1)}%). Maximiser les cotisations REER offre le plus grand avantage de report d'impôt.`
    : `Current marginal rate (${(marginalNow*100).toFixed(1)}%) is significantly higher than projected retirement rate (${(marginalRet*100).toFixed(1)}%). Maximizing RRSP contributions provides the largest tax deferral benefit.`; }
  else if (marginalRet > marginalNow + 0.05) { rrspVsTfsaRecommendation = "tfsa"; rrspVsTfsaRationale = locale==="fr"
    ? `Le taux de retraite projeté (${(marginalRet*100).toFixed(1)}%) dépasse le taux actuel (${(marginalNow*100).toFixed(1)}%). Les retraits CELI ne sont pas imposables et ne déclencheront pas de récupération de la SV.`
    : `Projected retirement rate (${(marginalRet*100).toFixed(1)}%) exceeds current rate (${(marginalNow*100).toFixed(1)}%). TFSA withdrawals are not taxable income and will not trigger OAS clawback.`; }
  else { rrspVsTfsaRecommendation = "split"; rrspVsTfsaRationale = locale==="fr"
    ? `Les taux marginaux actuel (${(marginalNow*100).toFixed(1)}%) et à la retraite (${(marginalRet*100).toFixed(1)}%) sont similaires. Une stratégie mixte offre flexibilité et opportunités de fractionnement du revenu à la retraite.`
    : `Current (${(marginalNow*100).toFixed(1)}%) and projected retirement (${(marginalRet*100).toFixed(1)}%) marginal rates are similar. A split strategy provides flexibility and income-splitting opportunities in retirement.`; }
  return { yearsToRetirement: retirementAge - currentAge, retirementSavingsAtRetirement: totalAtRetirement, rrspAtRetirement, tfsaAtRetirement, nonRegAtRetirement, annualIncomeAtRetirement: desiredRetirementIncome, incomeFromRrsp: Math.round(Math.min(rrspAtRetirement * 0.04, Math.max(0, desiredRetirementIncome - totalAnnualGovt))), incomeFromTfsa: Math.round(Math.max(0, desiredRetirementIncome - totalAnnualGovt - rrspAtRetirement * 0.04)), incomeFromNonReg: 0, incomeFromCpp: Math.round(cppAnnual), incomeFromOas: Math.round(oasAnnual), incomeFromPension: Math.round(pensionAnnual), cppMonthlyBenefit: Math.round(cppMonthly * 100) / 100, oasMonthlyBenefit: Math.round(oasMonthly * 100) / 100, cppBreakevenAge, oasBreakevenAge, shortfallOrSurplus: Math.round(sustainableW + totalAnnualGovt - desiredRetirementIncome), fundingRatio: Math.round(((sustainableW + totalAnnualGovt) / Math.max(desiredRetirementIncome, 1)) * 100) / 100, portfolioDepletionAge, successProbability: Math.min(100, Math.max(0, successProbability)), yearByYear, rrspVsTfsaRecommendation, rrspVsTfsaRationale };
}