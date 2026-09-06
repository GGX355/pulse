/**
 * SVG 位移折射玻璃（容器化改造版）
 * 改造自 shuding/liquid-glass（https://github.com/shuding/liquid-glass）
 * 原理：Canvas 按圆角矩形 SDF 生成位移贴图 → SVG feDisplacementMap
 *       对 backdrop 做真实折射（边缘透镜弯曲），区别于 backdrop 磨砂。
 * 兼容：Chromium ✓；Safari/Firefox 的 backdrop-filter 不支持 url(#svg)
 *       引用，会退化为透明板（对照页已注明）。
 */

function smoothStep(a: number, b: number, t: number) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function length(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

function roundedRectSDF(x: number, y: number, width: number, height: number, radius: number) {
  const qx = Math.abs(x) - width + radius;
  const qy = Math.abs(y) - height + radius;
  return (
    Math.min(Math.max(qx, qy), 0) +
    length(Math.max(qx, 0), Math.max(qy, 0)) -
    radius
  );
}

export type RefractionOptions = {
  width?: number;
  height?: number;
  radius?: number;
  /** 折射强度 0-1（边缘位移比例，默认 0.15） */
  strength?: number;
};

export class RefractionGlass {
  width: number;
  height: number;
  radius: number;
  strength: number;
  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLDivElement | null = null;
  private svg: SVGSVGElement | null = null;
  private feImage: Element | null = null;
  private feDisplacementMap: Element | null = null;

  constructor(options: RefractionOptions = {}) {
    this.width = options.width ?? 220;
    this.height = options.height ?? 150;
    this.radius = options.radius ?? 24;
    this.strength = options.strength ?? 0.15;
  }

  /** 挂载到指定容器（容器需 position:relative 且有可见背景内容） */
  appendTo(parent: HTMLElement) {
    const w = this.width;
    const h = this.height;
    const id = "refraction-" + Math.random().toString(36).slice(2, 9);

    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute; width: ${w}px; height: ${h}px;
      overflow: hidden; border-radius: ${this.radius}px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25), 0 -8px 22px inset rgba(0, 0, 0, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.16);
      cursor: grab;
      backdrop-filter: url(#${id}_filter) blur(0.3px) contrast(1.15) brightness(1.06) saturate(1.15);
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

    // 生成位移贴图：边缘 SDF → smoothStep 折射场（中心不动，边缘弯曲）
    const data = new Uint8ClampedArray(w * h * 4);
    let maxScale = 0;
    const raw: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % w;
      const y = Math.floor(i / 4 / w);
      const ix = x / w - 0.5;
      const iy = y / h - 0.5;
      const dEdge = roundedRectSDF(ix, iy, 0.5, 0.5, 0.28);
      const disp = smoothStep(0.9, 0, dEdge - 0.02) * this.strength;
      const dx = ix * disp * w - x;
      const dy = iy * disp * h - y;
      maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
      raw.push(dx, dy);
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
    feDisp.setAttribute("scale", String(maxScale));

    // 拖拽（容器内自由移动）
    let dragging = false;
    let sx = 0, sy = 0, ox = 0, oy = 0;
    container.addEventListener("pointerdown", (e) => {
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const rect = container.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      container.style.cursor = "grabbing";
      e.preventDefault();
    });
    const parentRect = () => parent.getBoundingClientRect();
    container.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const pr = parentRect();
      const nx = Math.max(0, Math.min(pr.width - w, ox + e.clientX - sx));
      const ny = Math.max(0, Math.min(pr.height - h, oy + e.clientY - sy));
      container.style.left = `${nx}px`;
      container.style.top = `${ny}px`;
    });
    addEventListener("pointerup", () => {
      dragging = false;
      container.style.cursor = "grab";
    });

    filter.append(feImage, feDisp);
    defs.appendChild(filter);
    svg.appendChild(defs);
    parent.appendChild(svg);
    parent.appendChild(container);

    this.container = container;
    this.svg = svg;
    this.canvas = canvas;
    this.feImage = feImage;
    this.feDisplacementMap = feDisp;
  }

  destroy() {
    this.container?.remove();
    this.svg?.remove();
    this.canvas?.remove();
  }
}
