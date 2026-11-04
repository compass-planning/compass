import {
  choleskyDecompose,
  generateCorrelatedReturns,
  createSeededRng,
  DEFAULT_CORRELATIONS,
  type AssetAssumptions,
  type CorrelationMatrix,
  type CorrelatedReturns,
} from "./cholesky";

export interface SimulationAssumptions {
  equity: AssetAssumptions;
  bond: AssetAssumptions;
  inflation: AssetAssumptions;
  correlations?: CorrelationMatrix;
  simulationCount: number;
  yearsToProject: number;
  seed?: number;
}

export interface YearlyState {
  year: number;
  balance: number;
  contributions: number;
  withdrawals: number;
  returns: CorrelatedReturns;
  inflationCumulative: number;
  success: boolean;
  customData?: Record<string, number>;
}

export type YearlyStepFn = (
  state: YearlyState,
  returns: CorrelatedReturns,
  simulationIndex: number
) => YearlyState;

export interface SimulationPath {
  years: YearlyState[];
  finalBalance: number;
  success: boolean;
}

export interface PercentileBands {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
}

export interface SensitivityResult {
  parameter: string;
  baseValue: number;
  shiftedValue: number;
  baseSuccessRate: number;
  shiftedSuccessRate: number;
  impact: number;
}

export interface SimulationResult {
  successRate: number;
  percentileBands: PercentileBands;
  finalBalancePercentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  medianPath: number[];
  sensitivity: SensitivityResult[];
  simulationCount: number;
  yearsProjected: number;
}

export function runSimulation(
  assumptions: SimulationAssumptions,
  initialState: Omit<YearlyState, "year" | "returns" | "inflationCumulative" | "success">,
  stepFn: YearlyStepFn,
  successCriteria?: (path: SimulationPath) => boolean,
  includeSensitivity: boolean = true
): SimulationResult {
  if (assumptions.simulationCount < 1000 || assumptions.simulationCount > 10000) {
    throw new Error(`Simulation count must be between 1,000 and 10,000 (got ${assumptions.simulationCount})`);
  }
  if (assumptions.yearsToProject < 1) {
    throw new Error(`Years to project must be at least 1 (got ${assumptions.yearsToProject})`);
  }

  const correlations = assumptions.correlations ?? DEFAULT_CORRELATIONS;
  const L = choleskyDecompose(correlations);
  const baseSeed = assumptions.seed ?? Date.now();
  const paths: SimulationPath[] = [];

  for (let sim = 0; sim < assumptions.simulationCount; sim++) {
    const rng = createSeededRng(baseSeed + sim);
    let currentState: YearlyState = {
      ...initialState,
      year: 0,
      returns: { equity: 0, bond: 0, inflation: 0 },
      inflationCumulative: 1.0,
      success: true,
    };

    const yearlyStates: YearlyState[] = [{ ...currentState }];

    for (let year = 1; year <= assumptions.yearsToProject; year++) {
      const returns = generateCorrelatedReturns(
        L,
        {
          equity: assumptions.equity,
          bond: assumptions.bond,
          inflation: assumptions.inflation,
        },
        rng
      );

      const nextState: YearlyState = {
        ...currentState,
        year,
        returns,
        inflationCumulative: currentState.inflationCumulative * (1 + returns.inflation),
      };

      const stepped = stepFn(nextState, returns, sim);
      currentState = stepped;
      yearlyStates.push({ ...currentState });
    }

    const path: SimulationPath = {
      years: yearlyStates,
      finalBalance: currentState.balance,
      success: currentState.success,
    };

    if (successCriteria) {
      path.success = successCriteria(path);
    }

    paths.push(path);
  }

  const successCount = paths.filter((p) => p.success).length;
  const successRate = successCount / paths.length;

  const percentileBands = computePercentileBands(paths, assumptions.yearsToProject);
  const finalBalances = paths.map((p) => p.finalBalance).sort((a, b) => a - b);

  const finalBalancePercentiles = {
    p10: percentileValue(finalBalances, 0.1),
    p25: percentileValue(finalBalances, 0.25),
    p50: percentileValue(finalBalances, 0.5),
    p75: percentileValue(finalBalances, 0.75),
    p90: percentileValue(finalBalances, 0.9),
  };

  const medianPath = percentileBands.p50;

  const sensitivity = includeSensitivity
    ? runSensitivityAnalysis(assumptions, initialState, stepFn, successCriteria, successRate)
    : [];

  return {
    successRate,
    percentileBands,
    finalBalancePercentiles,
    medianPath,
    sensitivity,
    simulationCount: assumptions.simulationCount,
    yearsProjected: assumptions.yearsToProject,
  };
}

function computePercentileBands(
  paths: SimulationPath[],
  years: number
): PercentileBands {
  const bands: PercentileBands = {
    p10: [],
    p25: [],
    p50: [],
    p75: [],
    p90: [],
  };

  for (let y = 0; y <= years; y++) {
    const balances = paths
      .map((p) => (p.years[y] ? p.years[y].balance : 0))
      .sort((a, b) => a - b);

    bands.p10.push(percentileValue(balances, 0.1));
    bands.p25.push(percentileValue(balances, 0.25));
    bands.p50.push(percentileValue(balances, 0.5));
    bands.p75.push(percentileValue(balances, 0.75));
    bands.p90.push(percentileValue(balances, 0.9));
  }

  return bands;
}

function percentileValue(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = percentile * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function runSensitivityAnalysis(
  baseAssumptions: SimulationAssumptions,
  initialState: Omit<YearlyState, "year" | "returns" | "inflationCumulative" | "success">,
  stepFn: YearlyStepFn,
  successCriteria: ((path: SimulationPath) => boolean) | undefined,
  baseSuccessRate: number
): SensitivityResult[] {
  const results: SensitivityResult[] = [];
  const quickSimCount = Math.max(1000, Math.min(baseAssumptions.simulationCount, 2000));

  const shifts: Array<{
    parameter: string;
    modify: (a: SimulationAssumptions) => SimulationAssumptions;
    baseValue: number;
    shiftedValue: number;
  }> = [
    {
      parameter: "Equity Return (+1%)",
      baseValue: baseAssumptions.equity.mean,
      shiftedValue: baseAssumptions.equity.mean + 0.01,
      modify: (a) => ({ ...a, equity: { ...a.equity, mean: a.equity.mean + 0.01 } }),
    },
    {
      parameter: "Equity Return (-1%)",
      baseValue: baseAssumptions.equity.mean,
      shiftedValue: baseAssumptions.equity.mean - 0.01,
      modify: (a) => ({ ...a, equity: { ...a.equity, mean: a.equity.mean - 0.01 } }),
    },
    {
      parameter: "Equity Volatility (+3%)",
      baseValue: baseAssumptions.equity.volatility,
      shiftedValue: baseAssumptions.equity.volatility + 0.03,
      modify: (a) => ({ ...a, equity: { ...a.equity, volatility: a.equity.volatility + 0.03 } }),
    },
    {
      parameter: "Inflation (+0.5%)",
      baseValue: baseAssumptions.inflation.mean,
      shiftedValue: baseAssumptions.inflation.mean + 0.005,
      modify: (a) => ({ ...a, inflation: { ...a.inflation, mean: a.inflation.mean + 0.005 } }),
    },
  ];

  for (const shift of shifts) {
    const shiftedAssumptions = shift.modify({
      ...baseAssumptions,
      simulationCount: quickSimCount,
    });
    const shiftedResult = runSimulation(
      { ...shiftedAssumptions, simulationCount: quickSimCount },
      initialState,
      stepFn,
      successCriteria,
      false
    );

    results.push({
      parameter: shift.parameter,
      baseValue: shift.baseValue,
      shiftedValue: shift.shiftedValue,
      baseSuccessRate,
      shiftedSuccessRate: shiftedResult.successRate,
      impact: shiftedResult.successRate - baseSuccessRate,
    });
  }

  return results;
}

export const MODERATE_ASSUMPTIONS: Omit<SimulationAssumptions, "simulationCount" | "yearsToProject"> = {
  equity: { mean: 0.07, volatility: 0.15 },
  bond: { mean: 0.035, volatility: 0.05 },
  inflation: { mean: 0.02, volatility: 0.01 },
};

export const CONSERVATIVE_ASSUMPTIONS: Omit<SimulationAssumptions, "simulationCount" | "yearsToProject"> = {
  equity: { mean: 0.055, volatility: 0.12 },
  bond: { mean: 0.03, volatility: 0.04 },
  inflation: { mean: 0.02, volatility: 0.01 },
};

export const AGGRESSIVE_ASSUMPTIONS: Omit<SimulationAssumptions, "simulationCount" | "yearsToProject"> = {
  equity: { mean: 0.085, volatility: 0.18 },
  bond: { mean: 0.04, volatility: 0.06 },
  inflation: { mean: 0.02, volatility: 0.01 },
};
