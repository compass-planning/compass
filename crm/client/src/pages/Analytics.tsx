import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { PieChart, TrendingUp, DollarSign, BarChart3 } from "lucide-react";

export default function Analytics() {
  const { isFrench: isFr } = useLanguage();

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-foreground" data-testid="text-page-title">
            {isFr ? "Analytique" : "Analytics"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{isFr ? "Aperçus approfondis de la performance de votre cabinet." : "Deep insights into your business performance."}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { labelKey: "analytics.totalAUM",      icon: DollarSign, color: "text-green-600 bg-green-50" },
            { labelKey: "analytics.conversion",    icon: TrendingUp, color: "text-violet-600 bg-violet-50" },
            { labelKey: "analytics.activePolicies",icon: BarChart3,  color: "text-purple-600 bg-purple-50" },
            { labelKey: "analytics.avgMeetings",   icon: PieChart,   color: "text-amber-600 bg-amber-50" },
          ].map((stat) => (
            <div key={stat.labelKey} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-500">{isFr ? ({"analytics.totalAUM": "Actif total géré", "analytics.conversion": "Taux de conversion", "analytics.activePolicies": "Polices actives", "analytics.avgMeetings": "Réunions moy./semaine"} as any)[stat.labelKey] ?? stat.labelKey : ({"analytics.totalAUM": "Total AUM", "analytics.conversion": "Conversion Rate", "analytics.activePolicies": "Active Policies", "analytics.avgMeetings": "Avg Meeting/Week"} as any)[stat.labelKey] ?? stat.labelKey}</span>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900">--</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
          <PieChart className="w-16 h-16 mx-auto text-slate-500/20 mb-4" />
          <h3 className="text-base font-bold text-slate-900">{isFr ? "Tableau de bord analytique à venir" : "Analytics Dashboard Coming Soon"}</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">{isFr ? "Des graphiques complets et le suivi des KPI seront disponibles ici." : "Comprehensive charts, KPI tracking, team performance, and revenue analytics will be available here."}</p>
        </div>
      </div>
    </AppLayout>
  );
}
