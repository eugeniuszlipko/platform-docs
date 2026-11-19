# Phase O — cozycorner (migrations 0037, 0038) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dangerous default/table grants in schema `cozycorner`, including the anon write grants on 9 tables (O1), and add an atomic `cozycorner.reorder_positions` RPC (O2).

**Architecture:** Two forward-only migration files, written only (applied later by the orchestrator against `base-one`, `zwrkphynupdubevzwdzy`). No `DO` blocks. Verification is a separate read-only SQL section below. Site code is untouched.

**Tech Stack:** PostgreSQL 17.6 (Supabase), plpgsql. Repo `cozycorner`, branch `feat/backlog-leftovers` (verified). Last migration is `0036_request_revalidate.sql`.

**Spec:** `platform-docs/sites/workspace/specs/2026-11-19-phase-o-backlog-leftovers-spec.md` (O1, O2). Reference pattern: `urban.gardener/supabase/migrations/0031_*.sql`, `0037_db_cleanup.sql`.

## Global Constraints

- Migration numbers: `0037_grants_hygiene.sql`, `0038_reorder_positions.sql` (spec header).
- No `DO` block (spec O1.4). Comments in Russian, like the other migrations.
- `reorder_positions(p_table text, p_ids uuid[]) returns void`, `language plpgsql`, `security invoker`, `set search_path = ''` (spec O2).
- Whitelist for Cozy: `categories`, `brands` (spec O2). Both `id uuid`, `position integer not null default 0`, **no unique constraint on `position`** (0014 created `categories` in `public`, 0017 moved it to `cozycorner`; 0023 `brands`) → plain single UPDATE.
- Admin write policies exist: `"Admin write categories"` (0017, `for all to authenticated … public.is_admin()`) and `"Admin write brands"` (0023) → `security invoker` is enough.
- `revoke all on function … from public, anon; grant execute … to authenticated;` (spec O2).
- Already verified by the orchestrator (do not redo): no RLS policy lets anon/public INSERT/UPDATE/DELETE/ALL; site writes only via service role (`lib/newsletter.ts`) and RPC `check_revalidate_token`. So the anon write revoke (spec O1.2) is cleared to write. If the post-apply smoke (V8) shows a failing anon write path, that is a stop-and-report.
- Authenticated keeps `select, insert, update, delete` by default; new public tables must `grant select … to anon` explicitly (spec O1.3).
- Checks for this repo = `build` + `lint` + `test` green; migrations are not applied in tests.

## Decision added to the spec (flag for the orchestrator)

- `MAINTAIN` (`m`) is revoked together with TRUNCATE/REFERENCES/TRIGGER (live ACL `authenticated=arwdDxtm`, PG 17.6; the spec's three-privilege list would leave `arwdm`, i.e. `LOCK TABLE`/`VACUUM` for any logged-in user). To follow the spec verbatim, delete the word `maintain` in Task 1 (two places) and in V1/V3 expectations.

## Review Focus

- Anon must keep SELECT on every public table and the column grants (`preview_token` unreadable) after the anon write revoke (V1 before/after compare, V4).
- Duplicate ids → `22023` before any write (V6c).
- Stale list / RLS-hidden row → whole call rolls back, `P0002` (V6d).
- Attacker-shaped `p_table` (`'categories; drop table x'`, `'cozycorner.categories'`, `null`) → whitelist rejects it (V6b).
- Null array → `22023`; empty array → no-op (V6e).

---

### Task 1: `0037_grants_hygiene.sql`

**Files:**
- Create: `cozycorner/supabase/migrations/0037_grants_hygiene.sql`
- Modify: `cozycorner/AGENTS.md` ("DB change" bullet under "When working on this project": one added sentence)

**Interfaces:**
- Produces: in schema `cozycorner` no TRUNCATE/REFERENCES/TRIGGER/MAINTAIN for `anon`/`authenticated`, no INSERT/UPDATE/DELETE for `anon`; future tables get no `anon` privileges and no `truncate/references/trigger/maintain` for `authenticated`.

- [ ] **Step 1: Write the migration.** Header comment (Russian): Phase O / B-004, why (TRUNCATE bypasses RLS; anon had write grants on 9 tables behind RLS only — admin_folders, categories, footer_settings, hero_sections, media, pages, post_product_sections, post_text_sections, posts; origin not investigated), the check that no policy or site code uses anon writes (orchestrator, 2026-11-19), the default-ACL consequence (new public tables need explicit `grant select … to anon`), no guard-trigger part (none in this schema), verification = SQL section of `2026-11-19-phase-o-impl-plan-cozycorner.md`. Body, exactly these five statements and no other:

```sql
revoke truncate, references, trigger, maintain
  on all tables in schema cozycorner from anon, authenticated;

revoke insert, update, delete on all tables in schema cozycorner from anon;

alter default privileges in schema cozycorner revoke all on tables from anon;
alter default privileges in schema cozycorner
  revoke truncate, references, trigger, maintain on tables from authenticated;
```

Do not touch sequences, `service_role` or anon `select` on existing tables.

- [ ] **Step 2: Add one sentence to `cozycorner/AGENTS.md`** in the "DB change" bullet: "Since 0037 new tables in `cozycorner` get no default `anon` privileges: add an explicit `grant select on … to anon` (and RLS policies) in the table's migration." (Not in the spec; delete if docs-writer should own it.)

- [ ] **Step 3: Self-check.** `grep -ci "do \$\$" cozycorner/supabase/migrations/0037_grants_hygiene.sql` → `0`; `grep -c "^revoke\|^alter default" …` → `4`.

- [ ] **Step 4: Commit.** `chore(db): revoke truncate/references/trigger/maintain, anon writes and default anon grants (O1, B-004)`; body names the 9 tables.

### Task 2: `0038_reorder_positions.sql`  (independent of Task 1)

**Files:**
- Create: `cozycorner/supabase/migrations/0038_reorder_positions.sql`

**Interfaces:**
- Produces: `cozycorner.reorder_positions(p_table text, p_ids uuid[]) returns void`. Contract used by web.admin (`db.rpc('reorder_positions', { p_table, p_ids })`): writes `position = index` (0-based) for each id; raises `22023` for a non-whitelisted/null `p_table`, null array or null/duplicate elements; raises `P0002` when updated rows ≠ `cardinality(p_ids)`; empty array = no-op.

- [ ] **Step 1: Write the function.** Header comment (Russian): Phase O / B-012, one atomic call instead of N parallel `update`s, `security invoker` so the admin policies apply, `%I` only after whitelist match, `for update` pre-lock in `id` order so two admins reordering the same table cannot deadlock (beyond the spec, one statement). Body:

```sql
create or replace function cozycorner.reorder_positions(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_tables constant text[] := array['categories', 'brands'];
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

  execute format('select 1 from %I.%I where id = any ($1) order by id for update', 'cozycorner', p_table)
    using p_ids;
  execute format(
    'update %I.%I as t set position = (o.ord - 1)::int
       from unnest($1) with ordinality as o(id, ord) where t.id = o.id',
    'cozycorner', p_table) using p_ids;
  get diagnostics v_rows = row_count;
  if v_rows <> cardinality(p_ids) then
    raise exception 'Reorder failed: % of % rows were found and allowed', v_rows, cardinality(p_ids)
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function cozycorner.reorder_positions(text, uuid[]) from public, anon;
grant execute on function cozycorner.reorder_positions(text, uuid[]) to authenticated;
```

- [ ] **Step 2: Self-check.** `grep -ci "do \$\$" …/0038_reorder_positions.sql` → `0`; one `create or replace function`; no `grant … to anon`.

- [ ] **Step 3: Commit.** `feat(db): atomic reorder_positions RPC for cozycorner (O2, B-012)`.

### Task 3: Repo checks  (after Tasks 1–2)

- [ ] **Step 1:** `npm --prefix cozycorner run build` → exit 0.
- [ ] **Step 2:** `npm --prefix cozycorner run lint` → exit 0.
- [ ] **Step 3:** `npm --prefix cozycorner test` → all passed.
- [ ] **Step 4:** `git -C cozycorner status --short` clean apart from intended files; branch `feat/backlog-leftovers`.

---

## Post-apply verification (read-only; run by the orchestrator, not a task)

Run V1 once **before** applying and keep the result; run everything after each `apply_migration`.

**V1 — privilege matrix** (before and after):
```sql
select r.role, p.priv,
       count(*) filter (where has_table_privilege(r.role, c.oid, p.priv)) as tables_with_priv,
       count(*) as tables_total
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'cozycorner'
cross join (values ('anon'), ('authenticated')) as r(role)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) as p(priv)
where c.relkind in ('r', 'p')
group by r.role, p.priv order by r.role, p.priv;
```
Expect after: TRUNCATE, REFERENCES, TRIGGER, MAINTAIN = 0 for both roles; anon INSERT/UPDATE/DELETE = 0 (before: 9); authenticated SELECT/INSERT/UPDATE/DELETE = `tables_total` (15 per spec); anon SELECT **identical to the "before" row**.

**V2 — other relation kinds:** `select relkind, count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='cozycorner' and relkind in ('v','m','f') group by 1;` → expect no rows (else note them).

**V3 — default ACL:**
```sql
select pg_get_userbyid(d.defaclrole) as grantor, d.defaclobjtype, d.defaclacl::text
from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'cozycorner';
```
Expect objtype `r`: no `anon=` entry, `authenticated=arwd/postgres`, `service_role=arwdDxtm/postgres`; objtype `S` row unchanged.

**V4 — column grants intact:** `select t, has_column_privilege('anon', 'cozycorner.' || t, 'preview_token', 'select') from unnest(array['posts','products']) t;` → both `false`.

**V5 — RPC shape:**
```sql
select p.prosecdef, p.proconfig, p.proacl::text,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'cozycorner' and p.proname = 'reorder_positions';
```
Expect `prosecdef=false`, `proconfig={search_path=""}`, no `=X/` in `proacl`, `anon_exec=false`, `auth_exec=true`.

**V6 — negative behaviour** (one `select` per call; role `authenticated` without admin claims; each wrapped in `begin; set local role authenticated; … rollback;`):
```sql
-- a: select cozycorner.reorder_positions('media', array[gen_random_uuid()]);              -- 22023 Table is not reorderable
-- b: select cozycorner.reorder_positions('cozycorner.categories', array[gen_random_uuid()]); -- 22023 (also 'categories; drop table x', null)
-- c: select cozycorner.reorder_positions('categories', array['11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111']::uuid[]); -- 22023 Ids must not repeat
-- d: select cozycorner.reorder_positions('brands', array[(select id from cozycorner.brands limit 1)]); -- P0002 (RLS hides rows for a non-admin)
-- e: select cozycorner.reorder_positions('brands', null);                                  -- 22023
```
Optional positive smoke (orchestrator's call): add `set local request.jwt.claims = '{"sub":"<admin user uuid>","role":"authenticated"}'`, call with all current `brands` ids ordered by `position`, then `rollback` → expect success, no change.

**V7 — advisors:** `get_advisors` type `security` for `base-one`; no new finding about `cozycorner`.

**V8 — smoke:** public pages of cozycorner on prod return 200 (home, a category page, a product page, a blog post, `/shop`); newsletter subscribe still works (service-role path); owner saves one item in the admin. A failure of any anon write path here means the pre-check missed a caller — report, do not patch.
