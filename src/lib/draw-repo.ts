/**
 * Pure data layer for draws (抽奖/抽签) — the second content kind, stored in
 * the same polls/poll_options/poll_votes tables with kind='draw'. Kept apart
 * from poll-repo so the voting path stays untouched; sharing is one-way (see
 * drawClaimList / closePoll in draw-api).
 *
 * Ticket claiming is a conditional `update ... set taken = taken + 1` — the row
 * lock makes "check remaining, then claim" atomic under concurrency, which a
 * count-then-insert check would not be (two simultaneous drawers could both
 * pass the check and over-issue the last ticket). The poll_votes row written
 * right after is the per-person record; `unique (poll_id, voter_key)` makes
 * double draws impossible, and a lost race there reverts the claim.
 */
import { randomInt } from "node:crypto";

export type DrawSlot = {
  id: string;
  label: string;
  /** 该签位的签数量;-1 = 不限量。 */
  count: number;
  taken: number;
  /** null = 不限量,永远可抽。 */
  remaining: number | null;
};

export type DrawPoll = {
  id: string;
  title: string;
  slots: DrawSlot[];
  /** 我抽到的签;null = 还没抽。 */
  myDraw: { slotId: string; label: string } | null;
  /** 已经抽走的人数。 */
  totalTaken: number;
  closed: boolean;
  /** 有限签全部抽完且没有不限量兜底 —— 再来人无签可抽。 */
  allTaken: boolean;
  creatorId: string | null;
};

export type Sql = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
};

/**
 * 盲选视图 —— 参与者能看到的抽签形态。抽之前(blind)只有签位名字:没有已抽
 * 人数、没有剩余、没有总数,连"自己抽到什么"也只在真正抽完后出现;抽完或
 * 结束后(blind=false)全量可见。数字隐藏发生在数据层,前端藏不住也漏不出。
 */
export type DrawSlotPublic = { id: string; label: string };

type DrawViewBase = {
  id: string;
  title: string;
  closed: boolean;
  /** 有限签全部抽完且没有不限量兜底。盲选态也保留:抽满与否必须告诉人。 */
  allTaken: boolean;
  creatorId: string | null;
};

/** 盲选态:抽之前 —— 只有签位名字,没有数字,也没有"我抽到了什么"。 */
export type DrawBlindView = DrawViewBase & {
  blind: true;
  slots: DrawSlotPublic[];
  myDraw: null;
  totalTaken: null;
};

/** 揭示态:自己抽完或活动结束后 —— 全量数字对这个人公开。 */
export type DrawRevealedView = DrawViewBase & {
  blind: false;
  slots: DrawSlot[];
  myDraw: { slotId: string; label: string } | null;
  totalTaken: number;
};

export type DrawView = DrawBlindView | DrawRevealedView;

/** 参与者视角:抽之前隐藏全部数字,抽完或结束后全量公开。 */
export function drawToView(draw: DrawPoll): DrawView {
  const base = {
    id: draw.id,
    title: draw.title,
    closed: draw.closed,
    allTaken: draw.allTaken,
    creatorId: draw.creatorId,
  };
  if (draw.closed || draw.myDraw) {
    return {
      ...base,
      blind: false,
      slots: draw.slots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        count: slot.count,
        taken: slot.taken,
        remaining: slot.remaining,
      })),
      myDraw: draw.myDraw,
      totalTaken: draw.totalTaken,
    };
  }
  return {
    ...base,
    blind: true,
    slots: draw.slots.map((slot) => ({ id: slot.id, label: slot.label })),
    myDraw: null,
    totalTaken: null,
  };
}

export type CreateDrawInput = {
  title: string;
  /** 有限签位;count >= 1。 */
  slots: { label: string; count: number }[];
  /** 未中兜底签的文案;null = 不设未中(抽完即止)。 */
  blankLabel: string | null;
  /** 未中数量;null = 不限量。仅在 blankLabel 非空时生效。 */
  blankCount: number | null;
};

export async function createDraw(
  sql: Sql,
  creatorId: string | null,
  input: CreateDrawInput,
): Promise<string> {
  const id = crypto.randomUUID();
  await sql.query(
    `insert into polls (id, question, creator_id, kind) values ($1, $2, $3, 'draw')`,
    [id, input.title, creatorId],
  );
  let order = 0;
  for (const slot of input.slots) {
    await sql.query(
      `insert into poll_options (id, poll_id, label, sort_order, slot_count)
       values ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), id, slot.label, order, slot.count],
    );
    order += 1;
  }
  if (input.blankLabel !== null) {
    await sql.query(
      `insert into poll_options (id, poll_id, label, sort_order, slot_count)
       values ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), id, input.blankLabel, order, input.blankCount ?? -1],
    );
  }
  return id;
}

export async function readDrawById(
  sql: Sql,
  key: string,
  pollId: string,
): Promise<DrawPoll | null> {
  const polls = await sql.query<{
    id: string;
    question: string;
    creator_id: string | null;
    closed: boolean;
  }>(
    `select id, question, creator_id, (closed_at is not null) as closed
     from polls where id = $1 and kind = 'draw' limit 1`,
    [pollId],
  );
  const poll = polls[0];
  if (!poll) return null;

  const slots = await sql.query<{
    id: string;
    label: string;
    slot_count: number;
    taken: number;
  }>(
    `select id, label, slot_count, taken
     from poll_options where poll_id = $1
     order by sort_order asc`,
    [pollId],
  );

  const mine = await sql.query<{ option_id: string; label: string }>(
    `select v.option_id, o.label
     from poll_votes v join poll_options o on o.id = v.option_id
     where v.poll_id = $1 and v.voter_key = $2
     limit 1`,
    [pollId, key],
  );

  const drawSlots: DrawSlot[] = slots.map((row) => ({
    id: row.id,
    label: row.label,
    count: Number(row.slot_count),
    taken: Number(row.taken),
    remaining:
      Number(row.slot_count) === -1
        ? null
        : Number(row.slot_count) - Number(row.taken),
  }));
  const hasUnlimited = drawSlots.some((slot) => slot.remaining === null);
  const finiteExhausted = drawSlots
    .filter((slot) => slot.remaining !== null)
    .every((slot) => (slot.remaining ?? 0) <= 0);

  return {
    id: poll.id,
    title: poll.question,
    slots: drawSlots,
    myDraw: mine[0]
      ? { slotId: mine[0].option_id, label: mine[0].label }
      : null,
    totalTaken: drawSlots.reduce((sum, slot) => sum + slot.taken, 0),
    closed: Boolean(poll.closed),
    allTaken: !hasUnlimited && finiteExhausted,
    creatorId: poll.creator_id,
  };
}

/**
 * Draw once as `key`. Server-side weighted-random pick among the remaining
 * tickets (不限量兜底签的权重 = 有限签剩余总和:有限签先派完,未中兜底),
 * claimed atomically, recorded, then re-read so the response is the true
 * post-draw state. Drawing again simply returns your existing result.
 *
 * Per-voter uniqueness rides the `poll_ballots` primary key (poll_id,
 * voter_key) — the same one-submission-per-person primitive the multi-choice
 * voting path uses. The ballot row is created FIRST as the gate: a concurrent
 * duplicate request loses the insert and returns the existing state instead of
 * claiming a second ticket. If anything fails after the gate (ticket raced
 * out, insert error), the ballot is deleted again so the person can retry —
 * the only casualty of a mid-flight crash would be one stranded participant,
 * not a corrupt tally.
 */
export async function drawOne(
  sql: Sql,
  key: string,
  pollId: string,
): Promise<DrawPoll> {
  let state = await readDrawById(sql, key, pollId);
  if (!state) throw new Error("没有这个抽签");
  if (state.closed) throw new Error("抽签已结束");
  if (state.myDraw) return state;
  if (state.allTaken) throw new Error("已经抽完了");

  const gate = await sql.query<{ voter_key: string }>(
    `insert into poll_ballots (poll_id, voter_key)
     values ($1, $2)
     on conflict do nothing
     returning voter_key`,
    [pollId, key],
  );
  if (gate.length === 0) {
    // 并发的同一个人: ballot 已存在 — 返回他已有的结果。
    const existing = await readDrawById(sql, key, pollId);
    if (!existing) throw new Error("没有这个抽签");
    return existing;
  }

  const release = async (): Promise<void> => {
    await sql.query(
      `delete from poll_ballots where poll_id = $1 and voter_key = $2`,
      [pollId, key],
    );
  };

  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const open = state.slots.filter(
        (slot) => slot.remaining === null || slot.remaining > 0,
      );
      if (open.length === 0) throw new Error("已经抽完了");

      const finiteRemaining = open.reduce(
        (sum, slot) => sum + (slot.remaining ?? 0),
        0,
      );
      const weights = open.map((slot) =>
        slot.remaining ?? Math.max(1, finiteRemaining),
      );
      let pick = open[open.length - 1];
      let r = randomInt(weights.reduce((a, b) => a + b, 0));
      for (let i = 0; i < open.length; i += 1) {
        r -= weights[i];
        if (r < 0) {
          pick = open[i];
          break;
        }
      }

      const claimed = await sql.query<{ taken: number }>(
        `update poll_options set taken = taken + 1
         where id = $1 and poll_id = $2 and (slot_count = -1 or taken < slot_count)
         returning taken`,
        [pick.id, pollId],
      );
      if (claimed.length === 0) {
        // 该签位刚被别人抢空 — 重读状态,重新随机。
        const next = await readDrawById(sql, key, pollId);
        if (!next) throw new Error("没有这个抽签");
        state = next;
        continue;
      }

      await sql.query(
        `insert into poll_votes (id, poll_id, option_id, voter_key)
         values ($1, $2, $3, $4)`,
        [crypto.randomUUID(), pollId, pick.id, key],
      );

      const done = await readDrawById(sql, key, pollId);
      if (!done) throw new Error("抽签失败");
      return done;
    }
    throw new Error("手气太快,请再试一次");
  } catch (err) {
    // 出闸未出签:把 ballot 退掉,让人可以再抽。
    await release();
    throw err;
  }
}

/** 兑奖名单上的一个人;voter_key 打码,发起人也看不到完整身份。 */
export type DrawClaim = {
  label: string;
  voterMasked: string;
  drewAtMs: number;
};

function maskKey(key: string): string {
  return key.length <= 6 ? `${key}…` : `${key.slice(0, 6)}…`;
}

/** 发起人专属:谁在什么时候抽到了什么,按时间排序,现场核销用。 */
export async function drawClaimList(
  sql: Sql,
  pollId: string,
  userId: string,
): Promise<DrawClaim[]> {
  const polls = await sql.query<{ creator_id: string | null }>(
    `select creator_id from polls where id = $1 limit 1`,
    [pollId],
  );
  if (!polls[0]) throw new Error("没有这个抽签");
  if (polls[0].creator_id !== userId) throw new Error("只有发起人能看兑奖名单");

  const rows = await sql.query<{
    label: string;
    voter_key: string;
    drew_at_ms: number;
  }>(
    `select o.label, v.voter_key,
            (extract(epoch from v.created_at) * 1000)::bigint as drew_at_ms
     from poll_votes v join poll_options o on o.id = v.option_id
     where v.poll_id = $1
     order by v.created_at asc`,
    [pollId],
  );
  return rows.map((row) => ({
    label: row.label,
    voterMasked: maskKey(row.voter_key),
    drewAtMs: Number(row.drew_at_ms),
  }));
}

/** 抽签列表页的一行。盲选:进行中的抽签不显示任何人数。 */
export type DrawSummary = {
  id: string;
  title: string;
  closed: boolean;
  /** 已抽人数 —— 仅已结束后公开;进行中为 null(盲选)。 */
  total: number | null;
  createdAtMs: number;
};

export async function listDraws(sql: Sql, limit = 50): Promise<DrawSummary[]> {
  const rows = await sql.query<{
    id: string;
    question: string;
    closed: boolean;
    total: number | null;
    created_ms: number;
  }>(
    `select p.id, p.question,
            (p.closed_at is not null) as closed,
            case when p.closed_at is not null then count(v.id)::int else null end as total,
            (extract(epoch from p.created_at) * 1000)::bigint as created_ms
     from polls p
     left join poll_options o on o.poll_id = p.id
     left join poll_votes v on v.option_id = o.id
     where p.kind = 'draw'
     group by p.id, p.question, p.created_at, p.closed_at
     order by p.created_at desc
     limit $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.question,
    closed: Boolean(row.closed),
    total: row.total === null ? null : Number(row.total),
    createdAtMs: Number(row.created_ms),
  }));
}

/** 发起人后台的一行统计:每个签位的真实数字,随时可看,盲选不影响。 */
export type DrawAdminStats = {
  id: string;
  title: string;
  closed: boolean;
  allTaken: boolean;
  totalTaken: number;
  slots: DrawSlot[];
  claims: DrawClaim[];
};

/** 只有发起人能拿全量数据;别人调直接拒。 */
export async function drawAdminStats(
  sql: Sql,
  pollId: string,
  userId: string,
): Promise<DrawAdminStats> {
  const polls = await sql.query<{ creator_id: string | null }>(
    `select creator_id from polls where id = $1 and kind = 'draw' limit 1`,
    [pollId],
  );
  const poll = polls[0];
  if (!poll) throw new Error("没有这个抽签");
  if (poll.creator_id !== userId) throw new Error("只有发起人能看后台数据");

  // myDraw 与后台无关,传一个不可能命中的 key。
  const draw = await readDrawById(sql, `admin:${pollId}`, pollId);
  if (!draw) throw new Error("没有这个抽签");
  const claims = await drawClaimList(sql, pollId, userId);
  return {
    id: draw.id,
    title: draw.title,
    closed: draw.closed,
    allTaken: draw.allTaken,
    totalTaken: draw.totalTaken,
    slots: draw.slots,
    claims,
  };
}
