import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  castVote,
  createPoll,
  listPolls,
  readPoll,
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
  it("空库时 readPoll 返回 null", async () => {
    const sql = await makeSql();
    assert.equal(await readPoll(sql, "k1"), null);
  });

  it("seedIfEmpty 播种示例投票,第二次调用不重复播种", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    await seedIfEmpty(sql);

    const poll = await readPoll(sql, "k1");
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

    const poll = await readPoll(sql, "k1");
    assert.ok(poll);
    assert.equal(poll.id, id);
    assert.equal(poll.question, "团建去哪？");
    assert.equal(poll.options.length, 2);
  });

  it("一人一票:同一 voter_key 换选项再投,维持原票", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const initial = await readPoll(sql, "k1");
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
    const poll = await readPoll(sql, "k1");
    assert.ok(poll);
    const bento = poll.options[1];

    await castVote(sql, "k1", bento.id);
    await castVote(sql, "k2", bento.id);

    const after = await readPoll(sql, "k3");
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

  it("readPoll 按 id 读取指定投票,而不是最新那个", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const seed = await readPoll(sql, "k1");
    assert.ok(seed);
    // 再建一场,让 seed 不再是"最新"
    await createPoll(sql, "会议定哪天？", ["周一", "周二"]);

    const byId = await readPoll(sql, "k1", seed.id);
    assert.ok(byId);
    assert.equal(byId.id, seed.id);
    assert.equal(byId.question, "午饭吃什么？");

    const missing = await readPoll(sql, "k1", "no-such-poll");
    assert.equal(missing, null);
  });

  it("listPolls 最新在前,票数汇总正确", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const seed = await readPoll(sql, "k1");
    assert.ok(seed);
    const noodle = seed.options[0];
    await castVote(sql, "k1", noodle.id);
    await createPoll(sql, "团建去哪？", ["密室逃脱", "烧烤"]);

    const list = await listPolls(sql);
    assert.equal(list.length, 2);
    assert.equal(list[0].question, "团建去哪？");
    assert.equal(list[0].total, 0);
    assert.equal(list[1].id, seed.id);
    assert.equal(list[1].total, 1);
    assert.equal(typeof list[0].createdAtMs, "number");
  });

  it("castVote 带 pollId 时投的是指定投票,现场最新投票不受影响", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const seed = await readPoll(sql, "k1");
    assert.ok(seed);
    await createPoll(sql, "最新投票", ["甲", "乙"]);

    // 给旧投票的"拉面"投票
    const noodle = seed.options[0];
    const old = await castVote(sql, "k1", noodle.id, seed.id);
    assert.equal(old.id, seed.id);
    assert.equal(old.votedId, noodle.id);
    assert.equal(old.total, 1);

    // 最新(现场)投票一票未动
    const live = await readPoll(sql, "k1");
    assert.ok(live);
    assert.equal(live.question, "最新投票");
    assert.equal(live.total, 0);
    assert.equal(live.votedId, null);
  });

  it("cookie 与账号身份分开计票:两个 key 互不覆盖", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const seed = await readPoll(sql, "k1");
    assert.ok(seed);
    const bento = seed.options[1];

    await castVote(sql, "cookie-uuid", bento.id);
    await castVote(sql, "user-42", bento.id);

    const after = await readPoll(sql, "user-42");
    assert.equal(after?.total, 2);
    assert.equal(after?.votedId, bento.id);
  });
});
