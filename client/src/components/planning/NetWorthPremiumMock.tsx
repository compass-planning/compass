import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Check } from "lucide-react";

type Entry = {
  id?: number;
  type: "asset" | "liability";
  name: string;
  category: string;
  value: string;
};

export function NetWorthPremiumMock({
  entries = [],
  onDelete,
  onAdd,
  onUpdate,
}: {
  entries: Entry[];
  onDelete?: (id: number) => void;
  onAdd?: () => void;
  onUpdate?: (id: number, value: string) => void;
}) {

  const assets = entries.filter(e => e.type === "asset");
  const liabilities = entries.filter(e => e.type === "liability");

  const totalAssets = assets.reduce((s, e) => s + parseFloat(e.value || "0"), 0);
  const totalLiabilities = liabilities.reduce((s, e) => s + parseFloat(e.value || "0"), 0);
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="p-6 space-y-6 bg-slate-50 animate-in fade-in duration-300">

      {/* SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card label="Total Assets" value={totalAssets} color="emerald" />
        <Card label="Total Liabilities" value={totalLiabilities} color="red" />
        <Card label="Net Worth" value={netWorth} color="slate" />
      </div>

      {/* LIST */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <p className="text-sm font-medium text-slate-600">Assets & Liabilities</p>
          {onAdd && (
            <button
              onClick={onAdd}
              data-testid="button-fp-add-nw"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          )}
        </div>

        <div className="divide-y">
          {entries.map((e, i) => (
            <EntryRow
              key={e.id ?? i}
              entry={e}
              onDelete={onDelete}
              onUpdate={onUpdate}
            />
          ))}
          {entries.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">No entries yet</p>
              {onAdd && (
                <button
                  onClick={onAdd}
                  className="mt-3 text-blue-600 text-sm hover:underline transition"
                >
                  Add your first asset
                </button>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function EntryRow({
  entry,
  onDelete,
  onUpdate,
}: {
  entry: Entry;
  onDelete?: (id: number) => void;
  onUpdate?: (id: number, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.value);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(entry.value); }, [entry.value, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (entry.id != null && onUpdate && draft !== entry.value && draft.trim() !== "") {
      onUpdate(entry.id, draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } else {
      setDraft(entry.value);
    }
  };

  const cancel = () => { setDraft(entry.value); setEditing(false); };

  const valueClass = entry.type === "asset" ? "text-emerald-600" : "text-red-600";

  return (
    <div className="group px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors duration-150">
      <div>
        <p className="font-medium text-slate-900">{entry.name}</p>
        <p className="text-xs text-slate-500">{entry.category}</p>
      </div>
      <div className="flex items-center gap-3">
        {editing && onUpdate && entry.id != null ? (
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onBlur={commit}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") commit();
              if (ev.key === "Escape") cancel();
            }}
            className="w-32 px-2 py-1 border border-blue-300 rounded text-right font-semibold focus:ring-2 focus:ring-blue-400 outline-none transition"
          />
        ) : (
          <button
            type="button"
            onClick={() => onUpdate && entry.id != null && setEditing(true)}
            disabled={!onUpdate || entry.id == null}
            className={`font-semibold ${valueClass} ${onUpdate && entry.id != null ? "cursor-pointer hover:underline decoration-dotted underline-offset-4" : "cursor-default"} transition`}
            title={onUpdate ? "Click to edit" : undefined}
          >
            ${Number(entry.value).toLocaleString()}
          </button>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 animate-in fade-in duration-150">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        {onDelete && entry.id != null && (
          <button
            onClick={() => onDelete(entry.id!)}
            data-testid={`button-fp-del-nw-${entry.id}`}
            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-md transition-all duration-150"
            aria-label="Delete entry"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, color }: any) {
  const colorMap: any = {
    emerald: "text-emerald-600",
    red: "text-red-600",
    slate: "text-slate-900"
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${colorMap[color]}`}>
        ${value.toLocaleString()}
      </p>
    </div>
  );
}
