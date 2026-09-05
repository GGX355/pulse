import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  drawLiveOnce,
  fetchContentById,
  listDrawClaims,
} from "@/lib/draw-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { DrawPoll } from "@/lib/draw-repo";
import { Button } from "@/components/ui/button";

/**
 * The draw experience: one big button, a slot-machine roll for suspense, then
 * the reveal. Live refetch keeps slot depletion honest while the crowd draws.
 */
export function DrawView({
  initialData,
  pollId,
}: {
  initialData: DrawPoll;
  pollId: string;
}) {
  const queryClient = useQueryClient();
  const contentKey = ["content", pollId] as const;
  const query = useQuery({
    queryKey: contentKey,
    queryFn: () => fetchContentById({ data: { contentId: pollId } }),
    initialData: { kind: "draw" as const, draw: initialData },
    refetchInterval: 1500,
  });
  const draw = query.data?.kind === "draw" ? query.data.draw : initialData;

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
      queryClient.setQueryData(contentKey, { kind: "draw" as const, draw: result });
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

  const myLabel = draw.myDraw?.label ?? null;
  const finiteRemaining = draw.slots.reduce(
    (sum, slot) => sum + (slot.remaining ?? 0),
    0,
  );
  const status = draw.closed
    ? "已结束"
    : draw.allTaken
      ? "全部抽完"
      : `剩 ${finiteRemaining} 个有限签`;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted">现场抽签</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
          {draw.title}
          {draw.closed ? <span className="stamp ml-3 align-middle">已结束</span> : null}
        </h1>
        <p className="mt-2 text-sm tabular-nums text-muted">
          已抽 {draw.totalTaken} 人 · {status}
        </p>
      </div>

      <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-6 text-center">
        {spinning ? (
          <span className="animate-pulse font-display text-4xl font-semibold tracking-tight text-foreground">
            {rollLabel}
          </span>
        ) : myLabel ? (
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
            <p className="text-xs text-muted">每人一次,抽完定局。</p>
          </>
        )}
        {drawMut.isError ? (
          <p className="form-error text-sm text-muted">没抽成,再试一次。</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
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
                      : `剩 ${Math.max(0, slot.remaining ?? 0)}/${slot.count}`}
                  </span>
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <ClaimList pollId={pollId} creatorId={draw.creatorId} />
    </section>
  );
}

/** 发起人专属的兑奖名单;服务端校验,前端只负责藏起来。 */
function ClaimList({
  pollId,
  creatorId,
}: {
  pollId: string;
  creatorId: string | null;
}) {
  const { user } = useCurrentUserState();
  const isCreator = Boolean(user) && user?.id === creatorId;
  const claims = useQuery({
    queryKey: ["draw-claims", pollId],
    queryFn: () => listDrawClaims({ data: { pollId } }),
    enabled: isCreator,
  });

  if (!isCreator || !claims.data || claims.data.length === 0) return null;

  return (
    <details className="mt-2 rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-xs font-medium tracking-wide text-muted">
        兑奖名单({claims.data.length} 人,仅你可见)
      </summary>
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
              })}
              <span
                className="ml-2"
                suppressHydrationWarning
              >
                {claim.voterMasked}
              </span>
            </span>
            <span className="font-medium text-foreground">{claim.label}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
