import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  castVote as castRepoVote,
  createPoll,
  readLivePoll,
  seedIfEmpty,
  type LivePoll,
} from "./poll-repo";

export type { LivePoll, PollOption } from "./poll-repo";

const VOTER_COOKIE = "pulse_vk";
const VOTER_MAX_AGE = 60 * 60 * 24 * 400;

async function getDb() {
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
    const labels = data.options.map((label) => label.trim()).filter(Boolean);
    await createPoll(sql, data.question.trim(), labels);
    const poll = await readLivePoll(sql, key);
    if (!poll) throw new Error("创建失败");
    return poll;
  });

export const castVote = createServerFn({ method: "POST" })
  .validator(z.object({ optionId: z.string().min(1) }))
  .handler(async ({ data }): Promise<LivePoll> => {
    const sql = await getDb();
    const key = voterKey();
    return castRepoVote(sql, key, data.optionId);
  });
