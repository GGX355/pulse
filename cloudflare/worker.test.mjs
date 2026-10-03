import { test } from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import worker from "./worker.js";
import { database } from "./test-db.mjs";
const password = randomBytes(20).toString("hex"),
  salt = randomBytes(16).toString("hex");
const ADMIN_PASSWORD_HASH =
  salt + ":" + pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
function setup() {
  const env = { DB: database(), ADMIN_PASSWORD_HASH };
  function client() {
    let cookie = "";
    return async (op, data = {}, extra = {}) => {
      const r = await worker.fetch(
        new Request("https://pulse.test/api/pulse/" + op, {
          method: "POST",
          headers: {
            Origin: "https://pulse.test",
            "Content-Type": "application/json",
            Cookie: cookie,
            ...extra,
          },
          body: JSON.stringify(data),
        }),
        env,
      );
      const values = new Map(
        cookie
          .split("; ")
          .filter(Boolean)
          .map((v) => v.split("=")),
      );
      for (const value of r.headers.getSetCookie()) {
        const [key, v] = value.split(";")[0].split("=");
        values.set(key, v);
      }
      cookie = [...values].map(([k, v]) => k + "=" + v).join("; ");
      return { status: r.status, body: await r.json() };
    };
  }
  return { env, client };
}
const poll = {
  question: "选择",
  options: ["A", "B"],
  voterNoteLabel: "姓名",
  maxChoices: 1,
  writeInLabel: "",
  roster: [],
  resultsPublic: false,
};
test("admin authorization, origin, logout and brute force limit", async () => {
  const { client } = setup(),
    a = client();
  assert.equal((await a("createLivePoll", poll)).status, 401);
  assert.equal((await a("login", { password: "wrong" })).status, 401);
  assert.equal((await a("login", { password })).status, 200);
  assert.equal((await a("createLivePoll", poll, { Origin: "https://evil.test" })).status, 403);
  await a("logout");
  assert.equal((await a("fetchPollList")).status, 401);
  for (let i = 0; i < 6; i++) await a("login", { password: "wrong" });
  assert.equal((await a("login", { password })).status, 429);
});
test("private results redact all counts, names and write-ins even after closing", async () => {
  const { client } = setup(),
    a = client(),
    b = client(),
    c = client();
  await a("login", { password });
  const p = (await a("createLivePoll", { ...poll, writeInLabel: "其他" })).body;
  await b("castVote", {
    pollId: p.id,
    optionIds: [p.options[2].id],
    note: "测试甲",
    writeInText: "秘密",
  });
  let read = (await c("fetchPollById", { pollId: p.id })).body;
  assert.equal(read.total, 0);
  assert.ok(!JSON.stringify(read).includes("秘密"));
  assert.ok(!JSON.stringify(read).includes("测试甲"));
  assert.equal(read.resultsVisible, false);
  assert.equal((await c("fetchVoteDetails", { pollId: p.id })).status, 401);
  assert.equal((await b("fetchPollById", { pollId: p.id })).body.myWriteIn, "秘密");
  await a("closeLivePoll", { pollId: p.id });
  read = (await c("fetchContentById", { contentId: p.id })).body;
  assert.ok(!JSON.stringify(read).includes("秘密"));
  assert.equal((await a("fetchPollById", { pollId: p.id })).body.total, 1);
});
test("numeric score zero, bounds, precision, average and duplicate submission", async () => {
  const { client } = setup(),
    a = client(),
    b = client(),
    c = client();
  await a("login", { password });
  const p = (
    await a("createLivePoll", {
      ...poll,
      pollType: "score",
      scoreMin: 0,
      scoreMax: 100,
      scoreStep: 0.5,
      resultsPublic: true,
    })
  ).body;
  for (const score of [-1, 101, 0.1, null, "5"])
    assert.equal((await b("castVote", { pollId: p.id, score, note: "乙" })).status, 400);
  assert.equal((await b("castVote", { pollId: p.id, score: 0, note: "乙" })).body.myScore, 0);
  assert.equal((await b("castVote", { pollId: p.id, score: 50, note: "乙" })).status, 409);
  assert.equal(
    (await c("castVote", { pollId: p.id, score: 50, note: "丙" })).body.scoreAverage,
    25,
  );
});
test("concurrent last draw slot is never over-allocated; public claims remain private", async () => {
  const { client } = setup(),
    a = client();
  await a("login", { password });
  const p = (
    await a("createDrawLive", {
      title: "签",
      slots: [{ label: "唯一", count: 1 }],
      blankMode: "none",
      roster: [],
      resultsPublic: false,
    })
  ).body;
  const clients = Array.from({ length: 8 }, () => client());
  const result = await Promise.all(clients.map((c) => c("drawLiveOnce", { pollId: p.id })));
  assert.equal(result.filter((r) => r.status === 200).length, 1);
  assert.equal((await clients[0]("fetchPublicClaims", { drawId: p.id })).status, 403);
  assert.equal((await a("fetchDrawAdmin", { pollId: p.id })).body.totalTaken, 1);
});
test("roster name deduplication and latest published activity", async () => {
  const { client } = setup(),
    a = client(),
    b = client(),
    c = client();
  await a("login", { password });
  const p = (await a("createLivePoll", { ...poll, roster: ["名字"] })).body;
  const d = (
    await a("createDrawLive", {
      title: "最新",
      slots: [{ label: "签", count: 2 }],
      blankMode: "none",
      roster: [],
    })
  ).body;
  assert.equal((await b("fetchHomeContent")).body.draw.id, d.id);
  const input = { pollId: p.id, note: "名字", optionIds: [p.options[0].id] };
  assert.equal((await b("castVote", input)).status, 200);
  assert.equal((await c("castVote", input)).status, 400);
  await a("closeLivePoll", { pollId: d.id });
  assert.equal((await c("fetchHomeContent")).body.poll.id, p.id);
});
