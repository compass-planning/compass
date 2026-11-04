import { Globe, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageToggle() {
  const { isFrench, isForced, setLocale } = useLanguage();
  const nextLocale = isFrench ? "en" : "fr";
  const label = isFrench ? "EN" : "FR";
  const tooltip = isFrench ? "Switch to English" : "Passer en français";

  return (
    <button
      onClick={() => setLocale(nextLocale)}
      title={tooltip}
      aria-label={tooltip}
      className={[
        "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold",
        "border transition-colors select-none",
        isForced
          ? "border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100"
          : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      ].join(" ")}
    >
      {isForced
        ? <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        : <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}

export function ReportLanguageToggle({ value, onChange }: {
  value: "en" | "fr";
  onChange: (l: "en" | "fr") => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/40">
      {(["en", "fr"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => onChange(lang)}
          className={[
            "px-3 py-1 rounded-md text-xs font-semibold transition-colors",
            value === lang
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {lang === "en" ? "English" : "Français"}
        </button>
      ))}
    </div>
  );
}
