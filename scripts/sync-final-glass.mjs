import { mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const source = resolve(process.argv[2] || '../liquid-glass-template/pulse-final');
const target = resolve('vendor/pulse-final');
await mkdir(target, { recursive: true });
await mkdir('public/glass-lab', { recursive: true });
const files = {};
for (const name of await readdir(source)) {
  if (!/\.(html|css|js|mjs|txt)$/.test(name)) continue;
  const bytes = await readFile(join(source, name));
  files[name] = createHash('sha256').update(bytes).digest('hex');
  await copyFile(join(source, name), join(target, name));
  if (!name.endsWith('.test.mjs')) await copyFile(join(source, name), join('public/glass-lab', name));
}
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await writeFile(join(target, 'SOURCE.json'), JSON.stringify({ repository: 'https://github.com/GGX355/liquid-glass-template', directory: 'pulse-final', source_commit: commit, files }, null, 2) + '\n');
await writeFile(join(target, 'pulse-runtime.d.ts'), 'export function mountPulse(options?: { business?: unknown }): { destroy(): void; setMode(mode: string): void };\n');
console.log(`Synced ${Object.keys(files).length} GitHub-owned frontend files with SHA-256 provenance.`);
