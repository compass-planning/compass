/**
 * toast.ts — Simple toast helper
 * Wraps the existing shadcn use-toast hook for easy use throughout the app.
 *
 * Usage:
 *   import { toast } from "../lib/toast";
 *   toast.success("Client saved");
 *   toast.error("Something went wrong");
 *   toast.info("Processing...");
 */

// We need to call useToast() from within React components.
// This module provides a singleton pattern that works outside hooks
// by storing the toast dispatch function after first mount.

let _toast: ((opts: { title?: string; description?: string; variant?: "default" | "destructive" }) => void) | null = null;

export function registerToast(fn: typeof _toast) {
  _toast = fn;
}

function show(title: string, description?: string, variant: "default" | "destructive" = "default") {
  if (_toast) {
    _toast({ title, description, variant });
  } else {
    // Fallback if toast not registered yet
    console.log(`[toast] ${title}${description ? ": " + description : ""}`);
  }
}

export const toast = {
  success: (title: string, description?: string) => show(title, description, "default"),
  error:   (title: string, description?: string) => show(title, description, "destructive"),
  info:    (title: string, description?: string) => show(title, description, "default"),
};
