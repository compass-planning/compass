import { useState } from "react";
import { usePlanSnapshots, useCreateSnapshot, useSnapshotComparison } from "@/hooks/use-plans";
import { Camera, Clock, FileText, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

const triggerLabels: Record<string, string> = {
  present_to_client: "Client Presentation",
  annual_review: "Annual Review",
  manual: "Manual Snapshot",
};

export function SnapshotManager({ planId }: { planId: number }) {
  const { data: snapshots = [], isLoading } = usePlanSnapshots(planId);
  const createSnapshot = useCreateSnapshot();
  const { data: comparison } = useSnapshotComparison(planId);
  const [showCreate, setShowCreate] = useState(false);
  const [trigger, setTrigger] = useState("manual");
  const [notes, setNotes] = useState("");

  const handleCreate = () => {
    createSnapshot.mutate({ planId, trigger, notes: notes || undefined }, {
      onSuccess: () => { setShowCreate(false); setNotes(""); }
    });
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading snapshots...</div>;

  return (
    <div className="space-y-4" data-testid="snapshot-manager">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold font-display">Plan Snapshots</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm font-semibold"
          data-testid="button-create-snapshot"
        >
          <Camera className="w-4 h-4" />
          Present to Client
        </button>
      </div>

      {comparison && comparison.deltas && Object.keys(comparison.deltas).length > 0 && (
        <div className="border border-blue-200 rounded-2xl p-4 bg-blue-50/50" data-testid="snapshot-comparison">
          <p className="text-sm font-semibold text-blue-700 mb-2">Changes Since Last Snapshot</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(comparison.deltas).map(([key, delta]) => {
              const d = delta as number;
              const isPositive = d > 0;
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  {d > 0 ? <TrendingUp className="w-3 h-3 text-green-600" /> :
                   d < 0 ? <TrendingDown className="w-3 h-3 text-red-600" /> :
                   <Minus className="w-3 h-3 text-muted-foreground" />}
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className={`font-semibold ${isPositive ? 'text-green-600' : d < 0 ? 'text-red-600' : ''}`}>
                    {isPositive ? '+' : ''}{typeof d === 'number' && Math.abs(d) < 1 ? `${(d * 100).toFixed(1)}%` : d}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {snapshots.length > 0 ? (
        <div className="border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map(snap => (
                <tr key={snap.id} className="border-t hover:bg-muted/30" data-testid={`snapshot-row-${snap.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {snap.createdAt ? new Date(snap.createdAt).toLocaleString() : "N/A"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {triggerLabels[snap.trigger] || snap.trigger}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{snap.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-2xl p-6 text-center text-muted-foreground" data-testid="empty-snapshots">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No snapshots yet. Create one for client presentations or annual reviews.</p>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-display font-bold mb-4">Create Plan Snapshot</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Snapshot Type</label>
                <select
                  value={trigger}
                  onChange={e => setTrigger(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border mt-1"
                  data-testid="select-snapshot-trigger"
                >
                  <option value="present_to_client">Present to Client</option>
                  <option value="annual_review">Annual Review</option>
                  <option value="manual">Manual Snapshot</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border mt-1 min-h-[80px]"
                  placeholder="Add context for this snapshot..."
                  data-testid="input-snapshot-notes"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2 rounded-xl font-semibold text-muted-foreground hover:bg-muted"
                  data-testid="button-cancel-snapshot"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createSnapshot.isPending}
                  className="px-5 py-2 rounded-xl font-semibold bg-primary text-primary-foreground disabled:opacity-50"
                  data-testid="button-submit-snapshot"
                >
                  {createSnapshot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Snapshot"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
