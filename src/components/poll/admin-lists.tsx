import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { fetchPollList } from "@/lib/poll-api";
import { fetchDrawListAdmin } from "@/lib/draw-api";
import { useCanDelete, useDeleteContent } from "@/lib/content-admin";

/** 行右侧的删除叉号(红色悬停,确认后删除)。 */
function DeleteX({
  onDelete,
  label,
}: {
  onDelete: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={`删除${label}`}
      title="删除"
      className="shrink-0 rounded-full px-2 py-1 text-base leading-none text-subtle transition-colors hover:bg-red-500/10 hover:text-red-500"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm(`确定删除「${label}」？删除后不可恢复。`)) onDelete();
      }}
    >
      ✕
    </button>
  );
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RowInner({
  title,
  when,
  badge,
  right,
}: {
  title: string;
  when: number;
  badge: ReactNode;
  right: string;
}) {
  return (
    <span className="flex min-w-0 items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{title}</span>
          {badge}
        </span>
        <span
          className="mt-0.5 block text-xs tabular-nums text-muted"
          suppressHydrationWarning
        >
          {formatDate(when)}
        </span>
      </span>
      <span className="shrink-0 text-sm tabular-nums text-muted">{right}</span>
    </span>
  );
}

const rowClass =
  "flex items-center py-3 touch-manipulation hover:opacity-80 [&>span]:w-full";

const liveBadge = (
  <span className="shrink-0 rounded-full border border-accent/30 px-2 py-0.5 text-xs text-accent">
    <span className="live-dot mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" />
    进行中
  </span>
);

const closedBadge = (
  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-subtle">
    已结束
  </span>
);

/** 后台-投票侧:所有投票,带实时票数。 */
export function PollsAdminList() {
  const polls = useQuery({
    queryKey: ["polls-admin"],
    queryFn: () => fetchPollList(),
    refetchInterval: 3000,
  });
  const del = useDeleteContent();
  const canDelete = useCanDelete();
  const rows = polls.data ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        投票记录
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">暂无投票。</p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border px-3">
          {rows.map((poll) => (
            <div key={poll.id} className="flex items-center">
              <Link
                to="/poll/$pollId"
                params={{ pollId: poll.id }}
                className={rowClass + " min-w-0 flex-1"}
              >
                <RowInner
                  title={poll.question}
                  when={poll.createdAtMs}
                  badge={poll.closed ? closedBadge : liveBadge}
                  right={`${poll.total} 票`}
                />
              </Link>
              {canDelete(poll.creatorId) ? (
                <DeleteX
                  label={poll.question}
                  onDelete={() => del.mutate(poll.id)}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** 后台-抽签侧:所有抽签,进行中的也显示真实人数(仅后台可见)。 */
export function DrawsAdminList() {
  const draws = useQuery({
    queryKey: ["draws-admin"],
    queryFn: () => fetchDrawListAdmin(),
    refetchInterval: 3000,
  });
  const del = useDeleteContent();
  const canDelete = useCanDelete();
  const rows = draws.data ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        抽签记录
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">暂无抽签。</p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border px-3">
          {rows.map((draw) => (
            <div key={draw.id} className="flex items-center">
              <Link
                to="/draw/$drawId"
                params={{ drawId: draw.id }}
                className={rowClass + " min-w-0 flex-1"}
              >
                <RowInner
                  title={draw.title}
                  when={draw.createdAtMs}
                  badge={
                    draw.closed ? (
                      closedBadge
                    ) : draw.allTaken ? (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-subtle">
                        全部抽完
                      </span>
                    ) : (
                      liveBadge
                    )
                  }
                  right={`${draw.totalTaken} 人${draw.voterNoteLabel ? " · 记名" : ""}`}
                />
              </Link>
              {canDelete(draw.creatorId) ? (
                <DeleteX
                  label={draw.title}
                  onDelete={() => del.mutate(draw.id)}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
