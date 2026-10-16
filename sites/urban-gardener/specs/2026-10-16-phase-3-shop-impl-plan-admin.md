# Urban Gardener — Фаза 3 (Shop), репо `web.admin`: impl-план (3D)

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (выбрано: 7 последовательных задач в одном репо, общие типы `lib/ugShop.ts`; миграции уже применены). Шаги — чекбоксы.

**Goal:** разделы Products, Categories, Brands сайта `urban-gardener` в web.admin (спека 3D утверждена владельцем 2026-10-16).

**Architecture:** по образцу Фазы 2: слой данных `lib/ugShop.ts` (запись товара только RPC `save_product`), форма на RHF+zod с чистыми конвертерами `ugProductForm.ts`, справочники — общий `TaxonomyManager` + конфиги, диспетчер роутов по `site.schema` (Cozy/Avocado не затрагиваются).

**Tech Stack:** Vite + React, TanStack Query, RHF + Zod, shadcn/ui, Vitest + RTL.

**Spec:** `platform-docs/sites/urban-gardener/specs/2026-10-16-shop-admin-design.md` (+ модель БД: `urban.gardener/supabase/migrations/0007–0011`).

## Global Constraints

- UI-тексты на английском; комментарии на русском. Service-role ключа нет; запись только под сессией админа.
- Пустые optional → `null`; `slug`, `created_at`, `updated_at` не отправлять; `image_alt` — `''` вместо `null` (NOT NULL).
- Картинки: в форме публичный URL, в БД плоский ключ (`resolveImageUrl` / `toStoragePath`).
- Валюта — список **EUR / USD / GBP** (по умолчанию EUR); чужое существующее значение показывается как есть.
- Партнёрская ссылка — только `https://`. Публикация требует: фото + alt, https-ссылку, ≥1 категорию.
- Форма блокируется на время Save; `gcTime: 0` у запроса редактора; `mustAffect` на update/delete; query-keys не форкать.
- Коммиты — локальные на `feat/shop`; push/merge — только по команде.

## Review Focus

1. Дубли id категорий / пустой массив при публикации → ошибка до отправки (`ugProductForm` + RPC `23514`).
2. Цена `''`, `0`, `12,5`, `-1`, `1e3` → `null` / число / понятная ошибка, без `NaN`.
3. Товар с чужой валютой (`PLN`, заведён SQL-ом) открывается и сохраняется без потери валюты.
4. Удаление категории, где единственный опубликованный товар → блок с названием товара; счётчик «N products».
5. Cozy/Avocado: маршруты `products`/`categories`/`brands` по-прежнему ведут на их страницы.

### Task 1: Слой данных `lib/ugShop.ts` (+ общие хелперы)

**Files:** Create `src/lib/ugShop.ts`, `src/lib/ugShop.test.ts`; Modify `src/lib/ugDb.ts` (общие `reorderRows`, `countBy`, `assertNotTruncated`), `src/lib/ugTaxonomy.ts` (использует их), `src/lib/media.ts` (`USAGE_SOURCES.urban_gardener` += `products.image_path`, `shop_categories.image_path`).
**Produces:** типы `UgProduct`, `UgProductInput`, `UgProductListItem`, `UgShopCategory`, `UgShopCategoryInput`, `UgBrand`; ключи `ugProductsKey`, `ugShopCategoriesKey`, `ugBrandsKey`; функции `listUgProducts`, `getUgProduct(site,id) → {product, categoryIds}`, `saveUgProduct(site, id|null, input, categoryIds) → {id}` (RPC), `deleteUgProduct`; категории: `listUgShopCategories`, `getUgShopCategory`, `createUgShopCategory(site,name)`, `createUgShopCategoryFull`, `updateUgShopCategory`, `renameUgShopCategory`, `deleteUgShopCategory` (блок через `publishedProductsOnlyInCategory`), `reorderUgShopCategories`, `shopCategoryUsage`; бренды: `listUgBrands`, `createUgBrand`, `renameUgBrand`, `deleteUgBrand`, `reorderUgBrands`, `brandUsage`.
- [ ] Тесты (мок `getDb`, как `ugArticles.test.ts`): `saveUgProduct` шлёт `rpc('save_product', {p_id, p_product, p_category_ids})` и бросает на ответ без `id`; `deleteUgProduct` → `mustAffect`; `deleteUgShopCategory` бросает с названием товара, когда он единственный опубликованный; `shopCategoryUsage`/`brandUsage` считают по id; ошибка запроса пробрасывается.
- [ ] Реализовать; `npx vitest run src/lib`; commit.

### Task 2: Форма товара `ugProductForm.ts` (чистая логика, red-first)

**Files:** Create `src/features/ug-products/ugProductForm.ts`, `ugProductForm.test.ts`.
**Produces:** `ugProductSchema` (zod), `UgProductFormValues`, `toFormValues(site, data|null)`, `toInput(site, values): UgProductInput`, `CURRENCIES = ['EUR','USD','GBP']`, `currencyConflict(products: UgProductListItem[], categoryIds, currency, selfId|null): string[]` (названия категорий, где у других товаров другая валюта), `needsPetFriendlyHint(petSafety, selectedCategoryNames): boolean`.
- [ ] Тесты: публикация без фото / alt / ссылки / категорий → ошибки с понятным текстом; черновик проходит с одним именем; `http://` и `javascript:` отклоняются; цена `''`→`null`, `12.5`→12.5, `12,5`/`-1`/`abc` → ошибка; пустые optional → `null`; SEO равный фолбэку → `null`; `image_alt` пустой → `''`; чужая валюта `PLN` сохраняется; `currencyConflict`; подсказка Pet-friendly только при `pet_safe` без категории Pet-friendly.
- [ ] Реализовать; commit.

### Task 3: `UgCategoriesField` (порядок категорий)

**Files:** Create `src/features/ug-products/UgCategoriesField.tsx` (+ test) — копия-адаптация `UgTopicsField`: `value: string[]`, `onChange`, чипы ←/→/удалить, «Main» у первой, поповер «Add category».
- [ ] Тест по образцу `UgTopicsField.test.tsx`; commit.

### Task 4: Список и редактор товара

**Files:** Create `UgProductsPage.tsx`, `UgProductEditPage.tsx` (+ компонентный тест редактора: публикация без ссылки блокируется, Save вызывает `saveUgProduct` с payload, чужая валюта не теряется).
- [ ] Список: поиск по имени, фильтр published/draft, фильтр по категории, миниатюра, бренд, цена, «Draft», дата. Редактор — по спеке 3D §2 (шапка: switch Published, «View on site» → `/product/<slug>`, Save, Delete с confirm; гард несохранённых; подсказка Pet-friendly; предупреждение о смешанной валюте; SEO «Customize»).
- [ ] commit.

### Task 5: Категории и бренды

**Files:** Create `src/features/taxonomy/shopCategoryForm.ts` (+test), `ShopCategoryEditDialog.tsx`; Modify `src/features/taxonomy/config.ts` (`ugShopCategoryConfig`, `ugBrandConfig` с `usage`/`contentKeys`).
- [ ] `ShopCategoryEditDialog`: name, description, картинка (`ImagePreviewPicker`) + стиль photo/cutout, SEO «Customize»; по образцу `TopicEditDialog` + `CategoryEditDialog`. Тест формы: пустое → `null`, `image_style` по умолчанию `photo`, URL → ключ.
- [ ] Удаление бренда: диалог «N products will lose this brand» (через `usage`); удаление категории — блок со списком товаров (`deleteUgShopCategory`).
- [ ] commit.

### Task 6: Роуты, меню, сайт

**Files:** Create `src/features/ug-products/ShopRoutes.tsx` (`ProductsRoute`, `ProductEditRoute`, `CategoriesRoute`, `BrandsRoute` — по `site.schema === 'urban_gardener'` → новые страницы, иначе прежние); Modify `src/lazyPages.ts`, `src/App.tsx` (роуты `products`, `products/new`, `products/:productId`, `categories`, `brands` на диспетчеры; `categories/:categoryId` остаётся Cozy/Avocado), `src/config/sites.ts` (`urban-gardener.sections` = media, products, categories, brands, articles, topics, levels, authors).
- [ ] Тест диспетчера: urban → новые, cozycorner/avocado_kiss → прежние (мок страниц); тест `SiteLayout`-порядка меню не ломается.
- [ ] commit.

### Task 7: Проверка, ревью, документация

- [ ] `npm run build`, `npm run lint`, `npm test`; ревьюеры `react-reviewer`, `typescript-reviewer`, `silent-failure-hunter` (слой данных); CRITICAL/HIGH исправить.
- [ ] Живая проверка на БД под админской сессией невозможна без пароля владельца → ручной сценарий в чек-листе владельца (спека 3D §6); автоматически — SQL-проверка `save_product` уже сделана (3B).
- [ ] Документы: `admin-panel/shop-urban-gardener.md`, `admin-panel/status.md`, `database/schema.md` (urban_gardener: магазин), `AGENTS.md` репо web.admin (features, таблица документов), `phase-x-checklist.md`, отчёт в плане Фазы 3.
