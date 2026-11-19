# Phase O — avocado.kiss (migrations 0033, 0034) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dangerous default/table grants in schema `avocado_kiss` (O1) and add an atomic `avocado_kiss.reorder_positions` RPC (O2).

**Architecture:** Two forward-only migration files, written only (applied later by the orchestrator against `base-one`, `zwrkphynupdubevzwdzy`). No `DO` blocks. Verification is a separate read-only SQL section below. Site code is untouched.

**Tech Stack:** PostgreSQL 17.6 (Supabase), plpgsql. Repo `avocado.kiss`, branch `feat/backlog-leftovers` (verified present). Last migration is `0032_storage_bucket_limits.sql`.

**Spec:** `platform-docs/sites/workspace/specs/2026-11-19-phase-o-backlog-leftovers-spec.md` (O1, O2). Reference pattern: `urban.gardener/supabase/migrations/0031_*.sql`, `0037_db_cleanup.sql`.

## Global Constraints

- Migration numbers: `0033_grants_hygiene.sql`, `0034_reorder_positions.sql` (spec header).
- No `DO` block in either file (spec O1.4). Comments in Russian, like the other migrations.
- `reorder_positions(p_table text, p_ids uuid[]) returns void`, `language plpgsql`, `security invoker`, `set search_path = ''` (spec O2).
- Whitelist for Avocado: `tags`, `brands`, `shop_categories`, `categories` (spec O2). All four have `id uuid` + `position integer not null default 0`; **no unique constraint on `position`** in any of them (checked in 0001, 0005, 0007, 0013) → plain single UPDATE, no two-phase trick.
- `revoke all on function … from public, anon; grant execute … to authenticated;` (spec O2).
- Authenticated keeps `select, insert, update, delete` by default (admin convention); new public tables must `grant select … to anon` explicitly (spec O1.3).
- Migration files are not applied in tests; checks for this repo = `build` + `lint` + `test` green.

## Decision added to the spec (flag for the orchestrator)

- `MAINTAIN` (`m`) is revoked together with TRUNCATE/REFERENCES/TRIGGER. Live ACL is `authenticated=arwdDxtm` on PG 17.6; spec lists only three privileges, which would leave `authenticated=arwdm` (same class: `LOCK TABLE`, `VACUUM`, `REINDEX` for any logged-in user). Urban 0031 left `m` in place too. If the owner wants the spec verbatim, delete the word `maintain` in Task 1 (two places) and in the verification expectations.

## Review Focus

- Duplicate ids in `p_ids` → must raise `22023` before any write (verification query V6c).
- Stale list (an id no longer exists / RLS hides it) → whole call rolls back, error `P0002`, no position changed (V6d).
- `p_table` is attacker-shaped text (`'tags; drop table x'`, `'avocado_kiss.tags'`, `null`) → rejected by the whitelist, never reaches `format` (V6b).
- Non-admin session → RLS hides rows → `P0002`, not a silent success (V6d, runs as `authenticated` without admin claims).
- `null` or empty array: null raises `22023`; empty array is a no-op return (V6e).

---

### Task 1: `0033_grants_hygiene.sql`

**Files:**
- Create: `avocado.kiss/supabase/migrations/0033_grants_hygiene.sql`
- Modify: `avocado.kiss/AGENTS.md` (the "DB change" bullet under "When working on this project": one added sentence)

**Interfaces:**
- Consumes: nothing.
- Produces: no table in `avocado_kiss` is TRUNCATE/REFERENCES/TRIGGER/MAINTAIN-able by `anon`/`authenticated`; future tables in the schema get no `anon` privileges and no `truncate/references/trigger/maintain` for `authenticated`.

- [ ] **Step 1: Write the migration.** Header comment (Russian): Phase O / B-004, why (TRUNCATE bypasses RLS and triggers; reachable by any logged-in user on a direct connection on the shared `base-one`), the default-ACL consequence (new public tables need an explicit `grant select … to anon`), no guard-trigger part for this schema (none exist), verification = SQL section of `2026-11-19-phase-o-impl-plan-avocado-kiss.md`. Body, exactly these four statements and no other:

```sql
revoke truncate, references, trigger, maintain
  on all tables in schema avocado_kiss from anon, authenticated;

alter default privileges in schema avocado_kiss revoke all on tables from anon;
alter default privileges in schema avocado_kiss
  revoke truncate, references, trigger, maintain on tables from authenticated;
```

Do not touch sequences or `service_role` defaults. Do not revoke anon `select` on existing tables (`revoke all … from anon` is default-ACL only and affects future tables).

- [ ] **Step 2: Add one sentence to `avocado.kiss/AGENTS.md`** in the "DB change" bullet: "Since 0033 new tables in `avocado_kiss` get no default `anon` privileges: add an explicit `grant select on … to anon` (and RLS policies) in the table's migration." (Not in the spec; prevents a silently unreadable new table. Delete this step if the orchestrator prefers docs-writer to own it.)

- [ ] **Step 3: Self-check.** Run `grep -ci "do \$\$" avocado.kiss/supabase/migrations/0033_grants_hygiene.sql` → expected `0`; `grep -c "^revoke\|^alter default" …` → expected `3`.

- [ ] **Step 4: Commit.** `git -C avocado.kiss add supabase/migrations/0033_grants_hygiene.sql AGENTS.md` then commit `chore(db): revoke truncate/references/trigger/maintain and default anon grants (O1, B-004)` with the reason in the body.

### Task 2: `0034_reorder_positions.sql`  (independent of Task 1)

**Files:**
- Create: `avocado.kiss/supabase/migrations/0034_reorder_positions.sql`

**Interfaces:**
- Produces: `avocado_kiss.reorder_positions(p_table text, p_ids uuid[]) returns void`. Contract used by web.admin (`db.rpc('reorder_positions', { p_table, p_ids })`): writes `position = index` (0-based) for each id in `p_ids`; raises `22023` for a non-whitelisted/null `p_table`, a null array or null/duplicate elements; raises `P0002` when updated rows ≠ `cardinality(p_ids)`; empty array = no-op.

- [ ] **Step 1: Write the function.** Header comment (Russian): Phase O / B-012, replaces N parallel `update`s in web.admin with one atomic call, `security invoker` so the existing "Admin write …" RLS policies apply, whitelist + `%I` only after whitelist match, why `for update` pre-lock (two admins reordering the same table take row locks in the same `id` order → no deadlock; added beyond the spec, one statement). Body (algorithm is fixed because it is dynamic SQL):

```sql
create or replace function avocado_kiss.reorder_positions(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_tables constant text[] := array['tags', 'brands', 'shop_categories', 'categories'];
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

  execute format('select 1 from %I.%I where id = any ($1) order by id for update', 'avocado_kiss', p_table)
    using p_ids;
  execute format(
    'update %I.%I as t set position = (o.ord - 1)::int
       from unnest($1) with ordinality as o(id, ord) where t.id = o.id',
    'avocado_kiss', p_table) using p_ids;
  get diagnostics v_rows = row_count;
  if v_rows <> cardinality(p_ids) then
    raise exception 'Reorder failed: % of % rows were found and allowed', v_rows, cardinality(p_ids)
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function avocado_kiss.reorder_positions(text, uuid[]) from public, anon;
grant execute on function avocado_kiss.reorder_positions(text, uuid[]) to authenticated;
```

The `update` has a `where` (pg_safeupdate, used by PostgREST, requires one).

- [ ] **Step 2: Self-check.** `grep -ci "do \$\$" …/0034_reorder_positions.sql` → `0`; the file contains exactly one `create or replace function` and no `grant … to anon`.

- [ ] **Step 3: Commit.** `feat(db): atomic reorder_positions RPC for avocado_kiss (O2, B-012)`.

### Task 3: Repo checks  (after Tasks 1–2)

- [ ] **Step 1:** `npm --prefix avocado.kiss run build` → exit 0.
- [ ] **Step 2:** `npm --prefix avocado.kiss run lint` → exit 0.
- [ ] **Step 3:** `npm --prefix avocado.kiss test` → all passed (no test change expected).
- [ ] **Step 4:** `git -C avocado.kiss status --short` shows nothing but the intended files committed; branch is `feat/backlog-leftovers`.

---

## Post-apply verification (read-only; run by the orchestrator, not a task)

Run V1 once **before** applying and keep the result; run everything after each `apply_migration`.

**V1 — privilege matrix** (before and after):
```sql
select r.role, p.priv,
       count(*) filter (where has_table_privilege(r.role, c.oid, p.priv)) as tables_with_priv,
       count(*) as tables_total
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'avocado_kiss'
cross join (values ('anon'), ('authenticated')) as r(role)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) as p(priv)
where c.relkind in ('r', 'p')
group by r.role, p.priv order by r.role, p.priv;
```
Expect after: TRUNCATE, REFERENCES, TRIGGER, MAINTAIN = 0 for both roles; anon INSERT/UPDATE/DELETE = 0; authenticated SELECT/INSERT/UPDATE/DELETE = `tables_total` (28 per spec); anon SELECT **identical to the "before" row**.

**V2 — no views or other relations hidden from `on all tables`:** `select relkind, count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='avocado_kiss' and relkind in ('v','m','f') group by 1;` → expect no rows (if rows appear, note them in the report).

**V3 — default ACL:**
```sql
select pg_get_userbyid(d.defaclrole) as grantor, d.defaclobjtype, d.defaclacl::text
from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'avocado_kiss';
```
Expect for objtype `r`: no `anon=` entry, `authenticated=arwd/postgres`, `service_role=arwdDxtm/postgres`; objtype `S` row unchanged.

**V4 — column grants intact:** `select t, has_column_privilege('anon', 'avocado_kiss.' || t, 'preview_token', 'select') from unnest(array['posts','recipes','products']) t;` → all `false`.

**V5 — RPC shape:**
```sql
select p.prosecdef, p.proconfig, p.proacl::text,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'avocado_kiss' and p.proname = 'reorder_positions';
```
Expect `prosecdef=false`, `proconfig={search_path=""}`, `proacl` has no `=X/` (PUBLIC) entry, `anon_exec=false`, `auth_exec=true`.

**V6 — negative behaviour** (each in its own call; the role is `authenticated` without admin claims, so nothing can be written; every statement ends in `rollback`):
```sql
begin; set local role authenticated;
-- a: select avocado_kiss.reorder_positions('media', array[gen_random_uuid()]);            -- 22023 Table is not reorderable
-- b: select avocado_kiss.reorder_positions('avocado_kiss.tags', array[gen_random_uuid()]); -- 22023 (also try 'tags; drop table x' and null)
-- c: select avocado_kiss.reorder_positions('tags', array['11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111']::uuid[]); -- 22023 Ids must not repeat
-- d: select avocado_kiss.reorder_positions('tags', array[(select id from avocado_kiss.tags limit 1)]); -- P0002 (RLS hides rows for a non-admin)
-- e: select avocado_kiss.reorder_positions('tags', null);                                  -- 22023
rollback;
```
(Run one `select` per call, uncommented.) Optional positive smoke, orchestrator's call: same transaction with `set local request.jwt.claims = '{"sub":"<admin user uuid>","role":"authenticated"}'`, call `reorder_positions('tags', <all current tag ids ordered by position>)`, then `rollback` → expect success, no change.

**V7 — advisors:** `get_advisors` type `security` for `base-one`; expect no new finding about `avocado_kiss`.

**V8 — smoke:** public pages of avocado.kiss on prod return 200; owner saves one item in the admin.
