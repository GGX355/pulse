import { beautOn } from "@/lib/beautify";

/** 空状态插画(美化3):小票箱+选票的线稿 SVG,未开美化时不渲染。 */
export function EmptyIllustration() {
  if (!beautOn("b3")) return null;
  return (
    <svg
      viewBox="0 0 200 120"
      className="empty-illustration mx-auto mb-3 w-40 opacity-70"
      aria-hidden
    >
      {/* 票箱 */}
      <rect x="60" y="58" width="80" height="42" rx="6" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" />
      <rect x="56" y="52" width="88" height="10" rx="4" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" />
      <slot />
      {/* 投入的选票 */}
      <rect x="92" y="18" width="16" height="34" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(8 100 35)" className="text-accent" />
      <line x1="95" y1="26" x2="105" y2="26" stroke="currentColor" strokeWidth="1.5" transform="rotate(8 100 35)" className="text-accent" />
      <line x1="95" y1="32" x2="102" y2="32" stroke="currentColor" strokeWidth="1.5" transform="rotate(8 100 35)" className="text-accent" />
      {/* 落点装饰 */}
      <circle cx="70" cy="70" r="3" fill="currentColor" opacity="0.3" className="text-accent" />
      <circle cx="130" cy="80" r="2" fill="currentColor" opacity="0.4" className="text-accent" />
    </svg>
  );
}
