import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreatePollForm } from "@/components/poll/create-poll";
import { CreateDrawForm } from "@/components/poll/create-draw";
import { VoterRoster } from "@/components/poll/voter-roster";
import { DrawsAdminList, PollsAdminList } from "@/components/poll/admin-lists";

export const Route = createFileRoute("/new")({
  validateSearch: (search: Record<string, unknown>): { kind?: "poll" | "draw" } => ({
    kind:
      search.kind === "draw"
        ? "draw"
        : search.kind === "poll"
          ? "poll"
          : undefined,
  }),
  component: NewPage,
});

function NewPage() {
  const { kind = "poll" } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <>
      <p className="mb-6 text-xs font-medium tracking-wide text-muted">后台</p>

      <div className="relative mb-8 grid grid-cols-2 rounded-full border border-border bg-surface p-1">
        <span
          aria-hidden
          className={
            "tab-slider " +
            (kind === "draw" ? "translate-x-full" : "translate-x-0")
          }
        />
        {(
          [
            ["poll", "投票"],
            ["draw", "抽签"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() =>
              void navigate({ to: "/new", search: { kind: value } })
            }
            className={
              "relative z-10 h-9 rounded-full text-sm touch-manipulation transition-colors duration-200 " +
              (kind === value
                ? "text-foreground"
                : "text-muted hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {kind === "poll" ? (
        <>
          <CreatePollForm />
          <div className="mt-12">
            <PollsAdminList />
          </div>
        </>
      ) : (
        <>
          <CreateDrawForm />
          <div className="mt-12">
            <DrawsAdminList />
          </div>
        </>
      )}

      <div className="mt-12">
        <VoterRoster />
      </div>
    </>
  );
}
