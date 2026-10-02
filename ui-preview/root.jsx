import React from 'react';
import { createRootRoute, Outlet, Link } from '@tanstack/react-router';
import { QueryProvider } from '../src/components/query-provider';
import { FinalGlassShell } from '../src/components/final-glass/shell';
export const Route = createRootRoute({
  component: () => <QueryProvider><FinalGlassShell><Outlet /></FinalGlassShell></QueryProvider>,
  pendingComponent: () => <p role="status">正在准备示例活动…</p>,
  errorComponent: ({ error }) => <p role="alert">{error.message}</p>,
  notFoundComponent: () => <p>活动不存在。<Link to="/">返回当前活动</Link></p>,
});
