# Phase M — recipe in multiple categories (agent spec)

Source: backlog B-023 + B-024. Plan for owner: [plans/2026-11-19-phase-m-recipe-categories.md](../plans/2026-11-19-phase-m-recipe-categories.md).
Level 3 (migration, two repos). Impl-plans required: one per repo (avocado.kiss, web.admin) via `writing-plans`, written at "Начинаем фазу M". Branch `feat/recipe-categories` in avocado.kiss, web.admin, platform-docs.

## Owner decisions
- Primary category = first selected, order set in admin; recipe appears in lists/filters of all its categories; breadcrumbs, hero eyebrow, card label use primary.
- Search finds recipes by any of their categories.
- B-024: create author "Mark P." in `authors`, link 5 recipes (`author_name='Mark P.' and author_id is null`); "Test" (1 recipe) is dropped; then drop `recipes.author_name`.

## Live state (base-one, checked 2026-11-19, read-only SQL)
82 recipes, 8 with null/blank `category`, 0 orphan texts (all match `categories.name`), 8 categories. `recipes.author_name` only: 5×"Mark P.", 1×"Test".

## Data model
Migration `0030_recipe_categories.sql` (expand; next free number after 0029):
- `avocado_kiss.recipe_categories(recipe_id uuid not null references recipes on delete cascade, category_id uuid not null references categories on delete cascade, position int not null, primary key (recipe_id, category_id))`, index on `category_id`; `unique (recipe_id, position)` deferrable or none (decide in impl-plan; replace-all sync writes position = array index).
- Backfill: `insert … select r.id, c.id, 0 from recipes r join categories c on c.name = r.category on conflict do nothing`. Idempotent; re-run right before the deploy switch.
- RLS on; policies: anon/authenticated select only for rows whose recipe is visible (`exists (select 1 from avocado_kiss.recipes r where r.id = recipe_id)` — recipes RLS applies, hides drafts/scheduled); admin write via `public.is_admin()`.
- Grants: `select` to anon; `all` to authenticated, service_role, then `revoke truncate, references, trigger` from anon, authenticated (B-004 hygiene for the new table). Never `grant … on all tables` (undoes 0026 column grants).
- `recipes.category` and its index stay until 0031 (live site reads it until deploy).

Migration `0031_drop_recipe_legacy_columns.sql` (contract; after deploy of site+admin and owner check; owner confirmation for apply_migration):
- precondition checks (SELECT): every recipe with non-blank `category` has a `recipe_categories` row; no recipe with `author_name` set and `author_id` null except "Test".
- data step before it (content INSERT/UPDATE … WHERE, via execute_sql): `insert into authors` "Mark P." (check `authors` columns/slug rules first; admin has authors dictionary `lib/ugAuthors.ts`/avocado equivalent), `update recipes set author_id=… where author_name='Mark P.' and author_id is null`.
- `alter table recipes drop column category, drop column author_name` (+ `recipes_category_idx`); anon column grants go with the columns. Update `lib/columns.ts` map before applying.

## avocado.kiss changes (file map from Explore, 2026-11-19)
- `lib/types.ts`: `Recipe.category` stays as computed primary name; add `categories: {name, slug}[]` (ordered). Update the `Category` comment.
- `lib/columns.ts`: `category` moves into the `Omit` (like `author_name`) in step 1; removed from DB column list in 0031 step.
- `lib/content.ts`: new `attachRecipeCategories` (model: `lib/shop.ts attachCategoryNames`, or embed `recipe_categories(position, categories(name,slug))`); apply in `fetchRecipeBySlug`, `fetchRecipeForPreview`, `:91` home_slots embed. `fetchRecipesByCategory(client, categoryId)` via membership ids (`lib/shop.ts:160-196` pattern), order stays `published_at desc, id desc`. `fetchRecipeRelated`: pass all category names as `categoryKeys`. `fetchCategoryByName` no longer needed by recipe pages.
- `lib/search.ts:43-65`: recipes by any category — two-step lookup (matching category ids → recipe ids → `.in('id', …)` merged with the title/excerpt `or`); update exact-`or`-string assertions in `lib/search.test.ts:46-53`.
- `lib/relations.ts:59-63,181,253-262`: embed memberships; eyebrow = primary, `categoryKeys` = all. Update `lib/relations.test.ts` fixtures.
- `app/recipes/[slug]/page.tsx:65-74`, `app/preview/recipes/[slug]/page.tsx:38-47`: use primary `{name, slug}` directly (no name→slug lookup). `components/RecipeArticle.tsx:42-43,76,97`: crumb, JSON-LD `recipeCategory` = list of all names, eyebrow = primary. `RecipeCard`/`MosaicCard`/`MosaicBanner` keep working on computed primary.
- `app/category/[slug]/page.tsx:38,71`: pass `category.id`; check `page.metadata.test.ts` mocks. Tests/fixtures: `components/*.test.tsx`, `lib/preview.test.ts:146`.
- `AGENTS.md:39-46` loader list.

## web.admin changes
- `lib/recipes.ts`: drop `category` from `RECIPE_COLUMNS`/types/`RecipeInput`; add `categoryIds` handled like `tagIds` (`syncCategories`: replace-all, position = index; rollback on create failure). `listRecipes` embeds memberships ordered by position; keeps primary name for display. Decision for atomicity: same non-atomic pattern as `syncTags` unless impl-plan prefers an RPC (Urban uses `save_product` RPC).
- `features/recipes/recipeForm.ts`: remove `category` from zod/defaults; hold `categoryIds` outside RHF with a dirty flag (pattern `features/products/ProductEditPage.tsx:213-287`).
- `features/recipes/RecipeEditPage.tsx:265-278`: replace `TaxonomyCombobox` with ordered chips (copy `features/ug-products/UgCategoriesField.tsx`, ←/→ reorder, first = primary) wired to `listRecipeCategories`. a11y: buttons labelled, focus kept after reorder, 390 px.
- `features/recipes/RecipesPage.tsx`: filter = membership in any category; row shows primary (or chips).
- `features/taxonomy/TaxonomyManager.tsx:62-70,115-119` + `config.ts:160-177`: usage count by membership (`config.usage` path exists); `lib/recipeCategories.ts:81-131`: delete the name-cascades in rename/update/delete (FK cascade covers delete); `RecipeCategoryEditDialog.tsx` copy ("link by name") updated.
- Tests: `RecipeEditPage.test.tsx`, `recipeForm.test.ts`, taxonomy tests.

## platform-docs (docs-writer, facts from diff)
`database/schema.md` (428, 430, ~495, 767, migration index, new table), `sites/avocado-kiss.md` (361, 496-497, 677, 1003), `admin-panel/recipes-avocado-kiss.md` (28, 46-60, 86), backlog B-023/B-024 + README, `avocado.kiss/AGENTS.md`, `phase-x-checklist` if one exists for Avocado.

## Execution order
1. Branches. 2. Migration 0030 (owner confirmation for apply) + SQL checks (counts match: rows with non-blank category = rows backfilled). 3. avocado.kiss changes + tests. 4. web.admin changes + tests. 5. Review gate (one per layer): `database-reviewer` + `security-auditor` (0030 RLS/grants), `react-reviewer` per repo, `a11y-architect` (chips), `silent-failure-hunter` (loaders). 6. `qa-runner`: build+lint+test in both repos; 390 px check of the chips field and a recipe/category page. 7. Re-run backfill; report; **push order on owner command, one repo per command: avocado.kiss and web.admin together deploy → owner checks → 0031 data step + migration (owner confirmation) → second deploy not needed if code already ignores the columns.**

## Risks
- Window between 0030 and deploy: old admin writes only `recipes.category` → re-run backfill right before the switch; owner told not to edit categories meanwhile.
- 0031 must not run before both apps are live (live site selects `category` until then).
- RLS subquery on `recipes` for anon must not leak drafts — verify under anon role with a draft/scheduled recipe fixture.
- `PUBLIC_RECIPE_COLUMN_MAP` is typed: type/map mismatch fails compile (useful guard).
