import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { RefractionGlass } from "@/lib/refraction-glass";

export const Route = createFileRoute("/compare")({
  component: ComparePage,
});

/**
 * 玻璃方案对照页（演示用，未入导航）：
 * 同一彩色背景上并排三块玻璃 —— CSS 磨砂(pulse 现行) / SVG 位移折射
 * (shuding/liquid-glass 改造) / 纯透明基线。折射块可拖拽。
 * 兼容提示：Safari/Firefox 的 backdrop-filter 不支持 url(#svg) 引用，
 * 折射块在那些浏览器会退化为透明板（页面内有注明）。
 */
function ComparePage() {
  const demoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = demoRef.current;
    if (!host) return;
    const isSmall = window.innerWidth < 768;
    const glass = new RefractionGlass({
      width: isSmall ? 150 : 220,
      height: isSmall ? 110 : 150,
      radius: 24,
      strength: 0.16,
    });
    glass.appendTo(host);
    // 初始摆放在中偏右
    const el = (glass as unknown as { container: HTMLDivElement }).container;
    if (el) {
      el.style.left = isSmall ? `${Math.round(host.clientWidth / 2 - 60)}px` : `${host.clientWidth - 260}px`;
      el.style.top = isSmall ? "90px" : "120px";
    }
    return () => glass.destroy();
  }, []);

  return (
    <main className="mx-auto w-full max-w-xl md:max-w-2xl lg:max-w-3xl px-4 pb-28 pt-8">
      <p className="text-xs font-medium tracking-wide text-muted">玻璃方案对照</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
        磨砂 vs 折射
      </h1>
      <p className="mt-2 text-sm text-muted">
        同一背景上并排三块玻璃。推荐 Chromium 系浏览器查看（折射块依赖
        backdrop-filter 引用 SVG 滤镜，Safari/Firefox 会退化为透明板）。
      </p>

      {/* 彩色演示区：丰富内容让折射/模糊有东西可折 */}
      <div
        ref={demoRef}
        className="relative mt-6 overflow-hidden rounded-[var(--r-lg)] border border-border"
        style={{
          height: 420,
          background:
            "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
        }}
      >
        {/* 网格底纹 */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,.14) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, rgba(255,255,255,.14) 0 1px, transparent 1px 28px)",
          }}
        />
        {/* 大字与彩条：折射对文字边缘的效果最直观 */}
        <div className="absolute left-6 top-6 select-none">
          <p
            className="font-display text-5xl font-bold tracking-tight text-white"
            style={{ textShadow: "0 2px 18px rgba(103, 194, 212, 0.5)" }}
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

        {/* 三块玻璃（覆盖在内容上） */}
        <GlassCard
          label="A · CSS 磨砂（现行）"
          sub="backdrop blur+saturate"
          className="left-5 top-24"
        />
        <div
          className="absolute left-[150px] top-4"
          style={{ width: 230, height: 160 }}
          ref={(el) => {
            if (el && !el.dataset.mounted) {
              el.dataset.mounted = "1";
              import("@/lib/refraction-glass").then(({ RefractionGlass }) => {
                const g = new RefractionGlass({
                  width: 230,
                  height: 160,
                  radius: 28,
                  strength: 0.18,
                });
                g.appendTo(el);
                const c = (g as unknown as { container: HTMLDivElement }).container;
                if (c) c.style.left = "0px";
              });
            }
          }}
        />
        <div className="pointer-events-none absolute left-[150px] top-[172px] text-xs text-white/70">
          ↑ B · SVG 位移折射（可拖拽）· Chromium
        </div>
        <GlassCard
          label="C · 纯透明基线"
          sub="无处理"
          className="left-5 top-[300px]"
          variant="bare"
        />
        <div className="pointer-events-none absolute left-[248px] top-[318px] text-xs text-white/70">
          ↑ C
        </div>
      </div>

      {/* 标签说明（折射块标签在块内无法渲染 — SVG 板为脚本生成的 DOM，标注放下方） */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Note
          title="A · CSS 磨砂（现行方案）"
          body="backdrop-filter blur+saturate：均匀磨砂。性能好、全浏览器稳定、实现零依赖。"
        />
        <Note
          title="B · SVG 位移折射（shuding）"
          body="feDisplacementMap 位移贴图：边缘真实透镜折射，可拖拽。视觉最接近 Apple 发布会效果；Chromium 专属，性能开销更高。"
        />
        <Note
          title="C · 纯透明基线"
          body="无模糊无折射的对照基准：半透明底 + 细边框，用来直观比较前两者的差异。"
        />
      </div>

      <p className="mt-6 text-xs text-muted">
        结论参考：折射适合个别强调元素（盲选卡、开始按钮、分享卡）；
        全站铺开建议维持 CSS 磨砂（性能与兼容）。
      </p>
    </main>
  );
}

function GlassCard({
  label,
  sub,
  className,
  variant = "glass",
}: {
  label: string;
  sub: string;
  className?: string;
  variant?: "glass" | "bare";
}) {
  return (
    <div
      className={
        "absolute flex h-[150px] w-[220px] flex-col justify-end rounded-3xl p-4 " +
        (variant === "glass"
          ? "glass"
          : "border border-white/15 bg-white/5") +
        " " +
        (className ?? "")
      }
    >
      <p className="text-sm font-semibold text-white drop-shadow">{label}</p>
      <p className="text-xs text-white/60">{sub}</p>
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
    </div>
  );
}
