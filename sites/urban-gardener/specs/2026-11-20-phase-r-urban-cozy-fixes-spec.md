# Urban Gardener + CozyCorner — Phase R: client fixes — agent spec

> Owner plan: `../plans/2026-11-20-phase-r-urban-cozy-fixes.md`. Repos: urban.gardener, web.admin, cozycorner, platform-docs.
> Branch `feat/phase-r` in each code repo. Level 3 (migrations + 3 repos) → impl plan per repo before code.

## Decisions (owner, 2026-11-20)
- Delete Levels completely (site, admin, DB).
- Home «From the journal»: Auto (latest 6 articles) / Manual (current slots).
- Home «Plants & everything they need»: Auto (latest products, limit 6 / 9 / 12) / Manual.
- Article text: bold, italic, links like Avocado/Cozy.
- Article can be saved (and published) without author and without read time. Empty read time → computed from the text.
- New article blocks: «Article link» (card with photo) and «Products» (1–3 products in a row).
- Article images a bit lower.
- Admin Urban products: sort by date and by name.
- CozyCorner: bold/italic in post text sections render on the site (6 of 38 `post_text_sections.body` already hold `**`/`*` that show as raw asterisks).
- CozyCorner: About heading wider, fixed in code (no admin setting).

## Agent decisions (listed in the owner plan §4)
- Featured («This week's read») stays manual. Auto journal skips the featured article.
- Auto order = `published_at desc, id desc`, `is_published = true` filtered explicitly in code (no reliance on RLS).
- Both home sections start in **Auto** after release; Auto shop limit default **12** (today = all 9 products).
- Manual shop capacity 3 → 12 (same max as Auto).
- Read time estimate: words of text/heading/callout/list blocks + title/excerpt ÷ 200, ceil, min 1. Manual value wins.
- No author → author row hidden; JSON-LD `author` falls back to the site Organization.
- Rich text in **text** and **callout** bodies: paragraphs, bold, italic, links (safe href, `lib/safeHref` rules), bullet/numbered lists. Headings inside text — no (there is a Heading block).
- Renderer: `react-markdown` (same as Cozy/Avocado), allowedElements + `unwrapDisallowed`, no raw HTML. New dependency in urban.gardener — owner's «+» to the plan = consent to install.
- Cover height `clamp(280px, 42vw, 520px)` → `clamp(220px, 32vw, 400px)`; inline image blocks `3/2` → `16/9`. Check 390 px.
- Admin products sort select: Newest (default), Oldest, Name A–Z, Name Z–A (client-side; list is already loaded whole).
- Cozy About `h1` `max-width: 16ch` → `24ch`; mobile unchanged in practice (column narrower than 24ch).

## Data — urban.gardener

Two migrations: additive before deploy, destructive after deploy (old prod code embeds `levels`).

### `0040_phase_r.sql` (expand; apply on start, old code keeps working)
- `pages`: `journal_mode text not null default 'manual' check in ('auto','manual')`, `shop_mode` same, `shop_limit int not null default 12 check in (6,9,12)`; `update … set journal_mode='auto', shop_mode='auto' where slug='home'`. Check anon grants on `pages` (table-level SELECT → covered; verify).
- `articles.author_id` → nullable (FK unchanged).
- `articles_published_needs_cover_and_read` → cover only (rename to `articles_published_needs_cover`; NOT VALID + VALIDATE).
- `articles.read_minutes_auto int` (nullable, check > 0), filled by `save_article` on every save; backfill for existing rows in the migration (same formula as the RPC; one shared SQL helper `urban_gardener.estimate_read_minutes(article_id)` is fine).
- `article_blocks`: type check + `'article','products'`; `linked_article_id uuid references articles(id) on delete set null`; `product_ids uuid[]` with check `product_ids is null or cardinality(product_ids) between 1 and 3`; per-type check (article ⇒ linked_article_id not null on write — but `set null` on delete must not fail: allow null, site hides the block). Self-link forbidden (`linked_article_id <> article_id`).
- `save_article`: author optional; no read_minutes requirement; writes new block fields; computes `read_minutes_auto`. Keep lock order from 0039. `publish_due_content`: drop the read_minutes condition if present.
- Grants: check column-level anon grants on `articles` / `article_blocks` (0030 introduced column grants for `articles`) — add `read_minutes_auto`, `linked_article_id`, `product_ids` for anon where the table uses column grants.

### `0041_drop_levels.sql` (contract; apply after the new code is on prod)
- Update the search function (latest definition, see 0023 and later) without the `levels` join.
- `save_article`: drop `level_id`.
- `alter table articles drop column level_id; drop table levels` (+ trigger/function `levels_set_slug`, policies go with the table).

## Site — urban.gardener
- Levels: remove `fetchLevels`, level filter (`?level=`), badge on `ArticleCard`, types/fixtures/mappers, search mapping, `/design` sample.
- Home (`lib/home.ts`): read `journal_mode`, `shop_mode`, `shop_limit` from `pages.home`. Auto journal: 6 latest published articles excluding featured. Auto shop: `shop_limit` latest published products. Manual: existing slot logic; `HOME_CAPACITY.shop` = 12. Grid already 3 columns → rows of 3.
- Article body: `TextBlock` / `CalloutBlock` render markdown (new `components/ui/Markdown.tsx` or similar). Plain old text must render the same as before (paragraphs by blank line).
- `ArticleLinkBlock`: card (cover, title, excerpt clamp 2 lines, «Read →»), whole card is one link; hidden if target missing/unpublished. `ProductsBlock`: 1–3 `ProductCard` in a row (1 column at 390 px), unpublished filtered, hidden if empty. Linked data loaded in `fetchArticle` with explicit `is_published` filters; preview mode follows existing preview rules.
- Read time: `read_minutes ?? read_minutes_auto`; if both null — hide. Header, cards, search results.
- Author null: hide `AuthorRow`; JSON-LD fallback.
- Image sizes per agent decisions.
- Tests: mappers, home auto/manual, markdown render (bold/italic/link/unsafe href stripped), new blocks, read time fallback.

## Admin — web.admin
- Remove Urban Levels section (taxonomy nav/route) and the article Level field.
- `ugArticleForm`: author optional («No author»), read time optional with hint «Leave empty — calculated from the text».
- `UgBlocksEditor`: text + callout bodies → `RichTextEditor` with `links`; «Add block» menu + «Article link» (article picker, excludes the current article, shows drafts with a badge) and «Products» (picker, 1–3, reorder/remove).
- `ug-home`: Journal and Shop get an Auto/Manual control like Avocado `HeroModeControl` (preview of what the site shows now); Shop Auto adds a limit select 6/9/12. Manual slots stay saved and dimmed in Auto. Shop manual capacity 12.
- `UgProductsPage`: sort select per agent decisions, combined with existing filters.
- Tests for form schema, block payloads, home modes, sort.

## CozyCorner
- `PostTextSection`: body via `MarkdownText` (allowed p/ul/ol/li/strong/em/br), keep section/paragraph typography (pass className). Check that excerpt/meta/search snippets strip markdown (`lib/markdown.ts stripMarkdown`) where post text is shown as plain text.
- `AboutIntro.module.css`: heading max-width 24ch.

## Docs
- `sites/urban-gardener.md` (decisions log), `admin-panel` Urban docs (home, articles, products), `database/schema.md` (Urban: pages columns, article_blocks, levels removed), Cozy notes if any doc says post text is plain.

## Review gate / verification
- database-reviewer (0040, 0041), security-auditor (RPC, grants, markdown rendering/links), react-reviewer ×1 per repo (urban, web.admin; cozy change is tiny — include in urban's run or skip with note).
- qa-runner: build + lint + test in urban.gardener, web.admin, cozycorner. 390 px: Urban home, article with new blocks, Cozy About + post with bold.
- Live DB checks after each migration: anon can read new columns it needs, cannot read admin-only ones; advisors.
