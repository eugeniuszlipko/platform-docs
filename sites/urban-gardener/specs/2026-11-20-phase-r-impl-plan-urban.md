# Phase R — urban.gardener impl plan (site part)

> Spec: `2026-11-20-phase-r-urban-cozy-fixes-spec.md` ("Site — urban.gardener"). Branch `feat/phase-r`. No commit/push/install/migrations from this plan.
> DB contract: migration 0040 (expand) adds `pages.journal_mode/shop_mode/shop_limit`, `articles.read_minutes_auto`, nullable `author_id`, block types `article`/`products` (`linked_article_id`, `product_ids`); 0041 drops Levels AFTER this code ships, so the site must not touch levels at all.

## T1 — Remove Levels
- `lib/articles.types.ts` / `articles.mappers.ts`: drop `Level`, `LEVEL_COLUMNS`, `rowToLevel`, `level` embed in `ARTICLE_LIST_SELECT`, `levelSlug/levelName` in `ArticleCardData`.
- `lib/articles.ts`: drop `fetchLevels`. `lib/article-utils.ts`: drop `filterByLevel`/`resolveLevel`. `lib/articles.fixtures.ts`: drop `FIXTURE_LEVELS` and per-article level. `lib/search.fixtures.ts`: stop reading level (search itself reads only ids via RPC, `ARTICLE_LIST_SELECT` loses the embed).
- UI: `FilteredArticleGrid` (client level filter) is removed; `ArticleListing` renders a server count + `ArticleGrid`. `ArticleCard` badge, `ArticleTags` level pill, `ArticleHeader` eyebrow, `FeaturedArticle` tag, `SearchResultsPanel` meta, `/design` sample, listing + topic pages (no `fetchLevels`).
- `lib/site.ts`: footer fallback link `/articles?level=beginner` removed.
- Tests/e2e updated accordingly.

## T2 — Home modes
- `home.mappers.ts`: `PAGE_COLUMNS` + `journal_mode, shop_mode, shop_limit`; pure `resolveHomeModes(row)` (fallback manual / 12 on null or bad value) in `home-utils.ts`; `HomeContent` unchanged for the page (modes stay inside the loader).
- `home.ts`: stage 1 = page, article slots (featured+journal), topics in parallel; stage 2 by mode. Auto journal: `articles` (`ARTICLE_LIST_SELECT`, `is_published=true`, `published_at desc, id desc`, limit 7) minus featured slug, first 6. Auto shop: `products` (`CARD_SELECT`, `is_published=true`, same order, `limit shop_limit`). Manual = existing slot logic. `HOME_CAPACITY.shop` 3 → 12. Same `fail`/`console.warn` style.
- `HomeShop` comment updated.

## T3 — Markdown in text + callout
- `lib/markdown.ts`: `stripMarkdown` (plain text for SEO/JSON-LD/snippets), reuses nothing from React.
- `components/ui/Markdown.tsx` (+ module CSS): `react-markdown`, `allowedElements` p/strong/em/a/ul/ol/li/br, `unwrapDisallowed`, `urlTransform` via the existing `isSafeHref` (only `/path`, `https://`, `mailto:` — reuse wins over the spec's "http"; `http://` links render as plain text and are logged), external links `target=_blank rel="noopener noreferrer"`. Optional `paragraphClassName` for `lead` / callout paragraphs.
- `TextBlock` / `CalloutBlock` use it; lists/links styles in `ArticleBody.module.css`.
- `articleSeoDescription` strips markdown.

## T4 — New blocks
- Types: `article` (`linkedArticleId`, resolved `article: ArticleCardData | null`), `products` (`productIds`, resolved `products`). `rowToBlock` parses new columns; resolution is a separate pure `attachLinked`.
- `lib/articles.ts`: `fetchLinked` — one batched query per kind with explicit `is_published=true`, anon client (also for preview: published only). Skipped when no ids. Used by `fetchArticleBySlug` and `fetchArticleForPreview`.
- `ArticleLinkBlock`, `ProductsBlock` + CSS; `ArticleBody` dispatches; both return null when nothing resolved.

## T5 — Read time + author
- `PUBLIC_ARTICLE_COLUMNS` + `read_minutes_auto`; mapper `readMinutes = read_minutes ?? read_minutes_auto`; hidden when null (already conditional in components; check header/cards/featured/search).
- `author` nullable (type, mapper no longer throws on null embed; array embed still throws), `AuthorRow` not rendered; `FeaturedArticle.authorName` null; JSON-LD `author` → Organization `{ '@id': siteUrl/#organization }` fallback; meta `authors` omitted.

## T6 — Image sizes
- `ArticleCover` `clamp(220px, 32vw, 400px)`; `ImageBlock` aspect-ratio 16/9.

## T7 — Tests + verification
- Update/add: mappers, home auto/manual (featured exclusion, limit), markdown (bold/italic/link/unsafe href/old plain text), blocks incl. hidden, read-time fallback, null author, JSON-LD fallback, fetchLinked queries. `npm test`, `npm run lint`, `npm run build`.

## Done / deviations (filled after execution)
- Build found: since 0040 `article_blocks` has TWO FKs to `articles`, so the bare `article_blocks(...)` embed fails with PGRST201; `ARTICLE_DETAIL_SELECT` now uses `article_blocks:article_blocks!article_blocks_article_id_fkey(...)`. Old prod code and web.admin embeds without the hint break while 0040 is live.
- Author null: header keeps "N min read · May 2026" without avatar/name (not hidden entirely).
- Footer fallback link "For beginners → /articles?level=beginner" replaced by "All articles → /articles" in `lib/site.ts`.
