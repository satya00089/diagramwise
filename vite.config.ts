import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@diagramwise/simulation-core": resolve(__dirname, "packages/simulation-core/src"),
    },
  },
  base: "/",
  build: {
    outDir: "dist",
  },
  plugins: [react(), tailwindcss()],
  server: {
    // port: 5173,
    // Proxy is optional - you can use VITE_ASSESSMENT_API_URL directly
    // Uncomment below if you need CORS proxying in development
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:8000',
    //     changeOrigin: true,
    //     secure: false,
    //   }
    // }
  },
});
