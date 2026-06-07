import { useMemo } from "react";
import { Shield, GraduationCap, Landmark } from "lucide-react";

export function EstateScorecard({ notes, province }: {
  notes: Array<{ category: string }>;
  province?: string;
}) {
  const probateFees: Record<string, { name: string; description: string }> = {
    ontario: { name: "Ontario", description: "$5 per $1K (first $50K) + $15 per $1K thereafter" },
    quebec: { name: "Quebec", description: "No probate fees (notarized wills)" },
    british_columbia: { name: "British Columbia", description: "$0-$25K: none; $25K-$50K: $6/$1K; >$50K: $14/$1K" },
    alberta: { name: "Alberta", description: "Max $525 (flat fee structure)" },
    manitoba: { name: "Manitoba", description: "$70 + $7 per $1K over $10K" },
    saskatchewan: { name: "Saskatchewan", description: "$7 per $1K of estate value" },
    nova_scotia: { name: "Nova Scotia", description: "$87.10 + $16.74 per $1K over $10K" },
    new_brunswick: { name: "New Brunswick", description: "$5 per $1K of estate value" },
    newfoundland: { name: "Newfoundland", description: "$60 per $1K on first $1K; then $6 per $1K" },
    pei: { name: "PEI", description: "$4 per $1K of estate value (approx.)" },
  };

  const hasWill        = notes.some(n => n.category === "Will");
  const hasPoa         = notes.some(n => n.category === "Power of Attorney");
  const hasTrust       = notes.some(n => n.category === "Trust");
  const hasBeneficiary = notes.some(n => n.category === "Beneficiary Designations");

  const checkItems = [
    { label: "Will",                    done: hasWill },
    { label: "Power of Attorney",       done: hasPoa },
    { label: "Trust",                   done: hasTrust },
    { label: "Beneficiary Designations",done: hasBeneficiary },
  ];

  const score = checkItems.filter(i => i.done).length;
  const scoreColor = score >= 3 ? "text-green-600" : score >= 2 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Landmark className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-bold">Estate Efficiency Scorecard</h3>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold mb-2">Estate Readiness</p>
          <p className={`text-3xl font-bold ${scoreColor}`}>{score}/{checkItems.length}</p>
          <div className="mt-3 space-y-2">
            {checkItems.map(item => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${item.done ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                  {item.done ? "✓" : "✗"}
                </span>
                <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">Probate Fee Schedule</p>
          {province && probateFees[province] ? (
            <div className="p-3 bg-muted/50 rounded-xl">
              <p className="font-semibold text-sm">{probateFees[province].name}</p>
              <p className="text-xs text-muted-foreground mt-1">{probateFees[province].description}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a province in client profile to see probate fees</p>
          )}
        </div>
      </div>
    </div>
  );
}
