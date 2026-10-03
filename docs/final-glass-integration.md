# PULSE dev functionality restored — 2026-10-03

Functional baseline: GGX355/pulse dev, 3bc3a3f7e294a14a0731354d7131112679e824e0.
Visual source: https://github.com/GGX355/liquid-glass-template/tree/main/pulse-final

## Correction
The previous FinalGlassShell discarded its children and substituted a smaller vanilla controller. The original routes and backend code were still present, but unreachable. The shell now mounts the real router outlet into the approved glass activity panel and exposes current content, histories, creation/management, accounts and comparison routes.

The HTML frame is memoized so React updates cannot reset DOM owned by the optical engine. A mutation observer registers new controls with the same glass material. Original feature layouts and flip/scratch/grid animation rules are scoped under the portal; a background .grid collision is explicitly neutralized there. Optical maps, spring and pointer engines are unchanged.

## Function coverage
- Original single/multi/unlimited/write-in voting, registration, deadlines and live polling.
- Poll and draw creation templates, quantities, finite/unlimited blanks, roster configuration and reveal-mode selection.
- Original flip, scratch and nine-grid reveal components.
- Original histories, owner/admin views, close/delete confirmation, public-results switch, participant directory, roster checks, vote/claim exports, QR/link sharing.
- Original real authentication routes/providers, API validators, permission checks and SQL repositories remain in the application. Previously authorized deadline, hydration, scratch and export corrections remain.

## Public preview boundary
ui-preview imports the same generated route tree, original feature components, original API validators/handlers and original repositories. Only its build config replaces the server transport/database with isolated browser PGlite and example identities. This preview never collects passwords or contacts the production backend. It is NOT shared persistent voting: refresh clears data, links/QR render but cannot transfer page-local activities to another visitor. Real app login and shared database behavior remain in the normal build. vote.fflun.com is unchanged.
The preview's browser database adds approximately 16 MB of raw WASM/data assets; these are not in the normal production client.

## Verification
Typecheck and production build pass. Lint has no errors (existing platform warnings plus preview Fast Refresh warnings). All 79 business/auth tests pass; 35 visual/physics tests pass. Browser QA: original creation form with roster, multi-select and write-in; successful vote; roster 1/2; TSV export content; draw template publication; nine-grid reveal and admin counts; public-results toggle; guest management gate; 390 px layout without horizontal overflow. Destructive deletion and real credential submission were not performed in the browser.

## Branches
dev is the default. Old main had no unique commits and was 61 commits behind dev. It was archived at archive/main-2026-10-03 before local/remote branch removal. Feature work is validated on codex/pulse-glass-preview and fast-forwarded to dev without history rewriting.

## Full-width workspace (2026-10-03)

The embedded app hides laboratory marketing, stories, sample interactions and decorative side panels. Original route content fills the single-column glass workspace. On mobile the card uses almost the whole viewport width and long forms scroll with the document. Appearance controls live in a compact header disclosure. Two-tab navigation retains the original spring and routes both pointer and keyboard input to the original vote/draw pages. Optical parameters and business routes are unchanged.

Validation: typecheck, normal and static builds passed; lint has 0 errors and 7 existing warnings; 15 motion/transition tests passed. Browser checks at 390 and 320 CSS pixels found no horizontal overflow. Sample voting, keyboard mode switching and creation of a new poll passed; long forms have no internal height cap.

## Neutral themes and persistent material (2026-10-03)

Light workspace uses the header ivory background; dark uses the original PULSE near-black gradient and blue/violet light colours. The lab landscape is hidden only in embedded mode. Controls share convex edges and keep them after selection. React className changes are observed only when they remove the material class, restoring the existing surface without regenerating filters. Fixed the 54px label box inside a 44px navigation pill, centred activity headings, and unified history cards and 44px delete targets.

Browser regression: repeated single/multiple-choice toggles retain liquid-surface and glass-overlay; voting and pointer exit retain the selected convex face. Light/dark 390px and history at 320px render without horizontal overflow.

## Readable draw surfaces (2026-10-03)

Removed the laboratory scene class from the original draw-grid: it was imposing a dark background, fixed display height and light text on the functional card grid. Explicitly styled front/back faces in both themes, retained preserve-3d on the turning parent, and added card index and clear reveal labels. The 700ms flip now completes before the result wall replaces it at 1100ms. Dark surfaces use separate charcoal/page and blue-grey/card levels with lower pointer-glare opacity. Only browser sample activity/prize names changed, never existing stored activities.

Browser QA: desktop flip captured mid-rotation, final result matches the selected card and recorded result; mobile light/dark card faces, scratch/grid selection, 320px overflow and console checks passed.
