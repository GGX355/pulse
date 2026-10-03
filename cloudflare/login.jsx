import React, { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { signIn, signOut, useCurrentUserState } from "./auth";
export const Route = createFileRoute("/login")({ component: Login });
function Login() {
  const { user, isPending } = useCurrentUserState();
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const client = useQueryClient(),
    navigate = useNavigate();
  if (isPending) return <p role="status">加载中</p>;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-center">管理员</h1>
      {user ? (
        <>
          <Link to="/new" className="text-center">
            管理活动
          </Link>
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await signOut();
                client.clear();
                await navigate({ to: "/" });
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            退出登录
          </button>
        </>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await signIn(password);
              setPassword("");
              client.clear();
              await navigate({ to: "/new" });
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="admin-password">密码</label>
          <input
            className="h-12 rounded-xl px-4"
            id="admin-password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button disabled={busy}>{busy ? "登录中" : "登录"}</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <Link to="/" className="text-center">
        返回活动
      </Link>
    </div>
  );
}
