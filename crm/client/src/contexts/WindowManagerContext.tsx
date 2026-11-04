import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface FloatingWindowState {
  id: string;
  title: string;
  component: ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  zIndex: number;
}

interface WindowManagerContextType {
  windows: FloatingWindowState[];
  openWindow: (opts: {
    id: string;
    title: string;
    component: ReactNode;
    width?: number;
    height?: number;
  }) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  updateSize: (id: string, width: number, height: number) => void;
  minimizeAll: () => void;
  restoreAll: () => void;
  closeAll: () => void;
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(
  null,
);

let nextZIndex = 1000;

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<FloatingWindowState[]>([]);

  const openWindow = useCallback(
    ({
      id,
      title,
      component,
      width = 800,
      height = 600,
    }: {
      id: string;
      title: string;
      component: ReactNode;
      width?: number;
      height?: number;
    }) => {
      setWindows((prev) => {
        const existing = prev.find((w) => w.id === id);
        if (existing) {
          nextZIndex++;
          return prev.map((w) =>
            w.id === id
              ? { ...w, title, minimized: false, zIndex: nextZIndex, component }
              : w,
          );
        }
        nextZIndex++;
        const offsetCount = prev.length % 8;
        const rawX = 100 + offsetCount * 30;
        const rawY = 80 + offsetCount * 30;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const clampedW = Math.min(width, vw - 40);
        const clampedH = Math.min(height, vh - 40);
        const x = Math.max(0, Math.min(rawX, vw - clampedW));
        const y = Math.max(0, Math.min(rawY, vh - clampedH));
        return [
          ...prev,
          {
            id,
            title,
            component,
            x,
            y,
            width: clampedW,
            height: clampedH,
            minimized: false,
            zIndex: nextZIndex,
          },
        ];
      });
    },
    [],
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
    );
  }, []);

  const restoreWindow = useCallback((id: string) => {
    nextZIndex++;
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, minimized: false, zIndex: nextZIndex } : w,
      ),
    );
  }, []);

  const bringToFront = useCallback((id: string) => {
    nextZIndex++;
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: nextZIndex } : w)),
    );
  }, []);

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, []);

  const updateSize = useCallback(
    (id: string, width: number, height: number) => {
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, width, height } : w)),
      );
    },
    [],
  );

  const minimizeAll = useCallback(() => {
    setWindows((prev) => prev.map((w) => ({ ...w, minimized: true })));
  }, []);

  const restoreAll = useCallback(() => {
    setWindows((prev) => prev.map((w) => ({ ...w, minimized: false })));
  }, []);

  const closeAll = useCallback(() => {
    setWindows([]);
  }, []);

  return (
    <WindowManagerContext.Provider
      value={{
        windows,
        openWindow,
        closeWindow,
        minimizeWindow,
        restoreWindow,
        bringToFront,
        updatePosition,
        updateSize,
        minimizeAll,
        restoreAll,
        closeAll,
      }}
    >
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext);
  if (!ctx)
    throw new Error(
      "useWindowManager must be used within WindowManagerProvider",
    );
  return ctx;
}
