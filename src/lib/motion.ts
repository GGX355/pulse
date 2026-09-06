/**
 * 阻尼弹簧动效：苹果「灵动」手感的来源。
 * springKF 采样阻尼振荡曲线（快起 + 衰减回弹）生成 linear 关键帧，
 * 交给 WAAPI 播放——比单次过冲的贝塞尔更「活」，不会像抽动。
 */

export type SpringOpts = { freq?: number; decay?: number; dur?: number; phase?: number };

export function springKF(
  ax: number,
  ay: number,
  { freq = 3.2, decay = 5.2, dur = 950, phase = 0 }: SpringOpts = {},
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

/** 果冻挤压：面板/卡片切换内容时的「灵动」手感（双轴反向 = 保体积）。 */
export function jelly(el: Element | null): Animation | undefined {
  if (!el) return undefined;
  return spring(el, 0.045, -0.045, { freq: 3.1, decay: 5, dur: 950 });
}

/** 内容入场：模糊淡入 + 轻微过冲。 */
export function stageIn(el: Element | null): Animation | undefined {
  if (!el) return undefined;
  return el.animate(
    [
      { opacity: 0, transform: "scale(.94,.9)", filter: "blur(9px)" },
      {
        opacity: 1,
        transform: "scale(1.025,.975)",
        filter: "blur(0px)",
        offset: 0.42,
      },
      { transform: "scale(.992,1.006)", offset: 0.74 },
      { opacity: 1, transform: "scale(1,1)" },
    ],
    { duration: 640, easing: "cubic-bezier(.24,.9,.32,1)" },
  );
}
