import { createFileRoute } from "@tanstack/react-router";
import { LivePollView } from "@/components/poll/live-poll";
import { SiteShell } from "@/components/site-shell";
import { fetchLivePoll } from "@/lib/poll-api";

export const Route = createFileRoute("/")({
  loader: () => fetchLivePoll(),
  component: Home,
});

function Home() {
  const initialData = Route.useLoaderData();
  return (
    <SiteShell live wide>
      <div className="mb-10">
        <p className="text-xs font-medium tracking-wide text-muted">现场投票</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
          Pulse
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
          每人一票。结果条跟着真实票数走，现场立刻能看见。
        </p>
      </div>
      <LivePollView initialData={initialData} />
    </SiteShell>
  );
}
