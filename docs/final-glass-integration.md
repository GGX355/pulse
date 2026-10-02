# GitHub final frontend integration

Authoritative visual source: https://github.com/GGX355/liquid-glass-template/tree/main/pulse-final

`scripts/sync-final-glass.mjs` copies source files verbatim and records SHA-256 provenance in `vendor/pulse-final/SOURCE.json`. The shell renders that HTML and imports those styles and animation modules; it does not mount the previous React UI. The only app-specific presentation adjustment is asset URLs.

`src/components/final-glass/api.ts` connects existing server functions to that frontend: voting (single/multiple/write-in/roster/deadline), drawing (server-selected outcomes and blind-safe views), history, creation, email sign-in/sign-up, management, closing, result visibility, TSV export, sharing. AuthProvider, QueryProvider, PreviewHostBridge and the platform PWA hooks remain mounted. Backend authorization and SQL are not replaced by demo code. Live refresh stays on the current activity and preserves unsubmitted selections.

The public `pulse-glass` Site uses the separately identified in-memory demo adapter. It does not promise persistent activities and never collects a real password. `vote.fflun.com` is unchanged. Backend integration is built and exercised locally; public backend deployment remains separate.

Validation: 35 frontend tests, existing repository tests, typecheck, production build, lint (existing warnings only); browser checks of desktop/narrow layout, voting, saved vote after reload, creation, drawing, dialogs and console errors. A local seeded lunch poll received one synthetic QA vote. No production records were touched.

Preserved on disk: earlier UI experiments and authorized deadline/hydration/scratch/export corrections. No force push or history rewrite.

Remaining production acceptance: hosting/database/auth configuration and full owner-flow acceptance with the intended deployment account; deep comparison/roster-directory and destructive deletion screens are not exposed in this frontend revision. Existing server functions remain available and enforce their original permissions.
