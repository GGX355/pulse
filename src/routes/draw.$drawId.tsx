import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchDrawById } from "@/lib/draw-api";
import { closeLivePoll } from "@/lib/poll-api";
import { DrawView } from "@/components/poll/draw-view";
import { SharePoll } from "@/components/poll/share-poll";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/draw/$drawId")({
  loader: ({ params }) =>
    fetchDrawById({ data: { drawId: params.drawId } }),
  component: DrawDetailPage,
});

function DrawDetailPage() {
  const initialData = Route.useLoaderData();
  const { drawId } = Route.useParams();

  if (initialData === null) {
    return (
      <p className="text-sm text-muted">
        抽签不存在或已被删除。
        <Link to="/draw" className="ml-2 text-foreground underline">
          返回抽签
        </Link>
      </p>
    );
  }

  return (
    <>
      <DrawView initialData={initialData} pollId={drawId} />
      <CloseDrawButton drawId={drawId} />
      <SharePoll />
    </>
  );
}

/** 只有发起人看到;服务端无论如何都会再校验一次。 */
function CloseDrawButton({ drawId }: { drawId: string }) {
  const { user } = useCurrentUserState();
  const queryClient = useQueryClient();
  const close = useMutation({
    mutationFn: () => closeLivePoll({ data: { pollId: drawId } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["draw-view", drawId] });
      void queryClient.invalidateQueries({ queryKey: ["draw-admin", drawId] });
      void queryClient.invalidateQueries({ queryKey: ["draw-claims", drawId] });
      void queryClient.invalidateQueries({ queryKey: ["content", drawId] });
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
          if (window.confirm("结束后将不可再参与，结果对所有人公开。确定结束？")) {
            close.mutate();
          }
        }}
      >
        {close.isPending ? "结束中" : "结束抽签"}
      </Button>
      {close.isError ? (
        <p className="mt-2 text-sm text-muted">操作失败，请重试。</p>
      ) : null}
    </div>
  );
}
