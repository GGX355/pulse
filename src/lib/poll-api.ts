import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

const VOTER_COOKIE = "pulse_vk";
const VOTER_MAX_AGE = 60 * 60 * 24 * 400;
const SEED_POLL_ID = "seed-lunch";

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

type Sql = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
};

async function getDb(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function voterKey(): string {
  let key = getCookie(VOTER_COOKIE);
  if (!key) {
    key = crypto.randomUUID();
    setCookie(VOTER_COOKIE, key, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: VOTER_MAX_AGE,
    });
  }
  return key;
}

async function readLivePoll(sql: Sql, key: string): Promise<LivePoll | null> {
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

async function seedIfEmpty(sql: Sql): Promise<void> {
  const existing = await sql.query<{ n: number }>(
    `select count(*)::int as n from polls`,
  );
  if ((existing[0]?.n ?? 0) > 0) return;

  await sql.query(`insert into polls (id, question) values ($1, $2)`, [
    SEED_POLL_ID,
    "午饭吃什么？",
  ]);
  const labels = ["拉面", "便当", "沙拉", "随便"];
  for (let i = 0; i < labels.length; i += 1) {
    await sql.query(
      `insert into poll_options (id, poll_id, label, sort_order) values ($1, $2, $3, $4)`,
      [`${SEED_POLL_ID}-${i + 1}`, SEED_POLL_ID, labels[i], i],
    );
  }
}

export const fetchLivePoll = createServerFn({ method: "GET" }).handler(
  async (): Promise<LivePoll> => {
    const sql = await getDb();
    const key = voterKey();
    await seedIfEmpty(sql);
    const poll = await readLivePoll(sql, key);
    if (!poll) throw new Error("没有进行中的投票");
    return poll;
  },
);

export const createLivePoll = createServerFn({ method: "POST" })
  .validator(
    z.object({
      question: z.string().trim().min(1).max(80),
      options: z.array(z.string().trim().min(1).max(40)).min(2).max(8),
    }),
  )
  .handler(async ({ data }): Promise<LivePoll> => {
    const sql = await getDb();
    const key = voterKey();
    const id = crypto.randomUUID();
    await sql.query(`insert into polls (id, question) values ($1, $2)`, [
      id,
      data.question.trim(),
    ]);
    const labels = data.options.map((label) => label.trim()).filter(Boolean);
    for (let i = 0; i < labels.length; i += 1) {
      await sql.query(
        `insert into poll_options (id, poll_id, label, sort_order) values ($1, $2, $3, $4)`,
        [crypto.randomUUID(), id, labels[i], i],
      );
    }
    const poll = await readLivePoll(sql, key);
    if (!poll) throw new Error("创建失败");
    return poll;
  });

export const castVote = createServerFn({ method: "POST" })
  .validator(z.object({ optionId: z.string().min(1) }))
  .handler(async ({ data }): Promise<LivePoll> => {
    const sql = await getDb();
    const key = voterKey();
    const live = await readLivePoll(sql, key);
    if (!live) throw new Error("没有进行中的投票");
    if (live.votedId) return live;

    const option = live.options.find((row) => row.id === data.optionId);
    if (!option) throw new Error("选项不存在");

    await sql.query(
      `insert into poll_votes (id, poll_id, option_id, voter_key)
       values ($1, $2, $3, $4)
       on conflict (poll_id, voter_key) do nothing`,
      [crypto.randomUUID(), live.id, option.id, key],
    );

    const next = await readLivePoll(sql, key);
    if (!next) throw new Error("投票失败");
    return next;
  });
