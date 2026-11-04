import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect, useRef } from "react";
import { useT } from "@/hooks/useT";
import { useLocation } from "wouter";
import { Search, Users, CheckSquare, Calendar, FileText, TrendingUp, X, Loader2 } from "lucide-react";

interface SearchResults {
  clients: Array<{ id: number; firstName: string; lastName: string; email: string; phone: string }>;
  tasks: Array<{ id: number; title: string; description: string; status: string; dueDate: string; clientId: number }>;
  meetings: Array<{ id: number; title: string; date: string; clientId: number }>;
  policies: Array<{ id: number; type: string; provider: string; policyNumber: string; clientId: number }>;
  leads: Array<{ id: number; firstName: string; lastName: string; email: string; status: string }>;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const { isFr } = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults(null); return; }
    setLoading(true);
    fetch(`/api/crm/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(data => { setResults(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [debouncedQuery]);

  // Keyboard: Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function go(path: string) {
    navigate(path);
    onClose();
  }

  const hasResults = results && (
    results.clients.length + results.tasks.length +
    results.meetings.length + results.policies.length + results.leads.length > 0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {loading
            ? <Loader2 className="w-5 h-5 text-muted-foreground animate-spin flex-shrink-0" />
            : <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients, tasks, policies, meetings..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-xs bg-muted rounded border border-border text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {query.length < 2 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search
          </div>
        )}

        {query.length >= 2 && !loading && !hasResults && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No results for "{query}"
          </div>
        )}

        {hasResults && (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/50">

            {results.clients.length > 0 && (
              <Section label={isFr ? "Clients" : "Clients"} icon={<Users className="w-3.5 h-3.5" />}>
                {results.clients.map(c => (
                  <ResultRow
                    key={c.id}
                    primary={`${c.firstName} ${c.lastName}`}
                    secondary={c.email || c.phone || ""}
                    onClick={() => go(`/clients/${c.id}`)}
                  />
                ))}
              </Section>
            )}

            {results.tasks.length > 0 && (
              <Section label="Tasks" icon={<CheckSquare className="w-3.5 h-3.5" />}>
                {results.tasks.map(t => (
                  <ResultRow
                    key={t.id}
                    primary={t.title}
                    secondary={t.status}
                    badge={t.status === "open" ? "open" : undefined}
                    onClick={() => go(`/tasks`)}
                  />
                ))}
              </Section>
            )}

            {results.meetings.length > 0 && (
              <Section label="Meetings" icon={<Calendar className="w-3.5 h-3.5" />}>
                {results.meetings.map(m => (
                  <ResultRow
                    key={m.id}
                    primary={m.title}
                    secondary={m.date ? new Date(m.date).toLocaleDateString("en-CA") : ""}
                    onClick={() => go(`/clients/${m.clientId}`)}
                  />
                ))}
              </Section>
            )}

            {results.policies.length > 0 && (
              <Section label="Policies" icon={<FileText className="w-3.5 h-3.5" />}>
                {results.policies.map(p => (
                  <ResultRow
                    key={p.id}
                    primary={`${p.provider} – ${p.type}`}
                    secondary={p.policyNumber}
                    onClick={() => go(`/clients/${p.clientId}`)}
                  />
                ))}
              </Section>
            )}

            {results.leads.length > 0 && (
              <Section label="Leads" icon={<TrendingUp className="w-3.5 h-3.5" />}>
                {results.leads.map(l => (
                  <ResultRow
                    key={l.id}
                    primary={`${l.firstName} ${l.lastName}`}
                    secondary={l.email || l.status}
                    onClick={() => go(`/pipeline`)}
                  />
                ))}
              </Section>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>Press <kbd className="px-1 bg-background border border-border rounded">↵</kbd> to navigate</span>
          <span><kbd className="px-1 bg-background border border-border rounded">⌘K</kbd> to open</span>
        </div>
      </div>
    </div>
  );
}

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/40">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  primary, secondary, badge, onClick
}: {
  primary: string;
  secondary?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent transition-colors text-left"
    >
      <div>
        <div className="text-sm font-medium text-foreground">{primary}</div>
        {secondary && <div className="text-xs text-muted-foreground">{secondary}</div>}
      </div>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          {badge}
        </span>
      )}
    </button>
  );
}





