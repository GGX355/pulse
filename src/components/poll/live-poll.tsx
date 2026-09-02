import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  castVote,
  fetchLivePoll,
  fetchPollById,
  type LivePoll,
} from "@/lib/poll-api";
import { OptionRow } from "@/components/poll/option-row";
import { Button } from "@/components/ui/button";

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
    mutationFn: (optionId: string) =>
      castVote({ data: { optionId, pollId } }),
    onMutate: async (optionId) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<LivePoll>(queryKey);
      if (prev && !prev.votedId) {
        queryClient.setQueryData<LivePoll>(queryKey, {
          ...prev,
          votedId: optionId,
          total: prev.total + 1,
          options: prev.options.map((row) =>
            row.id === optionId ? { ...row, votes: row.votes + 1 } : row,
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

  if (isError) {
    return (
      <p className="text-sm text-muted">
        暂时读不到现场投票。
        <Link to="/new" className="ml-2 text-foreground underline">
          发起新投票
        </Link>
      </p>
    );
  }

  if (!poll) {
    return <p className="text-sm text-muted">正在同步…</p>;
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted">现场问题</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
          {poll.question}
        </h1>
        <p className="mt-2 text-sm tabular-nums text-muted">
          共 {poll.total} 票
          {poll.votedId ? " · 已投票。这是你的一票。" : " · 每人一票"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {poll.options.map((option) => (
          <OptionRow
            key={option.id}
            option={option}
            pollId={poll.id}
            total={poll.total}
            votedId={poll.votedId}
            disabled={vote.isPending}
            onVote={(id) => vote.mutate(id)}
          />
        ))}
      </div>

      <Button asChild variant="outline">
        <Link to="/new">发起新投票</Link>
      </Button>
    </section>
  );
}
