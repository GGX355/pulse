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
      {
        rel: "stylesheet",
        href: "https://fonts.cdnfonts.com/css/sf-pro-display",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
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
