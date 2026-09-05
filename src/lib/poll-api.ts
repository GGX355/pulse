import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  castVote as castRepoVote,
  closePoll as closeRepoPoll,
  createPoll,
  listPolls,
  listVoterProfiles as listRepoVoterProfiles,
  readPoll,
  seedIfEmpty,
  type LivePoll,
  type PollSummary,
} from "./poll-repo";

export type { LivePoll, PollOption, PollSummary, VoterProfileRow } from "./poll-repo";
export { effectiveMaxChoices } from "./poll-repo";

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
    const poll = await readPoll(sql, key);
    if (!poll) throw new Error("没有进行中的投票");
    return poll;
  },
);

export const fetchPollById = createServerFn({ method: "GET" })
  .validator(z.object({ pollId: z.string().min(1) }))
  .handler(async ({ data }): Promise<LivePoll | null> => {
    const sql = await getDb();
    const key = voterKey();
    return readPoll(sql, key, data.pollId);
  });

export const fetchPollList = createServerFn({ method: "GET" }).handler(
  async (): Promise<PollSummary[]> => {
    const sql = await getDb();
    await seedIfEmpty(sql);
    // 列表页只出投票;抽签走 /draw(fetchDrawList),两边互不掺数据。
    return listPolls(sql, 50, "poll");
  },
);

export const createLivePoll = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      question: z.string().trim().min(1).max(80),
      options: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
      voterNoteLabel: z.string().trim().max(20),
      maxChoices: z.number().int().min(0).max(8),
      writeInLabel: z.string().trim().max(40),
    }).refine(
      (data) => {
        const extra = data.writeInLabel ? 1 : 0;
        const n = data.options.length + extra;
        return n >= 2 && n <= 8;
      },
      { message: "至少两个选项，填空也算一项" },
    ),
  )
  .handler(async ({ data, context }): Promise<LivePoll> => {
    const sql = await getDb();
    const key = voterKey();
    const labels = data.options.map((label) => label.trim()).filter(Boolean);
    await createPoll(
      sql,
      data.question.trim(),
      labels,
      context.userId,
      data.voterNoteLabel.trim(),
      data.maxChoices,
      data.writeInLabel.trim(),
    );
    const poll = await readPoll(sql, key);
    if (!poll) throw new Error("创建失败");
    return poll;
  });

export const listVoterProfiles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<import("./poll-repo").VoterProfileRow[]> => {
    const sql = await getDb();
    return listRepoVoterProfiles(sql);
  });

export const closeLivePoll = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ pollId: z.string().min(1) }))
  .handler(async ({ data, context }): Promise<void> => {
    const sql = await getDb();
    await closeRepoPoll(sql, data.pollId, context.userId);
  });

export const castVote = createServerFn({ method: "POST" })
  .validator(
    z.object({
      optionIds: z.array(z.string().min(1)).min(1).max(8),
      note: z.string().trim().max(40).optional(),
      writeInText: z.string().trim().max(40).optional(),
      pollId: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ data }): Promise<LivePoll> => {
    const sql = await getDb();
    const key = voterKey();
    return castRepoVote(
      sql,
      key,
      data.optionIds,
      data.note ?? "",
      data.pollId,
      data.writeInText ?? "",
    );
  });
