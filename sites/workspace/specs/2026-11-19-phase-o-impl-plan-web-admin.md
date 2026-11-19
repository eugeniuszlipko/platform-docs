# Phase O — web.admin (O2 client, O4, O5, O6, O7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atomic reorder through the new RPC, a "dropped data" banner on the Urban article editor, load-error + Retry on every picker, an exact-count truncation guard, and desktop a11y fixes (focus-ring contrast, tab titles, focus on route change).

**Architecture:** Mostly `src/lib/*` loader changes with their tests; a small shared `PickerLoadError` component; two route-level hooks (`useRouteTitle`, `useRouteFocus`) wired in `AppShell`/`LoginPage` with `handle: { title }` on every route in `App.tsx`. UI layout unchanged.

**Tech Stack:** Vite + React 19 + TypeScript, TanStack Query 5, react-router-dom 7 (data router), supabase-js 2 (`rpc`, `select(cols, { count: 'exact' })`), Vitest + RTL, oxlint, Tailwind v4 / shadcn.

**Spec:** `platform-docs/sites/workspace/specs/2026-11-19-phase-o-backlog-leftovers-spec.md` (O2 client, O4–O7). Repo `web.admin`, branch `feat/backlog-leftovers` (verified). Read first: `web.admin/AGENTS.md`, `platform-docs/methodology/testing.md`, skill `testing`.

## Global Constraints

- UI text in English; code comments may be Russian (AGENTS.md). Empty optional fields stay `null`; no service-role key.
- RPC contract (DB plans): `db.rpc('reorder_positions', { p_table, p_ids })`, schema comes from `getDb(site)`; raises `22023` / `P0002` (supabase-js returns it as `error`).
- Banner copy, exact: "Some blocks or list items could not be read and will be removed when you save. Check the article before saving." (`role="status"`, same amber classes as `UgSiteSettingsPage.tsx:140-153`).
- Picker error copy: "Couldn't load <thing>." + button "Retry" (`refetch`). Never clear the existing selected value on error.
- Truncation guard: loaders request `{ count: 'exact' }`; `assertNotTruncated(rows, count, what)` throws when `count == null` or `rows.length < count`.
- Ring: `--ring` contrast ≥ 3:1 on white and on `--background` in light mode (spec example `oklch(0.55 0 0)` ≈ 4.9:1; current `oklch(0.708 0 0)` ≈ 2.6:1); remove `/50` from `ring-ring/50`.
- Tab title: `<Page> · <Site name> · Admin`; login/dashboard `<Page> · Admin`; set on every route; on route change (not first load) focus moves to the page `h1` (`tabIndex={-1}`). No layout changes.
- No mobile (320/390 px) checks (owner decision). Checks: `npm --prefix web.admin test`, `npm --prefix web.admin run build`, `npm --prefix web.admin run lint` (2 known shadcn warnings are OK). No e2e.
- Test style: implement first, then tests by spec (`testing` skill); red-first only for pure logic (`assertNotTruncated`, `parseItems`, `formatTitle`).

## Spec deviations and findings (flag for the orchestrator)

1. Spec says `ring-ring/50` is in "9 shadcn `ui/` components + `RichTextEditor`"; the grep shows **8** `ui/` files (`switch, button, textarea, input-group, badge, select, checkbox, input`) + `RichTextEditor.tsx:125` = 9 files in total. Plan edits those 9.
2. `web.admin/AGENTS.md` says `components/ui` is "added via CLI, never edited by hand"; O7 requires editing 8 of them. Task 7 adds a one-line note to AGENTS.md ("patched by hand in Phase O; re-apply after `shadcn add --overwrite`").
3. Extra low-contrast focus style not named in the spec: `src/index.css:144` `@apply … outline-ring/50`. Task 7 changes it to `outline-ring` (colour only).
4. Pages without an `<h1>` (all `*EditPage`/edit routes, `DashboardPage`; `MediaPage`, list pages and ~20 others have one): `useRouteFocus` falls back to `<main tabIndex={-1}>`. Adding h1s is outside the spec.
5. Out of spec, same class as O5: `features/products/CategoryChipsField.tsx:30` (Cozy/Avocado product categories) has no `isError`. Not planned; one-line follow-up if the owner wants it.
6. DB dependency: deploy web.admin to production only after migrations `0034` (avocado), `0038` (cozycorner), `0039` (urban) are applied; before that every reorder would fail (RPC missing). Local tests do not depend on it.
7. `rowToBlock` currently returns `UgBlock | null`; O4 changes its return shape (Task 3 lists the test lines to update).
8. 21 `assertNotTruncated` call sites in 8 files (spec says ~20); all listed in Task 2.

## Review Focus

- Reorder with a stale list (row deleted in another tab) → RPC `P0002` surfaces as the toast "Failed to reorder …" and the optimistic order is rolled back by the existing `onError` (Task 1 test: error propagates unchanged).
- Exact-count query where PostgREST returns `count: null` (e.g. count not honoured) → loader must throw, not show a possibly partial list (Task 2 helper tests).
- A list loader that forgets `EXACT` must fail an existing test (Task 2 mock returns `count` only when `{ count: 'exact' }` was requested).
- Picker error on an existing article/product: the form value (author, level, topics, categories, brand) is untouched and Save still sends it (Tasks 4–5 tests assert `onChange` is never called by the error path).
- Route change onto a lazy page whose `h1` renders after the Suspense fallback: focus must still land on the `h1`, and must not move on the first load or on a same-path update (Task 8 tests).

---

### Task 1: Atomic reorder through RPC (O2 client)

**Files:**
- Modify: `src/lib/ugDb.ts` (`reorderRows`), `src/lib/brands.ts` (`reorderBrands`, :57-64), `src/lib/categories.ts` (`reorderCategories`, :154-162), `src/lib/recipeCategories.ts` (`reorderRecipeCategories`, :113-123)
- Modify test: `src/lib/ugDb.test.ts`, `src/lib/ugTaxonomy.test.ts` (:123-127)
- Create test: `src/lib/reorder.test.ts`

**Interfaces:**
- Produces: `reorderRows(site: SiteConfig, table: string, orderedIds: string[]): Promise<void>` — one `getDb(site).rpc('reorder_positions', { p_table: table, p_ids: orderedIds })`; `if (error) throw error`. No `mustAffect` (the RPC raises on mismatch). `mustAffect` stays exported (other callers).
- `reorderBrands(site, ids)` = `reorderRows(site, 'brands', ids)`; `reorderCategories(site, ids)` = `reorderRows(site, model(site).table, ids)` (`categories` for Cozy, `shop_categories` for Avocado); `reorderRecipeCategories(site, ids)` = `reorderRows(site, 'categories', ids)`. Signatures unchanged; `TaxonomyManager` and `taxonomy/config.ts` are not touched.

- [ ] **Step 1: Implement** the four functions as above; delete the `Promise.all` loops and imports that become unused (oxlint).
- [ ] **Step 2: Update `ugTaxonomy.test.ts` `'rename and reorder'`:** delete the `reorderUgTopics` assertion line (the reorder no longer goes through `topics.update`); keep the `renameUgTopic` assertion.
- [ ] **Step 3: Extend `ugDb.test.ts`.** Add `const rpc = vi.hoisted(() => vi.fn())` and `vi.mock('@/lib/supabase', () => ({ getDb: () => ({ rpc }) }))`. Tests in `describe('reorderRows')`: (a) `rpc.mockResolvedValue({ error: null })`; after `await reorderRows(site, 'topics', ['b','a','c'])` expect `rpc` called once with `('reorder_positions', { p_table: 'topics', p_ids: ['b','a','c'] })`; (b) `rpc.mockResolvedValue({ error: new Error('Reorder failed: 1 of 2 rows were found and allowed') })` → `rejects.toThrow(/Reorder failed/)`.
- [ ] **Step 4: Create `reorder.test.ts`** (same `getDb → { rpc }` mock, `site = { slug, schema } as SiteConfig`). `it.each` over `[fn, site, expectedTable]`: `reorderBrands` cozycorner → `'brands'`; `reorderBrands` avocado_kiss → `'brands'`; `reorderCategories` cozycorner → `'categories'`; `reorderCategories` avocado_kiss → `'shop_categories'`; `reorderRecipeCategories` avocado_kiss → `'categories'`; `reorderTags` → `'tags'`; `reorderUgTopics` → `'topics'`; `reorderUgLevels` → `'levels'`; `reorderUgShopCategories` → `'shop_categories'`; `reorderUgBrands` → `'brands'`. Each asserts `rpc` toHaveBeenCalledWith `('reorder_positions', { p_table: expectedTable, p_ids: ['x','y'] })`.
- [ ] **Step 5: Run** `npm --prefix web.admin test -- src/lib/ugDb.test.ts src/lib/reorder.test.ts src/lib/ugTaxonomy.test.ts` → all pass.
- [ ] **Step 6: Commit** `feat(admin): reorder through the atomic reorder_positions RPC (O2, B-012)`.

### Task 2: Exact-count truncation guard (O6)  (after Task 1: both edit `ugDb.ts` / `ugTaxonomy.test.ts`)

The signature change is atomic (every call site breaks at once), so this is one task with ordered slices and one final green run.

**Files:**
- Modify: `src/lib/ugDb.ts`, `src/lib/ugTaxonomy.ts`, `src/lib/ugShop.ts`, `src/lib/ugAuthors.ts`, `src/lib/ugArticles.ts`, `src/lib/ugHome.ts`, `src/lib/tags.ts`, `src/lib/subscribers.ts`, `src/lib/messages.ts`
- Modify tests: `src/lib/ugDb.test.ts`, `ugTaxonomy.test.ts`, `ugShop.test.ts`, `ugHome.test.ts`, `tags.test.ts`
- Create test: `src/lib/countGuard.test.ts`
- Tests that stay as they are: `ugStatic.test.ts`, `about.test.ts`, `recipes.test.ts`, `siteCache.test.ts`, `subscribers.test.ts`/`messages.test.ts`/`ugArticles.test.ts` (their existing tests only cover delete/save/pure functions), component tests that `vi.mock` the loaders.

**Interfaces:**
- Produces in `ugDb.ts`: `export const EXACT = { count: "exact" } as const;` and `export function assertNotTruncated(rows: unknown[] | null, count: number | null, what: string): void`. Remove `MAX_ROWS`. Throws `Error("Could not verify that all ${what} were loaded (row count missing)")` when `count == null`; `Error("Too many rows to count reliably: loaded ${n} of ${count} ${what}")` when `(rows?.length ?? 0) < count` (keep the prefix "Too many rows" — existing tests match it).
- Loader pattern: `.select(COLUMNS, EXACT)`, destructure `{ data, count, error }`, `assertNotTruncated(data, count, "<what>")` right after the `error` check.

- [ ] **Step 1 (red-first, pure logic): helper tests** in `ugDb.test.ts`, `describe('assertNotTruncated')`: passes for `([{id:1},{id:2}], 2, 'x')`; passes for `([], 0, 'x')`; passes for `(null, 0, 'x')`; throws `/row count missing/` for `([{id:1}], null, 'topics')`; throws `/Too many rows.*loaded 2 of 3 topics/` for `([{id:1},{id:2}], 3, 'topics')`; throws for `(null, 5, 'x')`. Run → fail. Then implement the helper → pass.
- [ ] **Step 2: Update every test mock so the guard is really exercised.** In each of the four mocks (`ugTaxonomy`, `ugShop`, `ugHome`, `tags` tests) make the chain's `select` remember its 2nd argument and make `then` resolve `count` **only if `{ count: 'exact' }` was requested**: `count: exact ? (reply.count ?? (Array.isArray(reply.data) ? reply.data.length : null)) : null`. Add `count?: number | null` to `Reply` where missing (`ugShop`, `ugHome`, `tags`). Effect: a loader that forgets `EXACT` fails an existing test with "row count missing".
- [ ] **Step 3: Rewrite the truncation tests** (they used exactly 1000 rows to trip the old heuristic, which now means "complete"): give the reply `count: 1001` with 1000 rows and keep `/Too many rows/`; the "999 rows" success cases stay valid. Locations: `ugTaxonomy.test.ts` :135-170 (usage counters, reference lists, `publishedArticlesOnlyInTopic`), `ugShop.test.ts` :138-141, :159-163, :185-188, :211-223, `tags.test.ts` :50-54. In `ugShop.test.ts` replies are queued (`ok(rows)`); use `{ ...ok(rows), count: 1001 }`.
- [ ] **Step 4: Migrate the call sites** (add `EXACT`, `count`, `what`):
  - `ugTaxonomy.ts`: :38 `listUgTopics` "topics"; :103 links in `publishedArticlesOnlyInTopic` "topic links"; :113 `all` (inside `Promise.all`) "article topics"; :147 `topicUsage` "topic links"; :160 `listUgLevels` "levels"; :203 `levelUsage` "articles".
  - `ugShop.ts`: :108 `listUgProducts` "products"; :175 `listUgShopCategories` "shop categories"; :259 links "category links"; :269 `all` "product categories"; :304 `shopCategoryUsage` "category links"; :317 `listUgBrands` "brands"; :360 `brandUsage` "products".
  - `ugAuthors.ts:55` "authors"; `ugArticles.ts:78` (`listUgArticles`) "articles"; `messages.ts:27` "messages"; `subscribers.ts:21` "subscribers".
  - `ugHome.ts`: :97 (`slotsRes` — add `EXACT` to its `.select`, use `slotsRes.count`) "home slots"; :176 `listUgHomeUsage` "home slots".
  - `tags.ts`: :69 `posts` "post tags", :70 `recipes` "recipe tags" (both queries get `EXACT`).
  Keep the existing explanatory comments where still true.
- [ ] **Step 5: Create `countGuard.test.ts`** for loaders that had no list test: `listSubscribers`, `listMessages`, `listUgArticles`, `listUgAuthors`, `listUgHomeUsage`. One shared `getDb` chain mock (`from().select(cols, opts).order()` thenable returning `{ data, count, error }`, recording the `select` options). Per loader: (a) resolves with the rows when `count` equals the row count and `select` received `{ count: 'exact' }`; (b) rejects `/Too many rows/` for 2 rows with `count: 3`; (c) rejects `/row count missing/` for `count: null`.
- [ ] **Step 6: Verify.** `grep -rn "MAX_ROWS\|assertNotTruncated(" web.admin/src` → no `MAX_ROWS`; every call has three arguments. Run `npm --prefix web.admin test` → all pass; `npm --prefix web.admin run lint` → ok.
- [ ] **Step 7: Commit** `feat(admin): exact-count truncation guard for list loaders (O6, B-012)`.

### Task 3: Dropped-data banner on the article editor (O4)  (after Task 2: both edit `ugArticles.ts`)

**Files:**
- Modify: `src/lib/ugArticles.ts` (`parseItems` :98-120, `rowToBlock` :125-142, `getUgArticle` :178-205, type `UgArticleWithRelations`), `src/features/ug-articles/UgArticleEditPage.tsx` (banner at the top of `UgArticleForm`'s form)
- Create: `src/features/shared/DataRepairedBanner.tsx`
- Modify tests: `src/lib/ugArticles.test.ts` (:47-88), the four `UgArticleEditPage.*.test.tsx` files that mock `getUgArticle` (add `repaired: false` to each `mockResolvedValue({ article, blocks: [], topicIds: [] })`: `refetch` :64, `delete` :69, `preview` :61/72/82/96)
- Create test: `src/features/ug-articles/UgArticleEditPage.repaired.test.tsx`

**Interfaces:**
- `parseItems(raw: unknown): { items: UgListItem[]; dropped: number }` — `dropped` counts discarded entries; a non-array, non-null `raw` counts as 1; `null`/`undefined` → 0. `console.warn` messages stay.
- `rowToBlock(r: BlockRow): { block: UgBlock | null; dropped: number }` — unknown type → `{ block: null, dropped: 1 }`; list block → `dropped` from `parseItems`; every other type `dropped: 0`.
- `UgArticleWithRelations` gains `repaired: boolean`; `getUgArticle` sets it to `true` iff any block or list item was dropped.
- `DataRepairedBanner({ children }: { children: ReactNode })` — `<p role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/50 p-3 text-sm">` + `TriangleAlert className="mt-0.5 size-4 shrink-0"` + children (same markup as `UgSiteSettingsPage`, which is left untouched).

- [ ] **Step 1 (red-first, pure logic): update `ugArticles.test.ts`:** existing `rowToBlock(...)` assertions become `.block` (`toEqual`/`toMatchObject`/`toBeNull`); `parseItems(...)` assertions become `.items`. New: `parseItems([{ text: 'a' }]).dropped === 0`; `parseItems([null, 3, { text: 5 }, { text: 'ok' }])` → `items` length 1, `dropped === 3`; `parseItems('nope')` → `{ items: [], dropped: 1 }`; `parseItems(null).dropped === 0`; `rowToBlock(row({ type: 'video' }))` → `{ block: null, dropped: 1 }`; `rowToBlock(row({ type: 'list', items: [{ text: 1 }, { text: 'a' }] })).dropped === 1`. Run → fail; implement → pass.
- [ ] **Step 2: Test `getUgArticle`'s `repaired`** (same file; reuse a `from()` chain mock with replies per table, like `ugShop.test.ts`): clean rows → `repaired === false`; an `article_blocks` row of type `video` → `repaired === true` and the other blocks still returned; a list block with a malformed item → `true`.
- [ ] **Step 3: Implement** `getUgArticle` aggregation (sum `dropped` from `rowToBlock`, keep `flatMap` for non-null blocks) and the banner component.
- [ ] **Step 4: Render the banner** in `UgArticleForm` as the first child of the `<form>` content: `{data?.repaired && <DataRepairedBanner>Some blocks or list items could not be read and will be removed when you save. Check the article before saving.</DataRepairedBanner>}`.
- [ ] **Step 5: Component test** `UgArticleEditPage.repaired.test.tsx` (copy the harness of `UgArticleEditPage.preview.test.tsx`): with `getUgArticle` → `{ article, blocks: [], topicIds: [], repaired: true }` expect `screen.getByRole('status')` toHaveTextContent the exact sentence; with `repaired: false` expect `queryByText(/could not be read/)` absent; new article route (`/articles/new`) → absent.
- [ ] **Step 6: Run** `npm --prefix web.admin test -- src/lib/ugArticles.test.ts src/features/ug-articles` → pass.
- [ ] **Step 7: Commit** `feat(admin): warn when an article has unreadable blocks or list items (O4, B-012)`.

### Task 4: Shared load-error piece + Topics and Categories fields (O5)

**Files:**
- Create: `src/features/shared/PickerLoadError.tsx`, `src/features/shared/PickerLoadError.test.tsx`
- Modify: `src/features/ug-articles/UgTopicsField.tsx`, `src/features/ug-products/UgCategoriesField.tsx`
- Modify tests: `src/features/ug-articles/UgTopicsField.test.tsx`, `src/features/ug-products/UgCategoriesField.test.tsx`

**Interfaces:**
- Produces: `PickerLoadError({ what, onRetry }: { what: string; onRetry: () => void })` → `<span role="alert" className="inline-flex items-center gap-2 text-sm text-destructive">Couldn't load {what}. <Button type="button" variant="outline" size="xs" onClick={onRetry}>Retry</Button></span>` (same look as `RecipeCategoriesField.tsx:113-119`, which is left unchanged).
- Behaviour of both fields: `const { data, isError, refetch } = useQuery(...)`. While the list is not loaded: render no chips (stop showing `undefined` names), no "No topics"/"No categories" text, disable the Add button; on `isError && !data` render `<PickerLoadError what="topics" | "categories" onRetry={() => void refetch()} />`. The `value` prop is never changed by the error path (no `onChange` call).

- [ ] **Step 1: Implement** `PickerLoadError` and the two field changes (`selected` for rendering = `data ? value.filter(known) : []`).
- [ ] **Step 2: `PickerLoadError.test.tsx`:** renders "Couldn't load topics." (`getByRole('alert')`); clicking Retry calls `onRetry` once.
- [ ] **Step 3: Field tests** (add to both existing files; the render helper takes `new QueryClient({ defaultOptions: { queries: { retry: false } } })`): with the list mock `mockRejectedValueOnce(new Error('boom'))` then `mockResolvedValue(list)`, initial value `['l','w']`: (a) alert "Couldn't load topics." (categories: "Couldn't load categories.") shown, chips absent, Add button disabled; (b) click Retry → chips "Light" and "Watering" appear, loader called twice; (c) the `onChange` spy was never called.
- [ ] **Step 4: Run** `npm --prefix web.admin test -- src/features/shared src/features/ug-articles/UgTopicsField.test.tsx src/features/ug-products/UgCategoriesField.test.tsx` → pass.
- [ ] **Step 5: Commit** `feat(admin): load error with Retry in Urban topic and category pickers (O5)`.

### Task 5: Author, Level and Brand selects (O5)  (after Tasks 3 and 4: Task 3 also edits `UgArticleEditPage.tsx`)

**Files:**
- Modify: `src/features/ug-articles/UgArticleEditPage.tsx` (queries at :100-101 get `isError`/`refetch`; Author Select :292-304, Level Select :306-320), `src/features/ug-products/UgProductEditPage.tsx` (brands query :101; brand Select :326-337)
- Create test: `src/features/ug-articles/UgArticleEditPage.pickers.test.tsx` (harness copied from `UgArticleEditPage.preview.test.tsx`, retry off)
- Modify test: `src/features/ug-products/UgProductEditPage.test.tsx`

**Interfaces:**
- Consumes: `PickerLoadError` (Task 4). The `Select` stays rendered with its current `field.value`; under it `{isError && !data && <PickerLoadError what="authors" | "levels" | "brands" onRetry={() => void refetch()} />}`.

- [ ] **Step 1: Implement** the three selects.
- [ ] **Step 2: Tests.** Article page: `listUgLevels.mockRejectedValueOnce(new Error('boom'))` then resolved `[{ id: 'l1', name: 'Easy', … }]` → alert "Couldn't load levels."; Retry → `listUgLevels` called twice and the alert disappears; Save is not blocked (the article's `level_id` is unchanged in the `saveUgArticle` payload after typing in the title). The Author error is reachable only as a failed background refetch (the page already blocks on a failed first load) — no test, code only. Product page: `listUgBrands.mockRejectedValueOnce(...)` then `[]` → alert "Couldn't load brands.", Retry → called twice.
- [ ] **Step 3: Run** `npm --prefix web.admin test -- src/features/ug-articles src/features/ug-products` → pass.
- [ ] **Step 4: Commit** `feat(admin): load error with Retry for author, level and brand selects (O5)`.

### Task 6: Taxonomy combobox on Cozy/Avocado product form (O5)  (after Task 4)

**Files:**
- Modify: `src/features/taxonomy/TaxonomyCombobox.tsx` (query at :45), `src/features/taxonomy/TaxonomyCombobox.test.tsx`

**Interfaces:**
- `const { data: items, isError, refetch } = useQuery(...)`. The trigger button keeps showing `value`. Inside the popover, when `isError && !items`: show `<PickerLoadError what={config.plural} onRetry={() => void refetch()} />` instead of the list and hide the `Create "…"` item (creating while the list is unknown could duplicate a name); "Manage …" and "None" stay available. `onChange` is not called by the error path.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Test** (existing file; its client gets `retry: false`; `config.list` becomes a `vi.fn()` rejecting once, then resolving `items`): open the combobox → alert "Couldn't load brands."; no `Create` option after typing a new name; click Retry → `config.list` called twice and `Brand 0` is listed; trigger text equals the `value` prop throughout (`value="Brand 3"`).
- [ ] **Step 3: Run** `npm --prefix web.admin test -- src/features/taxonomy src/features/products` → pass.
- [ ] **Step 3b (orchestrator ruling 2026-11-19): also `src/features/products/CategoryChipsField.tsx`** (query at :30, Cozy/Avocado product categories): on `isError && !data` show `<PickerLoadError what="categories" onRetry={() => void refetch()} />`; selected chips stay; add one test in its test file (create `CategoryChipsField.test.tsx` next to it if none): alert shown, Retry refetches and lists the categories.
- [ ] **Step 4: Commit** `feat(admin): load error with Retry in the taxonomy combobox and category chips (O5)`.

### Task 7: Focus-ring contrast (O7a)  (independent)

> **Orchestrator ruling (2026-11-19):** `src/components/ui/*` is NOT edited (web.admin/AGENTS.md: CLI-only). Contrast is reached through the token alone, so the `ring-ring/50` in `ui/` components must still meet 3:1.

**Files:**
- Modify: `src/index.css` (`--ring` :68, `--sidebar-ring` :82, dark `--ring` :118 / `--sidebar-ring` :131 only if the check fails; :144 `outline-ring/50` → `outline-ring`), `src/components/RichTextEditor.tsx` (:125 `ring-ring/50` → `ring-ring`, it is not a `ui/` file).

- [ ] **Step 1: Pick the light value with a throw-away script in the scratchpad (not in the repo).** Requirement: the ring colour composited at **50 % alpha** (sRGB blend, as browsers do) over white AND over `--background` reaches contrast ≥ 3:1 against that background; also the full-opacity ring ≥ 3:1. Choose the lightest grey `oklch(L 0 0)` that passes (expected around L ≈ 0.28; for an achromatic oklch colour relative luminance Y = L³). Set the same value for `--sidebar-ring`. Do the same check for the dark block against dark `--background` and change dark values only if they fail. Put the computed numbers in the report.
- [ ] **Step 2:** `index.css:144` `outline-ring/50` → `outline-ring`; `RichTextEditor.tsx:125` `ring-ring/50` → `ring-ring`. Do not touch `src/components/ui/`.
- [ ] **Step 3: Run** `npm --prefix web.admin test` and `run build`.
- [ ] **Step 4: Commit** `fix(admin): focus ring reaches 3:1 contrast on light backgrounds (O7, B-006)`.

### Task 8: Tab titles and focus on route change (O7b)  (independent; touches `App.tsx`, `AppShell.tsx`, `LoginPage.tsx`)

**Files:**
- Create: `src/lib/routeTitle.ts`, `src/lib/routeTitle.test.tsx`, `src/lib/useRouteFocus.ts`, `src/lib/useRouteFocus.test.tsx`, `src/App.routes.test.ts`
- Modify: `src/App.tsx` (add `handle={{ title: '…' }}` to every page `<Route>`), `src/components/AppShell.tsx`, `src/features/auth/LoginPage.tsx`, `src/index.css` (one rule: `h1[tabindex="-1"]:focus { outline: none }`)

**Interfaces:**
- `routeTitle.ts`: `export type RouteHandle = { title?: string }`; `export function formatTitle(page: string | undefined, siteLabel?: string): string` → `[page, siteLabel, 'Admin']` joined with `' · '` without empty parts; `undefined` page → `'Site Admin'` (the current `index.html` title); `export function useRouteTitle(siteLabel?: string): void` — reads the last entry of `useMatches()` that has `handle.title` and sets `document.title = formatTitle(...)` in an effect.
- `useRouteFocus.ts`: `export function useRouteFocus(containerRef: RefObject<HTMLElement | null>): void` — on a `location.pathname` change (not on first mount, not on search/hash-only change) wait up to 3 s (MutationObserver on the container) for the first `h1` inside it, set `tabindex="-1"` on it and `focus({ preventScroll: true })`; if none appears, focus the container itself (the container carries `tabIndex={-1}`).
- Route titles (page part): `/login` "Sign in"; `/dashboard` "Dashboard"; per site section: `media` Media; `pages` Pages; `pages/header` Header; `pages/footer` Footer; `pages/site-settings` Site settings; `pages/brand` Brand; `pages/:pageId` Edit page; `recipes` Recipes; `recipes/new` New recipe; `recipes/:recipeId` Edit recipe; `recipe-categories` Recipe categories; `products` Products; `products/new` New product; `products/:productId` Edit product; `categories` Categories; `categories/:categoryId` Category products; `brands` Brands; `blog` Blog; `blog/new` New post; `blog/:postId` Edit post; `tags` Tags; `articles` Articles; `articles/new` New article; `articles/:articleId` Edit article; `topics` Topics; `levels` Levels; `authors` Authors; `seo-posts` SEO posts; `seo-posts/new` New SEO post; `seo-posts/:postId` Edit SEO post; `subscribers` Subscribers; `messages` Messages. Redirect routes (`index` → media, `*`) get no title.

- [ ] **Step 1 (red-first, pure): `formatTitle` tests** in `routeTitle.test.tsx`: `('Topics', 'Urban Gardener')` → `'Topics · Urban Gardener · Admin'`; `('Dashboard')` → `'Dashboard · Admin'`; `(undefined)` → `'Site Admin'`. Run → fail; implement → pass.
- [ ] **Step 2: Hook test** with `createMemoryRouter` + `RouterProvider`: routes with `handle: { title: 'Topics' }` and `{ title: 'Edit topic' }`; a component calling `useRouteTitle('Urban Gardener')`; navigating from one to the other updates `document.title` to `'Edit topic · Urban Gardener · Admin'`.
- [ ] **Step 3: Wire titles.** Add the `handle` props in `App.tsx` per the list; call `useRouteTitle(siteSlug ? site.label : undefined)` in `AppShell`; call `useRouteTitle()` in `LoginPage`. (`AppShell` and `LoginPage` have no existing tests, so the data-router requirement of `useMatches` breaks nothing.)
- [ ] **Step 4: Route coverage test** `App.routes.test.ts`: import `router` from `@/App` (mock `@/lib/supabase` if the import needs env), walk `router.routes` recursively and assert every route that has an `element` and no `index` and `path !== '*'` and no children has `handle.title` as a non-empty string; list offenders in the failure message.
- [ ] **Step 5 (focus): implement `useRouteFocus`, wire it in `AppShell`:** `const mainRef = useRef<HTMLElement>(null)`; `<main ref={mainRef} tabIndex={-1} className="… focus:outline-none">`; call the hook. Add the `h1[tabindex="-1"]:focus { outline: none }` rule to `index.css`.
- [ ] **Step 6: Focus tests** (`useRouteFocus.test.tsx`, memory router with a test component rendering `<main ref tabIndex={-1}>` + `<Outlet/>`, pages `<h1>One</h1>` / a lazy-like page that renders its `h1` after 50 ms / a page without h1): first render → `document.activeElement` is `body` (not moved); navigate to page two → focus is on its `h1` (`toHaveFocus`, `tabindex="-1"`); delayed h1 → focus lands there after it appears (`waitFor`); page without h1 → `main` has focus; navigating to the same path with only `?q=1` changes → focus not moved (spy on `focus`).
- [ ] **Step 7: Run** `npm --prefix web.admin test` and `run build` → pass.
- [ ] **Step 8: Commit** `feat(admin): per-route tab titles and focus on route change (O7, B-006)`.

### Task 9: Final verification  (after Tasks 1–8)

- [ ] **Step 1:** `npm --prefix web.admin test` → all passed (record N passed / 0 failed).
- [ ] **Step 2:** `npm --prefix web.admin run build` → exit 0.
- [ ] **Step 3:** `npm --prefix web.admin run lint` → exit 0 apart from the 2 known shadcn warnings.
- [ ] **Step 4:** `grep -rn "ring-ring/50\|MAX_ROWS" web.admin/src` → no output; `grep -rn "Promise.all" web.admin/src/lib/{brands,categories,recipeCategories}.ts` → no reorder loops.
- [ ] **Step 5:** `git -C web.admin status --short` shows only intended changes committed; branch `feat/backlog-leftovers`. Reviewers per spec (one per layer): `react-reviewer` (`.tsx`), `silent-failure-hunter` (`lib/` loaders); `security-auditor` is not needed here (no auth/RLS change).
