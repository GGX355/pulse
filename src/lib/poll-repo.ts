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
};

export type Sql = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
};

const SEED_POLL_ID = "seed-lunch";
const SEED_OPTIONS = ["拉面", "便当", "沙拉", "随便"];

/** The newest poll with live counts, plus whether `key` has voted on it. */
export async function readLivePoll(sql: Sql, key: string): Promise<LivePoll | null> {
  const polls = await sql.query<{ id: string; question: string }>(
    `select id, question from polls order by created_at desc limit 1`,
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
): Promise<string> {
  const id = crypto.randomUUID();
  await sql.query(`insert into polls (id, question) values ($1, $2)`, [
    id,
    question,
  ]);
  for (let i = 0; i < labels.length; i += 1) {
    await sql.query(
      `insert into poll_options (id, poll_id, label, sort_order) values ($1, $2, $3, $4)`,
      [crypto.randomUUID(), id, labels[i], i],
    );
  }
  return id;
}

/**
 * Cast one vote as `key` on the current live poll. Returns the poll state
 * after the attempt. The `unique (poll_id, voter_key)` constraint makes repeat
 * votes a no-op — the re-read below is what keeps the response honest even
 * under a race.
 */
export async function castVote(
  sql: Sql,
  key: string,
  optionId: string,
): Promise<LivePoll> {
  const live = await readLivePoll(sql, key);
  if (!live) throw new Error("没有进行中的投票");
  if (live.votedId) return live;

  const option = live.options.find((row) => row.id === optionId);
  if (!option) throw new Error("选项不存在");

  await sql.query(
    `insert into poll_votes (id, poll_id, option_id, voter_key)
     values ($1, $2, $3, $4)
     on conflict (poll_id, voter_key) do nothing`,
    [crypto.randomUUID(), live.id, optionId, key],
  );

  const next = await readLivePoll(sql, key);
  if (!next) throw new Error("投票失败");
  return next;
}
