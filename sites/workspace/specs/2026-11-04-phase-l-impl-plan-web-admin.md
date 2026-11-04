# Phase L — web.admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans (native, recommended) or subagent-driven-development. Steps use checkbox syntax.

**Goal:** A "Brand" page under Pages for avocado_kiss and urban_gardener where the admin uploads a logo, one square site icon (derived to 512/180/32) and a default OG image, and can reset each to the repo default.

**Architecture:** Pure validation/crop math in `lib/brandImage.ts` (unit-tested) → browser processing with `createImageBitmap` + canvas in `lib/brandProcess.ts` (mocked in tests) → data layer `lib/brand.ts` (read/update `site_settings`, upload to `brand/…` in the site bucket, no `media` rows) → one UI page `BrandPage` built from `BrandAssetField`. Both sites share the code; the site comes from `useOutletContext<SiteConfig>()`. Both schemas accept a direct `update` on `site_settings` (admin RLS), as `lib/avocadoSiteSettings.ts` already does; Urban's `save_site_settings` RPC is not involved.

**Tech Stack:** Vite 8 + React 19, TanStack Query, supabase-js, Vitest + RTL, shadcn `ui/*`.

**Spec:** [2026-11-04-phase-l-brand-from-admin-spec.md](./2026-11-04-phase-l-brand-from-admin-spec.md). Depends on the migrations in the [avocado](./2026-11-04-phase-l-impl-plan-avocado-kiss.md) and [urban](./2026-11-04-phase-l-impl-plan-urban-gardener.md) plans being applied before manual testing (code and tests do not need them).

## Global Constraints
- Branch `feat/brand-from-admin`; local commits only.
- Accept `image/png`, `image/jpeg`, `image/webp`, ≤ 6 MB (same as `lib/media.ts`); no SVG/ICO/GIF.
- Logo: width ≥ 240 px; original uploaded as is; store intrinsic `logo_width`/`logo_height`. Icon: square and ≥ 512; outputs PNG 512, 180, 32. OG: source ≥ 1200×630; centre-cover crop to 1200×630, JPEG quality 0.85.
- Object keys: `brand/<part>-<Date.now()>.<ext>` (`part` ∈ `logo|icon|icon-apple|icon-small|og`; `ext` ∈ `png|jpg|webp` taken from the real MIME type, must satisfy the DB CHECK `^brand/[A-Za-z0-9][A-Za-z0-9_-]*\.(png|jpe?g|webp)$`), uploaded with `upsert: false` and an explicit `contentType`; no `media` row; old objects are never deleted.
- Column names (both schemas): `logo_path, logo_width, logo_height, icon_path, icon_apple_path, icon_small_path, og_image_path`.
- Error text in English (UI language of the admin).

## Review Focus
- Non-square, too-small, wrong-type and oversized files are rejected with a message naming the rule and the actual size; the previous value is untouched.
- Upload succeeds for 2 of 3 icon sizes then fails → nothing is written to the row (no half icon set), error shown.
- Image that cannot be decoded (`createImageBitmap` throws, e.g. renamed `.txt`) → readable error, not a crash.
- Double click on Save → one update (button disabled while pending).
- "Reset to default" nulls the whole group (logo triple / icon triple), asks no confirmation but is undoable only by re-uploading — label says so.

---

### Task 1: Validation and crop math (red-first, pure)

**Files:** Create `src/lib/brandImage.ts`, `src/lib/brandImage.test.ts`.

**Interfaces — Produces:**
```ts
export type Size = { width: number; height: number };
export const BRAND_MIME: readonly string[];            // png, jpeg, webp
export const BRAND_MAX_BYTES = 6 * 1024 * 1024;
export function validateBrandFile(f: { type: string; size: number }): string | null;
export function validateLogo(s: Size): string | null;  // width >= 240
export function validateIcon(s: Size): string | null;  // square and >= 512
export function validateOg(s: Size): string | null;    // >= 1200x630
export function coverCrop(src: Size, target: Size): { sx: number; sy: number; sw: number; sh: number }; // centred, integer values
```
Each validator returns `null` when OK, otherwise a message like `Icon must be square — this file is 800×600.`

- [ ] **Step 1: Failing tests:** `validateBrandFile` rejects `image/svg+xml`, `image/x-icon`, `image/gif`, 6 MB + 1 byte; accepts png at exactly 6 MB. `validateIcon({512,512})` null; `{511,511}` and `{800,600}` error (message contains `800×600`). `validateLogo({239,100})` error, `{240,100}` null. `validateOg({1199,630})` and `{1200,629}` error. `coverCrop({2000,1000},{1200,630})` → full height crop width 1905 (`sw = round(1000*1200/630)`), centred `sx = round((2000-sw)/2)`; `coverCrop({1200,2000},{1200,630})` → `sw=1200, sh=630, sy=round((2000-630)/2)`.
- [ ] **Step 2:** `npm test -- src/lib/brandImage.test.ts` → FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5: Commit** `feat(brand): image validation and crop math`.

### Task 2: Processing and data layer

**Files:** Create `src/lib/brandProcess.ts`, `src/lib/brand.ts`, `src/lib/brand.test.ts`.

**Interfaces:**
```ts
// brandProcess.ts — canvas side (mocked in tests)
export type BrandKind = "logo" | "icon" | "og";
export type Processed = { kind: BrandKind; previewUrl: string; parts: { key: "logo"|"icon"|"icon-apple"|"icon-small"|"og"; blob: Blob; ext: "png"|"jpg"; width: number; height: number }[] };
export async function processBrandFile(kind: BrandKind, file: File): Promise<Processed>; // throws Error(userMessage) on validation/decode failure

// brand.ts
export type BrandSettings = { id: string; logo_path: string|null; logo_width: number|null; logo_height: number|null; icon_path: string|null; icon_apple_path: string|null; icon_small_path: string|null; og_image_path: string|null };
export const brandKey = (site: SiteConfig) => ["brand", site.slug] as const;
export function brandPublicUrl(site: SiteConfig, path: string): string;
export function resetPatch(kind: BrandKind): Partial<Omit<BrandSettings, "id">>;   // all columns of the group → null
export async function getBrandSettings(site: SiteConfig): Promise<BrandSettings | null>;
export async function saveBrand(site: SiteConfig, id: string, pending: Processed[]): Promise<BrandSettings>;
```
`saveBrand`: uploads every part of every pending item (all uploads first); only if all succeed builds one patch (logo → path+width+height; icon → three paths; og → path) and does a single `.update(patch).eq("id", id)`; on any upload failure removes the objects already uploaded in this call and throws. `getBrandSettings` selects the 8 columns ordered by `created_at`, `limit(1).maybeSingle()`.

- [ ] **Step 1: Tests** (`brand.test.ts`, supabase mocked like `avocadoSiteSettings` callers): `resetPatch("icon")` → three nulls; `resetPatch("logo")` → path/width/height null; `saveBrand` with icon of 3 parts → 3 uploads with keys matching `^brand/icon(-apple|-small)?-\d+\.png$`, then exactly one `update` containing the three paths; with the second upload rejecting → zero `update` calls and the first object removed; `brandPublicUrl` builds `…/storage/v1/object/public/<site.bucket>/<path>`.
- [ ] **Step 2:** run → FAIL; **Step 3:** implement `brand.ts` and `brandProcess.ts` (in `processBrandFile`: check `validateBrandFile`, `createImageBitmap(file)`, run the kind's validator on bitmap size, draw to `OffscreenCanvas` or `document.createElement("canvas")` fallback, `toBlob`; logo returns the original `file` as the single part with intrinsic size; `previewUrl` via `URL.createObjectURL`). **Step 4:** PASS + `npm run lint`.
- [ ] **Step 5: Commit** `feat(brand): brand settings data layer and image processing`.

### Task 3: `BrandAssetField`

**Files:** Create `src/features/pages/BrandAssetField.tsx`, `src/features/pages/BrandAssetField.test.tsx`.

**Interfaces — Produces:**
```tsx
type Props = {
  label: string; hint: string;                 // e.g. "Square PNG/JPEG/WebP, at least 512×512"
  currentUrl: string | null;                   // DB value URL, or null = using the repo default
  pending: Processed | null;                   // chosen but not saved
  error: string | null;
  disabled?: boolean;
  onPick: (file: File) => void;
  onReset: () => void;                         // "Reset to default"
};
export function BrandAssetField(props: Props): JSX.Element;
```
Shows preview (pending → `pending.previewUrl`; else current; else text "Using the built-in default"), a labelled file input (`accept` from `BRAND_MIME`), the hint, the error in `role="alert"`, and a "Reset to default" button (hidden when `currentUrl` is null and nothing pending; its text says "re-upload to undo").

- [ ] **Step 1:** Tests via `test-engineer` by this spec: empty state text; preview from `pending`; error rendered with `role="alert"`; picking a file calls `onPick`; reset calls `onReset`; reset hidden in the empty state.
- [ ] **Step 2:** implement with existing `ui/*` primitives and Tailwind; touch targets ≥ 44 px; works at 390 px. **Step 3:** tests PASS. **Step 4: Commit** `feat(brand): BrandAssetField component`.

### Task 4: `BrandPage`, routes, entries

**Files:** Create `src/features/pages/BrandPage.tsx`, `BrandPage.test.tsx`; Modify `src/features/pages/PagesRoutes.tsx` (export `BrandRoute`: avocado or urban → `<BrandPage />`, otherwise `<Navigate>` to the list), `src/lazyPages.ts` (lazy `BrandRoute`), `src/App.tsx` (`<Route path="pages/brand" element={<BrandRoute />} />`), `src/features/pages/AvocadoPagesPage.tsx` and `UgPagesPage.tsx` (pinned "Brand" link next to existing "Footer & socials" / "Site settings", tag `global`, subtitle "logo, icon, social image"), `PagesRoutes.test.tsx`, `UgPagesPage.test.tsx`.

**Interfaces — Consumes:** `getBrandSettings`, `saveBrand`, `resetPatch`, `brandPublicUrl`, `processBrandFile`, `BrandAssetField`. Local state: `pending: Partial<Record<BrandKind, Processed>>`, `errors: Partial<Record<BrandKind, string>>`.

- [ ] **Step 1:** Build the page: three `BrandAssetField`s (Logo, Site icon, Social image), one Save button (disabled while saving or when no pending items), query `brandKey(site)` invalidated on success; a mutation for save and one for reset (reset writes `resetPatch(kind)` via the same `.update`, success toast "Reset — the site shows the built-in default within a minute"). Save success toast: "Saved — the site updates within a minute."
- [ ] **Step 2: Tests** (mock `brand.ts` and `brandProcess.ts`): renders three fields; picking a valid file enables Save and shows preview; invalid file shows the message and keeps Save disabled; Save calls `saveBrand` once with the pending items; reset calls update with `resetPatch`; Pages lists show the "Brand" link for both sites; route redirects for cozycorner.
- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run build` green. **Step 4: Commit** `feat(brand): Brand page for avocado and urban`.

### Task 5: Verification and review
- [ ] `qa-runner`: build + lint + test, exit 0.
- [ ] Browser at 390 px and desktop (Playwright MCP): Brand page of both sites; with the migrations applied, upload a test logo/icon/OG on each site, check the public site within ~60 s, then reset all three. (Needs a signed-in admin session — ask the owner to sign in if the browser is not authenticated.)
- [ ] Review gate: `react-reviewer`, `security-auditor` (upload path: file type checked client-side only — storage policy limits writes to admins; no SVG), `a11y-architect` (file inputs, alerts, focus after error).
