import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreatePollForm } from "@/components/poll/create-poll";
import { CreateDrawForm } from "@/components/poll/create-draw";
import { VoterRoster } from "@/components/poll/voter-roster";

export const Route = createFileRoute("/new")({
  component: NewPage,
});

function NewPage() {
  const [mode, setMode] = useState<"poll" | "draw">("poll");

  return (
    <>
      <p className="mb-6 text-xs font-medium tracking-wide text-muted">后台</p>
      <div className="relative mb-8 grid grid-cols-2 rounded-full border border-border bg-surface p-1">
        <span
          aria-hidden
          className={
            "absolute inset-y-1 left-1 w-[calc(50%-6px)] rounded-full bg-surface-2 transition-transform duration-250 ease-out " +
            (mode === "draw" ? "translate-x-[calc(100%+8px)]" : "translate-x-0")
          }
        />
        {(
          [
            ["poll", "发起投票"],
            ["draw", "发起抽签"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={
              "relative z-10 h-9 rounded-full text-sm touch-manipulation transition-colors duration-200 " +
              (mode === value
                ? "text-foreground"
                : "text-muted hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "poll" ? <CreatePollForm /> : <CreateDrawForm />}
      <div className="mt-12">
        <VoterRoster />
      </div>
    </>
  );
}
