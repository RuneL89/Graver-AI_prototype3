import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
        configure: (proxy, _options) => {
          proxy.on("error", (err, req, _res) => {
            console.log("[ViteProxy] error:", req.method, req.url, err.message);
          });
          proxy.on("proxyReq", (_proxyReq, req, _res) => {
            console.log("[ViteProxy] request:", req.method, req.url, "headers:", JSON.stringify(req.headers));
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log("[ViteProxy] response:", proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  resolve: {
    alias: {
      "@graver-ai/shared": path.resolve(__dirname, "../shared/dist"),
    },
  },
});
