# Phase N — web.admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development (recommended) or executing-plans. Steps use `- [ ]`.

**Goal:** Remove "Plant details" (spec fields) from the Urban product form and add row-limit guards to the admin list loaders.
**Architecture:** Admin stops sending/selecting `light/water/size/pet_safety`; lists call the existing `assertNotTruncated`. Companion: [urban.gardener plan](2026-11-19-phase-n-db-cleanup-impl-plan-urban.md) (migration 0037 lives there).
**Tech Stack:** Vite + React SPA, react-hook-form + Zod, Vitest + RTL.
**Spec:** [2026-11-19-phase-n-db-cleanup-spec.md](2026-11-19-phase-n-db-cleanup-spec.md). Branch `feat/db-cleanup` (created from `main`; Phase M is merged).

## Global Constraints
- Do not change `reorderRows` (`src/lib/ugDb.ts:32-45`, shared with avocado `lib/tags.ts`) and do not touch `src/features/taxonomy/*` beyond guard additions. B-012 stays open for atomic reorder.
- `listUgAuthors` is multi-site (also avocado): the guard must not break avocado screens.
- `assertNotTruncated(rows)` (`src/lib/ugDb.ts:19`) throws at ≥1000 rows; reuse it, do not duplicate.
- Admin code ships **before** migration 0037. Until then the old `save_product` receives payloads without the four keys: it must keep working (verify by reading the function; keys read via `->>` give null).
- Never push, merge or deploy without the owner's command.

## Review Focus
- Saving a product with the four fields absent from the payload succeeds against the old RPC.
- A product whose DB row still has `pet_safety` (before migration) opens in the form without error (extra column ignored by `PRODUCT_COLUMNS` no longer selecting it).
- The pet-friendly category hint disappears entirely (it depended on `pet_safety`); no dangling `petHint` markup.
- A list with exactly 1000 rows shows the existing "too many rows" error state instead of a silently short list; with 999 it renders.
- Avocado authors list still loads (`listUgAuthors` for a non-Urban site).

---

### Task 1: Remove spec fields from product form and data layer (B-013)
**Files:** Modify `src/features/ug-products/UgProductEditPage.tsx` (`petSafety` watch :98, `petHint` :109 and :327 block, "Plant details" block ~:385-410, unused imports), `ugProductForm.ts` (zod :50-53, `toInput` :117-120, `toFormValues` :140-143, delete `needsPetFriendlyHint` :172-174), `src/lib/ugShop.ts` (`UgPetSafety` :11, `UgProduct` :32-35, `PRODUCT_COLUMNS` :75). Tests: `UgProductEditPage.test.tsx` (:40 fixture, :190-196 pet-hint tests deleted), `ugProductForm.test.ts` (:17, :147-162, :190, `needsPetFriendlyHint` block :249-254), `src/lib/ugShop.test.ts:47`.
- [ ] **Step 1:** Edit as listed; `FormValues`/`UgProductInput` no longer contain `light|water|size|pet_safety`. Check `rg -n "light|water|\bsize\b|pet_safety|UgPetSafety|petHint|needsPetFriendlyHint" src/features/ug-products src/lib/ugShop*` shows no product-spec leftovers.
- [ ] **Step 2:** Add one test in `ugProductForm.test.ts`: `toInput(validValues)` has none of the four keys (`expect(Object.keys(input)).not.toContain('pet_safety')` etc.).
- [ ] **Step 3:** `npx tsc --noEmit` + `npm test -- ug-products ugShop` green. Commit `refactor(ug-products): remove Plant details fields (B-013)`.

### Task 2: Row-limit guards on admin list loaders (B-012)
**Files:** Modify `src/lib/ugAuthors.ts:52-56` (`listUgAuthors`), `src/lib/ugShop.ts:173-181` (`listUgShopCategories`) and `:314-322` (`listUgBrands`), `src/lib/ugTaxonomy.ts:31-39` (`listUgTopics`) and `:150-158` (`listUgLevels`), plus their test files.
**Interfaces — Consumes:** `assertNotTruncated(rows: unknown[] | null): void` from `@/lib/ugDb` (import already present in `ugShop.ts`, `ugTaxonomy.ts`; add to `ugAuthors.ts`).
- [ ] **Step 1:** In each of the five functions call `assertNotTruncated(data)` right after the `if (error) throw error` line, with the same one-line comment style as `ugArticles.ts:78`.
- [ ] **Step 2:** One test per function (mock `getDb` returning 1000 rows → rejects with `Too many rows to count reliably`; 999 rows → resolves). Reuse the mock helper in the existing sibling test file.
- [ ] **Step 3:** `ugArticles.parseItems` (:98-109) and `rowToBlock` unknown-type branch (:113-134): when an entry/type is dropped, `console.warn` with the article block id (as `ugStatic.ts` does for repairs) — no UI flag. Test: `parseItems([{text: 1}])` returns `[]` and warns once.
- [ ] **Step 4:** `npm test`, `npm run build`, `npm run lint` green (qa-runner). Commit `fix(ug): row-limit guards and repair warnings for admin loaders (B-012)`.

### Task 3: Visual check
- [ ] Product edit form at 390 px and desktop in the browser (`run` skill / Playwright): no "Plant details", save works for an existing product on the live dev connection **only if** the owner's DB is the dev one; otherwise state "not verified against live data". Commit nothing.
