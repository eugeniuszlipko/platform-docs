# Phase O — backlog leftovers (B-004, B-011, B-012, B-006 desktop) — agent spec

Owner plan: [../plans/2026-11-19-phase-o-backlog-leftovers.md](../plans/2026-11-19-phase-o-backlog-leftovers.md)
Level 3 (migrations in 3 schemas + web.admin). Branch `feat/backlog-leftovers` in avocado.kiss, cozycorner,
urban.gardener, web.admin, platform-docs. All share Supabase project `base-one` (`zwrkphynupdubevzwdzy`).
Next migration numbers: avocado 0033, cozycorner 0037, urban 0039.

## Facts (2026-11-19, live DB + code)

- Grants: `avocado_kiss` — `authenticated` has TRUNCATE/REFERENCES/TRIGGER on 26/28 tables (only `site_settings`
  (0029) and `recipe_categories` (0030) cleaned); anon has no write grants. Default ACL: `anon=r`,
  `authenticated=arwdDxtm` on new tables (`0001:14`).
- `cozycorner` — `authenticated` ALL on 15/15; **anon has INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on
  9 tables** (admin_folders, categories, footer_settings, hero_sections, media, pages, post_product_sections,
  post_text_sections, posts); RLS on everywhere. Default ACL same as Avocado (`0017:34`).
- `urban_gardener` — clean (0010 + 0031). Reference pattern: `urban.gardener/supabase/migrations/0031_*.sql`.
- Avocado and Cozy have **no** `guard_*` delete-protection triggers → the "guard race" half of B-004 does not
  apply there (record in B-004).
- Reorder: `web.admin/src/lib/ugDb.ts:32-44` `reorderRows` = N parallel `update({position:i})`, not atomic.
  Callers: Urban topics/levels/shop_categories/brands, Avocado tags. Weaker copies without `mustAffect`:
  `lib/brands.ts:57-64` (Cozy+Avocado `brands`), `lib/categories.ts:154-162` (Cozy `categories`, Avocado
  `shop_categories`), `lib/recipeCategories.ts:113-123` (Avocado `categories`). Single UI caller:
  `TaxonomyManager.tsx:156-175` via `features/taxonomy/config.ts` `reorder:`. Column is always `position`.
- B-011 remainder (`urban 0037:15-16`): delete of a level/brand (`on delete set null`) vs `save_article`/
  `save_product` lock in opposite orders → possible 40P01. Bulk `delete from topics where id in (…)` —
  same class; admin deletes one row at a time.
- Silent drops: `ugArticles.parseItems` (:98-120) and `rowToBlock` (:125-142) only `console.warn`;
  `getUgArticle` (:178-205) returns no flag. Precedent: `ugStatic` `footerRepaired`/`navRepaired` +
  amber `role="status"` banner in `UgSiteSettingsPage.tsx:140-153`.
- Pickers without `isError`: Urban author/level Selects (`UgArticleEditPage.tsx:292-320`), `UgTopicsField`,
  brand Select (`UgProductEditPage.tsx:326-337`), `UgCategoriesField`; Cozy/Avocado `TaxonomyCombobox.tsx:45`.
  Precedent with error + retry: `features/recipes/RecipeCategoriesField.tsx:36,113`.
- `assertNotTruncated` (`ugDb.ts:18-23`) = heuristic `rows.length >= 1000`; ~20 call sites (subscribers,
  messages, ugArticles, ugTaxonomy, ugShop, ugHome, ugAuthors, tags).
- B-006: `--ring: oklch(0.708 0 0)` (`src/index.css:68`) ≈ 2.6:1 on white; `ring-ring/50` in 9 shadcn
  `ui/` components + `RichTextEditor.tsx:125`; no `document.title` (static `Site Admin`); router
  `createBrowserRouter` (react-router-dom 7), routes in `src/App.tsx`, pages in `src/lazyPages.ts`.

## Owner decisions (2026-11-19)
- Grants hygiene for **Avocado and Cozy**.
- **Mobile admin not needed** → B-006 item 1 (reflow 320 px) dropped; no 390 px checks for admin screens.

## Work items

### O1 — DB grants hygiene (avocado 0033, cozycorner 0037)
Per schema, one migration `00NN_grants_hygiene.sql`:
1. `revoke truncate, references, trigger on all tables in schema S from anon, authenticated;`
2. Cozy only: `revoke insert, update, delete on all tables in schema cozycorner from anon;` —
   **before writing**, check live policies (`pg_policies` where roles include anon/public and cmd in
   INSERT/UPDATE/DELETE/ALL) on those 9 tables and grep cozycorner site code for anon writes
   (`.insert(`/`.update(`/`.delete(`/`.upsert(` with the anon client). Any hit → stop, report.
3. Default privileges (owner `postgres`):
   `alter default privileges in schema S revoke all on tables from anon;`
   `alter default privileges in schema S revoke truncate, references, trigger on tables from authenticated;`
   (keep authenticated select/insert/update/delete as default — admin convention for these schemas; new
   public tables must `grant select … to anon` explicitly — document in schema docs).
4. No `DO` block in the migration; verification is read-only SQL after apply:
   `has_table_privilege` counts per role/privilege (expect 0 for TRUNCATE/REFERENCES/TRIGGER both roles,
   0 anon writes in both schemas), `pg_default_acl` rows, anon SELECT on public tables unchanged
   (compare counts before/after), column grants intact (`preview_token` still unreadable by anon).
5. Smoke: public pages of cozycorner and avocado.kiss on prod return 200 after apply; admin save of one
   item per site still works (tests + owner check).

### O2 — Atomic reorder RPC (avocado 0034, cozycorner 0038, urban 0039)
One function per schema, same contract:
```sql
create or replace function S.reorder_positions(p_table text, p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
-- whitelist p_table (Urban: topics, levels, shop_categories, brands;
--   Avocado: tags, brands, shop_categories, categories; Cozy: categories, brands);
-- reject null/duplicate ids; one UPDATE … from unnest(p_ids) with ordinality (position = ord-1);
-- get diagnostics row_count; if <> cardinality(p_ids) → raise (rolls back everything).
$$;
revoke all on function … from public, anon; grant execute … to authenticated;
```
- `security invoker` → RLS/admin policies apply unchanged. Use `format('%I.%I', 'S', p_table)` only after
  whitelist match. Verify id type (uuid) per table and whether `position` has a unique constraint
  (if non-deferrable unique → use two-phase update via negative offsets inside the function).
- web.admin: `reorderRows(site, table, ids)` → `db.rpc('reorder_positions', { p_table, p_ids })` (schema
  from `getDb(site)`); `reorderBrands`, `reorderCategories`, `reorderRecipeCategories` delegate to it.
  UI (`TaxonomyManager`) unchanged.
- Old admin code keeps working after migration (grants unchanged) → migrations can be applied before the
  admin deploy.

### O3 — Lock order for levels/brands (urban 0039, same migration as O2)
- `save_article`: before touching the article, `perform 1 from urban_gardener.levels where id = v_level_id
  for key share;` (next to the existing topics pre-lock, `0037:216-218`). `save_product`: same for
  `brands` (`0037:371-372`). Recreate the functions from their current 0037 bodies; keep signatures,
  grants and `security` mode identical (diff against live `pg_get_functiondef`).
- Bulk multi-row topic/category delete: not changed (admin deletes one at a time) — document as accepted
  residual in B-011 and in a comment in 0039.

### O4 — Admin: dropped-data banner (web.admin)
- `parseItems` returns `{ items, dropped }`; `rowToBlock` drops counted; `getUgArticle` returns
  `repaired: boolean` (any dropped item/block). Keep `console.warn`.
- `UgArticleEditPage` shows the same amber `role="status"` banner as `UgSiteSettingsPage` (English, admin
  copy): "Some blocks or list items could not be read and will be removed when you save. Check the article
  before saving."

### O5 — Admin: picker load errors (web.admin)
- Author, Level, Topics, Brand, Categories (Urban forms) and `TaxonomyCombobox` (Cozy/Avocado): on
  `isError` show inline message "Couldn't load <thing>." + "Retry" button (`refetch`), following
  `RecipeCategoriesField`. Do not clear existing selected values on error.

### O6 — Admin: exact-count truncation guard (web.admin)
- Replace heuristic: list loaders request `{ count: 'exact' }`; `assertNotTruncated(rows, count, what)`
  throws when `count == null` or `rows.length < count`. Update all call sites; keep error message style.

### O7 — Admin a11y, desktop (B-006 items 2–3; web.admin)
- `--ring` → contrast ≥ 3:1 on white and on `--background` in light mode (e.g. `oklch(0.55 0 0)`; check
  dark too); remove `/50` from `ring-ring/50` in the 9 `ui/` components + `RichTextEditor`.
- Tab title: `<Page> · <Site name> · Admin` (login/dashboard: `<Page> · Admin`), via one hook/route
  `handle` mechanism, set on every route; on route change (not first load) move focus to the page `h1`
  (`tabIndex={-1}`) so screen readers hear the change. No layout changes.

## Tests and checks
- web.admin: unit tests — `reorderRows` calls RPC with ids; `parseItems`/`getUgArticle` `repaired`;
  `assertNotTruncated` with count; components — banner shown, picker error + retry, title hook. Existing
  tests updated where loaders now pass `count`.
- DB: read-only verification queries (O1.4), RPC smoke under service role is not representative —
  verify via admin tests + owner check; `get_advisors` (security) for base-one after apply.
- `build` + `lint` + `test` in web.admin, avocado.kiss, cozycorner, urban.gardener (sites: migrations only,
  still run checks). No e2e (no visitor flow change). No 390 px (owner: admin mobile not needed; sites
  unchanged visually).
- Reviews (one per layer): `database-reviewer` (3 migrations), `security-auditor` (grants + dynamic-SQL
  RPC), `react-reviewer` (web.admin `.tsx`), `silent-failure-hunter` (`lib/` loaders).

## Rollout
1. Apply migrations to base-one (owner confirms each `apply_migration` via guard): O1 Avocado, O1 Cozy,
   O2 ×3 (+O3). Verify after each.
2. Admin code on `feat/backlog-leftovers`; push branch any time; `main` push (prod) after acceptance.
3. Site repos only carry migration files; push to `main` after acceptance (rebuild, no visible change).

## Docs (docs-writer)
- Backlog: B-004 (done for Avocado+Cozy; no guard triggers there), B-006 (items 2–3 done, item 1 dropped by
  owner 2026-11-19), B-011 (done; bulk delete accepted residual), B-012 (closed). Index in `backlog/README.md`.
- `platform-docs/database/` schema docs for the three schemas: grants convention + `reorder_positions`.
- `admin-panel/` docs if they describe reorder or truncation guard.
- Phase X checklists (avocado, urban, workspace): owner checks from plan §6 that were not browser-verified.
