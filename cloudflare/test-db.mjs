import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function database(filename = ":memory:") {
  const db = new DatabaseSync(filename);
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  function prepare(sql) {
    return {
      bind(...args) {
        return {
          async first() {
            return db.prepare(sql).get(...args) || null;
          },
          async all() {
            return { results: db.prepare(sql).all(...args) };
          },
          async run() {
            return { meta: { changes: Number(db.prepare(sql).run(...args).changes) } };
          },
          sql,
          args,
        };
      },
      async all() {
        return { results: db.prepare(sql).all() };
      },
    };
  }
  return {
    prepare,
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const r = statements.map((s) => db.prepare(s.sql).run(...s.args));
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => db.close(),
  };
}
