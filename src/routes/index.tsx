import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LivePollView } from "@/components/poll/live-poll";
import { DrawView } from "@/components/poll/draw-view";
import { fetchHomeContent, type PollContent } from "@/lib/draw-api";

export const Route = createFileRoute("/")({
  loader: () => fetchHomeContent(),
  component: Home,
});

function contentId(content: PollContent): string {
  return content.kind === "poll" ? content.poll.id : content.draw.id;
}

/** 参与到一半:盲选没抽、投票没投 —— 这时候新发布不该把人硬切走。 */
function isMidFlow(content: PollContent): boolean {
  if (content.kind === "draw") {
    return !content.draw.closed && content.draw.blind;
  }
  return !content.poll.closed && content.poll.votedIds.length === 0;
}

/**
 * 主页 = 大家手里共用的那一个链接:永远指向最新发布的抽签或投票。
 * 每 2 秒跟上最新发布(后台标签页也轮);唯一例外:有人正参与一半
 * (没投完/没抽完)时先留住当前内容,给一条「立即查看」,不硬切。
 */
function Home() {
  const initialData = Route.useLoaderData();
  const latestQuery = useQuery({
    queryKey: ["home-content"],
    queryFn: () => fetchHomeContent(),
    initialData,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
  const latest = latestQuery.data ?? initialData;

  // 见过的内容都留着,"保持"只记 id —— 显示哪条永远单点推导,不和轮询赛跑。
  const cacheRef = useRef<Map<string, PollContent>>(new Map());
  cacheRef.current.set(contentId(initialData), initialData);
  cacheRef.current.set(contentId(latest), latest);

  const [holdId, setHoldId] = useState<string | null>(null);
  const prevLatestIdRef = useRef(contentId(initialData));

  useEffect(() => {
    cacheRef.current.set(contentId(latest), latest);
    const newId = contentId(latest);
    const prevId = prevLatestIdRef.current;
    if (newId !== prevId) {
      prevLatestIdRef.current = newId;
      // 只在"没在保持"时才决定要不要保持:已经在保持的人原地不动,不跳版本。
      if (holdId === null) {
        const prevContent = cacheRef.current.get(prevId);
        if (prevContent && isMidFlow(prevContent)) setHoldId(prevId);
      }
    }
    // 保持中的内容已经抽完/投完/结束 → 自动松手跟上最新。
    if (holdId) {
      const held = cacheRef.current.get(holdId);
      if (!held || !isMidFlow(held)) setHoldId(null);
    }
  }, [latest, holdId]);

  const active = (holdId && cacheRef.current.get(holdId)) || latest;
  const hasNew = holdId !== null;

  return (
    <>
      {hasNew ? (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-surface p-4">
          <p className="text-sm text-muted">主持人发布了新内容。</p>
          <button
            type="button"
            onClick={() => setHoldId(null)}
            className="shrink-0 rounded-full border border-accent/40 px-4 py-2 text-sm text-accent touch-manipulation"
          >
            立即查看
          </button>
        </div>
      ) : null}

      {active.kind === "poll" ? (
        <>
          <p className="text-xs font-medium tracking-wide text-muted">
            现场投票 · 最新发布
          </p>
          <div className="mt-4" key={`poll-${contentId(active)}`}>
            {/* 必须钉住这条投票自己的 id:不带 id 时内层会去轮"最新进行中投票",
                主页一旦保持旧内容,画面就会被内层偷偷换成新的。 */}
            <LivePollView
              initialData={active.poll}
              pollId={contentId(active)}
            />
          </div>
          <p className="mt-10 text-sm text-muted">
            想抽签选人?
            <Link to="/draw" className="ml-2 text-foreground underline">
              去抽签区
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="text-xs font-medium tracking-wide text-muted">
            现场抽签 · 最新发布
          </p>
          <div className="mt-4" key={`draw-${contentId(active)}`}>
            <DrawView initialData={active.draw} pollId={contentId(active)} />
          </div>
          <p className="mt-10 text-sm text-muted">
            想投票?
            <Link to="/polls" className="ml-2 text-foreground underline">
              去投票记录
            </Link>
          </p>
        </>
      )}
    </>
  );
}
