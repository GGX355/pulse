import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  castVote,
  closePoll,
  createPoll,
  listPolls,
  listVoterProfiles,
  readPoll,
  seedIfEmpty,
  type Sql,
} from "./poll-repo.ts";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/**
 * Fresh in-memory Postgres with every `migrations/*.sql` applied, in name
 * order — the same schema source the app runs on, so the tests exercise real
 * constraints (`unique (poll_id, voter_key)` included), not mocks. Adding a
 * migration file updates the fixture automatically.
 */
async function makeSql(): Promise<Sql> {
  const pg = new PGlite();
  await pg.waitReady;
  const migrationsDir = join(root, "migrations");
  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    await pg.exec(await readFile(join(migrationsDir, name), "utf8"));
  }
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
    assert.equal(poll.voterNoteLabel, "");
    assert.equal(poll.maxChoices, 1);
    assert.deepEqual(poll.votedIds, []);
    assert.equal(poll.myNote, null);
    assert.deepEqual(
      poll.options.map((option) => option.notes),
      [[], [], [], []],
    );

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

  it("现场投票优先未结束的场次,而不是最新但已结束的", async () => {
    const sql = await makeSql();
    const older = await createPoll(sql, "还在投", ["甲", "乙"], "user-42");
    const newer = await createPoll(sql, "已经结束", ["丙", "丁"], "user-42");
    await closePoll(sql, newer, "user-42");

    const live = await readPoll(sql, "k1");
    assert.ok(live);
    assert.equal(live.id, older);
    assert.equal(live.closed, false);
  });

  it("一人一票:同一 voter_key 换选项再投,维持原票", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const initial = await readPoll(sql, "k1");
    assert.ok(initial);
    const noodle = initial.options[0];
    const salad = initial.options[2];

    const afterFirst = await castVote(sql, "k1", noodle.id, "张三");
    assert.equal(afterFirst.votedId, noodle.id);
    assert.equal(afterFirst.total, 1);

    const afterSecond = await castVote(sql, "k1", salad.id, "李四");
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

    await castVote(sql, "k1", bento.id, "张三");
    await castVote(sql, "k2", bento.id, "李四");

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
      () => castVote(sql, "k1", "no-such-option", "张三"),
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
    await castVote(sql, "k1", noodle.id, "张三");
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
    const old = await castVote(sql, "k1", noodle.id, "张三", seed.id);
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

    await castVote(sql, "cookie-uuid", bento.id, "甲");
    await castVote(sql, "user-42", bento.id, "乙");

    const after = await readPoll(sql, "user-42");
    assert.equal(after?.total, 2);
    assert.equal(after?.votedId, bento.id);
  });

  it("createPoll 记录发起人,播种的旧数据 creatorId 为 null", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const seed = await readPoll(sql, "k1");
    assert.ok(seed);
    assert.equal(seed.creatorId, null);

    const id = await createPoll(sql, "团建去哪？", ["密室逃脱", "烧烤"], "user-42");
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    assert.equal(poll.creatorId, "user-42");
    assert.equal(poll.closed, false);
  });

  it("closePoll:只有发起人能结束;结束后的投票不能再投、不能重复结束", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const id = await createPoll(sql, "会议定哪天？", ["周一", "周二"], "user-42");
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);

    await assert.rejects(
      () => closePoll(sql, id, "user-other"),
      /只有发起人能结束投票/,
    );

    await closePoll(sql, id, "user-42");
    const closed = await readPoll(sql, "k1", id);
    assert.ok(closed?.closed);

    await assert.rejects(
      () => castVote(sql, "k2", poll.options[0].id, "张三", id),
      /投票已结束/,
    );

    await assert.rejects(
      () => closePoll(sql, id, "user-42"),
      /投票已经结束了/,
    );
  });

  it("listPolls 带上 closed 状态", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const id = await createPoll(sql, "新投票", ["甲", "乙"], "user-42");
    await closePoll(sql, id, "user-42");

    const list = await listPolls(sql);
    assert.equal(list[0].closed, true);
    assert.equal(list[1].closed, false);
  });

  it("不要求备注时可以直接投票,多传的备注不会保存", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const poll = await readPoll(sql, "k1");
    assert.ok(poll);
    const noodle = poll.options[0];

    const after = await castVote(sql, "k1", noodle.id, "");
    assert.equal(after.votedId, noodle.id);
    assert.equal(after.total, 1);
    assert.equal(after.myNote, null);
    assert.deepEqual(after.options[0].notes, []);

    const ignored = await castVote(sql, "k2", noodle.id, "张三");
    assert.equal(ignored.total, 2);
    assert.deepEqual(ignored.options[0].notes, []);
  });

  it("缺备注或纯空格不能投票,票数不变", async () => {
    const sql = await makeSql();
    const id = await createPoll(
      sql,
      "午饭吃什么？",
      ["拉面", "便当", "沙拉", "随便"],
      null,
      "名字",
    );
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    const noodle = poll.options[0];

    await assert.rejects(
      () => castVote(sql, "k1", noodle.id, "", id),
      /请先填写名字/,
    );
    await assert.rejects(
      () => castVote(sql, "k1", noodle.id, "   ", id),
      /请先填写名字/,
    );

    const after = await readPoll(sql, "k1", id);
    assert.equal(after?.total, 0);
    assert.equal(after?.votedId, null);
  });

  it("带备注投票后写在该选项下,别人看得到文本但看不到 voter_key", async () => {
    const sql = await makeSql();
    const id = await createPoll(
      sql,
      "午饭吃什么？",
      ["拉面", "便当"],
      null,
      "名字",
    );
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    const noodle = poll.options[0];
    const bento = poll.options[1];

    const mine = await castVote(sql, "k1", noodle.id, "  张三  ", id);
    assert.equal(mine.myNote, "张三");
    assert.deepEqual(mine.options[0].notes, ["张三"]);
    assert.deepEqual(mine.options[1].notes, []);

    await castVote(sql, "k2", noodle.id, "李四", id);
    await castVote(sql, "k3", bento.id, "王五", id);

    const other = await readPoll(sql, "k4", id);
    assert.ok(other);
    assert.equal(other.myNote, null);
    assert.equal(other.votedId, null);
    assert.deepEqual(other.options[0].notes, ["张三", "李四"]);
    assert.deepEqual(other.options[1].notes, ["王五"]);
    assert.equal(JSON.stringify(other).includes("k1"), false);
  });

  it("同一 voter_key 再投时选项和备注都不改", async () => {
    const sql = await makeSql();
    const id = await createPoll(
      sql,
      "午饭吃什么？",
      ["拉面", "便当", "沙拉"],
      null,
      "名字",
    );
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    const noodle = poll.options[0];
    const salad = poll.options[2];

    await castVote(sql, "k1", noodle.id, "张三", id);
    const again = await castVote(sql, "k1", salad.id, "李四", id);
    assert.equal(again.votedId, noodle.id);
    assert.equal(again.myNote, "张三");
    assert.deepEqual(again.options[0].notes, ["张三"]);
    assert.deepEqual(again.options[2].notes, []);
  });

  it("createPoll 自定义备注标题会写进 voterNoteLabel", async () => {
    const sql = await makeSql();
    const id = await createPoll(
      sql,
      "今晚在哪集合？",
      ["东门", "西门"],
      "user-42",
      "地点",
    );
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    assert.equal(poll.voterNoteLabel, "地点");

    await assert.rejects(
      () => castVote(sql, "k1", poll.options[0].id, "  ", id),
      /请先填写地点/,
    );
  });

  it("结束后带备注也不能再投", async () => {
    const sql = await makeSql();
    const id = await createPoll(sql, "会议定哪天？", ["周一", "周二"], "user-42");
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    await closePoll(sql, id, "user-42");
    await assert.rejects(
      () => castVote(sql, "k2", poll.options[0].id, "张三", id),
      /投票已结束/,
    );
  });

  it("有限多选:可以只选一项,也可以选满上限,超过则拒绝", async () => {
    const sql = await makeSql();
    const id = await createPoll(
      sql,
      "团建去哪？",
      ["密室逃脱", "烧烤", "爬山", "看电影"],
      "user-42",
      "",
      2,
    );
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    assert.equal(poll.maxChoices, 2);
    const [a, b, c] = poll.options;

    const one = await castVote(sql, "k1", [a.id], "", id);
    assert.deepEqual(one.votedIds, [a.id]);
    assert.equal(one.total, 1);
    assert.equal(one.options[0].votes, 1);

    const two = await castVote(sql, "k2", [a.id, b.id], "", id);
    assert.deepEqual(two.votedIds, [a.id, b.id]);
    assert.equal(two.total, 3);

    await assert.rejects(
      () => castVote(sql, "k3", [a.id, b.id, c.id], "", id),
      /最多选 2 项/,
    );
    const after = await readPoll(sql, "k3", id);
    assert.equal(after?.total, 3);
    assert.deepEqual(after?.votedIds, []);
  });

  it("不限多选:可以选全部选项;空选拒绝;已投不能再加", async () => {
    const sql = await makeSql();
    const id = await createPoll(sql, "想吃什么？", ["拉面", "便当", "沙拉"], null, "", 0);
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    assert.equal(poll.maxChoices, 0);
    const ids = poll.options.map((row) => row.id);

    await assert.rejects(() => castVote(sql, "k1", [], "", id), /请至少选一项/);

    const all = await castVote(sql, "k1", ids, "", id);
    assert.deepEqual(all.votedIds, ids);
    assert.equal(all.total, 3);

    const again = await castVote(sql, "k1", [ids[0]], "", id);
    assert.deepEqual(again.votedIds, ids);
    assert.equal(again.total, 3);
  });

  it("填空选项:选中后必须写内容,文本出现在该选项下", async () => {
    const sql = await makeSql();
    const id = await createPoll(
      sql,
      "午饭吃什么？",
      ["拉面", "便当"],
      null,
      "",
      1,
      "其他",
    );
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    assert.equal(poll.options.length, 3);
    const fill = poll.options[2];
    assert.equal(fill.label, "其他");
    assert.equal(fill.isWriteIn, true);
    assert.equal(poll.options[0].isWriteIn, false);

    await assert.rejects(
      () => castVote(sql, "k1", fill.id, "", id, "  "),
      /请填写自己的选项/,
    );

    const mine = await castVote(sql, "k1", fill.id, "", id, "  火锅  ");
    assert.equal(mine.myWriteIn, "火锅");
    assert.deepEqual(mine.options[2].writeIns, ["火锅"]);
    assert.deepEqual(mine.options[0].writeIns, []);
    assert.equal(mine.total, 1);
  });

  it("多选可以把普通选项和填空一起投", async () => {
    const sql = await makeSql();
    const id = await createPoll(
      sql,
      "想吃什么？",
      ["拉面", "便当"],
      null,
      "",
      2,
      "其他",
    );
    const poll = await readPoll(sql, "k1", id);
    assert.ok(poll);
    const a = poll.options[0];
    const fill = poll.options[2];

    const mine = await castVote(sql, "k1", [a.id, fill.id], "", id, "麻辣烫");
    assert.deepEqual(mine.votedIds, [a.id, fill.id]);
    assert.equal(mine.total, 2);
    assert.equal(mine.options[0].votes, 1);
    assert.equal(mine.options[2].votes, 1);
    assert.deepEqual(mine.options[2].writeIns, ["麻辣烫"]);
    assert.deepEqual(mine.options[0].writeIns, []);
    assert.equal(mine.myWriteIn, "麻辣烫");
  });

  it("带名字投票才写入后台档案,无备注不入档", async () => {
    const sql = await makeSql();
    await seedIfEmpty(sql);
    const seed = await readPoll(sql, "k1");
    assert.ok(seed);
    await castVote(sql, "k1", seed.options[0].id, "");
    assert.deepEqual(await listVoterProfiles(sql), []);

    const id = await createPoll(sql, "第二轮", ["甲", "乙"], null, "名字");
    const poll = await readPoll(sql, "k2", id);
    assert.ok(poll);
    await castVote(sql, "k2", poll.options[0].id, "  张三  ", id);
    const roster = await listVoterProfiles(sql);
    assert.equal(roster.length, 1);
    assert.equal(roster[0].displayName, "张三");
    assert.equal(roster[0].pollCount, 1);
    assert.equal(JSON.stringify(roster).includes("k2"), false);
  });

  it("同一部手机改名只保留一行,票面备注仍是当场填写的", async () => {
    const sql = await makeSql();
    const first = await createPoll(sql, "第一轮", ["甲", "乙"], null, "名字");
    const a = await readPoll(sql, "phone", first);
    assert.ok(a);
    const afterFirst = await castVote(sql, "phone", a.options[0].id, "张三", first);
    assert.equal(afterFirst.myNote, "张三");

    const second = await createPoll(sql, "第二轮", ["丙", "丁"], null, "名字");
    const b = await readPoll(sql, "phone", second);
    assert.ok(b);
    const afterSecond = await castVote(sql, "phone", b.options[1].id, "李四", second);
    assert.equal(afterSecond.myNote, "李四");

    const firstAgain = await readPoll(sql, "phone", first);
    assert.equal(firstAgain?.myNote, "张三");

    const roster = await listVoterProfiles(sql);
    assert.equal(roster.length, 1);
    assert.equal(roster[0].displayName, "李四");
    assert.equal(roster[0].pollCount, 2);
  });
});
