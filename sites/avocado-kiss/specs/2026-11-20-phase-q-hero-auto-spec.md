# Avocado Kiss — Phase Q: Hero carousel Auto / Manual — agent spec

> Owner plan: `../plans/2026-11-20-phase-q-hero-auto.md`. Closes B-028. Repos: avocado.kiss, web.admin, platform-docs.

## Decisions (owner, 2026-11-20)
- Toggle Auto / Manual for the home Hero carousel.
- Auto = 3 latest published recipes + 3 latest published blog posts, interleaved R, P, R, P, R, P (newest recipe first).
- After release the mode is **Auto**. Manual hero slots stay in `home_slots` untouched and are shown again when Manual is selected.

## Data (migration avocado.kiss `0035_pages_hero_mode.sql`)
```sql
alter table avocado_kiss.pages
  add column hero_mode text not null default 'manual'
  check (hero_mode in ('auto', 'manual'));
comment on column avocado_kiss.pages.hero_mode is
  'Home Hero carousel source (used on slug=home only): auto = latest 3 recipes + 3 posts, manual = home_slots slot=hero';
update avocado_kiss.pages set hero_mode = 'auto' where slug = 'home';
```
Grants: `pages` has table-level SELECT for anon and SELECT/INSERT/UPDATE for authenticated → the new column is covered; verify anon can read `hero_mode` and cannot update. No RLS change.

## Site (avocado.kiss)
- Pure function `interleaveHero(recipes, posts, perKind = 3)` (lib/content.ts or lib/hero.ts): takes newest-first lists, returns R,P,R,P…; if one kind has fewer, the remainder of the other kind is appended. Test-first (pure logic).
- `fetchHeroItems` (cached): read `pages.hero_mode` for `slug='home'` (missing row/column → `manual`). Manual → current behaviour. Auto → two queries: recipes and posts with `is_published = true` and `hero_image_path is not null`, `order published_at desc`, `limit 3`; map to `HeroItem` with the existing eyebrows (`HERO_EYEBROW_RECIPE` / `HERO_EYEBROW_POST`), hrefs `/recipes/<slug>`, `/blog/<slug>`; ids prefixed (`auto-recipe-<id>`) to avoid key clashes. Do not filter by `published_at <= now()` (RLS + is_published define visibility; cron sets published_at = publish_at).
- Freshness: home has `revalidate = 60`; cron calls `notify_site_revalidate('avocado_kiss')` on publish — verify which paths it revalidates and that `/` is included; if not, add `/` (code-only, no SQL change unless required).
- Unit tests: interleave, loader mode switch (mocked client), empty cases (0 posts, 0 recipes, both empty → carousel hidden as today).

## Admin (web.admin)
- Homepage editor (`/avocado-kiss/homepage`, `AvocadoPageEditPage` → `HomeSlotsEditor`), Hero block: radiogroup **Auto — latest 3 recipes + 3 posts** / **Manual**. Value is part of the page draft (`avocadoPageForm`), saved with the page (`pages.hero_mode`), dirty-tracked by the unsaved-changes guard.
- Auto: read-only preview of the 6 items in final order (same query rules as the site, via the admin client; label "Shown on the site now"); manual hero slot list stays visible but dimmed with note "Saved — shown when Manual is selected"; "+ Recipe / + Post" disabled in Auto.
- Manual: unchanged. `SLOT_META.hero.capacity` 3 → 6 (matches the site and Auto size); update hint text.
- Tests: form mapping, toggle → payload, preview order (shared interleave logic copied or re-implemented with the same tests), guard dirty state.

## Docs / skills
- `admin-panel/home-avocado-kiss.md`, `sites/avocado-kiss.md` (schema: pages.hero_mode), `skills/avocado-content-ops/SKILL.md` (home curation: Hero manual slots only matter when hero_mode = manual; how to switch), backlog B-028 → done.

## Review gate / verification
- `database-reviewer` (migration) and `security-auditor` (new column + grants) — one each; `react-reviewer` one per repo.
- `qa-runner`: build + lint + test in avocado.kiss and web.admin. 390 px check of the home Hero in Auto.
- Migration is applied as part of the approved plan; verify before/after: `select slug, hero_mode from avocado_kiss.pages`, anon read of hero_mode, live home page shows 3+3.
- Order of rollout: apply migration (column default manual for non-home; home = auto) → the current prod site ignores the column (still manual slots) → push site + admin. Between migration and deploy nothing changes for visitors.
