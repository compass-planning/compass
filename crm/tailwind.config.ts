import type { Config } from "tailwindcss";

// Compass brand palette (Compass Planning / Compass CRM) — direct hex values, no CSS var resolution
const colors = {
  // Surfaces
  background: "#f1f5f9", // slate-100
  foreground: "#0f172a", // slate-900
  border: "#e2e8f0", // slate-200
  input: "#e2e8f0",
  ring: "#7c3aed", // violet-600

  // Cards
  card: {
    DEFAULT: "#f8fafc", // lightest slate
    foreground: "#0f172a",
    border: "#e2e8f0",
  },

  // Popover
  popover: {
    DEFAULT: "#ffffff",
    foreground: "#0f172a",
    border: "#e2e8f0",
  },

  // Brand — Compass violet-600 (#7c3aed)
  primary: {
    DEFAULT: "#7c3aed",
    foreground: "#ffffff",
    border: "#6d28d9",
    50: "#f5f3ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
  },

  // Secondary — Compass light violet (#a78bfa)
  secondary: {
    DEFAULT: "#a78bfa",
    foreground: "#0f172a",
    border: "#8b5cf6",
    50: "#f5f3ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
  },

  // Muted
  muted: {
    DEFAULT: "#f1f5f9",
    foreground: "#64748b",
    border: "#e2e8f0",
  },

  // Accent — Compass subtle violet-100 (hover / selected surfaces)
  accent: {
    DEFAULT: "#ede9fe",
    foreground: "#2d1b69",
    border: "#ddd6fe",
  },

  // Compass brand palette (matches Compass Planning tailwind.config.js)
  brand: {
    DEFAULT: "#2d1b69", // deep purple — sidebar / chrome
    dark: "#1e1044",
    mid: "#7c3aed",
    light: "#a78bfa",
    subtle: "#ede9fe",
  },

  // Destructive
  destructive: {
    DEFAULT: "#ef4444",
    foreground: "#ffffff",
    border: "#dc2626",
  },

  // Charts
  chart: {
    "1": "#7c3aed",
    "2": "#06b6d4",
    "3": "#10b981",
    "4": "#f59e0b",
    "5": "#ec4899",
  },

  // Sidebar (Compass deep purple)
  sidebar: {
    DEFAULT: "#2d1b69",
    foreground: "#ffffff",
    border: "#1e1044",
    ring: "#a78bfa",
    primary: {
      DEFAULT: "#7c3aed",
      foreground: "#ffffff",
    },
    accent: {
      DEFAULT: "#7c3aed",
      foreground: "#ffffff",
    },
  },
};

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors,
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        sans: ["Inter", "DM Sans", "sans-serif"],
        display: ["DM Sans", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        body: ["Inter", "DM Sans", "sans-serif"],
      },
      boxShadow: {
        sm: "0 1px 2px rgba(15,23,42,0.04)",
        DEFAULT: "0 2px 6px rgba(15,23,42,0.06)",
        md: "0 4px 12px rgba(15,23,42,0.08)",
        lg: "0 8px 24px rgba(15,23,42,0.10)",
        xl: "0 16px 40px rgba(15,23,42,0.12)",
        brand: "0 4px 14px rgba(124,58,237,0.25)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "animate-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "animate-in": "animate-in 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
