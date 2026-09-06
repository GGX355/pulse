/**
 * 阻尼弹簧动效：苹果「灵动」手感的来源。
 * springKF 采样阻尼振荡曲线（快起 + 衰减回弹）生成 linear 关键帧，
 * 交给 WAAPI 播放——比单次过冲的贝塞尔更「活」，不会像抽动。
 */

export type SpringOpts = { freq?: number; decay?: number; dur?: number; phase?: number };

export function springKF(
  ax: number,
  ay: number,
  { freq = 3.2, decay = 5.2, phase = 0 }: SpringOpts = {},
): Keyframe[] {
  const N = 40;
  const kf: Keyframe[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const env = Math.exp(-decay * t);
    const w = Math.cos(phase + freq * Math.PI * 2 * t);
    kf.push({
      transform: `scale(${(1 + ax * env * w).toFixed(4)}, ${(1 + ay * env * w).toFixed(4)})`,
      offset: t,
    });
  }
  return kf;
}

export function spring(
  el: Element,
  ax: number,
  ay: number,
  opt?: SpringOpts,
): Animation | undefined {
  return el.animate(springKF(ax, ay, opt), {
    duration: opt?.dur ?? 950,
    easing: "linear",
  });
}

/** 果冻挤压：Smooth 档（无过冲，单次轻压回正）。
 *  弹簧参数对应苹果 duration .55s / bounce 0。 */
export function jelly(el: Element | null): Animation | undefined {
  if (!el) return undefined;
  return spring(el, 0.03, -0.03, { freq: 2.4, decay: 12, dur: 820 });
}

/** 内容入场：Soft 淡入上移（无过冲）。 */
export function stageIn(el: Element | null): Animation | undefined {
  if (!el) return undefined;
  return el.animate(
    [
      { opacity: 0, transform: "translateY(14px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 480, easing: "cubic-bezier(.25,.7,.18,1)" },
  );
}

/** 揭晓礼花：小规模（Smooth 档 70 粒），主题色取自 CSS 变量。 */
export function confetti(count = 70): void {
  const style = getComputedStyle(document.documentElement);
  const colors = [
    style.getPropertyValue("--color-accent").trim() || "#0066ff",
    "#7d5aff",
    "#ff5f8f",
    "#ffb340",
    "#40c8b0",
  ];
  const cv =
    (document.getElementById("fx") as HTMLCanvasElement | null) ??
    document.createElement("canvas");
  if (!cv.isConnected) {
    cv.id = "fx";
    cv.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:99";
    document.body.appendChild(cv);
  }
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  cv.width = innerWidth;
  cv.height = innerHeight;
  const parts: Array<{
    x: number; y: number; vx: number; vy: number;
    r: number; c: string; life: number; decay: number; rot: number;
  }> = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 8;
    parts.push({
      x: cv.width / 2, y: cv.height * 0.4,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3,
      r: 3 + Math.random() * 4, c: colors[i % colors.length],
      life: 1, decay: 0.011 + Math.random() * 0.01, rot: Math.random() * Math.PI,
    });
  }
  const t0 = performance.now();
  (function frame(t: number) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx; p.y += p.vy; p.vy += 0.17; p.life -= p.decay; p.rot += 0.08;
      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.7);
      ctx.restore();
    }
    if (alive && t - t0 < 3500) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })(t0);
}
