/**
 * planningScenarioStore.ts
 * Global planning state — all modules subscribe to this.
 * Scenarios contain assumptions + computed outputs.
 * When outputs are updated, all subscribed components re-render.
 */
import { create } from 'zustand';

export type PlanningScenario = {
  id: string;
  name: string;
  assumptions: {
    retirementAge?:     number;
    expectedReturn?:    number;
    inflation?:         number;
    incomeGoal?:        number;
    contributionRate?:  number;
    taxProvince?:       string;
    lifeExpectancy?:    number;
  };
  outputs?: {
    successRate?:       number;
    projectedNetWorth?: number;
    taxBurden?:         number;
    insuranceGap?:      number;
    monthlyShortfall?:  number;
  };
};

interface PlanningScenarioState {
  activeScenarioId: string;
  scenarios: PlanningScenario[];
  setActiveScenario: (id: string) => void;
  addScenario: (name: string) => void;
  updateScenarioAssumption: (scenarioId: string, key: keyof PlanningScenario['assumptions'], value: number | string) => void;
  updateScenarioOutputs: (scenarioId: string, outputs: Partial<NonNullable<PlanningScenario['outputs']>>) => void;
  getActive: () => PlanningScenario | undefined;
}

const DEFAULT_SCENARIOS: PlanningScenario[] = [
  {
    id: 'base',
    name: 'Current',
    assumptions: { retirementAge: 65, expectedReturn: 6.5, inflation: 2.0, incomeGoal: 80000, lifeExpectancy: 90 },
  },
  {
    id: 'optimized',
    name: 'Optimized',
    assumptions: { retirementAge: 67, expectedReturn: 7.0, inflation: 2.0, incomeGoal: 90000, lifeExpectancy: 90 },
  },
  {
    id: 'downside',
    name: 'Downside',
    assumptions: { retirementAge: 63, expectedReturn: 4.5, inflation: 3.0, incomeGoal: 70000, lifeExpectancy: 90 },
  },
  {
    id: 'tax',
    name: 'Tax Efficient',
    assumptions: { retirementAge: 65, expectedReturn: 6.5, inflation: 2.0, incomeGoal: 80000, lifeExpectancy: 90 },
  },
];

export const usePlanningScenarioStore = create<PlanningScenarioState>((set, get) => ({
  activeScenarioId: 'base',
  scenarios: DEFAULT_SCENARIOS,

  setActiveScenario: (id) => set({ activeScenarioId: id }),

  addScenario: (name) => set(state => ({
    scenarios: [...state.scenarios, {
      id: `custom-${Date.now()}`,
      name,
      assumptions: { ...state.scenarios[0].assumptions },
    }],
  })),

  updateScenarioAssumption: (scenarioId, key, value) =>
    set(state => ({
      scenarios: state.scenarios.map(s =>
        s.id === scenarioId ? { ...s, assumptions: { ...s.assumptions, [key]: value } } : s
      ),
    })),

  updateScenarioOutputs: (scenarioId, outputs) =>
    set(state => ({
      scenarios: state.scenarios.map(s =>
        s.id === scenarioId ? { ...s, outputs: { ...s.outputs, ...outputs } } : s
      ),
    })),

  getActive: () => {
    const { scenarios, activeScenarioId } = get();
    return scenarios.find(s => s.id === activeScenarioId);
  },
}));
