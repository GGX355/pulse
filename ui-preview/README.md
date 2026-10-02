# Full functional preview

Run npm run build:ui-preview from the repository root. This uses the exact application route tree and original feature components/API handlers/repositories. Vite-only aliases substitute an in-memory PGlite database, local cookie map and explicitly labelled example identity. The normal production configuration does not import these adapters.

Login is replaced by an example identity chooser; no credentials are collected. Per-page data is lost on refresh and is not shared between visitors, so QR/deep-link generation can be previewed but does not distribute sample activities. No external database credentials or network API calls are used.

The old api.js and preview.css are unused historical experiments, retained locally and excluded from the source publication.
