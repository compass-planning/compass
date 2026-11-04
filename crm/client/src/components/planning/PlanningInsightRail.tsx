/**
 * PlanningInsightRail.tsx
 * Right rail for the planning workspace.
 * Pulls real AI recommendations + stale flags from the DB.
 * Falls back to computed insights from planning data.
 */
import { useQuery } from '@tanstack/react-query';
import { usePlanningScenarioStore } from '@/store/planningScenarioStore';
import { Sparkles, AlertTriangle, TrendingUp, Shield, Receipt, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from "@/contexts/LanguageContext";

type InsightType = 'risk' | 'opportunity' | 'insurance' | 'tax' | 'action';

interface AiRec { status: string; category?: string; priority?: string; title: string; body?: string; content?: string; description?: string; }
interface RetPlan { successRate?: number | string; cppStartAge?: number | string; }
interface Policy { type?: string; }
interface StaleFlag { resolvedAt?: string | null; module: string; }

interface Insight {
  type: InsightType;
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
}

const ICON: Record<InsightType, typeof Sparkles> = {
  risk:        AlertTriangle,
  opportunity: TrendingUp,
  insurance:   Shield,
  tax:         Receipt,
  action:      CheckCircle,
};

const TONE: Record<InsightType, string> = {
  risk:        'text-red-400',
  opportunity: 'text-emerald-400',
  insurance:   'text-amber-400',
  tax:         'text-violet-400',
  action:      'text-violet-400',
};

interface Props { clientId: number; planId: number | null; }

export function PlanningInsightRail({ clientId, planId }: Props) {
  const { isFrench: isFr } = useLanguage();
  const { activeScenarioId, scenarios } = usePlanningScenarioStore();
  const activeScenario = scenarios.find(s => s.id === activeScenarioId);

  const { data: aiRecs = [], isLoading: recsLoading } = useQuery<AiRec[]>({
    queryKey: ['/api/crm/clients/:id/ai-recommendations', clientId],
    queryFn:  () => fetch(`/api/crm/clients/${clientId}/ai-recommendations`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
  });

  const { data: staleFlags = [] } = useQuery<StaleFlag[]>({
    queryKey: ['/api/crm/plans/:id/stale-flags', planId],
    queryFn:  () => planId ? fetch(`/api/crm/plans/${planId}/stale-flags`, { credentials: 'include' }).then(r => r.ok ? r.json() : []) : Promise.resolve([]),
    enabled: !!planId,
  });

  const { data: retPlans = [] } = useQuery<RetPlan[]>({
    queryKey: ['/api/crm/clients/:id/retirement-projections', clientId],
    queryFn:  () => fetch(`/api/crm/clients/${clientId}/retirement-projections`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
  });

  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ['/api/crm/clients/:id/policies', clientId],
    queryFn:  () => fetch(`/api/crm/clients/${clientId}/policies`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
  });

  // Build computed insights from real data
  const computed: Insight[] = [];
  const primary = retPlans[0] as RetPlan | undefined;

  if (primary) {
    const sr = Number(primary.successRate ?? 0);
    if (sr > 0 && sr < 70) {
      computed.push({
        type: 'risk',
        title: isFr ? 'Risque de retraite élevé' : 'Retirement Risk Elevated',
        body: isFr
          ? `Taux de succès à ${Math.round(sr)} % — en dessous de la cible de 80 %. Révisez le taux de cotisation ou l'âge de retraite.`
          : `Success rate at ${Math.round(sr)}% — below 80% target. Review contribution rate or retirement age.`,
        priority: 'high',
      });
    } else if (sr >= 80) {
      computed.push({
        type: 'opportunity',
        title: isFr ? 'Perspectives de retraite solides' : 'Strong Retirement Outlook',
        body: isFr
          ? `Taux de succès de ${Math.round(sr)} %. Envisagez de reporter le RPC jusqu'à 70 ans pour un revenu viager supplémentaire.`
          : `${Math.round(sr)}% success rate. Consider CPP deferral to age 70 for additional lifetime income benefit.`,
        priority: 'medium',
      });
    }
    const cppAge = Number(primary.cppStartAge ?? 65);
    if (cppAge < 70) {
      computed.push({
        type: 'opportunity',
        title: isFr ? 'Opportunité de report du RPC' : 'CPP Deferral Opportunity',
        body: isFr
          ? `Reporter le RPC de ${cppAge} à 70 ans augmente le prestation viagère d'environ 42 %. Modélisez cela dans le scénario optimisé.`
          : `Delaying CPP from ${cppAge} to 70 increases lifetime benefit by ~42%. Model this in the optimized scenario.`,
        priority: 'medium',
      });
    }
  }

  const lifeIns = policies.filter((p: Policy) => ['Term Life','Whole Life','Universal Life'].some(t => (p.type ?? '').includes(t)));
  if (lifeIns.length === 0 && policies.length > 0) {
    computed.push({
      type: 'insurance',
      title: isFr ? 'Lacune d\'assurance vie' : 'Life Insurance Gap',
      body: isFr
        ? 'Aucune assurance vie au dossier. Effectuez une analyse des besoins familiaux pour quantifier l\'écart de couverture.'
        : 'No life insurance on file. Run a Family Needs Analysis to quantify the coverage gap.',
      priority: 'high',
    });
  }

  const unresolved = staleFlags.filter((f: StaleFlag) => !f.resolvedAt);
  if (unresolved.length > 0) {
    computed.push({
      type: 'action',
      title: isFr
        ? `${unresolved.length} module${unresolved.length > 1 ? 's' : ''} obsolète${unresolved.length > 1 ? 's' : ''}`
        : `${unresolved.length} Module${unresolved.length > 1 ? 's' : ''} Stale`,
      body: isFr
        ? `${unresolved.map((f: StaleFlag) => f.module).join(', ')} nécessitent un recalcul.`
        : `${unresolved.map((f: StaleFlag) => f.module).join(', ')} require recalculation.`,
      priority: 'medium',
    });
  }

  if (activeScenario?.id === 'downside') {
    computed.push({
      type: 'risk',
      title: isFr ? 'Scénario défavorable actif' : 'Downside Scenario Active',
      body: isFr
        ? 'Test de résistance à 4,5 % de rendement / 3 % d\'inflation. Révisez la liquidité disponible et la suffisance de la couverture invalidité.'
        : 'Stress-testing at 4.5% return / 3% inflation. Review liquidity runway and disability coverage sufficiency.',
      priority: 'high',
    });
  }

  // Merge: real AI recs first, then computed insights
  const pendingRecs = aiRecs.filter((r: AiRec) => r.status === 'pending').slice(0, 3);
  const allInsights: Insight[] = [
    ...pendingRecs.map((r: AiRec): Insight => ({
      type: (r.category === 'insurance' ? 'insurance' : r.category === 'tax' ? 'tax' : r.priority === 'high' ? 'risk' : 'opportunity') as InsightType,
      title: r.title,
      body: r.content ?? r.description ?? '',
      priority: (r.priority ?? 'medium') as 'high' | 'medium' | 'low',
    })),
    ...computed,
  ].slice(0, 6);

  const STATIC_FALLBACK: Insight[] = [
    {
      type: 'opportunity',
      title: isFr ? 'Fenêtre de cotisation REER' : 'RRSP Contribution Window',
      body: isFr
        ? 'Examinez les droits de cotisation avant le 1er mars. Les clients ayant un revenu gagné peuvent avoir des droits reportés disponibles.'
        : 'Review contribution room before March 1st. Clients with earned income may have carry-forward available.',
      priority: 'medium',
    },
    {
      type: 'tax',
      title: isFr ? 'Révision du fractionnement' : 'Income Splitting Review',
      body: isFr
        ? 'Le fractionnement du revenu de pension (T1032) peut réduire le fardeau fiscal combiné du ménage.'
        : 'Pension income splitting (T1032) may reduce combined household tax burden.',
      priority: 'medium',
    },
    {
      type: 'insurance',
      title: isFr ? 'Révision annuelle de la couverture' : 'Annual Coverage Review',
      body: isFr
        ? 'Confirmez que les niveaux de couverture correspondent au revenu du ménage et à la structure des passifs actuels.'
        : 'Confirm coverage levels align with current household income and liability structure.',
      priority: 'low',
    },
  ];

  const insights = allInsights.length > 0 ? allInsights : STATIC_FALLBACK;

  const typeDisplay: Record<InsightType, string> = isFr ? {
    risk: 'risque',
    opportunity: 'opportunité',
    insurance: 'assurance',
    tax: 'impôt',
    action: 'action',
  } : {
    risk: 'risk',
    opportunity: 'opportunity',
    insurance: 'insurance',
    tax: 'tax',
    action: 'action',
  };

  const priorityDisplay = (p: string) => {
    if (!isFr) return p;
    if (p === 'high') return 'élevé';
    if (p === 'medium') return 'moyen';
    if (p === 'low') return 'faible';
    return p;
  };

  return (
    <aside className="space-y-3 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">{isFr ? "Intelligence de planification" : "Planning Intelligence"}</p>
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
      </div>

      {recsLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
        </div>
      )}

      {insights.map((insight, i) => {
        const Icon = ICON[insight.type];
        return (
          <div key={i} className="rounded-xl border border-white/10 bg-[#111827] p-3.5 hover:bg-white/[0.04] transition-colors group">
            <div className="flex items-start gap-2.5">
              <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', TONE[insight.type])} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-[10px] uppercase tracking-[0.12em] font-semibold', TONE[insight.type])}>{typeDisplay[insight.type]}</p>
                  <span className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0',
                    insight.priority === 'high' ? 'bg-red-500/15 text-red-400' :
                    insight.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-slate-500/15 text-slate-400'
                  )}>{priorityDisplay(insight.priority)}</span>
                </div>
                <h3 className="text-[12px] font-semibold text-white mt-1 leading-snug">{insight.title}</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{insight.body}</p>
              </div>
            </div>
          </div>
        );
      })}

      {pendingRecs.length === 0 && (
        <button
          onClick={() => fetch(`/api/crm/clients/${clientId}/ai-recommendations/generate`, { method: 'POST', credentials: 'include' })}
          className="w-full rounded-xl border border-dashed border-white/10 p-3 text-[11px] text-slate-500 hover:text-slate-300 hover:border-white/20 transition-colors flex items-center justify-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isFr ? "Générer des analyses IA" : "Generate AI Insights"}
        </button>
      )}
    </aside>
  );
}
