import { defineConfig } from "vite";
import base from "../ui-preview/vite.config.mjs";
import { fileURLToPath } from "node:url";
import { copyFileSync, writeFileSync } from "node:fs";
const path = (name) => fileURLToPath(new URL(name, import.meta.url));
export default defineConfig({
  ...base,
  define: { ...base.define, "import.meta.env.VITE_CF_APP": "true" },
  plugins: [
    {
      name: "cloudflare-routes",
      enforce: "pre",
      resolveId(source, importer) {
        if (importer?.includes("routeTree.gen") && source === "./routes/login")
          return path("./login.jsx");
      },
    },
    ...base.plugins,
    {
      name: "cloudflare-worker",
      closeBundle() {
        writeFileSync(path("../artifacts/cloudflare-dist/_routes.json"), JSON.stringify({version:1,include:["/api/pulse/*"],exclude:[]}));
        copyFileSync(path("./worker.js"), path("../artifacts/cloudflare-dist/_worker.js"));
      },
    },
  ],
  resolve: {
    alias: [
      { find: "@/lib/poll-api", replacement: path("./api.js") },
      { find: "@/lib/draw-api", replacement: path("./api.js") },
      { find: "@/lib/auth/use-current-user", replacement: path("./auth.jsx") },
      { find: "@/lib/auth/client", replacement: path("./auth.jsx") },
      { find: "@/lib/auth/gates", replacement: path("./auth.jsx") },
      ...base.resolve.alias,
    ],
  },
  server: { proxy: { "/api/pulse": { target: "http://127.0.0.1:8096", changeOrigin: false } } },
  build: { ...base.build, outDir: path("../artifacts/cloudflare-dist") },
});
