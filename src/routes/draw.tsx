import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * /draw 区块的布局壳:抽签列表(/draw)、发起(/draw/new)、详情(/draw/$drawId)
 * 都嵌套在这里渲染。抽签与投票自此各自独立成区。
 */
export const Route = createFileRoute("/draw")({
  component: () => <Outlet />,
});
