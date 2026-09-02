#!/usr/bin/env node
/**
 * Copy the PGLite runtime assets next to the built server function.
 *
 * The Vercel output bundle must ship `pglite.data`, `pglite.wasm` and
 * `initdb.wasm` under `_libs/`, or the deployed server cannot boot its
 * embedded-Postgres fallback. Replaces the former `mkdir -p … && cp …` tail of
 * `npm run build`, which only ran under a POSIX shell.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(
  root,
  ".vercel",
  "output",
  "functions",
  "__server.func",
  "_libs",
);

mkdirSync(target, { recursive: true });
for (const file of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  copyFileSync(
    join(root, "node_modules", "@electric-sql", "pglite", "dist", file),
    join(target, file),
  );
}
console.log(`[copy-pglite-libs] copied 3 files into ${target}`);
