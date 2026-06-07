import { useState, useEffect, useRef } from "react";
import { Search, Users, LayoutDashboard, Scale, PiggyBank, Shield, Receipt, FileText, Sparkles, Target, Brain, DollarSign, Plus } from "lucide-react";

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon?: any;
  shortcut?: string;
  group?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

function CommandItem({ action, active, onRun }: { action: CommandAction; active: boolean; onRun: () => void }) {
  const Icon = action.icon ?? Search;
  return (
    <div
      onClick={onRun}
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${active ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700"}`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-500" : "text-slate-400"}`} />
        <div>
          <p className="text-sm font-medium">{action.label}</p>
          {action.description && <p className="text-xs text-slate-400">{action.description}</p>}
        </div>
      </div>
      {action.shortcut && (
        <div className="flex gap-1">
          {action.shortcut.split(" ").map((k, i) => (
            <kbd key={i} className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{k}</kbd>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommandPalette({ open, onClose, actions }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Group and filter actions
  const filtered = query
    ? actions.filter(a =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.description?.toLowerCase().includes(query.toLowerCase())
      )
    : actions;

  const grouped = filtered.reduce<Record<string, CommandAction[]>>((acc, a) => {
    const g = a.group ?? "Actions";
    if (!acc[g]) acc[g] = [];
    acc[g].push(a);
    return acc;
  }, {});

  // Flat list for keyboard nav
  const flat = filtered;

  useEffect(() => { setIndex(0); }, [query]);
  useEffect(() => { if (open) { setQuery(""); setIndex(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "ArrowDown") { e.preventDefault(); setIndex(i => Math.min(i + 1, flat.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); if (flat[index]) { flat[index].run(); onClose(); } }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flat, index, onClose]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search or run command…"
            className="flex-1 text-sm outline-none text-slate-900 placeholder-slate-400"
          />
          <kbd className="text-[10px] font-mono bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2 px-2">
          {flat.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No commands found</p>
          ) : Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-3 py-1">{group}</p>
              {items.map(action => {
                const myIdx = flatIdx++;
                return (
                  <CommandItem
                    key={action.id}
                    action={action}
                    active={myIdx === index}
                    onRun={() => { action.run(); onClose(); }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-2 flex gap-4 text-[10px] text-slate-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> run</span>
          <span><kbd className="font-mono">ESC</kbd> close</span>
          <span className="ml-auto">⌘K to open anytime</span>
        </div>
      </div>
    </div>
  );
}
