# Cloudflare application adapter

Status on 2026-10-03: deployed and live-verified at https://vote.fflun.com/. Deployment: 4659b336-d8e2-4dbc-9e48-f505a274e115. The owner saved the production password secret before deployment.

This build preserves the PULSE dev React routes and the pinned glass renderer. `npm run build:cloudflare` replaces browser-local preview APIs with same-origin calls to `worker.js`. The original PostgreSQL/Better Auth application remains available via the normal build; the new score/privacy controls are enabled only in the Cloudflare build.

## Production configuration

- Pages project: `pulse-glass-fflun`, URL https://vote.fflun.com/.
- Account: `7f0b586154f038de872c4d69a8f19b9b`.
- D1 database: `pulse-vote`, ID `9f7058aa-5c76-4c87-aa2c-c542c52c698c`.
- Production binding: `DB` (active in the deployed worker).
- `schema.sql` executed successfully in the new, empty database.
- Required secret: `ADMIN_PASSWORD`, entered and saved by the owner in the Pages production settings. No password is in the source, client bundle or this document. Alternatively configure `ADMIN_PASSWORD_HASH` as `salt:PBKDF2-SHA256-100000-hex`; the hash takes precedence.
- Admin sessions expire after 8 hours; server-side records store session token hashes. Cookies are Secure, HttpOnly and SameSite=Strict. Authenticated mutations verify the request Origin. The login endpoint allows eight attempts per IP / 15-minute bucket.
- No seed data is written to production. Previous public data was per-browser, per-page demo data and is not migrated. The first real activity must be published by the administrator.

## Build and verification

1. `npm run test:cloudflare` (authorization, CSRF, rate limit, private data projection, numerical validation, duplicate submissions, roster enforcement, latest activity and concurrent final-ticket claims).
2. `npm run typecheck`, `npm test`, `npm run build`, `npm run build:cloudflare`.
3. Copy `public/fonts/` into `artifacts/cloudflare-dist/fonts/`.
4. Upload the **contents** of `artifacts/cloudflare-dist/` as a ZIP through Pages direct upload. `_worker.js` must be at the ZIP root. Do not upload `cloudflare/` sources, local QA server or test files.
5. After deploying, verify real login/logout, cross-browser shared activity, private result responses and mobile rendering on the custom domain.

Prepared package: `C:/Users/CYZ20/Documents/GitHub/pulse-ui-site/evidence/pulse-cloudflare-roster-20261003.zip`.

Local QA uses `node cloudflare/preview.mjs` with an in-memory SQLite database and a synthetic test credential. That server is not deployed. Vite development mode uses `npm run dev -- --config cloudflare/vite.config.mjs --port 8097` and proxies the API to that local server.

## Data guarantees and limits

Each activity and its submissions are stored in one versioned D1 row. Updates use compare-and-swap and revalidate against current state after conflicts; there is no read-then-unconditional-write allocation. Deletion is soft deletion. An activity is limited to 800 KB serialized data and eight conflict retries, with a visible retry/error response rather than silent data loss. This is intended for small group activities, not large public high-concurrency voting.

Participant identity is a long-lived browser cookie, matching the original anonymous participation model. It is not proof of a person's real identity; a roster enforces one submission per entered name but does not authenticate the name. Public poll results include option counts and submitted notes/write-ins; private polls return only the current browser's choice/score and no other participants' counts or content, even after closing. Draw reveal behavior and weighted random allocation follow the original dev implementation.

Local verification completed: all 79 existing data/auth tests, the existing script tests, five Cloudflare integration tests, typecheck, original full build and Cloudflare build; lint has no errors. Browser verification covered password login/logout, score creation and submission, desktop/mobile and light/dark modes. Live checks passed: administrator login/logout, unauthorized rejection, shared voting records across independent cookie sessions, private data redaction including after closing, numeric bounds/duplicate rejection/average, latest-activity routing and final draw capacity. Three synthetic QA activities were soft-deleted afterwards. Browser login and mobile 390px admin settings rendered without overflow or console errors; balanced profile and absent appearance button were verified.

## Saved class roster

Administrators can reuse a named roster in both creation forms. getClassRoster and setClassRoster require administrator authentication; the latter validates unique nonempty names. The settings table is created lazily and idempotently in D1. Names are server data, never bundled into source. Applying a saved roster enables name registration and roster validation without publishing an activity.

Verified on 2026-10-03: six Cloudflare integration tests pass, typecheck and both builds pass, lint has no errors (12 existing warnings). Live saved-roster read/write and guest denial passed; both forms populated the saved roster correctly. Existing activities were unchanged.
