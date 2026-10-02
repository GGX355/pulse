import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
const path = name => fileURLToPath(new URL(name, import.meta.url));
export default defineConfig({
  root: path('./'), base: '/', publicDir: false,
  define: { 'import.meta.env.VITE_UI_PREVIEW': 'true' },
  plugins: [{ name: 'preview-route-transport', enforce: 'pre', resolveId(source, importer) {
    if (!importer?.includes('routeTree.gen')) return;
    return ({ './routes/__root': path('./root.jsx'), './routes/login': path('./login.jsx'), './routes/api/auth/$': path('./auth-route.jsx') })[source];
  } }, tailwind(), react()],
  resolve: { alias: [
    { find: '@tanstack/react-start/server', replacement: path('./transport.js') },
    { find: '@tanstack/react-start', replacement: path('./transport.js') },
    { find: '@/lib/db', replacement: path('./db.js') },
    { find: '@/lib/auth/middleware', replacement: path('./transport.js') },
    { find: '@/lib/auth/use-current-user', replacement: path('./auth.jsx') },
    { find: '@/lib/auth/client', replacement: path('./auth.jsx') },
    { find: '@/lib/auth/gates', replacement: path('./auth.jsx') },
    { find: 'node:crypto', replacement: path('./crypto.js') },
    { find: '@', replacement: path('../src') },
  ] },
  build: { outDir: path('../artifacts/ui-preview-dist'), emptyOutDir: true },
});
