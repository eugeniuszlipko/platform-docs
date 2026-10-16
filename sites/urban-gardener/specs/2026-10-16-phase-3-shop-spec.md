# Urban Gardener — Фаза 3 (Shop): спека для агента

> Адресат — исполняющий агент. План для владельца — [../plans/2026-10-15-phase-3-shop.md](../plans/2026-10-15-phase-3-shop.md) (шаблон мета-скилла). Эта спека **заменяет** прежний технический план Фазы 3 (2026-10-15);
> решения владельца 2026-10-16 (ниже) приоритетнее всего, что было раньше. Рабочая директория: `urban.gardener/` (3D — `web.admin/`). Референс UI: `urban.gardener/mockups/Urban Gardener.html`.
> **Структурный образец — CozyCorner** (код `cozycorner/`, документация `platform-docs/sites/cozycorner.md` §3–§5, `database/schema.md` §5): структура, фильтры, система страниц и админка — «точно такие же»; внешний вид — в стиле Urban Gardener (токены, примитивы).

## Решения владельца (журнал; все приняты 2026-10-15/16)

| # | Решение |
|---|---|
| S1 | **Категории — главная структура каталога**, как у CozyCorner: товар ↔ категории **many-to-many** (`product_categories`, с `position`: первая = основная). Категории на старте — бывшие «бейджи» референса: **Easy care, Low light, Pet-friendly, Statement**. Отдельной таксономии «бейджи» **нет**. Название категории на фото карточки = основная категория |
| S2 | **Бренды** — как у CozyCorner (справочник + поле у товара). В референсе брендов нет, на старте у всех 9 товаров бренд пуст; **фильтр Brand скрывается, пока ни у одного товара нет бренда**. Бренд = продавец/питомник (смысл уточнит владелец) |
| S3 | **Фильтры** на странице категории — выпадающие списки (нативные `<select>`), **как у CozyCorner: Brand и Price** (категория задана страницей, селект Category скрыт). Сброс/пустое состояние как у Cozy |
| S4 | **Хаб `/shop`** — не товары, а **карточки категорий с картинками** (как у Cozy: `CategoryGrid` + `CategoryCard`), шапка Urban (eyebrow + h1 + описание) **без фото-баннера**. Картинки категорий — обычные фото растений в скруглённых карточках; поле `image_style` (`photo`/`cutout`, как у Cozy) — задел под вырезанные PNG |
| S5 | **Страница категории** `/shop/<slug>`: шапка Urban без фото-баннера; **хлебные крошки внутри шапки, над eyebrow и заголовком** (как на странице статьи); фильтры; сетка с **бесконечной прокруткой** (порт `ProductGrid` Cozy: первая страница на сервере, остальные через `IntersectionObserver` + `.range()`, детерминированная сортировка `published_at desc, id desc`, дедуп по `id`) |
| S6 | **Страница товара** `/product/<slug>` — плоский адрес, как у Cozy (B-003: URL не меняем; canonical `/product/<slug>`); крошки Home / Shop / основная категория / товар (+ JSON-LD `BreadcrumbList` — в Фазе 8) |
| S7 | **Цена:** `price numeric(10,2)` + `currency` (ISO-4217, по умолчанию `EUR`) **у товара** (настраиваемая валюта — B-002, отдельная возможная фича). Форматирование — одна функция `formatPrice(price, currency)` через `Intl.NumberFormat`. Тексты «prices may change, check the retailer» + disclosure |
| S8 | **Disclosure:** на странице товара под кнопкой «Find on Amazon» + короткая строка внизу хаба `/shop`; текст — одна константа сайта (Фаза 5 перенесёт в `pages`) |
| S9 | **Related items** — автоподбор по общим категориям: основная категория → любая общая → свежие; текущий исключён (чистая функция) |
| S10 | Характеристики растения — **поля товара**: `light`, `water`, `size` (текст), `pet_safety` (`pet_safe`/`mildly_toxic`/`toxic`, nullable). **Только spec-list** на странице товара; категория «Pet-friendly» назначается вручную (согласованность с `pet_safety` — на редакторе; админка может подсказывать) |

## Что в референсе на самом деле (факты, проверено)

- 9 товаров: Monstera Deliciosa €34 · Golden Pothos €14 · Snake Plant €22 · ZZ Plant €26 · Calathea Orbifolia €29 · Peace Lily €19 · Aloe Vera €12 · Fiddle Leaf Fig €45 · Spider Plant €13. Поля: `name, price, badge, light, water, size, pet, short, desc, img`.
  Бейдж в референсе один: Statement (Monstera, Fiddle Leaf Fig), Easy care (Pothos, ZZ, Peace Lily, Aloe), Low light (Snake Plant), Pet-friendly (Calathea, Spider Plant — у них `pet = Pet-safe`).
- Страница товара: крошки, фото, бейдж, название, цена, `short`, `desc`, spec-list (в CSS есть, в разметке нет — выводим), «Find on Amazon →» во всю ширину, «Related items» (3), «Back to shop →».
- Картинки референса — Unsplash-URL, **часть не растения** (как у статей); подобрать рабочие фото заранее (способ — [kickoff](../plans/2026-10-15-phase-3-kickoff.md) «Картинки Unsplash»).

## Модель данных (схема `urban_gardener`, миграции с `0007`)

Общие правила как в Фазе 2 (uuid, `created_at`/`updated_at` с триггером, slug — триггер БД, пустые optional → `null`, RLS по шаблону 0002, `revoke`/явные политики, `check (btrim(name) <> '')`).

| Таблица | Поля | Чтение anon |
|---|---|---|
| `shop_categories` | `name` (unique), `slug` (unique), `description` (вводный абзац страницы), `image_path`, `image_style` (`photo`/`cutout`, default `photo`), `position`, `seo_title`, `seo_description` | все |
| `brands` | `name` (unique), `slug` (unique), `position` | все |
| `products` | `slug` (unique), `name`, `short`, `description` (абзацы через пустую строку), `image_path`, `image_alt`, `image_style` (default `photo`), `brand_id` → brands (**on delete set null**), `price numeric(10,2)` (nullable), `currency` (check `~ '^[A-Z]{3}$'`, default `EUR`), `affiliate_url` (check `~* '^https://'`), `light`, `water`, `size`, `pet_safety` (check 3 значения, nullable), `published_at`, `is_published`, `seo_title`, `seo_description` | только `is_published` |
| `product_categories` | PK `(product_id, category_id)`, `position`, cascade; индекс по `category_id` | только связи опубликованных товаров |

- Явный список публичных колонок `PUBLIC_PRODUCT_COLUMNS` (не `select('*')`).
- **RPC `save_product(p_id uuid, p_product jsonb, p_category_ids uuid[]) → jsonb {id}`** (`security invoker`, execute — `authenticated`/`service_role`): товар + связи категорий одной транзакцией; серверные правила публикации — **изображение, `affiliate_url`, ≥1 категория** (иначе `23514`); `0` строк → `P0002`. Образец — `0006_save_article_rpc.sql`.
- **Триггер защиты:** категорию нельзя удалить, если опубликованный товар остался бы без категорий (как `topics_guard_delete`); бренд при удалении обнуляется у товаров (`set null`) — админка предупреждает числом.
- Нумерация: `0007_shop_tables`, `0008_seed_shop`, `0009_save_product_rpc` (+ при необходимости hardening). Применять через MCP и **дублировать файл в репо**.
- **Сид** (генерировать из фикстур): 4 категории; 9 товаров по таблице назначений ниже; бренды пусты; `currency = EUR`, цены референса числом; `affiliate_url` — **плейсхолдеры** (поиск Amazon без партнёрского тега, например `https://www.amazon.de/s?k=monstera+deliciosa+plant`; реальные — владелец до запуска); `published_at` по убыванию.

| Товар | Категории (первая = основная) |
|---|---|
| Monstera Deliciosa | Statement |
| Golden Pothos | Easy care |
| Snake Plant | Low light, Easy care |
| ZZ Plant | Easy care |
| Calathea Orbifolia | Pet-friendly |
| Peace Lily | Easy care |
| Aloe Vera | Easy care |
| Fiddle Leaf Fig | Statement |
| Spider Plant | Pet-friendly, Easy care |

(Snake Plant получает вторую категорию Easy care, Spider Plant — Easy care: у референса один «бейдж», но M2M позволяет честнее; владелец правит в админке. Аргумент в «Что решил сам» плана.)

## Маршруты, рендер, SEO

- `/shop`, `/shop/[category]`, `/product/[slug]`: SSG + ISR `revalidate = 60`, `generateStaticParams`, неизвестный slug → `notFound()`.
  **`loading.tsx` — только у хаба `/shop` через route group `app/shop/(hub)/`; у `[category]` и `product/[slug]` его НЕТ** (стриминг даёт 200 вместо 404 — урок Фазы 2). `searchParams` в страницах не используем (фильтры — клиентские, состояние в `useState`/URL через `history.replaceState`).
- **Шапка страниц:** `PageHead` получает слот/проп `breadcrumb` (крошки над eyebrow) — править компонент `components/ui/PageHead` и его тест; страница статьи не затрагивается.
- **Хаб:** eyebrow «Shop», h1 «Plants we'd put on our own windowsill», описание референса; сетка `CategoryCard` (фото, имя, `role`-ссылка, `aria-label`), disclosure-строка внизу.
- **Категория:** eyebrow «Category», h1 = `name`, описание = `description`; фильтры Brand/Price (как `FiltersBar` Cozy; диапазоны цен — константа в «единицах валюты каталога»: `<15 · 15–30 · 30–50 · 50+`; символ валюты берётся у товаров; **если в выборке разные валюты — фильтр Price скрывается** (B-002)); пустое состояние + сброс; фокус после сброса на первый select; до гидрации селекты `disabled`.
- **Карточка:** фото (+ метка основной категории), `name`, `short`, цена (`formatPrice`), кнопка «Find on Amazon →» (`rel="sponsored noopener noreferrer"`, `target="_blank"`) поверх растянутой ссылки карточки; без цены/ссылки — блоки скрыты.
- **Товар:** крошки → фото (`preload`, LCP) → название → цена + «Prices may change — check the retailer» → `short` → `description` → spec-list (`dl`: Light/Water/Size/Pets) → «Find on Amazon →» → disclosure → «Related items» → «Back to shop →».
- **Метаданные:** title (`seo_title ?? name`), description (`seo_description ?? short`), canonical без query, OpenGraph; категории — `seo_*` с автоформулой; пустая категория → `noindex`. JSON-LD (`Product`, `BreadcrumbList`) — Фаза 8.
- **Навигация:** в `NAV` у Shop `matches: ['/product']`; футер: «Shop plants» → `/shop`; ссылки на категории — реальные slug'и; `KNOWN_ROUTES` и тест обновить.
- **Безопасность ссылок:** `affiliate_url` рендерится только если `getLinkKind === 'external'` (https); в `SmartLink` добавить опцию `sponsored` (rel с `sponsored`) + тест.
- **Картинки:** `resolveImage` (есть); внешние Unsplash — `unoptimized`; `sizes` под сетку 3/2/1; `image_style: cutout` → `contain` на белой плитке (как Cozy).

## Шаги

Каждый шаг завершается зелёными `lint`, `test`, `build`; коммиты/пуши — только по команде владельца. API Next 16 / Supabase сверять с `node_modules/next/dist/docs/` и Context7. Перед кодом **прочитать код Cozy**: `components/{ShopCatalog,FiltersBar,ProductGrid,CategoryGrid,CategoryCard,ProductCard,ProductDetail,Breadcrumbs}.tsx`, `lib/{products,categories}.ts`, `app/shop/**`, `app/product/**`.

- **3A. Фронт на тестовых данных:** `lib/shop.types.ts`, `lib/shop.fixtures.ts` (9 товаров, 4 категории), `lib/shop-utils.ts` (`toProductCard`, `primaryCategory`, `formatPrice`, `priceRanges`/`filterByPrice`, `pickRelatedProducts`, `petLabel`, SEO-fallback'и); компоненты `components/shop/` (порт Cozy + Urban-стиль); страницы; `PageHead` + `breadcrumb`; на стенд `/design`. Подобрать рабочие фото (9 товаров + 4 категории).
- **3B. Миграции и сид:** 0007–0009; SQL-проверка прав под ролями (anon / не-админ / админ), `get_advisors`, ревью `database-reviewer`.
- **3C. Фронт на БД:** `lib/shop.ts` (+ `shop.mappers.ts`), `throw` на ошибку, `cache()`, явные колонки; страницы, `generateStaticParams`, метаданные; ревью `silent-failure-hunter`.
- **3D. Админка** — сначала спека `specs/…-shop-admin-design.md` и **утверждение владельцем**: как у Cozy — Products, Categories, Brands (+ `sites.ts` `sections`; коллизии ключей меню `products`/`categories` у Avocado/Cozy решаются диспетчером по `site.schema`); сохранение товара только `save_product`; `TaxonomyManager` (`config.usage`) для Categories/Brands; модалка категории (описание, картинка, `image_style`, SEO); валидация публикации; уроки Фазы 2 (форма блокируется на Save, `gcTime: 0` + `key`, `mustAffect`).
- **3E. Тесты:** unit (мапперы, фильтры, цена/валюта, related, форма админки, RPC-вызов), компонентные (карточка, фильтры, бесконечная прокрутка с моком `IntersectionObserver`, крошки в PageHead, FindButton), e2e `e2e/shop.spec.ts` (сидовые по названиям, не по числам; 404 на `/product/nope`, `/shop/nope`; canonical; 390px; `rel="sponsored"`).
- **3F. Ревью-гейт и документация:** `database-reviewer`, `react-reviewer`, `typescript-reviewer`, `silent-failure-hunter`, `a11y-architect`, `seo-specialist`; `schema.md`, `urban-gardener.md` (решения), roadmap, AGENTS.md репо, `phase-x-checklist.md`, отчёт в конце плана.

## Подводные камни

- `loading.tsx` на динамических маршрутах = soft-404; `searchParams` в странице = динамика; клиентская сетка помнит фильтр (`key` по категории).
- Партнёрские ссылки: только https, `rel="sponsored noopener noreferrer"`; плейсхолдеры нельзя оставить на проде (Фаза 9/X).
- «0 строк» update/delete — ошибка; сохранение — только RPC; гонки удаления категории — триггер БД.
- Не менять URL-ы CozyCorner (B-003); правка крошек Cozy — отдельно (B-001), в Фазу 3 не входит.
- Скролл-контейнеры (если появятся) — `useOverlayScrollbar` (D25).
