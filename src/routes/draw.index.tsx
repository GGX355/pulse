import { createFileRoute, Link } from "@tanstack/react-router";
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
          发起一场即可现场扫码参与。
          <Link to="/draw/new" className="ml-2 text-foreground underline">
            新建抽签
          </Link>
        </p>
        <p className="mt-10 text-sm text-muted">
          投票内容见
          <Link to="/polls" className="ml-2 text-foreground underline">
            投票历史
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div key={draw.id}>
        <DrawView initialData={draw} pollId={draw.id} />
      </div>
      <p className="mt-10 text-sm text-muted">
        往期抽签见
        <Link to="/draw/history" className="ml-2 text-foreground underline">
          抽签历史
        </Link>
      </p>
    </>
  );
}
