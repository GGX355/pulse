import { createFileRoute, Link } from "@tanstack/react-router";
import { LivePollView } from "@/components/poll/live-poll";
import { DrawView } from "@/components/poll/draw-view";
import { fetchHomeContent } from "@/lib/draw-api";

export const Route = createFileRoute("/")({
  loader: () => fetchHomeContent(),
  component: Home,
});

function Home() {
  const content = Route.useLoaderData();

  return (
    <>
      {content.kind === "poll" ? (
        <>
          <p className="text-xs font-medium tracking-wide text-muted">
            现场投票 · 最新发布
          </p>
          <div className="mt-4">
            <LivePollView initialData={content.poll} />
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-medium tracking-wide text-muted">
            现场抽签 · 最新发布
          </p>
          <div className="mt-4">
            <DrawView initialData={content.draw} pollId={content.draw.id} />
          </div>
        </>
      )}

      <p className="mt-10 text-sm text-muted">
        {content.kind === "poll" ? (
          <>
            想抽签选人?
            <Link to="/draw" className="ml-2 text-foreground underline">
              去抽签区
            </Link>
          </>
        ) : (
          <>
            想投票?
            <Link to="/polls" className="ml-2 text-foreground underline">
              去投票记录
            </Link>
          </>
        )}
      </p>
    </>
  );
}
