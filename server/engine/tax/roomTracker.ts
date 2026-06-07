import type {
  RrspRoomInput, RrspRoomSummary,
  TfsaRoomInput, TfsaRoomSummary,
} from "./types.js";

// ── RRSP annual limits (CRA published) ────────────────────────────────────────
const RRSP_ANNUAL_LIMITS: Record<number, number> = {
  2009: 21_000, 2010: 22_000, 2011: 22_450, 2012: 22_970,
  2013: 23_820, 2014: 24_270, 2015: 24_930, 2016: 25_370,
  2017: 26_010, 2018: 26_230, 2019: 26_500, 2020: 27_230,
  2021: 27_830, 2022: 29_210, 2023: 30_780, 2024: 31_560,
};

const CURRENT_YEAR = new Date().getFullYear();

/** Indexed earnings rate for projecting future RRSP limits (approximate 2% CPI). */
const FUTURE_LIMIT_GROWTH = 0.02;

export function getRrspAnnualLimit(year: number): number {
  if (RRSP_ANNUAL_LIMITS[year]) return RRSP_ANNUAL_LIMITS[year];
  // Project future years from the last known limit
  const lastKnown = Math.max(...Object.keys(RRSP_ANNUAL_LIMITS).map(Number));
  const base = RRSP_ANNUAL_LIMITS[lastKnown];
  const yearsForward = year - lastKnown;
  // CRA rounds to nearest $10
  return Math.round((base * Math.pow(1 + FUTURE_LIMIT_GROWTH, yearsForward)) / 10) * 10;
}

// ── RRSP Room ─────────────────────────────────────────────────────────────────

/**
 * Calculate RRSP contribution room for the current year.
 *
 * New room = min(18% × prior-year earned income, annual limit)
 * Less pension adjustment (PA) from employer DB/DC plan
 * Plus carry-forward room from prior years
 */
export function calculateRrspRoom(input: RrspRoomInput): RrspRoomSummary {
  const year = CURRENT_YEAR;
  const annualLimit = getRrspAnnualLimit(year);

  const newRoomFromIncome = Math.floor(
    Math.min(0.18 * Math.max(0, input.priorYearEarnedIncome), annualLimit)
  );

  const pa = input.pensionAdjustment ?? 0;
  const newRoomThisYear = Math.max(0, newRoomFromIncome - pa);

  const totalAvailable = input.currentCarryForwardRoom + newRoomThisYear;
  const contributions  = Math.min(input.currentYearContributions, totalAvailable);
  const closingRoom    = Math.max(0, totalAvailable - contributions);

  // RRSP must convert to RRIF by Dec 31 of year the annuitant turns 71
  let yearsUntilConversion: number | null = null;
  if (input.currentAge !== undefined && input.retirementYear !== undefined) {
    const conversionAge  = 71;
    const yearsLeft      = conversionAge - (input.currentAge ?? 0);
    yearsUntilConversion = Math.max(0, yearsLeft);
  }

  return {
    newRoomThisYear,
    carryForwardBroughtIn: input.currentCarryForwardRoom,
    totalAvailableRoom:    totalAvailable,
    contributionsMade:     contributions,
    pensionAdjustment:     pa,
    closingRoom,
    yearsUntilConversion,
    annualLimitUsed:       annualLimit,
  };
}

// ── TFSA Annual Limits ────────────────────────────────────────────────────────
const TFSA_ANNUAL_LIMITS: Record<number, number> = {
  2009: 5_000, 2010: 5_000, 2011: 5_000, 2012: 5_000,
  2013: 5_500, 2014: 5_500, 2015: 10_000,
  2016: 5_500, 2017: 5_500, 2018: 5_500,
  2019: 6_000, 2020: 6_000, 2021: 6_000, 2022: 6_000,
  2023: 6_500, 2024: 7_000,
};

export function getTfsaAnnualLimit(year: number): number {
  if (TFSA_ANNUAL_LIMITS[year]) return TFSA_ANNUAL_LIMITS[year];
  // Project future years — CRA indexes to CPI, rounds to nearest $500
  const lastKnown = Math.max(...Object.keys(TFSA_ANNUAL_LIMITS).map(Number));
  const base      = TFSA_ANNUAL_LIMITS[lastKnown];
  const years     = year - lastKnown;
  return Math.round((base * Math.pow(1.02, years)) / 500) * 500;
}

/** Cumulative TFSA room earned since 2009 (or since the year turned 18). */
export function cumulativeTfsaRoom(yearTurned18: number, toYear: number = CURRENT_YEAR): number {
  const firstEligibleYear = Math.max(2009, yearTurned18);
  let total = 0;
  for (let y = firstEligibleYear; y <= toYear; y++) {
    total += getTfsaAnnualLimit(y);
  }
  return total;
}

// ── TFSA Room ─────────────────────────────────────────────────────────────────

/**
 * TFSA room available for contributions.
 *
 * Room = cumulative room since eligibility
 *      – contributions made (net of withdrawals re-added next year)
 * Withdrawals from a prior year are added back at the start of the following year.
 */
export function calculateTfsaRoom(input: TfsaRoomInput): TfsaRoomSummary {
  const year           = CURRENT_YEAR;
  const annualLimit    = getTfsaAnnualLimit(year);
  const totalCumRoom   = cumulativeTfsaRoom(input.yearTurned18, year);

  // Carry-forward already accounts for prior contributions/withdrawals
  const totalAvailable = input.currentCarryForwardRoom + input.currentYearWithdrawals;
  const contributions  = Math.min(input.currentYearContributions, totalAvailable);
  const closingRoom    = Math.max(0, totalAvailable - contributions);

  return {
    cumulativeRoomEarned:    totalCumRoom,
    carryForwardBroughtIn:   input.currentCarryForwardRoom,
    contributionsMade:       contributions,
    withdrawalsLastYear:     input.currentYearWithdrawals,
    totalAvailableRoom:      totalAvailable,
    closingRoom,
    annualLimitThisYear:     annualLimit,
  };
}

// ── Future room projections ───────────────────────────────────────────────────

/** Project RRSP room year-by-year through retirement, respecting age-71 conversion. */
export function projectRrspRoom(
  startRoom:         number,
  annualIncome:      number,
  annualContrib:     number,
  currentAge:        number,
  yearsToProject:    number,
  pensionAdjustment: number = 0,
): number[] {
  const rooms: number[] = [];
  let room        = startRoom;
  const thisYear  = CURRENT_YEAR;

  for (let i = 0; i < yearsToProject; i++) {
    const year          = thisYear + i;
    const age           = currentAge + i;
    const annualLimit   = getRrspAnnualLimit(year);

    if (age >= 71) {
      rooms.push(0); // no more RRSP contributions after conversion
      continue;
    }

    const newRoom = Math.max(0, Math.min(0.18 * annualIncome, annualLimit) - pensionAdjustment);
    room = Math.max(0, room + newRoom - annualContrib);
    rooms.push(Math.round(room));
  }
  return rooms;
}

/** Project TFSA room year-by-year. */
export function projectTfsaRoom(
  startRoom:      number,
  annualContrib:  number,
  currentAge:     number,
  yearsToProject: number,
): number[] {
  const rooms: number[] = [];
  let room = startRoom;
  const thisYear = CURRENT_YEAR;

  for (let i = 0; i < yearsToProject; i++) {
    const year        = thisYear + i;
    const annualLimit = getTfsaAnnualLimit(year);
    room = Math.max(0, room + annualLimit - annualContrib);
    rooms.push(Math.round(room));
  }
  return rooms;
}
