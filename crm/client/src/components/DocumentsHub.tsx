import { useState } from "react";
import { FileText, Mail } from "lucide-react";
import { HubShell } from "./insightled";
import { ReportsTab } from "../pages/ReportsTab";
import { LettersTab } from "../pages/LettersTab";

interface Props {
  clientId: number;
  client?: Record<string, unknown>;
}

export function DocumentsHub({ clientId, client }: Props) {
  const [subtab, setSubtab] = useState<"reports" | "letters">("reports");

  return (
    <HubShell
      icon={FileText}
      title="Documents"
      subtitle={
        <>
          <span>Client-facing reports</span>
          <span>•</span>
          <span>Engagement & review letters</span>
        </>
      }
      subtabs={[
        { key: "reports", label: "Reports", icon: FileText, badgeTone: "cyan"   },
        { key: "letters", label: "Letters", icon: Mail,     badgeTone: "purple" },
      ]}
      activeSubtab={subtab}
      onSubtabChange={(k) => setSubtab(k as "reports" | "letters")}
    >
      <div className="p-6">
        {subtab === "reports" && <ReportsTab clientId={clientId} />}
        {subtab === "letters" && <LettersTab clientId={clientId} client={client} />}
      </div>
    </HubShell>
  );
}
