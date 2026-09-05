import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <span className="text-accent" aria-hidden="true">
        <TriangleAlert className="size-8" strokeWidth={2} />
      </span>
      <h1 className="font-display text-lg font-semibold tracking-tight">
        这一页没打开
      </h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message || "再试一次，或者回首页。"}
      </p>
    </div>
  );
}
