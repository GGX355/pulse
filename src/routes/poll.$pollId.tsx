import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { closeLivePoll, fetchPollById } from "@/lib/poll-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { LivePollView } from "@/components/poll/live-poll";
import { SharePoll } from "@/components/poll/share-poll";
import { SiteShell } from "@/components/site-shell";

export const Route = createFileRoute("/poll/$pollId")({
  loader: ({ params }) => fetchPollById({ data: { pollId: params.pollId } }),
  component: PollDetailPage,
});

function PollDetailPage() {
  const initialData = Route.useLoaderData();
  const { pollId } = Route.useParams();

  if (initialData === null) {
    return (
      <SiteShell>
        <p className="text-sm text-muted">
          没有找到这个投票(可能已被删除)。
          <Link to="/polls" className="ml-2 text-foreground underline">
            看看全部投票
          </Link>
        </p>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <LivePollView initialData={initialData} pollId={pollId} />
      <ClosePollButton pollId={pollId} />
      <SharePoll />
    </SiteShell>
  );
}

/** Only the poll's creator sees this; the server enforces it either way. */
function ClosePollButton({ pollId }: { pollId: string }) {
  const { user } = useCurrentUserState();
  const queryClient = useQueryClient();
  const close = useMutation({
    mutationFn: () => closeLivePoll({ data: { pollId } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      void queryClient.invalidateQueries({ queryKey: ["live-poll"] });
    },
  });

  const initialData = Route.useLoaderData();
  const canClose =
    user !== null &&
    initialData !== null &&
    !initialData.closed &&
    initialData.creatorId !== null &&
    initialData.creatorId === user.id;
  if (!canClose) return null;

  return (
    <div className="mt-6">
      <Button
        variant="outline"
        disabled={close.isPending}
        onClick={() => {
          if (window.confirm("确定结束这场投票?结束后大家不能再投。")) {
            close.mutate();
          }
        }}
      >
        {close.isPending ? "结束中…" : "结束投票"}
      </Button>
      {close.isError ? (
        <p className="mt-2 text-sm text-muted">没结束成,请再试一次。</p>
      ) : null}
    </div>
  );
}
