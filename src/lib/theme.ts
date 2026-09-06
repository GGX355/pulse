/**
 * 三态主题：跟随系统（默认）→ 黑夜 → 白天。
 * - html[data-theme] 由这里写入；SSR 期间由 __root.tsx 的内联脚本
 *   在水合前设置，避免闪屏。
 * - 偏好持久化在 localStorage["pulse-theme"]。
 * - "system" 档实时监听 prefers-color-scheme 变化。
 */

export type ThemePref = "system" | "dark" | "light";

const KEY = "pulse-theme";
const colorScheme =
  typeof matchMedia === "function"
    ? matchMedia("(prefers-color-scheme: dark)")
    : null;

export function getThemePref(): ThemePref {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(KEY);
  return v === "dark" || v === "light" ? v : "system";
}

export function resolvedTheme(pref: ThemePref): "dark" | "light" {
  if (pref !== "system") return pref;
  return colorScheme?.matches ? "dark" : "light";
}

function apply(pref: ThemePref) {
  document.documentElement.dataset.theme = resolvedTheme(pref);
  const btn = document.querySelector<HTMLButtonElement>(".theme-btn");
  if (btn) {
    btn.textContent =
      pref === "system" ? "🌗 系统" : pref === "dark" ? "🌙 黑夜" : "☀️ 白天";
    btn.title = "当前：" + (pref === "system" ? "跟随系统" : pref === "dark" ? "黑夜" : "白天");
  }
}

/** 客户端启动时调用一次：应用偏好 + 监听系统切换。
 *  返回 cycle（循环切换）与 dispose（仅解绑监听，不消耗切换）。 */
export function initTheme(): { cycle: () => void; dispose: () => void } {
  let pref = getThemePref();
  apply(pref);
  const onSchemeChange = () => {
    if (pref === "system") apply(pref);
  };
  colorScheme?.addEventListener("change", onSchemeChange);
  return {
    cycle: () => {
      pref = pref === "system" ? "dark" : pref === "dark" ? "light" : "system";
      localStorage.setItem(KEY, pref);
      // View Transitions：整页交叉淡化，主题切换顺滑
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      };
      if (doc.startViewTransition) doc.startViewTransition(() => apply(pref));
      else apply(pref);
    },
    dispose: () => {
      colorScheme?.removeEventListener("change", onSchemeChange);
    },
  };
}
