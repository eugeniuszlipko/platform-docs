# Phase N — Urban DB cleanup (agent spec)

Source: backlog B-011, B-012 (partial), B-013, B-014. Owner plan: [plans/2026-11-19-phase-n-db-cleanup.md](../plans/2026-11-19-phase-n-db-cleanup.md).
Level 3 (migration, two repos). Impl-plans required (one per repo: urban.gardener, web.admin) via `writing-plans` at "Начинаем фазу N". Branch `feat/db-cleanup` in urban.gardener, web.admin, platform-docs.
**Do not start web.admin work until the Phase M branch there is committed and web.admin is back on `main`** (shared checkout).

## Owner decision
B-013: delete the spec table completely (code, admin "Plant details", columns `light`, `water`, `size`, `pet_safety`). Data of 9/9 products is lost (checked 2026-11-19).

## Live state (base-one, read-only SQL 2026-11-19)
11 articles, 0 published articles violating cover/read_minutes, 0 blank titles; 9 products, all with spec values; 1 site_settings row with legacy values. Next migration number **0037** (newest `0036_site_settings_brand.sql`).

## Migration `0037_db_cleanup.sql` (urban_gardener; owner confirmation for apply_migration)
Order inside the file:
1. **B-014.** `alter table site_settings drop constraint if exists site_settings_affiliate_not_blank, drop constraint if exists site_settings_price_note_not_blank; drop column affiliate_disclosure, price_note`. Re-create `save_site_settings` from `0029_analytics_settings.sql` (whitelist :25, update :106-107) without both keys; re-issue `revoke all … from public, anon` + `grant execute … to authenticated, service_role` (:131). 0036 does not redefine the RPC. Table-level grants need no change.
2. **B-011a.** `articles`: add `articles_published_needs_cover_and_read` = `check (not is_published or (nullif(btrim(coalesce(cover_path,'')),'') is not null and read_minutes is not null)) not valid` and `articles_title_not_blank` = `check (btrim(title) <> '') not valid`, then `validate constraint` (drop-if-exists first). Existing rows are clean. `save_article` / `publish_due_content` already enforce the same rules with friendlier messages — no admin change; optionally map new constraint names if raw errors can surface.
3. **B-011b (verify first).** Explore found article→topic lock order in both `save_article` and the guards, so B-011's "topic first" deadlock may not exist. Write a two-session concurrent test (delete topic vs save article with that topic). If reproducible: add `perform 1 from topics where id = any(…) order by id for key share` as first line of `save_article`/`save_product` (write once, in the re-created function). Always: add `order by id` to the product lock query in `guard_shop_category_delete` (`0010`, `for update of p` has no order). If not reproducible: only the `order by` fix; note the finding in B-011.
4. **B-013.** `alter table products drop column light, water, size, pet_safety` (`products_pet_safety_check` from `0007:102` goes with `pet_safety`). Re-create `save_product` from `0033_save_rpc_publish_at.sql:153+` without the four fields (insert columns :184, values :197-200, update :220-223); re-issue revoke/grant. plpgsql is not validated at creation → the RPC rewrite must be in the same migration. Column-level anon grants (0030 builds list dynamically) vanish with columns. Seeds 0008/0009 are untouched (run before).

SQL checks after apply: constraints exist and are validated; `has_function_privilege('anon', 'urban_gardener.save_site_settings(...)', 'execute')` false (same for `save_product`); columns gone; `save_product` and `save_site_settings` smoke call under an admin role; anon read of products unaffected.

## Deploy order
Code first (site no longer selects the four columns; admin no longer sends them), then 0037. A select naming a dropped column errors. Old RPC receiving extra/missing keys: confirm in impl-plan whether the new `save_product` ignores unknown payload keys and whether old admin payload would break between deploys (single admin: do both quickly).

## urban.gardener changes (Explore map 2026-11-19)
B-013 delete: delete `components/shop/SpecList.tsx`, `.module.css`, `.test.tsx`; edit `lib/shop.mappers.ts` (PRODUCT_SELECT :10, ProductRow :46-49, `toPetSafety`/`PET_VALUES` :64-67, mapper :121-124), `lib/shop.types.ts` (`PetSafety` :4, `Product.light/water/size/petSafety` :36-39), `lib/shop-utils.ts` (`PET_LABELS`, `petLabel` :104-111), `components/shop/ProductDetail.tsx` (stale comment :12), `lib/shop.fixtures.ts` (fields :82-85, per-product values, mapping), tests `lib/shop.mappers.test.ts`, `lib/shop-utils.test.ts`, `lib/shop.fixtures.test.ts:43`, `ProductDetail.test.tsx:79-83` (keep as negative check or delete), `e2e/shop.spec.ts:155,163-165` (reword). Not affected: JSON-LD, search, "Pet-friendly" filter (a category).
B-012 (site): extract the count check from `lib/sitemap.ts:15-23,40-46` / `lib/shop.ts:104-115` into a shared helper; apply to `fetchArticles` (`lib/articles.ts:28-37`) and `fetchAllProductSlugs` (`lib/shop.ts:88-93`); optionally `fetchTopics`/`fetchLevels`/`fetchShopCategories`. `fetchProductPage` is already bounded (`.range`, PAGE_SIZE 12) — B-012 text is wrong on this; correct the backlog entry.
AGENTS.md of urban.gardener: remove `SpecList` mention if listed.

## web.admin changes
B-013: `features/ug-products/UgProductEditPage.tsx` (`petSafety` watch :98, `petHint` :109/:327, "Plant details" block ~:385-410), `ugProductForm.ts` (zod :50-53, `toInput` :117-120, `toFormValues` :140-143, `needsPetFriendlyHint` :172-174), `lib/ugShop.ts` (`UgPetSafety` :11, `UgProduct` :32-35, `PRODUCT_COLUMNS` :75); tests `UgProductEditPage.test.tsx`, `ugProductForm.test.ts`, `lib/ugShop.test.ts`.
B-012 (admin): add the existing `assertNotTruncated` (`lib/ugDb.ts:19-23`) to `listUgAuthors` (`ugAuthors.ts:52-56`, multi-site incl. avocado), `listUgBrands`, `listUgShopCategories` (`ugShop.ts:314-322,173-181`), `listUgTopics`, `listUgLevels` (`ugTaxonomy.ts:31-39,150-158`). `ugArticles.parseItems` (:98-109) and `rowToBlock`/`getUgArticle` (:113-134,185-188): warn/flag "repaired" like `ugStatic.ts:91-129,179-181`. **Out of scope:** `reorderRows` (`ugDb.ts:32-45`, also used by avocado `lib/tags.ts:57`) → needs `reorder_*` RPCs; leave B-012 open for it.
Do not change `reorderRows` signature or touch `features/taxonomy/*` beyond the guard additions.

## platform-docs (docs-writer)
`database/schema.md` (:917 spec columns, :922 site_settings, articles checks), `admin-panel/shop-urban-gardener.md:38`, `admin-panel/static-pages-urban-gardener.md:25` (key count/list), `methodology/amazon-associates-rules.md:26,33` (disclosure/price_note removed, D40), `sites/urban-gardener.md` (D27 :74, D40 :87, journal entry), backlog B-011/B-012/B-013/B-014 + README. Phase-3/5 specs stay as history.

## Review gate (one per layer)
`database-reviewer` + `security-auditor` (0037: RPC re-issue grants, constraints), `react-reviewer` per repo (`.tsx` changes), `silent-failure-hunter` (B-012 loaders). `qa-runner`: build+lint+test in both repos; 390 px check of the product form and a product page.

## Risks
- Irreversible loss of spec values (9 products).
- Deploy order (code before migration).
- Re-created RPCs lose grants if the revoke/grant is forgotten → verify with `has_function_privilege`.
- Shared checkout with Phase M in web.admin.
