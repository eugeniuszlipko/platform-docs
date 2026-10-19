# Spec (agent) — Urban Gardener: Phase X (final pre-launch audit)

Plan for owner: [../plans/2026-10-19-phase-x-final-check.md](../plans/2026-10-19-phase-x-final-check.md). Source of truth for what to verify: `../plans/phase-x-checklist.md` (all sections) + decision log `../../urban-gardener.md` §2 (D1–D39) + accepted-phase reports in `../plans/*.md`. Scope: `urban.gardener`, Urban section of `web.admin`, schema `urban_gardener` on Supabase `base-one`. Process: level 2 (systematic-debugging for each failure, verification-before-completion for every "green" claim); no impl-plan, no design spec. A ledger table replaces the plan.

## Rules
- Bug (code ≠ decision/spec), red test, missing grant, missing alt, wrong status code → fix myself, report. Visual or business decision → owner questionnaire (meta-planning §3), never decide silently.
- Do NOT edit live content in DB (Test product, Test Article, test edits in About/Privacy, example brands, subscribers/messages test rows are owner's Phase 9 list). Read-only SQL on live data. Schema fix (grant/policy) → tell owner first, migration numbered 0031+, applied to `base-one` only after "ок". Owner scope answer (2026-10-19): B-007 + B-004 + B-005 are IN; B-006 (admin a11y) is OUT.
- Do not change Vercel env. `ALLOW_INDEXING=true` is exercised in a local production build only.
- Spec-driven tests, not behaviour-driven ("tests written to spec"): a failing test whose spec is clear keeps failing → owner report, code untouched only if the spec is ambiguous; otherwise fix code (X is the fix phase, unlike test-engineer protocol).
- No commit/push without explicit command. Owner answer Q1 (2026-10-19): focus branch is committed, ff-merged to `main` and pushed to prod BEFORE Phase X starts (done in the planning chat, command given by owner); all Phase X fixes go on `feat/phase-x` branched from that `main` in each repo.
- Findings outside launch scope → `backlog/B-010…` + index line + one line in chat.

## Preconditions (check first, 5 min)
1. `git status` of urban.gardener / web.admin / platform-docs; branch per Q1. `.env.local` present (Supabase URL/anon, Turnstile *test* keys; no secret key → 2 preview e2e skip, expected).
2. Free disk (≥ 5 GB; `.next/dev/cache` can be cleaned, owner allowed 2026-10-19). Playwright browsers installed (`npx playwright install chromium webkit firefox`).
3. Context7 for any unfamiliar API (Playwright, Next 16 `robots`/`sitemap`, Lighthouse CLI).

## Steps

**X1 Decision audit (ledger).** One row per D1…D39 and per row of phase-x-checklist sections (Решения проекта, Правила и уроки, Фазы 3–8, Фокус). Columns: source · check · method (grep/test/SQL/curl/browser/owner-manual) · result (✅ / ❌ fixed / ❌ owner / ⏳ owner-manual) · evidence (command + key output). Keep the ledger in `plans/2026-10-19-phase-x-final-check.md` §8 as it fills; chat gets a summary table, not the file.

**X2 Full run + B-007.**
- urban.gardener: `npm run build`, `npm run lint`, `npx tsc --noEmit -p tsconfig.json` (and vitest tsconfig if separate), `npm test`, `npm run test:e2e` (all projects; port 3200 — second `next dev` conflicts with the dev server on 3001, kill or use temp config as in earlier phases).
- web.admin: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` (port 5173; no live Supabase).
- B-007: make e2e independent of live data. Known: `shop.spec.ts` price filters ("impossible price range", "Under €15", "€50 and up") and `easy-care` presence; `shell.spec.ts` "content is visible without JavaScript" hard-codes `localhost:3200` → relative via `baseURL`; check `home.spec.ts` shop block, `search.spec.ts` ("test" query finds Test records), `newsletter.spec.ts` / `contact.spec.ts` (≥2 navigations must set `ug-newsletter` and `ug_cookie_consent`). Method: seed slugs + `page.route` fixtures for exact lists/empty states (testing.md "e2e и живые данные"). Verify by running once with a fake "Test product €100" scenario via route mock, not by editing DB.
- Pre-existing "reveal › content visible without JS", "2 skipped preview tests": document, don't hide.
- 390 px: every visible-result slice has a 390 px test or screenshot (testing.md rule); list gaps and close them (home, articles, article, topics, shop hub/category/product, search, about, contact, privacy/terms, 404, cookie banner, newsletter modal).
- `/design` stand: confirm noindex and that it is in the Phase 9 delete list (not deleted here).

**B-005 (in X2).** Header at 320 px: menu button sticks out 4 px (see backlog B-005 for repro). Fix in CSS (`Header.module.css`), 320 px e2e/screenshot assertion `scrollWidth <= innerWidth` on /, /articles, /shop, /product/<seed>, /search, /contact, 404; check against `focus-policy.md` (no ring clipping).

**B-004 (in X3).** Migration 0031: `revoke truncate` (and any other unneeded privilege: `trigger`, `references`) from `anon, authenticated` on Phase 2 tables (+ any other found by audit); fix `guard_topic_delete` race (lock the topic row `for update` or re-check in the same statement) per backlog B-004. Draft SQL → show owner → `database-reviewer` → apply to `base-one` → re-run `has_table_privilege` checks. Admin writes go through RPC/RLS so no UI regression; run admin unit tests + one manual topic delete via SQL in a transaction rolled back.

**X3 Database audit (`base-one`, schema `urban_gardener`).**
- `list_migrations` vs repo `supabase/migrations/0001–0030` (drift = ❌). Do not apply anything.
- Roles `anon` / `authenticated` non-admin / admin: `has_table_privilege`, `has_column_privilege` (incl. `articles.preview_token`, `products.preview_token` hidden from anon; `subscribers`, `messages`, `media`, `admin_folders` closed; TRUNCATE/ALTER grants → B-004), RLS enabled everywhere, policies "anon sees only published", RPC `EXECUTE` grants (`save_article`, `save_product`, `save_home_page`, `save_about_page`, `save_site_settings`, `search_content`, preview RPC, contact/newsletter writes), `safeupdate` `where true` rule, `guard_*` triggers.
- Behavioural: select as anon through PostgREST with publishable key (curl) → unpublished article/product 0 rows; token column → 401/permission denied; insert into subscribers/messages as anon → denied.
- `get_advisors` security + performance; classify each (fix/ignore with reason).
- Storage bucket `urban-gardener-photos`: public read, write admin-only; every image URL in DB answers 200 (script, `curl -I`); `alt = ''` scan (articles, products, home slots, about).
- Data hygiene read-only: list test/placeholder rows (feeds X6).

**X4 Review gate — one reviewer per layer, parallel, read-only** (skills/ecc/README.md table):
- `database-reviewer` — all migrations 0001–0030 once (fresh eyes on whole schema), RLS/grants.
- `silent-failure-hunter` — `lib/`, `app/api/*`, `sitemap.ts`/`robots.ts`, admin `lib/ug*.ts`.
- `react-reviewer` — one run per repo (site, admin).
- `a11y-architect` — final pass: site shell, forms (newsletter, contact), search combobox, cookie banner, shop filters, articles; admin Urban screens only for B-006 items if owner includes them.
- `seo-specialist` — against a local `ALLOW_INDEXING=true` production build (robots.txt Allow + Sitemap host, `index, follow`, sitemap content, canonical, OG, JSON-LD validity) and against live noindex state.
- `typescript-reviewer` — only if a big converter changed; otherwise skip.
- CRITICAL/HIGH → fix or owner; MEDIUM → fix if cheap, else checklist/Phase 9; rerun a reviewer only on changed files.

**X5 Live site + performance (https://urban-gardener.vercel.app, production).**
- `curl -sI` all routes from sitemap + `/nope`, `/articles/nope`, `/shop/nope`, `/product/nope`, `/topics/nope`, `/preview/articles/x?token=bad` → expected codes (200 / real 404); `robots.txt` = `Disallow: /`; `<meta name="robots">` noindex on pages; `/search` noindex,follow; `/sitemap.xml` exists but not advertised.
- Preview: valid token → 200 for draft; no/bad token → 404 (needs a draft and secret key; if no draft exists, owner-manual item).
- Anon cannot read `preview_token` (401).
- Lighthouse (CLI, mobile + desktop) on `/`, `/articles`, a topic, an article, `/shop`, a category, a product, `/search?q=monstera`, `/about`, `/contact`; record LCP/CLS/INP-proxy/TBT and a11y/SEO/best-practices scores; compare with checklist rows (LCP of home = heading; featured photo preload decision, Phase 4 react-review); `/search` response time (Phase 6 row), `/search` under WebKit on prod build (Focus row 4).
- Hydration/console errors on 5 key pages (playwright MCP console), mobile 390 and desktop 1280 screenshots, 404 and empty states (empty topic/category, 0 search results, error boundary).
- GA/consent: without GA-ID nothing loads (Network); with test ID only locally (Accept → request, Decline → none, withdraw stops) — already covered by e2e; live check with real ID is Phase 9.

**X6 Owner pre-launch list.** Merge `phase-x-checklist.md` "Финальный список владельца" rows 1–8 + Phase 7 owner rows + findings of X1–X5 into one table: item · state · what depends on it · who. Highlight blockers vs. nice-to-have. Update the checklist file; B-009 (favicon/og from admin) stays in Phase 9 (step 9.0a).

**X7 Report + acceptance.** Report format meta-planning §8 (Что сделано → Проверено → Что нужно от вас → Что изменилось). Acceptance checklist goes to chat (§3a), as questionnaire "работает / не работает / иначе". After "принято": status in plan + roadmap (X.1–X.6 → [x]), memory, name next phrase "Планируем фазу 9". Write-offs go to `phase-x-checklist.md` as "closed in X".

## Out of scope (explicit)
Domain/GA-ID/`ALLOW_INDEXING` on Vercel, favicon/og:image (B-009), Amazon prices & links (owner list), deletion of test content, CozyCorner/Avocado, adopting `focus-policy.md` elsewhere, new features, ESP for newsletter.

## Done criteria
Ledger has no ❌ except items explicitly deferred by owner; `build`/`lint`/`tsc`/unit/e2e green in both repos (numbers recorded); advisors triaged; reviewers: no open CRITICAL/HIGH; owner list delivered; B-007 closed in backlog index.
