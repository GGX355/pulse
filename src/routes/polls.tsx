import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { fetchPollList } from "@/lib/poll-api";

export const Route = createFileRoute("/polls")({
  loader: () => fetchPollList(),
  component: PollsPage,
});

function formatDate(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PollsPage() {
  const polls = Route.useLoaderData();

  return (
    <SiteShell>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          全部投票
        </h1>
        <p className="mt-2 text-sm text-muted">
          最新的就是现场正在进行的投票,点进去能直接投。
        </p>
      </div>

      {polls.length === 0 ? (
        <p className="text-sm text-muted">
          还没有投票。
          <Link to="/new" className="ml-2 text-foreground underline">
            发起第一个
          </Link>
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {polls.map((poll, index) => (
            <Link
              key={poll.id}
              to="/poll/$pollId"
              params={{ pollId: poll.id }}
              className="flex items-center justify-between gap-3 py-4 touch-manipulation"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {poll.question}
                  </span>
                  {index === 0 ? (
                    <span className="shrink-0 rounded-full border border-accent/30 px-2 py-0.5 text-xs text-accent">
                      现场中
                    </span>
                  ) : null}
                </span>
                <span
                  className="mt-1 block text-xs tabular-nums text-muted"
                  suppressHydrationWarning
                >
                  {formatDate(poll.createdAtMs)}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted">
                {poll.total} 票
              </span>
            </Link>
          ))}
        </div>
      )}
    </SiteShell>
  );
}
