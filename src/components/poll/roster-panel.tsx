import { useQuery } from "@tanstack/react-query";
import { fetchRosterStatus } from "@/lib/poll-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

/**
 * 发起人专属的名单核对:名单上每个人 已参与(含结果)/未参与。
 * 数据 1.5s 刷新;没配名单或不是发起人时整块不渲染。
 */
export function RosterPanel({
  pollId,
  creatorId,
}: {
  pollId: string;
  creatorId: string | null;
}) {
  const { user } = useCurrentUserState();
  // 无主(建号系统前)历史:登录者可视作发起人管理(与服务端守卫一致)。
  const isCreator =
    Boolean(user) && (creatorId === null || user?.id === creatorId);
  const query = useQuery({
    queryKey: ["roster", pollId],
    queryFn: () => fetchRosterStatus({ data: { pollId } }),
    enabled: isCreator,
    refetchInterval: 1500,
  });

  if (!isCreator || !query.data?.hasRoster) return null;
  const { entries, doneCount, total } = query.data;

  return (
    <details className="mt-2 rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-xs font-medium tracking-wide text-muted">
        名单核对（已参与 {doneCount}/{total}）
      </summary>
      <div className="mt-3 flex flex-col divide-y divide-border">
        {entries.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate font-medium text-foreground">
              {entry.name}
            </span>
            {entry.done ? (
              <span className="shrink-0 text-right text-xs text-muted">
                <span className="block text-foreground">{entry.result}</span>
                <span
                  className="tabular-nums"
                  suppressHydrationWarning
                >
                  {new Date(entry.atMs ?? 0).toLocaleString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
            ) : (
              <span className="shrink-0 text-xs text-subtle">未参与</span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
