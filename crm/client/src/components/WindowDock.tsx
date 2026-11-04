import { useWindowManager } from "@/contexts/WindowManagerContext";
import {
  Layers,
  Minimize2,
  Maximize2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

export function WindowDock() {
  const {
    windows,
    restoreWindow,
    minimizeWindow,
    closeWindow,
    minimizeAll,
    restoreAll,
    closeAll,
  } = useWindowManager();
  const [expanded, setExpanded] = useState(false);

  if (windows.length === 0) return null;

  const minimizedCount = windows.filter((w) => w.minimized).length;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2"
      data-testid="window-dock"
    >
      {expanded && (
        <div className="bg-white rounded-2xl shadow-2xl border border-border/80 p-3 space-y-2 min-w-[240px] animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-border">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Open Windows
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={minimizeAll}
                data-testid="button-minimize-all"
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Minimize all"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={restoreAll}
                data-testid="button-restore-all"
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Restore all"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={closeAll}
                data-testid="button-close-all"
                className="p-1 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                title="Close all"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {windows.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group"
              data-testid={`dock-item-${w.id}`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground truncate flex-1">
                {w.title}
              </span>
              {w.minimized ? (
                <button
                  onClick={() => restoreWindow(w.id)}
                  data-testid={`button-dock-restore-${w.id}`}
                  className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  title="Restore"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={() => minimizeWindow(w.id)}
                  data-testid={`button-dock-minimize-${w.id}`}
                  className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  title="Minimize"
                >
                  <Minimize2 className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => closeWindow(w.id)}
                data-testid={`button-dock-close-${w.id}`}
                className="p-1 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Close"
              >
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        data-testid="button-window-dock-toggle"
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
      >
        <Layers className="w-4 h-4" />
        <span className="text-sm font-semibold">
          {windows.length} window{windows.length !== 1 ? "s" : ""}
          {minimizedCount > 0 && ` (${minimizedCount} min)`}
        </span>
      </button>
    </div>
  );
}
