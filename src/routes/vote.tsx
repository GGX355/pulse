import { createFileRoute } from "@tanstack/react-router";
import { LivePollView } from "@/components/poll/live-poll";
import { fetchLivePoll } from "@/lib/poll-api";

export const Route = createFileRoute("/vote")({
  loader: () => fetchLivePoll(),
  component: VotePage,
});

function VotePage() {
  const initialData = Route.useLoaderData();
  return <LivePollView initialData={initialData} />;
}
