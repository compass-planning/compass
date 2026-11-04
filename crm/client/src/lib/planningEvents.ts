/**
 * planningEvents.ts
 * Event-driven planning infrastructure.
 * Modules emit events; the intelligence layer listens and surfaces insights.
 */

export type PlanningEventType =
  | 'retirement_probability_drop'
  | 'retirement_probability_improve'
  | 'insurance_gap_detected'
  | 'insurance_gap_resolved'
  | 'tax_optimization_opportunity'
  | 'liquidity_risk_detected'
  | 'scenario_changed'
  | 'assumption_updated'
  | 'goal_at_risk';

export interface PlanningEvent {
  type:      PlanningEventType;
  scenarioId: string;
  payload:   Record<string, unknown>;
  timestamp: number;
}

type PlanningEventHandler = (event: PlanningEvent) => void;

const handlers = new Map<PlanningEventType, PlanningEventHandler[]>();
const eventLog: PlanningEvent[] = [];

export function onPlanningEvent(type: PlanningEventType, handler: PlanningEventHandler) {
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type)!.push(handler);
  return () => {
    const list = handlers.get(type) ?? [];
    handlers.set(type, list.filter(h => h !== handler));
  };
}

export function emitPlanningEvent(type: PlanningEventType, scenarioId: string, payload: Record<string, unknown> = {}) {
  const event: PlanningEvent = { type, scenarioId, payload, timestamp: Date.now() };
  eventLog.push(event);
  (handlers.get(type) ?? []).forEach(h => h(event));
}

export function getRecentEvents(limit = 10): PlanningEvent[] {
  return eventLog.slice(-limit).reverse();
}
