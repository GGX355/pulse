/**
 * 美化系统:总开关 + 预设组合,方便对比开关前后效果。
 * 预设含的美化项(美化1-5):
 *   美化1 渐变描边   美化2 一等奖彩带   美化3 空状态插画
 *   美化4 截止倒计时胶囊   美化5 背景光斑微动
 * 开关关闭时全部回落到基础样式(便于前后对比)。
 * 偏好持久化在 localStorage["pulse-beautify"]。
 */

export type BeautifyPreset = "v1" | "v2" | "v3" | "v5" | "v6";

export const BEAUTIFY_PRESETS: Record<
  BeautifyPreset,
  { label: string; items: string[] }
> = {
  v1: { label: "完整版", items: ["b1", "b2", "b3", "b4", "b5"] },
  v2: { label: "轻盈版", items: ["b1", "b3", "b5"] },
  v3: { label: "倒计时版", items: ["b1", "b4", "b5"] },
  v5: { label: "极简版", items: ["b1", "b5"] },
  v6: { label: "丝滑强化版", items: ["b1", "b2", "b3", "b4", "b5"] },
};

const KEY = "pulse-beautify";

export type BeautifySetting = { on: boolean; preset: BeautifyPreset };

export function readBeautify(): BeautifySetting {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { on: true, preset: "v1" };
    const parsed = JSON.parse(raw) as Partial<BeautifySetting>;
    const on = parsed.on !== false;
    const preset = (
      parsed.preset && parsed.preset in BEAUTIFY_PRESETS ? parsed.preset : "v1"
    ) as BeautifyPreset;
    return { on, preset };
  } catch {
    return { on: true, preset: "v1" };
  }
}

export function writeBeautify(setting: BeautifySetting) {
  try {
    localStorage.setItem(KEY, JSON.stringify(setting));
  } catch {
    /* 忽略 */
  }
}

/** 把当前美化设置应用到 html 属性(CSS 按属性段选择器生效)。 */
export function applyBeautify(setting: BeautifySetting) {
  const el = document.documentElement;
  if (!setting.on) {
    el.removeAttribute("data-beautify");
    el.removeAttribute("data-beaut-items");
    return;
  }
  const items = BEAUTIFY_PRESETS[setting.preset].items;
  el.setAttribute("data-beautify", setting.preset);
  el.setAttribute("data-beaut-items", items.join(" "));
  if (setting.preset === "v6") el.setAttribute("data-beaut-silk", "1");
  else el.removeAttribute("data-beaut-silk");
}

/** JS 侧判断某美化是否启用(彩带/插画等程序效果用)。 */
export function beautOn(item: "b1" | "b2" | "b3" | "b4" | "b5"): boolean {
  const setting = readBeautify();
  if (!setting.on) return false;
  return BEAUTIFY_PRESETS[setting.preset].items.includes(item);
}
