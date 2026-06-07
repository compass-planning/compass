/**
 * client/src/components/PolicyImporter.tsx
 *
 * Excel import for client policies.
 * Parses the insurer's standard policy export format and maps to clientPolicies schema.
 * Uses SheetJS (xlsx) for client-side parsing — no file upload to server needed.
 */

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, X, Check, AlertCircle, Table } from "lucide-react";
import { api } from "../lib/api";

interface ParsedPolicy {
  policyNumber:   string;
  owner:          string;   // raw name from file
  insured:        string;   // "primary" | "spouse" | raw name
  inforceDate:    string;
  type:           string;
  productName:    string;   // original product name for reference
  coverageAmount: string;
  premium:        string;
  premiumFrequency: string;
  notes:          string;
  selected:       boolean;
  warning?:       string;
}

interface Props {
  clientId:   number;
  client?:    { firstName?: string; lastName?: string; spouseFirstName?: string | null; spouseLastName?: string | null };
  onImported: () => void;
  onClose:    () => void;
}

// ── Product name → policy type mapping ──────────────────────────────────────
function detectType(productName: string): string {
  const p = productName.toLowerCase();
  if (p.includes("term"))               return "Term Life";
  if (p.includes("whole life") || p.includes("life paid up") || p.includes("limited pay")) return "Whole Life";
  if (p.includes("universal life") || p.includes("ul "))     return "Universal Life";
  if (p.includes("disability") || p.includes(" di ") || p.includes("di-")) return "Disability (DI)";
  if (p.includes("critical illness") || p.includes(" ci "))  return "Critical Illness";
  if (p.includes("long-term care") || p.includes("ltc"))     return "Long-Term Care (LTC)";
  return "Other";
}

// ── Detect owner relative to client ─────────────────────────────────────────
function detectInsured(rawName: string, client?: Props["client"]): "primary" | "spouse" | string {
  if (!rawName) return "primary";
  const raw = rawName.toLowerCase().trim();
  const primFirst = (client?.firstName ?? "").toLowerCase();
  const primLast  = (client?.lastName  ?? "").toLowerCase();
  const spFirst   = (client?.spouseFirstName ?? "").toLowerCase();
  const spLast    = (client?.spouseLastName  ?? "").toLowerCase();

  if (primFirst && raw.includes(primFirst)) return "primary";
  if (primLast  && raw.includes(primLast))  return "primary";
  if (spFirst   && raw.includes(spFirst))   return "spouse";
  if (spLast    && raw.includes(spLast))    return "spouse";
  return "primary"; // default
}

// ── Format a date value from Excel ──────────────────────────────────────────
function formatDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(val).trim();
  // Try ISO-ish
  const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  return s;
}

// ── Parse rows from worksheet ────────────────────────────────────────────────
function parseSheet(ws: XLSX.WorkSheet, client?: Props["client"]): ParsedPolicy[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find the header row (contains "Policy #" or "Policy Number")
  let headerIdx = -1;
  const colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i].map((c: any) => String(c).toLowerCase().trim());
    if (row.some(c => c.includes("policy #") || c.includes("policy number") || c.includes("policy no"))) {
      headerIdx = i;
      row.forEach((cell, j) => { colMap[cell] = j; });
      break;
    }
  }

  if (headerIdx === -1) return [];

  // Column index resolvers
  const col = (keywords: string[]): number => {
    for (const kw of keywords) {
      for (const [key, idx] of Object.entries(colMap)) {
        if (key.includes(kw)) return idx;
      }
    }
    return -1;
  };

  const iPolicy   = col(["policy #", "policy number", "policy no"]);
  const iOwner    = col(["owner"]);
  const iInsured  = col(["primary insured", "insured", "life insured"]);
  const iDate     = col(["issue date", "inforce date", "effective date"]);
  const iProduct  = col(["product name", "product", "plan name", "plan"]);
  const iFace     = col(["basic face", "face amount", "coverage", "sum insured", "benefit amount"]);
  const iPremium  = col(["premium"]);
  const iClass    = col(["underwriting class", "risk class", "rating"]);
  const iCsv      = col(["csv", "cash surrender", "cash value"]);
  const iLoan     = col(["loan", "anniv. loan"]);

  const policies: ParsedPolicy[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const policyNum = String(row[iPolicy] ?? "").trim();
    if (!policyNum) continue; // skip empty rows

    const rawOwner   = String(row[iOwner]   ?? "").trim();
    const rawInsured = String(row[iInsured] ?? row[iOwner] ?? "").trim();
    const productName = String(row[iProduct] ?? "").trim();
    const faceAmt     = String(row[iFace]    ?? "").trim();
    const prem        = String(row[iPremium] ?? "").trim();
    const uwClass     = String(row[iClass]   ?? "").trim();
    const csv         = String(row[iCsv]     ?? "").trim();
    const loan        = String(row[iLoan]    ?? "").trim();

    const notesParts = [
      uwClass ? `Rating: ${uwClass}` : "",
      csv     ? `CSV: $${Number(csv).toLocaleString("en-CA", { maximumFractionDigits: 2 })}` : "",
      loan    ? `Anniv. Loan: $${Number(loan).toLocaleString("en-CA", { maximumFractionDigits: 2 })}` : "",
    ].filter(Boolean);

    policies.push({
      policyNumber:    policyNum,
      owner:           rawOwner,
      insured:         detectInsured(rawInsured || rawOwner, client),
      inforceDate:     formatDate(row[iDate]),
      type:            detectType(productName),
      productName,
      coverageAmount:  faceAmt ? String(parseFloat(faceAmt.replace(/[,$]/g, ""))) : "",
      premium:         prem    ? String(parseFloat(prem.replace(/[,$]/g, "")))    : "",
      premiumFrequency: "Monthly",
      notes:           notesParts.join(" · "),
      selected:        true,
    });
  }

  return policies;
}

// ── Component ────────────────────────────────────────────────────────────────
export function PolicyImporter({ clientId, client, onImported, onClose }: Props) {
  const [step, setStep]         = useState<"upload" | "preview" | "saving" | "done">("upload");
  const [policies, setPolicies] = useState<ParsedPolicy[]>([]);
  const [error, setError]       = useState("");
  const [saved, setSaved]       = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError("");
    if (!file.name.match(/\.(xlsx|xls|xlsm|csv)$/i)) {
      setError("Please upload an Excel file (.xlsx, .xls) or CSV.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array", cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseSheet(ws, client);
        if (!parsed.length) {
          setError("No policies found. Make sure the file has a header row with 'Policy #', 'Product Name', 'Basic Face Amount', and 'Premium' columns.");
          return;
        }
        setPolicies(parsed);
        setStep("preview");
      } catch (err: any) {
        setError("Failed to parse file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function importSelected() {
    const selected = policies.filter(p => p.selected);
    if (!selected.length) return;
    setStep("saving");
    let count = 0;
    for (const p of selected) {
      try {
        await api.post(`/api/clients/${clientId}/policies`, {
          type:             p.type,
          policyNumber:     p.policyNumber,
          provider:         "",
          insured:          p.insured,
          coverageAmount:   p.coverageAmount || null,
          premium:          p.premium || null,
          premiumFrequency: p.premiumFrequency,
          inforceDate:      p.inforceDate,
          renewalDate:      "",
          beneficiary:      "",
          notes:            [p.productName, p.notes].filter(Boolean).join(" — "),
        });
        count++;
      } catch { /* individual failures don't stop the batch */ }
    }
    setSaved(count);
    setStep("done");
    onImported();
  }

  const selectedCount = policies.filter(p => p.selected).length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Table className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Import Policies from Excel</h2>
              <p className="text-xs text-slate-400">Supports standard insurer policy export format</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP: Upload */}
          {step === "upload" && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
              >
                <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700 mb-1">Drop your Excel file here</p>
                <p className="text-xs text-slate-400 mb-4">or click to browse — .xlsx, .xls supported</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 px-4 py-2 rounded-lg">
                  <Upload className="w-3.5 h-3.5" /> Choose File
                </span>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

              {error && (
                <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="mt-6 bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">Expected columns:</p>
                <div className="flex flex-wrap gap-2">
                  {["Policy #","Owner","Primary Insured","Issue Date","Product Name","Basic Face Amount","Underwriting Class","Premium","CSV","Anniv. Loan"].map(c => (
                    <span key={c} className="text-[11px] bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-500">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP: Preview */}
          {step === "preview" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600">
                  Found <strong>{policies.length}</strong> {policies.length === 1 ? "policy" : "policies"}.
                  Select which to import.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPolicies(p => p.map(x => ({ ...x, selected: true })))}
                    className="text-xs text-blue-600 hover:underline">Select all</button>
                  <span className="text-slate-300">·</span>
                  <button onClick={() => setPolicies(p => p.map(x => ({ ...x, selected: false })))}
                    className="text-xs text-slate-400 hover:underline">Deselect all</button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="w-8 px-3 py-2.5"></th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">Policy #</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">Type</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">Insured</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">Coverage</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">Premium/mo</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">Inforce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {policies.map((p, i) => (
                      <tr key={i} className={`hover:bg-slate-50 transition-colors ${!p.selected ? "opacity-40" : ""}`}>
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={p.selected}
                            onChange={e => setPolicies(prev => prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                            className="w-4 h-4 rounded accent-blue-600" />
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{p.policyNumber}</td>
                        <td className="px-3 py-3">
                          <select value={p.type}
                            onChange={e => setPolicies(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                            className="border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-blue-400">
                            {["Term Life","Whole Life","Universal Life","Disability (DI)","Critical Illness","Long-Term Care (LTC)","Other"].map(t => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <select value={p.insured}
                            onChange={e => setPolicies(prev => prev.map((x, j) => j === i ? { ...x, insured: e.target.value } : x))}
                            className="border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-blue-400">
                            <option value="primary">Primary</option>
                            <option value="spouse">Spouse</option>
                            <option value="joint">Joint</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-slate-800">
                          {p.coverageAmount ? "$" + Number(p.coverageAmount).toLocaleString("en-CA", { maximumFractionDigits: 0 }) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-slate-600">
                          {p.premium ? "$" + Number(p.premium).toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">{p.inforceDate || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {policies.some(p => p.warning) && (
                <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Some policies may need manual review — check type and insured assignments above.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP: Done */}
          {step === "done" && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-slate-900 mb-1">Import Complete</p>
              <p className="text-sm text-slate-500">{saved} {saved === 1 ? "policy" : "policies"} added successfully.</p>
            </div>
          )}

        </div>

        {/* Footer */}
        {(step === "preview" || step === "saving") && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <button onClick={() => setStep("upload")} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
              ← Back
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{selectedCount} selected</span>
              <button
                onClick={importSelected}
                disabled={!selectedCount || step === "saving"}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {step === "saving" ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Import {selectedCount} {selectedCount === 1 ? "Policy" : "Policies"}</>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
            <button onClick={onClose} className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
