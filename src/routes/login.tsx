import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteShell } from "@/components/site-shell";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "signin" | "signup";

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();

  if (isPending) {
    return (
      <SiteShell>
        <p className="text-sm text-muted">正在确认登录状态…</p>
      </SiteShell>
    );
  }

  if (user) {
    return (
      <SiteShell>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          已经登录
        </h1>
        <p className="mt-2 text-sm text-muted">
          当前账号:{user.displayName ?? user.primaryEmail}
        </p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => void navigate({ to: "/new" })}>去发起投票</Button>
          <Button
            variant="outline"
            onClick={() => {
              void signOut().catch(() => undefined);
            }}
          >
            退出登录
          </Button>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <AuthForm onDone={() => void navigate({ to: "/new" })} />
    </SiteShell>
  );
}

function AuthForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result =
        mode === "signin"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              name: name.trim() || email.split("@")[0] || "发起人",
              email,
              password,
            });
      if (result.error) {
        setError(result.error.message ?? "没有成功,请再试一次。");
        return;
      }
      onDone();
    } catch {
      setError("没有成功,请再试一次。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)}>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {mode === "signin" ? "登录" : "注册"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          登录后才能发起和结束投票。投票的人不需要登录。
        </p>
      </div>

      <div className="relative grid grid-cols-2 rounded-full border border-border bg-surface p-1">
        <span
          aria-hidden
          className={
            "absolute inset-y-1 left-1 w-[calc(50%-6px)] rounded-full bg-surface-2 transition-transform duration-250 ease-out " +
            (mode === "signup" ? "translate-x-[calc(100%+8px)]" : "translate-x-0")
          }
        />
        {(
          [
            ["signin", "登录"],
            ["signup", "注册"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={
              "relative z-10 h-9 rounded-full text-sm touch-manipulation transition-colors duration-200 " +
              (mode === value ? "text-foreground" : "text-muted hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "signup" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">昵称(可选)</Label>
          <Input
            id="name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="现场展示的名字"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          type="password"
          value={password}
          required
          minLength={8}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "至少 8 位" : "你的密码"}
        />
      </div>

      {error ? <p className="form-error text-sm text-muted">{error}</p> : null}

      <Button type="submit" disabled={pending || !email.trim() || !password}>
        {pending ? (
          <>
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border border-current border-t-transparent"
            />
            请稍候…
          </>
        ) : mode === "signin" ? (
          "登录"
        ) : (
          "注册并登录"
        )}
      </Button>
    </form>
  );
}
