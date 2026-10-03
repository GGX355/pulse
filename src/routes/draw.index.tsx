import { createFileRoute } from "@tanstack/react-router";
import { DrawView } from "@/components/poll/draw-view";
import { fetchLiveDraw } from "@/lib/draw-api";

/**
 * 「抽签」入口 = 与「投票」同一逻辑:点进来直接是当前(最新)抽签,
 * 历史列表在 /draw/history。
 */
export const Route = createFileRoute("/draw/")({
  loader: () => fetchLiveDraw(),
  component: LiveDrawPage,
});

function LiveDrawPage() {
  const draw = Route.useLoaderData();

  if (!draw) {
    return (
      <>
        <p className="text-xs font-medium tracking-wide text-muted">抽签</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
          暂无进行中的抽签
        </h1>
        <p className="mt-3 text-sm text-muted">
          等待管理员发布新的抽签活动。
        </p>
      </>
    );
  }

  return (
    <>
      <div key={draw.id}>
        <DrawView initialData={draw} pollId={draw.id} />
      </div>
    </>
  );
}
