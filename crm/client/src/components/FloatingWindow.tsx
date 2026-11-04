import { useRef, useCallback, useState, useEffect } from "react";
import { X, Minus, ExternalLink } from "lucide-react";
import type { FloatingWindowState } from "@/contexts/WindowManagerContext";
import { useWindowManager } from "@/contexts/WindowManagerContext";

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const TITLE_BAR_HEIGHT = 48;

function clampPosition(x: number, y: number, w: number, _h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampedX = Math.max(-w + 100, Math.min(x, vw - 100));
  const clampedY = Math.max(0, Math.min(y, vh - TITLE_BAR_HEIGHT));
  return { x: clampedX, y: clampedY };
}

function clampSize(x: number, y: number, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.max(MIN_WIDTH, vw - x);
  const maxH = Math.max(MIN_HEIGHT, vh - y);
  return {
    w: Math.min(Math.max(MIN_WIDTH, w), maxW),
    h: Math.min(Math.max(MIN_HEIGHT, h), maxH),
  };
}

export function FloatingWindow({ win }: { win: FloatingWindowState }) {
  const { closeWindow, minimizeWindow, bringToFront, updatePosition, updateSize } = useWindowManager();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleGlobalPointerUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, [isDragging, isResizing]);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-window-control]")) return;
    e.preventDefault();
    bringToFront(win.id);
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - win.x,
      y: e.clientY - win.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [win.id, win.x, win.y, bringToFront]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const rawX = e.clientX - dragOffset.current.x;
    const rawY = e.clientY - dragOffset.current.y;
    const { x: clampedX, y: clampedY } = clampPosition(rawX, rawY, win.width, win.height);
    updatePosition(win.id, clampedX, clampedY);
  }, [isDragging, win.id, win.width, win.height, updatePosition]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(win.id);
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: win.width, h: win.height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [win.id, win.width, win.height, bringToFront]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing) return;
    e.preventDefault();
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    const rawW = resizeStart.current.w + dx;
    const rawH = resizeStart.current.h + dy;
    const { w: clampedW, h: clampedH } = clampSize(win.x, win.y, rawW, rawH);
    updateSize(win.id, clampedW, clampedH);
  }, [isResizing, win.id, win.x, win.y, updateSize]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  if (win.minimized) return null;

  return (
    <div
      ref={containerRef}
      className="fixed bg-white rounded-2xl shadow-2xl border border-border/80 overflow-hidden flex flex-col"
      style={{
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
      }}
      onPointerDown={() => bringToFront(win.id)}
      data-testid={`floating-window-${win.id}`}
    >
      <div
        className="h-12 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground flex items-center justify-between px-4 select-none flex-shrink-0"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        data-testid={`floating-window-titlebar-${win.id}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-70" />
          <span className="text-sm font-semibold truncate">{win.title}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            data-window-control
            onClick={() => minimizeWindow(win.id)}
            data-testid={`button-minimize-window-${win.id}`}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            data-window-control
            onClick={() => closeWindow(win.id)}
            data-testid={`button-close-window-${win.id}`}
            className="p-1.5 rounded-lg hover:bg-red-500/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 relative">
        {win.component}
      </div>

      <div
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10"
        style={{
          background: "linear-gradient(135deg, transparent 50%, hsl(var(--primary) / 0.3) 50%)",
          borderRadius: "0 0 16px 0",
        }}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        data-testid={`resize-handle-${win.id}`}
      />
    </div>
  );
}
