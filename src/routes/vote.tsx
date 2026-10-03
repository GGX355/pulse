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
  return (
    <>
      <p className="text-xs font-medium tracking-wide text-muted">投票</p>
      <div className="mt-4">
        <LivePollView initialData={initialData} />
      </div>
    </>
  );
}
