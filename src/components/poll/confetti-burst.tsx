import { beautOn } from "@/lib/beautify";

/**
 * 彩带庆祝:美化2 升级为多色矩形+圆片混合、旋转飘落、物理重力;
 * 未开美化2 时回落为单发点状礼花(由调用方处理)。
 * 挂载一次常驻,触发 burst(x, y) 在指定视口坐标喷发。
 */
export function mountConfettiHost(): (x: number, y: number) => void {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const resize = () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  };
  resize();
  addEventListener("resize", resize);

  type Piece = {
    x: number; y: number; vx: number; vy: number;
    w: number; h: number; rot: number; vr: number;
    color: string; shape: "rect" | "circle"; life: number;
  };
  let pieces: Piece[] = [];
  let raf = 0;

  const COLORS = ["#67c2d4", "#7d5aff", "#ff5f8f", "#ffb340", "#40c8b0", "#ffffff"];

  function tick() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces = pieces.filter((p) => p.life > 0 && p.y < canvas.height + 40);
    for (const p of pieces) {
      p.vy += 0.12; // 重力
      p.vx *= 0.99; // 空气阻力
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (pieces.length > 0) raf = requestAnimationFrame(tick);
    else raf = 0;
  }

  return (x: number, y: number) => {
    const colors = beautOn("b2") ? COLORS : ["#ffb340"];
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80 + Math.random() * 0.5;
      const speed = 4 + Math.random() * 7;
      pieces.push({
        x, y,
        vx: Math.cos(angle) * speed * (0.6 + Math.random() * 0.8),
        vy: Math.sin(angle) * speed - 4,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.3 ? "rect" : "circle",
        life: 90 + Math.random() * 60,
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  };
}
