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
            抽签 · 选人
          </h1>
          <p className="mt-2 text-sm text-muted">
            盲选:抽之前没人能看到人数和结果。
          </p>
        </div>
        <Link
          to="/draw/new"
          className="shrink-0 rounded-full border border-border px-4 py-2 text-sm text-muted touch-manipulation transition-colors hover:text-foreground"
        >
          发起抽签
        </Link>
      </div>

      {draws.length === 0 ? (
        <p className="text-sm text-muted">
          还没有抽签。
          <Link to="/draw/new" className="ml-2 text-foreground underline">
            发起第一个
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
                      盲选中
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
                {draw.total === null ? "结果保密" : `${draw.total} 人抽`}
              </span>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-10 text-sm text-muted">
        想投票?
        <Link to="/polls" className="ml-2 text-foreground underline">
          去投票记录
        </Link>
      </p>
    </>
  );
}
