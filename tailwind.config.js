export default {
  content: ["./client/src/**/*.{ts,tsx}", "./client/index.html"],
  theme: {
    extend: {
      colors: {
        // Compass Planning brand palette
        brand: {
          DEFAULT:  "#2d1b69",  // deep purple sidebar
          dark:     "#1e1044",  // hover / dark variant
          mid:      "#7c3aed",  // violet-600 accent
          light:    "#a78bfa",  // violet-400 (highlights)
          subtle:   "#ede9fe",  // violet-100 (backgrounds)
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["Space Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
