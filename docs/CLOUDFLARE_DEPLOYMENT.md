# PULSE Cloudflare deployment — 2026-10-03

- Public entry: https://vote.fflun.com/ (automatically opens the newest active activity).
- Administrator login: https://vote.fflun.com/#/login.
- Project: `pulse-glass-fflun`; deployment `e21e1dc7-3a47-4f97-8c22-8b7c60f81aea`.
- Provider URL: https://pulse-glass-fflun.pages.dev/.
- Full-stack build: `npm run build:cloudflare`. See [Cloudflare adapter documentation](../cloudflare/README.md) for database, secret, tests and deployment instructions.
- This release replaces the previous browser-local demo with a server-authenticated administrator and shared D1 storage. The original PostgreSQL / Better Auth build remains available separately.
- Production D1 `pulse-vote` and `DB` binding are active. The owner entered the encrypted password secret; no actual password is stored in source.
- Live tests passed for login/logout, unauthorized management rejection, independent participant sessions, private results, numerical scores, duplicate/range validation, latest activity and draw capacity. QA activities were soft-deleted; no real activity was removed.
- Prepared deployment ZIP: `C:/Users/CYZ20/Documents/GitHub/pulse-ui-site/evidence/pulse-cloudflare-auth-score-20261003.zip`.
- The Pages direct-upload environment label is `main`; this is a hosting label, not the Git source branch. PULSE source is based on `dev`.
- The old ChatGPT Sites site is an independent historical snapshot and no longer hosts this domain.
- Mainland access without a proxy remains unverified; Cloudflare global hosting does not guarantee it.
