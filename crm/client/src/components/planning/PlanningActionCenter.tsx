/**
 * PlanningActionCenter.tsx
 * Pulls real action items from plan_action_items table.
 * Also surfaces computed actions from planning data.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { clientId: number; planId: number | null; }

const priorityColor: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-amber-400',
  medium:   'text-violet-400',
  low:      'text-slate-400',
};

export function PlanningActionCenter({ planId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);

  const { data: actionItems = [] } = useQuery<Record<string, unknown>[]>({
    queryKey: ['/api/crm/plans/:id/action-items', planId],
    queryFn:  () => planId ? fetch(`/api/crm/plans/${planId}/action-items`, { credentials: 'include' }).then(r => r.ok ? r.json() : []) : Promise.resolve([]),
    enabled: !!planId,
  });

  const updateItem = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/crm/action-items/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/crm/plans/:id/action-items', planId] }),
  });

  const pending   = actionItems.filter(a => (a as Record<string,unknown>).status !== 'completed' && (a as Record<string,unknown>).status !== 'dismissed');
  const completed = actionItems.filter(a => (a as Record<string,unknown>).status === 'completed');

  return (
    <div className="rounded-xl border border-white/10 bg-[#111827] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white">Planning Action Center</h2>
          {pending.length > 0 && (
            <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <div className="border-t border-white/10 p-3 space-y-2">
          {pending.length === 0 && completed.length === 0 && (
            <div className="text-center py-4">
              <p className="text-[12px] text-slate-500">No action items yet</p>
              <p className="text-[11px] text-slate-600 mt-1">Generate AI insights to populate action items</p>
            </div>
          )}

          {pending.map((item: Record<string, unknown>) => (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 hover:bg-white/[0.04] transition-colors group">
              <button
                onClick={() => updateItem.mutate({ id: item.id, status: 'completed' })}
                className="mt-0.5 flex-shrink-0 text-slate-500 hover:text-emerald-400 transition-colors"
              >
                <Circle className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-semibold text-white truncate">{item.title}</p>
                  <span className={cn('text-[10px] font-semibold flex-shrink-0', priorityColor[item.priority ?? 'medium'])}>
                    {item.priority}
                  </span>
                </div>
                {item.description && (
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                )}
                <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wide">{item.module}</p>
              </div>
            </div>
          ))}

          {completed.length > 0 && (
            <div className="pt-1 border-t border-white/[0.04]">
              <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-2">{completed.length} completed</p>
              {completed.slice(0, 3).map((item: Record<string, unknown>) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2 opacity-40">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <p className="text-[12px] text-slate-400 line-through truncate">{item.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
