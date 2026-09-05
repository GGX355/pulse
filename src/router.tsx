import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    // Cross-fade routes through the browser's View Transitions API; the CSS
    // in styles.css styles the old/new snapshots. Unsupported browsers just
    // swap instantly.
    defaultViewTransition: true,
  });
}
