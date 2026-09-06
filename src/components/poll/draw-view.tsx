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
  RevealMode,
} from "@/lib/draw-repo";
import { Input } from "@/components/ui/input";
import { RosterPanel } from "@/components/poll/roster-panel";
import { cn } from "@/lib/utils";
import { jelly, confetti } from "@/lib/motion";

/**
 * The draw experience, blind by default: before you draw there are no numbers
 * anywhere — no taken counts, no remaining, no total, just the slot names.
 * The reveal is theatrical and server-driven: whichever mode you pick
 * (flip / scratch / grid) fires the same drawLiveOnce and only stages how the
 * server's answer appears.
 *
 * 演出期间冻结实时刷新：动画进行中不应用 refetch 的揭示数据、也不发起新的
 * 轮询（performing 状态），演出收尾（wallRevealed）后一次性追上现场——
 * 否则快网下 0.7s 的翻面会被 1.5s 轮询的结果墙直接拆场，慢网下结果墙又
 * 会拿盲选数据渲染出 undefined/undefined。
 */

type Mode = RevealMode;

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "flip", label: "🂠 翻牌" },
  { id: "scratch", label: "✦ 刮奖" },
  { id: "grid", label: "▦ 九宫格" },
];

/** 发起人没选的模式不出现;当前档不在配置里时回落到第一个可选档。 */
function pickMode(raw: Mode, allowed: Mode[]): Mode {
  return allowed.includes(raw) ? raw : (allowed[0] ?? "flip");
}

const prefersReduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // 揭晓演出状态:结果落定后先演动画,再切全场结果。
  const allowedModes: Mode[] = (() => {
    const modes = initialData.revealModes;
    return modes.length > 0 ? modes : ["flip", "scratch", "grid"];
  })();
  const [rawMode, setMode] = useState<Mode>(() => pickMode(allowedModes[0] ?? "flip", allowedModes));
  const mode = pickMode(rawMode, allowedModes);
  const [wallRevealed, setWallRevealed] = useState(!initialData.blind);
  const [flipping, setFlipping] = useState(false);
  const [mySlotId, setMySlotId] = useState(initialData.myDraw?.slotId ?? null);
  const [rolling, setRolling] = useState(false);
  const [rollLabel, setRollLabel] = useState("");
  const [scratchLabel, setScratchLabel] = useState("");
  const [scratchReady, setScratchReady] = useState(false);
  const [gridRolling, setGridRolling] = useState(false);
  const [gridWinLabel, setGridWinLabel] = useState<string | null>(null);
  const [gridDone, setGridDone] = useState(false);
  // 抽之前要填的那条信息(通常就是名字);服务端会再校验一次。
  const [note, setNote] = useState(initialData.myNote ?? "");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const segRef = useRef<HTMLDivElement | null>(null);
  const segMoverRef = useRef<HTMLSpanElement | null>(null);
  const rollTimer = useRef<number | null>(null);
  const gridTimers = useRef<number[]>([]);

  // 演出锁:进行中冻结轮询渲染(见文件头注释)。
  const [performing, setPerforming] = useState(false);
  const performingRef = useRef(false);
  const blindSnapRef = useRef<DrawViewData>(initialData);
  // 服务端结果(揭示视图)——演出结束前结果墙先用它,不等轮询。
  const [revealSlots, setRevealSlots] = useState<DrawRevealedView["slots"] | null>(
    null,
  );

  function startPerforming() {
    performingRef.current = true;
    blindSnapRef.current = draw;
    setPerforming(true);
  }

  useEffect(() => {
    if (wallRevealed && performingRef.current) {
      performingRef.current = false;
      setPerforming(false);
    }
  }, [wallRevealed]);

  useEffect(() => {
    if (!performing) {
      void queryClient.invalidateQueries({ queryKey: contentKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performing]);

  useEffect(() => {
    const timers = gridTimers.current;
    return () => {
      if (rollTimer.current) window.clearInterval(rollTimer.current);
      timers.forEach((id) => window.clearTimeout(id));
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

  // 演出用的盲选快照:动画期间 refetch 再快也不改舞台。
  const ui: DrawViewData = performing ? (blindSnapRef.current ?? draw) : draw;
  // 揭晓视图的签位(带 taken/count);盲选视图只有 {id,label}。
  const slots: Array<{ id: string; label: string }> = ui.slots;

  const noteRequired = Boolean(initialData.blind && initialData.voterNoteLabel);
  const noteMissing = noteRequired && !note.trim();

  const drawMut = useMutation({
    mutationFn: () =>
      drawLiveOnce({ data: { pollId, note: note.trim() || undefined } }),
    onSettled: () => {
      if (!performingRef.current) {
        void queryClient.invalidateQueries({ queryKey: contentKey });
      }
    },
  });

  /** 发起一次服务端抽签;揭晓视图返回结果,失败返回 null(isError 已展示)。 */
  async function drawOnce(): Promise<DrawRevealedView | null> {
    try {
      const result = await drawMut.mutateAsync();
      if (result.blind === false && result.myDraw) {
        setMySlotId(result.myDraw.slotId);
        setRevealSlots(result.slots);
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
    if (!prefersReduced) {
      if (myLabel === "一等奖") confetti(70);
      jelly(panelRef.current);
    }
    window.setTimeout(() => setWallRevealed(true), prefersReduced ? 0 : 1600);
  }

  function canDraw() {
    return (
      ui.blind &&
      !wallRevealed &&
      !performing &&
      !drawMut.isPending &&
      !rolling &&
      !flipping &&
      !scratchReady &&
      !gridRolling &&
      !noteMissing &&
      !ui.closed &&
      !ui.allTaken
    );
  }

  /* ── 模式一:翻牌(点任意卡 → 滚动高光 → 服务端结果落定 → 结果卡翻面) ──
     翻的是「结果卡」:翻转与结果墙、后台记录用同一个 slotId,永不穿帮。
     翻面动画由 .is-flipping 的 0.7s transition 驱动,不用 WAAPI 叠加。 */
  function flipPick() {
    if (!canDraw()) return;
    startPerforming();
    if (!prefersReduced) startRoll(slots.map((slot) => slot.label));
    void drawOnce().then((result) => {
      stopRoll();
      if (!result || !result.myDraw) {
        // 失败解锁:退回可重试状态。
        performingRef.current = false;
        setPerforming(false);
        return;
      }
      if (prefersReduced) {
        setWallRevealed(true);
        return;
      }
      setFlipping(true);
      window.setTimeout(() => setFlipping(false), 500);
      window.setTimeout(() => finishReveal(result.myDraw!.label), 550);
    });
  }

  /* ── 模式二:刮奖(点牌 → 服务端结果上涂层 → 刮开揭晓) ── */
  function scratchPick() {
    if (!canDraw()) return;
    startPerforming();
    drawMut.mutate(undefined, {
      onSuccess: (result) => {
        if (result.blind === false && result.myDraw) {
          setScratchLabel(result.myDraw.label);
          setScratchReady(true);
        }
      },
      onError: () => {
        performingRef.current = false;
        setPerforming(false);
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
      // 捕获指针:拖出卡面继续刮,松手必然落回 canvas 的 pointerup
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* 旧浏览器不支持则退化为 onpointerleave 兜底 */
      }
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

  // 涂层就位:刮奖卡渲染出来后立即铺银箔并挂上指针事件。
  useEffect(() => {
    if (scratchReady && mode === "scratch") initFoil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scratchReady, mode]);

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
      // 判「有效透明」而非精确 0:destination-out 的抗锯齿会在刮痕里
      // 留下大量半透明像素,按 ===0 判则刮到 95% 也永远不开奖。
      if (data[i] < 128) clear++;
    }
    if (clear / total > 0.42 && !cv.classList.contains("clear")) {
      cv.classList.add("clear");
      if (!prefersReduced) {
        if (scratchLabel === "一等奖") confetti(70);
        jelly(panelRef.current);
      }
      setWallRevealed(true);
    }
  }

  /* ── 模式三:九宫格(开始 → 服务端结果 → 跑灯落在对应格) ──
     真实签位按顺序摊进 8 个外格;签位多于 8 个时,超出部分的结果落在
     兜底格,横幅(band)仍显示真实结果。 */
  function gridLabels(): string[] {
    // 8 格全部用真实签位名循环铺满(与审核版模板一致);签位数 >8 时
    // 取前 8 个展示。格子只是演出,概率由服务端按签位剩余加权计算。
    const real = slots.map((s) => s.label);
    if (real.length === 0) return Array.from({ length: 8 }, () => "未抽中");
    return Array.from({ length: 8 }, (_, i) => real[i % real.length]);
  }
  function gridStart() {
    if (!canDraw()) return;
    startPerforming();
    drawMut.mutate(undefined, {
      onSuccess: (result) => {
        if (result.blind === false && result.myDraw) {
          runGridLights(result.myDraw.label);
        }
      },
      onError: () => {
        performingRef.current = false;
        setPerforming(false);
      },
    });
  }
  function runGridLights(label: string) {
    setGridRolling(true);
    const cells = gridLabels();
    const order = [0, 1, 2, 4, 7, 6, 5, 3];
    const found = cells.findIndex((l) => l === label);
    const winCell = found >= 0 ? found : 0;
    const winPos = order.indexOf(winCell);
    const landing = 14 + ((winPos + 8) % 8);
    const steps: Array<{ cell: number; delay: number }> = [];
    for (let i = 0; i <= landing; i++) {
      const t = i / landing;
      steps.push({
        cell: order[i % 8],
        delay: prefersReduced
          ? 0
          : t < 0.7
            ? 65
            : 65 + Math.pow((t - 0.7) / 0.3, 1.5) * 330,
      });
    }
    let acc = 0;
    steps.forEach((st, k) => {
      acc += st.delay;
      const id = window.setTimeout(() => {
        document
          .querySelectorAll(".cell9")
          .forEach((c) => c.classList.remove("lit"));
        const el = document.querySelector(`.cell9[data-cell="${st.cell}"]`);
        el?.classList.add("lit");
        if (k === steps.length - 1) {
          el?.classList.remove("lit");
          el?.classList.add("win");
          setGridWinLabel(label);
          setGridDone(true);
          finishReveal(label);
        }
      }, acc);
      gridTimers.current.push(id);
    });
  }

  const revealed = !draw.blind;
  const closed = ui.closed || ui.allTaken;

  const status = ui.closed
    ? "已结束"
    : ui.allTaken
      ? "名额已抽完"
      : ui.blind
        ? "进行中 · 参与后公布结果"
        : `${ui.totalTaken ?? 0} 人已参与`;

  // 舞台显隐只看盲选/收尾/结束三个状态;演出期间(performing)舞台必须
  // 保持可见——数据已被 ui 快照冻结,这里若再看 performing 会把动画拆掉。
  const showInteractive = ui.blind && !wallRevealed && !closed;
  // 结果墙数据:轮询已揭晓用真数据;演出刚收尾、轮询还没回来时用服务端
  // 结果快照(revealSlots),永不拿盲选数据渲染数字。
  const wallSlots: DrawRevealedView["slots"] = revealed
    ? draw.slots
    : (revealSlots ?? []);

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

          {allowedModes.length > 1 ? (
            <div ref={segRef} className="seg glass" data-seg>
              <span ref={segMoverRef} className="seg-mover" aria-hidden />
              {MODES.filter((m) => allowedModes.includes(m.id)).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={cn("seg-item", mode === m.id && "on")}
                  onClick={() => {
                    if (performing || rolling || flipping || scratchReady || gridRolling)
                      return;
                    setMode(m.id);
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}

          <div ref={panelRef} className="glass stage-panel p-5">
            {/* 模式一:翻牌 */}
            <div className={cn("stage", mode === "flip" && "on")} id="stage-flip">
              <div className="draw-grid scene">
                {slots.map((slot, index) => {
                  const mine = mySlotId === slot.id;
                  return (
                    <div
                      key={slot.id}
                      role={mySlotId === null ? "button" : undefined}
                      tabIndex={mySlotId === null ? 0 : -1}
                      aria-label={`盲选卡：${slot.label}`}
                      className={cn(
                        "draw-blind-card",
                        mine && (flipping || wallRevealed || mySlotId === slot.id) && "is-flipping",
                        // 结果一旦落定,其他卡持续模糊淡化到开墙,不回弹
                        (flipping || wallRevealed || mySlotId !== null) && !mine && "dim-others",
                      )}
                      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                      onClick={() => (mySlotId === null ? flipPick() : undefined)}
                      onKeyDown={(e) => {
                        if (mySlotId === null && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          flipPick();
                        }
                      }}
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
              <p className="tip" aria-live="polite">
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
                  <button
                    key={slot.id}
                    type="button"
                    className={cn("scratch-pick", scratchReady && "hidden")}
                    style={{ animationDelay: `${i * 80}ms` }}
                    onClick={() => scratchPick()}
                  >
                    <span className="scratch-seal">?</span>
                    <span className="scratch-cap">PULSE</span>
                  </button>
                ))}
              </div>
              {scratchReady ? (
                <div className="scratch-stage">
                  <div className="scratch-card">
                    <div className="prize-face">
                      <p className="prize-lb">CONGRATULATIONS</p>
                      <p className="prize-big">{scratchLabel}</p>
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
                {gridLabels().slice(0, 4).map((label, cell) => {
                  const isWin = gridWinLabel === label && gridDone;
                  return (
                    <div
                      key={cell}
                      data-cell={cell}
                      className={cn("cell9", isWin && "win")}
                    >
                      <span>{label}</span>
                      <span className="s">{isWin ? "你的签" : "保密中"}</span>
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
                {gridLabels().slice(4).map((label, i) => {
                  const cell = i + 4;
                  const isWin = gridWinLabel === label && gridDone;
                  return (
                    <div
                      key={cell}
                      data-cell={cell}
                      className={cn("cell9", isWin && "win")}
                    >
                      <span>{label}</span>
                      <span className="s">{isWin ? "你的签" : "保密中"}</span>
                    </div>
                  );
                })}
              </div>
              <div className="band" id="grid-band" aria-live="polite">
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

      {(wallRevealed || (revealed && !performing)) && wallSlots.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted">抽取结果</p>
          {wallSlots.map((slot) => {
            const fill =
              slot.count === -1 ? 0 : slot.count > 0 ? slot.taken / slot.count : 0;
            const isMine = mySlotId === slot.id || draw.myDraw?.slotId === slot.id;
            return (
              <div
                key={slot.id}
                className={cn("poll-option is-locked cursor-default", isMine && "is-mine")}
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
