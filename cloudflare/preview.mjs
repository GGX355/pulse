// Local QA only: synthetic password and in-memory records, never deployed.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pbkdf2Sync } from "node:crypto";
import worker from "./worker.js";
import { database } from "./test-db.mjs";
const root = resolve("artifacts/cloudflare-dist");
const env = {
  DB: database(),
  ADMIN_PASSWORD_HASH:
    "qa:" + pbkdf2Sync("test-only-pulse", "qa", 100000, 32, "sha256").toString("hex"),
  ASSETS: {
    async fetch(request) {
      const name = decodeURIComponent(new URL(request.url).pathname),
        file = resolve(root, "." + (name === "/" ? "/index.html" : name));
      if (!file.startsWith(root + "\\") && !file.startsWith(root + "/"))
        return new Response("", { status: 403 });
      try {
        return new Response(await readFile(file), {
          headers: {
            "Content-Type":
              {
                ".html": "text/html",
                ".js": "application/javascript",
                ".css": "text/css",
                ".svg": "image/svg+xml",
                ".woff2": "font/woff2",
              }[extname(file)] || "application/octet-stream",
          },
        });
      } catch {
        return new Response("", { status: 404 });
      }
    },
  },
};
http
  .createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const response = await worker.fetch(
        new Request("http://" + req.headers.host + req.url, {
          method: req.method,
          headers: req.headers,
          ...(req.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
        }),
        env,
      );
      res.writeHead(response.status, {
        ...Object.fromEntries(response.headers),
        "set-cookie": response.headers.getSetCookie(),
      });
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500);
      res.end("Preview error");
    }
  })
  .listen(8096, "127.0.0.1", () => console.log("Cloudflare application QA available on 8096"));
