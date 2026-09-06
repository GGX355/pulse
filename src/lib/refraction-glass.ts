/**
 * SVG 位移折射玻璃（容器化改造版，含拖拽与鼠标液态隆起）
 * 改造自 shuding/liquid-glass（https://github.com/shuding/liquid-glass）
 *
 * 原理：Canvas 按圆角矩形 SDF 生成位移贴图 → SVG feDisplacementMap
 *       对 backdrop 做真实折射（边缘与鼠标附近透镜弯曲）。
 * 交互：板体可拖拽（setPointerCapture，出界不丢）；鼠标悬停时局部
 *       隆起（液态感）。每帧节流重算贴图。
 * 兼容：Chromium ✓（backdrop url(#svg) 引用）；Safari/Firefox 不支持
 *       该引用，会退化为透明板 —— 使用方需提供降级观感。
 */

function smoothStep(a: number, b: number, t: number) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function length2(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

function roundedRectSDF(x: number, y: number, w: number, h: number, r: number) {
  const qx = Math.abs(x) - w + r;
  const qy = Math.abs(y) - h + r;
  return (
    Math.min(Math.max(qx, qy), 0) +
    length2(Math.max(qx, 0), Math.max(qy, 0)) -
    r
  );
}

export type RefractionOptions = {
  width?: number;
  height?: number;
  radius?: number;
  /** 折射强度 0-1（默认 0.3） */
  strength?: number;
};

export class RefractionGlass {
  width: number;
  height: number;
  radius: number;
  strength: number;
  /** 鼠标液态隆起强度(0-1) */
  mouseBulge = 0.22;

  private container: HTMLDivElement | null = null;
  private svg: SVGSVGElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private feImage: Element | null = null;
  private feDisp: Element | null = null;
  private feDispEl: Element | null = null;
  private mouse = { x: 0.5, y: 0.5 };
  private mouseUsed = false;
  private rafId = 0;
  private dirty = true;

  constructor(options: RefractionOptions = {}) {
    this.width = options.width ?? 220;
    this.height = options.height ?? 150;
    this.radius = options.radius ?? 24;
    this.strength = options.strength ?? 0.3;
  }

  /** 挂载到指定容器（容器需 position:relative 且有可见背景内容） */
  appendTo(parent: HTMLElement) {
    const w = this.width;
    const h = this.height;
    const id = "refraction-" + Math.random().toString(36).slice(2, 9);

    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute; left: 0; top: 0;
      width: ${w}px; height: ${h}px;
      overflow: hidden; border-radius: ${this.radius}px;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3), 0 -10px 26px inset rgba(0, 0, 0, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.14);
      cursor: grab;
      touch-action: none;
      backdrop-filter: url(#${id}_filter) blur(0.2px) contrast(1.18) brightness(1.08) saturate(1.2);
      -webkit-backdrop-filter: blur(2px) saturate(1.2);
    `;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", `${id}_filter`);
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("colorInterpolationFilters", "sRGB");
    filter.setAttribute("width", w.toString());
    filter.setAttribute("height", h.toString());
    const feImage = document.createElementNS("http://www.w3.org/2000/svg", "feImage");
    feImage.setAttribute("width", w.toString());
    feImage.setAttribute("height", h.toString());
    const feDisp = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap");
    feDisp.setAttribute("in", "SourceGraphic");
    feDisp.setAttribute("in2", `${id}_map`);
    feDisp.setAttribute("xChannelSelector", "R");
    feDisp.setAttribute("yChannelSelector", "G");
    filter.append(feImage, feDisp);
    defs.appendChild(filter);
    svg.appendChild(defs);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.style.display = "none";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── 位移贴图生成(节流 rAF) ──
    const update = () => {
      const data = new Uint8ClampedArray(w * h * 4);
      let maxScale = 0;
      const raw: number[] = [];
      // mouseProxy:fragment 读到鼠标坐标时标记 mouseUsed
      const mouseProxy = new Proxy(this.mouse, {
        get: (target, prop) => {
          this.mouseUsed = true;
          return target[prop as keyof typeof target];
        },
      });
      this.mouseUsed = false;
      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % w;
        const y = Math.floor(i / 4 / w);
        const uv = { x: (x + 0.5) / w, y: (y + 0.5) / h };
        const ix = uv.x - 0.5;
        const iy = uv.y - 0.5;
        // 边缘折射:SDF 距离场,边缘处向中心收缩采样(透镜弯曲)
        const dEdge = roundedRectSDF(ix, iy, 0.5, 0.5, 0.26);
        const edge = smoothStep(0.95, 0, dEdge);
        let scale = 1 - edge * this.strength;
        // 鼠标液态隆起:光标附近进一步收缩采样(向光标弯折)
        const dxm = uv.x - mouseProxy.x;
        const dym = uv.y - mouseProxy.y;
        const dm = Math.hypot(dxm, dym);
        scale -= smoothStep(0.4, 0, dm) * this.mouseBulge;
        const tx = ix * scale + 0.5;
        const ty = iy * scale + 0.5;
        raw.push(tx * w - x, ty * h - y);
        maxScale = Math.max(maxScale, Math.abs(tx * w - x), Math.abs(ty * h - y));
      }
      maxScale *= 0.5;
      let idx = 0;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (raw[idx++] / maxScale + 0.5) * 255;
        data[i + 1] = (raw[idx++] / maxScale + 0.5) * 255;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
      ctx.putImageData(new ImageData(data, w, h), 0, 0);
      feImage.setAttributeNS("http://www.w3.org/1999/xlink", "href", canvas.toDataURL());
      feDisp.setAttribute("scale", String(Math.max(1, maxScale)));
      this.dirty = false;
    };
    const schedule = () => {
      if (this.dirty) return;
      this.dirty = true;
      this.rafId = requestAnimationFrame(() => {
        this.rafId = 0;
        update();
      });
    };
    schedule();

    // ── 拖拽(setPointerCapture:出界不丢) ──
    let dragging = false;
    let sx = 0, sy = 0, ox = 0, oy = 0;
    container.addEventListener("pointerdown", (e) => {
      dragging = true;
      container.style.cursor = "grabbing";
      const rect = container.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY;
      ox = rect.left; oy = rect.top;
      try { container.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
      e.preventDefault();
    });
    container.addEventListener("pointermove", (e) => {
      if (dragging) {
        const pr = parent.getBoundingClientRect();
        const nx = Math.max(0, Math.min(pr.width - w, ox + e.clientX - sx));
        const ny = Math.max(0, Math.min(pr.height - h, oy + e.clientY - sy));
        container.style.left = `${nx}px`;
        container.style.top = `${ny}px`;
      }
      // 鼠标液态隆起:悬停即重算贴图(节流 rAF)
      const rect = container.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) / rect.width;
      this.mouse.y = (e.clientY - rect.top) / rect.height;
      schedule();
    });
    container.addEventListener("pointerup", () => {
      dragging = false;
      container.style.cursor = "grab";
    });
    container.addEventListener("pointercancel", () => {
      dragging = false;
    });

    filter.append(feImage, feDisp);
    defs.appendChild(filter);
    svg.appendChild(defs);
    parent.append(svg, container);

    this.container = container;
    this.svg = svg;
    this.canvas = canvas;
    this.ctx = ctx;
    this.feImage = feImage;
    this.feDisp = feDisp;
    this.feDispEl = feDisp;
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.container?.remove();
    this.svg?.remove();
    this.canvas?.remove();
  }
}
