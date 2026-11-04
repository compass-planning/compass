import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Compass CRM client. Served by the Compass server under /crm/ (same Fly app),
// so every asset URL is prefixed with /crm/ and the router uses base "/crm".
export default defineConfig({
  base: "/crm/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      // Run the Compass server on :8080 (npm run dev:server in the repo root).
      "/api/crm": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
});
