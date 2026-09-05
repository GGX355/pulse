import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { readPoll, type LivePoll } from "./poll-repo";
import {
  createDraw,
  drawClaimList,
  drawOne,
  readDrawById,
  type DrawClaim,
  type DrawPoll,
} from "./draw-repo";

export type { DrawPoll, DrawSlot, DrawClaim } from "./draw-repo";

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

/**
 * One fetch for the shared detail route: dispatches on content kind so
 * `/poll/:id` renders either a live poll or a draw without knowing which
 * up front. Reading a poll here reuses poll-repo unchanged.
 */
export type PollContent =
  | { kind: "poll"; poll: LivePoll }
  | { kind: "draw"; draw: DrawPoll };

export const fetchContentById = createServerFn({ method: "GET" })
  .validator(z.object({ contentId: z.string().min(1) }))
  .handler(async ({ data }): Promise<PollContent | null> => {
    const sql = await getDb();
    const key = voterKey();
    const rows = await sql.query<{ kind: string }>(
      `select kind from polls where id = $1 limit 1`,
      [data.contentId],
    );
    if (!rows[0]) return null;
    if (rows[0].kind === "draw") {
      const draw = await readDrawById(sql, key, data.contentId);
      return draw ? { kind: "draw", draw } : null;
    }
    const poll = await readPoll(sql, key, data.contentId);
    return poll ? { kind: "poll", poll } : null;
  });

export const createDrawLive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        title: z.string().trim().min(1).max(80),
        slots: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(40),
              count: z.number().int().min(1).max(999),
            }),
          )
          .min(1)
          .max(12),
        blankMode: z.enum(["count", "unlimited", "none"]),
        blankLabel: z.string().trim().max(10),
        blankCount: z.number().int().min(1).max(99999),
      })
      .refine(
        (data) =>
          data.blankMode === "none" ||
          data.blankLabel.length > 0 ||
          data.slots.every(() => true),
        { message: "未中签位需要一个文案" },
      ),
  )
  .handler(async ({ data, context }): Promise<DrawPoll> => {
    const sql = await getDb();
    const key = voterKey();
    const id = await createDraw(sql, context.userId, {
      title: data.title.trim(),
      slots: data.slots.map((slot) => ({
        label: slot.label.trim(),
        count: slot.count,
      })),
      blankLabel:
        data.blankMode === "none" ? null : data.blankLabel.trim() || "未中",
      blankCount: data.blankMode === "count" ? data.blankCount : null,
    });
    const draw = await readDrawById(sql, key, id);
    if (!draw) throw new Error("创建失败");
    return draw;
  });

export const drawLiveOnce = createServerFn({ method: "POST" })
  .validator(z.object({ pollId: z.string().min(1) }))
  .handler(async ({ data }): Promise<DrawPoll> => {
    const sql = await getDb();
    const key = voterKey();
    return drawOne(sql, key, data.pollId);
  });

export const listDrawClaims = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ pollId: z.string().min(1) }))
  .handler(async ({ data, context }): Promise<DrawClaim[]> => {
    const sql = await getDb();
    return drawClaimList(sql, data.pollId, context.userId);
  });
