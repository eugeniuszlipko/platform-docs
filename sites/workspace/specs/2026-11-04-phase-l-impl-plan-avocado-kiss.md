# Phase L — avocado.kiss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans (native, recommended) or subagent-driven-development. Steps use checkbox syntax.

**Goal:** avocado.kiss reads logo, icons and default OG image from `avocado_kiss.site_settings` (uploaded in web.admin), with the current repo files as fallbacks.

**Architecture:** One pure resolver `resolveBrand(row)` turns nullable DB columns into URLs/dimensions with fallbacks. The root layout (`generateMetadata`), Header, MobileMenu, Organization JSON-LD and six page builders consume it. Settings already arrive through the cached `fetchLayoutShellCached()` (ISR 60 s), so no new queries.

**Tech Stack:** Next.js 16 (App Router, `generateMetadata`), Supabase (schema `avocado_kiss`), Vitest.

**Spec:** [2026-11-04-phase-l-brand-from-admin-spec.md](./2026-11-04-phase-l-brand-from-admin-spec.md). Siblings: [urban-gardener](./2026-11-04-phase-l-impl-plan-urban-gardener.md), [web-admin](./2026-11-04-phase-l-impl-plan-web-admin.md).

## Global Constraints
- Branch `feat/brand-from-admin` (already created). Local commits only; no push; no `apply_migration` without owner confirmation (guard hook).
- Bucket `avocado-kiss-photos`; DB paths are bucket keys under `brand/` (e.g. `brand/logo-1730000000000.png`). Public URL = `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avocado-kiss-photos/<path>`.
- Sizes: icon 512/180/32 PNG, OG 1200×630 JPEG, logo any size with stored `logo_width`/`logo_height`.
- Alt text stays `Avocado Kiss`; Header keeps `sizes="120px"`, `loading="eager"`.
- Next replaces `openGraph` wholesale: every page that sets `openGraph` must set its own images (own cover → `ogDefault`).
- File-based `app/icon.png|apple-icon.png|favicon.ico` override `metadata.icons` — they must leave `app/`.

## Review Focus
- All three `icon_*` columns null → fallbacks; only some set (should be impossible by CHECK, but a stale row from a future bug) → whole group falls back, never a half-DB/half-repo set.
- `logo_width`/`logo_height` null or 0 with `logo_path` set → fallback logo, never `width={0}`.
- Path with `..`, a full URL or leading `/` in a column (CHECK should block; resolver must not build a URL from it anyway) → fallback.
- A page with its own cover keeps it (article/recipe/product OG unchanged); a page whose cover resolves to null gets `ogDefault`.
- `SUPABASE_URL` env missing at build → fallbacks, no `undefined/storage/...` URLs.

---

### Task 1: Migration 0029 — brand columns

**Files:** Create `supabase/migrations/0029_site_settings_brand.sql`.

**Interfaces:** Produces columns on `avocado_kiss.site_settings`: `logo_path text, logo_width int, logo_height int, icon_path text, icon_apple_path text, icon_small_path text, og_image_path text`.

- [ ] **Step 1: Write the migration** (additive, `add column if not exists`, idempotent constraints via `drop constraint if exists` + `add constraint`). Constraints:
  - `site_settings_brand_path_fmt`: each of the five path columns is null or matches `^brand/[A-Za-z0-9][A-Za-z0-9_-]*\.(png|jpe?g|webp)$` and is ≤ 200 chars (security review: blocks `.`/`..`, SVG, other extensions).
  - `site_settings_logo_group`: `(logo_path is null) = (logo_width is null) and (logo_path is null) = (logo_height is null)`; width/height null or `between 1 and 10000`.
  - `site_settings_icon_group`: `(icon_path is null) = (icon_apple_path is null) and (icon_path is null) = (icon_small_path is null)`.
  - No change to anon/admin access: table-level `grant select … to anon` (0016) covers new columns; admin write is the existing `public.is_admin()` policy. Two hardening statements from the security review: `revoke truncate, references, trigger on avocado_kiss.site_settings from authenticated` and `create unique index if not exists site_settings_singleton … ((true))` (live count was 1). Schema-wide revoke is a separate backlog item.
- [ ] **Step 2: Review gate (before applying):** dispatch `database-reviewer` and `security-auditor` on the file; fix Critical/High.
- [ ] **Step 3: Ask the owner to confirm applying to base-one**, then `apply_migration`. Verify with `execute_sql`: `select column_name from information_schema.columns where table_schema='avocado_kiss' and table_name='site_settings'` lists the 7 new columns; `select count(*) from avocado_kiss.site_settings` still 1.
- [ ] **Step 4: Commit** `feat(db): brand columns on site_settings (phase L)`.

### Task 2: `resolveBrand` (red-first, pure logic)

**Files:** Create `lib/brand.ts`, `lib/brand.test.ts`; Modify `lib/types.ts` (`SiteSettings` gets the 7 nullable fields); Modify `lib/content.ts` (add `getBrand`).

**Interfaces — Produces:**
```ts
export type Brand = {
  logo: { src: string; width: number; height: number };
  icons: { large: string; apple: string; small: string };
  ogDefault: { url: string; width: 1200; height: 630 };
};
export const BRAND_FALLBACK: Brand;               // /brand/avocado-kiss-logo.png 380×168; /brand/avocado-kiss-mark-512.png; /brand/apple-icon-180.png; /brand/icon-32.png; /brand/og-default.jpg
export function resolveBrand(s: Partial<BrandColumns> | null, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): Brand;
export function ogImage(own: { url: string } | null, brand: Brand): { url: string; width: 1200; height: 630 };
// lib/content.ts
export async function getBrand(): Promise<Brand>;  // resolveBrand((await fetchLayoutShellCached()).siteSettings)
```
`BrandColumns` = the 7 nullable columns (exported from `lib/brand.ts`).

- [ ] **Step 1: Write failing tests** in `lib/brand.test.ts`: (a) `resolveBrand(null)` and `resolveBrand({})` equal `BRAND_FALLBACK`; (b) full row → logo `src` = `https://x.supabase.co/storage/v1/object/public/avocado-kiss-photos/brand/logo-1.png` with stored width/height, icons from the three paths; (c) logo group: path set + `logo_width: 0` → fallback logo; (d) icon group partial → whole icon group fallback; (e) path `../x`, `https://evil/x.png`, `/brand/x.png` → fallback; (f) `supabaseUrl` undefined → fallback; (g) `ogImage(null, brand)` → `brand.ogDefault`, `ogImage({url:'u'}, brand)` → `{url:'u',width:1200,height:630}`.
- [ ] **Step 2: Run** `npm test -- lib/brand.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `lib/brand.ts` exactly to those signatures. A path is valid only if it matches `^brand/[A-Za-z0-9][A-Za-z0-9_-]*\.(png|jpe?g|webp)$` and is ≤ 200 chars (same rule as the DB CHECK; keep identical in urban). Groups resolve all-or-nothing.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then `npm run lint`.
- [ ] **Step 5: Commit** `feat(brand): resolveBrand with repo fallbacks`.

### Task 3: Icons and root metadata

**Files:** Move `app/apple-icon.png` → `public/brand/apple-icon-180.png`; `app/icon.png` (192 px) → `public/brand/icon-192.png` (kept as repo copy); `app/favicon.ico` → `public/favicon.ico`; Create `public/brand/icon-32.png` (32×32 downscale of `icon-192.png` via `sips -z 32 32`); Modify `app/layout.tsx`.

**Interfaces — Consumes:** `getBrand`. **Produces:** root metadata with `icons` + `openGraph.images` + `twitter.images`.

- [ ] **Step 1: Context7 check (`/vercel/next.js/v16.2.9`):** confirm `icons` in `generateMetadata` is used when no file convention exists in `app/`. Note the result in the commit body.
- [ ] **Step 2: Move the files** with `git mv`; create `icon-32.png`.
- [ ] **Step 3: In `app/layout.tsx`** replace `export const metadata` with `export async function generateMetadata(): Promise<Metadata>` using `await getBrand()`; keep all existing fields; add `icons: { icon: [{ url: icons.small, sizes: "32x32", type: "image/png" }, { url: icons.large, sizes: "512x512", type: "image/png" }], apple: [{ url: icons.apple, sizes: "180x180" }] }`, `openGraph.images: [ogDefault]`, `twitter: { card: "summary_large_image", images: [ogDefault.url] }`. Fallback `icon-32.png` and `mark-512` keep the same shape.
- [ ] **Step 4: JSON-LD:** in `RootLayout`, `logo` = absolute URL of `brand.icons.large` (prefix `SITE_URL` when it starts with `/`). Get `brand` from the already-fetched `siteSettings` via `resolveBrand(siteSettings)`.
- [ ] **Step 5: Verify** `npm run build`; then `npm run start` and `curl -s localhost:3000 | grep -E 'rel="(icon|apple-touch-icon)"|og:image'` shows the fallback URLs; `curl -sI localhost:3000/favicon.ico` → 200.
- [ ] **Step 6: Commit** `feat(brand): icons and default OG from site settings in root metadata`.

### Task 4: Per-page OG fallback

**Files:** Modify `app/page.tsx`, `app/blog/[slug]/page.tsx`, `app/category/[slug]/page.tsx`, `app/shop/[category]/page.tsx`, `app/product/[slug]/page.tsx`, `app/recipes/[slug]/page.tsx`.

**Interfaces — Consumes:** `getBrand`, `ogImage`.

- [ ] **Step 1:** in each `generateMetadata`, `const brand = await getBrand()` (cached; add to the existing `Promise.all` where one exists) and replace the conditional spreads with `images: [ogImage(image, brand)]` (openGraph) and `images: [ogImage(image, brand).url]` (twitter). Home precedence stays: `pages.og_image_path` → first hero → site default.
- [ ] **Step 2: Tests** (via `test-engineer`, by spec): for `category/[slug]` and `app/page` `generateMetadata`, with mocked content fetchers: cover present → cover URL; cover null → `ogDefault`. Run `npm test`.
- [ ] **Step 3: Commit** `feat(brand): default OG image on pages without a cover`.

### Task 5: Header and MobileMenu logo

**Files:** Modify `components/Header.tsx`, `components/MobileMenu.tsx`, `app/layout.tsx` (pass `logo`).

**Interfaces — Consumes:** `Brand["logo"]`. Header and MobileMenu get a new prop `logo: Brand["logo"]` (MobileMenu is a Client Component; the object is plain data, so it serializes).

- [ ] **Step 1:** replace the hard-coded `src`/`width`/`height` in both with `logo.src/width/height`; keep alt, `sizes`, `loading`, class names. Confirm `next.config.ts` `remotePatterns` already covers `*.supabase.co` (it does, checked 2026-11-04).
- [ ] **Step 2: Tests** (via `test-engineer`): Header renders `<img>` with the given `width`/`height` and alt `Avocado Kiss`; mock `next/image` per repo convention. `npm test`.
- [ ] **Step 3: Commit** `feat(brand): header and mobile menu logo from site settings`.

### Task 6: Fallback OG image

**Files:** Create `public/brand/og-default.jpg` (1200×630).

- [ ] **Step 1:** read the page background colour from `app/globals.css` (`--background`). Compose with macOS `sips` only (no new dependencies): scale `public/brand/avocado-kiss-logo.png` to ~420 px wide, then `sips --padToHeightWidth 630 1200 --padColor <HEX>` and `-s format jpeg`. Work in the scratchpad, copy the result into the repo.
- [ ] **Step 2:** open the result with the Read tool and check: logo centered, not cut, colours right. Redo if not.
- [ ] **Step 3: Commit** `feat(brand): fallback og-default.jpg`.

### Task 7: Verification

- [ ] `qa-runner`: `npm run build`, `npm run lint`, `npm test` in avocado.kiss — all exit 0.
- [ ] Browser (Playwright MCP) at 390 px: header logo and mobile-menu logo render, no layout shift vs. before.
- [ ] After admin plan is done and migration applied: upload a test logo in admin, confirm it shows within ~60 s; reset it.
- [ ] Review gate: `react-reviewer` (one), `seo-specialist`, `security-auditor` (paths into metadata/JSON-LD). Fix Critical/High.
