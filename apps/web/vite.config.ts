import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webRoot, "../..");

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/v1": "http://127.0.0.1:3001" },
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    fs: {
      allow: [repoRoot],
    },
  },
  preview: {
    proxy: { "/v1": `http://127.0.0.1:${process.env.NF_TEST_API_PORT ?? "3001"}` },
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
