/**
 * RetirementWorkspacePanel.tsx
 * Inline retirement planning controls — editable, live-feeling.
 * Reads from and writes to the global scenario store.
 * Also shows real retirement projection data.
 */
import { useQuery } from '@tanstack/react-query';
import { usePlanningScenarioStore } from '@/store/planningScenarioStore';
import { emitPlanningEvent } from '@/lib/planningEvents';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { clientId: number; planId: number | null; }

function InlineControl({ label, value, onChange, prefix, suffix, step = 1, min, max, v }: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.05] transition-colors group">
      <span className="text-[12px] text-slate-400">{label}</span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-[11px] text-slate-500">{prefix}</span>}
        <input
          type="number" value={value} step={step} min={min} max={max}
          onChange={e => onChange(Number(e.target.value))}
          className="w-24 bg-transparent text-right text-[12px] font-semibold text-slate-900 outline-none border-b border-transparent focus:border-violet-500/50 transition-colors"
        />
        {suffix && <span className="text-[11px] text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

export function RetirementWorkspacePanel({ clientId }: Props) {
  const { scenarios, activeScenarioId, updateScenarioAssumption, _updateScenarioOutputs } = usePlanningScenarioStore();
  const scenario = scenarios.find(s => s.id === activeScenarioId);

  const { data: projections = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/crm/clients/:id/retirement-projections', clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/retirement-projections`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
  });

  const primary = (projections as any[])[0];
  const successRate = primary?.successRate ? Math.round(Number(primary.successRate)) : null;
  const balance    = primary?.projectedBalance ? Number(primary.projectedBalance) : null;
  const shortfall  = primary?.shortfallSurplus ? Number(primary.shortfallSurplus) : null;

  const fmtK = (n: number) => Math.abs(n) >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${Math.round(n/1000)}K`;

  const successTone = successRate == null ? 'neutral' : successRate >= 80 ? 'ok' : successRate >= 60 ? 'warn' : 'risk';

  function handleChange(key: keyof NonNullable<typeof scenario>['assumptions'], value: number) {
    updateScenarioAssumption(activeScenarioId, key, value);
    emitPlanningEvent('assumption_updated', activeScenarioId, { key, value });
  }

  if (!scenario) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Retirement Strategy</p>
          <h2 className="mt-0.5 text-sm font-semibold text-white">Planning Controls</h2>
        </div>
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
        ) : successRate !== null ? (
          <div className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            successTone === 'ok' ? 'bg-emerald-500/10 text-emerald-400' :
            successTone === 'warn' ? 'bg-amber-500/10 text-amber-400' :
            'bg-red-500/10 text-red-400'
          )}>
            {successRate}% Probability
          </div>
        ) : (
          <div className="rounded-full bg-slate-500/10 px-3 py-1 text-xs text-slate-400">No data</div>
        )}
      </div>

      {/* Real data summary */}
      {primary && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
            <p className="text-[10px] text-slate-500">Projected Balance</p>
            <p className={cn('text-sm font-bold mt-0.5', shortfall && shortfall < 0 ? 'text-red-400' : 'text-emerald-400')}>
              {balance ? fmtK(balance) : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
            <p className="text-[10px] text-slate-500">Shortfall / Surplus</p>
            <p className={cn('text-sm font-bold mt-0.5', shortfall == null ? 'text-slate-400' : shortfall >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {shortfall != null ? `${shortfall >= 0 ? '+' : ''}${fmtK(shortfall)}` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Inline controls */}
      <div className="space-y-2">
        <InlineControl
          label="Retirement Age"
          value={scenario.assumptions.retirementAge ?? (primary?.retirementAge ?? 65)}
          onChange={v => handleChange('retirementAge', v)}
          min={50} max={75}
        />
        <InlineControl
          label="Expected Return"
          value={scenario.assumptions.expectedReturn ?? 6.5}
          onChange={v => handleChange('expectedReturn', v)}
          suffix="%" step={0.1} min={2} max={12}
        />
        <InlineControl
          label="Inflation Rate"
          value={scenario.assumptions.inflation ?? 2.0}
          onChange={v => handleChange('inflation', v)}
          suffix="%" step={0.1} min={0} max={8}
        />
        <InlineControl
          label="Income Goal"
          value={scenario.assumptions.incomeGoal ?? (primary?.desiredRetirementIncome ? Number(primary.desiredRetirementIncome) : 80000)}
          onChange={v => handleChange('incomeGoal', v)}
          prefix="$" step={5000} min={20000}
        />
      </div>

      {!primary && !isLoading && (
        <p className="text-[11px] text-slate-500 text-center mt-3">Add a retirement projection to see live data</p>
      )}
    </div>
  );
}
