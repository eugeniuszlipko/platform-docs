# Urban Gardener — Shop (Products, Categories, Brands) в web.admin — контракт раздела

> Last updated: 2026-10-16 | Site: **urban.gardener** (схема `urban_gardener`, бакет `urban-gardener-photos`).
> Разделы в web.admin **ПОСТРОЕНЫ** (Фаза 3D): **Products**, **Categories** (shop_categories), **Brands**; Media — общий.
> Спека и решения — [../sites/urban-gardener/specs/2026-10-16-shop-admin-design.md](../sites/urban-gardener/specs/2026-10-16-shop-admin-design.md);
> модель БД — [../database/schema.md](../database/schema.md) §10 (миграции 0007–0011); как сайт рендерит — [../sites/urban-gardener.md](../sites/urban-gardener.md).
> ⚠️ Не путать с [products.md](products.md) (Cozy/Avocado): у Urban другая модель — M2M-категории с порядком, запись только через RPC
> `save_product`, характеристики растения, нет папок и markdown. Код живёт отдельно (`features/ug-products`, `lib/ugShop.ts`) — Cozy и Avocado не затронуты.

## 1. Реестр и навигация

`src/config/sites.ts`, сайт `urban-gardener`: `sections: ["media","products","categories","brands","articles","topics","levels","authors"]`
(порядок меню = порядок `NAV_ITEMS`). Роуты `/products`, `/products/new`, `/products/:productId`, `/categories`, `/brands` **общие** с Cozy/Avocado:
диспетчер `features/ug-products/ShopRoutes.tsx` выбирает страницу по `site.schema` (`urban_gardener` → новые, остальные → прежние), как `BlogRoutes`.
`USAGE_SOURCES.urban_gardener` (`lib/media.ts`) дополнен `products.image_path`, `shop_categories.image_path`.

## 2. Файлы

| Что | Где |
|---|---|
| Слой данных | `src/lib/ugShop.ts` — товары (`listUgProducts`, `getUgProduct`, `saveUgProduct` → RPC, `deleteUgProduct`), категории (`…UgShopCategory…`, `publishedProductsOnlyInCategory`, `shopCategoryUsage`), бренды (`…UgBrand…`, `brandUsage`); общие хелперы `reorderRows`/`countBy`/`assertNotTruncated`/`mustAffect` — `src/lib/ugDb.ts` |
| Список и редактор товара | `src/features/ug-products/` — `UgProductsPage`, `UgProductEditPage`, `UgCategoriesField`, `ugProductForm.ts` (zod-схема, конвертеры, `currencyConflict`, `needsPetFriendlyHint`), `ShopRoutes.tsx` |
| Категории / бренды | `src/features/taxonomy/` — `ShopCategoryEditDialog` + `shopCategoryForm.ts`, `UgShopTaxonomyPages.tsx`; `TaxonomyManager` + `ugShopCategoryConfig`/`ugBrandConfig` (`config.ts`, `usage`) |

Query-ключи: `['ug-products', site.slug]` (+ `, id`), `['ug-shop-categories', …]`, `['ug-brands', …]`, счётчики `['ug-shop-category-usage', …]` / `['ug-brand-usage', …]`. Не форкать свои.

## 3. Товар

| Поле | Колонка | Правило |
|---|---|---|
| Name | `name` | обязателен; slug генерит триггер БД (read-only в форме, при create не отправляется) |
| Short / Description | `short`, `description` | пусто → `null`; описание — абзацы через пустую строку |
| Photo + Alt + Style | `image_path`, `image_alt`, `image_style` (`photo`/`cutout`) | в форме публичный URL, в БД плоский ключ; **`image_alt` — `''`, не `null`** (NOT NULL) |
| Categories | `product_categories` | порядок ←/→, **первая = основная**; запись — только через RPC |
| Brand | `brand_id` | необязателен («No brand») |
| Price + Currency | `price`, `currency` | цена `''`→`null`, число ≥ 0, до 2 знаков, **запятая допустима** (`12,5`→12.5); валюта — список **EUR/USD/GBP**, чужое существующее значение (напр. PLN из SQL) остаётся в списке |
| Affiliate link | `affiliate_url` | только `https://` (zod + CHECK в БД); обязательна для публикации |
| Light / Water / Size / Pets | `light`, `water`, `size`, `pet_safety` | пусто → `null`; Pets: Pet-safe / Mildly toxic / Toxic |
| Published at / Published | `published_at`, `is_published` | дата — только сортировка, не планирование |
| SEO | `seo_title`, `seo_description` | значение = фолбэку (name / short) → `null` |

**Валидация публикации:** фото + alt, https-ссылка, ≥1 категория (черновику нужно только имя). Те же правила на сервере: RPC `save_product` (`23514`) и CHECK
`products_published_needs_photo_link` (0010).

**Подсказки редактора:** «Pet-safe → consider adding the Pet-friendly category» (без автоматики, S10); предупреждение, если у других товаров выбранных
категорий другая валюта (сайт скроет там фильтр Price, B-002). «View on site» у опубликованного товара — `frontendUrl` + `/product/<slug>`.

## 4. Сохранение — одна транзакция (RPC `save_product`)

`saveUgProduct(site, id|null, input, categoryIds)` → `rpc('save_product', { p_id, p_product, p_category_ids })` → `{ id }`: товар и связи категорий пишутся атомарно;
дубли id в массиве схлопываются, позиции плотные 0..n-1; `0` строк → `P0002`. `slug`, `created_at`, `updated_at` не отправляются. Форма на время Save заблокирована
(`<fieldset disabled>`), после успеха `form.reset(values)`; редактор — `gcTime: 0`. Коллизия имени (`23505`) → «That name is already taken…» (`humanizeError`).

## 5. Категории и бренды

- **Categories** (`TaxonomyManager` + `ShopCategoryEditDialog`): name, intro, картинка + стиль, SEO; порядок ↑↓ = порядок карточек на хабе. Счётчик = товары (по id).
  **Удаление блокируется**, если опубликованный товар остался бы без категорий: UI заранее называет товары (`publishedProductsOnlyInCategory`), БД страхует
  триггером `shop_categories_guard_delete` (`23514`, с блокировкой строк — 0010).
- **Brands**: name, порядок ↑↓, inline-rename; удаление → «N products will lose this brand» (FK `on delete set null`). Фильтр Brand на сайте показывается,
  когда у товаров категории есть бренды. ⚠️ Сейчас в БД два **примерных** бренда (миграция 0011) — заменить настоящими/удалить до запуска.

## 6. Чего нет (сознательно)

Папок у товаров (как у Cozy), markdown в описании, превью черновика (токены — Фаза 8), планирования публикации, свободного ввода валюты (B-002).

## 7. Тесты

`ugShop.test.ts` (RPC-payload, `mustAffect`, блок удаления категории, счётчики, усечение 1000 строк), `ugProductForm.test.ts` (правила публикации, https, цена, конвертеры, валюта, подсказки),
`UgProductEditPage.test.tsx` (публикация без ссылки блокируется, Save → payload, чужая валюта не теряется, подсказки, View on site, удаление с подтверждением),
`UgCategoriesField.test.tsx`, `shopCategoryForm.test.ts`, `ShopRoutes.test.tsx` (диспетчер по схеме; Cozy/Avocado не затронуты). Сквозной сценарий
«создать товар → виден на сайте» — ручная проверка владельцем (спека 3D §6): автоматически под админской сессией не гоняется.
