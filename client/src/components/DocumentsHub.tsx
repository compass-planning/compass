import { useState } from "react";
import { FileText, Mail } from "lucide-react";
import { translations, type T } from "../i18n/translations";
import { HubShell } from "./insightled";
import { ReportsTab } from "../pages/ReportsTab";
import { LettersTab } from "../pages/LettersTab";

interface Props {
  clientId: number;
  client?: any;
  t?: T;
  advisorLocale?: string;
}

export function DocumentsHub({ clientId, client, t = translations.en, advisorLocale = "en" }: Props) {
  const [subtab, setSubtab] = useState<"reports" | "letters">("reports");

  return (
    <HubShell
      icon={FileText}
      title={t.report.reports ?? "Documents"}
      subtitle={
        <>
          <span>{t.report.preparedFor ?? "Client-facing reports"}</span>
          <span>•</span>
          <span>{t.meeting.title ?? "Engagement & review letters"}</span>
        </>
      }
      subtabs={[
        { key: "reports", label: t.report.reports,  icon: FileText, badgeTone: "cyan"   },
        { key: "letters", label: t.report.letters,  icon: Mail,     badgeTone: "purple" },
      ]}
      activeSubtab={subtab}
      onSubtabChange={(k) => setSubtab(k as "reports" | "letters")}
    >
      <div className="p-6">
        {subtab === "reports" && <ReportsTab clientId={clientId} t={t} locale={advisorLocale ?? "en"} />}
        {subtab === "letters" && <LettersTab clientId={clientId} client={client} />}
      </div>
    </HubShell>
  );
}