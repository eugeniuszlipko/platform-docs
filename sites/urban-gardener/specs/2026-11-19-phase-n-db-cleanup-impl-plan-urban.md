# Phase N — urban.gardener Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development (recommended) or executing-plans. Steps use `- [ ]`.

**Goal:** Remove the hidden product spec fields and dormant affiliate columns, add publish CHECKs to `articles`, fix a lock-order gap, add row-limit guards to site loaders.
**Architecture:** One migration `0037_db_cleanup.sql` (written here, applied only after the code is deployed and the owner confirms) plus site code that no longer selects the dropped columns. Admin side: [web.admin plan](2026-11-19-phase-n-db-cleanup-impl-plan-admin.md).
**Tech Stack:** Next.js 16, Vitest + RTL, Supabase (schema `urban_gardener`, base-one).
**Spec:** [2026-11-19-phase-n-db-cleanup-spec.md](2026-11-19-phase-n-db-cleanup-spec.md). Branch `feat/db-cleanup`.

## Global Constraints
- Migration number **0037**; newest existing is `0036_site_settings_brand.sql`.
- Dropped columns: `products.light/water/size/pet_safety`, `site_settings.affiliate_disclosure/price_note`. Owner chose DELETE (9 products lose data).
- Re-created RPCs (`save_product`, `save_site_settings`) must re-issue `revoke all … from public, anon` + `grant execute … to authenticated, service_role`.
- "Pet-friendly" is a shop **category**, not the `pet_safety` column: do not touch category filters, search, JSON-LD.
- Never apply the migration, push or deploy without the owner's command (guard hook enforces it).

## Review Focus
- `save_product` / `save_site_settings` lose execute grants after re-creation → check with `has_function_privilege('anon', …)` = false, `authenticated` = true.
- Published article with whitespace-only `cover_path` or `read_minutes` null must be rejected; a **draft** with neither must still save.
- Old admin payload (still sends `light`…`pet_safety`) hitting new `save_product` between deploys must not error (jsonb extra keys ignored).
- `fetchArticles` / `fetchAllProductSlugs` when PostgREST returns fewer rows than `count` → throw, never a silently short list.
- A product page and card render identically with the four fields gone (nothing else read them).

---

### Task 1: Lock-order verification (B-011b), read-only
**Files:** read `supabase/migrations/0010*`, `0031*`, `0033*`, `0032*`; Modify later: `platform-docs/backlog/B-011-…md`.
- [ ] **Step 1:** List every function/trigger that locks `topics`, `articles`, `article_topics`, `products`, `product_categories`, `shop_categories` and write down the order each takes locks (`for update`, `for key share`, FK checks, `delete`).
- [ ] **Step 2:** Decide. Cycle exists (some path locks topic before article while another locks article before topic) → add the `perform 1 from topics where id = any(…) order by id for key share` first line to the re-created `save_article` in Task 4. No cycle → only the `order by id` fix on `guard_shop_category_delete`. A dynamic two-session test needs a `DO` block (owner confirmation); ask for it **only** if the static result is inconclusive.
- [ ] **Step 3:** Record the finding (one paragraph) for B-011 in Task 6.

### Task 2: Row-limit helper (B-012, site) — red-first (pure logic)
**Files:** Create `lib/row-limit.ts`, `lib/row-limit.test.ts`. Modify `lib/sitemap.ts:15-23,40-46`, `lib/shop.ts:104-115` (facets) and `:88-93`, `lib/articles.ts:28-37`; their tests (`lib/articles.test.ts`, `lib/shop.test.ts` if present, `lib/sitemap*.test.ts`).
**Interfaces — Produces:** `assertComplete(what: string, rows: readonly unknown[], count: number | null): void` — throws `Error(\`${what} are truncated or uncounted (${rows.length} of ${count ?? 'unknown'} rows)\`)` when `count == null || count !== rows.length`.
- [ ] **Step 1:** Test: equal count passes; `count` null throws; fewer rows than count throws and message contains `what` and both numbers.
- [ ] **Step 2:** Run `npx vitest run lib/row-limit.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `assertComplete` in `lib/row-limit.ts`.
- [ ] **Step 4:** Replace the inline checks in `lib/sitemap.ts` (both entries) and `lib/shop.ts` facets with `assertComplete` (keep each message's subject: "Sitemap articles", "Category … facets"). Existing tests must stay green.
- [ ] **Step 5:** `fetchArticles` and `fetchAllProductSlugs`: add `{ count: 'exact' }` to the select, call `assertComplete('articles' / 'product slugs', rows, count)`. Add a test per loader: mock returns `count` larger than rows → rejects. `fetchTopics`/`fetchLevels`/`fetchShopCategories` stay out (tiny tables, optional in spec).
- [ ] **Step 6:** `npm test` green. Commit `fix(db): row-limit guard for article and product-slug loaders (B-012)`.

### Task 3: Remove product spec fields from the site (B-013)
**Files:** Delete `components/shop/SpecList.tsx`, `SpecList.module.css`, `SpecList.test.tsx`. Modify `lib/shop.mappers.ts` (PRODUCT_SELECT :10, ProductRow :46-49, `toPetSafety`/`PET_VALUES` :61-67, mapper :121-124), `lib/shop.types.ts` (`PetSafety` :4, :36-39), `lib/shop-utils.ts` (`PET_LABELS`, `petLabel`, import), `components/shop/ProductDetail.tsx:12` comment, `lib/shop.fixtures.ts` (fields :82-85, per-product values, mapping :230-233), tests `lib/shop.mappers.test.ts` (drop :37-40 fields and :89-94 pet tests), `lib/shop-utils.test.ts` (:54-57, `petLabel` block :161-166), `lib/shop.fixtures.test.ts:43` (rewrite the pet-safe assertion to use category "Pet-friendly" membership or delete if redundant with :36), `components/shop/ProductDetail.test.tsx:79-83` (delete), `e2e/shop.spec.ts:155,163-165` (reword comment/assertion; do not run e2e without request).
- [ ] **Step 1:** Make the edits above; `rg -n "pet_safety|petSafety|PetSafety|petLabel|SpecList|\\.light\\b|\\.water\\b|\\.size\\b" app components lib e2e` returns nothing about products.
- [ ] **Step 2:** `npx tsc --noEmit -p tsconfig.vitest.json` and `npm test` green.
- [ ] **Step 3:** Commit `refactor(shop): drop hidden product spec fields (B-013)`.

### Task 4: Migration `supabase/migrations/0037_db_cleanup.sql` (write only, do not apply)
**Files:** Create the file. Read first: `0029_analytics_settings.sql` (save_site_settings :25, :106-107, grants :131), `0033_save_rpc_publish_at.sql:153+` (save_product; insert :184, values :197-200, update :220-223), `0010*` (`guard_shop_category_delete`), `0007:102` (`products_pet_safety_check`), `0036` (confirm no RPC redefinition).
Order inside, each step per spec section "Migration":
- [ ] **Step 1 (B-014):** drop the two `site_settings_*_not_blank` constraints (if exists) and both columns; re-create `save_site_settings` from 0029 without the two keys (whitelist and update), then revoke/grant.
- [ ] **Step 2 (B-011a):** `articles_published_needs_cover_and_read` and `articles_title_not_blank` exactly as in spec (drop-if-exists, `not valid`, then `validate constraint`).
- [ ] **Step 3 (B-011b):** `order by id` in `guard_shop_category_delete`'s product lock query (re-create function, keep its trigger/grants); plus the topic-first lock line in `save_article` **only if** Task 1 found a cycle.
- [ ] **Step 4 (B-013):** drop the four product columns (the `pet_safety` CHECK goes with it); re-create `save_product` from 0033 without the four fields; revoke/grant.
- [ ] **Step 5:** Header comment: deploy order (code first), irreversible data loss, post-apply SQL checks list from the spec.
- [ ] **Step 6:** Review gate on this file only: `database-reviewer` + `security-auditor`; fix Critical/High. Commit `feat(db): 0037 cleanup of spec/affiliate columns, article publish checks`.

### Task 5: Docs inside the repo
**Files:** `AGENTS.md:48` (remove `SpecList` mention), schema list if the repo keeps one.
- [ ] Edit, `npm run build` + `npm run lint` + `npm test` green (qa-runner), commit `docs(agents): drop SpecList`.

### Task 6: After owner approval (not part of autonomous execution)
- [ ] Owner commands push of `urban.gardener` (deploys production) → then owner confirms `apply_migration 0037` → run the SQL checks from the spec (constraints validated, `has_function_privilege`, columns gone, anon product read works, `save_product` smoke under admin) → B-011 note from Task 1, B-012/B-013/B-014 statuses via `docs-writer`.
