import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * This app's own Better Auth endpoint (sign-up / sign-in / get-session, …).
 * The client (`@/lib/auth/client`) talks to same-origin `/api/auth/*`, so the
 * session cookie stays on this origin. Better Auth handles every method and
 * path under this catch-all and returns a full Response itself.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
