import { useEffect, useRef } from "react";
import type { PollOption } from "@/lib/poll-api";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function OptionRow({
  option,
  pollId,
  total,
  votedIds,
  selected,
  multiple,
  disabled,
  writeInValue,
  onToggle,
  onWriteInChange,
}: {
  option: PollOption;
  pollId: string;
  total: number;
  votedIds: string[];
  selected: boolean;
  multiple: boolean;
  disabled: boolean;
  writeInValue: string;
  onToggle: (optionId: string) => void;
  onWriteInChange: (value: string) => void;
}) {
  const isMine = votedIds.includes(option.id) || selected;
  const locked = votedIds.length > 0;
  const scale = total > 0 ? option.votes / total : 0;
  const pct = total > 0 ? Math.round((option.votes / total) * 100) : 0;
  const votes = useCountUp(option.votes);

  // A one-shot "+1" whenever live polling brings this row new votes.
  const prevVotes = useRef(option.votes);
  const gained = option.votes > prevVotes.current;
  useEffect(() => {
    prevVotes.current = option.votes;
  }, [option.votes]);

  const rowRef = useRef<HTMLDivElement | null>(null);

  // 灵动悬停：行内眩光跟随指针 + 磁吸偏移（样式见 .poll-option --mx/--my/--magx）。
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = rowRef.current;
    if (!el || locked) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
    el.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
    const dx = e.clientX - (r.left + r.width / 2);
    el.style.setProperty(
      "--magx",
      `${Math.max(-5, Math.min(5, dx * 0.03)).toFixed(1)}px`,
    );
  };
  const onPointerLeave = () => {
    rowRef.current?.style.setProperty("--magx", "0px");
  };

  return (
    <div
      ref={rowRef}
      data-option-id={option.id}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn(
        "poll-option touch-manipulation",
        isMine && "is-mine",
        locked && "is-locked",
      )}
      style={{ ["--fill" as string]: String(scale) }}
    >
      <label className="block cursor-inherit">
        <input
          type={multiple ? "checkbox" : "radio"}
          name={`pulse-vote-${pollId}`}
          value={option.id}
          className="sr-only"
          checked={isMine}
          disabled={disabled || locked}
          onChange={() => onToggle(option.id)}
        />
        <span className="flex min-h-12 items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground">
              {option.label}
            </span>
            {isMine ? (
              <span className="poll-picked text-xs text-accent">已选择</span>
            ) : null}
            {(option.writeIns ?? []).length > 0 ? (
              <span className="mt-1 block text-xs text-muted">
                {(option.writeIns ?? []).join("、")}
              </span>
            ) : null}
            {(option.notes ?? []).length > 0 ? (
              <span className="mt-1 block truncate text-xs text-muted">
                {option.notes.join("、")}
              </span>
            ) : null}
          </span>
          <span className="relative shrink-0 text-right tabular-nums text-sm text-muted">
            {gained ? (
              <span key={option.votes} className="vote-float" aria-hidden>
                +1
              </span>
            ) : null}
            <span className="block text-foreground">{votes}</span>
            <span className="text-xs">{pct}%</span>
          </span>
        </span>
      </label>
      {option.isWriteIn && isMine ? (
        <div className="mt-3">
          <Input
            value={writeInValue}
            maxLength={40}
            readOnly={locked}
            placeholder="写在这儿"
            onChange={(e) => onWriteInChange(e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
