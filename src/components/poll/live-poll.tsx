import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { castVote, fetchLivePoll, type LivePoll } from "@/lib/poll-api";
import { OptionRow } from "@/components/poll/option-row";
import { Button } from "@/components/ui/button";

export function LivePollView({ initialData }: { initialData?: LivePoll }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["live-poll"],
    queryFn: () => fetchLivePoll(),
    initialData,
    refetchInterval: 1200,
  });

  const poll = query.data;
  const vote = useMutation({
    mutationFn: (optionId: string) => castVote({ data: { optionId } }),
    onMutate: async (optionId) => {
      await queryClient.cancelQueries({ queryKey: ["live-poll"] });
      const prev = queryClient.getQueryData<LivePoll>(["live-poll"]);
      if (prev && !prev.votedId) {
        queryClient.setQueryData<LivePoll>(["live-poll"], {
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
      if (ctx?.prev) queryClient.setQueryData(["live-poll"], ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["live-poll"] });
    },
  });

  if (query.isError) {
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
