# Phase L — urban.gardener Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans (native, recommended) or subagent-driven-development. Steps use checkbox syntax.

**Goal:** urban.gardener reads logo, icons and default OG image from `urban_gardener.site_settings` (uploaded in web.admin), with the current repo files as fallbacks.

**Architecture:** Same as [avocado-kiss plan](./2026-11-04-phase-l-impl-plan-avocado-kiss.md) (read its Global Constraints and Review Focus first; they apply here with `urban-gardener-photos` and Urban names). Differences: settings come from `fetchSiteSettings()` (`lib/static-pages.ts`, columns mapped in `static-pages.mappers.ts`, resolved in `static-pages-utils.ts`), page metadata goes through `buildPageMetadata` (`lib/seo.ts`), and writes from admin are a direct `update` (RLS "Admin all site_settings" + `grant update` to `authenticated` from 0017 allow it), so **`save_site_settings` RPC is not changed**.

**Tech Stack:** Next.js 16, Supabase (schema `urban_gardener`), Vitest.

**Spec:** [2026-11-04-phase-l-brand-from-admin-spec.md](./2026-11-04-phase-l-brand-from-admin-spec.md).

## Global Constraints
- Branch `feat/brand-from-admin`. Local commits only; migration applied only after owner confirmation.
- Anon grant on `site_settings` is **table-level** (0017, checked 2026-11-04), so new columns are readable by anon without extra grants. Re-check with `select * from information_schema.column_privileges where table_schema='urban_gardener' and table_name='site_settings' and grantee='anon'` before applying (0031 hygiene could have changed it).
- Logo `alt` stays `{header_brand}` (current behavior). Logo fallback: `/brand/urban-soul-of-plants-logo.png` 279×168; large icon fallback `/brand/urban-soul-of-plants-mark-512.png`; `sizes="80px"`, `loading="eager"` unchanged.
- Everything else (sizes, `brand/` path rule, OG 1200×630 JPEG, `openGraph` replaced wholesale) as in the avocado plan.

## Review Focus
Same five as avocado plan, plus:
- `buildPageMetadata` today emits `twitter.card: 'summary'` when no image; with a default image it must be `summary_large_image` on every page.
- `resolveSettings(null)` (missing row) still returns a full `SiteSettings` including `brand` fallbacks.

---

### Task 1: Migration 0036 — brand columns

**Files:** Create `supabase/migrations/0036_site_settings_brand.sql`.

- [ ] **Step 1:** Same columns and constraints as avocado Task 1 (incl. the tightened path CHECK; no revoke/index here: urban already has both), on `urban_gardener.site_settings` (constraint names prefixed `site_settings_`; use `drop constraint if exists` + `add constraint`). No RPC change, no grant change; header comment explains both.
- [ ] **Step 2:** Run the `column_privileges` check above; if anon is column-level now, add `grant select (<7 columns>) to anon` to the migration.
- [ ] **Step 3: Review gate** `database-reviewer` + `security-auditor`; fix Critical/High.
- [ ] **Step 4:** Owner confirms → `apply_migration`; verify columns exist and `count(*)` is 1.
- [ ] **Step 5: Commit** `feat(db): brand columns on site_settings (phase L)`.

### Task 2: `resolveBrand` and settings plumbing (red-first)

**Files:** Create `lib/brand.ts`, `lib/brand.test.ts`; Modify `lib/static-pages.types.ts` (add the 7 columns to `SETTINGS_COLUMN_NAMES` and optional fields to `SiteSettingsRow`; add `brand: Brand` to `SiteSettings`), `lib/static-pages-utils.ts` (`resolveSettings` fills `brand` in both branches), existing `static-pages` tests/fixtures that build a full `SiteSettings`.

**Interfaces — Produces:** identical to the avocado plan's `Brand`, `BRAND_FALLBACK`, `resolveBrand(row, supabaseUrl?)`, `ogImage(own, brand)`, with Urban fallbacks (`/brand/urban-soul-of-plants-logo.png`, `…-mark-512.png`, `/brand/apple-icon-180.png`, `/brand/icon-32.png`, `/brand/og-default.jpg`) and bucket `urban-gardener-photos`. `SiteSettings.brand: Brand`.

- [ ] **Step 1:** Write `lib/brand.test.ts` with the same seven cases as avocado Task 2 (bucket name differs). Add one case to the existing resolver tests: `resolveSettings(null).brand` equals `BRAND_FALLBACK`.
- [ ] **Step 2:** Run `npm test -- lib/brand.test.ts`; expected FAIL.
- [ ] **Step 3:** Implement; run again, expected PASS; `npm run lint`; `npx tsc --noEmit -p tsconfig.json` clean (fixtures updated).
- [ ] **Step 4: Commit** `feat(brand): resolveBrand and brand in site settings`.

### Task 3: Icons, root metadata, JSON-LD

**Files:** `git mv` `app/apple-icon.png` → `public/brand/apple-icon-180.png`, `app/icon.png` → `public/brand/icon-192.png`, `app/favicon.ico` → `public/favicon.ico`; create `public/brand/icon-32.png` (`sips -z 32 32` of the 192 px file); Modify `app/layout.tsx`, `lib/json-ld.ts`.

**Interfaces:** `organizationJsonLd({ siteUrl, email, sameAs, logoUrl })` — new required `logoUrl: string` (absolute). Layout passes `absolute(settings.brand.icons.large)`.

- [ ] **Step 1:** Context7 check as in avocado Task 3 Step 1.
- [ ] **Step 2:** Move files. In `generateMetadata` (already reads `fetchSiteSettings()`; use `settings.brand`) add `icons` and `openGraph.images`/`twitter` exactly as avocado Task 3 Step 3; keep `robots`, `verification`, titles.
- [ ] **Step 3:** Update `organizationJsonLd` and its tests: logo equals the passed `logoUrl`; relative fallback is made absolute in the layout with `siteUrl`.
- [ ] **Step 4: Verify** `npm run build`, `npm run start`, curl head for icon/apple/og tags and `/favicon.ico` 200.
- [ ] **Step 5: Commit** `feat(brand): icons, default OG and logo JSON-LD from site settings`.

### Task 4: Page metadata with default OG

**Files:** Create `lib/page-metadata.ts`; Modify the nine `buildPageMetadata` callers: `app/page.tsx`, `app/about`, `app/contact`, `app/privacy`, `app/terms`, `app/articles/[slug]`, `app/product/[slug]`, `app/shop/[category]`, and the two static ones `app/shop/(hub)/page.tsx`, `app/articles/(listing)/page.tsx` (convert `export const metadata` → `export async function generateMetadata()`); Modify `lib/seo.ts` (twitter card).

**Interfaces — Produces:**
```ts
// lib/page-metadata.ts
export async function pageMetadata(input: PageMetadataInput): Promise<Metadata>;
// = buildPageMetadata({ ...input, image: input.image ?? (await fetchSiteSettings()).brand.ogDefault })
```
`PageMetadataInput.image` type stays `{ url: string; alt?: string } | null`. `buildPageMetadata` stays pure and unchanged except: update the file header comment ("no default image" is no longer true).

- [ ] **Step 1: Failing tests** in `lib/page-metadata.test.ts` (mock `fetchSiteSettings`): no image → `openGraph.images[0].url` is `brand.ogDefault.url` and `twitter.card === 'summary_large_image'`; own image → own URL; DB brand set → storage URL.
- [ ] **Step 2:** run, expected FAIL; **Step 3:** implement; run, expected PASS.
- [ ] **Step 4:** Switch the ten callers to `await pageMetadata(...)`; home keeps `{ ...meta, title }` logic. Existing `static-pages-metadata.test.ts` and `page.test.tsx` updated to the async form; `npm test` green.
- [ ] **Step 5: Commit** `feat(brand): default OG image for pages without a cover`.

### Task 5: Header logo

**Files:** Modify `components/Header.tsx` (client component), `app/layout.tsx`.

**Interfaces:** `Header` gets prop `logo: Brand["logo"]` (plain data → serializable). Layout passes `settings.brand.logo`.

- [ ] **Step 1:** Use `logo.src/width/height` in the `<Image>`; alt remains `{brand}`; fix the inline comment about "change the picture too" (now done in admin).
- [ ] **Step 2:** Tests via `test-engineer`: Header renders the passed dimensions and alt = brand text. `npm test`.
- [ ] **Step 3: Commit** `feat(brand): header logo from site settings`.

### Task 6: Fallback OG image

Same as avocado Task 6, with `public/brand/urban-soul-of-plants-logo.png` and the page background from Urban's `globals.css`; output `public/brand/og-default.jpg`. Commit `feat(brand): fallback og-default.jpg`.

### Task 7: Verification
- [ ] `qa-runner`: build + lint + test in urban.gardener, exit 0.
- [ ] 390 px browser check of the header logo.
- [ ] Review gate: `react-reviewer`, `seo-specialist`, `security-auditor`, `silent-failure-hunter` on `lib/brand.ts` and `lib/page-metadata.ts` (silent fallbacks must log once when a DB value is rejected: `console.error('[brand] …')`, same style as `resolveSettings`).
