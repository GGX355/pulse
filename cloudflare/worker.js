// Cloudflare-only transport. Credentials and raw participant records never enter the client bundle.
const ADMIN = {
  id: "pulse-admin",
  displayName: "管理员",
  primaryEmail: null,
  isDevFallback: false,
  isAdmin: true,
};
const encoder = new TextEncoder();
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const text = (v, max, required = false) => {
  if (typeof v !== "string" || v.trim().length > max || (required && !v.trim()))
    fail("请检查填写内容");
  return v.trim();
};
const number = (v, min, max) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) fail("数字超出范围");
  return v;
};
const uuid = () => crypto.randomUUID();
const digest = async (value) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const cookies = (request) =>
  Object.fromEntries(
    (request.headers.get("cookie") || "").split(";").map((p) => p.trim().split("=")),
  );
const closed = (p) => p.closed || (p.closesAt !== null && p.closesAt <= Date.now());
const mine = (p, key) => p.votes.find((v) => v.key === key);
const chosenText = (p, v) =>
  p.kind === "draw"
    ? p.slots.find((s) => s.id === v.slotId)?.label
    : p.pollType === "score"
      ? String(v.score)
      : p.options
          .filter((o) => v.optionIds.includes(o.id))
          .map((o) => (o.isWriteIn ? v.writeInText : o.label))
          .join("、");
const slots = (p) =>
  p.slots.map((s) => {
    const taken = p.votes.filter((v) => v.slotId === s.id).length;
    return { ...s, taken, remaining: s.count < 0 ? null : s.count - taken };
  });
const claims = (p) =>
  p.votes.map((v, i) => ({
    label: chosenText(p, v),
    voterMasked: `参与者 ${i + 1}`,
    voterName: v.note || null,
    drewAtMs: v.at,
  }));
const view = (p, key, admin) => {
  if (!p) return null;
  const m = mine(p, key),
    visible = admin || p.resultsPublic;
  const common = {
    id: p.id,
    creatorId: ADMIN.id,
    closed: closed(p),
    description: p.description,
    voterNoteLabel: p.voterNoteLabel,
    myNote: m?.note || null,
    resultsPublic: p.resultsPublic,
  };
  if (p.kind === "draw") {
    const list = slots(p),
      allTaken = list.every((s) => s.remaining === 0),
      reveal = visible || !!m || closed(p);
    return {
      ...common,
      title: p.title,
      allTaken,
      revealModes: p.revealModes,
      blind: !reveal,
      slots: reveal ? list : list.map(({ id, label }) => ({ id, label })),
      myDraw: m ? { slotId: m.slotId, label: chosenText(p, m) } : null,
      totalTaken: reveal ? p.votes.length : null,
    };
  }
  return {
    ...common,
    question: p.question,
    pollType: p.pollType,
    resultsVisible: visible,
    maxChoices: p.maxChoices,
    closesAt: p.closesAt,
    deadlinePassed: !p.closed && closed(p),
    votedId: m?.optionIds?.[0] || null,
    votedIds: m?.optionIds || [],
    myWriteIn: m?.writeInText || null,
    myScore: m?.score ?? null,
    scoreMin: p.scoreMin,
    scoreMax: p.scoreMax,
    scoreStep: p.scoreStep,
    scoreAverage:
      visible && p.votes.length && p.pollType === "score"
        ? p.votes.reduce((s, v) => s + v.score, 0) / p.votes.length
        : null,
    scoreCount: visible ? p.votes.length : null,
    total: visible ? p.votes.reduce((s, v) => s + (v.optionIds?.length || 1), 0) : 0,
    options: p.options.map((o) => {
      const vs = visible ? p.votes.filter((v) => v.optionIds?.includes(o.id)) : [];
      return {
        ...o,
        votes: vs.length,
        notes: vs.map((v) => v.note).filter(Boolean),
        writeIns: o.isWriteIn ? vs.map((v) => v.writeInText).filter(Boolean) : [],
      };
    }),
  };
};
const content = (p, key, admin) =>
  p
    ? p.kind === "draw"
      ? { kind: "draw", draw: view(p, key, admin) }
      : { kind: "poll", poll: view(p, key, admin) }
    : null;
export async function verifyPassword(password, encoded) {
  const [salt, expected] = (encoded || "").split(":");
  if (!salt || !/^[a-f0-9]{64}$/.test(expected || "")) return false;
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 100000 },
    material,
    256,
  );
  const actual = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
  let delta = 0;
  for (let i = 0; i < 64; i++) delta |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return delta === 0;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/pulse/")) return env.ASSETS.fetch(request);
    const headers = new Headers({
      "Content-Type": "application/json;charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    const cookie = (name, value, age) =>
      headers.append(
        "Set-Cookie",
        `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`,
      );
    try {
      if (request.method !== "POST") fail("Method not allowed", 405);
      if (
        request.headers.get("origin") !== url.origin ||
        !request.headers.get("content-type")?.startsWith("application/json")
      )
        fail("请求来源无效", 403);
      if (!env.DB) fail("服务尚未配置", 503);
      const raw = await request.text();
      if (raw.length > 32000) fail("内容过长", 413);
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        fail("请求格式无效");
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) fail("请求格式无效");
      const op = url.pathname.split("/").pop(),
        ck = cookies(request);
      const key = /^[a-f0-9-]{36}$/.test(ck.pulse_vk || "") ? ck.pulse_vk : uuid();
      if (key !== ck.pulse_vk) cookie("pulse_vk", key, 34560000);
      const tokenHash = ck.pulse_session ? await digest(ck.pulse_session) : "";
      const admin = !!(
        tokenHash &&
        (await env.DB.prepare("SELECT token FROM sessions WHERE token=? AND expires>?")
          .bind(tokenHash, Date.now())
          .first())
      );
      const requireAdmin = () => {
        if (!admin) fail("请先登录管理员", 401);
      };
      let result;
      if (op === "session") result = admin ? ADMIN : null;
      else if (op === "login") {
        if (!env.ADMIN_PASSWORD_HASH && !env.ADMIN_PASSWORD) fail("管理员登录尚未配置", 503);
        const password = text(data.password, 128, true);
        const bucket = await digest(
          `${request.headers.get("CF-Connecting-IP") || "local"}:${Math.floor(Date.now() / 900000)}`,
        );
        const limit = await env.DB.prepare(
          "INSERT INTO login_limits(key,attempts,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
        )
          .bind(bucket, Date.now() + 900000)
          .first();
        if (limit.attempts > 8) fail("尝试过多，请稍后再试", 429);
        const valid = env.ADMIN_PASSWORD_HASH
          ? await verifyPassword(password, env.ADMIN_PASSWORD_HASH)
          : (await digest(password)) === (await digest(env.ADMIN_PASSWORD));
        if (!valid) fail("密码不正确", 401);
        const token = uuid() + uuid();
        await env.DB.batch([
          env.DB.prepare("INSERT INTO sessions(token,expires) VALUES(?,?)").bind(
            await digest(token),
            Date.now() + 28800000,
          ),
          env.DB.prepare("DELETE FROM sessions WHERE expires<?").bind(Date.now()),
          env.DB.prepare("DELETE FROM login_limits WHERE expires<?").bind(Date.now()),
        ]);
        cookie("pulse_session", token, 28800);
        result = ADMIN;
      } else if (op === "logout") {
        if (tokenHash)
          await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(tokenHash).run();
        cookie("pulse_session", "", 0);
        result = null;
      } else if (op === "getClassRoster" || op === "setClassRoster") {
        requireAdmin();
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)").bind().run();
        if (op === "setClassRoster") {
          if (!Array.isArray(data.names) || data.names.length > 500) fail("名单格式无效");
          const names = data.names.map(name => text(name, 40, true));
          if (new Set(names).size !== names.length) fail("名单中有重复姓名");
          result = { name: text(data.name, 40, true), names };
          await env.DB.prepare("INSERT INTO settings(key,value) VALUES('class-roster',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(result)).run();
        } else {
          const row = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind('class-roster').first();
          result = row ? JSON.parse(row.value) : null;
        }
      } else {
        const all = async () =>
          (
            await env.DB.prepare(
              "SELECT body FROM activities WHERE deleted=0 ORDER BY created DESC,rowid DESC",
            ).all()
          ).results.map((r) => JSON.parse(r.body));
        const get = async (id) => {
          if (typeof id !== "string") fail("活动不存在", 404);
          const row = await env.DB.prepare(
            "SELECT body,version FROM activities WHERE id=? AND deleted=0",
          )
            .bind(id)
            .first();
          if (!row) fail("活动不存在", 404);
          return { p: JSON.parse(row.body), version: row.version };
        };
        const latest = async (kind) => {
          const rows = (await all()).filter((p) => !kind || p.kind === kind);
          return rows.find((p) => !closed(p)) || rows[0] || null;
        };
        // Compare-and-swap commits one complete activity atomically. Retry from fresh data,
        // so duplicate votes, roster names and the last draw ticket cannot race.
        const update = async (id, fn) => {
          for (let attempt = 0; attempt < 8; attempt++) {
            const { p, version } = await get(id);
            fn(p);
            const body = JSON.stringify(p);
            if (encoder.encode(body).length > 800000) fail("本活动已达到容量上限，请创建新活动");
            const r = await env.DB.prepare(
              "UPDATE activities SET body=?,version=version+1 WHERE id=? AND version=? AND deleted=0",
            )
              .bind(body, id, version)
              .run();
            if (r.meta.changes) return p;
          }
          fail("提交繁忙，请重试", 409);
        };
        if (op === "createLivePoll" || op === "createDrawLive") {
          requireAdmin();
          const kind = op === "createLivePoll" ? "poll" : "draw";
          if (!Array.isArray(data.roster) || data.roster.length > 500) fail("名单格式无效");
          const roster = [...new Set(data.roster.map((v) => text(v, 40, true)))];
          const p = {
            id: uuid(),
            kind,
            created: Date.now(),
            closed: false,
            closesAt: null,
            description: text(data.description || "", 120),
            voterNoteLabel: text(data.voterNoteLabel || "", 20) || (roster.length ? "姓名" : ""),
            roster,
            resultsPublic: data.resultsPublic === true,
            votes: [],
          };
          if (kind === "poll") {
            p.question = text(data.question, 80, true);
            p.pollType = data.pollType === "score" ? "score" : "choice";
            p.maxChoices = number(data.maxChoices, 0, 8);
            if (!Number.isInteger(p.maxChoices)) fail("选项上限无效");
            p.options = [];
            if (p.pollType === "score") {
              p.scoreMin = number(data.scoreMin, -100000, 100000);
              p.scoreMax = number(data.scoreMax, -100000, 100000);
              p.scoreStep = number(data.scoreStep, 0.01, 100000);
              if (p.scoreMin >= p.scoreMax) fail("最高分必须大于最低分");
            } else {
              if (!Array.isArray(data.options) || data.options.length > 8) fail("选项格式无效");
              p.options = data.options.map((label) => ({
                id: uuid(),
                label: text(label, 40, true),
                isWriteIn: false,
              }));
              if (data.writeInLabel)
                p.options.push({
                  id: uuid(),
                  label: text(data.writeInLabel, 40, true),
                  isWriteIn: true,
                });
              if (p.options.length < 2 || p.options.length > 8) fail("请设置 2–8 个选项");
            }
            if (data.closesAtISO) {
              p.closesAt = Date.parse(text(data.closesAtISO, 40, true));
              if (!Number.isFinite(p.closesAt) || p.closesAt <= Date.now())
                fail("截止时间必须在未来");
            }
          } else {
            p.title = text(data.title, 80, true);
            if (!Array.isArray(data.slots) || !data.slots.length || data.slots.length > 12)
              fail("签位格式无效");
            p.slots = data.slots.map((s) => {
              const count = number(s.count, 1, 999);
              if (!Number.isInteger(count)) fail("数量必须为整数");
              return { id: uuid(), label: text(s.label, 40, true), count };
            });
            if (!["none", "count", "unlimited"].includes(data.blankMode)) fail("空签设置无效");
            if (data.blankMode !== "none") {
              const count = data.blankMode === "unlimited" ? -1 : number(data.blankCount, 1, 99999);
              if (!Number.isInteger(count)) fail("数量必须为整数");
              p.slots.push({ id: uuid(), label: text(data.blankLabel, 10, true), count });
            }
            p.revealModes = data.revealModes || ["flip", "scratch", "grid"];
            if (
              !Array.isArray(p.revealModes) ||
              !p.revealModes.length ||
              p.revealModes.some((m) => !["flip", "scratch", "grid"].includes(m))
            )
              fail("揭晓方式无效");
          }
          await env.DB.prepare("INSERT INTO activities(id,kind,created,body) VALUES(?,?,?,?)")
            .bind(p.id, p.kind, p.created, JSON.stringify(p))
            .run();
          result = view(p, key, admin);
        } else if (op === "castVote" || op === "drawLiveOnce") {
          const id = data.pollId || (await latest("poll"))?.id;
          const p = await update(id, (p) => {
            if (
              (op === "castVote" && p.kind !== "poll") ||
              (op === "drawLiveOnce" && p.kind !== "draw")
            )
              fail("活动类型不符");
            if (mine(p, key)) {
              if (p.kind === "draw") return;
              fail("你已经参与过了", 409);
            }
            if (closed(p)) fail("活动已结束");
            const note = text(data.note || "", 40);
            if (p.voterNoteLabel && !note) fail(`请填写${p.voterNoteLabel}`);
            if (
              p.roster.length &&
              (!p.roster.includes(note) || p.votes.some((v) => v.note === note))
            )
              fail("姓名不在名单中或已经参与");
            const v = { key, note, at: Date.now() };
            if (p.kind === "draw") {
              const available = slots(p).filter((s) => s.remaining === null || s.remaining > 0);
              if (!available.length) fail("已抽完");
              const weights = available.map((s) =>
                s.remaining === null
                  ? Math.max(
                      1,
                      available.reduce((n, s) => n + (s.remaining || 0), 0),
                    )
                  : s.remaining,
              );
              const range = weights.reduce((a, b) => a + b, 0),
                limit = Math.floor(4294967296 / range) * range;
              let n;
              do {
                n = crypto.getRandomValues(new Uint32Array(1))[0];
              } while (n >= limit);
              n %= range;
              let index = 0;
              while (n >= weights[index]) n -= weights[index++];
              v.slotId = available[index].id;
            } else if (p.pollType === "score") {
              v.score = number(data.score, p.scoreMin, p.scoreMax);
              const steps = (v.score - p.scoreMin) / p.scoreStep;
              if (Math.abs(steps - Math.round(steps)) > 1e-7) fail("分数精度不符合要求");
            } else {
              if (!Array.isArray(data.optionIds)) fail("请选择选项");
              v.optionIds = [...new Set(data.optionIds)];
              if (
                !v.optionIds.length ||
                v.optionIds.length > (p.maxChoices || p.options.length) ||
                v.optionIds.some((id) => !p.options.some((o) => o.id === id))
              )
                fail("选项无效");
              v.writeInText = text(data.writeInText || "", 40);
              if (
                p.options.some((o) => o.isWriteIn && v.optionIds.includes(o.id)) &&
                !v.writeInText
              )
                fail("请填写内容");
            }
            p.votes.push(v);
          });
          result = view(p, key, admin);
        } else if (["closeLivePoll", "setDrawResultsPublic"].includes(op)) {
          requireAdmin();
          const p = await update(data.pollId, (p) => {
            if (op === "closeLivePoll") p.closed = true;
            else {
              if (typeof data.isPublic !== "boolean") fail("设置无效");
              p.resultsPublic = data.isPublic;
            }
          });
          result = view(p, key, admin);
        } else if (op === "deleteContent") {
          requireAdmin();
          await env.DB.prepare("UPDATE activities SET deleted=1 WHERE id=?")
            .bind(text(data.contentId, 80, true))
            .run();
          result = null;
        } else if (["fetchLivePoll", "fetchLiveDraw", "fetchHomeContent"].includes(op)) {
          const p = await latest(
            op === "fetchLivePoll" ? "poll" : op === "fetchLiveDraw" ? "draw" : null,
          );
          result = op === "fetchHomeContent" ? content(p, key, admin) : view(p, key, admin);
        } else if (["fetchPollById", "fetchDrawById", "fetchContentById"].includes(op)) {
          const { p } = await get(data.pollId || data.drawId || data.contentId);
          if (
            (op === "fetchPollById" && p.kind !== "poll") ||
            (op === "fetchDrawById" && p.kind !== "draw")
          )
            fail("活动不存在", 404);
          result = op === "fetchContentById" ? content(p, key, admin) : view(p, key, admin);
        } else if (["fetchPollList", "fetchDrawList", "fetchDrawListAdmin"].includes(op)) {
          requireAdmin();
          result = (await all())
            .filter((p) => p.kind === (op === "fetchPollList" ? "poll" : "draw"))
            .map((p) => ({
              id: p.id,
              kind: p.kind,
              question: p.question,
              title: p.title,
              creatorId: ADMIN.id,
              closed: closed(p),
              createdAtMs: p.created,
              total: p.votes.length,
              totalTaken: p.votes.length,
              allTaken: p.kind === "draw" && slots(p).every((s) => s.remaining === 0),
              voterNoteLabel: p.voterNoteLabel,
            }));
        } else if (op === "listVoterProfiles") {
          requireAdmin();
          const names = new Map();
          for (const p of await all())
            for (const v of p.votes)
              if (v.note) {
                const prev = names.get(v.note);
                names.set(v.note, {
                  displayName: v.note,
                  updatedAtMs: Math.max(v.at, prev?.updatedAtMs || 0),
                  pollCount: (prev?.pollCount || 0) + 1,
                });
              }
          result = [...names.values()];
        } else if (
          [
            "fetchRosterStatus",
            "fetchVoteDetails",
            "fetchDrawAdmin",
            "listDrawClaims",
            "fetchPublicClaims",
          ].includes(op)
        ) {
          if (op !== "fetchPublicClaims") requireAdmin();
          const { p } = await get(data.pollId || data.drawId);
          if (op === "fetchPublicClaims") {
            if (!p.resultsPublic && !admin) fail("结果未公开", 403);
            result = claims(p);
          } else if (op === "listDrawClaims") result = claims(p);
          else if (op === "fetchVoteDetails")
            result = p.votes
              .filter((v) => v.note)
              .map((v) => ({ name: v.note, choice: chosenText(p, v), atMs: v.at }));
          else if (op === "fetchRosterStatus") {
            const entries = p.roster.map((name) => {
              const v = p.votes.find((v) => v.note === name);
              return { name, done: !!v, result: v ? chosenText(p, v) : null, atMs: v?.at || null };
            });
            result = {
              hasRoster: !!entries.length,
              total: entries.length,
              doneCount: entries.filter((e) => e.done).length,
              entries,
            };
          } else result = { ...view(p, key, true), slots: slots(p), claims: claims(p) };
        } else fail("Not found", 404);
      }
      return new Response(JSON.stringify(result ?? null), { headers });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e.status ? e.message : "服务暂时不可用，请重试" }),
        { status: e.status || 500, headers },
      );
    }
  },
};
