# Spec (agent) — Urban: Focus & keyboard phase (B-008)

Plan for owner: [../plans/2026-10-19-phase-focus-keyboard.md](../plans/2026-10-19-phase-focus-keyboard.md). Scope: `urban.gardener` only. No migrations, no deps, no web.admin changes. Level 2 process (systematic-debugging, verification-before-completion). Branch `feat/focus-keyboard` in urban.gardener; docs in platform-docs. No commit/push without owner command.

## Decisions (owner, 2026-10-19)
- Field in focus = ONE ring (`--focus-ring`, clay/burgundy); field border `--field-border`/`--leaf` does not change on focus.
- Playwright: add `webkit` and `firefox` projects, but only for the focus spec set (`testMatch`), rest of e2e stays Chromium. Browsers download via `npx playwright install webkit firefox` (~0.5 GB; ask nothing more, owner approved).
- Safari "Tab skips buttons" = Safari default setting (confirmed by owner). No tabindex workarounds.

## Known state (verified 2026-10-19 by grep)
- Global: `app/globals.css` `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }`, `--focus-ring: var(--clay)` (l.62, l.167).
- Local overrides: `NewsletterForm.module.css .light .input:focus-visible` and `ContactForm.module.css .field input/textarea:focus-visible` (l.54) add a border colour on top of the global outline = double ring (root cause of owner observation 1). `SearchForm.module.css .field:focus-within` draws ring on container, input has `outline: none` (variant 3). `FiltersBar.module.css .select/.clear` re-declare the same outline. Cards (`ArticleCard`, `ProductCard`, `CategoryCard`, `FeaturedArticle`): link outline none + `::after` outline -2px (inset, because of overflow clip). `TipBlock.module.css` uses `--clay-soft` on moss. `SearchResultsPanel.module.css` l.56 own outline. `SkipLink.module.css`.
- Programmatic focus points (check ring on text fields via `:focus-visible` heuristics): `Header.tsx` (search input on open, first nav link on menu open, return focus to buttons), `NewsletterModal.tsx` (focus trap, Turnstile iframe), `ContactForm.tsx` (success focus, first invalid field), `ShopCatalog.tsx`, `ProductGrid.tsx`, `FilteredArticleGrid.tsx`.
- Existing unit tests for focus: Header.test, ProductGrid.test, ShopCatalog.test, SearchResultsPanel.test, NewsletterModal tests (Tab/Shift+Tab, hidden Turnstile iframe).

## Steps
**F1 Policy + inventory.** Write `platform-docs/methodology/focus-policy.md` (one paragraph policy + token table): ring 2px, offset 2px (outside) / -2px (inset on clipped cards), colour `--focus-ring` on light, light variant token on moss (`--focus-ring-on-dark`, base on `--clay-soft`, verify ≥ 3:1), field border vs ring not competing, when ring shows (keyboard; text fields always; mouse click on buttons/links no). Inventory table of every interactive element in Urban (component → type → expected Tab order → Esc/return-focus behaviour). Add B-008 link.

**F2 One ring.** Tokens in `globals.css`; delete local `:focus-visible` colour overrides on fields; search: either keep container ring but via the same token/dims (preferred: single mechanism = `:focus-within` on container only where input is visually wrapped, otherwise plain `:focus-visible`), fix any place where ring + border change both appear. Contrast check ≥ 3:1 for ring on light fields/cards and on moss; if clay fails, propose a shade with screenshot to owner (visual decision). 390 px screenshots (playwright MCP) of: newsletter modal, contact form, search panel, mobile menu, shop filters, a card.

**F3 Keyboard pass (Chromium via MCP/Playwright first, then WebKit/Firefox).** For each inventory row: Tab/Shift+Tab order, Esc, return-focus, trap (modal), no keyboard trap elsewhere, skip link. Fix real defects found; log Safari-only differences as notes, not code. Systematic-debugging: reproduce → root cause → fix; no ad-hoc patches.

**F4 Tests.**
- `playwright.config.ts`: projects `chromium` (all), `webkit` and `firefox` with `testMatch: /focus\.spec\.ts/`. Port stays 3200.
- `e2e/focus.spec.ts`: (a) Tab order in newsletter modal (set nothing in localStorage; open via 2nd navigation, or via helper) and Esc returns focus; (b) Contact form order; (c) search open/Esc/return, Clear reachable; (d) mobile menu at 390 px; (e) "single ring": `getComputedStyle` of focused field → `outline-style/width/color` equals token, `border-color` equals unfocused `border-color`; (f) card ring visible inside bounds. On WebKit Tab may skip buttons by default — Playwright WebKit follows Safari rule? Check via Context7 (`/microsoft/playwright`, topic keyboard/Tab in WebKit); if it skips, use Alt+Tab semantics or assert only on form fields in WebKit and document why (do not weaken Chromium tests).
- Unit/component: update tests whose assertions depend on removed local styles (none expected; CSS modules mocked).
- Rule `testing.md`: slice with visible result gets a 390 px check; e2e don't depend on live data (use seed slugs, route mocks).
- Add to `platform-docs/methodology/testing.md` a short line about the focus set and `npx playwright install webkit firefox`.

**F5 Review gate + report.** `a11y-architect` (one per layer); `react-reviewer` only if `.tsx` changed. `npm run build`, `lint`, `test`, `test:e2e` (focus set on 3 browsers + rest on Chromium) all green; report by meta-planning §8; owner checklist = plan §6 (send in chat as questionnaire, §3a). Record phase-x-checklist row, roadmap, memory.

## Pitfalls
- Changing global `:focus-visible` affects Header, FiltersBar, buttons — screenshot before/after.
- Reveal (`.reveal[data-reveal='hidden']:focus-within`) must keep revealing focused elements.
- Turnstile iframe is invisible to Tab in Chromium tests; mirror existing modal test approach.
- `e2e` multi-navigation tests need `localStorage['ug-newsletter']={"subscribed":true}` or the modal intercepts clicks (phase-x-checklist rule); the focus spec for the modal is the exception.
- Dev server: one on :3001 may be already running (not 3200); use temporary playwright config as in Phase 6 if so.
