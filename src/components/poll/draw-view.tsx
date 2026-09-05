import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  drawLiveOnce,
  fetchDrawAdmin,
  fetchDrawById,
  listDrawClaims,
} from "@/lib/draw-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { DrawView } from "@/lib/draw-repo";
import { Button } from "@/components/ui/button";

/**
 * The draw experience, blind by default: before you draw there are no numbers
 * anywhere — no taken counts, no remaining, no total, just the slot names on
 * face-down cards. Drawing flips your card and only then reveals the whole
 * picture (your pick plus everyone else's). Live refetch keeps the revealed
 * state honest while the crowd draws; the blind state barely changes, so it
 * polls slowly.
 */
export function DrawView({
  initialData,
  pollId,
}: {
  initialData: DrawView;
  pollId: string;
}) {
  const queryClient = useQueryClient();
  const contentKey = ["draw-view", pollId] as const;
  const query = useQuery({
    queryKey: contentKey,
    queryFn: () => fetchDrawById({ data: { drawId: pollId } }),
    initialData: initialData,
    // 盲选时没人需要新数字,慢慢轮;揭晓后 1.5s 跟上现场。
    refetchInterval: (q) => (q.state.data?.blind ? 4000 : 1500),
  });
  const draw = query.data ?? initialData;

  const [spinning, setSpinning] = useState(false);
  const [rollLabel, setRollLabel] = useState("");
  const rollTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (rollTimer.current) window.clearInterval(rollTimer.current);
    };
  }, []);

  const drawMut = useMutation({
    mutationFn: () => drawLiveOnce({ data: { pollId } }),
    onSuccess: (result) => {
      queryClient.setQueryData(contentKey, result);
      // Keep the roll running a beat past the server answer, then land.
      rollTimer.current = window.setTimeout(() => {
        if (rollTimer.current && typeof rollTimer.current === "number") {
          window.clearInterval(rollTimer.current);
          rollTimer.current = null;
        }
        setSpinning(false);
      }, 1100);
    },
    onError: () => {
      if (rollTimer.current && typeof rollTimer.current === "number") {
        window.clearInterval(rollTimer.current);
        rollTimer.current = null;
      }
      setSpinning(false);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contentKey });
    },
  });

  function startDraw() {
    if (spinning || drawMut.isPending || draw.closed || draw.allTaken) return;
    const labels = draw.slots.map((slot) => slot.label);
    if (labels.length === 0) return;
    let index = 0;
    setRollLabel(labels[0]);
    setSpinning(true);
    rollTimer.current = window.setInterval(() => {
      index = (index + 1) % labels.length;
      setRollLabel(labels[index]);
    }, 90);
    drawMut.mutate();
  }

  const revealed = !draw.blind;
  const myLabel = draw.myDraw?.label ?? null;

  const status = draw.closed
    ? "已结束 · 结果已公开"
    : draw.allTaken
      ? "已经抽完了"
      : draw.blind
        ? "盲选中 · 抽之前看不到任何人数和结果"
        : `共 ${draw.totalTaken} 人已抽`;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted">现场抽签</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
          {draw.title}
          {draw.closed ? <span className="stamp ml-3 align-middle">已结束</span> : null}
        </h1>
        <p className="mt-2 text-sm tabular-nums text-muted">{status}</p>
      </div>

      <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-6 text-center">
        {spinning ? (
          <span className="animate-pulse font-display text-4xl font-semibold tracking-tight text-foreground">
            {rollLabel}
          </span>
        ) : revealed && myLabel ? (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <p className="text-sm text-muted">你抽到了</p>
            <p className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
              {myLabel}
            </p>
          </div>
        ) : draw.closed || draw.allTaken ? (
          <p className="text-sm text-muted">
            {draw.allTaken ? "签已经全部抽完了。" : "这场抽签已经结束。"}
          </p>
        ) : (
          <>
            <Button size="lg" disabled={drawMut.isPending} onClick={startDraw}>
              {drawMut.isPending ? "抽取中…" : "抽一次"}
            </Button>
            <p className="text-xs text-muted">
              每人一次 · 点下之前,谁抽到了什么一律保密
            </p>
          </>
        )}
        {drawMut.isError ? (
          <p className="form-error text-sm text-muted">没抽成,再试一次。</p>
        ) : null}
      </div>

      {draw.blind ? (
        <div className="draw-blind-grid">
          {draw.slots.map((slot, index) => (
            <div
              key={slot.id}
              className="draw-blind-card"
              style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
            >
              <span className="draw-blind-mark" aria-hidden>
                ?
              </span>
              <span className="block truncate font-medium text-foreground">
                {slot.label}
              </span>
              <span className="mt-0.5 block text-xs text-subtle">盲选 · 结果保密</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted">
            各签位情况 · 共 {draw.totalTaken} 人已抽
          </p>
          {draw.slots.map((slot) => {
            const fill =
              slot.count === -1 ? 0 : slot.count > 0 ? slot.taken / slot.count : 0;
            const isMine = draw.myDraw?.slotId === slot.id;
            return (
              <div
                key={slot.id}
                className="poll-option is-locked cursor-default"
                style={{ ["--fill" as string]: String(fill) }}
              >
                <span className="flex min-h-12 items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {slot.label}
                      {isMine ? (
                        <span className="poll-picked ml-2 text-xs text-accent">
                          你的签
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums text-sm text-muted">
                    <span className="block text-foreground">
                      {slot.count === -1
                        ? `不限量 · 已 ${slot.taken}`
                        : `已 ${slot.taken}/${slot.count}`}
                    </span>
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <DrawAdminPanel pollId={pollId} creatorId={draw.creatorId} />
    </section>
  );
}

/**
 * 发起人专属的实时后台:全量签位数字 + 兑奖名单,1.5s 自动刷新。
 * 服务端校验身份;前端只负责对其他人藏起来。
 */
function DrawAdminPanel({
  pollId,
  creatorId,
}: {
  pollId: string;
  creatorId: string | null;
}) {
  const { user } = useCurrentUserState();
  const isCreator = Boolean(user) && user?.id === creatorId;
  const [copied, setCopied] = useState(false);
  const claims = useQuery({
    queryKey: ["draw-claims", pollId],
    queryFn: () => listDrawClaims({ data: { pollId } }),
    enabled: isCreator,
    refetchInterval: 1500,
  });
  const stats = useQuery({
    queryKey: ["draw-admin", pollId],
    queryFn: () => fetchDrawAdmin({ data: { pollId } }),
    enabled: isCreator,
    refetchInterval: 1500,
  });

  if (!isCreator || !stats.data) return null;
  const data = stats.data;

  function exportClaims() {
    if (!claims.data) return;
    const lines = claims.data.map(
      (claim, index) =>
        `${index + 1}\t${new Date(claim.drewAtMs).toLocaleString("zh-CN")}\t${claim.voterMasked}\t${claim.label}`,
    );
    void navigator.clipboard
      .writeText(["时间\t抽签人\t结果", ...lines].join("\n"))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => undefined);
  }

  return (
    <details className="mt-2 rounded-xl border border-border bg-surface p-4" open>
      <summary className="cursor-pointer text-xs font-medium tracking-wide text-muted">
        后台数据(仅你可见 · 实时刷新)
      </summary>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border px-2.5 py-1 tabular-nums text-muted">
          已抽 {data.totalTaken} 人
        </span>
        {data.closed ? (
          <span className="rounded-full border border-border px-2.5 py-1 text-subtle">
            已结束
          </span>
        ) : data.allTaken ? (
          <span className="rounded-full border border-border px-2.5 py-1 text-subtle">
            全部抽完
          </span>
        ) : (
          <span className="rounded-full border border-accent/30 px-2.5 py-1 text-accent">
            <span className="live-dot mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" />
            抽签进行中
          </span>
        )}
        <button
          type="button"
          onClick={exportClaims}
          className="ml-auto rounded-full border border-border px-3 py-1 text-muted transition-colors hover:text-foreground"
        >
          {copied ? "已复制 ✓" : "复制名单"}
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {data.slots.map((slot) => {
          const fill =
            slot.count === -1 ? 0 : slot.count > 0 ? slot.taken / slot.count : 0;
          return (
            <div
              key={slot.id}
              className="poll-option is-locked cursor-default"
              style={{ ["--fill" as string]: String(fill) }}
            >
              <span className="flex min-h-10 items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground">
                  {slot.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {slot.count === -1
                    ? `不限量 · 已 ${slot.taken}`
                    : `${slot.taken}/${slot.count}${slot.remaining !== null && slot.remaining <= 0 ? " · 满" : ""}`}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {claims.data && claims.data.length > 0 ? (
        <div className="mt-3 flex flex-col divide-y divide-border">
          {claims.data.map((claim, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="tabular-nums text-muted">
                {new Date(claim.drewAtMs).toLocaleString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
                <span className="ml-2" suppressHydrationWarning>
                  {claim.voterMasked}
                </span>
              </span>
              <span className="font-medium text-foreground">{claim.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-subtle">
          还没人抽。名单会在这里按时间实时滚动。
        </p>
      )}
    </details>
  );
}
