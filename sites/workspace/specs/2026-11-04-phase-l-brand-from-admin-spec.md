# Phase L — brand assets (logo, icon, default OG) editable in admin (agent spec)

Owner plan: [../plans/2026-11-04-phase-l-brand-from-admin.md](../plans/2026-11-04-phase-l-brand-from-admin.md). Closes [B-009](../../../backlog/B-009-admin-favicon-og-image.md).
Level 3 (migrations in 2 schemas, 3 code repos: avocado.kiss, urban.gardener, web.admin + platform-docs). Branch `feat/brand-from-admin` in each touched repo. Impl-plan required (migrations + multi-repo) — write via `writing-plans` at «Начинаем фазу L», one per repo.

## Owner answers (2026-11-04)
- Default OG image for BOTH sites (not only Urban).
- First OG images: agent composes logo-on-brand-background 1200×630, committed as repo fallbacks.
- Icon: ONE square upload (≥512), admin derives sizes.

## Facts established 2026-11-04 (verify again at start)
- Both schemas have singleton `site_settings`: `avocado_kiss.site_settings` (0016: x/pinterest/instagram urls; table-level `grant select … to anon`, RLS public read, admin write via `public.is_admin()`), `urban_gardener.site_settings` (0017 + 0021 header_brand/nav_links, 0026 newsletter popup, 0028, 0029 analytics). **Check Urban's anon grant mode (table vs column-level) before adding columns** — see memory "cozycorner column-level grants": with column-level grants new columns are NOT readable by anon until granted.
- Storage buckets exist with admin-only write policies: `avocado-kiss-photos` (avocado 0002), `urban-gardener-photos` (urban 0001). No new bucket needed.
- Admin: `web.admin/src/lib/media.ts` (`uploadImage`, ALLOWED_MIME jpeg/png/webp/gif, MAX_SIZE 6 MB, writes media rows); `ImagePickerDialog` in `features/products`. Avocado site settings read/written via `src/lib/avocadoSiteSettings.ts` (used by `AvocadoFooterEditPage`, "Social links (site-wide)"); Urban via `src/lib/ugStatic.ts` + `features/ug-static/UgSiteSettingsPage.tsx`. Pages lists: `AvocadoPagesPage.tsx`, `UgPagesPage.tsx`, routes `PagesRoutes.tsx`.
- Avocado site: logo `public/brand/avocado-kiss-logo.png` (380×168) in `components/Header.tsx` + `components/MobileMenu.tsx`; `app/favicon.ico|icon.png|apple-icon.png` (file-based metadata); JSON-LD `Organization.logo` = `/brand/avocado-kiss-mark-512.png` in `app/layout.tsx`; layout `openGraph` has no images; per-page `openGraph` in `app/page.tsx`, `category/[slug]`, `shop/[category]`, `product/[slug]`, `blog/[slug]`, `recipes/[slug]`. Shell data cached via `fetchLayoutShellCached()` (includes siteSettings). `avocado_kiss.pages.og_image_path` exists (0001) — check whether home uses it; precedence: page's own image > site default > repo fallback.
- Urban site: logo `public/brand/urban-soul-of-plants-logo.png` (279×168) in `components/Header.tsx` (alt = `header_brand`); same `app/` icon files; JSON-LD logo `/brand/urban-soul-of-plants-mark-512.png` in `lib/json-ld.ts`; `lib/seo.ts buildPageMetadata` sets no image when page has none (comment says "no brand OG in public/").
- Both sites ISR `revalidate = 60`.
- Owner source images: workspace root `assets/` (untracked): `avocado-logo.jpeg`, `avocado-favicon.jpeg`, `urban-logo.jpeg`, `urban-favicon.jpeg`, `urban-hero-home-image.jpeg`.

## Data model (both schemas, additive migration each: avocado next number, urban next number)
Add to `site_settings`:
- `logo_path text`, `logo_width int`, `logo_height int` — check: all three null or all set, width/height > 0, path not blank.
- `icon_path text` (512×512 PNG), `icon_apple_path text` (180×180 PNG), `icon_small_path text` (32×32 PNG) — check: all null or all set.
- `og_image_path text` (1200×630 JPEG) — not blank.
Paths are object paths inside the site bucket under `brand/` (e.g. `brand/logo-<timestamp>.png`). No seed (null = repo fallback). Grants: mirror existing pattern of each table (+ explicit column grants to anon if Urban uses column-level). `database-reviewer` + `security-auditor` on the migrations. Apply to base-one only with owner confirmation (guard hook).

## Admin (web.admin)
- New route/page "Brand" under Pages for each site (`AvocadoBrandPage`, `UgBrandPage` or one `BrandSettingsPage` parametrised by site), entry in both Pages lists.
- Shared `BrandAssetField` (upload, preview, hint, "Reset to default" → nulls the columns). Upload path: new `uploadBrandAsset(site, kind, file)` in `src/lib/brand.ts` — uploads to `brand/<kind>-<Date.now()>.<ext>`, does NOT create media rows (so media-library delete cannot break the logo). Old objects are not deleted.
- Accept png/jpeg/webp ≤ 6 MB (reuse constants); no SVG/ICO/GIF.
- Processing in browser via `createImageBitmap` + canvas/OffscreenCanvas:
  - logo: validate width ≥ 240; upload original; store intrinsic width/height.
  - icon: reject non-square or < 512; produce 512, 180, 32 PNG; upload three.
  - og: center-crop cover to 1200×630, JPEG q≈0.85, show preview before save; reject source smaller than 1200×630.
- Keep the pure math (crop rect, validation) in testable functions; canvas itself is not testable in jsdom — mock it.
- Save writes columns in one update; invalidate the site-settings query.

## Sites (avocado.kiss, urban.gardener)
- Loader: extend cached site-settings fetch with brand columns; helper `resolveBrand(settings, bucketPublicUrl)` → `{ logo: {src,width,height}, icons: {small, apple, large}, ogDefault }` with repo fallbacks. Unit-test fallbacks.
- Root layout: switch `metadata` → `generateMetadata` (or add `icons`/`openGraph.images` there) using `resolveBrand`. **File-based `app/icon.png|apple-icon.png|favicon.ico` override config `icons` — move them out of `app/`** (`app/icon.png`, `app/apple-icon.png` → `public/brand/…` fallbacks; `favicon.ico` → `public/favicon.ico` so `/favicon.ico` still answers). Verify current Next 16 behaviour via Context7 before coding.
- Per-page OG: Next replaces `openGraph` wholesale — every page builder that sets `openGraph` must fall back to `ogDefault` when it has no own image (Urban: `buildPageMetadata` gets a `defaultImage`; Avocado: the six pages above + any page without openGraph inherits layout). Twitter card follows the same image.
- JSON-LD `Organization.logo` → `icons.large` (512) absolute URL, fallback mark-512.
- Header (+ Avocado MobileMenu): `next/image` with `resolveBrand().logo` (src/width/height from DB); keep `sizes`, `loading="eager"`, alt unchanged. Confirm `images.remotePatterns` already allows the Supabase storage host.
- Fallback OG files (owner answer): compose `public/brand/og-default.jpg` for each site, 1200×630, owner logo centered on brand background (Avocado `--background`/cream with logo; Urban its page background), from `assets/*-logo.jpeg`. Use a one-off script in scratchpad (sharp via npx is a dependency install → ask; prefer macOS `sips` or a canvas in Playwright browser). Inspect the result visually before commit.

## Tests
- Sites: unit `resolveBrand` (null → fallbacks, set → storage URLs); `buildPageMetadata` default image; Avocado page metadata fallback; Header renders DB logo with given dims.
- Admin: validation/crop math, `BrandAssetField` states (empty/fallback, preview, reject message, reset), save payload.
- 390 px: header logo both sites, admin Brand page.
- e2e not required (no new public flow); propose in report.

## Review gate
`database-reviewer` (migrations), `security-auditor` (grants, storage writes, rendering DB paths into metadata/JSON-LD), `react-reviewer` (one per repo), `seo-specialist` (icons/OG/JSON-LD). `qa-runner`: build + lint + test in 3 repos.

## Docs at end
`platform-docs/database/` schema docs for both `site_settings`; admin-panel docs (Brand page); site docs (`sites/avocado-kiss.md`, `sites/urban-gardener.md` decision log); B-009 → done; workspace `phase-x-checklist.md` lines: favicon/OG visible on prod, Facebook debugger re-scrape, GSC favicon.
