# Urban Gardener — Shop в web.admin (спека 3D)

> Статус: **ждёт утверждения владельцем** (2026-10-16; D2 решён владельцем: список валют). Остальные решения D1, D3–D6 — по моим рекомендациям, пока не оспорены. После «утверждаю» — impl-план `…-impl-plan-admin.md` и код в `web.admin` (ветка `feat/shop` уже создана).
> Контекст: [план Фазы 3](../plans/2026-10-15-phase-3-shop.md), [спека Фазы 3](2026-10-16-phase-3-shop-spec.md) (решения S1–S10), миграции `urban.gardener/supabase/migrations/0007–0010`
> (применены в base-one, проверены под ролями), образец — [articles-admin-design](2026-10-15-articles-admin-design.md) и контракт [articles-urban-gardener.md](../../../admin-panel/articles-urban-gardener.md).

**Цель.** Владелец ведёт магазин Urban Gardener из web.admin: товары (поля, фото, категории с порядком, бренд, цена, партнёрская ссылка, характеристики растения, SEO),
категории, бренды. Сайт видит правку через ≤1 мин (ISR). Без корзины и оплаты.

## 1. Объём

`src/config/sites.ts`, сайт `urban-gardener`: `sections: ["media", "products", "categories", "brands", "articles", "topics", "levels", "authors"]`.
Пункты меню `products` / `categories` / `brands` уже есть в `NAV_ITEMS` (их используют Cozy и Avocado); порядок меню: Media · Products · Categories · Brands · Articles · Topics · Levels · Authors.

| Раздел | Что делает | Основа |
|---|---|---|
| Products | список (поиск, фильтры: published/draft, категория; превью-фото, цена) + редактор товара | новая feature-папка `ug-products`, по образцу `ug-articles` |
| Categories | справочник: список, add / edit / delete, порядок ↑↓, счётчик товаров, delete с проверкой | `TaxonomyManager` + `ShopCategoryEditDialog` (имя, описание, картинка + стиль, SEO) |
| Brands | справочник: имя, порядок ↑↓, счётчик товаров, delete с предупреждением | `TaxonomyManager` (brand-конфиг для urban) |
| Media | в `USAGE_SOURCES` добавить `urban_gardener`: `products.image_path`, `shop_categories.image_path` | существующий `features/media` |

Маршруты `products`, `products/new`, `products/:productId`, `categories`, `brands` общие для всех сайтов; диспетчер выбирает страницу по `site.schema`
(как уже сделано для `articles`/`blog`): `urban_gardener` → новые страницы, Cozy/Avocado не затрагиваются.

## 2. Редактор товара

| Поле | Колонка | Контрол | Правило |
|---|---|---|---|
| Name | `products.name` | text | обязателен |
| Slug | `slug` | read-only (edit) / скрыт (create) | генерит триггер БД, не отправлять |
| Short | `short` | text | строка на карточке и meta description; пусто → `null` |
| Description | `description` | textarea (абзацы через пустую строку — подсказка) | пусто → `null` |
| Photo + Alt + Style | `image_path`, `image_alt`, `image_style` | `ImagePickerDialog` + text + select photo/cutout | alt обязателен при публикации; ключ бакета или внешний URL |
| Categories | `product_categories` | мультивыбор с порядком ↑↓: **первая = основная** | ≥1 для публикации; запись — через RPC |
| Brand | `brand_id` | Select из `brands` (+ «none») | необязательно |
| Price + Currency | `price`, `currency` | number ≥ 0 + select **EUR / USD / GBP** (по умолчанию EUR) | цена необязательна; пусто → `null` (блок цены на сайте скрыт) |
| Affiliate link | `affiliate_url` | text | **https-only** (подсказка, проверка zod); обязательна для публикации |
| Light / Water / Size | `light`, `water`, `size` | text | пусто → `null`; примеры значений в подсказке |
| Pet safety | `pet_safety` | select: — / Pet-safe / Mildly toxic / Toxic | подсказка: «Pet-safe → consider adding the Pet-friendly category» (автоматики нет, S10) |
| Published at | `published_at` | datetime | сортировка ленты |
| Published | `is_published` | switch | см. валидацию |
| SEO | `seo_title`, `seo_description` | text / textarea с подсказкой фолбэка (name / short) | значение = фолбэку или пусто → `null` |

**Валидация публикации.** Опубликованный товар требует: фото (+ alt), партнёрскую https-ссылку, ≥1 категорию. Черновик сохраняется без этого (нужно только имя).
Те же правила дублируются на сервере (RPC `save_product`, CHECK `products_published_needs_photo_link`): ошибка `23514` показывается человеческим текстом.

**Сохранение — один вызов RPC** `save_product(p_id, p_product jsonb, p_category_ids uuid[])` (товар и связи категорий в одной транзакции; ответ `{id}`).
`slug`, `created_at`, `updated_at` не отправляются. После Save форма пересинхронизируется свежими данными, `Save` заблокирован на время запроса.
Кнопка «View on site» для опубликованного товара (`frontendUrl` + `/product/<slug>`); превью черновиков — Фаза 8.

**Подводные камни БД (из ревью миграций):**
- Коллизия slug: два товара/категории/бренда с одинаковым названием дают `23505` → «A product/category/brand with this name already exists» (`humanizeError`).
- Позиции категорий пишет RPC (плотные 0..n-1; дубли в массиве схлопываются).
- Update по RPC перезаписывает все поля — форма всегда шлёт полный набор.
- Удаление товара: confirm; связи уходят каскадом БД; `mustAffect` на «0 строк» (товар удалён в другой вкладке / сессия истекла).

## 3. Категории и бренды

- **Категория** (диалог): name, description, картинка + `image_style`, SEO title/description; порядок ↑↓ (порядок карточек на хабе). Счётчик — число товаров.
  **Удаление:** диалог с числом затронутых товаров; **блокируется, если опубликованный товар остался бы без категорий** — UI заранее перечисляет такие товары, БД страхует триггером `23514`.
  Если удаляемая категория была основной у товара — предупредить, что основной станет следующая.
- **Бренд**: name, порядок ↑↓, счётчик товаров. Удаление: «N products will lose this brand» (в БД — `set null`).
- Фильтр Brand на сайте показывается, когда у товаров категории есть бренды. Сейчас в базе два **примерных** бренда (миграция `0011`, по просьбе владельца) — настоящие заводятся здесь, примерные удаляются до запуска.

## 4. Слой данных и файлы (web.admin)

- `src/lib/ugProducts.ts` — `listProducts`, `getProduct`, `saveProduct` (RPC), `deleteProduct`, `productUsage` для категорий/брендов; `src/lib/ugShopTaxonomy.ts` — категории и бренды (list/create/update/rename/reorder/delete/usage), ключи кэша `ugProductsKey` и пр.
  Доступ — `getDb(site)`; query-keys не форкать.
- `src/features/ug-products/` — `UgProductsPage`, `UgProductEditPage`, `UgCategoriesField` (мультивыбор с порядком, по образцу `UgTopicsField`), `ugProductForm.ts` (zod-схема публикации + чистые мапперы форма↔БД).
- `src/features/taxonomy/` — конфиги `ugShopCategoryConfig` / `ugBrandConfig`, `ShopCategoryEditDialog`; страницы-обёртки; диспетчер роутов по `site.schema`.
- Документация: `admin-panel/shop-urban-gardener.md` (контракт раздела), строка в `status.md`, `database/schema.md` (схема `urban_gardener`, 3F).

## 5. Решения на утверждение

| # | Вопрос | Рекомендация |
|---|---|---|
| D1 | Отдельная feature-папка `ug-products` или обобщить редактор товара Cozy/Avocado | **Отдельная**: модель другая (M2M-категории с порядком, RPC, характеристики растения, нет папок и markdown); общий редактор рискует регрессией живых сайтов. Общее (ImagePickerDialog, TaxonomyManager) — переиспользуем |
| D2 | Валюта в редакторе: свободный ISO-код или список | **Решено владельцем 2026-10-16: список EUR / USD / GBP** (по умолчанию EUR); расширяется одной строкой. Настраиваемая валюта сайта — [B-002](../../../backlog/B-002-configurable-currency.md) |
| D3 | Папки (как у Cozy) для товаров | **Нет** (решено в плане: на 9 товарах не нужны) |
| D4 | Подсказка «Pet-safe → добавьте Pet-friendly» | **Подсказка без автоматики** (S10: категория назначается вручную) |
| D5 | Порядок категорий товара: ↑↓ или drag-and-drop | **↑↓** — как у тем статей, без новой зависимости |
| D6 | Валюты в одной категории разные | Сайт скрывает фильтр Price (решено в плане); админка предупреждает в форме товара, если у категории уже есть товары в другой валюте |

## 6. Как проверит владелец (после реализации)

1. Products: создать товар (название, 2 категории, фото, цена, ссылка) → через минуту он на сайте в обеих категориях; основная категория (первая) — метка на фото и в крошках.
2. Снять публикацию → товар пропал с сайта; попытка опубликовать без фото/ссылки/категории — понятная ошибка.
3. Categories: изменить описание и картинку → видно на хабе `/shop`; удалить категорию, в которой единственный опубликованный товар → админка не даёт и называет товар.
4. Brands: создать бренд, назначить товару → на странице его категории появляется фильтр Brand; удалить бренд → предупреждение «N products will lose this brand».
5. Cozy и Avocado в админке работают как прежде (Products/Categories/Brands открываются, правка сохраняется).

## 7. Тесты (web.admin)

Unit: `ugProductForm` (zod-валидация публикации, https-ссылка, `null` для пустых, мапперы форма↔БД), `ugProducts`/`ugShopTaxonomy` (вызов RPC с нужным payload, `mustAffect`, usage-подсчёты, ошибка при сбое), порядок категорий.
Компонентные: `UgCategoriesField` (добавить/убрать/порядок/первая основная), `ShopCategoryEditDialog`, диспетчер роутов (urban → новые страницы, cozy/avocado → прежние), TaxonomyManager с новыми конфигами (счётчики, блокировка удаления).
Playwright: логин-смоук как есть; сквозной сценарий «создать товар → виден на сайте» — ручная проверка владельцем (п. 1 выше).
