import { Sun, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useBriefing } from "@/hooks/use-notifications";
import { useT } from "@/hooks/useT";
import { BriefingSections } from "@/components/BriefingSections";

/** Daily Briefing — the sidebar page; same content as the sign-in popup, reopenable any time. */
export default function Briefing() {
  const { isFr } = useT();
  const { data, isLoading, isFetching, refetch, error } = useBriefing();
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-briefing-title">
              <Sun className="w-6 h-6 text-amber-500" />
              {isFr ? "Briefing quotidien" : "Daily Briefing"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString(isFr ? "fr-CA" : "en-CA", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-briefing">
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            {isFr ? "Actualiser" : "Refresh"}
          </Button>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">{isFr ? "Chargement…" : "Loading…"}</p>}
        {error && <p className="text-sm text-red-600">{isFr ? "Impossible de charger le briefing." : "Couldn't load the briefing."}</p>}
        {data && <BriefingSections data={data} isFr={isFr} />}
      </div>
    </AppLayout>
  );
}
