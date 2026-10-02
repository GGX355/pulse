import { fetchPollById, fetchPollList, castVote, createLivePoll, closeLivePoll, fetchVoteDetails } from '@/lib/poll-api';
import { fetchLiveDraw, fetchDrawList, fetchDrawById, fetchContentById, fetchHomeContent, drawLiveOnce, createDrawLive, listDrawClaims, setDrawResultsPublic, fetchPublicClaims } from '@/lib/draw-api';
import { authClient, authEnabled, signOut } from '@/lib/auth/client';

// This adapter only connects the GitHub-owned frontend to existing server
// functions. Authorization, atomic draws and deadline checks stay on the server.
export function createPulseApi() {
  const getPoll = (id: string) => fetchPollById({ data: { pollId: id } });
  const getDraw = (id: string) => fetchDrawById({ data: { drawId: id } });
  const details = (kind: string, id: string) => kind === 'draw'
    ? listDrawClaims({ data: { pollId: id } }) : fetchVoteDetails({ data: { pollId: id } });
  return {
    demo: false, getPoll, getDraw,
    async initial() {
      const pathname = window.location.pathname;
      const match = pathname.match(/^\/(poll|draw)\/([^/]+)$/);
      const home = await fetchHomeContent();
      const list = await fetchPollList();
      const [poll, draw] = await Promise.all([home.kind === 'poll' ? home.poll : list[0] ? getPoll(list[0].id) : null, home.kind === 'draw' ? home.draw : fetchLiveDraw()]);
      if (match && match[2] !== 'history') {
        const content = await fetchContentById({ data: { contentId: decodeURIComponent(match[2]) } });
        if (!content) throw new Error('这个活动不存在，或已被移除。');
        return { poll: content.kind === 'poll' ? content.poll : poll, draw: content.kind === 'draw' ? content.draw : draw, mode: content.kind };
      }
      return { poll: home?.kind === 'poll' ? home.poll : poll, draw: home?.kind === 'draw' ? home.draw : draw,
        mode: pathname === '/draw' || pathname === '/draw/' ? 'draw' : pathname === '/vote' ? 'poll' : home?.kind || 'explore',
        action: pathname === '/new' ? 'new' : pathname === '/polls' || pathname === '/draw/history' ? 'history' : pathname === '/login' ? 'login' : undefined };
    },
    vote: (data: Parameters<typeof castVote>[0]['data']) => castVote({ data }),
    draw: (data: Parameters<typeof drawLiveOnce>[0]['data']) => drawLiveOnce({ data }),
    async list() {
      const [polls, draws] = await Promise.all([fetchPollList(), fetchDrawList()]);
      return [...polls, ...draws.map(draw => ({ ...draw, kind: 'draw' }))].sort((a, b) => b.createdAtMs - a.createdAtMs);
    },
    createPoll: (data: Parameters<typeof createLivePoll>[0]['data']) => createLivePoll({ data }),
    createDraw: (data: Parameters<typeof createDrawLive>[0]['data']) => createDrawLive({ data }),
    close: (pollId: string) => closeLivePoll({ data: { pollId } }),
    setResultsPublic: (pollId: string, isPublic: boolean) => setDrawResultsPublic({ data: { pollId, isPublic } }),
    publicClaims: (drawId: string) => fetchPublicClaims({ data: { drawId } }),
    details,
    async exportDetails(kind: string, id: string) {
      const rows = await details(kind, id);
      // TSV for human consumption, with formula-leading cells neutralized.
      const cell = (value: unknown) => { const text = String(value ?? '').replace(/[\t\r\n]/g, ' '); return /^[=+@-]/.test(text) ? `'${text}` : text; };
      const columns = rows.length ? Object.keys(rows[0]) : ['记录'];
      const tsv = '\uFEFF' + [columns.join('\t'), ...rows.map(row => columns.map(key => cell((row as unknown as Record<string, unknown>)[key])).join('\t'))].join('\r\n');
      const url = URL.createObjectURL(new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `pulse-${kind}-${id}.tsv`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    async session() {
      if (!authEnabled) return { id: 'dev-user', name: '本地开发' };
      const result = await authClient.getSession();
      if (result.error) throw new Error(result.error.message || '登录状态读取失败');
      return result.data?.user || null;
    },
    async login(data: { email: string; password: string }) {
      const result = await authClient.signIn.email(data);
      if (result.error) throw new Error(result.error.message || '登录失败');
    },
    async signup(data: { name: string; email: string; password: string }) {
      const result = await authClient.signUp.email(data);
      if (result.error) throw new Error(result.error.message || '注册失败');
    },
    logout: () => signOut(),
    select(kind: string, id: string) { window.history.replaceState(window.history.state, '', `/${kind === 'draw' ? 'draw' : 'poll'}/${encodeURIComponent(id)}#pulse-stage`); },
  };
}
