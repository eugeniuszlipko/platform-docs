# Urban Gardener — Фаза 3 (Shop), репо `urban.gardener`: impl-план

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (выбрано: 10 последовательных задач в одном репо, интерфейсы держу в одном контексте; цена ошибки в БД закрыта ревью-гейтом Task 9). Шаги — чекбоксы `- [ ]`.

**Goal:** магазин Urban Gardener на сайте: хаб `/shop`, категории с фильтрами и бесконечной прокруткой, товар `/product/<slug>` — на тестовых данных (3A), затем в Supabase (3B, 3C), с тестами (3E) и ревью (3F).

**Architecture:** порт структуры CozyCorner в стиль Urban. Страницы тонкие, данные — только через `lib/shop.ts` (в 3A тело на фикстурах, в 3C — на Supabase, сигнатуры те же). Чистая логика (цена, фильтры, related, SEO-фолбэки) — в `lib/shop-utils.ts`. Постраничная выборка для бесконечной прокрутки — `fetchProductPage(client, page, filters)` (работает на сервере и в браузере, как `fetchProducts` у Cozy).

**Tech Stack:** Next.js 16 (читать `node_modules/next/dist/docs/` перед API), React 19, Supabase JS, CSS Modules + токены `globals.css`, Vitest + RTL, Playwright (порт 3200).

**Spec:** `platform-docs/sites/urban-gardener/specs/2026-10-16-phase-3-shop-spec.md` (решения S1–S10 — источник истины). Админка (3D) — **отдельный impl-план `…-impl-plan-admin.md` после утверждения спеки 3D владельцем**; в этот план не входит.

## Global Constraints

- UI на английском; документация на русском; никакого hex вне `:root` — только `var(--token)`; новая величина → новый токен.
- Страницы `/shop`, `/shop/[category]`, `/product/[slug]`: SSG + `export const revalidate = 60`, `generateStaticParams`, неизвестный slug → `notFound()`. **`loading.tsx` — только у хаба** через `app/shop/(hub)/`. В страницах **нет `searchParams`**.
- `affiliate_url` рендерится только при `https://`; ссылка `target="_blank"` `rel="sponsored noopener noreferrer"`.
- Картинки: `resolveImage(path, width)`; внешние Unsplash — `unoptimized`; `image_style: cutout` → `contain` на белой плитке.
- Публичные колонки — явными списками, не `select('*')`; ошибка Supabase → `throw` (ISR сохраняет прошлую страницу).
- Диапазоны Price: `<15 · 15–30 · 30–50 · 50+` (min включительно, max нет); разные валюты в выборке → Price скрыт; Brand скрыт, пока в выборке нет брендов.
- Сортировка ленты: `published_at desc, id desc`; `PAGE_SIZE = 12`; дедуп по `id`.
- URL-ы CozyCorner не трогать. Не `rm -rf .next`, не запускать второй `next dev`. Коммиты — локальные, на `feat/shop`; push/merge — только по команде.
- «Готово» каждой задачи: `npm run lint` + `npx tsc --noEmit` + `npm test` зелёные (build — в задачах страниц и в конце).

## Review Focus

1. Товар без цены или с невалидной валютой (`ZZZ`) → блок цены скрыт / запасной формат, страница не падает (`formatPrice`, `ProductCard`).
2. `affiliate_url` = `http://…`, `javascript:…`, пусто → кнопки «Find on Amazon» нет, карточка и страница живы (`safeAffiliateUrl`).
3. Категория без опубликованных товаров → страница 200 с пустым состоянием и `noindex`, на хабе карточка остаётся (не 404).
4. Товар в двух категориях: одна запись в ленте каждой категории; в infinite scroll пересечение страниц не даёт дублей ключей.
5. Смешанные валюты (EUR + USD) в категории → Price скрыт; одна валюта — символ из неё.

## File Structure

- `lib/shop.types.ts`, `lib/shop-utils.ts` (+test), `lib/shop.fixtures.ts`, `lib/shop.ts` (загрузчики), `lib/shop.mappers.ts` (3C), `lib/shop-queries.ts` (3C), `lib/supabase/client.ts` (3C, если нет)
- `components/shop/` — `ProductCard`, `ProductGrid`(client), `FiltersBar`(client), `ShopCatalog`(client), `CategoryCard`, `CategoryGrid`, `ProductDetail`, `SpecList`, `RelatedProducts`, `Disclosure`, `ShopSkeleton`; у каждого свой `.module.css`
- `app/shop/(hub)/{page.tsx,loading.tsx}`, `app/shop/[category]/page.tsx`, `app/product/[slug]/page.tsx`
- Правки: `components/ui/PageHead.tsx`, `components/ui/SmartLink.tsx`, `components/ui/ButtonLink.tsx`, `lib/site.ts`, `app/design/page.tsx`
- `supabase/migrations/0007_shop_tables.sql`, `0008_seed_shop.sql`, `0009_save_product_rpc.sql`
- `e2e/shop.spec.ts`

### Task 1: Ветка и базовая линия

**Files:** — (git)

- [ ] **Step 1:** в `urban.gardener` и `web.admin` (чистый `main`): `git switch -c feat/shop`. В `web.admin` ветка нужна к 3D, создаю сразу.
- [ ] **Step 2:** `npm test && npm run lint && npx tsc --noEmit` в `urban.gardener` — записать число пройденных тестов как базовую линию (ждём 245+).

### Task 2: Типы и чистая логика `lib/shop-utils.ts` (red-first)

**Files:** Create `lib/shop.types.ts`, `lib/shop-utils.ts`; Test `lib/shop-utils.test.ts`

**Interfaces — Produces** (`lib/shop.types.ts`):
```ts
export type ImageStyle = 'photo' | 'cutout'
export type PetSafety = 'pet_safe' | 'mildly_toxic' | 'toxic'
export type ShopCategory = { id: string; name: string; slug: string; description: string | null; imagePath: string | null; imageStyle: ImageStyle; position: number; seoTitle: string | null; seoDescription: string | null }
export type Brand = { id: string; name: string; slug: string; position: number }
export type Product = { id: string; slug: string; name: string; short: string | null; description: string | null; imagePath: string | null; imageAlt: string; imageStyle: ImageStyle; brand: Brand | null; price: number | null; currency: string; affiliateUrl: string | null; light: string | null; water: string | null; size: string | null; petSafety: PetSafety | null; publishedAt: string; seoTitle: string | null; seoDescription: string | null; categories: ShopCategory[] /* первая = основная */ }
export type ProductCardData = Pick<Product, 'id'|'slug'|'name'|'short'|'imagePath'|'imageAlt'|'imageStyle'|'price'|'currency'|'affiliateUrl'> & { categoryName: string | null }
export type ProductFilters = { categoryId?: string; brandId?: string; priceMin?: number; priceMax?: number }
export const PAGE_SIZE = 12
```
**Produces** (`lib/shop-utils.ts`): `formatPrice(price: number, currency: string): string` · `priceRanges(currency: string): PriceRange[]` (`{value:'lt-15'|'15-30'|'30-50'|'gte-50'; label; min?: number; max?: number}`) · `filterProducts(products: readonly Product[], f: ProductFilters): Product[]` · `uniformCurrency(products: readonly Pick<Product,'currency'|'price'>[]): string | null` · `primaryCategory(p: Pick<Product,'categories'>): ShopCategory | null` · `toProductCard(p: Product): ProductCardData` · `pickRelatedProducts(current: Product, all: readonly Product[], limit = 3): Product[]` · `petLabel(v: PetSafety | null): string | null` · `safeAffiliateUrl(url: string | null): string | null` · `productSeoTitle/Description(p)`, `categorySeoTitle/Description(c)`.

- [ ] **Step 1: падающие тесты** (имена и утверждения):
  - `formatPrice(34,'EUR') === '€34'`; `formatPrice(34.5,'EUR') === '€34.50'`; `formatPrice(10,'ZZZ')` не бросает и содержит `10`.
  - `priceRanges('EUR')` → 4 диапазона, подписи `Under €15`, `€15 – €30`, `€30 – €50`, `€50 and up`.
  - `filterProducts`: граница `15` попадает в `15-30`, а не в `lt-15`; товар с `price: null` исключён при любом ценовом фильтре и включён без него; `brandId` и `categoryId` (членство в `categories`) работают вместе.
  - `uniformCurrency`: `['EUR','EUR'] → 'EUR'`; `['EUR','USD'] → null`; пусто → `null`; товары без цены в расчёт не входят.
  - `pickRelatedProducts`: исключает текущий; сначала общая основная категория, затем любая общая, затем самые свежие; без дублей; всегда `limit`, если товаров хватает; в каталоге из 1 товара → `[]`.
  - `safeAffiliateUrl`: `https://…` → как есть; `http://…`, `javascript:alert(1)`, `//evil.com`, `''`, `null` → `null`.
  - `petLabel`: `pet_safe → 'Pet-safe'`, `mildly_toxic → 'Mildly toxic'`, `toxic → 'Toxic'`, `null → null`.
  - SEO: `productSeoTitle` = `seoTitle ?? name`; `productSeoDescription` = `seoDescription ?? short ?? description`-обрезка 160; `categorySeoTitle` = `seoTitle ?? \`${name} plants\``.
- [ ] **Step 2:** `npx vitest run lib/shop-utils.test.ts` → FAIL (модуль не найден).
- [ ] **Step 3:** реализовать по сигнатурам. `formatPrice` — `Intl.NumberFormat('en-IE', {style:'currency', currency, minimumFractionDigits: Number.isInteger(price) ? 0 : 2})` в `try`; при `RangeError` — `${price} ${currency}`.
- [ ] **Step 4:** тот же запуск → PASS. **Step 5:** `git commit -m "feat(shop): types and pure shop logic"`.

### Task 3: Фикстуры и фото

**Files:** Create `lib/shop.fixtures.ts`; Test `lib/shop.fixtures.test.ts`

**Produces:** `SHOP_CATEGORIES: ShopCategory[]` (Easy care, Low light, Pet-friendly, Statement — `position` 0–3, slug'и `easy-care`, `low-light`, `pet-friendly`, `statement`, `description` — вводный абзац, `imagePath` — Unsplash) · `SHOP_PRODUCTS: Product[]` (9 товаров референса, newest first).

- [ ] **Step 1:** взять данные 9 товаров из `mockups/Urban Gardener.html` (строки 912–949): `name, short, desc→description, light, water, size`; цена числом (`34`…), `currency: 'EUR'`, `pet`: «Pet-safe» → `pet_safe`, «Mildly toxic» → `mildly_toxic`; `brand: null`; категории — по таблице спеки (первая = основная); `affiliateUrl` — плейсхолдер `https://www.amazon.de/s?k=<name+plus>+plant`; `imageAlt` = имя.
- [ ] **Step 2:** подобрать рабочие фото (13 шт.: 9 + 4 категории) способом из kickoff «Картинки Unsplash»; ссылки референса проверить `curl -sI`; хранить `?w=1200&q=80`; нерастения заменить. Результат занести в фикстуры.
- [ ] **Step 3:** тест фикстур: 9 товаров, 4 категории; у каждого товара ≥1 категория и `https`-ссылка; уникальные slug'и; все `categories[*].id` существуют в `SHOP_CATEGORIES`; `Snake Plant` → `['Low light','Easy care']`, `Spider Plant` → `['Pet-friendly','Easy care']`.
- [ ] **Step 4:** `npx vitest run lib/shop.fixtures.test.ts` → PASS. Commit `feat(shop): fixtures`.

### Task 4: Примитивы — крошки в `PageHead`, `sponsored`

**Files:** Modify `components/ui/PageHead.tsx` (+css), `components/ui/SmartLink.tsx`, `components/ui/ButtonLink.tsx`; Test: расширить `components/ui/primitives.test.tsx`, `SmartLink.test.tsx`

- [ ] **Step 1:** `PageHead` получает `breadcrumb?: ReactNode`, выводится **внутри** `.wrap` над `Eyebrow`; без пропа разметка не меняется (страница статьи/листинга не затронуты).
- [ ] **Step 2:** `SmartLink` получает `sponsored?: boolean` → внешний `rel="sponsored noopener noreferrer"`; `ButtonLink` пробрасывает проп.
- [ ] **Step 3:** тесты: breadcrumb над eyebrow и h1; без пропа — нет лишнего узла; `sponsored` даёт `rel` с `sponsored`, без — прежний `rel`. `npm test` зелёный; commit `feat(ui): PageHead breadcrumb slot, sponsored links`.

### Task 5: Компоненты `components/shop/`

**Files:** Create компоненты из «File Structure» + CSS-модули; на `app/design/page.tsx` — демо карточки/фильтров

**Interfaces — Produces:**
- `ProductCard({ product: ProductCardData; eager?: boolean })` — фото + метка `categoryName`, имя (растянутая ссылка на `/product/<slug>`, заголовок h2/h3 через `headingLevel`), цена (скрыта без цены), «Find on Amazon →» поверх оверлея только при `safeAffiliateUrl`; `cutout` → `contain`.
- `FiltersBar({ brands: Brand[]; currency: string | null; selection: { brand: string; price: '' | PriceRangeValue }; onChange; leading?: ReactNode; disabled?: boolean })` — нативные `<select aria-label="Brand|Price">`, кнопка «Clear» при выборе; Brand скрыт при `brands.length === 0`, Price скрыт при `currency === null`; `leading` — слева в той же строке (на 390px — над фильтрами, дропдауны на всю ширину).
- `ProductGrid({ initialProducts: ProductCardData[]; filters: ProductFilters; fetchPage: (page: number, f: ProductFilters) => Promise<ProductCardData[]>; })` — порт Cozy: смена фильтров по значению (`JSON.stringify`), скелетоны, `IntersectionObserver` с `rootMargin: '200px'`, дедуп по `id`, пустое состояние «No plants match these filters.» + сброс (фокус на первый select).
- `ShopCatalog({ initialProducts, brands, currency, baseFilters, fetchPage, leading })` — собирает фильтры (`priceMin/priceMax` из `priceRanges(currency)`), монтируется под `Suspense` не нужен (URL не читает); до гидрации селекты `disabled`.
- `CategoryGrid({ categories: ShopCategory[] })` / `CategoryCard` — фото в скруглённой карточке, имя, `aria-label`, ссылка `/shop/<slug>`, `image_style`.
- `ProductDetail({ product: Product })`, `SpecList` (`dl`: Light/Water/Size/Pets, пустые строки скрыты), `RelatedProducts({ products })`, `Disclosure` (константа `AFFILIATE_DISCLOSURE` в `lib/site.ts`; текст — «As an Amazon Associate we may earn from qualifying purchases. Prices may change — check the retailer.» **черновик**, финал — Фаза 5), `ShopSkeleton`.

- [ ] **Step 1:** сначала прочитать референсы Cozy (`FiltersBar`, `ProductGrid`, `ProductDetail`, `CategoryCard`) и существующие `ArticleCard`/`FilteredArticleGrid` Urban — стиль и токены брать от Urban.
- [ ] **Step 2:** реализовать компоненты; `'use client'` только у `ProductGrid`, `FiltersBar`, `ShopCatalog`.
- [ ] **Step 3:** `npm run lint && npx tsc --noEmit && npm test` зелёные. Commit `feat(shop): shop components`.

### Task 6: Загрузчики на фикстурах и страницы (3A)

**Files:** Create `lib/shop.ts`, `app/shop/(hub)/page.tsx`, `app/shop/(hub)/loading.tsx`, `app/shop/[category]/page.tsx`, `app/product/[slug]/page.tsx`; Delete старый `app/shop/page.tsx`; Modify `lib/site.ts`

**Interfaces — Produces** (`lib/shop.ts`, тело на фикстурах; `cache()` как в `lib/articles.ts`):
`fetchShopCategories(): Promise<ShopCategory[]>` · `fetchShopCategoryBySlug(slug): Promise<ShopCategory | null>` · `fetchProductBySlug(slug): Promise<Product | null>` · `fetchAllProductSlugs(): Promise<string[]>` · `fetchCategoryView(categoryId): Promise<{ initial: ProductCardData[]; brands: Brand[]; currency: string | null; total: number }>` · `fetchProductPage(page: number, f: ProductFilters): Promise<ProductCardData[]>` · `fetchRelatedProducts(product: Product, limit = 3): Promise<ProductCardData[]>`.

- [ ] **Step 1:** страницы: хаб (eyebrow «Shop», h1 «Plants we'd put on our own windowsill», описание референса, `CategoryGrid`, `Disclosure` строкой внизу); категория (крошки `Home › Shop › <name>` через `PageHead breadcrumb`, eyebrow «Category», h1 `name`, описание, `ShopCatalog`; пустая категория → `robots: noindex`); товар (по порядку спеки «Товар»: крошки с основной категорией → фото `priority` → … → «Back to shop →»). Метаданные по спеке (canonical без query, OG).
- [ ] **Step 2:** `lib/site.ts`: у Shop `matches: ['/product']`; в футере «Shop plants» → `/shop`, добавить `/shop/easy-care`, `/shop/low-light`, `/shop/pet-friendly`, `/shop/statement` и `/product/<slug>` не нужен; обновить `KNOWN_ROUTES` и `lib/site.test.ts`.
- [ ] **Step 3:** `npm run build` (проверить, что три маршрута — `●` SSG, `/shop/nope` и `/product/nope` → 404, у `[category]`/`[slug]` нет `loading.tsx`); `npm run lint`; `npm test`.
- [ ] **Step 4:** визуальная проверка в браузере (Playwright MCP, 1280 и 390px): хаб, категория, товар, 404; отчёт-скриншоты не коммитить. Commit `feat(shop): shop pages on fixtures (3A)`. **Остановка: показать владельцу не требуется — переход к 3B.**

### Task 7: Миграции и сид (3B)

**Files:** Create `supabase/migrations/0007_shop_tables.sql`, `0008_seed_shop.sql`, `0009_save_product_rpc.sql`

- [ ] **Step 1:** прочитать скиллы `database-migrations`, `postgres-patterns`; образец — `0002`, `0004`, `0006` (триггеры slug/updated_at, `public.slugify`, `public.set_updated_at`, `public.is_admin()`, `revoke`/гранты, политики «Public read …» / «Admin all …»).
- [ ] **Step 2 — `0007`:** таблицы `shop_categories`, `brands`, `products`, `product_categories` ровно по спеке «Модель данных» (checks: `btrim(name) <> ''`, `currency ~ '^[A-Z]{3}$'`, `affiliate_url ~* '^https://'`, `pet_safety in (…)`; `brand_id … on delete set null`; индексы `products (is_published, published_at desc, id desc)`, `product_categories (category_id)`, `products (brand_id)`); RLS: публичное чтение — справочники целиком, `products` только `is_published`, `product_categories` только опубликованных товаров; админ — all; триггер `guard_shop_category_delete` по образцу `guard_topic_delete`.
- [ ] **Step 3 — `0008`:** одноразовый скрипт в **scratchpad** (не в репо) генерирует SQL из `lib/shop.fixtures.ts` (`node --experimental-strip-types --no-warnings`, нулевые колонки типизировать `null::integer` / `null::jsonb`): 4 категории, 9 товаров, 11 связей с `position`, `published_at` по убыванию, `is_published = true`.
- [ ] **Step 4 — `0009`:** `save_product(p_id uuid, p_product jsonb, p_category_ids uuid[]) returns jsonb` (`security invoker`, `set search_path = ''`): публикация требует `image_path`, `affiliate_url`, ≥1 категорию (`23514`); `0` строк → `P0002`; связи пересобираются с `position`; `revoke … from public, anon`, `grant execute … to authenticated, service_role`. Образец — `0006`.
- [ ] **Step 5:** применить каждую через MCP `apply_migration` (проект `zwrkphynupdubevzwdzy`); текст в репо = текст в БД.
- [ ] **Step 6:** проверка прав SQL-блоком из kickoff (анон / не-админ / админ; ошибки отдельными запросами; всегда `rollback`): anon видит только опубликованные; anon не пишет; не-админ не пишет и не вызывает `save_product`; админ создаёт/публикует; удаление единственной категории опубликованного товара → `23514`; публикация без фото/ссылки/категории → `23514`.
- [ ] **Step 7:** `get_advisors` (security + performance) без новых замечаний по `shop_*`/`products`; ревью `database-reviewer` — CRITICAL/HIGH исправить. Commit `feat(db): shop tables, seed, save_product (3B)`.

### Task 8: Сайт читает базу (3C)

**Files:** Create `lib/shop.mappers.ts` (+test), `lib/shop-queries.ts`, `lib/supabase/client.ts` (если нет); Modify `lib/shop.ts`, страницы (не должны меняться — сигнатуры те же), `ShopCatalog` wiring

**Produces:** `PUBLIC_PRODUCT_COLUMNS`, `PRODUCT_LIST_SELECT` (embed `brand:brands(…)`, `product_categories(position, category:shop_categories(…))`), `rowToProduct`, `rowToCategory`, `rowToBrand` (бросают при битом embed — как `rowToArticle`); `fetchProductPage(client: SupabaseClient, page: number, f: ProductFilters): Promise<ProductCardData[]>` в `shop-queries.ts` (inner-join к `product_categories` при `categoryId`, `.eq('is_published', true)`, `.range`, сортировка по спеке).

- [ ] **Step 1:** мапперы: тест (строка БД → `Product`, порядок категорий по `position`, `price` из `numeric`-строки в число, `null` цена, битый embed → throw) → реализация.
- [ ] **Step 2:** `lib/shop.ts` на Supabase (все функции из Task 6, `throw` через `fail()` как в `lib/articles.ts`); `fetchRelatedProducts` = выборка опубликованных товаров с общими категориями (лимит 24) + 6 свежих → `pickRelatedProducts`; `fetchCategoryView` считает `brands` и `currency` по **всей** выборке категории, а не по первой странице.
- [ ] **Step 3:** `ShopCatalog` получает `fetchPage` на браузерном клиенте (`fetchProductPage(browserClient, …)`); клиент создаётся лениво, на публичном ключе.
- [ ] **Step 4:** `npm run build` против живой БД (страницы те же, что в 3A); ревью `silent-failure-hunter` на `lib/shop*.ts`; `npm run lint`, `npm test`. Commit `feat(shop): site reads Supabase (3C)`.

### Task 9: Тесты (3E, только сайт)

**Files:** Create `components/shop/*.test.tsx`, `lib/shop.mappers.test.ts` (если не сделан), `e2e/shop.spec.ts`

- [ ] **Step 1:** делегировать субагенту `test-engineer` (проект `urban.gardener`) по спеке: компонентные — карточка (без цены/без ссылки, `rel="sponsored noopener noreferrer"`, `cutout`), фильтры (скрытие Brand/Price, Clear), бесконечная прокрутка с моком `IntersectionObserver` (догрузка, дедуп, пустое состояние, сброс), крошки в `PageHead`, `SpecList`, `CategoryCard`.
- [ ] **Step 2:** e2e `shop.spec.ts` (порт 3200, сидовые по названиям, не по числам): хаб → 4 карточки категорий; категория → крошки, фильтр Price меняет список, Clear; товар → цена с `€`, `Find on Amazon` с нужным `rel`/`target`, 3 related, canonical; 404 на `/shop/nope` и `/product/nope`; 390px без горизонтального скролла; «Shop» подсвечен на `/product/…`.
- [ ] **Step 3:** `npm test` + e2e (`npm run build` → `npx next start -p 3200 &` → `npx playwright test` → `pkill -f "next start -p 3200"`) зелёные; расхождения код≠спека — в отчёт, код не менять. Commit `test(shop): component and e2e tests (3E)`.

### Task 10: Ревью-гейт и документация (3F, сайт)

- [ ] **Step 1:** `requesting-code-review` (соответствие плану/спеке), затем `react-reviewer`, `typescript-reviewer`, `a11y-architect`, `seo-specialist`; CRITICAL/HIGH — исправить или вынести владельцу.
- [ ] **Step 2:** `verification-before-completion`: `npm run build`, `npm run lint`, `npx tsc --noEmit` (+ `-p tsconfig.vitest.json`), `npm test` — реальный вывод.
- [ ] **Step 3:** обновить `urban.gardener/AGENTS.md` (Key files: shop slice) и `platform-docs`: `database/schema.md`, `sites/urban-gardener.md` (решения), roadmap, `phase-x-checklist.md`, отчёт в конце плана Фазы 3 (с заметками по токенам и порогам Superpowers). Документы сам **не коммитить**.
