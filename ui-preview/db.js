import { PGlite } from '@electric-sql/pglite';
import wasmUrl from '../node_modules/@electric-sql/pglite/dist/pglite.wasm?url';
import dataUrl from '../node_modules/@electric-sql/pglite/dist/pglite.data?url';
import { createDraw } from '../src/lib/draw-repo';
import { createPoll } from '../src/lib/poll-repo';
const migrations = import.meta.glob('../migrations/*.sql', { query: '?raw', import: 'default', eager: true });
let ready;
export function getSql() { return ready ??= initialize(); }
async function initialize() {
  const [wasmModule, fsBundle] = await Promise.all([
    fetch(wasmUrl).then(r => r.arrayBuffer()).then(bytes => WebAssembly.compile(bytes)),
    fetch(dataUrl).then(r => r.blob()),
  ]);
  const db = new PGlite({ wasmModule, fsBundle, parsers: { 20: Number, 1082: value => value, 1186: value => value } });
  await db.waitReady;
  await db.exec('create table _migrations (name text primary key)');
  for (const [name, sql] of Object.entries(migrations).sort()) {
    if (name.includes('0001_auth')) continue;
    await db.exec(sql);
  }
  const sql = { query: async (text, params = []) => (await db.query(text, params)).rows };
  await createDraw(sql, 'preview-host', {
    title: '我的小幸运', slots: [{ label: '一份轻松', count: 3 }, { label: '一场相遇', count: 3 }, { label: '一个好消息', count: 3 }],
    blankLabel: null, blankCount: null, voterNoteLabel: '', rosterNames: [], revealModes: ['flip','scratch','grid'], description: '示例活动 · 试试三种揭晓方式', resultsPublic: false,
  });
  await createPoll(sql, '这个周末，我们去哪？', ['山野徒步', '城市漫游', '找间咖啡馆'], 'preview-host', '', 1, '', [], '示例活动 · 每一票都值得被看见', null);
  return sql;
}

