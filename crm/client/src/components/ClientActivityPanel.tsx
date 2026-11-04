/**
 * client/src/components/ClientActivityPanel.tsx
 *
 * Standalone (leaf) components for a client's tasks and activity log.
 * Imports only hooks/schema/icons — never a page module — so it can be safely
 * imported by both the Financial Planner and the (legacy) ClientDetail page
 * without creating a circular import.
 */
import { useState } from "react";
import { format } from "date-fns";
import { CheckSquare, Plus, Trash2, Activity } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useClientActivities, useCreateActivity, useDeleteActivity } from "@/hooks/use-activities";
import { useStaffMembers } from "@/hooks/use-users";
import { activityTypes } from "@shared/schema";

const activityTypeLabels: Record<string, string> = {
  phone_call: "Phone Call",
  appointment: "Appointment",
  email: "Email",
  follow_up: "Follow Up",
  note: "Note",
};

export function ClientTasksSection({ clientId }: { clientId: number }) {
  const { data: allTasks = [] } = useTasks();
  const tasks = (allTasks as any[]).filter((t: any) => t.clientId === clientId);
  if (tasks.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CheckSquare className="w-10 h-10 text-slate-200 mb-3" />
      <p className="text-sm font-semibold text-slate-700">No tasks for this client</p>
      <p className="text-xs text-slate-400 mt-1">Tasks linked to this household will appear here</p>
    </div>
  );
  return <div className="space-y-2">{tasks.map((t: any) => (
    <div key={t.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === "completed" ? "bg-emerald-400" : t.priority === "high" || t.priority === "urgent" ? "bg-red-400" : "bg-amber-400"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${t.status === "completed" ? "line-through text-slate-400" : "text-slate-900"}`}>{t.title}</p>
        {t.dueDate && <p className="text-xs text-slate-400">{new Date(t.dueDate).toLocaleDateString("en-CA")}</p>}
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${t.status === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
        {t.status}
      </span>
    </div>
  ))}</div>;
}

export function ActivityTab({ clientId }: { clientId: number }) {
  const { data: activities } = useClientActivities(clientId);
  const { data: allStaff } = useStaffMembers();
  const createActivity = useCreateActivity();
  const deleteActivity = useDeleteActivity();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    activityType: "phone_call",
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 16),
    duration: "",
    staffId: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {
      activityType: formData.activityType,
      title: formData.title,
      description: formData.description || null,
      date: new Date(formData.date).toISOString(),
      duration: formData.duration ? Number(formData.duration) : null,
      staffId: formData.staffId ? Number(formData.staffId) : null,
    };
    createActivity.mutate({ data: payload }, {
      onSuccess: () => {
        setIsAddOpen(false);
        setFormData({ activityType: "phone_call", title: "", description: "", date: new Date().toISOString().slice(0, 16), duration: "", staffId: "" });
      }
    });
  };

  const activityColorMap: Record<string, string> = {
    phone_call: "bg-violet-50 text-violet-600 border-violet-200",
    appointment: "bg-purple-50 text-purple-600 border-purple-200",
    email: "bg-green-50 text-green-600 border-green-200",
    follow_up: "bg-orange-50 text-orange-600 border-orange-200",
    note: "bg-gray-50 text-gray-600 border-gray-200",
  };

  const sortedActivities = activities?.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900" data-testid="text-activity-title">Activity Log</h2>
        <button onClick={() => setIsAddOpen(true)} data-testid="button-add-activity" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Log Activity</span>
        </button>
      </div>

      {isAddOpen && (
        <div className="bg-muted/30 rounded-2xl border border-border p-5 space-y-4 animate-in slide-in-from-top-2 duration-200" data-testid="form-add-activity">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Activity Type</label>
                <select value={formData.activityType} onChange={e => setFormData({...formData, activityType: e.target.value})} data-testid="select-activity-type" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                  {activityTypes.map(t => (
                    <option key={t} value={t}>{activityTypeLabels[t]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Title</label>
                <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} data-testid="input-activity-title" placeholder="e.g. Discussed portfolio rebalancing" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Date & Time</label>
                <input type="datetime-local" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} data-testid="input-activity-date" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Duration (min)</label>
                <input type="number" min="0" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} data-testid="input-activity-duration" placeholder="Optional" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Staff Member</label>
                <select value={formData.staffId} onChange={e => setFormData({...formData, staffId: e.target.value})} data-testid="select-activity-staff" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                  <option value="">Not assigned</option>
                  {allStaff?.map(s => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Notes</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} data-testid="input-activity-description" placeholder="Details about this interaction" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background min-h-[60px]" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 rounded-xl font-semibold text-slate-500 hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={createActivity.isPending} data-testid="button-submit-activity" className="px-4 py-2 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50">
                {createActivity.isPending ? "Saving..." : "Log Activity"}
              </button>
            </div>
          </form>
        </div>
      )}

      {sortedActivities && sortedActivities.length > 0 ? (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {sortedActivities.map(act => {
              const staffMember = act.staffId ? allStaff?.find(s => s.id === act.staffId) : null;
              return (
                <div key={act.id} className="relative pl-14 group" data-testid={`card-activity-${act.id}`}>
                  <div className={`absolute left-3.5 top-3 w-5 h-5 rounded-full border-2 ${activityColorMap[act.activityType] || "bg-gray-50 text-gray-600 border-gray-200"} flex items-center justify-center`}>
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activityColorMap[act.activityType] || "bg-gray-100 text-gray-600"}`}>
                            {activityTypeLabels[act.activityType] || act.activityType}
                          </span>
                          {act.duration && (
                            <span className="text-xs text-slate-500">{act.duration} min</span>
                          )}
                        </div>
                        <p className="font-semibold text-foreground" data-testid={`text-activity-title-${act.id}`}>{act.title}</p>
                        {act.description && <p className="text-sm text-slate-500 mt-1">{act.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>{format(new Date(act.date), 'MMM d, yyyy h:mm a')}</span>
                          {staffMember && <span>by {staffMember.firstName} {staffMember.lastName}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteActivity.mutate({ id: act.id })}
                        data-testid={`button-delete-activity-${act.id}`}
                        className="p-1.5 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500">
          <Activity className="w-10 h-10 mx-auto mb-3 text-slate-500/30" />
          No activities logged. Start tracking calls, appointments, and emails.
        </div>
      )}
    </div>
  );
}
