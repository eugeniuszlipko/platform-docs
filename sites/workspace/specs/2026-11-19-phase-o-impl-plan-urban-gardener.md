# Phase O — urban.gardener (migration 0039: reorder RPC + lock order) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One migration `0039_reorder_positions_lock_order.sql` that adds `urban_gardener.reorder_positions` (O2) and makes `save_article` / `save_product` take their `levels` / `brands` lock before the article / product row (O3).

**Architecture:** One forward-only file, built in three tasks (reorder function, `save_article`, `save_product`), written only; the orchestrator applies it to `base-one` (`zwrkphynupdubevzwdzy`). No `DO` blocks (the 0031/0037 end-of-file safety `do $$` is deliberately not repeated; verification is the read-only SQL section below). Site code untouched.

**Tech Stack:** PostgreSQL 17.6 (Supabase), plpgsql. Repo `urban.gardener`, branch `feat/backlog-leftovers` (verified). Last migration is `0038_storage_bucket_limits.sql`; latest definitions of `save_article` and `save_product` are in `0037_db_cleanup.sql` (checked: no later migration redefines them; earlier copies are in 0006/0009/0033).

**Spec:** `platform-docs/sites/workspace/specs/2026-11-19-phase-o-backlog-leftovers-spec.md` (O2, O3).

## Global Constraints

- Migration number/name: `0039_reorder_positions_lock_order.sql`. Comments in Russian.
- `reorder_positions(p_table text, p_ids uuid[]) returns void`, `language plpgsql`, `security invoker`, `set search_path = ''`; whitelist `topics`, `levels`, `shop_categories`, `brands` (spec O2). All four: `id uuid primary key`, `position integer not null default 0`, **no unique constraint on `position`** (0002, 0007) → plain single UPDATE. Admin policies `"Admin all <t>"` (0002/0007 loops, `for all to authenticated … public.is_admin()`) apply under `security invoker`.
- `revoke all on function … from public, anon; grant execute on function … to authenticated;` for `reorder_positions` (spec O2).
- `save_article(uuid, jsonb, jsonb, uuid[])` and `save_product(uuid, jsonb, uuid[])`: recreate from the 0037 bodies with **only** the new lock statement added; same signatures, `security invoker`, `set search_path = ''`, and the same `revoke all … from public, anon; grant execute … to authenticated, service_role;` as 0037 lines 344–345 / 453–454 (spec O3).
- Lock order after the change: `save_article` = topics (by id, existing) → level → article; `save_product` = shop_categories (by id, existing) → brand → product. Single-row locks need no `order by`.
- Bulk multi-row `delete from topics/shop_categories where id in (…)` is **not** changed; documented as an accepted residual in a comment in 0039 (spec O3). Admin deletes one row at a time.
- Checks for this repo = `build` + `lint` + `test` green; the migration is not applied in tests.

- **Orchestrator ruling (2026-11-19), Task 1:** the same file also runs `revoke maintain on all tables in schema urban_gardener from anon, authenticated;` (live ACL shows `authenticated=arwdm` on e.g. `topics`; MAINTAIN = LOCK/VACUUM/REINDEX for any logged-in user). Post-apply check: `has_table_privilege(role, t, 'MAINTAIN')` = 0 for both roles.

## Spec deviations to note (flag for the orchestrator)

- Spec writes `v_level_id`; the 0037 `save_article` has no such variable (it uses `nullif(p_article->>'level_id', '')::uuid` inline). The plan uses the inline expression; the only side effect is that a malformed uuid in `level_id` now fails at the lock statement instead of at the insert/update (same `22P02`).
- The `for update` pre-lock in `reorder_positions` (rows locked in `id` order) is an addition beyond the spec (one statement; same purpose as O3: two concurrent reorders cannot deadlock).
- Spec cites `0037:216-218` / `0037:371-372`; actual lines are 218 (topics lock) and 372 (shop_categories lock). Irrelevant to the work.

## Review Focus

- Duplicate ids → `22023` before any write (V6c).
- Stale list / RLS-hidden row → rollback, `P0002` (V6d).
- Attacker-shaped `p_table` (`'topics; drop table x'`, `'urban_gardener.topics'`, `null`) → rejected (V6b).
- An article with `level_id = null` (or a product with `brand_id = null`) must still save: the new `perform` matches zero rows and must not raise (V7 reads the definition; owner check saves one article without level and one product without brand).
- `save_*` privileges must be byte-identical before/after (V4: `proacl` compare), otherwise the admin loses Save or anon gains it.

---

### Task 1: file with `reorder_positions`

**Files:**
- Create: `urban.gardener/supabase/migrations/0039_reorder_positions_lock_order.sql`

**Interfaces:**
- Produces: `urban_gardener.reorder_positions(p_table text, p_ids uuid[]) returns void`. Contract used by web.admin (`db.rpc('reorder_positions', { p_table, p_ids })`): writes `position = index` (0-based) for each id; raises `22023` for a non-whitelisted/null `p_table`, null array or null/duplicate elements; raises `P0002` when updated rows ≠ `cardinality(p_ids)`; empty array = no-op.

- [ ] **Step 1: Write the header comment (Russian):** Phase O: (1) B-012 atomic reorder replaces N parallel updates in web.admin; (2) B-011 remainder, lock order for level/brand deletes vs `save_article`/`save_product` (`on delete set null` on `articles.level_id`, `products.brand_id`: delete level → locks level then updates articles; `save_article` locked article then key-shared the level → possible 40P01; now level/brand is locked first); (3) accepted residual: bulk multi-row `delete from topics|shop_categories where id in (…)` can still deadlock, admin deletes one row at a time. Verification = SQL section of `2026-11-19-phase-o-impl-plan-urban-gardener.md`.

- [ ] **Step 2: Write the function and its grants** (dynamic SQL, so the algorithm is fixed here):

```sql
create or replace function urban_gardener.reorder_positions(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_tables constant text[] := array['topics', 'levels', 'shop_categories', 'brands'];
  v_rows bigint;
begin
  if p_table is null or p_table <> all (c_tables) then
    raise exception 'Table is not reorderable' using errcode = '22023';
  end if;
  if p_ids is null or exists (select 1 from unnest(p_ids) as x(id) where x.id is null) then
    raise exception 'Ids must be a list without nulls' using errcode = '22023';
  end if;
  if (select count(distinct x.id) from unnest(p_ids) as x(id)) <> cardinality(p_ids) then
    raise exception 'Ids must not repeat' using errcode = '22023';
  end if;
  if cardinality(p_ids) = 0 then
    return;
  end if;

  execute format('select 1 from %I.%I where id = any ($1) order by id for update', 'urban_gardener', p_table)
    using p_ids;
  execute format(
    'update %I.%I as t set position = (o.ord - 1)::int
       from unnest($1) with ordinality as o(id, ord) where t.id = o.id',
    'urban_gardener', p_table) using p_ids;
  get diagnostics v_rows = row_count;
  if v_rows <> cardinality(p_ids) then
    raise exception 'Reorder failed: % of % rows were found and allowed', v_rows, cardinality(p_ids)
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function urban_gardener.reorder_positions(text, uuid[]) from public, anon;
grant execute on function urban_gardener.reorder_positions(text, uuid[]) to authenticated;
```

The `update` has a `where` (pg_safeupdate requires one). Existing `set_updated_at` triggers on these tables still fire (same as the old per-row updates).

- [ ] **Step 3: Self-check.** `grep -ci "do \$\$" <file>` → `0`; one `create or replace function`.

- [ ] **Step 4: Commit.** `feat(db): atomic reorder_positions RPC for urban_gardener (O2, B-012)`.

### Task 2: `save_article` with level pre-lock  (after Task 1; same file)

**Files:**
- Modify: `urban.gardener/supabase/migrations/0039_reorder_positions_lock_order.sql` (append)

**Interfaces:**
- Produces: `urban_gardener.save_article(uuid, jsonb, jsonb, uuid[]) returns jsonb`, behaviour identical to 0037 except the new lock; privileges identical.

- [ ] **Step 1: Copy the 0037 definition verbatim:** `sed -n '197,345p' urban.gardener/supabase/migrations/0037_db_cleanup.sql >> urban.gardener/supabase/migrations/0039_reorder_positions_lock_order.sql` (line 197 = `create or replace function urban_gardener.save_article(`, line 345 = the `grant execute` line; confirm both with `sed -n '197p;344,345p'` before appending). Put a blank line and a section comment (Russian) before the copied block: "O3 / B-011: сначала уровень (key share), потом статья".

- [ ] **Step 2: Add the lock** directly after the existing line `perform 1 from urban_gardener.topics where id = any (v_topics) order by id for key share;` inside the copied body (Edit, unique match):

```sql
  -- Порядок блокировок (B-011, 0039): тема → уровень → статья. Удаление уровня (ON DELETE SET NULL) блокирует уровень,
  -- затем обновляет статьи; без этого save_article держал статью и ждал key share на уровень (возможный 40P01).
  perform 1 from urban_gardener.levels where id = nullif(p_article->>'level_id', '')::uuid for key share;
```

Nothing else in the body changes.

- [ ] **Step 3: Verify the copy.** Extract the same range from the new file and `diff` it against 0037 lines 197–345: the only differences are the three added lines above (and nothing in the `revoke`/`grant` lines). Run `grep -c "levels where id" <file>` → `1`.

- [ ] **Step 4: Commit.** `fix(db): save_article locks the level before the article (O3, B-011)`.

### Task 3: `save_product` with brand pre-lock  (after Task 2; same file)

**Files:**
- Modify: `urban.gardener/supabase/migrations/0039_reorder_positions_lock_order.sql` (append)

**Interfaces:**
- Produces: `urban_gardener.save_product(uuid, jsonb, uuid[]) returns jsonb`, identical to 0037 except the new lock; privileges identical.

- [ ] **Step 1: Copy** `sed -n '355,454p' …0037_db_cleanup.sql >> …0039…` (355 = `create or replace function urban_gardener.save_product(`, 453–454 = revoke/grant; confirm with `sed -n '355p;453,454p'`). Add a Russian section comment before it.

- [ ] **Step 2: Add the lock** directly after `perform 1 from urban_gardener.shop_categories where id = any (v_cats) order by id for key share;`:

```sql
  -- Порядок блокировок (B-011, 0039): категории → бренд → товар (удаление бренда, ON DELETE SET NULL, блокирует бренд, затем товары).
  perform 1 from urban_gardener.brands where id = nullif(p_product->>'brand_id', '')::uuid for key share;
```

- [ ] **Step 3: Verify** with the same `diff` against 0037 lines 355–454: only the added lines differ. `grep -c "brands where id" <file>` → `1`.

- [ ] **Step 4: Commit.** `fix(db): save_product locks the brand before the product (O3, B-011)`.

### Task 4: Repo checks  (after Tasks 1–3)

- [ ] **Step 1:** `npm --prefix urban.gardener run build` → exit 0.
- [ ] **Step 2:** `npm --prefix urban.gardener run lint` → exit 0.
- [ ] **Step 3:** `npm --prefix urban.gardener test` → all passed.
- [ ] **Step 4:** `git -C urban.gardener status --short` clean; branch `feat/backlog-leftovers`.

---

## Verification SQL (read-only; run by the orchestrator, not a task)

**V0 — before apply: live definitions equal 0037** (the plan copies 0037 text; this proves nothing drifted live):
```sql
select p.proname, md5(pg_get_functiondef(p.oid)) as def_md5, p.prosecdef, p.proconfig, p.proacl::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'urban_gardener' and p.proname in ('save_article', 'save_product') order by 1;
```
Keep the output. Also fetch `pg_get_functiondef('urban_gardener.save_article(uuid,jsonb,jsonb,uuid[])'::regprocedure)` and `…save_product(uuid,jsonb,uuid[])` and compare text with the 0037 bodies (ignore leading/trailing whitespace); any drift → stop and report before applying.

**V4 — after apply: save_* privileges unchanged:** rerun V0; `prosecdef` (false), `proconfig` (`{search_path=""}`) and `proacl` equal the "before" rows; `def_md5` differs (expected).

**V5 — reorder_positions shape:**
```sql
select p.prosecdef, p.proconfig, p.proacl::text,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'urban_gardener' and p.proname = 'reorder_positions';
```
Expect `prosecdef=false`, `proconfig={search_path=""}`, no `=X/` in `proacl`, `anon_exec=false`, `auth_exec=true`.

**V6 — negative behaviour** (one `select` per call; each wrapped in `begin; set local role authenticated; … rollback;`, no admin claims, nothing can be written):
```sql
-- a: select urban_gardener.reorder_positions('media', array[gen_random_uuid()]);               -- 22023 Table is not reorderable
-- b: select urban_gardener.reorder_positions('urban_gardener.topics', array[gen_random_uuid()]); -- 22023 (also 'topics; drop table x', null)
-- c: select urban_gardener.reorder_positions('topics', array['11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111']::uuid[]); -- 22023 Ids must not repeat
-- d: select urban_gardener.reorder_positions('levels', array[(select id from urban_gardener.levels limit 1)]); -- P0002 (RLS hides rows for a non-admin)
-- e: select urban_gardener.reorder_positions('brands', null);                                    -- 22023
```
Optional positive smoke (orchestrator's call): add `set local request.jwt.claims = '{"sub":"<admin user uuid>","role":"authenticated"}'`, call with all current `topics` ids ordered by `position`, then `rollback` → expect success, no change.

**V7 — lock order in the new definitions:**
```sql
with f as (
  select p.proname, pg_get_functiondef(p.oid) as d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'urban_gardener' and p.proname in ('save_article', 'save_product'))
select proname,
  position(case proname when 'save_article' then 'urban_gardener.topics where id = any' else 'urban_gardener.shop_categories where id = any' end in d) as existing_lock,
  position(case proname when 'save_article' then 'urban_gardener.levels where id' else 'urban_gardener.brands where id' end in d) as new_lock,
  position('if v_published or v_publish_at is not null' in d) as first_write_check
from f;
```
Expect `0 < existing_lock < new_lock < first_write_check` for both rows.

**V8 — advisors:** `get_advisors` type `security` for `base-one`; no new finding about `urban_gardener`.

**V9 — smoke (owner):** save one article without a level and one product without a brand (the new `perform` matches zero rows and must not raise); save one with both; reorder a topic arrow in the admin once web.admin Task 1 is deployed.
