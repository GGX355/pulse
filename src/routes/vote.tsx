import { createFileRoute } from "@tanstack/react-router";
import { LivePollView } from "@/components/poll/live-poll";
import { fetchLivePoll } from "@/lib/poll-api";

/** 导航「投票」:进行中的投票,点进来直接投。 */
export const Route = createFileRoute("/vote")({
  loader: () => fetchLivePoll(),
  component: VotePage,
});

function VotePage() {
  const initialData = Route.useLoaderData();
  if (!initialData) return <p className="py-10 text-center text-muted">暂无投票</p>;
  return (
    <>
      <div className="mt-4">
        <LivePollView initialData={initialData} />
      </div>
    </>
  );
}
