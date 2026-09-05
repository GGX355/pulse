import { createFileRoute } from "@tanstack/react-router";
import { LivePollView } from "@/components/poll/live-poll";
import { fetchLivePoll } from "@/lib/poll-api";

export const Route = createFileRoute("/")({
  loader: () => fetchLivePoll(),
  component: Home,
});

function Home() {
  const initialData = Route.useLoaderData();
  return <LivePollView initialData={initialData} />;
}
