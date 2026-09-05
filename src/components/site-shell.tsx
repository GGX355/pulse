import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "现场" },
  { to: "/draw", label: "抽签" },
] as const;

const SHELL = "mx-auto w-full max-w-xl px-4";

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUserState();

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className={cn(SHELL, "flex h-14 items-center justify-between gap-2")}>
          <Link
            to="/"
            className="shrink-0 font-display text-base font-semibold tracking-tight text-foreground"
          >
            Pulse
          </Link>
          <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/" || pathname === "/vote"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-md px-2.5 py-2 text-sm touch-manipulation transition-colors duration-200 sm:px-3",
                    active
                      ? "bg-surface-2 text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="ml-1 flex shrink-0 items-center gap-1">
              {user ? (
                <>
                  <Link
                    to="/new"
                    className={cn(
                      "rounded-md px-3 py-2 text-sm touch-manipulation transition-colors duration-200",
                      pathname === "/new" || pathname.startsWith("/new/")
                        ? "bg-surface-2 text-foreground"
                        : "text-muted hover:text-foreground",
                    )}
                  >
                    后台
                  </Link>
                  <button
                    type="button"
                    className="rounded-md px-2 py-2 text-sm text-muted touch-manipulation hover:text-foreground"
                    onClick={() => {
                      void signOut().catch(() => undefined);
                    }}
                  >
                    退出
                  </button>
                </>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to="/login">登录</Link>
                </Button>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main className={cn(SHELL, "flex-1 pb-28 pt-8")}>
        <div key={pathname} className="page-enter">
          {children}
        </div>
      </main>
      <footer className="border-t border-border">
        <p className={cn(SHELL, "py-5 pb-16 text-center text-xs text-subtle sm:pb-5")}>
          Pulse
        </p>
      </footer>
    </div>
  );
}
