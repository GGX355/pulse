import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  createDraw,
  drawAdminStats,
  drawClaimList,
  drawOne,
  drawToView,
  listDraws,
  readDrawById,
  type Sql,
} from "./draw-repo.ts";
import { closePoll } from "./poll-repo.ts";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/**
 * Fresh in-memory Postgres with every `migrations/*.sql` applied, in name
 * order — same fixture as poll-repo.test.ts; 0004_draws.sql arrives through
 * the directory scan automatically.
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

const A_B_BLANK = {
  title: "团建抽奖",
  slots: [
    { label: "一等奖", count: 1 },
    { label: "二等奖", count: 2 },
  ],
  blankLabel: "谢谢参与",
  blankCount: 2,
};

describe("draw-repo(内存 PGlite 集成)", () => {
  it("createDraw 落库,签位数量与未中数量正确", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", A_B_BLANK);

    const draw = await readDrawById(sql, "k1", id);
    assert.ok(draw);
    assert.equal(draw.title, "团建抽奖");
    assert.equal(draw.creatorId, "user-42");
    assert.equal(draw.closed, false);
    assert.equal(draw.allTaken, false);
    assert.equal(draw.myDraw, null);
    assert.equal(draw.totalTaken, 0);
    assert.deepEqual(
      draw.slots.map((slot) => [slot.label, slot.count, slot.taken]),
      [
        ["一等奖", 1, 0],
        ["二等奖", 2, 0],
        ["谢谢参与", 2, 0],
      ],
    );
  });

  it("抽完即止:签发完后 allTaken,再来人报「已经抽完了」", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", A_B_BLANK);

    for (const key of ["k1", "k2", "k3", "k4", "k5"]) {
      const state = await drawOne(sql, key, id);
      assert.ok(state.myDraw);
      assert.equal(state.totalTaken, Number(key.slice(1)));
    }

    const final = await readDrawById(sql, "k6", id);
    assert.ok(final);
    assert.equal(final.allTaken, true);
    assert.deepEqual(
      final.slots.map((slot) => [slot.label, slot.taken]),
      [
        ["一等奖", 1],
        ["二等奖", 2],
        ["谢谢参与", 2],
      ],
    );

    await assert.rejects(() => drawOne(sql, "k6", id), /已经抽完了/);
  });

  it("同一人重复抽:返回已有结果,不消耗新签", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", A_B_BLANK);

    const first = await drawOne(sql, "k1", id);
    assert.ok(first.myDraw);

    const again = await drawOne(sql, "k1", id);
    assert.deepEqual(again.myDraw, first.myDraw);
    assert.equal(again.totalTaken, 1);
  });

  it("并发抢最后一个签不超发:已被占用的签不会被抽到", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", {
      title: "一个签",
      slots: [{ label: "大奖", count: 1 }],
      blankLabel: "未中",
      blankCount: 5,
    });

    // 模拟并发:大奖的签位先被别人抢走(计数器置满,但没有对应 poll_votes)
    await sql.query(
      `update poll_options set taken = 1 where poll_id = $1 and label = '大奖'`,
      [id],
    );

    const state = await drawOne(sql, "k1", id);
    assert.ok(state.myDraw);
    assert.equal(state.myDraw.label, "未中");
    const draw = await readDrawById(sql, "k1", id);
    assert.ok(draw);
    assert.equal(draw.slots.find((slot) => slot.label === "大奖")?.taken, 1);
  });

  it("不限量未中永远不会抽完,有限签永不超发", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", {
      title: "人人有奖",
      slots: [{ label: "参与奖", count: 2 }],
      blankLabel: "谢谢参与",
      blankCount: null,
    });

    // 有限签直接置满(等价于已被抽走)— 之后的每一次抽取都必须落到不限量兜底,
    // 断言与随机分布无关,纯确定性。
    await sql.query(
      `update poll_options set taken = 2 where poll_id = $1 and label = '参与奖'`,
      [id],
    );

    for (const key of ["k1", "k2", "k3"]) {
      const state = await drawOne(sql, key, id);
      assert.equal(state.myDraw?.label, "谢谢参与");
    }

    const draw = await readDrawById(sql, "k4", id);
    assert.ok(draw);
    assert.equal(draw.allTaken, false);
    assert.equal(draw.totalTaken, 5); // 预置的 2 张参与奖 + 3 次兜底抽取
    assert.equal(draw.slots.find((slot) => slot.label === "参与奖")?.taken, 2);
    await drawOne(sql, "k4", id); // 不限量,第 4 人照样能抽
  });

  it("已结束的抽签不能抽;发起人可提前结束(复用 closePoll)", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", A_B_BLANK);

    await closePoll(sql, id, "user-42");
    await assert.rejects(() => drawOne(sql, "k1", id), /抽签已结束/);

    const draw = await readDrawById(sql, "k1", id);
    assert.ok(draw?.closed);
  });

  it("不设未中:抽完即止", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", {
      title: "只有奖",
      slots: [{ label: "奖品", count: 1 }],
      blankLabel: null,
      blankCount: null,
    });

    const winner = await drawOne(sql, "k1", id);
    assert.equal(winner.myDraw?.label, "奖品");
    await assert.rejects(() => drawOne(sql, "k2", id), /已经抽完了/);
  });

  it("兑奖名单:发起人可见、按时间排序、身份打码;别人看被拒", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", A_B_BLANK);
    await drawOne(sql, "voter-key-aaaaaaaa", id);
    await drawOne(sql, "voter-key-bbbbbbbb", id);

    const claims = await drawClaimList(sql, id, "user-42");
    assert.equal(claims.length, 2);
    assert.ok(claims[0].drewAtMs <= claims[1].drewAtMs);
    for (const claim of claims) {
      assert.equal(claim.voterMasked.length, 7); // 6 字符 + 省略号
      assert.ok(!claim.voterMasked.includes("voter-key"));
    }

    await assert.rejects(
      () => drawClaimList(sql, id, "user-other"),
      /只有发起人能看兑奖名单/,
    );
  });

  it("投票类型的记录不会被误读为抽签", async () => {
    const sql = await makeSql();
    const { createPoll } = await import("./poll-repo.ts");
    const pollId = await createPoll(sql, "午饭吃什么？", ["拉面", "便当"]);
    assert.equal(await readDrawById(sql, "k1", pollId), null);
    await assert.rejects(() => drawOne(sql, "k1", pollId), /没有这个抽签/);
  });

  it("盲选视图:没抽之前只有签位名字,没有任何数字", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", A_B_BLANK);

    const blind = drawToView((await readDrawById(sql, "k1", id))!);
    assert.equal(blind.blind, true);
    assert.equal(blind.myDraw, null);
    assert.equal(blind.totalTaken, null);
    assert.deepEqual(
      blind.slots.map((slot) => ({ label: slot.label, secret: "count" in slot })),
      [
        { label: "一等奖", secret: false },
        { label: "二等奖", secret: false },
        { label: "谢谢参与", secret: false },
      ],
    );

    // 别人抽了之后,未抽的人依然盲。
    await drawOne(sql, "k1", id);
    const stillBlind = drawToView((await readDrawById(sql, "k2", id))!);
    assert.equal(stillBlind.blind, true);
    assert.equal(stillBlind.totalTaken, null);
  });

  it("盲选揭示:自己抽完立刻看到全量;结束后对所有人公开", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", A_B_BLANK);

    await drawOne(sql, "k1", id);
    const revealed = drawToView((await readDrawById(sql, "k1", id))!);
    if (revealed.blind) throw new Error("抽完之后应当是揭示视图");
    assert.ok(revealed.myDraw);
    assert.equal(revealed.totalTaken, 1);
    for (const slot of revealed.slots) {
      assert.equal(typeof slot.count, "number");
      assert.equal(typeof slot.taken, "number");
    }

    await closePoll(sql, id, "user-42");
    const closedForOther = drawToView((await readDrawById(sql, "k9", id))!);
    if (closedForOther.blind) throw new Error("结束后应当是揭示视图");
    assert.equal(closedForOther.closed, true);
    assert.equal(closedForOther.totalTaken, 1);
  });

  it("抽签列表:进行中不显示人数,结束后才公开", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", A_B_BLANK);
    await drawOne(sql, "k1", id);

    const open = await listDraws(sql);
    const openRow = open.find((row) => row.id === id);
    assert.ok(openRow);
    assert.equal(openRow.total, null);

    await closePoll(sql, id, "user-42");
    const closed = await listDraws(sql);
    const closedRow = closed.find((row) => row.id === id);
    assert.ok(closedRow);
    assert.equal(closedRow.total, 1);
  });

  it("后台统计:发起人可见全量,别人被拒,投票类型被拒", async () => {
    const sql = await makeSql();
    const id = await createDraw(sql, "user-42", A_B_BLANK);
    await drawOne(sql, "voter-key-aaaaaaaa", id);

    const stats = await drawAdminStats(sql, id, "user-42");
    assert.equal(stats.totalTaken, 1);
    assert.equal(stats.claims.length, 1);
    assert.equal(stats.slots.length, 3);

    await assert.rejects(
      () => drawAdminStats(sql, id, "user-other"),
      /只有发起人能看后台数据/,
    );

    const { createPoll } = await import("./poll-repo.ts");
    const pollId = await createPoll(sql, "午饭吃什么？", ["拉面", "便当"]);
    await assert.rejects(() => drawAdminStats(sql, pollId, "user-42"), /没有这个抽签/);
  });
});
