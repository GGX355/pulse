import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "首页" },
  { to: "/vote", label: "现场" },
  { to: "/new", label: "发起" },
] as const;

export function SiteShell({
  children,
  live = false,
  wide = false,
}: {
  children: ReactNode;
  live?: boolean;
  wide?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div
          className={cn(
            "mx-auto flex h-14 items-center justify-between gap-3 px-4",
            wide ? "max-w-3xl" : "max-w-xl",
          )}
        >
          <Link
            to="/"
            className="font-display text-base font-semibold tracking-tight text-foreground"
          >
            Pulse
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm touch-manipulation",
                    active
                      ? "bg-surface-2 text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {live ? (
              <Badge className="ml-1 border-accent/30 text-accent">
                <span className="size-1.5 rounded-full bg-accent" />
                LIVE
              </Badge>
            ) : null}
          </nav>
        </div>
      </header>
      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 pb-28 pt-8",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        {children}
      </main>
      <footer className="border-t border-border px-4 py-5 pb-16 text-center text-xs text-subtle sm:pb-5">
        Pulse · 每人一票 · 实时同步
      </footer>
    </div>
  );
}
