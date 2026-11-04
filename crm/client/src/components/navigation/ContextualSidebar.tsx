/**
 * ContextualSidebar.tsx — Light institutional theme
 */
import { useNavigationStore, type HouseholdSection } from '@/store/navigationStore';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  ArrowLeft, LayoutGrid, PiggyBank, DollarSign,
  Shield, Receipt, ScrollText, FileText,
  Calendar, Activity,
} from 'lucide-react';

interface Overview { netWorth?: number; }
interface RetirementPlan { successRate?: number | string; }
import { cn } from '@/lib/utils';

const PRIMARY_NAV: { key: HouseholdSection; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview',   label: 'Overview',     icon: LayoutGrid },
  { key: 'retirement', label: 'Retirement',   icon: PiggyBank },
  { key: 'networth',   label: 'Net Worth',    icon: DollarSign },
  { key: 'insurance',  label: 'Insurance',    icon: Shield },
  { key: 'tax',        label: 'Tax Strategy', icon: Receipt },
  { key: 'estate',     label: 'Estate',       icon: ScrollText },
];

const SECONDARY_NAV: { key: HouseholdSection; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'documents',  label: 'Documents',    icon: FileText },
  { key: 'meetings',   label: 'Meetings',     icon: Calendar },
  { key: 'activity',   label: 'Activity',     icon: Activity },
];

function NavBtn({ item, isActive, collapsed, key, label, icon }: {
  item: { key: HouseholdSection; label: string; icon: typeof LayoutGrid };
  isActive: boolean; collapsed: boolean;
}) {
  const { setSection } = useNavigationStore();
  const Icon = item.icon;
  return (
    <button
      onClick={() => setSection(item.key)}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center rounded-xl w-full transition-all duration-150 text-left',
        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
        isActive
          ? 'bg-slate-100 text-slate-900 font-medium'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      )}
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-violet-600' : 'text-slate-400')} />
      {!collapsed && <span className="text-sm truncate">{item.label}</span>}
      {isActive && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-600 flex-shrink-0" />}
    </button>
  );
}

export function ContextualSidebar({ collapsed }: { collapsed: boolean }) {
  const { activeHousehold, activeSection, exitHousehold } = useNavigationStore();

  const { data: overview } = useQuery<Overview>({
    queryKey: ['/api/crm/clients/:id/overview', activeHousehold?.id],
    queryFn: () => fetch(`/api/crm/clients/${activeHousehold?.id}/overview`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    enabled: !!activeHousehold?.id,
  });

  const { data: retPlans = [] } = useQuery<RetirementPlan[]>({
    queryKey: ['/api/crm/clients/:id/retirement-projections', activeHousehold?.id],
    queryFn: () => fetch(`/api/crm/clients/${activeHousehold?.id}/retirement-projections`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    enabled: !!activeHousehold?.id,
  });

  const nw = overview ? Number(overview.netWorth ?? 0) : null;
  const nwFmt = nw === null ? null : Math.abs(nw) >= 1_000_000 ? `$${(nw/1_000_000).toFixed(1)}M` : `$${Math.round(nw/1000)}K`;
  const successRate = retPlans[0]?.successRate ? Math.round(Number(retPlans[0].successRate)) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back + household header */}
      <div className={cn('border-b border-slate-100', collapsed ? 'p-2' : 'p-4')}>
        <Link href="/clients">
          <div onClick={exitHousehold} className={cn(
            'flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer rounded-lg hover:bg-slate-50 px-2 py-1.5',
            collapsed && 'justify-center'
          )}>
            <ArrowLeft className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Advisor OS</span>}
          </div>
        </Link>

        {!collapsed && activeHousehold && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold">Household</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-900 leading-snug tracking-[-0.01em]">
              {activeHousehold.name}
            </h2>
            {activeHousehold.province && (
              <p className="text-[11px] text-slate-400 mt-0.5">{activeHousehold.province}</p>
            )}
          </div>
        )}

        {/* Status block */}
        {!collapsed && (nwFmt || successRate !== null) && (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {nwFmt && (
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200/60 px-2.5 py-2">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Net Worth</p>
                <p className={cn('text-xs font-semibold mt-0.5', nw && nw >= 0 ? 'text-emerald-600' : 'text-red-600')}>{nwFmt}</p>
              </div>
            )}
            {successRate !== null && (
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200/60 px-2.5 py-2">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Retirement</p>
                <p className={cn('text-xs font-semibold mt-0.5',
                  successRate >= 80 ? 'text-emerald-600' : successRate >= 60 ? 'text-amber-600' : 'text-red-600'
                )}>{successRate}%</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 overflow-y-auto', collapsed ? 'px-1.5 py-3' : 'px-2 py-3')}>
        <div className="space-y-0.5">
          {PRIMARY_NAV.map(item => (
            <NavBtn key={item.key} item={item} isActive={activeSection === item.key} collapsed={collapsed} />
          ))}
        </div>

        {!collapsed && <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400 font-semibold px-3 mt-4 mb-2">Records</p>}
        {collapsed && <div className="my-2 border-t border-slate-100" />}

        <div className="space-y-0.5">
          {SECONDARY_NAV.map(item => (
            <NavBtn key={item.key} item={item} isActive={activeSection === item.key} collapsed={collapsed} />
          ))}
        </div>
      </nav>
    </div>
  );
}
