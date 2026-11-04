import { Cake, Bell, Users, Clock, CheckSquare, AlertTriangle } from "lucide-react";
import type { Notification } from "@shared/schema";
import type { BriefingData } from "@/hooks/use-notifications";

function typeIcon(type: string) {
  switch (type) {
    case "lead_assigned": return <Users className="w-4 h-4 text-violet-500" />;
    case "task_assigned": return <Clock className="w-4 h-4 text-amber-500" />;
    case "reminder_due":  return <Clock className="w-4 h-4 text-red-500" />;
    case "birthday":      return <Cake className="w-4 h-4 text-pink-500" />;
    default:              return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section>
      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
        {icon}{title} ({count})
      </h4>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

const row = "flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2";

/** The briefing body — shared by the login popup and the Daily Briefing page. */
export function BriefingSections({ data, isFr }: { data: BriefingData; isFr: boolean }) {
  const today = new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD (not UTC)
  const day = (d: string | null) => (d ? String(d).slice(0, 10) : "");
  const overdue  = data.tasks.filter((t) => day(t.dueDate) < today);
  const dueToday = data.tasks.filter((t) => day(t.dueDate) === today);
  const upcoming = data.tasks.filter((t) => day(t.dueDate) > today);
  const assigned = data.notifications.filter((n: Notification) => n.type === "lead_assigned" || n.type === "task_assigned");
  const reminders = data.notifications.filter((n: Notification) => n.type === "reminder_due");
  const others = data.notifications.filter((n: Notification) => !["lead_assigned", "task_assigned", "reminder_due"].includes(n.type));
  const empty = data.tasks.length + data.notifications.length + data.birthdays.length === 0;

  const taskRow = (t: BriefingData["tasks"][number], tone: string) => (
    <div key={t.id} className={row}>
      <CheckSquare className={`w-4 h-4 ${tone}`} />
      <div className="flex-1">
        <p className="font-medium text-foreground">{t.title}</p>
        <p className="text-xs mt-0.5">{isFr ? "Échéance" : "Due"} {day(t.dueDate)} · {t.priority}</p>
      </div>
    </div>
  );
  const notifRow = (n: Notification) => (
    <div key={n.id} className={row}>
      {typeIcon(n.type)}
      <div>
        <p className="font-medium text-foreground">{n.title}</p>
        {n.message && <p className="text-xs mt-0.5">{n.message}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="briefing-body">
      <Section icon={<AlertTriangle className="w-4 h-4 text-red-500" />} title={isFr ? "Tâches en retard" : "Overdue tasks"} count={overdue.length}>
        {overdue.map((t) => taskRow(t, "text-red-500"))}
      </Section>
      <Section icon={<CheckSquare className="w-4 h-4 text-amber-500" />} title={isFr ? "Tâches du jour" : "Due today"} count={dueToday.length}>
        {dueToday.map((t) => taskRow(t, "text-amber-500"))}
      </Section>
      <Section icon={<CheckSquare className="w-4 h-4 text-violet-500" />} title={isFr ? "À venir (7 jours)" : "Coming up (7 days)"} count={upcoming.length}>
        {upcoming.map((t) => taskRow(t, "text-violet-500"))}
      </Section>
      <Section icon={<Users className="w-4 h-4 text-violet-500" />} title={isFr ? "Nouvelles assignations" : "New assignments"} count={assigned.length}>
        {assigned.map(notifRow)}
      </Section>
      <Section icon={<Clock className="w-4 h-4 text-red-500" />} title={isFr ? "Rappels" : "Reminders"} count={reminders.length}>
        {reminders.map(notifRow)}
      </Section>
      <Section icon={<Bell className="w-4 h-4 text-muted-foreground" />} title={isFr ? "Autres notifications" : "Other notifications"} count={others.length}>
        {others.map(notifRow)}
      </Section>
      <Section icon={<Cake className="w-4 h-4 text-pink-500" />} title={isFr ? "Anniversaires de clients (7 jours)" : "Client birthdays (next 7 days)"} count={data.birthdays.length}>
        {data.birthdays.map((b) => {
          const dob = b.dateOfBirth ? new Date(b.dateOfBirth + "T00:00:00") : null;
          const now = new Date();
          const isToday = !!dob && dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate();
          return (
            <div key={b.id} className={row + " items-center"}>
              <Cake className="w-4 h-4 text-pink-500 flex-shrink-0" />
              <span className="font-medium text-foreground">{b.firstName} {b.lastName}</span>
              {isToday
                ? <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-medium">{isFr ? "Aujourd'hui !" : "Today!"}</span>
                : <span className="text-xs">{dob ? dob.toLocaleDateString(isFr ? "fr-CA" : "en-US", { month: "short", day: "numeric" }) : ""}</span>}
            </div>
          );
        })}
      </Section>
      {empty && (
        <div className="text-center text-muted-foreground py-6 text-sm" data-testid="briefing-empty">
          {isFr ? "Rien de nouveau pour le moment. Bonne journée !" : "You're all caught up — nothing needs your attention right now."}
        </div>
      )}
    </div>
  );
}
