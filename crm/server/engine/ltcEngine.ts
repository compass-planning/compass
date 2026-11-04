/**
 * ltcEngine.ts — Long-Term Care Planning Engine
 *
 * Models:
 *  - 3 / 5 / 10 year benefit POOLS (total $ pool, not monthly max)
 *  - Pools last longer at below-max daily utilization
 *  - Self-insure vs insure NPV comparison
 *  - Break-even age calculation
 *  - Provincial care cost defaults
 *  - Inflation protection options
 *  - Hybrid life/LTC products
 *  - Elimination period out-of-pocket cost
 */

export type PoolYears = 3 | 5 | 10;
export type EliminationDays = 0 | 30 | 60 | 90 | 180 | 365;
export type InflationProtection = 'none' | '3pct' | '5pct' | 'cpi';
export type CareLevel = 'basic' | 'semi_private' | 'private';

export interface LTCInput {
  currentAge:          number;
  province:            string;
  dailyBenefit:        number;       // $/day maximum benefit
  poolYears:           PoolYears;
  eliminationDays:     EliminationDays;
  inflationProtection: InflationProtection;
  estAnnualPremium:    number;       // advisor-entered or estimated
  careCostInflation:   number;       // decimal e.g. 0.04
  estClaimAge:         number;       // age at which claim is expected to occur
  careLevel:           CareLevel;
  hybridLifeBenefit?:  number;       // total hybrid policy death benefit
  hybridLtcPct?:       number;       // % of total benefit allocated to LTC (0-100)
}

export interface LTCResult {
  // Pool fundamentals
  totalPoolDollars:    number;       // dailyBenefit × poolYears × 365
  dailyBenefitAtClaim: number;       // inflation-adjusted at est. claim age
  poolDuration: {
    atFullRate:        number;       // years at 100% daily utilization
    at80pctRate:       number;       // years at 80% utilization
    at60pctRate:       number;       // years at 60% utilization
  };

  // Elimination period
  eliminationCost:     number;       // out-of-pocket cost during elimination period

  // Inflation protection effect
  dailyBenefitWithRider: number;     // daily benefit at claim age with inflation rider
  riderValueAdd:         number;     // extra pool value from rider vs no rider

  // Self-insure analysis
  selfInsure: {
    totalCareCostAtClaim:  number;   // full care cost (basic + semi-priv + private) at claim age
    selectedLevelCost:     number;   // cost at chosen care level at claim age
    npvTodayFullRate:      number;   // NPV of full-rate care cost at claim age, discounted at 4% real
    npvTodayAtPool:        number;   // NPV of care cost over pool duration
  };

  // Premiums
  totalPremiumsToClaimAge: number;   // cumulative premiums from now to est. claim age
  totalPremiumsToLife:     number;   // cumulative premiums from now to life expectancy (90)

  // Break-even
  breakEvenAge:            number;   // age where cumulative premiums = self-insure cost
  breakEvenYears:          number;   // years from now to break-even

  // Hybrid (if applicable)
  hybrid?: {
    ltcPool:          number;       // portion of hybrid benefit allocated to LTC
    lifeBenefit:      number;       // death benefit if LTC not claimed
    ltcMonthlyMax:    number;       // approx monthly max from hybrid
  };

  // Provincial context
  provincialDailyCost:     number;  // recommended daily benefit for province/level
  adequacyGap:             number;  // recommended daily - chosen daily benefit (0 if adequate)
}

// ── Provincial daily care costs (2024 estimates, CAD) ─────────────────────────
// Source: provincial health authority rate schedules and industry surveys

const PROVINCIAL_DAILY_COSTS: Record<string, Record<CareLevel, number>> = {
  ON: { basic: 185,  semi_private: 240,  private: 325 },
  QC: { basic:  95,  semi_private: 165,  private: 250 },  // CHSLD subsidized
  BC: { basic: 195,  semi_private: 260,  private: 360 },
  AB: { basic: 175,  semi_private: 230,  private: 310 },
  SK: { basic: 155,  semi_private: 205,  private: 285 },
  MB: { basic: 160,  semi_private: 215,  private: 295 },
  NB: { basic: 140,  semi_private: 190,  private: 265 },
  NS: { basic: 145,  semi_private: 195,  private: 270 },
  NL: { basic: 135,  semi_private: 185,  private: 255 },
  PE: { basic: 130,  semi_private: 175,  private: 245 },
  // Territories default
  NT: { basic: 200,  semi_private: 265,  private: 375 },
  NU: { basic: 200,  semi_private: 265,  private: 375 },
  YT: { basic: 190,  semi_private: 255,  private: 355 },
};

function getProvincialCost(province: string, level: CareLevel): number {
  const prov = PROVINCIAL_DAILY_COSTS[province.toUpperCase()];
  return prov ? prov[level] : PROVINCIAL_DAILY_COSTS.ON[level];
}

// ── Inflation rider multiplier at claim age ────────────────────────────────────

function inflationRiderMultiplier(
  currentAge:    number,
  claimAge:      number,
  protection:    InflationProtection,
): number {
  const years = Math.max(0, claimAge - currentAge);
  switch (protection) {
    case '3pct': return Math.pow(1.03, years);
    case '5pct': return Math.pow(1.05, years);
    case 'cpi':  return Math.pow(1.02, years);  // assume CPI = 2%
    case 'none': return 1;
    default:     return 1;
  }
}

// ── NPV helper (4% real discount rate for self-insure comparison) ─────────────

function npv(annualCost: number, startYear: number, durationYears: number, discountRate = 0.04): number {
  let pv = 0;
  for (let i = 0; i < durationYears; i++) {
    pv += annualCost / Math.pow(1 + discountRate, startYear + i);
  }
  return Math.round(pv);
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function runLTCEngine(input: LTCInput): LTCResult {
  const {
    currentAge, province, dailyBenefit, poolYears, eliminationDays,
    inflationProtection, estAnnualPremium, careCostInflation,
    estClaimAge, careLevel, hybridLifeBenefit, hybridLtcPct,
  } = input;

  const yearsToClaimAge = Math.max(0, estClaimAge - currentAge);
  const yearsToLife     = Math.max(0, 90 - currentAge);

  // ── Pool fundamentals ──────────────────────────────────────────────────────
  const totalPoolDollars     = Math.round(dailyBenefit * poolYears * 365);
  const riderMult            = inflationRiderMultiplier(currentAge, estClaimAge, inflationProtection);
  const dailyBenefitAtClaim  = Math.round(dailyBenefit * riderMult);
  const dailyBenefitNoRider  = dailyBenefit;

  // Pool duration at various utilization rates (pool lasts LONGER at sub-max utilization)
  const poolDuration = {
    atFullRate: totalPoolDollars / (dailyBenefitAtClaim * 365),
    at80pctRate: totalPoolDollars / (dailyBenefitAtClaim * 0.80 * 365),
    at60pctRate: totalPoolDollars / (dailyBenefitAtClaim * 0.60 * 365),
  };

  // ── Elimination period out-of-pocket ──────────────────────────────────────
  const provincialDailyCost = getProvincialCost(province, careLevel);
  const dailyCostAtClaim    = Math.round(provincialDailyCost * Math.pow(1 + careCostInflation, yearsToClaimAge));
  const eliminationCost     = Math.round(dailyCostAtClaim * eliminationDays);

  // ── Inflation rider value add ──────────────────────────────────────────────
  const dailyBenefitWithRider  = dailyBenefitAtClaim;
  const poolWithRider          = dailyBenefitAtClaim  * poolYears * 365;
  const poolWithoutRider       = dailyBenefitNoRider  * poolYears * 365;
  const riderValueAdd          = Math.round(poolWithRider - poolWithoutRider);

  // ── Self-insure analysis ──────────────────────────────────────────────────
  // Full care costs at claim age across all levels
  const basicAtClaim        = Math.round(getProvincialCost(province, 'basic')        * Math.pow(1 + careCostInflation, yearsToClaimAge));
  const semiPrivateAtClaim  = Math.round(getProvincialCost(province, 'semi_private') * Math.pow(1 + careCostInflation, yearsToClaimAge));
  const privateAtClaim      = Math.round(getProvincialCost(province, 'private')      * Math.pow(1 + careCostInflation, yearsToClaimAge));

  const selectedLevelCostAtClaim = careLevel === 'basic' ? basicAtClaim
    : careLevel === 'semi_private' ? semiPrivateAtClaim : privateAtClaim;

  // Annual cost at claim age
  const annualCostAtClaim     = selectedLevelCostAtClaim * 365;
  const annualCostFullRate    = dailyCostAtClaim * 365;

  // NPV of care costs (discounted back to today at 4% real)
  const avgPoolDuration       = poolDuration.at80pctRate;
  const npvTodayFullRate      = npv(annualCostAtClaim, yearsToClaimAge, Math.ceil(avgPoolDuration));
  const npvTodayAtPool        = npv(annualCostAtClaim, yearsToClaimAge, poolYears);  // assume pool duration

  // ── Premiums ──────────────────────────────────────────────────────────────
  const annualPrem             = estAnnualPremium || estimatePremium(input);
  const totalPremiumsToClaimAge = Math.round(annualPrem * yearsToClaimAge);
  const totalPremiumsToLife     = Math.round(annualPrem * yearsToLife);

  // ── Break-even ────────────────────────────────────────────────────────────
  // At what age do cumulative premiums = NPV of care costs?
  // Simplified: annual premium × years = care cost NPV
  let breakEvenAge   = 999;
  let breakEvenYears = 999;
  if (annualPrem > 0 && npvTodayAtPool > 0) {
    const yearsNeeded = npvTodayAtPool / annualPrem;
    breakEvenAge   = Math.round(currentAge + yearsNeeded);
    breakEvenYears = Math.round(yearsNeeded);
    // Cap at life expectancy
    if (breakEvenAge > 95) breakEvenAge = 95;
  }

  // ── Adequacy gap ──────────────────────────────────────────────────────────
  const recommendedDaily = getProvincialCost(province, careLevel);
  const adequacyGap      = Math.max(0, recommendedDaily - dailyBenefit);

  // ── Hybrid product (if applicable) ───────────────────────────────────────
  let hybrid: LTCResult['hybrid'] = undefined;
  if (hybridLifeBenefit && hybridLtcPct) {
    const ltcPortion = Math.round(hybridLifeBenefit * (hybridLtcPct / 100));
    const lifePortion = hybridLifeBenefit - ltcPortion;
    hybrid = {
      ltcPool:       ltcPortion,
      lifeBenefit:   lifePortion,
      ltcMonthlyMax: Math.round(ltcPortion / (poolYears * 12)),
    };
  }

  return {
    totalPoolDollars,
    dailyBenefitAtClaim,
    poolDuration: {
      atFullRate:   Math.round(poolDuration.atFullRate  * 10) / 10,
      at80pctRate:  Math.round(poolDuration.at80pctRate * 10) / 10,
      at60pctRate:  Math.round(poolDuration.at60pctRate * 10) / 10,
    },
    eliminationCost,
    dailyBenefitWithRider,
    riderValueAdd,
    selfInsure: {
      totalCareCostAtClaim: annualCostAtClaim,
      selectedLevelCost:    selectedLevelCostAtClaim,
      npvTodayFullRate,
      npvTodayAtPool,
    },
    totalPremiumsToClaimAge,
    totalPremiumsToLife,
    breakEvenAge,
    breakEvenYears,
    hybrid,
    provincialDailyCost: recommendedDaily,
    adequacyGap,
  };
}

// ── Premium estimator (rough actuarial estimate when not provided) ─────────────
// Based on CLHIA industry averages for a standard LTC policy

function estimatePremium(input: LTCInput): number {
  const { currentAge, dailyBenefit, poolYears, eliminationDays, inflationProtection } = input;

  // Base rate per $1/day of benefit (annual, by age at issue)
  const baseRatePerDay =
    currentAge < 50 ? 3.50 :
    currentAge < 55 ? 4.80 :
    currentAge < 60 ? 7.20 :
    currentAge < 65 ? 11.50 :
    currentAge < 70 ? 18.00 : 28.00;

  let premium = dailyBenefit * baseRatePerDay;

  // Pool years adjustment
  if (poolYears === 3)  premium *= 0.75;
  if (poolYears === 10) premium *= 1.45;

  // Elimination period discount
  if (eliminationDays >= 180) premium *= 0.82;
  else if (eliminationDays >= 90) premium *= 0.92;
  else if (eliminationDays <= 30) premium *= 1.12;

  // Inflation protection loading
  if (inflationProtection === '5pct') premium *= 1.35;
  else if (inflationProtection === '3pct') premium *= 1.18;
  else if (inflationProtection === 'cpi')  premium *= 1.10;

  return Math.round(premium);
}
