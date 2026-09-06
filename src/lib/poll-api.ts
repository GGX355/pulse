import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { rosterStatus, type RosterStatus } from "./roster";
import {
  castVote as castRepoVote,
  closePoll as closeRepoPoll,
  createPoll,
  listPolls,
  listVoterProfiles as listRepoVoterProfiles,
  readPoll,
  seedIfEmpty,
  voteDetails as voteDetailsRepo,
  type LivePoll,
  type PollSummary,
  type VoteDetailRow,
} from "./poll-repo";

export type { LivePoll, PollOption, PollSummary, VoterProfileRow } from "./poll-repo";
export type { RosterEntry, RosterStatus } from "./roster";
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
      roster: z.array(z.string().trim().min(1).max(40)).max(500),
      description: z.string().trim().max(120).optional(),
      // 投票截止时间(datetime-local 本地串);空 = 不限。
      closesAtISO: z.string().trim().max(40).optional(),
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
    // 配了名单就必须记名 —— 没填提示时默认按「姓名」。
    const noteLabel =
      data.roster.length > 0 && !data.voterNoteLabel.trim()
        ? "姓名"
        : data.voterNoteLabel.trim();
    const pollId = await createPoll(
      sql,
      data.question.trim(),
      labels,
      context.userId,
      noteLabel,
      data.maxChoices,
      data.writeInLabel.trim(),
      data.roster,
      data.description ?? "",
      data.closesAtISO ? new Date(data.closesAtISO) : null,
    );
    // 按刚创建的 id 读:不带 id 会读「最新进行中投票」,两管理员并发创建
    // 时创建者可能被带到别人的投票。
    const poll = await readPoll(sql, key, pollId);
    if (!poll) throw new Error("创建失败");
    return poll;
  });

export const listVoterProfiles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<import("./poll-repo").VoterProfileRow[]> => {
    const sql = await getDb();
    return listRepoVoterProfiles(sql);
  });

/** 发起人专属:名单核对(谁已参与/谁未参与 + 结果)。 */
export const fetchRosterStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ pollId: z.string().min(1) }))
  .handler(async ({ data, context }): Promise<RosterStatus> => {
    const sql = await getDb();
    const rows = await sql.query<{ creator_id: string | null }>(
      `select creator_id from polls where id = $1 limit 1`,
      [data.pollId],
    );
    if (!rows[0]) throw new Error("内容不存在");
    // 无主(建号系统前)内容:登录者可视作发起人管理。
    if (rows[0].creator_id !== null && rows[0].creator_id !== context.userId) {
      throw new Error("只有发起人能查看名单核对");
    }
    return rosterStatus(sql, data.pollId);
  });

/** 发起人专属:记名投票的参与明细(谁选了什么)。 */
export const fetchVoteDetails = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ pollId: z.string().min(1) }))
  .handler(async ({ data, context }): Promise<VoteDetailRow[]> => {
    const sql = await getDb();
    return voteDetailsRepo(sql, data.pollId, context.userId);
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
