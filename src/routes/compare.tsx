import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/compare")({
  component: ComparePage,
});

/** 演示区背景内容(A/C 直接显示,B 的克隆层折射显示) */
function DemoContent() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,.14) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, rgba(255,255,255,.14) 0 1px, transparent 1px 28px)",
        }}
      />
      <div className="absolute left-6 top-6 select-none">
        <p
          className="font-display text-5xl font-bold tracking-tight text-white"
          style={{ textShadow: "0 2px 18px rgba(103,194,212,.5)" }}
        >
          GLASS
        </p>
        <p className="mt-2 text-sm tracking-[0.3em] text-white/70">
          LIQUID · REFRACTION · FROST
        </p>
      </div>
      <div className="absolute bottom-5 left-6 right-6 flex gap-3">
        {["#67c2d4", "#7d5aff", "#ff5f8f", "#ffb340", "#40c8b0"].map((c) => (
          <div
            key={c}
            className="h-10 flex-1 rounded-lg"
            style={{ background: c, boxShadow: `0 6px 18px ${c}55` }}
          />
        ))}
      </div>
    </>
  );
}

const DEMO_W = 900;
const DEMO_H = 460;

/** 圆角矩形 SDF 位移贴图(Canvas → dataURI → SVG feImage) */
function makeDisplacementMap(w: number, h: number, strength: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { url: "", scale: 1 };
  const smooth = (edge0: number, t: number) => {
    const x = Math.max(0, Math.min(1, 1 - t / edge0));
    return x * x * (3 - 2 * x);
  };
  const sdf = (x: number, y: number) => {
    const qx = Math.abs(x) - 0.5 + 0.26;
    const qy = Math.abs(y) - 0.5 + 0.26;
    return (
      Math.min(Math.max(qx, qy), 0) +
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
      0.26
    );
  };
  const data = new Uint8ClampedArray(w * h * 4);
  let max = 0;
  const raw: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % w;
    const y = Math.floor(i / 4 / w);
    const nx = x / w - 0.5;
    const ny = y / h - 0.5;
    const d = sdf(nx, ny);
    const k = smooth(0.22, d) * strength;
    const tx = nx * k + 0.5;
    const ty = ny * k + 0.5;
    raw.push(tx * w - x, ty * h - y);
    max = Math.max(max, Math.abs(tx * w - x), Math.abs(ty * h - y));
  }
  max = Math.max(max, 0.5);
  let idx = 0;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (raw[idx++] / max + 0.5) * 255;
    data[i + 1] = (raw[idx++] / max + 0.5) * 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
  ctx.putImageData(new ImageData(data, w, h), 0, 0);
  return { url: canvas.toDataURL(), scale: max };
}

function ComparePage() {
  const demoRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  // 拖拽状态

  // B 板:挂 SVG 位移滤镜 → 折射层(CSS filter:url)生效;无滤镜时退化为透明板
  useEffect(() => {
    const demo = demoRef.current;
    if (!demo) return;
    const { url, scale } = makeDisplacementMap(DEMO_W, DEMO_H, 0.35);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "refract-disp");
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", String(DEMO_W));
    filter.setAttribute("height", String(DEMO_H));
    const feImage = document.createElementNS("http://www.w3.org/2000/svg", "feImage");
    feImage.setAttribute("href", url);
    feImage.setAttribute("x", "0");
    feImage.setAttribute("y", "0");
    feImage.setAttribute("width", String(DEMO_W));
    feImage.setAttribute("height", String(DEMO_H));
    const feDisp = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap");
    feDisp.setAttribute("in", "SourceGraphic");
    feDisp.setAttribute("in2", "disp-map");
    feDisp.setAttribute("xChannelSelector", "R");
    feDisp.setAttribute("yChannelSelector", "G");
    feDisp.setAttribute("scale", String(scale));
    filter.append(feImage, feDisp);
    defs.appendChild(filter);
    svg.appendChild(defs);
    demo.prepend(svg);
    setReady(true);

    return () => {
      svg.remove();
    };
  }, []);

  // B 板拖拽(pointer capture)
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let dragging = false;
    let sx = 0, sy = 0, ox = 0, oy = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = board.getBoundingClientRect();
      ox = r.left; oy = r.top;
      board.style.cursor = "grabbing";
      try { board.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const left = ox + e.clientX - sx;
      const top = oy + e.clientY - sy;
      board.style.left = `${left}px`;
      board.style.top = `${top}px`;
      const layer = board.querySelector(".refract-layer") as HTMLElement | null;
      if (layer) {
        // 折射层反向移动:板内始终显示"当前所在位置的背景内容"
        layer.style.left = `${-left}px`;
        layer.style.top = `${-top}px`;
      }
    };
    const up = () => {
      dragging = false;
      board.style.cursor = "grab";
    };
    board.addEventListener("pointerdown", down);
    board.addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    return () => {
      board.removeEventListener("pointerdown", down);
      board.removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-xl md:max-w-2xl lg:max-w-3xl px-4 pb-28 pt-8">
      <p className="text-xs font-medium tracking-wide text-muted">玻璃方案对照</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
        磨砂 vs 折射
      </h1>
      <p className="mt-2 text-sm text-muted">
        同一背景上并排三块玻璃。推荐 Chromium 系浏览器查看（折射板依赖
        filter 引用 SVG 位移滤镜，Safari/Firefox 会退化为透明板）。
      </p>

      {/* 彩色演示区 */}
      <div
        ref={demoRef}
        className="relative mt-6 overflow-hidden rounded-[var(--r-lg)] border border-border"
        style={{
          height: DEMO_H,
          background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
        }}
      >
        <DemoContent />

        {/* A · CSS 磨砂(现行):磨砂玻璃卡 */}
        <div className="glass absolute left-5 top-24 flex h-[150px] w-[220px] flex-col justify-end rounded-3xl p-4">
          <p className="text-sm font-semibold text-white">A · CSS 磨砂（现行）</p>
          <p className="text-xs text-white/60">backdrop blur+saturate</p>
        </div>

        {/* B · SVG 折射:克隆内容层 + 位移滤镜,可拖拽 */}
        <div
          ref={boardRef}
          className="absolute cursor-grab overflow-hidden rounded-3xl border border-white/25 select-none"
          style={{
            left: 360,
            top: 24,
            width: 230,
            height: 160,
            touchAction: "none",
          }}
        >
          {ready ? (
            <div
              className="refract-layer absolute left-0 top-0"
              style={{
                width: DEMO_W,
                height: DEMO_H,
                filter: "url(#refract-disp)",
              }}
            >
              <DemoContent />
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/25 shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]" />
          <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
            B · SVG 折射（可拖拽）
          </div>
        </div>

        {/* C · 纯透明基线 */}
        <div className="absolute left-5 top-[330px] flex h-[110px] w-[220px] flex-col justify-end rounded-3xl border border-white/15 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">C · 纯透明基线</p>
          <p className="text-xs text-white/60">无处理</p>
        </div>
        <div className="pointer-events-none absolute left-[248px] top-[318px] text-xs text-white/70">
          ↑ C
        </div>
      </div>

      {/* 标签说明 */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">A · CSS 磨砂（现行）</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            backdrop-filter blur+saturate：均匀磨砂。性能好、全浏览器稳定、零依赖。
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">B · SVG 位移折射（shuding）</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            feDisplacementMap：边缘真实透镜折射，可拖拽。最接近 Apple 发布会效果；Chromium 专属，开销更高。
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">C · 纯透明基线</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            半透明底 + 细边框，直观对比前两者差异。
          </p>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">
        结论参考：折射适合个别强调元素（盲选卡、开始按钮、分享卡）；
        全站铺开建议维持 CSS 磨砂（性能与兼容）。
      </p>
    </main>
  );
}
