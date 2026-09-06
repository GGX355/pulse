import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { QueryProvider } from "@/components/query-provider";
import { SiteShell } from "@/components/site-shell";
import appCss from "../styles.css?url";

const APP_NAME = "Pulse";

// 水合前写入 data-theme，避免主题闪屏；偏好与 lib/theme.ts 一致。
const THEME_NO_FLASH = `(function(){try{var p=localStorage.getItem("pulse-theme")||"system";var d=matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=p==="system"?(d?"dark":"light"):p;}catch(e){}})()`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: light)",
        content: "#f2f6ff",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: dark)",
        content: "#04050a",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      // 字体走系统栈(--font-sans 的 SF Pro/PingFang/雅黑回退链):
      // 现场网络不可控,render-blocking 的第三方字体 CSS 在弱网/被墙
      // 环境会卡死首屏。要恢复网页字体请用自托管 woff2。
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
    scripts: [{ children: THEME_NO_FLASH }],
  }),
  component: () => (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <QueryProvider>
            <SiteShell>
              <Outlet />
            </SiteShell>
          </QueryProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
