# Urban Gardener — Фаза 4 (Home), репо `urban.gardener`: impl-план (4A–4C + тесты сайта)

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (выбрано: 9 последовательных задач в одном репо, интерфейсы держу в одном контексте; цена ошибки в БД закрыта ревью-гейтом в Task 6 и Task 8). Шаги — чекбоксы `- [ ]`.

**Goal:** настоящая главная `/` Urban Gardener: hero → пилюли тем → «This week's read» → «From the journal» → «Plants & everything they need» → блок рассылки (неактивный); сначала на фикстурах (4A), затем таблицы `pages`/`home_slots` + RPC (4B), затем сайт читает Supabase (4C).

**Architecture:** страница `app/page.tsx` тонкая: `fetchHomePage()` + композиция секций. Весь доступ к данным — `lib/home.ts` (в 4A тело на фикстурах, в 4C на Supabase, сигнатура та же). Чистая логика (разбор заголовка, фолбэки, ёмкость, дедуп featured/journal, SEO) — `lib/home-utils.ts`. Карточки статей/товаров переиспользуются (`ArticleCard`/`ArticleGrid`, `ProductList`/`ProductCard`), embed'ы — `ARTICLE_LIST_SELECT` и `CARD_SELECT`.

**Tech Stack:** Next.js 16 (читать `node_modules/next/dist/docs/` перед API), React 19, Supabase JS, CSS Modules + токены `globals.css`, Vitest + RTL, Playwright (порт 3200).

**Spec:** `platform-docs/sites/urban-gardener/specs/2026-10-16-phase-4-home-spec.md` (решения H1–H4 — источник истины). Админка (4D) — **отдельный impl-план `…-impl-plan-admin.md` после «утверждаю» владельца на описание экрана**; в этот план не входит. 4F (ревью-гейт целиком + документация) — после 4D.

## Global Constraints

- UI на английском; документация на русском; никакого hex вне `:root` — только `var(--token)`; новая величина → новый токен.
- Страница `/`: SSG + `export const revalidate = 60`, **нет `searchParams`**, **нет `loading.tsx`**. Один `h1` (hero); секции — `h2`; карточки внутри секций и featured — `h3`.
- Hero-заголовок из БД: только безопасный разбор (`*акцент*` → `<em>`-подобный span, `\n` → `<br>`), **никакого `dangerouslySetInnerHTML`**; незакрытая `*` выводится как есть.
- Ёмкость: `featured` 1, `journal` 6, `shop` 3 — сайт рисует первые N по `position`. Пустой слот → секция не рендерится (без пустых заголовков и дыр). Пустой список тем → ряд пилюль скрыт.
- Статья из `featured` в `journal` не показывается (дедуп на сайте), ёмкость journal считается после дедупа.
- Блок рассылки: `input` и `button` `disabled`, `aria-disabled="true"`, подпись «Subscribe — coming soon», **не `<form>` и без `action`**.
- Публичные колонки — явными списками; ошибка Supabase → `throw` через `fail()` (ISR сохраняет прошлую страницу); пустой слот — не ошибка. Embed'ы `articles!inner(...)`/`products!inner(...)` + `.eq('is_published', true)` и на слот, и на embed.
- Миграции: uuid, `created_at`/`updated_at` + триггер, `check (btrim(...) <> '')`, `revoke truncate, references, trigger … from anon, authenticated` (урок 0010), явные политики, `security invoker` + `set search_path = ''` у RPC.
- Картинки: `resolveImage(path, width)`; внешние Unsplash — `unoptimized`; featured — `preload`.
- URL-ы CozyCorner/Avocado не трогать. Не `rm -rf .next`, не запускать второй `next dev`. Коммиты — локальные, на `feat/home`; push/merge — только по команде. Документы `platform-docs` не коммитить.
- «Готово» каждой задачи: `npm run lint` + `npx tsc --noEmit` + `npm test` зелёные; `npm run build` — в задачах страницы/метаданных и в конце.

## Review Focus

1. Слот `shop`/`journal` ссылается на статью/товар-**черновик** (или скрытая `is_published=false` карточка) → на сайте не виден и не ломает вёрстку (запрос с двумя фильтрами + тест маппера на «embed = null»).
2. Hero-заголовок с `<script>`, `**`, одинокой `*`, пустыми `**`, `\r\n`, только пробелами → вывод без HTML-инъекции, без падения; пустая/null колонка → фолбэк-константа.
3. Все слоты пусты (свежая БД, всё удалено) → отображаются hero, пилюли и блок рассылки; нет пустых заголовков секций; `/` отвечает 200.
4. Статья одновременно в `featured` и `journal` (БД допускает) → в журнале её нет; журнал из 6 строк с дублем показывает 5.
5. Ошибка Supabase при ревалидации → `throw` (не «пустая главная» в ISR-кэше); RLS молча отфильтровал слоты (слотов ноль при ненулевом числе опубликованных статей) → `console.warn`.

## File Structure

- `lib/home.types.ts`, `lib/home-utils.ts` (+test), `lib/home.fixtures.ts`, `lib/home.ts` (загрузчик), `lib/home.mappers.ts` (+test, 4C)
- `components/home/` — `Hero`, `HeroLeaf`, `FeaturedArticle`, `HomeJournal`, `HomeShop`, `HomeTip`, `NewsletterPlaceholder`; у каждого свой `.module.css`
- Правки: `components/articles/TopicPills.tsx` (проп `withAll`), `app/page.tsx`, `app/page.module.css`, `app/page.test.tsx`
- `supabase/migrations/0012_home_tables.sql`, `0013_seed_home.sql`, `0014_save_home_page_rpc.sql`
- `e2e/home.spec.ts`

### Task 1: Ветки и базовая линия

**Files:** — (git)

- [ ] **Step 1:** в `urban.gardener` и `web.admin` (чистый `main`): `git switch -c feat/home`. В `web.admin` ветка нужна к 4D, создаю сразу.
- [ ] **Step 2:** в `urban.gardener`: `npm test && npm run lint && npx tsc --noEmit` — записать число пройденных тестов как базовую линию.

### Task 2: Типы и чистая логика (red-first)

**Files:** Create `lib/home.types.ts`, `lib/home-utils.ts`; Test `lib/home-utils.test.ts`

**Interfaces — Produces** (`lib/home.types.ts`):
```ts
export type HomeSlot = 'featured' | 'journal' | 'shop'
export type HeroSegment = { text: string; accent: boolean } | { br: true }
export type HomePageTexts = { heroEyebrow: string; heroTitle: string; heroDescription: string; seoTitle: string | null; seoDescription: string | null }
export type FeaturedArticleData = ArticleCardData & { authorName: string | null }
export type HomeContent = { page: HomePageTexts; topics: Pick<Topic, 'name' | 'slug'>[]; featured: FeaturedArticleData | null; journal: ArticleCardData[]; shop: ProductCardData[] }
export const HOME_CAPACITY: Record<HomeSlot, number> = { featured: 1, journal: 6, shop: 3 }
```
**Produces** (`lib/home-utils.ts`): `parseHeroTitle(raw: string): HeroSegment[]` · `HERO_FALLBACK: { eyebrow; title; description }` (константы референса: «A journal of houseplant care» / «Plant care that\nactually *makes sense*» / «Clear, jargon-free guides on watering, light and repotting — so the plants in your home live long, healthy lives.») · `resolveHomeTexts(row: { hero_eyebrow: string|null; hero_title: string|null; hero_description: string|null; seo_title: string|null; seo_description: string|null } | null): HomePageTexts` · `capSlot<T>(slot: HomeSlot, items: readonly T[]): T[]` · `dedupeJournal(featured: {slug: string} | null, journal: readonly ArticleCardData[]): ArticleCardData[]` · `homeSeoTitle(p: HomePageTexts): { absolute: string } | null` (null → дефолт layout) · `homeSeoDescription(p: HomePageTexts): string` (фолбэк `SITE_DESCRIPTION` из `lib/site.ts`) · `toFeatured(a: Article): FeaturedArticleData` (`toCard` + `authorName`).

- [ ] **Step 1: падающие тесты** (`lib/home-utils.test.ts`):
  - `parseHeroTitle('Plant care that\nactually *makes sense*')` → `[{text:'Plant care that',accent:false},{br:true},{text:'actually ',accent:false},{text:'makes sense',accent:true}]`.
  - `parseHeroTitle('A *b* c *d*')` → два акцента; `parseHeroTitle('no markup')` → один не-акцентный сегмент.
  - Незакрытая `*`: `parseHeroTitle('half *open')` → текст `'half *open'` одним не-акцентным сегментом (звёздочка сохранена).
  - `parseHeroTitle('a ** b')` (пустой акцент) → `'a ** b'` как есть; `parseHeroTitle('<script>x</script> *y*')` → `'<script>x</script> '` обычным текстом (экранирует React, парсер HTML не знает) и акцент `y`.
  - `\r\n` и `\n` оба дают `{br:true}`; `parseHeroTitle('')` и `'   '` → `[]`.
  - `resolveHomeTexts(null)` и строка с `null`/пустыми/пробельными полями → фолбэки `HERO_FALLBACK`; заданное значение побеждает; `seoTitle`/`seoDescription` пустые → `null`.
  - `capSlot('journal', [1..9])` → первые 6; `capSlot('featured', [a, b])` → `[a]`; `capSlot('shop', [])` → `[]`.
  - `dedupeJournal({slug:'a'}, [a,b,c])` → `[b,c]`; `dedupeJournal(null, [a])` → `[a]`; порядок сохраняется.
  - `homeSeoTitle({seoTitle:null,…})` → `null`; `{seoTitle:'X'}` → `{absolute:'X'}`; `homeSeoDescription` с `null` → `SITE_DESCRIPTION`.
- [ ] **Step 2:** `npx vitest run lib/home-utils.test.ts` → FAIL (модуль не найден).
- [ ] **Step 3:** реализовать по сигнатурам. `parseHeroTitle`: нормализовать `\r\n`→`\n`, делить по `\n`, внутри строки регэкспом `/\*([^*\n]+)\*/g` (непустой акцент без `*` внутри); пробельный/пустой вход → `[]`; соседние не-акцентные куски не склеивать между строками (`br` — отдельный сегмент).
- [ ] **Step 4:** тот же запуск → PASS. **Step 5:** `git commit -m "feat(home): types and pure home logic"`.

### Task 3: Фикстуры, загрузчик на фикстурах, правка `TopicPills`

**Files:** Create `lib/home.fixtures.ts`, `lib/home.ts`; Modify `components/articles/TopicPills.tsx` (+ `TopicPills.test.tsx`)

**Interfaces — Consumes:** `FIXTURE_ARTICLES`, `FIXTURE_TOPICS` (`lib/articles.fixtures.ts`), `SHOP_PRODUCTS` (`lib/shop.fixtures.ts`), `toFeatured`, `capSlot`, `dedupeJournal`, `toCard` (`lib/article-utils.ts`), `toProductCard` (`lib/shop-utils.ts`). **Produces:** `export const fetchHomePage = cache(async (): Promise<HomeContent>)` в `lib/home.ts`; `HOME_FIXTURE: HomeContent` в `lib/home.fixtures.ts` (featured = статья `how-to-tell-when-a-plant-needs-water-and-when-to-wait`; journal = 6 следующих свежих; shop = Monstera Deliciosa, Golden Pothos, Snake Plant; page = `resolveHomeTexts(null)`).

- [ ] **Step 1:** `TopicPills`: добавить необязательный проп `withAll?: boolean` (по умолчанию `true`, поведение не меняется); при `false` пункт «All» не рендерится, `currentSlug` игнорируется для него. Тест в `TopicPills.test.tsx`: `withAll={false}` → нет ссылки «All», темы на месте; без пропа — «All» есть.
- [ ] **Step 2:** создать `lib/home.fixtures.ts`; в `lib/home.ts` в 4A тело возвращает `HOME_FIXTURE` (шапка файла: «в 4C заменяется чтением Supabase»).
- [ ] **Step 3:** `npx vitest run components/articles/TopicPills.test.tsx` → PASS. **Step 4:** commit `feat(home): fixtures, fixture-backed loader, TopicPills withAll`.

### Task 4: Компоненты главной (4A)

**Files:** Create `components/home/{Hero,HeroLeaf,FeaturedArticle,HomeJournal,HomeShop,HomeTip,NewsletterPlaceholder}.tsx` + `.module.css`; Test: компонентные тесты в Task 8

**Interfaces — Produces:**
- `Hero({ texts }: { texts: Pick<HomePageTexts,'heroEyebrow'|'heroTitle'|'heroDescription'> })` — `<section>` с `Eyebrow`, `<h1>` из `parseHeroTitle` (акцент — `<span className={styles.accent}>` цвета `--leaf`, не курсив), `<p lead>`, `<HeroLeaf aria-hidden />` (SVG референса строки 360–378, градиенты через `var(--leaf-front-*)`/`var(--leaf-back-*)`; id градиентов уникальны через `useId` либо без внутренних `<defs>` id-конфликтов).
- `FeaturedArticle({ article }: { article: FeaturedArticleData })` — сетка `1.15fr 1fr` (≤ 920px — колонка), `h3`, `Tag` «тема · уровень», excerpt, «автор · N min read», «Read the article →»; вся карточка — растянутая ссылка на `/articles/<slug>` с именем = заголовок; `next/image` с `preload`, `sizes="(max-width: 920px) 100vw, 55vw"`.
- `HomeJournal({ articles }: { articles: readonly ArticleCardData[] })` — `SectionHead` «From the journal» + ссылка `{ href: '/articles', label: 'All articles' }` + `ArticleGrid headingLevel={3}`; пустой массив → `null`.
- `HomeShop({ products }: { products: readonly ProductCardData[] })` — `SectionHead` «Plants & everything they need» + `{ href: '/shop', label: 'Visit the shop' }` + `ProductList headingLevel={3}`; пустой → `null`.
- `HomeTip()` — `TipBlock` с заголовком «One <em>care tip</em> in your inbox every Saturday» и текстом «What to water, feed and watch for this week — no spam, no filler.» + `NewsletterPlaceholder` (в слот `children`).
- `NewsletterPlaceholder()` — не форма: `<div>` с `label`-связанным `input type="email" disabled`, `button disabled aria-disabled="true"` «Subscribe», подпись «Subscribe — coming soon» (виден текст, `id` для `aria-describedby`).

- [ ] **Step 1:** реализовать компоненты по интерфейсам; стили сверять с `mockups/Urban Gardener.html` (`.hero` стр. 73–83, `.cats` 86–88, `.featured` 99–111, `.tip` 159–167); новые значения → токены в `globals.css`. Паттерны вёрстки — как у `ArticleListing`/`CategoryGrid`.
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint` → чисто. **Step 3:** commit `feat(home): home section components`.

### Task 5: Страница `/` и визуальная сверка (4A)

**Files:** Modify `app/page.tsx`, `app/page.module.css`, `app/page.test.tsx`

- [ ] **Step 1:** `app/page.tsx` — `export const revalidate = 60`; `const home = await fetchHomePage()`; композиция: `<Hero texts>` → пилюли тем (обёртка `.cats` с `<TopicPills topics currentSlug={null} withAll={false}/>`, только если `topics.length`) → секция «This week's read» (`SectionHead` без ссылки + `FeaturedArticle`, только если `featured`) → `HomeJournal` → `HomeShop` → `HomeTip`. `generateMetadata` пока возвращает `{ alternates: { canonical: '/' } }` (в 4C — из БД). `app/page.module.css` — заменить на стили обёрток.
- [ ] **Step 2:** `app/page.test.tsx` — переписать под новую страницу: мок `@/lib/home` (`fetchHomePage` → `HOME_FIXTURE`), ожидания: один `h1`, 3 `h2` секций + tip, «Subscribe — coming soon».
- [ ] **Step 3:** `npm test && npm run lint && npx tsc --noEmit && npm run build` → зелёные; страница `/` в build выводится как static (○/●), не динамическая.
- [ ] **Step 4:** визуальная сверка в браузере (Playwright MCP) на уже работающем `next dev` (не запускать второй) — 1280 и 390: hero с листом, пилюли, featured (на 390 колонкой), журнал 6, магазин 3, tip; нет горизонтального скролла; сравнить с референсом. Расхождения исправить.
- [ ] **Step 5:** commit `feat(home): home page on fixtures (4A)`.

### Task 6: Миграции 0012–0014 и проверка прав (4B)

**Files:** Create `supabase/migrations/0012_home_tables.sql`, `0013_seed_home.sql`, `0014_save_home_page_rpc.sql`

**Interfaces — Produces (БД):** таблицы `urban_gardener.pages`, `urban_gardener.home_slots`; RPC `urban_gardener.save_home_page(p_page_id uuid, p_page jsonb, p_slots jsonb) returns jsonb` (поля и правила — спека, «Модель данных»). `p_page` ключи: `seo_title, seo_description, hero_eyebrow, hero_title, hero_description`; `p_slots`: массив `{ id?: uuid, slot, article_id?, product_id?, is_published }`, порядок массива = порядок `position` (плотный, внутри каждого slot с 0).

- [ ] **Step 1: 0012.** `pages` (check `slug in ('home','about','contact','privacy','terms')`, unique slug, `updated_at`-триггер, RLS: «Public read pages» `using (true)`, «Admin all pages»); `home_slots` (check согласованности slot↔article/product и `num_nonnulls = 1`; partial unique индексы `(slot, article_id)`, `(slot, product_id)`; индексы `(slot, position)`, `article_id`, `product_id`; RLS anon: `is_published` и `exists` опубликованной статьи/товара; «Admin all home_slots»); гранты: `select` anon, `all` authenticated/service_role, затем `revoke truncate, references, trigger … from anon, authenticated`. Образец — 0007 + 0010.
- [ ] **Step 2: 0013.** Идемпотентный сид по slug'ам/именам, `on conflict do nothing`/`where not exists`: `pages.home` с текстами референса (h1 с настоящим переводом строки: `E'Plant care that\nactually *makes sense*'`); слоты по спеке (featured = статья `how-to-tell-when-a-plant-needs-water-and-when-to-wait`, journal = 6 самых свежих опубликованных кроме featured, shop = Monstera Deliciosa / Golden Pothos / Snake Plant) с фолбэками «самые свежие», если нужного нет; миграция не падает на пустой БД.
- [ ] **Step 3: 0014.** `save_home_page`: `security invoker`, `set search_path = ''`, `grant execute … to authenticated, service_role`, `revoke … from public, anon`; обновляет `pages` (0 строк → `P0002`); пересобирает слоты (diff по `id`: удалить отсутствующие, обновить существующие, вставить новые; плотные позиции; чужой slot / несоответствие article↔product → `23514`; дубль в слоте → `23505` с понятным текстом); возвращает `jsonb` со сводкой (`{ page_id, slots: n }`). Образец — `0006`/`0009`.
- [ ] **Step 4: применить** по очереди через Supabase MCP (`apply_migration`; проект — по `list_projects`, тот же, что в Фазе 3), затем `get_advisors` (security + performance) — новых предупреждений по `pages`/`home_slots` быть не должно.
- [ ] **Step 5: проверка прав SQL** (метод — `plans/2026-10-15-phase-3-kickoff.md`: `begin; set_config('request.jwt.claims', …); set local role …; …; rollback;`, ошибки отдельными запросами): (a) anon: читает `pages.home`; видит только слоты с `is_published` опубликованных статей/товаров; `insert/update/delete` в обе таблицы и `save_home_page` — отказ; (b) authenticated не-админ (несуществующий `sub`): запись и RPC — отказ; (c) админ: RPC собирает слоты (журнал 6, shop 3, featured 1), повтор с теми же `id` идемпотентен; slot `'nope'` → `23514`; `shop`-слот с `article_id` → `23514`; дубль статьи в слоте → `23505`; (d) черновик статьи в слоте: anon его не видит, админ видит; (e) `delete` статьи, стоящей в слоте → строка слота исчезла (каскад).
- [ ] **Step 6:** ревью — субагент `database-reviewer` (только читает); CRITICAL/HIGH исправить следующей миграцией (`0015_…`) или вынести владельцу. Commit `feat(db): pages, home_slots, save_home_page (4B)`.

### Task 7: Сайт читает базу (4C)

**Files:** Create `lib/home.mappers.ts`, `lib/home.mappers.test.ts`; Modify `lib/home.ts`, `app/page.tsx` (`generateMetadata`)

**Interfaces — Produces** (`lib/home.mappers.ts`): `PAGE_COLUMNS = 'slug, seo_title, seo_description, hero_eyebrow, hero_title, hero_description'` · `SLOT_ARTICLE_SELECT = \`slot, position, is_published, article:articles!inner(${ARTICLE_LIST_SELECT})\`` · `SLOT_PRODUCT_SELECT = \`slot, position, is_published, product:products!inner(${CARD_SELECT})\`` · типы `PageRow`, `ArticleSlotRow`, `ProductSlotRow` · `rowsToFeatured(rows): FeaturedArticleData | null` · `rowsToJournal(rows): ArticleCardData[]` · `rowsToShop(rows): ProductCardData[]` (сортировка по `position`; embed = `null` или массив → `throw` с названием слота; `rowToArticle`/`toCard`/`rowToCardData` переиспользуются).

- [ ] **Step 1: падающие тесты маппера** (чистая логика): сортировка по `position`; embed `null` → бросает; embed-массив → бросает; `rowsToFeatured([])` → `null`; два ряда в featured → первый по position; `authorName` берётся из `article.author.name`.
- [ ] **Step 2:** `npx vitest run lib/home.mappers.test.ts` → FAIL; реализовать → PASS.
- [ ] **Step 3:** `lib/home.ts`: `fetchHomePage` = `cache(async …)`, три запроса параллельно (`pages` где `slug='home'` `maybeSingle`; слоты статей `.in('slot',['featured','journal']).eq('is_published', true).eq('article.is_published', true)`; слоты товаров `.eq('slot','shop').eq('is_published', true).eq('product.is_published', true)`) + `fetchTopics()` из `lib/articles.ts`; каждая ошибка → `fail(...)`; склейка: `resolveHomeTexts`, `capSlot`, `dedupeJournal`, затем `capSlot('journal', …)`. Если слотов ноль, а опубликованных статей в БД > 0 — `console.warn('[home] no visible slots…')` (дешёвый `count`-запрос только в этой ветке). Фикстуры из `lib/home.ts` убрать (остаются для тестов/сида).
- [ ] **Step 4:** `generateMetadata` в `app/page.tsx`: `const { page } = await fetchHomePage()`; `{ title: homeSeoTitle(page) ?? undefined, description: homeSeoDescription(page), alternates: { canonical: '/' } }`.
- [ ] **Step 5:** `npm test && npm run lint && npx tsc --noEmit && npm run build` → зелёные; в браузере `/` совпадает с сидом (featured «How to tell when a plant needs water…», 6 журнал, 3 растения); в БД временно отметить слот `is_published=false` → после ревалидации (≤ 60 с) карточка исчезла, вернуть обратно.
- [ ] **Step 6:** ревью — субагент `silent-failure-hunter` на `lib/home*.ts`; CRITICAL/HIGH исправить. Commit `feat(home): site reads Supabase (4C)`.

### Task 8: Тесты сайта (часть 4E)

**Files:** Create `components/home/*.test.tsx`, `e2e/home.spec.ts`

- [ ] **Step 1:** делегировать субагенту `test-engineer` (проект `urban.gardener`, спека Фазы 4, скилл `testing`): компонентные — `Hero` (один h1; акцент в `span`; `<script>` из БД выводится текстом; лист `aria-hidden`), `FeaturedArticle` (имя ссылки = заголовок, `href`, нет автора → строка без «·»), `HomeJournal`/`HomeShop` (пустой → ничего не рендерится; ссылка «All articles»/«Visit the shop»), `HomeTip`/`NewsletterPlaceholder` (input и button `disabled`, нет `<form>`, подпись «coming soon»), страница: все слоты пусты → есть h1, пилюли, tip, нет h2 секций; e2e `e2e/home.spec.ts` (порт 3200, живой Supabase; сидовые по названиям, не по числам): пилюля темы ведёт на `/topics/<slug>`; featured → статья; «Visit the shop →» → `/shop`; кнопка рассылки `disabled`, форм нет; на 390px нет горизонтального скролла; ровно один h1; `/nope` — 404.
- [ ] **Step 2:** принять отчёт: расхождение «код ≠ спека» — не чинить тест, вынести владельцу. Commit `test(home): component and e2e tests (4E site)`.

### Task 9: Проверка и стоп перед 4D

**Files:** — 

- [ ] **Step 1:** `verification-before-completion`: в `urban.gardener` `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` — реальный вывод; записать числа.
- [ ] **Step 2:** ревьюеры `react-reviewer`, `a11y-architect`, `seo-specialist` (метаданные `/`) по `app/page.tsx` и `components/home/` — только читают; CRITICAL/HIGH исправить или вынести владельцу.
- [ ] **Step 3:** записать прогресс в память агента; кратко описать владельцу экран 4D (не документ) и ждать «утверждаю». В 4D — отдельный impl-план для `web.admin`.

## Self-review (спека → задачи)

Hero/пилюли/featured/журнал/магазин/tip → Tasks 3–5; безопасный разбор заголовка → Task 2; `pages` + `home_slots` + RLS + RPC + сид → Task 6; `lib/home.ts` с двумя фильтрами `is_published`, ошибка → throw, warn при RLS-отсеве → Task 7; `generateMetadata` → Task 7; ёмкость и дедуп → Task 2 + 7; тесты 4E (сайт) → Task 8; ревью-гейт сайта → Tasks 6, 7, 9; админка 4D и документация 4F — осознанно вне этого плана.
