import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Mic, FileText, Clock, Users, ChevronRight } from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { MeetingRecorderTrigger } from "@/components/MeetingRecorder";


function tFn(dict: any, key: string): string {
  const parts = key.split(".");
  let cur = dict;
  for (const p of parts) { if (cur == null) return key; cur = cur[p]; }
  return typeof cur === "string" ? cur : key;
}

export default function MeetingRecorderPage() {
  const { t: _tObj } = useLanguage();
  const t = (key: string) => tFn(_tObj as any, key);
  const { data: clients = [], isLoading } = useClients();
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const filtered = clients.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const steps = [
    { icon: Mic,      titleKey: "meeting.stepRecord",     descKey: "meeting.stepRecordDesc" },
    { icon: FileText, titleKey: "meeting.stepTranscribe",  descKey: "meeting.stepTranscribeDesc" },
    { icon: Clock,    titleKey: "meeting.stepSummarize",   descKey: "meeting.stepSummarizeDesc" },
    { icon: Users,    titleKey: "meeting.stepClientFile",  descKey: "meeting.stepClientFileDesc" },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
            {t("meeting.title")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t("meeting.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* Step 1 — Select Client */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                {t("meeting.selectClient")}
              </h2>
              <input
                type="text"
                placeholder={t("client.searchClients")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              />
              {isLoading ? (
                <p className="text-sm text-slate-400 py-4 text-center">{t("action.loading")}</p>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {filtered.slice(0, 15).map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedClientId === c.id ? "bg-[#0c1e3a] text-white" : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span>{c.firstName} {c.lastName}</span>
                      {selectedClientId === c.id && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-sm text-slate-400 py-3 text-center">{t("client.noClientsFound")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Step 2 — Record */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                {t("meeting.recordMeeting")}
              </h2>
              {selectedClient ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#0c1e3a]/5 flex items-center justify-center mb-4">
                    <Mic className="w-7 h-7 text-[#0c1e3a]" />
                  </div>
                  <p className="font-semibold text-slate-800 mb-1">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </p>
                  <p className="text-sm text-slate-400 mb-6">{t("meeting.aiDescription")}</p>
                  <MeetingRecorderTrigger
                    clientId={selectedClient.id}
                    clientName={`${selectedClient.firstName} ${selectedClient.lastName}`}
                  />
                  <p className="text-xs text-slate-400 mt-4">{t("meeting.browserMic")}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <Users className="w-10 h-10 text-slate-200 mb-3" />
                  <p className="text-sm text-slate-400">{t("client.selectClient")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4 text-sm">{t("meeting.howItWorks")}</h3>
              <div className="space-y-4">
                {steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <step.icon className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{t(step.titleKey as any)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{t(step.descKey as any)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">{t("meeting.browserNote")}</p>
              <p className="text-xs text-amber-600">{t("meeting.browserNoteText")}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
