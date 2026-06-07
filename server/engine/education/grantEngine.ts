import type { FamilyIncomeBracket, CesgResult, ClbResult } from "./types";

const CESG_LIFETIME_MAX = 7200;
const CESG_BASIC_RATE = 0.20;
const CESG_BASIC_ELIGIBLE_MAX = 2500;
const CESG_BASIC_MAX_PER_YEAR = 500;

const ACESG_LOW_RATE = 0.20;
const ACESG_MID_RATE = 0.10;
const ACESG_ELIGIBLE_AMOUNT = 500;

const CLB_INITIAL = 500;
const CLB_ANNUAL = 100;
const CLB_LIFETIME_MAX = 2000;
const CLB_MAX_AGE = 15;

export function calculateCesg(
  annualContribution: number,
  familyIncomeBracket: FamilyIncomeBracket,
  cesgReceivedToDate: number
): CesgResult {
  const lifetimeRemaining = Math.max(0, CESG_LIFETIME_MAX - cesgReceivedToDate);
  if (lifetimeRemaining <= 0) {
    return { basicCesg: 0, additionalCesg: 0, totalCesg: 0, lifetimeCesgUsed: cesgReceivedToDate, lifetimeRemaining: 0 };
  }

  const eligibleForBasic = Math.min(annualContribution, CESG_BASIC_ELIGIBLE_MAX);
  const basicCesg = Math.min(eligibleForBasic * CESG_BASIC_RATE, CESG_BASIC_MAX_PER_YEAR);

  let additionalCesg = 0;
  if (familyIncomeBracket === "low") {
    additionalCesg = Math.min(annualContribution, ACESG_ELIGIBLE_AMOUNT) * ACESG_LOW_RATE;
  } else if (familyIncomeBracket === "mid") {
    additionalCesg = Math.min(annualContribution, ACESG_ELIGIBLE_AMOUNT) * ACESG_MID_RATE;
  }

  const totalCesg = Math.min(basicCesg + additionalCesg, lifetimeRemaining);

  return {
    basicCesg: Math.min(basicCesg, totalCesg),
    additionalCesg: Math.min(additionalCesg, Math.max(0, totalCesg - basicCesg)),
    totalCesg,
    lifetimeCesgUsed: cesgReceivedToDate + totalCesg,
    lifetimeRemaining: lifetimeRemaining - totalCesg,
  };
}

export function calculateClb(
  childAge: number,
  clbReceivedToDate: number,
  clbEligible: boolean
): ClbResult {
  if (!clbEligible || childAge > CLB_MAX_AGE) {
    return { amount: 0, lifetimeUsed: clbReceivedToDate, lifetimeRemaining: Math.max(0, CLB_LIFETIME_MAX - clbReceivedToDate), eligible: false };
  }

  const lifetimeRemaining = Math.max(0, CLB_LIFETIME_MAX - clbReceivedToDate);
  if (lifetimeRemaining <= 0) {
    return { amount: 0, lifetimeUsed: clbReceivedToDate, lifetimeRemaining: 0, eligible: true };
  }

  const amount = clbReceivedToDate === 0
    ? Math.min(CLB_INITIAL, lifetimeRemaining)
    : Math.min(CLB_ANNUAL, lifetimeRemaining);

  return {
    amount,
    lifetimeUsed: clbReceivedToDate + amount,
    lifetimeRemaining: lifetimeRemaining - amount,
    eligible: true,
  };
}
