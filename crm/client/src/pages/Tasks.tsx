import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useStaffMembers, useCurrentStaff } from "@/hooks/use-users";
import { useClients } from "@/hooks/use-clients";
import { useLeads } from "@/hooks/use-leads";
import { taskPriorities, taskStatuses } from "@shared/schema";
import type { Task, StaffMember } from "@shared/schema";
import {
  X, Calendar, Clock,
  CheckSquare, Square, Trash2, Search, Edit,
  AlertCircle, ChevronDown, ChevronUp, Users, User, ExternalLink, Link2,
  Zap
} from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { useWindowManager } from "@/contexts/WindowManagerContext";

function getPriorityConfig(isFr: boolean): Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> {
  return {
    low: { label: isFr ? "Faible" : "Low", color: "text-slate-600", bgColor: "bg-slate-50", borderColor: "border-slate-200", icon: "↓" },
    medium: { label: isFr ? "Moyen" : "Medium", color: "text-violet-600", bgColor: "bg-violet-50", borderColor: "border-violet-200", icon: "→" },
    high: { label: isFr ? "Élevé" : "High", color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200", icon: "↑" },
    urgent: { label: isFr ? "Urgent" : "Urgent", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200", icon: "⚡" },
  };
}

function getStatusConfig(isFr: boolean): Record<string, { label: string; color: string; bgColor: string; borderColor: string }> {
  return {
    pending: { label: isFr ? "En attente" : "Pending", color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
    in_progress: { label: isFr ? "En cours" : "In Progress", color: "text-violet-700", bgColor: "bg-violet-50", borderColor: "border-violet-200" },
    completed: { label: isFr ? "Complété" : "Completed", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
    cancelled: { label: isFr ? "Annulé" : "Cancelled", color: "text-gray-500", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
  };
}

type SortField = "title" | "dueDate" | "priority" | "status" | "assignee";
type SortDir = "asc" | "desc";

export default function Tasks() {
  const { isFrench: isFr } = useLanguage();
  const PRIORITY_CONFIG = getPriorityConfig(isFr);
  const STATUS_CONFIG = getStatusConfig(isFr);
  const { data: allTasks = [], isLoading } = useTasks();
  const { data: allStaff } = useStaffMembers();
  const { data: currentStaff } = useCurrentStaff();
  const { data: clientsList } = useClients();
  const { data: _leadsList } = useLeads();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterAssignee, _setFilterAssignee] = useState<string>("");
  const [filterVisibility, _setFilterVisibility] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const updateTask = useUpdateTask();

  const _toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getStaffName = (id: number | null): string => {
    if (!id) return "";
    const s = allStaff?.find(m => m.id === id);
    return s ? `${s.firstName} ${s.lastName}` : "";
  };

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filteredTasks = useMemo(() => {
    let filtered = allTasks;
    if (!showCompleted) {
      filtered = filtered.filter(t => t.status !== "completed" && t.status !== "cancelled");
    }
    if (filterStatus) filtered = filtered.filter(t => t.status === filterStatus);
    if (filterPriority) filtered = filtered.filter(t => t.priority === filterPriority);
    if (filterAssignee) {
      if (filterAssignee === "unassigned") {
        filtered = filtered.filter(t => !t.assignedToStaffId);
      } else {
        filtered = filtered.filter(t => t.assignedToStaffId === Number(filterAssignee));
      }
    }
    if (filterVisibility) filtered = filtered.filter(t => t.visibility === filterVisibility);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        (t.title?.toLowerCase().includes(term)) ||
        (t.description?.toLowerCase().includes(term))
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = (a.title || "").localeCompare(b.title || "");
          break;
        case "dueDate": {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          cmp = aDate - bDate;
          break;
        }
        case "priority":
          cmp = (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2);
          break;
        case "status":
          cmp = taskStatuses.indexOf(a.status as typeof taskStatuses[number]) - taskStatuses.indexOf(b.status as typeof taskStatuses[number]);
          break;
        case "assignee":
          cmp = getStaffName(a.assignedToStaffId).localeCompare(getStaffName(b.assignedToStaffId));
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [allTasks, filterStatus, filterPriority, filterAssignee, filterVisibility, searchTerm, showCompleted, sortField, sortDir, allStaff]);

  const pendingCount = allTasks.filter(t => t.status === "pending").length;
  const inProgressCount = allTasks.filter(t => t.status === "in_progress").length;
  const completedCount = allTasks.filter(t => t.status === "completed").length;
  const overdueCount = allTasks.filter(t => t.dueDate && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)) && t.status !== "completed" && t.status !== "cancelled").length;

  const _handleQuickStatusToggle = (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTask.mutate({ id: task.id, status: newStatus });
  };

  const staffList = allStaff ?? [];

  // Aliases so new insightled UI and old state declarations stay in sync
  const statusFilter = filterStatus;
  const setStatusFilter = setFilterStatus;
  const priorityFilter = filterPriority;
  const setPriorityFilter = setFilterPriority;

  // Group tasks by urgency
  const overdueTasks = filteredTasks.filter(t => t.status !== "completed" && t.dueDate && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)));
  const todayTasks   = filteredTasks.filter(t => t.status !== "completed" && t.dueDate && isToday(parseISO(t.dueDate)));
  const openTasks    = filteredTasks.filter(t => t.status !== "completed" && (!t.dueDate || (!isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)))));
  const doneTasks    = filteredTasks.filter(t => t.status === "completed");

  const sortByPriority = (a: Task, b: Task) => (priorityOrder[a.priority ?? "low"] ?? 3) - (priorityOrder[b.priority ?? "low"] ?? 3);

  function TaskGroup({ label, tasks, tone }: { label: string; tasks: Task[]; tone: "red"|"amber"|"blue"|"slate" }) {
    if (tasks.length === 0) return null;
    const colors = { red:"var(--accent-rose)", amber:"var(--accent-amber)", blue:"var(--accent-blue)", slate:"var(--text-tertiary)" };
    return (
      <div className="mb-1">
        <div className="px-6 py-2 flex items-center gap-2 sticky top-0 z-10" style={{ backgroundColor: "var(--bg-soft)", borderBottom: "1px solid var(--border-subtle)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[tone] }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: colors[tone] }}>{label}</span>
          <span className="text-[10px] font-mono ml-1" style={{ color: "var(--text-tertiary)" }}>({tasks.length})</span>
        </div>
        {[...tasks].sort(sortByPriority).map(task => {
          const client = clientsList?.find(c => c.id === task.clientId);
          const pcfg = PRIORITY_CONFIG[task.priority ?? "low"] || PRIORITY_CONFIG.low;
          const scfg = STATUS_CONFIG[task.status ?? "pending"] || STATUS_CONFIG.pending;
          const assignee = allStaff?.find(s => s.id === task.assignedToStaffId);
          const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate));
          const dueToday = task.dueDate && isToday(parseISO(task.dueDate));
          return (
            <div key={task.id} data-testid={`row-task-${task.id}`}
              className="group flex items-start gap-3 px-6 py-3 cursor-pointer transition-colors"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-soft)")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              onClick={() => setEditingTask(task)}>

              {/* Priority indicator */}
              <div className="flex-shrink-0 mt-0.5 w-5 flex items-center justify-center">
                <span className="text-base leading-none font-bold" style={{ color: pcfg.color.replace("text-","").includes("-") ? undefined : "currentColor" }}
                  data-priority={task.priority}>{pcfg.icon}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1">
                  <p className={`text-sm font-semibold flex-1 ${task.status === "completed" ? "line-through opacity-50" : ""}`}
                    style={{ color: "var(--text-primary)" }} data-testid={`text-task-title-${task.id}`}>{task.title}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${scfg.bgColor} ${scfg.color} ${scfg.borderColor}`}>
                    {scfg.label}
                  </span>
                </div>

                {/* Context row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {client && (
                    <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--accent-blue)" }}>
                      <Users className="w-2.5 h-2.5" /> {client.firstName} {client.lastName}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className={`flex items-center gap-1 text-[10px] font-mono ${isOverdue ? "font-bold" : ""}`}
                      style={{ color: isOverdue ? "var(--accent-rose)" : dueToday ? "var(--accent-amber)" : "var(--text-tertiary)" }}>
                      <Clock className="w-2.5 h-2.5" />
                      {isOverdue ? "Overdue · " : dueToday ? "Today · " : ""}{format(parseISO(task.dueDate), "MMM d")}
                    </span>
                  )}
                  {task.taskType && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-soft)", color: "var(--text-tertiary)" }}>
                      {task.taskType.replace(/_/g," ")}
                    </span>
                  )}
                  {assignee && (
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>→ {assignee.firstName} {assignee.lastName[0]}.</span>
                  )}
                </div>
              </div>

              {/* Complete button */}
              <button data-testid={`button-toggle-task-${task.id}`}
                onClick={e => { e.stopPropagation(); updateTask.mutate({ id: task.id, status: task.status === "completed" ? "pending" : "completed" }); }}
                className="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                style={{ borderColor: task.status === "completed" ? "var(--accent-green)" : "var(--border-light)", backgroundColor: task.status === "completed" ? "var(--accent-green)" : "transparent" }}>
                {task.status === "completed" && <CheckSquare className="w-3 h-3 text-white" />}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="fp-insightled" style={{ height: "100%", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-white/90 backdrop-blur" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-tertiary)" }}>{isFr ? "CRM consultatif" : "Advisory CRM"}</p>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{isFr ? "File de travail des conseillers" : "Advisor Workflow Queue"}</h1>
            </div>
            <div className="hidden lg:flex items-center gap-3">
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700">
                  <Zap className="w-3 h-3" /> {overdueCount} Overdue
                </span>
              )}
              <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>{pendingCount + inProgressCount} {isFr ? "en cours" : "open"} · {completedCount} {isFr ? "complétées" : "done"}</span>
            </div>
          </div>
          <button onClick={() => setShowCreateModal(true)} data-testid="button-create-task"
            className="px-4 py-2 rounded-lg bg-brand-gradient text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all">
            {isFr ? "+ Nouvelle tâche" : "+ New Task"}
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Task queue */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="px-6 py-2.5 flex items-center gap-2 border-b flex-wrap" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-soft)" }}>
              <div className="relative flex-1 min-w-[160px] max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={isFr ? "Rechercher des tâches..." : "Search tasks..."}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:border-violet-400"
                  style={{ borderColor: "var(--border-light)" }} />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border bg-white focus:outline-none" style={{ borderColor: "var(--border-light)" }}>
                <option value="all">{isFr ? "Tous les statuts" : "All Statuses"}</option>
                {Object.entries(STATUS_CONFIG).map(([s,c]) => <option key={s} value={s}>{c.label}</option>)}
              </select>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border bg-white focus:outline-none" style={{ borderColor: "var(--border-light)" }}>
                <option value="all">{isFr ? "Toutes les priorités" : "All Priorities"}</option>
                {Object.entries(PRIORITY_CONFIG).map(([s,c]) => <option key={s} value={s}>{c.label}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)}
                  className="w-3 h-3 rounded" />
                {isFr ? "Afficher les complétées" : "Show completed"}
              </label>
            </div>

            {/* Grouped tasks */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({length:8}).map((_,i) => (
                    <div key={i} className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: "var(--bg-soft)" }} />
                  ))}
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="py-20 text-center" style={{ color: "var(--text-tertiary)" }}>
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">{isFr ? "File d'attente vide" : "Queue is clear"}</p>
                  <p className="text-xs mt-1">{isFr ? "Aucune tâche ne correspond" : "No tasks match your filters"}</p>
                </div>
              ) : (
                <>
                  <TaskGroup label={isFr ? "En retard" : "Overdue"} tasks={overdueTasks} tone="red" />
                  <TaskGroup label={isFr ? "Échéance aujourd'hui" : "Due Today"} tasks={todayTasks} tone="amber" />
                  <TaskGroup label={isFr ? "En cours" : "Open"} tasks={openTasks} tone="blue" />
                  {showCompleted && <TaskGroup label={isFr ? "Complétées" : "Completed"} tasks={doneTasks} tone="slate" />}
                </>
              )}
            </div>
          </div>

          {/* Intelligence rail */}
          <div className="w-64 flex-shrink-0 flex flex-col overflow-y-auto" style={{ borderLeft: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-soft)" }}>

            <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Santé de la file" : "Queue Health"}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: isFr ? "En retard" : "Overdue",    value: overdueCount,    color: overdueCount > 0 ? "var(--accent-rose)"  : "var(--accent-green)" },
                  { label: isFr ? "Aujourd'hui" : "Due Today",  value: todayTasks.length, color: todayTasks.length > 0 ? "var(--accent-amber)" : "var(--accent-green)" },
                  { label: isFr ? "En cours" : "Open",       value: pendingCount + inProgressCount, color: "var(--accent-blue)" },
                  { label: isFr ? "Complété" : "Completed",  value: completedCount,  color: "var(--accent-green)" },
                ].map(s => (
                  <div key={s.label} className="fp-insightled-card p-2.5">
                    <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-tertiary)" }}>{s.label}</p>
                    <p className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority breakdown */}
            <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Par priorité" : "By Priority"}</p>
              {(["urgent","high","medium","low"] as const).map(p => {
                const cfg = PRIORITY_CONFIG[p];
                const count = filteredTasks.filter(t => t.priority === p && t.status !== "completed").length;
                if (count === 0) return null;
                return (
                  <div key={p} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-[10px] font-medium flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <span>{cfg.icon}</span> {cfg.label}
                    </span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: "var(--text-primary)" }}>{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Household-linked tasks */}
            <div className="p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Actions clients" : "Client Actions"}</p>
              {filteredTasks.filter(t => t.clientId && t.status !== "completed").slice(0,6).map(t => {
                const client = clientsList?.find(c => c.id === t.clientId);
                const pcfg = PRIORITY_CONFIG[t.priority ?? "low"];
                return (
                  <div key={t.id} className="flex items-center gap-2 py-2 border-b last:border-0 cursor-pointer hover:opacity-80"
                    style={{ borderColor: "var(--border-subtle)" }} onClick={() => setEditingTask(t)}>
                    <span className="text-xs">{pcfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{t.title}</p>
                      {client && <p className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>{client.firstName} {client.lastName}</p>}
                    </div>
                  </div>
                );
              })}
              {filteredTasks.filter(t => t.clientId && t.status !== "completed").length === 0 && (
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Aucune tâche liée à un client" : "No client-linked tasks"}</p>
              )}
            </div>

          </div>
        </div>

      </div>

      {showCreateModal && (
        <TaskFormModal
          allStaff={staffList}
          onClose={() => setShowCreateModal(false)}
        />
      )}
      {editingTask && (
        <TaskFormModal
          task={editingTask}
          allStaff={staffList}
          currentStaffId={currentStaff?.id}
          onClose={() => setEditingTask(null)}
        />
      )}
    </AppLayout>
  );
}

function _StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="fp-insightled-card p-5" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-4`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-tertiary)" }}>{label}</p>
      <p className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function _SortableHeader({ field, label, sortField, sortDir, onToggle }: { field: SortField; label: string; sortField: SortField; sortDir: SortDir; onToggle: (field: SortField) => void }) {
  const active = sortField === field;
  return (
    <th
      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-foreground select-none transition-colors"
      onClick={() => onToggle(field)}
      data-testid={`sort-${field}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

export function TaskDetailContent({ taskId }: { taskId: number }) {
  const { isFrench: isFr } = useLanguage();
  const PRIORITY_CONFIG = getPriorityConfig(isFr);
  const STATUS_CONFIG = getStatusConfig(isFr);
  const { data: allTasks = [] } = useTasks();
  const { data: allStaff = [] } = useStaffMembers();
  const updateTask = useUpdateTask();
  const task = allTasks.find(t => t.id === taskId);

  if (!task) return <div className="animate-pulse h-48 bg-muted rounded-xl" />;

  const assignee = task.assignedToStaffId ? allStaff.find(s => s.id === task.assignedToStaffId) : null;
  const creator = allStaff.find(s => s.id === task.createdByStaffId);
  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const isCompleted = task.status === "completed" || task.status === "cancelled";
  const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate)) && !isCompleted;

  const handleToggleStatus = () => {
    const newStatus = isCompleted ? "pending" : "completed";
    updateTask.mutate({ id: task.id, status: newStatus });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={handleToggleStatus} data-testid="button-popout-toggle-task-status" className="p-1 rounded hover:bg-muted/50 transition-colors">
          {isCompleted ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5 text-slate-500" />}
        </button>
        <h2 className={`text-base font-bold text-slate-900 ${isCompleted ? "line-through text-slate-500" : ""}`}>{task.title}</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${priorityConfig.borderColor} ${priorityConfig.bgColor} ${priorityConfig.color}`}>
          {priorityConfig.icon} {priorityConfig.label}
        </span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusConfig.borderColor} ${statusConfig.bgColor} ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${task.visibility === "company" ? "bg-violet-50 text-violet-600 border border-violet-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
          {task.visibility === "company" ? <><Users className="w-3 h-3" /> Company</> : <><User className="w-3 h-3" /> Private</>}
        </span>
      </div>

      {task.description && <p className="text-sm text-foreground/80 bg-muted/20 rounded-xl p-3">{task.description}</p>}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {task.dueDate && (
          <div className={`flex items-center gap-2 ${isOverdue ? "text-red-600" : "text-slate-500"}`}>
            <Calendar className="w-3.5 h-3.5" /> {format(parseISO(task.dueDate), "MMM d, yyyy")}
            {task.dueTime && <><Clock className="w-3 h-3 ml-1" /> {task.dueTime}</>}
            {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
          </div>
        )}
        {assignee && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">{assignee.firstName[0]}{assignee.lastName[0]}</div>
            {assignee.firstName} {assignee.lastName}
          </div>
        )}
        {creator && (
          <div className="flex items-center gap-2 text-slate-500">
            Created by {creator.firstName} {creator.lastName}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <span className="text-sm font-semibold text-slate-500">Status:</span>
        <select
          value={task.status}
          onChange={e => updateTask.mutate({ id: task.id, status: e.target.value })}
          data-testid="select-popout-task-status"
          className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${statusConfig.borderColor} ${statusConfig.bgColor} ${statusConfig.color} cursor-pointer`}
        >
          {taskStatuses.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>
    </div>
  );
}

function _TaskRow({ task, allStaff, onToggleStatus, onEdit, clientName, leadName, currentStaffId }: {
  task: Task;
  allStaff: StaffMember[];
  currentStaffId?: number;
  onToggleStatus: () => void;
  onEdit: () => void;
  clientName?: string;
  leadName?: string;
}) {
  const { isFrench: isFr } = useLanguage();
  const PRIORITY_CONFIG = getPriorityConfig(isFr);
  const STATUS_CONFIG = getStatusConfig(isFr);
  const assignee = task.assignedToStaffId ? allStaff.find(s => s.id === task.assignedToStaffId) : null;
  const creator = allStaff.find(s => s.id === task.createdByStaffId);
  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const isCompleted = task.status === "completed" || task.status === "cancelled";
  const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate)) && !isCompleted;
  const isDueToday = task.dueDate && isToday(parseISO(task.dueDate)) && !isCompleted;
  const deleteTask = useDeleteTask();
  const { openWindow } = useWindowManager();

  const canDelete = task.createdByStaffId === currentStaffId;

  return (
    <tr
      className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${isCompleted ? "opacity-60" : ""}`}
      data-testid={`row-task-${task.id}`}
    >
      <td className="px-4 py-3">
        <button
          onClick={onToggleStatus}
          data-testid={`button-toggle-task-${task.id}`}
          className="p-1 rounded hover:bg-muted/50 transition-colors"
        >
          {isCompleted ? (
            <CheckSquare className="w-5 h-5 text-emerald-500" />
          ) : (
            <Square className="w-5 h-5 text-slate-500/50 hover:text-primary" />
          )}
        </button>
      </td>
      <td className="px-4 py-3 cursor-pointer" onClick={onEdit}>
        <div>
          <p className={`text-sm font-semibold ${isCompleted ? "line-through text-slate-500" : "text-foreground"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            {creator && (
              <p className="text-[10px] text-slate-500/60">by {creator.firstName} {creator.lastName}</p>
            )}
            {clientName && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full" data-testid={`badge-task-client-${task.id}`}>
                <Link2 className="w-2.5 h-2.5" /> {clientName}
              </span>
            )}
            {leadName && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full" data-testid={`badge-task-lead-${task.id}`}>
                <Link2 className="w-2.5 h-2.5" /> {leadName}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3" onClick={onEdit}>
        {task.dueDate ? (
          <div className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue ? "text-red-600" : isDueToday ? "text-orange-600" : "text-slate-500"}`}>
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(parseISO(task.dueDate), "MMM d, yyyy")}</span>
            {task.dueTime && (
              <>
                <Clock className="w-3 h-3 ml-1" />
                <span>{task.dueTime}</span>
              </>
            )}
            {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
          </div>
        ) : (
          <span className="text-xs text-slate-500/50">No date</span>
        )}
      </td>
      <td className="px-4 py-3" onClick={onEdit}>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${priorityConfig.borderColor} ${priorityConfig.bgColor} ${priorityConfig.color}`}>
          {priorityConfig.icon} {priorityConfig.label}
        </span>
      </td>
      <td className="px-4 py-3" onClick={onEdit}>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusConfig.borderColor} ${statusConfig.bgColor} ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </td>
      <td className="px-4 py-3" onClick={onEdit}>
        {assignee ? (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
              {assignee.firstName[0]}{assignee.lastName[0]}
            </div>
            <span className="text-xs text-foreground font-medium">{assignee.firstName} {assignee.lastName}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500/50">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3" onClick={onEdit}>
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${task.visibility === "company" ? "text-violet-600" : "text-gray-500"}`}>
          {task.visibility === "company" ? <><Users className="w-3 h-3" /> Company</> : <><User className="w-3 h-3" /> Private</>}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              openWindow({
                id: `task-${task.id}`,
                title: `${task.title} — Task`,
                component: <TaskDetailContent taskId={task.id} />,
                width: 600,
                height: 450,
              });
            }}
            data-testid={`button-popout-task-${task.id}`}
            className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors"
            title="Pop out to floating window"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            data-testid={`button-edit-task-${task.id}`}
            className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          {canDelete && (
            <button
              onClick={() => deleteTask.mutate(task.id)}
              data-testid={`button-delete-task-${task.id}`}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function TaskFormModal({ task, allStaff, onClose, currentStaffId }: {
  task?: Task;
  allStaff: StaffMember[];
  currentStaffId?: number;
  onClose: () => void;
}) {
  const { isFrench: isFr } = useLanguage();
  const PRIORITY_CONFIG = getPriorityConfig(isFr);
  const STATUS_CONFIG = getStatusConfig(isFr);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { openWindow } = useWindowManager();
  const { data: clientsList } = useClients();
  const { data: leadsList } = useLeads();
  const isEditing = !!task;
  // Same server-driven "who can I assign to" list as clients and pipeline deals.
  const { data: assignable } = useQuery<StaffMember[]>({ queryKey: ["/api/crm/staff/assignable-advisors"] });
  const assigneeChoices = [
    ...(assignable ?? []),
    ...(task?.assignedToStaffId && !(assignable ?? []).some(a => a.id === task.assignedToStaffId)
      ? allStaff.filter(s => s.id === task.assignedToStaffId) : []),
  ];

  const [linkType, setLinkType] = useState<"none" | "client" | "lead">(
    task?.clientId ? "client" : task?.leadId ? "lead" : "none"
  );
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    dueDate: task?.dueDate || "",
    dueTime: task?.dueTime || "",
    priority: task?.priority || "medium",
    status: task?.status || "pending",
    visibility: task?.visibility || "private",
    assignedToStaffId: task?.assignedToStaffId?.toString() || "",
    clientId: task?.clientId?.toString() || "",
    leadId: task?.leadId?.toString() || "",
  });
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("Title is required.");
      return;
    }
    setError("");

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      dueDate: formData.dueDate || null,
      dueTime: formData.dueTime || null,
      priority: formData.priority as "low" | "medium" | "high" | "urgent",
      status: formData.status as "pending" | "in_progress" | "completed" | "cancelled",
      visibility: formData.visibility as "company" | "private",
      assignedToStaffId: formData.assignedToStaffId ? Number(formData.assignedToStaffId) : null,
      clientId: linkType === "client" && formData.clientId ? Number(formData.clientId) : null,
      leadId: linkType === "lead" && formData.leadId ? Number(formData.leadId) : null,
    };

    if (isEditing) {
      updateTask.mutate({ id: task.id, ...payload }, { onSuccess: () => onClose() });
    } else {
      createTask.mutate(payload, { onSuccess: () => onClose() });
    }
  };

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border bg-background/50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900" data-testid="text-modal-title">
              {isEditing ? "Edit Task" : (isFr ? "Nouvelle tâche" : "New Task")}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isEditing ? "Update task details." : "Create a new task or reminder."}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isEditing && task && (
              <button
                onClick={() => {
                  openWindow({
                    id: `task-${task.id}`,
                    title: `${task.title} — Task`,
                    component: <TaskDetailContent taskId={task.id} />,
                    width: 600,
                    height: 450,
                  });
                  onClose();
                }}
                data-testid="button-popout-task-modal"
                className="p-2 rounded-lg hover:bg-muted text-slate-500 hover:text-primary transition-colors"
                title="Pop out to floating window"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} data-testid="button-close-task-form" className="p-2 rounded-lg hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" data-testid="form-task">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium" data-testid="text-form-error">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Title *</label>
            <input
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              data-testid="input-task-title"
              placeholder="e.g., Follow up with client about policy renewal"
              className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              data-testid="input-task-description"
              rows={3}
              placeholder="Add details or notes..."
              className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                data-testid="input-task-due-date"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Due Time</label>
              <input
                type="time"
                value={formData.dueTime}
                onChange={e => setFormData({ ...formData, dueTime: e.target.value })}
                data-testid="input-task-due-time"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Priority</label>
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                data-testid="select-task-priority"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background"
              >
                {taskPriorities.map(p => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
            {isEditing && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  data-testid="select-task-status"
                  className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background"
                >
                  {taskStatuses.map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Visibility</label>
              <select
                value={formData.visibility}
                onChange={e => setFormData({ ...formData, visibility: e.target.value })}
                data-testid="select-task-visibility"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background"
              >
                <option value="private">Private (only you)</option>
                <option value="company">Company (visible to all)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Assign To</label>
              <select
                value={formData.assignedToStaffId}
                onChange={e => setFormData({ ...formData, assignedToStaffId: e.target.value })}
                data-testid="select-task-assignee"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background"
              >
                <option value="">No one (self)</option>
                {assigneeChoices.map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Link to Client or Lead
            </label>
            <div className="flex gap-2">
              <select
                value={linkType}
                onChange={e => {
                  const val = e.target.value as "none" | "client" | "lead";
                  setLinkType(val);
                  if (val !== "client") setFormData(f => ({ ...f, clientId: "" }));
                  if (val !== "lead") setFormData(f => ({ ...f, leadId: "" }));
                }}
                data-testid="select-task-link-type"
                className="px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background text-sm"
              >
                <option value="none">No link</option>
                <option value="client">Client</option>
                <option value="lead">Lead</option>
              </select>
              {linkType === "client" && (
                <select
                  value={formData.clientId}
                  onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                  data-testid="select-task-client"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background text-sm"
                >
                  <option value="">Select a client...</option>
                  {clientsList?.map(c => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              )}
              {linkType === "lead" && (
                <select
                  value={formData.leadId}
                  onChange={e => setFormData({ ...formData, leadId: e.target.value })}
                  data-testid="select-task-lead"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background text-sm"
                >
                  <option value="">Select a lead...</option>
                  {leadsList?.map(l => (
                    <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="button-cancel-task"
              className="px-5 py-2.5 rounded-xl border border-border text-slate-500 font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              data-testid="button-submit-task"
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50"
            >
              {isPending ? (isFr ? "Enregistrement..." : "Saving...") : isEditing ? (isFr ? "Enregistrer" : "Save Changes") : (isFr ? "Créer une tâche" : "Create Task")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
