import { useEffect } from "react";

export function useHotkeys(map: Record<string, () => void>) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Skip when typing in an input/textarea/select/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) return;

      const key: string[] = [];
      if (e.metaKey || e.ctrlKey) key.push("mod");
      if (e.shiftKey) key.push("shift");
      if (e.altKey) key.push("alt");
      key.push(e.key.toLowerCase());

      const combo = key.join("+");
      if (map[combo]) {
        e.preventDefault();
        map[combo]();
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map]);
}
