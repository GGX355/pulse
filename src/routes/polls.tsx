import { createFileRoute, Link } from "@tanstack/react-router";
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
  const liveIndex = polls.findIndex((poll) => !poll.closed);

  return (
    <>
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            投票历史
          </h1>
          <p className="mt-2 text-sm text-muted">进行中的在最上面，点击进入。</p>
        </div>
        <Link
          to="/new"
          className="shrink-0 rounded-full border border-border px-4 py-2 text-sm text-muted touch-manipulation transition-colors hover:text-foreground"
        >
          新建投票
        </Link>
      </div>

      {polls.length === 0 ? (
        <p className="text-sm text-muted">暂无投票。</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {polls.map((poll, index) => (
            <Link
              key={poll.id}
              to="/poll/$pollId"
              params={{ pollId: poll.id }}
              className="flex items-center justify-between gap-3 py-4 touch-manipulation hover:opacity-80"
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {poll.question}
                  </span>
                  {poll.closed ? (
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-subtle">
                      已结束
                    </span>
                  ) : index === liveIndex ? (
                    <span className="shrink-0 rounded-full border border-accent/30 px-2 py-0.5 text-xs text-accent">
                      <span className="live-dot mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" />
                      进行中
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
    </>
  );
}
