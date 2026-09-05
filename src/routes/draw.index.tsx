import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchDrawList } from "@/lib/draw-api";

export const Route = createFileRoute("/draw/")({
  loader: () => fetchDrawList(),
  component: DrawsPage,
});

function formatDate(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DrawsPage() {
  const draws = Route.useLoaderData();

  return (
    <>
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            抽签历史
          </h1>
          <p className="mt-2 text-sm text-muted">盲选模式，参与后可见结果。</p>
        </div>
        <Link
          to="/draw/new"
          className="shrink-0 rounded-full border border-border px-4 py-2 text-sm text-muted touch-manipulation transition-colors hover:text-foreground"
        >
          新建抽签
        </Link>
      </div>

      {draws.length === 0 ? (
        <p className="text-sm text-muted">
          暂无抽签。
          <Link to="/draw/new" className="ml-2 text-foreground underline">
            新建
          </Link>
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {draws.map((draw, index) => (
            <Link
              key={draw.id}
              to="/draw/$drawId"
              params={{ drawId: draw.id }}
              className="flex items-center justify-between gap-3 py-4 touch-manipulation hover:opacity-80"
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {draw.title}
                  </span>
                  {draw.closed ? (
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-subtle">
                      已结束
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-accent/30 px-2 py-0.5 text-xs text-accent">
                      <span className="live-dot mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" />
                      进行中
                    </span>
                  )}
                </span>
                <span
                  className="mt-1 block text-xs tabular-nums text-muted"
                  suppressHydrationWarning
                >
                  {formatDate(draw.createdAtMs)}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted">
                {draw.total === null ? "保密" : `${draw.total} 人参与`}
              </span>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-10 text-sm text-muted">
        投票内容见
        <Link to="/polls" className="ml-2 text-foreground underline">
          投票历史
        </Link>
      </p>
    </>
  );
}
