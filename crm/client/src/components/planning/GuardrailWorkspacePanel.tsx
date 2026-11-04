/**
 * GuardrailWorkspacePanel.tsx
 * Retirement Resilience System.
 * Shows Monte Carlo guardrail data + resilience controls.
 * Reframes "guardrails" as resilience policy.
 */
import { useQuery } from '@tanstack/react-query';
import { usePlanningScenarioStore } from '@/store/planningScenarioStore';
import { Activity, Shield, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { clientId: number; planId: number | null; }

export function GuardrailWorkspacePanel({ clientId, planId }: Props) {
  const { _activeScenarioId } = usePlanningScenarioStore();

  const { data: simResults = [], isLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ['/api/crm/plans/:id/simulation-results', planId],
    queryFn: () => planId
      ? fetch(`/api/crm/plans/${planId}/simulation-results`, { credentials: 'include' }).then(r => r.ok ? r.json() : [])
      : Promise.resolve([]),
    enabled: !!planId,
  });

  const { data: projections = [] } = useQuery<Record<string, unknown>[]>({
    queryKey: ['/api/crm/clients/:id/retirement-projections', clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/retirement-projections`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
  });

  const retResult = simResults.find((r: Record<string, unknown>) => r.module === 'retirement' && r.scenario === 'base');
  const primary   = (projections as Record<string, unknown>[])[0];

  const p10 = retResult?.p10 ? Number(retResult.p10) : null;
  const p50 = retResult?.p50 ? Number(retResult.p50) : null;
  const p90 = retResult?.p90 ? Number(retResult.p90) : null;
  const successRate = retResult?.successRate ? Math.round(Number(retResult.successRate) * 100) : (primary?.successRate ? Math.round(Number(primary.successRate)) : null);

  const fmtK = (n: number) => Math.abs(n) >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${Math.round(n/1000)}K`;

  // Resilience assessment
  const resilience = successRate == null ? null :
    successRate >= 85 ? { label: 'High Resilience', tone: 'ok', desc: 'Plan survives most market conditions' } :
    successRate >= 70 ? { label: 'Moderate Resilience', tone: 'warn', desc: 'Vulnerable to sequence risk' } :
    { label: 'Low Resilience', tone: 'risk', desc: 'Review spending strategy urgently' };

  return (
    <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Retirement</p>
          <h2 className="mt-0.5 text-sm font-semibold text-white">Resilience System</h2>
        </div>
        <Shield className="w-4 h-4 text-violet-400" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      ) : !p50 && !primary ? (
        <div className="text-center py-4">
          <p className="text-[12px] text-slate-500">No simulation data</p>
          <p className="text-[11px] text-slate-600 mt-1">Run a simulation to see resilience metrics</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Resilience status */}
          {resilience && (
            <div className={cn(
              'rounded-lg border px-3 py-2.5',
              resilience.tone === 'ok' ? 'border-emerald-500/20 bg-emerald-500/5' :
              resilience.tone === 'warn' ? 'border-amber-500/20 bg-amber-500/5' :
              'border-red-500/20 bg-red-500/5'
            )}>
              <div className="flex items-center gap-2">
                <Activity className={cn('w-3.5 h-3.5', resilience.tone === 'ok' ? 'text-emerald-400' : resilience.tone === 'warn' ? 'text-amber-400' : 'text-red-400')} />
                <p className={cn('text-[11px] font-semibold', resilience.tone === 'ok' ? 'text-emerald-400' : resilience.tone === 'warn' ? 'text-amber-400' : 'text-red-400')}>
                  {resilience.label}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{resilience.desc}</p>
            </div>
          )}

          {/* Percentile bands */}
          {(p10 || p50 || p90) && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Bear (P10)', val: p10, color: 'text-red-400' },
                { label: 'Median (P50)', val: p50, color: 'text-white' },
                { label: 'Bull (P90)', val: p90, color: 'text-emerald-400' },
              ].map(c => (
                <div key={c.label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 text-center">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wide">{c.label}</p>
                  <p className={cn('text-[11px] font-bold mt-0.5', c.color)}>{c.val ? fmtK(c.val) : '—'}</p>
                </div>
              ))}
            </div>
          )}

          {/* Guardrail policies */}
          <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Resilience Policies</p>
            {[
              { label: 'Spending Floor', value: primary?.desiredRetirementIncome ? `$${Math.round(Number(primary.desiredRetirementIncome) * 0.85 / 1000)}K/yr` : '85% of goal' },
              { label: 'Ceiling',        value: primary?.desiredRetirementIncome ? `$${Math.round(Number(primary.desiredRetirementIncome) * 1.10 / 1000)}K/yr` : '110% of goal' },
              { label: 'Rebalance',      value: 'Annual' },
            ].map(p => (
              <div key={p.label} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
                <span className="text-[11px] text-slate-400">{p.label}</span>
                <span className="text-[11px] font-semibold text-white">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
