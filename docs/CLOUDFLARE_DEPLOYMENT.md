# PULSE public preview — 2026-10-03

- Current host: Cloudflare Pages, project `pulse-glass-fflun`, account `7f0b586154f038de872c4d69a8f19b9b`.
- Public entry: https://vote.fflun.com/ (root selects the latest activity; `#/vote` deliberately selects voting).
- Provider URL: https://pulse-glass-fflun.pages.dev/.
- Custom domain is active with SSL enabled. Its old ChatGPT Sites binding was removed; the old Sites URL remains an independent fallback snapshot.
- Deploy the output of `npm run build:ui-preview`, plus `public/fonts` under `fonts/` and the existing optical reference under `glass-lab/`. Use Pages direct upload for this project; do not publish to Sites expecting this domain to update.
- Latest package: `C:/Users/CYZ20/Documents/GitHub/pulse-ui-site/evidence/pulse-cloudflare-participant-20261003.zip`.
- The participant starts as a guest. History and creation tools appear in the administrator menu after choosing the demo host. This remains a static demo with in-memory per-page data and simulated identity, not real administrator authentication or a shared production database.
- Original application authentication and protected APIs remain in the PULSE source for a future full-stack deployment. Hiding menu items is not an authorization boundary.
- Mainland China access has not been verified using a mainland network without a proxy. Cloudflare global hosting does not guarantee mainland availability.

Validation: typecheck, full build, static preview build and existing tests passed (79 data/auth tests). Lint: no errors, eight warnings. Dev and built pages rendered without console errors. Mobile 390px participant layout inspected; local UI publishing verified poll → newer draw → newer poll homepage transitions.
