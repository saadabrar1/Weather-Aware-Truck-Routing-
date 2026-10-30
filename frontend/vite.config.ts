import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the Django API runs separately; Docker sets the target to the backend service.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre alone is ~1 MB minified; the warning would fire on it whatever we do.
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    host: true,
    port: 5173,
    proxy: { "/api": apiTarget },
    // File events from a Windows/macOS host do not reach a Docker container;
    // docker-compose turns on polling so edits still hot-reload.
    watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined,
  },
});
