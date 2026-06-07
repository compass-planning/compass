// server/planning/engines/education.ts
import type { EducationInputs, EducationAnalysis, EducationChildAnalysis, RespYearRow } from "../types.js";
import { CESG_ANNUAL_MAX, CESG_LIFETIME_MAX, CLB_FIRST_YEAR, CLB_SUBSEQUENT_YEAR, CLB_LIFETIME_MAX, CLB_INCOME_THRESHOLD, ANNUAL_EDUCATION_COSTS_2024, getCesgRate, CESG_ADDITIONAL_INCOME_1 } from "../data/taxData2024.js";

export function analyzeEducation(inputs: EducationInputs): EducationAnalysis {
  const { province, familyIncome, children, annualContribution, expectedReturnRate, educationType, programYears } = inputs;
  const cesgRate = getCesgRate(familyIncome);
  const additionalCesgRate = familyIncome <= 35000 ? 0.20 : familyIncome <= CESG_ADDITIONAL_INCOME_1 ? 0.10 : 0;
  const tuition = educationType === "university" ? ANNUAL_EDUCATION_COSTS_2024.university_tuition : educationType === "college" ? ANNUAL_EDUCATION_COSTS_2024.college_tuition : ANNUAL_EDUCATION_COSTS_2024.trades_tuition;
  const totalAnnualCost = tuition + ANNUAL_EDUCATION_COSTS_2024.living_expenses + ANNUAL_EDUCATION_COSTS_2024.books_supplies + ANNUAL_EDUCATION_COSTS_2024.misc;
  const totalProgramCost = totalAnnualCost * programYears;
  const currentYear = new Date().getFullYear();
  const childrenAnalysis: EducationChildAnalysis[] = children.map(child => {
    const yearsUntil = Math.max(0, 18 - child.age), contribPerChild = annualContribution / Math.max(children.length, 1);
    let balance = child.existingRespBalance, totalCesg = 0, remainingCesgRoom = CESG_LIFETIME_MAX, clbTotal = 0;
    const yearByYear: RespYearRow[] = [];
    for (let i = 0; i < yearsUntil; i++) {
      const year = currentYear + i, childAge = child.age + i;
      const contribution = Math.min(contribPerChild, 50000 - balance);
      const cesgBase = Math.min(contribution, 2500) * 0.20, cesgAdditional = Math.min(contribution, 500) * additionalCesgRate;
      const cesgY = Math.min(cesgBase + cesgAdditional, remainingCesgRoom, CESG_ANNUAL_MAX * 1.4);
      remainingCesgRoom = Math.max(0, remainingCesgRoom - cesgY); totalCesg += cesgY;
      const clbY = i===0&&familyIncome<=CLB_INCOME_THRESHOLD?CLB_FIRST_YEAR:familyIncome<=CLB_INCOME_THRESHOLD&&clbTotal<CLB_LIFETIME_MAX?CLB_SUBSEQUENT_YEAR:0;
      clbTotal += clbY;
      const opening = balance, growth = (balance + contribution + cesgY + clbY) * expectedReturnRate;
      balance = balance + contribution + cesgY + clbY + growth;
      yearByYear.push({ year, childAge, openingBalance:Math.round(opening), contribution:Math.round(contribution), cesg:Math.round(cesgBase), additionalCesg:Math.round(cesgAdditional), clb:Math.round(clbY), growth:Math.round(growth), closingBalance:Math.round(balance) });
    }
    const inflatedCost = totalProgramCost * Math.pow(1.03, yearsUntil);
    return { name:child.name, age:child.age, yearsUntilPostSecondary:yearsUntil, annualContributionRecommended:Math.round(contribPerChild), projectedRespBalance:Math.round(balance), totalCesgForChild:Math.round(totalCesg), lifetimeCesgRemaining:Math.round(remainingCesgRoom), estimatedEducationCost:Math.round(inflatedCost), shortfallOrSurplus:Math.round(balance-inflatedCost), yearByYear };
  });
  return { children:childrenAnalysis, totalRecommendedAnnualContribution:Math.round(annualContribution), totalProjectedRespValue:Math.round(childrenAnalysis.reduce((s,c)=>s+c.projectedRespBalance,0)), totalCesgReceived:Math.round(childrenAnalysis.reduce((s,c)=>s+c.totalCesgForChild,0)), totalEstimatedEducationCost:Math.round(childrenAnalysis.reduce((s,c)=>s+c.estimatedEducationCost,0)), shortfallOrSurplus:Math.round(childrenAnalysis.reduce((s,c)=>s+c.shortfallOrSurplus,0)), familyCesgRate:cesgRate, additionalCesgPerChild:Math.round(500*additionalCesgRate), clbPerChild:familyIncome<=CLB_INCOME_THRESHOLD?CLB_LIFETIME_MAX:0 };
}