/**
 * Pure data layer for polls: every function takes a `Sql` handle plus plain
 * values, so the same rules run inside server functions and in node tests —
 * no framework, cookies or env access in here.
 */
import { rosterExists, rosterHas, rosterTaken, setRoster } from "./roster.ts";

export type PollOption = {
  id: string;
  label: string;
  votes: number;
  /** True for the creator-added fill-in option. */
  isWriteIn: boolean;
  /** Non-empty notes on this option, oldest first. Empty strings are omitted. */
  notes: string[];
  /** Fill-in answers on a write-in option, oldest first. */
  writeIns: string[];
};

export type LivePoll = {
  id: string;
  question: string;
  options: PollOption[];
  total: number;
  /** First option this voter picked; null if they have not voted. */
  votedId: string | null;
  /** Every option this voter picked, oldest first. Empty if they have not voted. */
  votedIds: string[];
  /** 1 = single, N = up to N, 0 = unlimited (capped at option count when voting). */
  maxChoices: number;
  /** Better Auth user id of the creator — null for pre-sign-in polls. */
  creatorId: string | null;
  /** True once the creator has closed the poll; votes are rejected after. */
  closed: boolean;
  /** Prompt shown before options — e.g. 名字 / 地点 / 时间. */
  voterNoteLabel: string;
  /** This voter_key's note when they have already voted; otherwise null. */
  myNote: string | null;
  /** This voter_key's fill-in text when they picked the write-in option. */
  myWriteIn: string | null;
};

/** How many options a voter may pick on this poll (at least 1). */
export function effectiveMaxChoices(
  maxChoices: number,
  optionCount: number,
): number {
  if (optionCount < 1) return 0;
  if (maxChoices <= 0) return optionCount;
  return Math.min(maxChoices, optionCount);
}

export type Sql = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
};

const SEED_POLL_ID = "seed-lunch";
const SEED_OPTIONS = ["拉面", "便当", "沙拉", "随便"];

/** Non-empty label means the voter must fill a note before choosing. */
export function pollAsksForNote(label: string): boolean {
  return label.trim().length > 0;
}

/** One row of the polls list: newest-first summaries for /polls. */
export type PollSummary = {
  id: string;
  question: string;
  kind: string;
  total: number;
  closed: boolean;
  /** Epoch milliseconds — int8 comes back as number via the db type parsers. */
  createdAtMs: number;
};

/** Admin-only roster row. Never includes voter_key. */
export type VoterProfileRow = {
  displayName: string;
  updatedAtMs: number;
  pollCount: number;
};

/**
 * One poll with live counts, plus whether `key` has voted on it.
 * `pollId` omitted = the newest poll (the "live" one).
 */
export async function readPoll(
  sql: Sql,
  key: string,
  pollId?: string,
): Promise<LivePoll | null> {
  const polls = pollId
    ? await sql.query<{
        id: string;
        question: string;
        creator_id: string | null;
        closed: boolean;
        voter_note_label: string;
        max_choices: number;
      }>(
        `select id, question, creator_id, (closed_at is not null) as closed,
                voter_note_label, max_choices
         from polls where id = $1 limit 1`,
        [pollId],
      )
    : await sql.query<{
        id: string;
        question: string;
        creator_id: string | null;
        closed: boolean;
        voter_note_label: string;
        max_choices: number;
      }>(
        `select id, question, creator_id, (closed_at is not null) as closed,
                voter_note_label, max_choices
         from polls
         where kind = 'poll'
         order by (closed_at is null) desc, created_at desc
         limit 1`,
      );
  const poll = polls[0];
  if (!poll) return null;

  const options = await sql.query<{
    id: string;
    label: string;
    votes: number;
    is_write_in: boolean;
  }>(
    `select o.id, o.label, o.is_write_in,
            coalesce(count(v.id), 0)::int as votes
     from poll_options o
     left join poll_votes v on v.option_id = o.id
     where o.poll_id = $1
     group by o.id, o.label, o.sort_order, o.is_write_in
     order by o.sort_order asc`,
    [poll.id],
  );

  const voteRows = await sql.query<{
    option_id: string;
    voter_note: string;
    voter_key: string;
    write_in_text: string;
  }>(
    `select option_id, voter_note, voter_key, write_in_text
     from poll_votes
     where poll_id = $1
     order by created_at asc`,
    [poll.id],
  );

  const notesByOption = new Map<string, string[]>();
  const writeInsByOption = new Map<string, string[]>();
  const votedIds: string[] = [];
  let myNote: string | null = null;
  let myWriteIn: string | null = null;
  for (const row of voteRows) {
    const note = row.voter_note.trim();
    if (note) {
      const list = notesByOption.get(row.option_id) ?? [];
      list.push(note);
      notesByOption.set(row.option_id, list);
    }
    const writeIn = row.write_in_text.trim();
    if (writeIn) {
      const list = writeInsByOption.get(row.option_id) ?? [];
      list.push(writeIn);
      writeInsByOption.set(row.option_id, list);
    }
    if (row.voter_key === key) {
      votedIds.push(row.option_id);
      if (!myNote && note) myNote = row.voter_note;
      if (!myWriteIn && writeIn) myWriteIn = row.write_in_text;
    }
  }

  const total = options.reduce((sum, row) => sum + Number(row.votes), 0);
  return {
    id: poll.id,
    question: poll.question,
    options: options.map((row) => ({
      id: row.id,
      label: row.label,
      votes: Number(row.votes),
      isWriteIn: Boolean(row.is_write_in),
      notes: notesByOption.get(row.id) ?? [],
      writeIns: writeInsByOption.get(row.id) ?? [],
    })),
    total,
    votedId: votedIds[0] ?? null,
    votedIds,
    maxChoices: Number(poll.max_choices),
    creatorId: poll.creator_id,
    closed: Boolean(poll.closed),
    voterNoteLabel: poll.voter_note_label,
    myNote,
    myWriteIn,
  };
}

/** Create the demo poll once, so an empty database still shows something. */
export async function seedIfEmpty(sql: Sql): Promise<void> {
  const existing = await sql.query<{ n: number }>(
    `select count(*)::int as n from polls`,
  );
  if ((existing[0]?.n ?? 0) > 0) return;

  await sql.query(
    `insert into polls (id, question, voter_note_label) values ($1, $2, $3)`,
    [SEED_POLL_ID, "午饭吃什么？", ""],
  );
  for (let i = 0; i < SEED_OPTIONS.length; i += 1) {
    await sql.query(
      `insert into poll_options (id, poll_id, label, sort_order) values ($1, $2, $3, $4)`,
      [`${SEED_POLL_ID}-${i + 1}`, SEED_POLL_ID, SEED_OPTIONS[i], i],
    );
  }
}

/** Insert a poll and its options; returns the new poll id. */
export async function createPoll(
  sql: Sql,
  question: string,
  labels: string[],
  creatorId?: string | null,
  voterNoteLabel = "",
  maxChoices = 1,
  writeInLabel = "",
  rosterNames: string[] = [],
): Promise<string> {
  const id = crypto.randomUUID();
  await sql.query(
    `insert into polls (id, question, creator_id, voter_note_label, max_choices)
     values ($1, $2, $3, $4, $5)`,
    [id, question, creatorId ?? null, voterNoteLabel, maxChoices],
  );
  for (let i = 0; i < labels.length; i += 1) {
    await sql.query(
      `insert into poll_options (id, poll_id, label, sort_order, is_write_in)
       values ($1, $2, $3, $4, false)`,
      [crypto.randomUUID(), id, labels[i], i],
    );
  }
  const fill = writeInLabel.trim();
  if (fill) {
    await sql.query(
      `insert into poll_options (id, poll_id, label, sort_order, is_write_in)
       values ($1, $2, $3, $4, true)`,
      [crypto.randomUUID(), id, fill, labels.length],
    );
  }
  if (rosterNames.length > 0) {
    await setRoster(sql, id, rosterNames);
  }
  return id;
}

/** Newest-first poll summaries for the list page. Draws are fetched
 *  separately (listDraws) so neither page's payload carries the other kind. */
export async function listPolls(
  sql: Sql,
  limit = 50,
  kind: "poll" | "all" = "poll",
): Promise<PollSummary[]> {
  const where = kind === "all" ? "" : `where p.kind = $2`;
  const params: unknown[] = [limit];
  if (kind !== "all") params.push(kind);
  const rows = await sql.query<{
    id: string;
    question: string;
    kind: string;
    total: number;
    closed: boolean;
    created_ms: number;
  }>(
    `select p.id, p.question, p.kind,
            count(v.id)::int as total,
            (p.closed_at is not null) as closed,
            (extract(epoch from p.created_at) * 1000)::bigint as created_ms
     from polls p
     left join poll_options o on o.poll_id = p.id
     left join poll_votes v on v.option_id = o.id
     ${where}
     group by p.id, p.question, p.kind, p.created_at, p.closed_at
     order by p.created_at desc
     limit $1`,
    params,
  );
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    kind: row.kind,
    total: Number(row.total),
    closed: Boolean(row.closed),
    createdAtMs: Number(row.created_ms),
  }));
}

/**
 * Cast a ballot as `key` on the current live poll (or `pollId` when given).
 * `optionId` may be one id or several. A `poll_ballots` row makes a second
 * submission a no-op even when they pick more than one option.
 */
export async function castVote(
  sql: Sql,
  key: string,
  optionId: string | string[],
  voterNote: string,
  pollId?: string,
  writeInText = "",
): Promise<LivePoll> {
  const live = await readPoll(sql, key, pollId);
  if (!live) throw new Error("没有进行中的投票");
  if (live.closed) throw new Error("投票已结束");
  if (live.votedIds.length > 0) return live;

  const asks = pollAsksForNote(live.voterNoteLabel);
  const note = asks ? voterNote.trim() : "";
  if (asks && !note) throw new Error(`请先填写${live.voterNoteLabel.trim()}`);

  // 名单核对:配了名单的投票,只有名单内的姓名能参与,且每个姓名限一次。
  if (await rosterExists(sql, live.id)) {
    if (!note) throw new Error("请先填写姓名");
    if (!(await rosterHas(sql, live.id, note))) {
      throw new Error("姓名不在名单中");
    }
    if (await rosterTaken(sql, live.id, note)) {
      throw new Error("该姓名已参与");
    }
  }

  const wanted = [
    ...new Set((Array.isArray(optionId) ? optionId : [optionId]).filter(Boolean)),
  ];
  const cap = effectiveMaxChoices(live.maxChoices, live.options.length);
  if (wanted.length < 1) throw new Error("请至少选一项");
  if (wanted.length > cap) {
    throw new Error(cap <= 1 ? "每人一票" : `最多选 ${cap} 项`);
  }
  const writeInOption = live.options.find((row) => row.isWriteIn);
  const pickingWriteIn = Boolean(writeInOption && wanted.includes(writeInOption.id));
  const fill = pickingWriteIn ? writeInText.trim() : "";
  if (pickingWriteIn && !fill) throw new Error("请填写自己的选项");
  for (const id of wanted) {
    if (!live.options.some((row) => row.id === id)) throw new Error("选项不存在");
  }

  const claimed = await sql.query<{ voter_key: string }>(
    `insert into poll_ballots (poll_id, voter_key) values ($1, $2)
     on conflict (poll_id, voter_key) do nothing
     returning voter_key`,
    [live.id, key],
  );
  if (claimed.length === 0) {
    const next = await readPoll(sql, key, live.id);
    if (!next) throw new Error("投票失败");
    return next;
  }

  try {
    for (const id of wanted) {
      await sql.query(
        `insert into poll_votes
           (id, poll_id, option_id, voter_key, voter_note, write_in_text)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (poll_id, voter_key, option_id) do nothing`,
        [
          crypto.randomUUID(),
          live.id,
          id,
          key,
          note,
          writeInOption && id === writeInOption.id ? fill : "",
        ],
      );
    }
  } catch (err) {
    await sql.query(`delete from poll_ballots where poll_id = $1 and voter_key = $2`, [
      live.id,
      key,
    ]);
    throw err;
  }

  if (note) {
    await rememberVoterName(sql, key, note);
  }

  const next = await readPoll(sql, key, live.id);
  if (!next) throw new Error("投票失败");
  return next;
}

/** Upsert the admin-only name for this device. Public reads never see voter_key. */
export async function rememberVoterName(
  sql: Sql,
  key: string,
  displayName: string,
): Promise<void> {
  const name = displayName.trim();
  if (!name) return;
  await sql.query(
    `insert into voter_profiles (voter_key, display_name) values ($1, $2)
     on conflict (voter_key) do update
       set display_name = excluded.display_name, updated_at = now()`,
    [key, name],
  );
}

/** Newest-first roster for the signed-in admin. */
export async function listVoterProfiles(sql: Sql): Promise<VoterProfileRow[]> {
  const rows = await sql.query<{
    display_name: string;
    updated_ms: number;
    poll_count: number;
  }>(
    `select p.display_name,
            (extract(epoch from p.updated_at) * 1000)::bigint as updated_ms,
            count(distinct v.poll_id)::int as poll_count
     from voter_profiles p
     left join poll_votes v on v.voter_key = p.voter_key
     group by p.voter_key, p.display_name, p.updated_at
     order by p.updated_at desc`,
  );
  return rows.map((row) => ({
    displayName: row.display_name,
    updatedAtMs: Number(row.updated_ms),
    pollCount: Number(row.poll_count),
  }));
}

/**
 * Close a poll as its creator. Reads-then-writes so the error messages are
 * exact; only the creator's own id (checked server-side via authMiddleware)
 * may close, and a closed poll stays closed.
 */
export async function closePoll(
  sql: Sql,
  pollId: string,
  userId: string,
): Promise<void> {
  const rows = await sql.query<{
    creator_id: string | null;
    closed: boolean;
  }>(
    `select creator_id, (closed_at is not null) as closed
     from polls where id = $1 limit 1`,
    [pollId],
  );
  const poll = rows[0];
  if (!poll) throw new Error("没有这个投票");
  if (poll.creator_id !== userId) throw new Error("只有发起人能结束投票");
  if (poll.closed) throw new Error("投票已经结束了");

  await sql.query(
    `update polls set closed_at = now() where id = $1 and closed_at is null`,
    [pollId],
  );
}
