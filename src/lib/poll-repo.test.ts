import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  castVote,
  createPoll,
  readLivePoll,
  seedIfEmpty,
  type Sql,
} from "./poll-repo.ts";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/**
 * Fresh in-memory Postgres with `migrations/0002_polls.sql` applied — the same
 * schema source the app runs on, so the tests exercise real constraints
 * (`unique (poll_id, voter_key)` included), not mocks.
 */
async function makeSql(): Promise<Sql> {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(
    await readFile(join(root, "migrations", "0002_polls.sql"), "utf8"),
  );
  const run = async (text: string, params: unknown[] = []) =>
    (await pg.query(text, params)).rows;
  return { query: run } as unknown as Sql;
}

describe("poll-repo(内存 PGlite 集成)", () => {
  it("空库时 readLivePoll 返回 null", async () => {
    const sql = await makeSql();
    assert.equal(await readLivePoll(sql, "k1"), null);
  });

  it("seedIfEmpty 播种示例投票,第二次调用不重复播种", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    await seedIfEmpty(sql);

    const poll = await readLivePoll(sql, "k1");
    assert.ok(poll);
    assert.equal(poll.question, "午饭吃什么？");
    assert.deepEqual(
      poll.options.map((option) => option.label),
      ["拉面", "便当", "沙拉", "随便"],
    );
    assert.equal(poll.total, 0);
    assert.equal(poll.votedId, null);

    const rows = await sql.query<{ n: number }>(
      "select count(*)::int as n from polls",
    );
    assert.equal(rows[0].n, 1);
  });

  it("createPoll 的新投票成为最新现场投票", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const id = await createPoll(sql, "团建去哪？", ["密室逃脱", "烧烤"]);

    const poll = await readLivePoll(sql, "k1");
    assert.ok(poll);
    assert.equal(poll.id, id);
    assert.equal(poll.question, "团建去哪？");
    assert.equal(poll.options.length, 2);
  });

  it("一人一票:同一 voter_key 换选项再投,维持原票", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const initial = await readLivePoll(sql, "k1");
    assert.ok(initial);
    const noodle = initial.options[0];
    const salad = initial.options[2];

    const afterFirst = await castVote(sql, "k1", noodle.id);
    assert.equal(afterFirst.votedId, noodle.id);
    assert.equal(afterFirst.total, 1);

    const afterSecond = await castVote(sql, "k1", salad.id);
    assert.equal(afterSecond.votedId, noodle.id);
    assert.equal(afterSecond.total, 1);
    assert.equal(afterSecond.options[0].votes, 1);
    assert.equal(afterSecond.options[2].votes, 0);
  });

  it("不同 voter_key 各自计一票,未投者 votedId 为空", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const poll = await readLivePoll(sql, "k1");
    assert.ok(poll);
    const bento = poll.options[1];

    await castVote(sql, "k1", bento.id);
    await castVote(sql, "k2", bento.id);

    const after = await readLivePoll(sql, "k3");
    assert.ok(after);
    assert.equal(after.total, 2);
    assert.equal(after.options[1].votes, 2);
    assert.equal(after.votedId, null);
  });

  it("投不存在的选项报「选项不存在」", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    await assert.rejects(
      () => castVote(sql, "k1", "no-such-option"),
      /选项不存在/,
    );
  });
});
