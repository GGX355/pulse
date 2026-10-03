import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import source from '../../../vendor/pulse-final/pulse.html?raw';
import { mountPulse } from '../../../vendor/pulse-final/pulse-runtime.js';
import { useCurrentUserState } from '@/lib/auth/use-current-user';
import { isAdminEmail } from '@/lib/auth/admin';

const HomeActivityContext = createContext<(kind: 'poll' | 'draw') => void>(() => {});
export const useHomeActivity = () => useContext(HomeActivityContext);

// GitHub owns the optical frame and workspace styles. The app mounts original
// routes and moves their navigation/settings into the compact working shell.
const body = source.split(/<body[^>]*>/)[1].split('</body>')[0]
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  .replaceAll('href="lab.html"', 'href="/glass-lab/lab.html"')
  .replaceAll('href="pulse.html"', import.meta.env.VITE_UI_PREVIEW ? 'href="/#/"' : 'href="/"');

export function FinalGlassShell({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  // The optical engine owns this DOM. Never reset innerHTML on route/state renders.
  const frame = useMemo(() => <div ref={host} dangerouslySetInnerHTML={{ __html: body }} />, []);
  const mounted = useRef<ReturnType<typeof mountPulse> | null>(null);
  const [outlet, setOutlet] = useState<HTMLElement | null>(null);
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const isAdmin = !!user && (('isAdmin' in user && user.isAdmin === true) || user.isDevFallback || isAdminEmail(user.primaryEmail));
  const [homeKind, setHomeKind] = useState<'poll' | 'draw' | null>(null);
  const path = useRouterState({ select: state => state.location.pathname });
  const routeMode = useRouterState({ select: state => {
    const data = state.matches.at(-1)?.loaderData as { kind?: string } | undefined;
    const search = state.location.search as { kind?: string };
    return state.location.pathname.startsWith('/draw') || search.kind === 'draw' || data?.kind === 'draw' ? 'draw' : 'poll';
  } });
  const activityMode = path === '/' && homeKind ? homeKind : routeMode;
  const managementPage = path === '/new' || path === '/draw/new' || path === '/polls' || path === '/draw/history';
  const navigateRef = useRef(navigate); navigateRef.current = navigate;
  useEffect(() => {
    const frameRoot = host.current!;
    document.body.classList.add('pulse-site', 'pulse-application'); document.body.dataset.material = 'liquid';
    const element = document.createElement('div'); element.className = 'pulse-business-host'; element.id = 'pulse-original-routes';
    const nav = document.createElement('nav'); nav.className = 'pulse-account-nav'; nav.setAttribute('aria-label', '管理员账号');
    host.current!.querySelector<HTMLElement>('#poll-panel')!.dataset.glass = '28';
    host.current!.querySelector('#poll-panel')!.append(element);
    host.current!.querySelector('.site-header')!.append(nav);
    const controls = host.current!.querySelector<HTMLElement>('.pulse-controls')!;
    controls.hidden = true;
    const theme = host.current!.querySelector('#pulse-theme');
    if (theme) host.current!.querySelector('.site-header')!.append(theme);
    try { localStorage.setItem('pulse-liquid-profile', 'balanced'); } catch { /* Optional persistence. */ }
    setOutlet(element); setToolbar(nav);
    const app = mountPulse({ embedded: true }); mounted.current = app;
    const preview = import.meta.env.VITE_UI_PREVIEW;
    host.current!.querySelector('.preview-tag')!.textContent = preview ? '完整功能预览 · 示例数据' : '一起投票 · 遇见好运';
    host.current!.querySelector('.footer-links > span')!.textContent = preview ? '沿用 PULSE dev 全部功能页面。示例数据仅在本页，刷新后重置。' : '让每一份心意，都被认真记录。';
    const controller = new AbortController();
    const routeClick = (event: Event) => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      if (anchor) { event.preventDefault(); host.current?.querySelector(anchor.getAttribute('href')!)?.scrollIntoView({ behavior: 'smooth' }); return; }
      const target = (event.target as Element).closest<HTMLElement>('[data-go],[data-nav-mode],#poll-tab,#draw-tab');
      if (!target || !host.current?.contains(target)) return;
      const mode = target.dataset.go || target.dataset.navMode || (target.id === 'draw-tab' ? 'draw' : 'poll');
      if (mode === 'explore') return;
      void navigateRef.current({ to: mode === 'draw' ? '/draw' : '/vote' });
    };
    host.current!.addEventListener('click', routeClick, { signal: controller.signal });
    host.current!.addEventListener('keydown', event => {
      if (!(event.target as Element).closest('.pulse-nav') || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const selected = host.current!.querySelector('.pulse-nav [aria-selected="true"]');
      void navigateRef.current({ to: selected?.id === 'draw-tab' ? '/draw' : '/vote' });
    }, { signal: controller.signal });
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList' ||
        (record.target instanceof Element && record.target.hasAttribute('data-glass') &&
          !record.target.classList.contains('liquid-surface')))) app.refreshGlass();
    });
    const observedChanges = { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] };
    observer.observe(element, observedChanges);
    observer.observe(nav, observedChanges);
    return () => { observer.disconnect(); controller.abort(); app.destroy(); frameRoot.querySelector('main')?.append(controls); controls.hidden = false; element.remove(); nav.remove(); document.body.classList.remove('pulse-application'); mounted.current = null; };
  }, []);
  useEffect(() => {
    if (!outlet || !mounted.current) return;
    outlet.classList.toggle('pulse-admin-page', managementPage || path === '/login');
    mounted.current.setMode(activityMode);
    outlet.scrollTop = 0;
    mounted.current.refreshGlass();
  }, [outlet, path, activityMode, managementPage]);
  return <>
    {frame}
    {outlet && createPortal(<HomeActivityContext.Provider value={setHomeKind}>
      {managementPage && !isAdmin ? <div className="py-8 text-center"><h1>管理员登录</h1><Link to="/login">进入管理员账号</Link></div> : children}
    </HomeActivityContext.Provider>, outlet)}
    {toolbar && createPortal(<>
      <details className="pulse-admin-menu" key={path}>
        <summary>管理员</summary>
        <div className="pulse-admin-menu-content">
          {isAdmin ? <><Link to="/new">发起与管理</Link><Link to="/polls">投票记录</Link><Link to="/draw/history">抽签记录</Link><Link to="/login">账号设置</Link></> : <Link to="/login">管理员登录</Link>}
          <Link to="/">返回最新活动</Link>
          {import.meta.env.VITE_UI_PREVIEW && !import.meta.env.VITE_CF_APP && <small>示例数据 · 刷新后重置</small>}
        </div>
      </details>
    </>, toolbar)}
  </>;
}
