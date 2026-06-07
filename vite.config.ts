import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: false,
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/"))
            return "vendor-react";
          if (id.includes("node_modules/@tanstack/react-query"))
            return "vendor-query";
          if (id.includes("node_modules/recharts"))
            return "vendor-charts";
          if (id.includes("node_modules/date-fns"))
            return "vendor-date";
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});