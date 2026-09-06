import { cn } from "@/lib/utils";

/**
 * 液态玻璃分段切换:玻璃药丸容器 + 滑动高亮块。
 * 滑块动效与顶部导航药丸同款(0.42s 弹性过冲,见 styles.css .seg-mover)。
 * 单选语义;选项 2-4 个为宜。
 */
export function SegmentToggle({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const n = Math.max(options.length, 1);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative grid w-full max-w-sm rounded-full border border-border bg-surface p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="seg-mover pointer-events-none absolute inset-y-1 left-1 rounded-full"
        style={{
          width: `calc((100% - 8px) / ${n})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={cn(
            "relative z-[1] h-9 rounded-full text-sm touch-manipulation transition-colors",
            value === opt.value
              ? "font-medium text-foreground"
              : "text-muted hover:text-foreground",
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
