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
    return <p className="py-10 text-center text-muted">暂无抽签</p>;
  }

  return (
    <>
      <div key={draw.id}>
        <DrawView initialData={draw} pollId={draw.id} />
      </div>
    </>
  );
}
