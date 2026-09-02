import { createFileRoute } from "@tanstack/react-router";
import { LivePollView } from "@/components/poll/live-poll";
import { SharePoll } from "@/components/poll/share-poll";
import { SiteShell } from "@/components/site-shell";
import { fetchPollById } from "@/lib/poll-api";

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
          <a href="/polls" className="ml-2 text-foreground underline">
            看看全部投票
          </a>
        </p>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <LivePollView initialData={initialData} pollId={pollId} />
      <SharePoll />
    </SiteShell>
  );
}
