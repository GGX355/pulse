import { useEffect, useRef } from "react";
import type { PollOption } from "@/lib/poll-api";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";

export function OptionRow({
  option,
  pollId,
  total,
  votedId,
  disabled,
  onVote,
}: {
  option: PollOption;
  pollId: string;
  total: number;
  votedId: string | null;
  disabled: boolean;
  onVote: (optionId: string) => void;
}) {
  const isMine = votedId === option.id;
  const locked = Boolean(votedId);
  const scale = total > 0 ? option.votes / total : 0;
  const pct = total > 0 ? Math.round((option.votes / total) * 100) : 0;
  const votes = useCountUp(option.votes);

  // A one-shot "+1" whenever live polling brings this row new votes.
  const prevVotes = useRef(option.votes);
  const gained = option.votes > prevVotes.current;
  useEffect(() => {
    prevVotes.current = option.votes;
  }, [option.votes]);

  return (
    <label
      data-option-id={option.id}
      className={cn(
        "poll-option touch-manipulation",
        isMine && "is-mine",
        locked && "is-locked",
      )}
      style={{ ["--fill" as string]: String(scale) }}
    >
      <input
        type="radio"
        name={`pulse-vote-${pollId}`}
        value={option.id}
        className="sr-only"
        checked={isMine}
        disabled={disabled || locked}
        onChange={() => onVote(option.id)}
      />
      <span className="flex min-h-12 items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">
            {option.label}
          </span>
          {isMine ? (
            <span className="poll-picked text-xs text-accent">已选择</span>
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
  );
}
