import { useQuery } from "@tanstack/react-query";
import { listVoterProfiles } from "@/lib/poll-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

function formatWhen(ms: number): string {
  try {
    return new Date(ms).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Signed-in admin only: names remembered from this phone's cookie. */
export function VoterRoster() {
  const { user, isPending } = useCurrentUserState();
  const query = useQuery({
    queryKey: ["voter-profiles"],
    queryFn: () => listVoterProfiles(),
    enabled: Boolean(user),
  });
  if (isPending || !user) return null;

  if (query.isPending) {
    return <p className="text-sm text-muted">加载中</p>;
  }
  if (query.isError) {
    return <p className="text-sm text-muted">名单暂时看不到。</p>;
  }

  const rows = query.data ?? [];

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">参与者</h2>
        <p className="mt-1 text-xs text-muted">
          投票时写过名字的人。只有你在后台能看见。
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">还没人写过名字。</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((row, index) => (
            <li
              key={`${row.displayName}-${row.updatedAtMs}-${index}`}
              className="flex items-baseline justify-between gap-3 px-3 py-2"
            >
              <span className="font-medium text-foreground">{row.displayName}</span>
              <span className="shrink-0 text-xs text-muted">
                {row.pollCount} 场 · {formatWhen(row.updatedAtMs)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
