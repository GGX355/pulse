import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  castVote,
  effectiveMaxChoices,
  fetchLivePoll,
  fetchPollById,
  type LivePoll,
} from "@/lib/poll-api";
import { useCountUp } from "@/lib/use-count-up";
import { OptionRow } from "@/components/poll/option-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One live poll channel: 1.2s refetch keeps every open tab on the same true
 * counts, and the vote mutation updates optimistically so the tap lands
 * instantly. `pollId` targets a specific poll (detail page); without it the
 * channel follows the newest poll (home / live page).
 */
function useLivePoll(pollId: string | undefined, initialData?: LivePoll) {
  const queryClient = useQueryClient();
  const queryKey = pollId ? (["poll", pollId] as const) : (["live-poll"] as const);
  const query = useQuery({
    queryKey,
    queryFn: () =>
      pollId ? fetchPollById({ data: { pollId } }) : fetchLivePoll(),
    initialData,
    refetchInterval: 1200,
  });

  const vote = useMutation({
    mutationFn: ({
      optionIds,
      note,
      writeInText,
    }: {
      optionIds: string[];
      note: string;
      writeInText: string;
    }) => castVote({ data: { optionIds, note, writeInText, pollId } }),
    onMutate: async ({ optionIds, note, writeInText }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<LivePoll>(queryKey);
      if (prev && (prev.votedIds?.length ?? 0) === 0) {
        const picked = new Set(optionIds);
        queryClient.setQueryData<LivePoll>(queryKey, {
          ...prev,
          votedId: optionIds[0] ?? null,
          votedIds: optionIds,
          myNote: note || null,
          myWriteIn: writeInText || null,
          total: prev.total + optionIds.length,
          options: prev.options.map((row) =>
            picked.has(row.id)
              ? {
                  ...row,
                  votes: row.votes + 1,
                  notes: note ? [...(row.notes ?? []), note] : row.notes,
                  writeIns:
                    row.isWriteIn && writeInText
                      ? [...(row.writeIns ?? []), writeInText]
                      : row.writeIns,
                }
              : row,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return { poll: query.data, isError: query.isError, vote };
}

export function LivePollView({
  initialData,
  pollId,
}: {
  initialData?: LivePoll;
  pollId?: string;
}) {
  const { poll, isError, vote } = useLivePoll(pollId, initialData);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [writeInText, setWriteInText] = useState("");
  const total = useCountUp(poll?.total ?? 0);
  const asksForNote = Boolean(poll?.voterNoteLabel.trim());
  const hasVoted = Boolean(poll && (poll.votedIds?.length ?? 0) > 0);
  const filledNote = (hasVoted ? (poll?.myNote ?? "") : note).trim();
  const needsNote = Boolean(asksForNote && poll && !hasVoted && !poll.closed);
  const multiple = Boolean(poll && (poll.maxChoices === 0 || poll.maxChoices > 1));
  const writeInOption = poll?.options.find((row) => row.isWriteIn);
  const cap = poll
    ? effectiveMaxChoices(poll.maxChoices, poll.options.length)
    : 1;
  const canVote = Boolean(
    poll && !poll.closed && !hasVoted && (!asksForNote || filledNote),
  );
  const pickingWriteIn = Boolean(
    writeInOption && picked.includes(writeInOption.id),
  );
  const writeInReady = !pickingWriteIn || Boolean(writeInText.trim());
  const needsConfirm = multiple || pickingWriteIn;

  function submitVote(optionIds: string[]) {
    vote.mutate({
      optionIds,
      note: filledNote,
      writeInText: writeInText.trim(),
    });
  }

  function toggleOption(optionId: string) {
    if (!poll || !canVote || vote.isPending) return;
    const isFill = poll.options.some((row) => row.id === optionId && row.isWriteIn);
    if (!multiple) {
      if (isFill) {
        setPicked([optionId]);
        return;
      }
      setPicked([]);
      submitVote([optionId]);
      return;
    }
    setPicked((prev) => {
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
      if (prev.length >= cap) return prev;
      return [...prev, optionId];
    });
  }

  if (isError) {
    return (
      <p className="text-sm text-muted">
        暂时无法加载。
        <Link to="/polls" className="ml-2 text-foreground underline">
          投票记录
        </Link>
      </p>
    );
  }

  if (!poll) {
    return <p className="text-sm text-muted">加载中</p>;
  }

  return (
    <section
      className={`flex flex-col gap-6${poll.closed ? " poll-closed" : ""}`}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {poll.question}
          {poll.closed ? <span className="stamp ml-3 align-middle">已结束</span> : null}
        </h1>
        <p className="mt-2 text-sm tabular-nums text-muted">
          共 {total} 票
          {poll.closed
            ? " · 已结束"
            : hasVoted
              ? ` · 你投了 ${poll.votedIds.length} 项`
              : multiple
                ? ` · 最多选 ${cap} 项`
                : ""}
        </p>
      </div>

      {asksForNote ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`pulse-note-${poll.id}`}>{poll.voterNoteLabel}</Label>
          <Input
            id={`pulse-note-${poll.id}`}
            value={hasVoted ? (poll.myNote ?? "") : note}
            maxLength={40}
            readOnly={hasVoted || poll.closed}
            placeholder={`你的${poll.voterNoteLabel}`}
            onChange={(e) => setNote(e.target.value)}
          />
          {needsNote && !filledNote ? (
            <p className="text-xs text-muted">请先填写</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {poll.options.map((option) => {
          const selected = hasVoted
            ? poll.votedIds.includes(option.id)
            : picked.includes(option.id);
          const atMax = multiple && !hasVoted && picked.length >= cap;
          return (
            <OptionRow
              key={option.id}
              option={option}
              pollId={poll.id}
              total={poll.total}
              votedIds={poll.votedIds}
              selected={selected}
              multiple={multiple}
              disabled={
                vote.isPending ||
                poll.closed ||
                !canVote ||
                (atMax && !selected)
              }
              writeInValue={hasVoted ? (poll.myWriteIn ?? "") : writeInText}
              onToggle={toggleOption}
              onWriteInChange={setWriteInText}
            />
          );
        })}
      </div>

      {vote.isError ? (
        <p className="form-error text-sm text-muted">
          {vote.error instanceof Error && vote.error.message
            ? vote.error.message
            : "提交失败，请重试"}
        </p>
      ) : null}

      {needsConfirm && !hasVoted && !poll.closed ? (
        <Button
          type="button"
          disabled={
            !canVote ||
            vote.isPending ||
            picked.length < 1 ||
            !writeInReady
          }
          onClick={() => submitVote(picked)}
        >
          {vote.isPending
            ? "提交中"
            : pickingWriteIn && !writeInText.trim()
              ? "请先填写"
              : "确定"}
        </Button>
      ) : null}
    </section>
  );
}
