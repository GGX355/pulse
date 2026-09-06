import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  drawLiveOnce,
  fetchDrawAdmin,
  fetchDrawById,
  listDrawClaims,
} from "@/lib/draw-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type {
  DrawRevealedView,
  DrawView as DrawViewData,
} from "@/lib/draw-repo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RosterPanel } from "@/components/poll/roster-panel";
import { cn } from "@/lib/utils";
import { jelly, confetti } from "@/lib/motion";

/**
 * The draw experience, blind by default: before you draw there are no numbers
 * anywhere — no taken counts, no remaining, no total, just the slot names.
 * The reveal is theatrical and server-driven: whichever mode you pick
 * (flip / scratch / grid) fires the same drawLiveOnce and only stages how the
 * server's answer appears. Live refetch keeps the revealed state honest while
 * the crowd draws; the blind state barely changes, so it polls slowly.
 */

type Mode = "flip" | "scratch" | "grid";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "flip", label: "🂠 翻牌" },
  { id: "scratch", label: "✦ 刮奖" },
  { id: "grid", label: "▦ 九宫格" },
];

export function DrawView({
  initialData,
  pollId,
}: {
  initialData: DrawViewData;
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
  // 盲选/揭晓两种视图的 slots 统一为 {id,label}
  const slots: Array<{ id: string; label: string }> = draw.slots;

  // 揭晓演出状态:结果落定后先演动画,再切全场结果。
  const [mode, setMode] = useState<Mode>("flip");
  const [wallRevealed, setWallRevealed] = useState(!initialData.blind);
  const [flipping, setFlipping] = useState(false);
  const [mySlotId, setMySlotId] = useState(initialData.myDraw?.slotId ?? null);
  const [rolling, setRolling] = useState(false);
  const [rollLabel, setRollLabel] = useState("");
  const [scratchLabel, setScratchLabel] = useState("");
  const [scratchReady, setScratchReady] = useState(false);
  const [gridLit, setGridLit] = useState<number | null>(null);
  const [gridRolling, setGridRolling] = useState(false);
  const [gridWinLabel, setGridWinLabel] = useState<string | null>(null);
  const [gridDone, setGridDone] = useState(false);
  // 抽之前要填的那条信息(通常就是名字);服务端会再校验一次。
  const [note, setNote] = useState(initialData.myNote ?? "");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const segRef = useRef<HTMLDivElement | null>(null);
  const segMoverRef = useRef<HTMLSpanElement | null>(null);
  const rollTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rollTimer.current) window.clearInterval(rollTimer.current);
    };
  }, []);

  // seg 药丸滑到当前档位下面(含字体加载后的宽度变化)。
  useLayoutEffect(() => {
    const seg = segRef.current;
    const mover = segMoverRef.current;
    if (!seg || !mover) return;
    const place = () => {
      const active = seg.querySelector<HTMLElement>(".seg-item.on");
      if (!active) return;
      mover.style.left = `${active.offsetLeft}px`;
      mover.style.width = `${active.offsetWidth}px`;
    };
    place();
    const t = window.setTimeout(place, 200);
    addEventListener("resize", place);
    return () => {
      window.clearTimeout(t);
      removeEventListener("resize", place);
    };
  }, [mode]);

  const noteRequired = Boolean(initialData.blind && initialData.voterNoteLabel);
  const noteMissing = noteRequired && !note.trim();

  const drawMut = useMutation({
    mutationFn: () =>
      drawLiveOnce({ data: { pollId, note: note.trim() || undefined } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contentKey });
    },
  });

  /** 发起一次服务端抽签;揭晓视图返回结果,失败返回 null(isError 已展示)。 */
  async function drawOnce(): Promise<DrawRevealedView | null> {
    try {
      const result = await drawMut.mutateAsync();
      if (result.blind === false && result.myDraw) {
        setMySlotId(result.myDraw.slotId);
        return result;
      }
      return null;
    } catch {
      return null;
    }
  }

  function startRoll(labels: string[]) {
    let index = 0;
    setRollLabel(labels[0]);
    setRolling(true);
    rollTimer.current = window.setInterval(() => {
      index = (index + 1) % labels.length;
      setRollLabel(labels[index]);
    }, 105);
  }

  function stopRoll() {
    if (rollTimer.current && typeof rollTimer.current === "number") {
      window.clearInterval(rollTimer.current);
      rollTimer.current = null;
    }
    setRolling(false);
  }

  function finishReveal(myLabel: string) {
    if (myLabel === "一等奖") confetti(70);
    jelly(panelRef.current);
    window.setTimeout(() => setWallRevealed(true), 900);
  }

  function canDraw() {
    return (
      draw.blind &&
      !wallRevealed &&
      !drawMut.isPending &&
      !rolling &&
      !flipping &&
      !scratchReady &&
      !gridRolling &&
      !noteMissing &&
      !draw.closed &&
      !draw.allTaken
    );
  }

  /* ── 模式一:翻牌(点卡 → 滚动高光 → 服务端结果 → 我的卡翻面) ── */
  function flipPick(idx: number) {
    if (!canDraw()) return;
    startRoll(slots.map((slot) => slot.label));
    void drawOnce().then((result) => {
      stopRoll();
      if (!result || !result.myDraw) return;
      setFlipping(true);
      const units = document.querySelectorAll("#stage-flip .draw-blind-card");
      const u = units[idx] as HTMLElement | undefined;
      u?.animate(
        [
          { transform: "rotateY(0deg) scale(1)" },
          { transform: "rotateY(90deg) scale(1)" },
          { transform: "rotateY(180deg) scale(1)" },
        ],
        { duration: 700, easing: "cubic-bezier(.25,.7,.18,1)" },
      );
      window.setTimeout(() => {
        setFlipping(false);
        units.forEach((c, i) => {
          if (i !== idx) c.classList.add("dim-others");
        });
        finishReveal(result.myDraw!.label);
      }, 430);
    });
  }

  /* ── 模式二:刮奖(点牌 → 服务端结果上涂层 → 刮开揭晓) ── */
  function scratchPick() {
    if (!canDraw()) return;
    drawMut.mutate(undefined, {
      onSuccess: (result) => {
        if (result.blind === false && result.myDraw) {
          setScratchLabel(result.myDraw.label);
          setScratchReady(true);
        }
      },
    });
  }
  function initFoil() {
    const card = document.querySelector(".scratch-card");
    const cv = document.getElementById("draw-foil") as HTMLCanvasElement | null;
    if (!card || !cv) return;
    const w = card.clientWidth;
    const h = card.clientHeight;
    cv.width = w * devicePixelRatio;
    cv.height = h * devicePixelRatio;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#cdd1d9");
    g.addColorStop(0.25, "#a2a6b0");
    g.addColorStop(0.5, "#dde0e6");
    g.addColorStop(0.75, "#9296a0");
    g.addColorStop(1, "#c5c8d0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.28)";
    ctx.lineWidth = 1;
    for (let x = -h; x < w; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h, 0);
      ctx.stroke();
    }
    ctx.fillStyle = "#5a5f6a";
    ctx.font = "800 24px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("刮开此处", w / 2, h / 2 - 14);
    ctx.font = "600 12px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "#6d727c";
    ctx.fillText("SCRATCH HERE", w / 2, h / 2 + 16);
    let scratching = false;
    let last: { x: number; y: number } | null = null;
    let moves = 0;
    const pos = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const stroke = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 34;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 17, 0, 7);
      ctx.fill();
    };
    cv.onpointerdown = (e: PointerEvent) => {
      scratching = true;
      last = pos(e);
      stroke(last, last);
      e.preventDefault();
    };
    cv.onpointermove = (e: PointerEvent) => {
      if (!scratching) return;
      const p = pos(e);
      stroke(last!, p);
      last = p;
      if (++moves % 6 === 0) scratchCheck();
      e.preventDefault();
    };
    cv.onpointerup = () => {
      scratching = false;
      scratchCheck();
    };
    cv.onpointerleave = () => {
      scratching = false;
    };
  }
  function scratchCheck() {
    const cv = document.getElementById("draw-foil") as HTMLCanvasElement | null;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 16) {
      total++;
      if (data[i] === 0) clear++;
    }
    if (clear / total > 0.42 && !cv.classList.contains("clear")) {
      cv.classList.add("clear");
      if (scratchLabel === "一等奖") confetti(70);
      jelly(panelRef.current);
      setWallRevealed(true);
    }
  }

  /* ── 模式三:九宫格(开始 → 服务端结果 → 跑灯落在对应格) ── */
  function gridCellLabel(cell: number): string {
    // 真实签位摊进偶数格,奇数格用「谢谢参与」补位(有该签位时用真签位)
    const labels = slots.map((s) => s.label);
    if (cell % 2 === 0) {
      return labels[cell / 2] || "谢谢参与";
    }
    return (
      labels.find(l => l === "谢谢参与") ??
      labels[labels.length - 1] ??
      "谢谢参与"
    );
  }
  function gridStart() {
    if (!canDraw()) return;
    drawMut.mutate(undefined, {
      onSuccess: (result) => {
        if (result.blind === false && result.myDraw) {
          runGridLights(result.myDraw.label);
        }
      },
    });
  }
  function runGridLights(label: string) {
    setGridRolling(true);
    const labels = Array.from({ length: 8 }, (_, c) => gridCellLabel(c));
    const order = [0, 1, 2, 4, 7, 6, 5, 3];
    const winCell = Math.max(
      0,
      labels.findIndex(l => l === label),
    );
    const winPos = order.indexOf(winCell);
    const landing = 22 + ((winPos + 8) % 8);
    const steps: Array<{ cell: number; delay: number }> = [];
    for (let i = 0; i <= landing; i++) {
      const t = i / landing;
      steps.push({
        cell: order[i % 8],
        delay: t < 0.72 ? 105 : 105 + Math.pow((t - 0.72) / 0.28, 1.6) * 480,
      });
    }
    let acc = 0;
    steps.forEach((st, k) => {
      acc += st.delay;
      window.setTimeout(() => {
        document
          .querySelectorAll(".cell9")
          .forEach(c => c.classList.remove("lit"));
        const el = document.querySelector(`.cell9[data-cell="${st.cell}"]`);
        el?.classList.add("lit");
        if (k === steps.length - 1) {
          el?.classList.remove("lit");
          el?.classList.add("win");
          setGridWinLabel(label);
          setGridDone(true);
          finishReveal(label);
          const go = document.getElementById("grid-go");
          if (go) go.textContent = "已抽完";
        }
      }, acc);
    });
  }

  const revealed = !draw.blind;
  const myLabel = draw.myDraw?.label ?? null;
  const closed = draw.closed || draw.allTaken;

  const status = draw.closed
    ? "已结束"
    : draw.allTaken
      ? "名额已抽完"
      : draw.blind
        ? "进行中 · 参与后公布结果"
        : `${draw.totalTaken} 人已参与`;

  const showInteractive = draw.blind && !wallRevealed && !closed;
  // 翻面演出的一秒钟里,运行时已是全量数据,但类型上仍是盲选视图
  const resultSlots: DrawRevealedView["slots"] = draw.blind
    ? wallRevealed
      ? (draw as unknown as DrawRevealedView).slots
      : []
    : draw.slots;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted">抽签</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
          {draw.title}
          {draw.closed ? <span className="stamp ml-3 align-middle">已结束</span> : null}
        </h1>
        <p className="mt-2 text-sm tabular-nums text-muted">{status}</p>
      </div>

      {showInteractive ? (
        <>
          {noteRequired ? (
            <div className="flex flex-col gap-1.5">
              <Input
                value={note}
                maxLength={40}
                placeholder={`请填写${initialData.voterNoteLabel}`}
                aria-label={initialData.voterNoteLabel}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="text-center text-xs text-subtle">
                抽签前需填写{initialData.voterNoteLabel} · 揭晓动画任选其一
              </p>
            </div>
          ) : null}

          <div ref={segRef} className="seg glass" data-seg>
            <span ref={segMoverRef} className="seg-mover" aria-hidden />
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn("seg-item", mode === m.id && "on")}
                onClick={() => {
                  if (rolling || flipping || scratchReady || gridRolling) return;
                  setMode(m.id);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div ref={panelRef} className="glass rounded-[var(--r-lg)] p-5 stage-panel">
            {/* 模式一:翻牌 */}
            <div className={cn("stage", mode === "flip" && "on")} id="stage-flip">
              <div className="draw-grid scene">
                {slots.map((slot, index) => {
                  const mine = mySlotId === slot.id;
                  return (
                    <div
                      key={slot.id}
                      className={cn(
                        "draw-blind-card",
                        mine && (flipping || wallRevealed || mySlotId === slot.id) && "is-flipping",
                        (flipping || wallRevealed) && !mine && "dim-others",
                      )}
                      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                      onClick={() => (mySlotId === null ? flipPick(index) : undefined)}
                    >
                      <div className="dc-face dc-front">
                        <span className="block truncate font-medium text-foreground">
                          {slot.label}
                        </span>
                      </div>
                      <div className="dc-face dc-back">
                        <span className="dc-back-label">你抽到了</span>
                        <span className="dc-back-value">{slot.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="tip">
                {rolling
                  ? `抽取中… ${rollLabel}`
                  : mySlotId !== null
                    ? "结果已定 · 全场揭晓"
                    : "点任意一张卡翻开"}
              </p>
            </div>

            {/* 模式二:刮奖 */}
            <div className={cn("stage", mode === "scratch" && "on")} id="stage-scratch">
              <div className="scratch-deck">
                {slots.slice(0, 3).map((slot, i) => (
                  <div
                    key={slot.id}
                    className={cn("scratch-pick", scratchReady && "hidden")}
                    style={{ animationDelay: `${i * 80}ms` }}
                    onClick={() => scratchPick()}
                  >
                    <span className="scratch-seal">?</span>
                    <span className="scratch-cap">PULSE</span>
                  </div>
                ))}
              </div>
              {scratchReady ? (
                <div className="scratch-stage">
                  <div className="scratch-card">
                    <div className="prize-face">
                      <p className="prize-lb">CONGRATULATIONS</p>
                      <p className="prize-big">{scratchLabel}</p>
                      <p className="prize-who">小明 · 刚刚</p>
                    </div>
                    <canvas id="draw-foil" />
                  </div>
                  <p className="tip">按住鼠标 <b>刮开涂层</b></p>
                </div>
              ) : (
                <p className="tip">点一张牌,再把结果刮出来</p>
              )}
            </div>

            {/* 模式三:九宫格 */}
            <div className={cn("stage", mode === "grid" && "on")} id="stage-grid">
              <div className="grid9">
                {Array.from({ length: 8 }, (_, cell) => {
                  const label = gridCellLabel(cell);
                  const isWin = gridWinLabel === label && gridDone;
                  return (
                    <div
                      key={cell}
                      data-cell={cell}
                      className={cn("cell9", gridLit === cell && "lit", isWin && "win")}
                    >
                      <span>{label}</span>
                      <span className="s">保密中</span>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="go9"
                  id="grid-go"
                  disabled={gridRolling || drawMut.isPending || mySlotId !== null}
                  onClick={gridStart}
                >
                  {mySlotId !== null ? "已抽完" : gridRolling ? "…" : "开始"}
                </button>
              </div>
              <div className="band" id="grid-band">
                {gridWinLabel ? (
                  <>
                    <p className="band-lb">跑灯落定 · 你抽到了</p>
                    <p className="band-big">{gridWinLabel}</p>
                  </>
                ) : null}
              </div>
            </div>

            {drawMut.isError ? (
              <p className="form-error text-sm text-muted">
                {drawMut.error instanceof Error && drawMut.error.message
                  ? drawMut.error.message
                  : "抽取失败，请重试"}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {revealed || wallRevealed ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted">抽取结果</p>
          {resultSlots.map((slot) => {
            const fill =
              slot.count === -1 ? 0 : slot.count > 0 ? slot.taken / slot.count : 0;
            const isMine = mySlotId === slot.id || draw.myDraw?.slotId === slot.id;
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
                          我的签
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums text-sm text-muted">
                    <span className="block text-foreground">
                      {slot.count === -1 ? `${slot.taken}+` : `${slot.taken}/${slot.count}`}
                    </span>
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <DrawAdminPanel pollId={pollId} creatorId={draw.creatorId} />
      <RosterPanel pollId={pollId} creatorId={draw.creatorId} />
    </section>
  );

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
          `${index + 1}\t${new Date(claim.drewAtMs).toLocaleString("zh-CN")}\t${claim.voterName ?? claim.voterMasked}\t${claim.label}`,
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
          实时数据（仅发起人可见）
        </summary>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border px-2.5 py-1 tabular-nums text-muted">
            {data.totalTaken} 人已参与
          </span>
          {data.closed ? (
            <span className="rounded-full border border-border px-2.5 py-1 text-subtle">
              已结束
            </span>
          ) : data.allTaken ? (
            <span className="rounded-full border border-border px-2.5 py-1 text-subtle">
              名额已抽完
            </span>
          ) : (
            <span className="rounded-full border border-accent/30 px-2.5 py-1 text-accent">
              <span className="live-dot mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" />
              进行中
            </span>
          )}
          <button
            type="button"
            onClick={exportClaims}
            className="ml-auto rounded-full border border-border px-3 py-1 text-muted transition-colors hover:text-foreground"
          >
            {copied ? "已复制" : "导出名单"}
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
                      ? `${slot.taken}+`
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
                  <span
                    className="ml-2 font-medium text-foreground"
                    suppressHydrationWarning
                  >
                    {claim.voterName ?? claim.voterMasked}
                  </span>
                </span>
                <span className="font-medium text-foreground">{claim.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-subtle">暂无参与记录</p>
        )}
      </details>
    );
  }
}
