import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { closeLivePoll } from "@/lib/poll-api";
import { fetchContentById } from "@/lib/draw-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { DrawView } from "@/components/poll/draw-view";
import { LivePollView } from "@/components/poll/live-poll";
import { SharePoll } from "@/components/poll/share-poll";

export const Route = createFileRoute("/poll/$pollId")({
  loader: ({ params }) =>
    fetchContentById({ data: { contentId: params.pollId } }),
  component: PollDetailPage,
});

function PollDetailPage() {
  const initialData = Route.useLoaderData();
  const { pollId } = Route.useParams();

  if (initialData === null) {
    return (
      <p className="text-sm text-muted">
        没有找到这个内容(可能已被删除)。
        <Link to="/polls" className="ml-2 text-foreground underline">
          看看全部内容
        </Link>
      </p>
    );
  }

  return (
    <>
      {initialData.kind === "draw" ? (
        <DrawView initialData={initialData.draw} pollId={pollId} />
      ) : (
        <LivePollView initialData={initialData.poll} pollId={pollId} />
      )}
      <ClosePollButton pollId={pollId} />
      <SharePoll />
    </>
  );
}

/** Only the poll's creator sees this; the server enforces it either way. */
function ClosePollButton({ pollId }: { pollId: string }) {
  const { user } = useCurrentUserState();
  const queryClient = useQueryClient();
  const close = useMutation({
    mutationFn: () => closeLivePoll({ data: { pollId } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["content", pollId] });
      void queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      void queryClient.invalidateQueries({ queryKey: ["live-poll"] });
    },
  });

  const initialData = Route.useLoaderData();
  const content =
    initialData === null
      ? null
      : initialData.kind === "draw"
        ? initialData.draw
        : initialData.poll;
  const canClose =
    user !== null &&
    content !== null &&
    !content.closed &&
    content.creatorId !== null &&
    content.creatorId === user.id;
  if (!canClose) return null;

  return (
    <div className="mt-6">
      <Button
        variant="outline"
        disabled={close.isPending}
        onClick={() => {
          if (window.confirm("结束这场活动?结束后大家不能再参与。")) {
            close.mutate();
          }
        }}
      >
        {close.isPending ? "结束中" : "结束"}
      </Button>
      {close.isError ? (
        <p className="mt-2 text-sm text-muted">没结束成,再试一次。</p>
      ) : null}
    </div>
  );
}
