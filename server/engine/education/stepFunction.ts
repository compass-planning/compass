import type { RespProfile, RespYearProjection } from "./types";
import { calculateCesg, calculateClb } from "./grantEngine";

export interface RespStepState {
  year: number;
  balance: number;
  contributions: number;
  withdrawals: number;
  returns: { equity: number; bond: number; inflation: number };
  inflationCumulative: number;
  success: boolean;
  customData?: Record<string, number>;
}

export function createRespStepFn(profile: RespProfile, collectDetails = false) {
  const details: RespYearProjection[] = [];
  const yearsToEnrollment = profile.targetAge - profile.childAge;
  const targetCost = profile.targetEducationCost * 4;

  const stepFn = (
    state: RespStepState,
    returns: { equity: number; bond: number; inflation: number },
    _simIndex: number
  ): RespStepState => {
    const year = state.year;
    const childAge = profile.childAge + year - 1;

    const cesgUsedSoFar = state.customData?.cesgUsedToDate ?? profile.cesgReceivedToDate;
    const clbUsedSoFar = state.customData?.clbUsedToDate ?? profile.clbReceivedToDate;

    const isContributing = childAge < profile.targetAge;
    const contribution = isContributing ? profile.annualContribution : 0;

    const cesg = isContributing && childAge <= 17
      ? calculateCesg(contribution, profile.familyIncomeBracket, cesgUsedSoFar)
      : { totalCesg: 0, lifetimeCesgUsed: cesgUsedSoFar, basicCesg: 0, additionalCesg: 0, lifetimeRemaining: 0 };

    const clb = childAge <= 15
      ? calculateClb(childAge, clbUsedSoFar, profile.clbEligible)
      : { amount: 0, lifetimeUsed: clbUsedSoFar, lifetimeRemaining: 0, eligible: false };

    const portfolioReturn = profile.equityAllocation * returns.equity + profile.bondAllocation * returns.bond;
    const prevBalance = state.balance;
    const investmentReturn = prevBalance * portfolioReturn;
    const newBalance = prevBalance + contribution + cesg.totalCesg + clb.amount + investmentReturn;

    const inflationAdjustedCost = targetCost * Math.pow(1 + profile.educationCostInflation, year);

    const atTarget = year >= yearsToEnrollment;
    const success = atTarget ? newBalance >= inflationAdjustedCost : true;

    if (collectDetails) {
      details.push({
        year,
        age: childAge,
        contribution,
        cesg: cesg.totalCesg,
        clb: clb.amount,
        investmentReturn,
        balance: newBalance,
        inflationAdjustedCost,
      });
    }

    return {
      ...state,
      year,
      balance: Math.max(0, newBalance),
      contributions: state.contributions + contribution,
      withdrawals: 0,
      returns,
      success,
      customData: {
        cesgUsedToDate: cesg.lifetimeCesgUsed,
        clbUsedToDate: clb.lifetimeUsed,
        cesgThisYear: cesg.totalCesg,
        clbThisYear: clb.amount,
        contribution,
        inflationAdjustedCost,
        portfolioReturn: portfolioReturn * 100,
      },
    };
  };

  const initialState: RespStepState = {
    year: 0,
    balance: profile.currentBalance,
    contributions: 0,
    withdrawals: 0,
    returns: { equity: 0, bond: 0, inflation: 0 },
    inflationCumulative: 1.0,
    success: true,
    customData: {
      cesgUsedToDate: profile.cesgReceivedToDate,
      clbUsedToDate: profile.clbReceivedToDate,
    },
  };

  return {
    stepFn,
    initialState,
    getDetails: () => details,
    yearsToProject: yearsToEnrollment,
  };
}

export function calculateRequiredContribution(
  profile: RespProfile,
  targetSuccessRate: number,
  medianEquityReturn: number,
  medianBondReturn: number,
  educationCostInflation: number,
  iterations = 15,
  simCount = 200
): number {
  const targetCost = profile.targetEducationCost * 4;
  const yearsToEnrollment = profile.targetAge - profile.childAge;
  const inflatedCost = targetCost * Math.pow(1 + educationCostInflation, yearsToEnrollment);

  if (yearsToEnrollment <= 0) return 0;

  let low = 0;
  let high = inflatedCost / Math.max(1, yearsToEnrollment);

  const equityVol = 0.15;
  const bondVol = 0.04;

  for (let i = 0; i < iterations; i++) {
    const mid = (low + high) / 2;
    const testProfile = { ...profile, annualContribution: mid };

    let successes = 0;
    for (let sim = 0; sim < simCount; sim++) {
      const engine = createRespStepFn(testProfile, false);
      let state = engine.initialState;

      for (let yr = 1; yr <= yearsToEnrollment; yr++) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

        const eqReturn = medianEquityReturn + equityVol * z1;
        const bdReturn = medianBondReturn + bondVol * z2;
        const stochasticReturns = { equity: eqReturn, bond: bdReturn, inflation: educationCostInflation };

        state = {
          ...state,
          year: yr,
          returns: stochasticReturns,
          inflationCumulative: state.inflationCumulative * (1 + educationCostInflation),
        };
        state = engine.stepFn(state, stochasticReturns, sim);
      }

      if (state.balance >= inflatedCost) {
        successes++;
      }
    }

    const successRate = successes / simCount;
    if (successRate >= targetSuccessRate) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Math.ceil((low + high) / 2);
}
