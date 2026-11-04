import { useState, useMemo } from "react";
import { HostLayout } from "@/components/HostLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Clock, MapPin, Users, X, Trash2, Video, AlertCircle, RefreshCw, Settings, CalendarX2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, addDays, subDays, isToday as isTodayFn, startOfWeek, endOfWeek } from "date-fns";

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  bodyPreview?: string;
  body?: { content: string; contentType: string };
  organizer?: { name: string; address: string };
  isAllDay: boolean;
  showAs: string;
  importance: string;
  attendees?: { name: string; address: string; type: string }[];
  onlineMeetingUrl?: string;
}

interface EmailStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  staffEmail?: string;
  provider?: string;
  reason?: "not_configured" | "service_error" | "no_provider";
}

export default function HostCalendar() {
  const { data: emailStatus, isLoading: statusLoading } = useQuery<EmailStatus>({
    queryKey: ["/api/crm/email/status"],
    queryFn: async () => {
      const res = await fetch("/api/crm/email/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check email status");
      return res.json();
    },
    staleTime: 60000,
  });

  if (statusLoading) {
    return (
      <HostLayout>
        <div className="flex items-center justify-center h-[calc(100vh-2rem)]">
          <div className="text-center">
            <CalendarDays className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4 animate-pulse" />
            <h3 className="text-lg font-display font-bold" data-testid="text-host-calendar-loading">Checking calendar connection...</h3>
          </div>
        </div>
      </HostLayout>
    );
  }

  if (!emailStatus?.connected) {
    const isServiceError = emailStatus?.reason === "service_error";
    return (
      <HostLayout>
        <div className="flex items-center justify-center h-[calc(100vh-2rem)]">
          <div className="text-center max-w-md px-6">
            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
              {isServiceError ? (
                <AlertCircle className="w-10 h-10 text-amber-500/60" />
              ) : (
                <CalendarX2 className="w-10 h-10 text-muted-foreground/40" />
              )}
            </div>
            <h2 className="text-2xl font-display font-bold mb-3" data-testid="text-host-calendar-not-connected">
              {isServiceError ? "Calendar Service Unavailable" : "Calendar Not Connected"}
            </h2>
            <p className="text-muted-foreground mb-6" data-testid="text-host-calendar-setup-info">
              {isServiceError
                ? "The calendar service is temporarily unavailable. Please try again later."
                : "To use the calendar within the Corporate Portal, your email account needs to be connected."}
            </p>
            {!isServiceError && (
              <div className="bg-muted/30 rounded-xl p-5 text-left space-y-3 mb-6">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Setup Instructions
                </h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Connect your email account via Outlook, Gmail, or IMAP/SMTP</li>
                  <li>Ensure your corporate email matches your email account</li>
                  <li>Once connected, your calendar events will appear here automatically</li>
                </ol>
              </div>
            )}
            {emailStatus?.staffEmail && (
              <p className="text-xs text-muted-foreground" data-testid="text-host-calendar-email-hint">
                Your email: <span className="font-mono font-medium text-foreground">{emailStatus.staffEmail}</span>
              </p>
            )}
          </div>
        </div>
      </HostLayout>
    );
  }

  return (
    <HostLayout>
      <CalendarClient />
    </HostLayout>
  );
}

function CalendarClient() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const queryStart = startOfWeek(monthStart);
  const queryEnd = endOfWeek(monthEnd);

  const fetchStart = subDays(queryStart, 1);
  const fetchEnd = addDays(queryEnd, 1);

  const { data: events = [], _isLoading, error } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/crm/calendar/events", fetchStart.toISOString(), fetchEnd.toISOString(), timezone],
    queryFn: async () => {
      const res = await fetch(
        `/api/crm/calendar/events?start=${fetchStart.toISOString()}&end=${fetchEnd.toISOString()}&timeZone=${encodeURIComponent(timezone)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
    refetchInterval: 120000,
  });

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: queryStart, end: queryEnd });
  }, [queryStart.getTime(), queryEnd.getTime()]);

  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter(e => {
      const eventDateStr = e.start.dateTime.substring(0, 10);
      return eventDateStr === dayStr;
    });
  };

  const queryClient = useQueryClient();

  return (
    <>
    <div className="flex flex-col h-[calc(100vh-2rem)] -mt-2 -mb-2 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-display font-bold" data-testid="text-host-calendar-title">
              {format(currentDate, "MMMM yyyy")}
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                data-testid="button-host-prev-month"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                data-testid="button-host-today"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                data-testid="button-host-next-month"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg" data-testid="text-host-calendar-timezone">
              {timezone}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/crm/calendar/events"] })}
              data-testid="button-host-refresh-calendar"
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setCreateDate(new Date()); setShowCreateModal(true); }}
              data-testid="button-host-create-event"
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive/50 mb-3" />
              <h3 className="text-lg font-display font-bold">Connection Error</h3>
              <p className="text-sm text-muted-foreground mt-1">Could not connect to your calendar.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-7">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className="px-2 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border bg-background/50">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 flex-1">
              {calendarDays.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const today = isTodayFn(day);

                return (
                  <div
                    key={idx}
                    onClick={() => { setCreateDate(day); setShowCreateModal(true); }}
                    className={`min-h-[120px] border-b border-r border-border/50 p-1.5 cursor-pointer hover:bg-muted/20 transition-colors ${
                      !isCurrentMonth ? "bg-muted/10" : ""
                    }`}
                    data-testid={`cell-host-day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className="flex justify-end mb-1">
                      <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full ${
                        today ? "bg-primary text-primary-foreground font-bold" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"
                      }`}>
                        {format(day, "d")}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(event => (
                        <button
                          key={event.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                          data-testid={`host-event-${event.id}`}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate transition-colors ${
                            event.showAs === "busy" || event.showAs === "oof"
                              ? "bg-primary/15 text-primary hover:bg-primary/25"
                              : "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
                          }`}
                        >
                          {!event.isAllDay && (
                            <span className="font-normal mr-1">{formatGraphTime(event.start.dateTime)}</span>
                          )}
                          {event.subject}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[11px] text-muted-foreground font-medium pl-1.5">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} timezone={timezone} />
      )}

      {showCreateModal && (
        <CreateEventModal
          defaultDate={createDate}
          onClose={() => { setShowCreateModal(false); setCreateDate(null); }}
          timezone={timezone}
        />
      )}
    </>
  );
}

function EventDetailModal({ event, onClose, timezone }: { event: CalendarEvent; onClose: () => void; timezone: string }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/calendar/events/${event.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete event");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/calendar/events"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-display font-bold" data-testid="text-host-event-subject">{event.subject}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (confirm("Delete this event?")) deleteMutation.mutate(); }}
              data-testid="button-host-delete-event"
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} data-testid="button-host-close-event" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">
                {event.isAllDay ? (
                  formatGraphDate(event.start.dateTime)
                ) : (
                  <>
                    {formatGraphDate(event.start.dateTime)}
                    <br />
                    <span className="text-sm text-muted-foreground">
                      {formatGraphTimeFull(event.start.dateTime)} — {formatGraphTimeFull(event.end.dateTime)}
                    </span>
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{timezone}</p>
            </div>
          </div>

          {event.location?.displayName && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <p className="font-medium">{event.location.displayName}</p>
            </div>
          )}

          {event.onlineMeetingUrl && (
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-violet-600" />
              <a href={event.onlineMeetingUrl} target="_blank" rel="noopener noreferrer" data-testid="link-host-join-teams-meeting" className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors text-sm shadow-sm">
                Join Teams Meeting
              </a>
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                {event.attendees.map((a, i) => (
                  <p key={i} className="text-sm">
                    <span className="font-medium">{a.name || a.address}</span>
                    {a.name && <span className="text-muted-foreground ml-1">({a.address})</span>}
                  </p>
                ))}
              </div>
            </div>
          )}

          {event.organizer && (
            <div className="flex items-start gap-3">
              <CalendarDays className="w-5 h-5 text-muted-foreground mt-0.5" />
              <p className="text-sm">
                <span className="text-muted-foreground">Organized by </span>
                <span className="font-medium">{event.organizer.name || event.organizer.address}</span>
              </p>
            </div>
          )}

          {event.bodyPreview && (
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.bodyPreview}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateEventModal({ defaultDate, onClose, timezone }: { defaultDate: Date | null; onClose: () => void; timezone: string }) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [isTeamsMeeting, setIsTeamsMeeting] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const start = isAllDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
      const end = isAllDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;
      const attendeeList = attendees ? attendees.split(/[,;]/).map(s => s.trim()).filter(Boolean) : [];

      const res = await fetch("/api/crm/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          start,
          end,
          timeZone: timezone,
          location: location || undefined,
          isAllDay,
          attendees: attendeeList.length > 0 ? attendeeList : undefined,
          isOnlineMeeting: isTeamsMeeting || undefined,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/calendar/events"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-display font-bold" data-testid="text-host-create-event-title">New Event</h2>
          <button onClick={onClose} data-testid="button-host-close-create" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Title</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Event title"
              data-testid="input-host-event-subject"
              className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                data-testid="input-host-event-date"
                className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 px-4 py-2.5 cursor-pointer">
                <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} data-testid="input-host-event-all-day" className="rounded" />
                <span className="text-sm font-medium">All Day</span>
              </label>
            </div>
          </div>

          {!isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  data-testid="input-host-event-start-time"
                  className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  data-testid="input-host-event-end-time"
                  className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>
          )}

          <div className="bg-muted/30 rounded-xl px-4 py-2.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 inline mr-1.5" />
            Timezone: {timezone}
          </div>

          <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${isTeamsMeeting ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20" : "border-border hover:border-violet-300"}`}>
            <input type="checkbox" checked={isTeamsMeeting} onChange={e => setIsTeamsMeeting(e.target.checked)} data-testid="input-host-event-teams-meeting" className="rounded" />
            <Video className="w-4 h-4 text-violet-600" />
            <div>
              <span className="text-sm font-semibold">Teams Meeting</span>
              <p className="text-xs text-muted-foreground">Add a Microsoft Teams video call link</p>
            </div>
          </label>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Add a location"
              data-testid="input-host-event-location"
              className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Attendees</label>
            <input
              type="text"
              value={attendees}
              onChange={e => setAttendees(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              data-testid="input-host-event-attendees"
              className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-background/50 rounded-b-2xl">
          <button onClick={onClose} data-testid="button-host-cancel-create-event" className="px-6 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !subject}
            data-testid="button-host-save-event"
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "Creating..." : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseGraphDateTime(dt: string) {
  const parts = dt.replace(/\.0+$/, "").split("T");
  const [y, m, d] = parts[0].split("-").map(Number);
  const timeParts = (parts[1] || "00:00:00").split(":");
  return { year: y, month: m, day: d, hour: Number(timeParts[0]), minute: Number(timeParts[1]) };
}

function formatGraphTime(dt: string): string {
  const { hour, minute } = parseGraphDateTime(dt);
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? "am" : "pm";
  return minute === 0 ? `${h12}${ampm}` : `${h12}:${String(minute).padStart(2, "0")}${ampm}`;
}

function formatGraphTimeFull(dt: string): string {
  const { hour, minute } = parseGraphDateTime(dt);
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function formatGraphDate(dt: string): string {
  const { year, month, day } = parseGraphDateTime(dt);
  const d = new Date(year, month - 1, day);
  return format(d, "EEEE, MMMM d, yyyy");
}
