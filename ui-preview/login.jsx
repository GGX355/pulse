import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { setPreviewHost, useCurrentUserState } from './auth';
export const Route = createFileRoute('/login')({ component: PreviewAccount });
function PreviewAccount() {
  const { user } = useCurrentUserState();
  return <div><h1>体验身份</h1><p className="mt-4">当前：{user ? '示例发起人' : '访客'}</p>
    <p className="mt-3 text-sm">这里是独立功能预览，不收集账号或密码。数据仅留在当前页面，刷新后重置。正式项目保留原登录系统。</p>
    <div className="flex gap-3 mt-6"><button onClick={() => setPreviewHost(true)}>作为发起人</button><button onClick={() => setPreviewHost(false)}>作为访客</button></div>
    {user && <p className="mt-6"><Link to="/new">进入活动后台 ↗</Link></p>}
    <p className="mt-6"><Link to="/">返回最新活动 ↗</Link></p></div>;
}
