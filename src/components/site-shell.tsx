import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { initTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/vote", label: "投票" },
  { to: "/draw", label: "抽签" },
] as const;

const SHELL = "mx-auto w-full max-w-xl px-4";

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUserState();

  const navRef = useRef<HTMLElement | null>(null);
  const moverRef = useRef<HTMLSpanElement | null>(null);
  const themeCycleRef = useRef<() => void>(() => {});

  // 三态主题（跟随系统 → 黑夜 → 白天），偏好持久化在 localStorage。
  // 注意：cleanup 只解绑监听；cycle 不能当 cleanup，否则 StrictMode
  // 双挂载会偷偷消耗一次切换。
  useEffect(() => {
    const t = initTheme();
    themeCycleRef.current = t.cycle;
    return t.dispose;
  }, []);

  // 液态药丸滑到当前激活的导航项下面。
  useLayoutEffect(() => {
    const nav = navRef.current;
    const mover = moverRef.current;
    if (!nav || !mover) return;
    const place = () => {
      const active =
        nav.querySelector<HTMLElement>(".nav-link.on") ??
        nav.querySelector<HTMLElement>(".nav-link");
      if (!active) return;
      mover.style.left = `${active.offsetLeft}px`;
      mover.style.width = `${active.offsetWidth}px`;
    };
    place();
    const t = window.setTimeout(place, 200); // 字体加载后宽度会变
    addEventListener("resize", place);
    return () => {
      window.clearTimeout(t);
      removeEventListener("resize", place);
    };
  }, [pathname, user]);

  // 镜面眩光：所有玻璃框的高光跟随指针。
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".glass"));
    const onMove = (e: PointerEvent) => {
      for (const el of els) {
        const r = el.getBoundingClientRect();
        el.style.setProperty(
          "--gx",
          `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`,
        );
        el.style.setProperty(
          "--gy",
          `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`,
        );
      }
    };
    addEventListener("pointermove", onMove);
    return () => removeEventListener("pointermove", onMove);
  }, [pathname]);

  return (
    <div className="relative flex min-h-dvh flex-col text-foreground">
      {/* Aurora 流动色块 + 颗粒：玻璃的「内容」，颜色从这里透进来 */}
      <div className="orbs" aria-hidden>
        <i className="o1" />
        <i className="o2" />
        <i className="o3" />
        <i className="o4" />
        <i className="o5" />
      </div>
      <div className="grain" aria-hidden />

      <header className="sticky top-3 z-30 px-4">
        <div
          className={cn(
            "nav-shell glass mx-auto h-14 w-full max-w-xl px-2",
            "shadow-none",
          )}
        >
          <Link
            to="/"
            className="relative z-[1] shrink-0 px-3 font-display text-base font-semibold tracking-tight text-foreground"
          >
            Pulse
          </Link>
          <nav
            ref={navRef}
            className="relative flex min-w-0 flex-1 items-center justify-end gap-0.5"
          >
            <span ref={moverRef} className="navmover" aria-hidden />
            {NAV.map((item) => {
              const active =
                pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "nav-link px-2.5 py-2 text-sm touch-manipulation sm:px-3",
                    active
                      ? "on text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {user ? (
              <Link
                to="/new"
                className={cn(
                  "nav-link px-2.5 py-2 text-sm touch-manipulation sm:px-3",
                  pathname === "/new" || pathname.startsWith("/new/")
                    ? "on text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                后台
              </Link>
            ) : null}
          </nav>
          <div className="relative z-[1] flex shrink-0 items-center gap-1">
            <button
              type="button"
              suppressHydrationWarning
              className="theme-btn touch-manipulation"
              onClick={() => themeCycleRef.current()}
            >
              🌗 系统
            </button>
            {user ? (
              <button
                type="button"
                className="nav-link px-2 py-2 text-sm text-muted touch-manipulation hover:text-foreground"
                onClick={() => {
                  void signOut().catch(() => undefined);
                }}
              >
                退出
              </button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/login">登录</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className={cn(SHELL, "relative z-[3] flex-1 pb-28 pt-8")}>
        <div key={pathname} className="page-enter">
          {children}
        </div>
      </main>
      <footer className="relative z-[3] border-t border-border">
        <p className={cn(SHELL, "py-5 pb-16 text-center text-xs text-subtle sm:pb-5")}>
          Pulse
        </p>
      </footer>
    </div>
  );
}
