/**
 * Pure data layer for polls: every function takes a `Sql` handle plus plain
 * values, so the same rules run inside server functions and in node tests —
 * no framework, cookies or env access in here.
 */
export type PollOption = {
  id: string;
  label: string;
  votes: number;
};

export type LivePoll = {
  id: string;
  question: string;
  options: PollOption[];
  total: number;
  votedId: string | null;
  /** Better Auth user id of the creator — null for pre-sign-in polls. */
  creatorId: string | null;
  /** True once the creator has closed the poll; votes are rejected after. */
  closed: boolean;
};

export type Sql = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
};

const SEED_POLL_ID = "seed-lunch";
const SEED_OPTIONS = ["拉面", "便当", "沙拉", "随便"];

/** One row of the polls list: newest-first summaries for /polls. */
export type PollSummary = {
  id: string;
  question: string;
  total: number;
  closed: boolean;
  /** Epoch milliseconds — int8 comes back as number via the db type parsers. */
  createdAtMs: number;
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
      }>(
        `select id, question, creator_id, (closed_at is not null) as closed
         from polls where id = $1 limit 1`,
        [pollId],
      )
    : await sql.query<{
        id: string;
        question: string;
        creator_id: string | null;
        closed: boolean;
      }>(
        `select id, question, creator_id, (closed_at is not null) as closed
         from polls order by created_at desc limit 1`,
      );
  const poll = polls[0];
  if (!poll) return null;

  const options = await sql.query<{
    id: string;
    label: string;
    votes: number;
  }>(
    `select o.id, o.label,
            coalesce(count(v.id), 0)::int as votes
     from poll_options o
     left join poll_votes v on v.option_id = o.id
     where o.poll_id = $1
     group by o.id, o.label, o.sort_order
     order by o.sort_order asc`,
    [poll.id],
  );

  const mine = await sql.query<{ option_id: string }>(
    `select option_id from poll_votes where poll_id = $1 and voter_key = $2 limit 1`,
    [poll.id, key],
  );

  const total = options.reduce((sum, row) => sum + Number(row.votes), 0);
  return {
    id: poll.id,
    question: poll.question,
    options: options.map((row) => ({
      id: row.id,
      label: row.label,
      votes: Number(row.votes),
    })),
    total,
    votedId: mine[0]?.option_id ?? null,
    creatorId: poll.creator_id,
    closed: Boolean(poll.closed),
  };
}

/** Create the demo poll once, so an empty database still shows something. */
export async function seedIfEmpty(sql: Sql): Promise<void> {
  const existing = await sql.query<{ n: number }>(
    `select count(*)::int as n from polls`,
  );
  if ((existing[0]?.n ?? 0) > 0) return;

  await sql.query(`insert into polls (id, question) values ($1, $2)`, [
    SEED_POLL_ID,
    "午饭吃什么？",
  ]);
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
): Promise<string> {
  const id = crypto.randomUUID();
  await sql.query(
    `insert into polls (id, question, creator_id) values ($1, $2, $3)`,
    [id, question, creatorId ?? null],
  );
  for (let i = 0; i < labels.length; i += 1) {
    await sql.query(
      `insert into poll_options (id, poll_id, label, sort_order) values ($1, $2, $3, $4)`,
      [crypto.randomUUID(), id, labels[i], i],
    );
  }
  return id;
}

/** Newest-first poll summaries for the list page. */
export async function listPolls(sql: Sql, limit = 50): Promise<PollSummary[]> {
  const rows = await sql.query<{
    id: string;
    question: string;
    total: number;
    closed: boolean;
    created_ms: number;
  }>(
    `select p.id, p.question,
            count(v.id)::int as total,
            (p.closed_at is not null) as closed,
            (extract(epoch from p.created_at) * 1000)::bigint as created_ms
     from polls p
     left join poll_options o on o.poll_id = p.id
     left join poll_votes v on v.option_id = o.id
     group by p.id, p.question, p.created_at, p.closed_at
     order by p.created_at desc
     limit $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    total: Number(row.total),
    closed: Boolean(row.closed),
    createdAtMs: Number(row.created_ms),
  }));
}

/**
 * Cast one vote as `key` on the current live poll (or `pollId` when given).
 * Returns the poll state after the attempt. The `unique (poll_id, voter_key)`
 * constraint makes repeat votes a no-op — the re-read below is what keeps the
 * response honest even under a race.
 */
export async function castVote(
  sql: Sql,
  key: string,
  optionId: string,
  pollId?: string,
): Promise<LivePoll> {
  const live = await readPoll(sql, key, pollId);
  if (!live) throw new Error("没有进行中的投票");
  if (live.closed) throw new Error("投票已结束");
  if (live.votedId) return live;

  const option = live.options.find((row) => row.id === optionId);
  if (!option) throw new Error("选项不存在");

  await sql.query(
    `insert into poll_votes (id, poll_id, option_id, voter_key)
     values ($1, $2, $3, $4)
     on conflict (poll_id, voter_key) do nothing`,
    [crypto.randomUUID(), live.id, optionId, key],
  );

  const next = await readPoll(sql, key, live.id);
  if (!next) throw new Error("投票失败");
  return next;
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
