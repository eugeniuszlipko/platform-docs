# База данных — Supabase (все сайты)

> Last updated: 2026-08-27 | Source project: cozycorner (CLAUDE.md, docs/admin-app-spec.md, docs/page-content.md, docs/multisite-migration.md) + web.admin

Единый источник правды о структуре БД и контрактах с данными. Схема **версионируется
миграциями в репозитории `cozycorner/supabase/migrations/`** — менять её из других мест
нельзя (см. §7).

## 1. Проект и подключение

| Параметр | Значение |
|---|---|
| Supabase-проект | **base-one** |
| Project ref | `zwrkphynupdubevzwdzy` |
| Project URL | `https://zwrkphynupdubevzwdzy.supabase.co` |
| Publishable (anon) key | `sb_publishable_Xilw_s7Be73d0Q2ryqxodA_1AeIqdKJ` (публичный, защита — RLS) |
| Схема сайта CozyCorner | `cozycorner` (добавлена в Exposed schemas) |
| Storage-бакет CozyCorner | `cozycorner-photos` (плоские ключи) |
| Схема сайта Avocado Kiss | `avocado_kiss` (добавлена в Exposed schemas) |
| Storage-бакет Avocado Kiss | `avocado-kiss-photos` (плоские ключи) |

- Переезд со старого проекта `nkaobsivfzsjqypuaamw` выполнен 2026-07-16: миграции
  среплеены, данные и Storage перенесены, md5-суммы таблиц сверены, RLS проверен.
  Экспорт-снапшот и импорт-скрипт — `~/Documents/Projects/cozycorner-migration/`.
- Старый проект живёт только как откат. Финализация (этап G, по команде пользователя):
  удалить старый проект, его MCP-сервер `supabase` из `~/.claude.json` и бэкап
  `~/.claude.json.bak-migration`; папку `cozycorner-migration/` архивировать.
  Ротация secret key, использованного для импорта, — на пользователе.
- **Service-role ключ не нужен ни сайту, ни админке.** Никогда не класть `sb_secret_…`
  в переменные с префиксом `NEXT_PUBLIC_*` / `VITE_*` — он уедет в браузер.

## 2. Мультисайт-архитектура

Один Supabase-проект держит несколько сайтов (экономия на подписке; расселение по
отдельным проектам — когда упрёмся в лимиты Free: 500 MB БД / 1 GB Storage / 5 GB egress).

- **Схема на сайт**: `cozycorner.*`, `<site2>.*` — внутри обычные имена таблиц
  (`products`, `posts`, …) без префиксов. Принадлежность данных сайту читается из имени
  схемы (в т.ч. для Supabase MCP/коннектора Claude).
- **Бакет на сайт**: `cozycorner-photos`, `<site2>-photos`. Чтение публичное, запись —
  политики на `storage.objects` через `is_admin()`.
- **Общее для админки — в `public`**: `admin_users` (whitelist) + `is_admin()`.
- **Настройка новой схемы** (иначе PostgREST → permission denied / 406):
  1. добавить схему в **Exposed schemas** (Project Settings → Data API) — ручной шаг;
  2. в миграции: `GRANT USAGE ON SCHEMA` + `GRANT SELECT` для `anon`, полный доступ
     `authenticated` (под RLS) + `ALTER DEFAULT PRIVILEGES`;
  3. supabase-js: сайт — `db: { schema: '<site>' }`; админка — `.schema('<site>')` per-query.
- Мультипроект (на будущее): у каждого Supabase-проекта своя Auth (JWT непереносимы) —
  админ-логин заводится в каждом проекте, клиент per-project со своим `auth.storageKey`;
  каждому проекту нужен свой Supabase-коннектор/MCP (project ref).

## 3. Модель доступа (Auth + RLS)

- `public.admin_users(user_id uuid pk → auth.users, email, created_at)` — whitelist
  админов (миграция 0016). `public.is_admin()` → boolean (SECURITY DEFINER): true, если
  текущий `auth.uid()` есть в `admin_users`.
- **Чтение контента**: публичный `select` для `anon` (исключения ниже). **Запись**:
  `authenticated` при `is_admin()` — или service role / дашборд. Storage-бакет сайта:
  публичное чтение; запись/удаление — `is_admin()`.
- Ограничения чтения: `posts` — анону только `is_published = true`; секции постов и
  hero-секции — только опубликованные; `media` и `admin_folders` — публичного чтения
  НЕТ (весь CRUD только под админом). Колонка `posts.preview_token` НЕ выдаётся `anon`:
  у роли снят табличный `select` на `posts` и выдан column-level `select` на все колонки
  КРОМЕ `preview_token` (0031). ⚠️ Урок: column-level `revoke select (col)` НЕ
  перекрывает табличный `grant select` (0030 оказалась пустышкой) — чтобы скрыть колонку,
  надо снять табличный грант и выдать column-level на остальные. Из-за этого анон-выборки
  постов используют явный список колонок (`PUBLIC_POST_COLUMNS`), а не `select("*")`
  (иначе анонный `select *` упал бы на `preview_token`). Доступ к токену — только
  service-role (превью) и authenticated-админ (RLS).
  ⚠️ Диагностика: anon-запросы к `media` ВСЕГДА возвращают 0 строк, даже когда данные
  есть, — проверять содержимое через SQL Editor / MCP / Management API (роль postgres).
- Auth: Email-провайдер включён, публичная регистрация закрыта; 2 админа заведены и
  внесены в whitelist (eugeniusz.lipko@gmail.com, yury.brankovsky@gmail.com).
- Security advisor: осознанные WARN — public-bucket listing; `is_admin` executable
  (для анона всегда false); рекомендация включить leaked password protection.

## 4. Контракт путей картинок (критично, общий для сайта и админки)

Все поля `*image_path*` хранят **относительный плоский ключ** внутри бакета сайта
(например `product-1.png`, без вложенных папок) ИЛИ **внешний URL** (Amazon, Unsplash —
как есть). **Абсолютные URL нашего Storage как формат хранения запрещены** — тогда
переезд на другой Supabase-проект = смена одной переменной, ссылки не бьются.

- Публичный URL строится на лету: `${projectUrl}/storage/v1/object/public/${bucket}/${path}`.
- Разбор: сайт — `resolveProductImage()` (`cozycorner/lib/products.ts`); админка —
  `resolveImageUrl` / `toStoragePath` (`web.admin/src/lib/images.ts`).
- При записи из админки в БД попадает **только относительный ключ**, никогда полный URL.

## 5. Таблицы схемы `cozycorner`

Общие соглашения (везде): `slug` автогенерируется БД-триггером из `title`/`name`, если
пуст — при insert slug не отправлять; `updated_at` обновляется триггером — вручную не
задавать; пустые optional-поля пишутся как `null`, не пустой строкой.

### products — товары

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid (pk) | идентификатор |
| `created_at` | timestamptz | сортировка (новые первыми) |
| `title` | text | название товара |
| `price` | numeric(10,2) | цена (сайт форматирует `formatPrice`, USD) |
| `image_path` | text | ключ в бакете или внешний URL (§4) |
| `referral_url` | text | реферальная ссылка «где купить» |
| `brand` | text (nullable) | бренд — фильтрация (индекс) |
| `slug` | text (unique, not null) | kebab-slug для `/product/[slug]`; автоген из `title` |
| `description` | text (nullable) | **Markdown** (подмножество: абзацы пустой строкой, списки `-`/`1.`, `**bold**`, `*italic*`; без ссылок/заголовков/кода). Старый плоский текст валиден как есть |
| `image_style` | text (not null, default `photo`) | `photo` — «живое» фото, cover во всю плитку; `cutout` — товар без фона/на белом, contain с паддингами на белой плитке |
| `seo_title` / `seo_description` | text (nullable) | SEO-оверрайды; пусто = фолбэк на `title`/`description` |
| `folder_id` | uuid (nullable, FK → admin_folders) | папка админки (§5 admin_folders); сайт поле не читает |

Категория(и) товара — **many-to-many** через `product_categories` (см. ниже). Прежней
колонки `products.category` больше нет (миграция 0028); товар может быть в 0..N категориях.

### categories — категории каталога

Источник карточек `/shop` и страниц `/shop/[slug]`. Товары связаны с категориями
**many-to-many** через `product_categories` (по `category_id`, см. ниже).

| Поле | Тип | Назначение |
|---|---|---|
| `id`, `created_at` | uuid pk, timestamptz | служебные |
| `name` | text (unique, not null) | отображаемое имя категории |
| `slug` | text (unique, not null) | для `/shop/[category]`; автоген из `name` |
| `image_path` | text (nullable) | **всегда cutout** (PNG с прозрачным фоном) — карточка на `/shop` |
| `position` | integer (not null, default 0) | порядок карточек |
| `hero_badge` / `hero_title` / `hero_description` | text (nullable) | hero страницы категории; пусто — фолбэки в коде (`Category` / `name` / автоформула) |
| `hero_image_path` | text (nullable) | фон hero; пусто — фолбэк на фон hero `/shop` |
| `seo_title` / `seo_description` | text (nullable) | SEO; пусто — автоформула из `name` |

### product_categories — связь товар↔категория (M2M)

Членство товаров в категориях (миграция 0027) — пришла на смену текстовой
`products.category`: товар может принадлежать нескольким категориям.

| Поле | Тип | Назначение |
|---|---|---|
| `product_id` | uuid (FK → products, on delete cascade) | товар |
| `category_id` | uuid (FK → categories, on delete cascade) | категория |

PK — `(product_id, category_id)`; индекс по `category_id` (выборка товаров категории).
RLS: public read (anon+authenticated), запись — `authenticated` + `public.is_admin()` —
как у products/categories. Удаление товара или категории чистит связи каскадом (FK), поэтому
переименование/удаление категории в админке больше не каскадит в товары (членство — по id).
Фронт `/shop/[category]` и связанные выборки фильтруют через inner-join
(`product_categories!inner`); админка правит связи в редакторе товара (чипы категорий) и
на странице категории (add/remove).

### brands — бренды каталога

Справочник брендов (как categories, но без картинки/hero/seo). Товары привязаны по имени:
`products.brand = brands.name`. FK нет сознательно — как у категорий.

| Поле | Тип | Назначение |
|---|---|---|
| `id`, `created_at` | uuid pk, timestamptz | служебные |
| `name` | text (unique, not null) | отображаемое имя; ключ связи с товарами |
| `slug` | text (not null) | автоген из `name` (триггер `brands_set_slug`, функция в `public`) |
| `position` | integer (not null, default 0) | порядок в списках |

RLS: `Public read brands` (SELECT anon+authenticated) + `Admin write brands` (ALL
authenticated, `public.is_admin()`) — как у categories. Миграция `0023_brands` засевает
таблицу уникальными `products.brand`. Переименование/удаление бренда в админке каскадит
в `products.brand` на уровне приложения (FK нет).

### posts — блог и SEO-посты

Архив `/blog`; single `/blog/[slug]`. RLS чтения: анону только опубликованные.

| Поле | Тип | Назначение |
|---|---|---|
| `id`, `created_at`, `updated_at` | — | служебные |
| `published_at` | timestamptz | дата публикации: сортировка архива |
| `is_published` | boolean | черновики скрыты от анона |
| `slug` | text (unique, not null) | автоген из `title` |
| `post_type` | text (not null, default `blog`) | `blog` — обычный пост; `seo` — programmatic-SEO-пост: скрыт из лент и поиска, открывается по прямому URL, включён в sitemap. **Без cloaking**: редиректы / UA-логика / noindex запрещены |
| `title` / `excerpt` / `content` | text | заголовок / анонс / **легаси-поле `content` не читать и не писать** (тело поста — секции) |
| `cover_image_path` | text (nullable) | обложка (§4) |
| `seo_title` / `seo_description` | text (nullable) | пусто = фолбэк `title`/`excerpt` |
| `folder_id` | uuid (nullable) | папка админки |
| `preview_token` | uuid (not null, default `gen_random_uuid()`) | capability-токен превью черновика (0029). НЕ флаг видимости. Анону НЕ выдаётся (column-grant, 0031) — читается только service-role клиентом на роуте `/preview/blog/[slug]` |

### post_text_sections + post_product_sections — секции поста

Модель «таблица на тип секции». Общие поля: `post_id` (fk → posts, on delete cascade),
`position`, `is_published` (RLS отдаёт только опубликованные), timestamps.
**`position` — сквозная нумерация через ОБЕ таблицы**: сайт сливает их и сортирует.

- `post_text_sections`: `heading` (h2, nullable), `body` (Markdown, абзацы пустой строкой).
- `post_product_sections`: `heading` (nullable), `columns` (2|3, default 3),
  `product_ids uuid[]` — реальные id из `products`, порядок массива = порядок карточек.

### recipe_related — «Read also» страницы рецепта (миграция 0021)

Ручные пины блока рекомендаций рецепта. Зеркалит `post_related`, но полиморфна на
**три** типа: `id`, `recipe_id` (FK → recipes, on delete cascade — источник),
`position`, `related_recipe_id` (FK → recipes), `post_id` (FK → posts),
`product_id` (FK → products) с check `num_nonnulls(related_recipe_id, post_id,
product_id) = 1` и check `recipe_related_no_self` (`related_recipe_id <>
recipe_id`). Индекс `(recipe_id, position)`. Публичное чтение `using (true)`;
запись — админ. **Применена 2026-08-26**; проверено на проде:
`has_table_privilege(anon, …, 'select')` = true, insert = false, RLS включён,
2 политики.

⚠️ Unique-констрейнта на полиморфные колонки нет (как и в `post_related`) —
от дублей защищает админка: пикеры исключают уже закреплённые id.

### Общий резолвер рекомендаций (сайт)

Все четыре таблицы пинов (`post_related`, `recipe_related`, `product_pairings`,
`product_reading`) читает ОДИН алгоритм — `avocado.kiss/lib/relations.ts`
(`resolveRelated`): пины по `position` → авто-подбор по скорингу (общая
категория +3, общий тег +2 с потолком 4, тот же тип контента +1, тай-брейк
`published_at desc`) → детерминированный случайный фолбэк (seeded по id
источника), чтобы блок не пустел. Единая таблица `content_relations`
намеренно НЕ вводилась: унифицирован слой алгоритма, а не хранилище — так
сохранены FK-каскады и RLS. Подробности — [../sites/avocado-kiss.md](../sites/avocado-kiss.md) §13.

### pages — страницы + SEO

Фиксированный набор из 7 строк (`home`, `shop`, `blog`, `terms`, `privacy`, `about`,
`featured`) — задан кодом сайта; create/delete страниц нет.

| Поле | Тип | Назначение |
|---|---|---|
| `id`, timestamps | — | служебные |
| `slug` | text (unique) | ключ страницы (на нём маршруты сайта — read-only) |
| `seo_title` / `seo_description` | text | `<title>`+og:title / meta+og:description |
| `og_image_path` | text | картинка для соцсетей (§4) |
| `body` | text (nullable) | **Markdown-тело**, сейчас только `terms`/`privacy`; NULL → сайт показывает встроенный текст (безопасный фолбэк) |
| `meta` | jsonb | произвольные мета-теги; **контракта нет — не читать и не писать** (везде `{}`) |

### hero_sections — hero статических страниц

`page_id` (fk → pages, cascade), `position`, `is_published`, `badge` (nullable),
`title` (not null), `description` (nullable), `bg_image_path` (nullable, §4),
`align` (`left`|`right`, default `right`) — положение текстовой карточки.
Набор секций управляется миграциями; админка делает только update существующих.

### footer_settings — текст футера (singleton, одна строка)

`tagline`, `newsletter_title`, `newsletter_subtitle`, `disclaimer`, `copyright`.
⚠️ `disclaimer` содержит обязательную по Amazon Associates формулировку «As an Amazon
Associate we earn from qualifying purchases» — она должна оставаться на каждой странице
с реф-ссылками (футер глобальный — условие выполняется).

### header_settings — настройки шапки (singleton, одна строка)

Сайт-глобальные параметры шапки (миграция 0024, сразу в схеме `cozycorner`).
`id`, `created_at`, `updated_at`, `instagram_url` (nullable). Сайт читает первую
строку (`fetchHeaderSettings`, `lib/content.ts`) и передаёт `instagram_url` в
`<Header>` через `app/layout.tsx`; пусто/ошибка → иконка Instagram не рендерится
(безопасный фолбэк, как у footer). ⚠️ `app/layout.tsx` держит `export const
revalidate = 60` — иначе значение запекается в статический шелл и правки из админки
не видны до редеплоя (см. [../sites/cozycorner.md](../sites/cozycorner.md) §2).
RLS: публичное чтение + запись `is_admin()`.
Правится в админке разделом Pages → строка «Header» (`web.admin`, `src/lib/header.ts`
+ `features/pages/HeaderEditPage.tsx`). Таблица заведена с прицелом на рост — новые
параметры шапки = новые колонки.

### about_content — контент страницы /about (singleton, одна строка)

Управляемый контент статической страницы `/about` (миграция 0026, схема `cozycorner`).
Страница — фиксированный набор неповторяющихся секций (intro / story / три
карточки-ценности), поэтому это **singleton-таблица «колонка на поле»** (как
`footer_settings`/`header_settings`), а НЕ типизированные `*_sections` (те — под
повторяющиеся блоки). Новая секция/поле About = новая колонка, не новая строка.

Поля (все `text`, nullable — пусто → сайт показывает встроенный фолбэк секции):
`id`, `created_at`, `updated_at`, `eyebrow`, `heading`, `intro` (секция 1);
`story_heading`, `story_body_1`, `story_body_2`, `story_image_path` (секция 2, путь —
контракт §4); `card1_icon`/`card1_title`/`card1_text` … `card3_*` (три карточки,
`*_icon` — эмодзи-строка). RLS: публичное чтение + запись `is_admin()`; `updated_at`
триггером; сид одной строкой с дефолтным контентом. Сайт читает первую строку
(`fetchAboutContent`, `cozycorner/lib/content.ts`) и рендерит секции
`components/about/*` с фолбэками. Правится в админке разделом Pages → страница About
(`web.admin`, `src/lib/about.ts` + `features/pages/AboutContentEditor.tsx`, встроен в
`PageEditPage` — один Save на SEO + hero + контент About). Новое поле `story_image_path`
учтено в `USAGE_SOURCES` админки.

### media — метаданные загруженных файлов

Источник истины для списка в медиа-менеджере админки (не Storage).
`id`, `created_at`, `original_name` (исходное имя, меняется только оно при rename),
`path` (unique, плоский ключ в бакете), `mime`, `size`, `folder_id` (nullable).
RLS: весь CRUD — только `is_admin()`, публичного чтения нет. FK с `products` нет:
«использование» вычисляется сравнением строк `path` ↔ поля `*image_path*`.

### admin_folders — папки админки (организационная сущность админки, не сайта)

`id`, `created_at`, `section` (`'media' | 'products' | 'posts' | 'seo_posts'`), `name`;
`unique(section, name)`; RLS admin-only. В контентных таблицах — nullable
`folder_id uuid references admin_folders(id) on delete set null` + индекс: удаление
папки не удаляет элементы (уходят в Unsorted через FK). Сайт таблицу не читает; у
products/posts `folder_id` виден anon-выборкам (просто uuid — принято осознанно).
Секция `seo_posts` в `SECTION_TABLES` указывает на таблицу `posts` (имя секции ≠ таблице).

### subscribers — подписчики рассылки

Реальный сбор email из формы подписки в футере (`NewsletterForm`, миграция 0025).
`id`, `email` (`unique`, регистронезависимо — сервер пишет в lower-case),
`created_at`. Данные минимальны (GDPR): без IP/имени. Запись — ТОЛЬКО серверным
действием `lib/newsletter.ts` под `service_role` (обходит RLS) ПОСЛЕ проверки
Cloudflare Turnstile (режим Invisible), поэтому запись реально гейтится, а не
только UI. Ключи: `SUPABASE_SERVICE_ROLE_KEY` (server-only, вернулся ради этого
действия), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`. RLS:
публичных политик нет (анон не видит и не пишет — дефолтный `select` анону снят
явным `revoke`), единственная политика `Admin manage subscribers` (`is_admin()`)
— просмотр/удаление/экспорт CSV в админке (раздел Subscribers,
[../admin-panel/subscribers.md](../admin-panel/subscribers.md); право на забвение).
Privacy Policy (`pages.body`,
slug=`privacy`) ссылается на Turnstile Privacy Addendum — обязательное условие
Invisible-режима.

## 6. История миграций (репозиторий cozycorner, `supabase/migrations/`)

0001 init (products, legacy bucket) · 0002 bucket photos (legacy) · 0003 media ·
0004 pages + hero_sections · 0005 products.brand/category · 0006 footer_settings ·
0007 products.slug/description + slugify() · 0008 hero align + сид shop · 0009 posts ·
0010 секции постов · 0011–0012 демо-сиды · 0013 products.image_style · 0014 categories ·
0015 hero/seo-поля (categories/products/posts/pages-сиды) · 0016 admin_users + is_admin ·
0017 схема cozycorner (перенос 9 таблиц из public + гранты + write-RLS) ·
0018 bucket cozycorner-photos · 0019 pages.body · 0020 posts.post_type ·
0021 admin_folders + media.folder_id · 0022 products/posts.folder_id ·
0023 brands (справочник, сид из products.brand; RLS public read + admin write) ·
0024 header_settings (singleton настроек шапки, поле instagram_url; RLS public read +
admin write; сид одной пустой строкой) ·
0025 subscribers (email подписки на рассылку; `unique` email; RLS без публичных
политик — запись под service_role после проверки Turnstile, чтение/удаление только
admin) ·
0026 about_content (singleton-контент страницы /about: intro/story/три карточки,
колонка на поле; RLS public read + admin write; сид одной строкой с дефолтным
контентом) ·
0027 product_categories (связь товар↔категория M2M: PK `(product_id, category_id)`,
FK on delete cascade, RLS public read + admin write; бэкфилл из `products.category` по
имени — 50 связей) ·
0028 drop products.category (модель категорий стала M2M — текстовая колонка удалена) ·
0029 posts.preview_token (capability-токен превью черновика; `uuid not null default
gen_random_uuid`, бэкфилл существующих строк автоматом) ·
0030 revoke select(preview_token) от anon — **нерабочая попытка**: column-level revoke
НЕ перекрывает табличный grant select, эффекта нет (has_column_privilege остался true) ·
0031 корректный отзыв: `revoke select on posts` от anon + `grant select` на все колонки
КРОМЕ preview_token (применён ПОСЛЕ деплоя явных колонок в анон-выборках — иначе анонный
select упал бы; проверено: `has_column_privilege(anon, preview_token) = false`).

Нюанс хронологии: 0021 (`add_admin_folders`) и 0022 (`add_content_folders`) применены
к base-one 2026-07-16 через MCP из админки **до** 0020 (`add_seo_post_type`) — файлы
добавлены в репозиторий задним числом (2026-07-17), когда номера 0019/0020 уже были
заняты. Взаимный порядок 0021 → 0022 соответствует порядку применения; все три файла
идемпотентны, реплей безопасен.

## 7. Изменение схемы — workflow

1. Новый файл миграции в `cozycorner/supabase/migrations/` (таблицы контента — в схеме
   сайта; общее для админки — в `public`). Из админки/чата схему можно применить через
   Supabase MCP `apply_migration` — но файл миграции ОБЯЗАТЕЛЬНО продублировать в
   репозитории сайта сразу же (прецедент отложенных дублей — 0021/0022, §6).
2. Применить к проекту (MCP / дашборд / CLI).
3. Синхронизировать типы сайта `cozycorner/lib/types.ts` (Product/Category/Post).
4. Новые поля `*image_path*` → добавить в `USAGE_SOURCES` админки
   (`web.admin/src/lib/media.ts`), чтобы «used by» оставался точным.
5. Обновить этот файл.

Как добавить новый тип секции страницы/поста: `create table <name>_sections`
(`id`, timestamps, `page_id`|`post_id` fk, `position`, `is_published`, типизированные
поля) + индекс по fk + updated_at-триггер + RLS публичного чтения опубликованных;
тип и загрузка — `cozycorner/lib/content.ts` (или `lib/posts.ts`), компонент секции,
подключение в page.tsx по `position`; обновить этот файл.

## 8. Диагностика (после переезда / при странностях)

1. Media-раздел пуст или «used by» не видит фото → RLS: `media` admin-only, anon видит
   0 строк — это норма, проверять от postgres.
2. Логин в админку не проходит → учётки существуют только в base-one; сброс пароля
   требует прод-URL админки в Auth → URL Configuration (Redirect URLs) — pending.
3. Картинки не отображаются → пути в БД должны быть относительными; если в данных
   всплыл ref старого проекта — это баг данных, чинить путь на относительный.
4. MCP отвечает про старый проект → проверить `--project-ref` в `~/.claude.json`;
   после правки — перезапуск сессии.
5. PostgREST «permission denied» / пустая схема → схема в Exposed schemas + гранты (0017).
6. Прямой SQL без MCP: Management API
   `POST https://api.supabase.com/v1/projects/zwrkphynupdubevzwdzy/database/query`
   с personal access token. Нюанс: python-urllib режется Cloudflare (403/1010) — curl.
7. Быстрая проверка, из какой БД собран прод сайта:
   `curl -sL <прод-URL> | grep -o '<project-ref>'` — в HTML зашиты Storage-URL.

## 9. Таблицы схемы `avocado_kiss`

Второй сайт платформы (репозиторий `avocado.kiss/`, миграции —
`avocado.kiss/supabase/migrations/`). Схема **зависит от общих функций
`public.slugify`, `public.set_updated_at`, `public.is_admin`**, введённых
миграциями cozycorner 0007/0004/0016 — это тот же проект base-one, функции
уже есть, отдельно заводить не нужно. Те же общие соглашения, что в §5:
`slug` автогенерируется триггером из `title`/`name` (при insert не отправлять,
если пуст), `updated_at` — триггером, пустые optional-поля — `null`, пути
картинок — контракт §4. ⚠️ **Гранты `recipes`/`posts`:** у `anon` снят
табличный `select` и выдан column-level `select` на все колонки КРОМЕ
`preview_token` (0020) — поэтому анон-выборки этих таблиц обязаны перечислять
колонки явно (`lib/columns.ts` → `PUBLIC_RECIPE_COLUMNS` / `PUBLIC_POST_COLUMNS`),
а не `select("*")`; иначе «permission denied for column preview_token». Касается и
embed'ов (`recipe:recipes!inner(...)`). Доступ к токену — только service-role
(роуты `/preview/*`) и authenticated-админ. Фаза B (секции админки `web.admin` под эту схему) не
реализована — сейчас правка данных только напрямую в БД.

### recipes — рецепты

| Поле | Тип | Назначение |
|---|---|---|
| `id`, `created_at`, `updated_at` | uuid pk, timestamptz | служебные |
| `published_at` | timestamptz | дата публикации, сортировка лент |
| `is_published` | boolean (default false) | RLS: анону только опубликованные |
| `title` | text (not null) | название |
| `slug` | text (unique, not null) | для `/recipes/[slug]`; автоген из `title` |
| `excerpt` | text (nullable) | анонс (хедер рецепта, фолбэк описаний карточек) |
| `category` | text (nullable) | = `categories.name` (текст, FK нет — паттерн products/cozycorner; индекс) |
| `author_name` | text (nullable) | «by Mark P.» |
| `time_label` | text (nullable) | «45 minutes» — готовая строка |
| `servings_label` | text (nullable) | «4 servings» — готовая строка |
| `hero_image_path` | text (nullable) | ключ бакета `avocado-kiss-photos` или внешний URL (§4) |
| `ingredients` | text[] (not null, default `{}`) | порядок массива = порядок списка (не отдельная таблица) |
| `steps` | text[] (not null, default `{}`) | порядок массива = номера шагов 01, 02, … (не отдельная таблица) |
| `seo_title` / `seo_description` | text (nullable) | пусто = фолбэк `title`/`excerpt` |
| `folder_id` | uuid (nullable, FK → admin_folders, on delete set null) | папка админки |
| `preview_token` | uuid (not null, default `gen_random_uuid()`) | capability-токен превью черновика (0019). НЕ флаг видимости. Анону НЕ выдаётся (column-grant, 0020) — читается только service-role клиентом на роуте `/preview/recipes/[slug]` |

### recipes — рейтинги (звёзды)

Оценки рецепта хранятся прямо на `recipes` как агрегаты + отдельная таблица
голосов; отображаемое среднее — GENERATED-колонки (миграция `0012`).

Новые колонки `recipes`:

| Поле | Тип | Назначение |
|---|---|---|
| `ratings_count` | integer (not null, default 0) | число реальных голосов (read-only агрегат, растит только RPC) |
| `ratings_sum` | integer (not null, default 0) | сумма реальных голосов (read-only агрегат) |
| `seed_count` | integer (not null, default 0) | админский baseline: число «затравочных» голосов |
| `seed_sum` | integer (not null, default 0) | админский baseline: сумма «затравочных» голосов |
| `min_display_rating` | numeric(2,1) (default 4.1) | пер-рецептный пол отображаемой оценки |
| `display_count` | integer GENERATED | `seed_count + ratings_count` |
| `display_avg` | numeric GENERATED | `greatest(min_display_rating, round((seed_sum + ratings_sum) / display_count, 1))` — с полом; при `display_count = 0` → `min_display_rating` |

`display_avg`/`display_count` — вычисляемые (STORED), напрямую не пишутся; сайт
читает только их (`Recipe.display_avg`/`display_count`).

> Витрина ≠ БД: **число оценок, видимое на странице**, считается на клиенте
> (`avocado.kiss/lib/rating.ts` → `socialProofCount`) — пока реальных ≤100
> показывается стабильный псевдослучайный baseline 1–500 (детерминированно из
> `recipe.id`), дальше — реальное `display_count`. В БД это не хранится.
> `display_count`/`display_avg` остаются источником правды и идут в JSON-LD
> `aggregateRating` (честные значения, только при `display_count > 0`).

### recipe_ratings — голоса за рецепт

Одна строка на голос. `id`, `recipe_id` (FK → recipes), `value` (int, check
`1..5`), `client_id` (идентификатор браузера для дедупа), `created_at`. RLS:
только админ (read/write) — **публичного/анонимного доступа нет** (анон не читает
и не пишет сырые голоса; сайт видит агрегаты через колонки `recipes`).

### rate_recipe() — приём голоса (RPC)

`avocado_kiss.rate_recipe(p_slug text, p_value int, p_client_id text)` —
`security definer`; EXECUTE выдан **только** роли `service_role`. Вставляет голос
в `recipe_ratings`, инкрементит агрегаты (`ratings_count`/`ratings_sum`) и
возвращает `(display_avg, display_count)`. Вызывается серверным Route Handler
`POST /api/recipes/[slug]/rate` под service-role ключом (см.
[../sites/avocado-kiss.md](../sites/avocado-kiss.md)) — первая мутация в репозитории.

Миграция: `avocado.kiss/supabase/migrations/0012_recipe_ratings.sql`.

### categories — категории навигации

`id`, `created_at`, `name` (**unique**, not null — единственный уникальный ключ,
на нём `on conflict`), `slug` (автоген из `name`; НЕ unique-constraint),
`position` (integer, default 0 — порядок ссылок в шапке), `show_in_nav`
(boolean, not null, default true — `false` убирает категорию из навигации шапки,
но страница `/category/<slug>`, поиск и главная остаются доступны),
`seo_title`, `seo_description` (nullable, фолбэк — автоформула из `name`).
Публичное чтение — все строки. Навигация шапки фильтрует по `show_in_nav = true`
(`fetchNavCategories`); страницы категорий и sitemap берут полный список
(`fetchCategories`). Рецепты привязаны по имени: `recipes.category =
categories.name` (без FK). Миграция `0011` добавила `show_in_nav` + категорию
`Dinner`, скрыла `Seafood` из навигации.

### home_slots — курируемая главная

| Поле | Тип | Назначение |
|---|---|---|
| `id`, `created_at`, `updated_at` | — | служебные |
| `slot` | text (not null, check) | `hero` \| `grid_large` \| `grid_medium` \| `grid_list` \| `wide` \| `pick` \| `pick_feature` \| `mosaic_banner` |
| `position` | integer (not null, default 0) | порядок внутри слота |
| `recipe_id` | uuid (nullable, FK → recipes, on delete cascade) | ссылка на рецепт (полиморфизм — см. ниже) |
| `post_id` | uuid (nullable, FK → posts, on delete cascade) | ссылка на пост блога (для Editor's Picks) |
| `eyebrow` | text (nullable) | оверрайд лейбла; пусто → категория рецепта |
| `eyebrow_secondary` | text (nullable) | устар.: до v2 — второй лейбл picks; теперь метки Editor's Picks берутся из тегов элемента |
| `description` | text (nullable) | оверрайд описания; пусто → excerpt рецепта |
| `is_published` | boolean (default true) | RLS: анону только опубликованные |

Ёмкость слотов по макету (валидирует админка фазы B, сайт рендерит что есть):
`hero` — 3, `grid_large` — 1, `grid_medium` — 2, `grid_list` — 5, `wide` — 2,
`pick` — 3, `pick_feature` — 1, `mosaic_banner` — 1 (широкий баннер мозаики
главной; слот допускает несколько строк — задел под слайдер, сайт рендерит
первую). Загрузчик сайта джойнит рецепты через
`recipes!inner` embed + двойной фильтр `is_published` (на слот и на embed) —
слот со скрытым рецептом отбрасывается целиком, а не рендерится пустым.
Подробности курирования — [../sites/avocado-kiss.md](../sites/avocado-kiss.md) §3.

**Полиморфизм (v2):** слот ссылается на **рецепт ИЛИ пост** — `recipe_id` и
`post_id` оба nullable, `check (num_nonnulls(recipe_id, post_id) = 1)` требует
ровно одну ссылку. Мозаика главной использует только рецептные слоты; секция
Editor's Picks (`pick` / `pick_feature`) — любой из двух типов. Загрузчик
`fetchEditorsPicks` разрешает рецепт/пост и берёт теги у самого элемента.

### tags — сквозные метки контента

Единая таксономия для всех типов контента (recipe/post/product). `id`,
timestamps, `name` (unique), `slug` (автоген из name, unique), `position`.
**Отличие от `categories`:** категории — раздел рецепта (несколько, в карточках
как SEASONAL); теги — сквозные метки: журнальные (LIFE, COMMUNITY) и дескрипторы
блюда (Vegetarian, Quick, Comfort Food, Healthy, Baking, Sweet, Brunch,
Weeknight, Summer, Spring, No-Cook, Vegan — сид 0006). Выводятся через «\|»
(`TagLabels`) в Editor's Picks и в теле карточки на страницах категорий (там
теги заменяют дублирующую категорию). Публичное чтение — все строки; запись — админ.

### recipe_tags / post_tags — связи контент↔теги

Join-таблицы many-to-many: `(recipe_id|post_id, tag_id)` PK + `position`
(порядок вывода тегов), `on delete cascade` с обеих сторон, индекс по `tag_id`.
`product_tags` появится вместе с товарами. Публичное чтение — все строки
(видимость гейтит сам рецепт/пост).

### posts — посты блога

2-й тип контента. `id`, timestamps, `published_at`, `is_published`, `title`,
`slug` (автоген из title, unique), `excerpt`, `hero_image_path` (тот же контракт
картинок). Миграция 0008 добавила: `template` (check `essay|interview|roundup`,
default essay — управляет вариантом hero/лэйаута), `author_id` (FK → authors),
`subtitle` (dek), `read_minutes` (int, «N min read»), `seo_title`,
`seo_description`. Миграция 0009 добавила `hero_caption` (подпись hero-фигуры для
roundup). Миграция 0015 добавила `folder_id` (nullable FK → admin_folders, on
delete set null — папка админки для раздела Blog в web.admin; сайт поле не читает).
Миграция 0019 добавила `preview_token` (uuid not null default `gen_random_uuid()`) —
capability-токен превью черновика, НЕ флаг видимости; анону НЕ выдаётся
(column-grant, 0020), читается только service-role клиентом на `/preview/blog/[slug]`.
Публичное чтение — только опубликованные; запись — админ.
Архив `/blog`, single `/blog/[slug]`. Загрузчики — `lib/blog.ts`.

### authors — авторы постов (миграция 0008)

`id`, `created_at`, `name`, `slug` (автоген из name, unique — задел под
`/author/[slug]`), `avatar_path` (контракт картинок), `bio`. Публичное чтение —
все; запись — админ. `posts.author_id` → authors.

### post_sections — блоки тела поста (миграция 0008)

**Единая таблица** динамических переупорядочиваемых блоков (в отличие от модели
«таблица на тип» у cozycorner — здесь один `type` + типизированные nullable
колонки, один `position`). Общие: `id`, timestamps, `post_id` (FK → posts, on
delete cascade), `position`, `is_published`, `type` (check
`text|quote|image|recipe_card|qa|list_item`). Колонки по типам: text — `body`,
`text_variant` (check lead|body); quote — `quote`, `quote_attribution`; image —
`image_path`, `caption`, `credit`; recipe_card — `recipe_id` (FK → recipes, on
delete set null), `card_eyebrow`; qa — `question`, `answer`; list_item — `rank`,
`heading` (+ переиспользует `body` и `recipe_id`/`card_eyebrow`). Индексы
`(post_id, position)` и `(recipe_id)`. Публичное чтение — `is_published`; запись
— админ. Загрузка — `fetchPostSections` (один запрос + гидрация рецептов одним
`.in()`), диспетчер `PostSections`. Реализованы essay-блоки
(text/quote/image/recipe_card); qa/list_item — задел под interview/roundup.

### post_related — «Read also» (миграция 0008)

Ручные пины связанного чтения, полиморфно: `id`, `post_id` (FK → posts, on
delete cascade), `position`, `recipe_id` (FK → recipes), `related_post_id` (FK →
posts) с check `num_nonnulls(recipe_id, related_post_id) = 1`. Публичное чтение —
все; запись — админ. `fetchRelatedReading` = пины сверху + авто-добор
(посты по общему тегу/свежести, затем рецепты) до 3 карточек.

### pages — страницы + SEO

Набор из 7 строк (`home`, `shop`, `blog` + `about`, `contact`, `privacy`, `terms`) —
задан кодом/миграциями, create/delete нет. `id`, timestamps, `slug` (unique),
`seo_title`, `seo_description`, `og_image_path` (§4), `body` (Markdown, nullable).
Строка `shop` — миграция 0007, `blog` — 0010, `about/contact/privacy/terms` — 0017.
Миграция 0010 добавила **hero-баннер** для `/shop` и `/blog`: `hero_eyebrow`,
`hero_title`, `hero_description`, `hero_image_path` (плоский ключ бакета или URL;
null → плейсхолдер) — страницы читают строку `pages` с фолбэком на код-константы.
У `home` баннера нет (мозаика). **`body`** (миграция 0017, Markdown) используют только
`privacy`/`terms` (рендер `LegalArticle`+`react-markdown`, null → встроенный
шаблон-фолбэк). SEO всех 7 страниц читается через `fetchPageSeo(slug)`.

### about_content — контент страницы /about (singleton, одна строка)

Миграция 0017. Управляемый контент `/about`: фиксированные секции (intro / story /
3 карточки-ценности) — «колонка на поле» (как `footer_settings`), не типизированные
секции. Поля (все text nullable, пусто → сайт показывает встроенный фолбэк):
`id`, timestamps, `eyebrow`, `heading`, `intro`; `story_heading`, `story_body_1`,
`story_body_2`, `story_image_path` (§4); `card1_icon`/`card1_title`/`card1_text` …
`card3_*` (`*_icon` — эмодзи-строка). RLS public-read + `is_admin()`-write; триггер
`set_updated_at`; сид одной строкой. Сайт: `fetchAboutContent` (`lib/content.ts`) →
`components/about/{AboutIntro,AboutStory,AboutValues}`. Правится в web.admin: Pages →
строка `about` (встроенный `AvocadoAboutEditor`, слой `src/lib/avocadoAbout.ts`);
`story_image_path` учтён в `USAGE_SOURCES` админки.

### contact_content — контент страницы /contact (singleton, одна строка)

Миграция 0017. Поля (text nullable): `id`, timestamps, `eyebrow`, `heading`, `intro`,
`email`, `response_note`. Соцсети НЕ здесь — берутся сайт-глобально из `site_settings`.
RLS/триггер/сид — как у `about_content`. Сайт: `fetchContactContent` → `components/contact/
{ContactIntro,ContactMethods}` (email `mailto` + соцсети из `buildSocials`). Правится
в web.admin: Pages → строка `contact` (`AvocadoContactEditor`, `src/lib/avocadoContact.ts`).

### footer_settings — текст футера (singleton, одна строка)

`tagline`, `copyright`, `made_with` («Made with care · New York — Lisbon») +
тексты декоративного блока рассылки: `newsletter_eyebrow`, `newsletter_title`,
`newsletter_text`. Все text nullable (кроме id/timestamps); пусто — элемент
не рендерится. Форма рассылки ничего никуда не пишет (нет таблицы
`subscribers` в v1).
⚠️ Колонки `instagram_url`, `pinterest_url`, `telegram_url`, `rss_url` — **legacy/unused**:
соцсети переехали в `site_settings` (миграция 0016), сайт их из `footer_settings`
больше не читает. Колонки оставлены (не дропаются), новый код их не использует.
Правится в админке: web.admin → Pages → «Footer & socials»
(`src/lib/avocadoFooter.ts`, форма `features/pages/avocadoFooterForm.ts`, экран
`AvocadoFooterEditPage.tsx`) — один Save пишет и `footer_settings`, и `site_settings`.

### site_settings — сайт-глобальные настройки (singleton, одна строка)

Миграция 0016. Сайт-глобальные параметры header+footer; сейчас — соцсети.
Заведена «колонка на поле» с прицелом на рост (новый глобальный параметр = новая
колонка). Поля: `id`, `created_at`, `updated_at`, `x_url`, `pinterest_url`,
`instagram_url` (все text nullable). Набор соцсетей фиксирован: **X, Pinterest,
Instagram** (иконки в коде сайта, `lib/socials.ts` → `SOCIAL_ICONS`). RLS: публичное
чтение + запись `is_admin()`; `updated_at` триггером `public.set_updated_at()`;
сид одной строкой. Сайт читает первую строку (`fetchSiteSettings`, `lib/content.ts`)
в `app/layout.tsx` и через `buildSocials` прокидывает соцсети в Header / MobileMenu /
Footer; пусто/ошибка → соцсети не рендерятся (безопасный фолбэк). ⚠️ `app/layout.tsx`
держит `export const revalidate = 60` — иначе правки из админки не видны до редеплоя.
Правится тем же экраном админки, что и `footer_settings` (см. выше).

### media — метаданные загруженных файлов

По образцу cozycorner: источник истины для медиа-менеджера (не Storage).
`id`, `created_at`, `original_name`, `path` (unique, плоский ключ в бакете
`avocado-kiss-photos`), `mime`, `size`, `folder_id` (nullable, FK →
admin_folders). RLS: весь CRUD — только `is_admin()`, публичного чтения нет
(тот же нюанс диагностики, что и у cozycorner — см. §8).

### admin_folders — папки админки

`id`, `created_at`, `section` (check `'media' | 'recipes' | 'products' | 'posts'`), `name`,
`unique(section, name)`; RLS admin-only. `recipes.folder_id` /
`media.folder_id` / `products.folder_id` / `posts.folder_id` — nullable FK, `on delete set null` —
удаление папки не удаляет элементы. Сайт таблицу не читает. (Секция `products`
добавлена миграцией 0013; `posts` — миграцией 0015.)

### shop_categories — категории Curated Shop

Таксономия товаров магазина, **независима от рецептных `categories`** (другая
сенсибильность). `id`, `created_at`, `slug` (unique — `/shop/[slug]`;
**автоген-триггер `shop_categories_set_slug`** из `name`, если пуст — миграция
0013), `name`, `item_count` (integer, default 0 — «31 items» на карточке хаба;
**с 0013 поддерживается автоматически триггером `sync_item_count` на
`product_categories`** — не вручную), `position` (порядок сетки хаба),
`hero_eyebrow`/`hero_title`/`hero_description`/`hero_image_path` (nullable — hero
страницы категории), `seo_title`/`seo_description`. Публичное чтение — все
строки; запись — `is_admin()`. Связь с товарами — M2M `product_categories` (ниже).

### products — товары Curated Shop

| Поле | Тип | Назначение |
|---|---|---|
| `id`, `created_at` | uuid pk, timestamptz | служебные |
| `slug` | text (unique, not null) | `/product/[slug]`; **автоген-триггер `products_set_slug`** из `title`, если пуст (0013) |
| `title` | text (not null) | название |
| `brand` | text (nullable) | эйброу карточки; **источник истины для сайта** (фильтр/поиск). Справочник `brands` (0013) — только для пикера админки, `products.brand` остаётся текстом |
| `price` | numeric(10,2) (not null) | цена; форматируется `formatPrice()` |
| `description` | text (nullable) | тело страницы товара |
| `image_path` | text (nullable) | плоский ключ `avocado-kiss-photos` или внешний URL (§4); тестовый сид → null |
| `referral_url` | text (not null) | «Buy from …» — внешняя ссылка |
| `folder_id` | uuid (nullable, FK → admin_folders, on delete set null) | папка админки (секция `products`, 0013); сайт не читает |
| `seo_title` / `seo_description` | text (nullable) | продуктовый SEO (0013); пусто → фолбэк на `title`/`description` |

Связь с категориями — M2M `product_categories` (ниже). Текстовая колонка
`products.category` **удалена** миграцией 0014 (данные перенесены в
`product_categories`). Индексы: `(created_at desc, id desc)` (детерминированная
пагинация `.range()`), `(folder_id)`. `category`/`category_name` в типе `Product`
(сайт) — **вычисляемые** (главная категория = наименьший `position` из M2M), не
колонки. Товары **не тегируются** (нет `product_tags`). Публичное чтение — все
строки; запись — `is_admin()`.

### product_categories — связь товар↔shop_category (M2M, миграция 0013)

Заменяет чтение текстового `products.category`. `product_id` (FK →
`products`, on delete cascade), `category_id` (FK → **`shop_categories`**, on
delete cascade), PK `(product_id, category_id)`, индекс по `category_id`.
Публичное чтение `using(true)`, запись — `is_admin()`. Backfill из
`products.category` по **slug** (не name, в отличие от cozy). Триггер
`sync_item_count` на этой таблице держит `shop_categories.item_count` в синхроне.
⚠️ FK ссылается на `shop_categories` (магазин), НЕ на рецептные `categories`.

### brands — справочник брендов магазина (миграция 0013)

По образцу `cozycorner.brands`. `id`, `created_at`, `name` (unique), `slug`
(unique, автоген-триггер `avocado_brands_set_slug`), `position`. Публичное чтение
+ запись `is_admin()`. **FK с `products` нет**: `products.brand` (текст) остаётся
источником истины для сайта; `brands` — словарь для combobox админки (как у
cozy). Засеян distinct-значениями `products.brand`. Rename бренда в админке
каскадит в `products.brand` (app-level) — фильтр категории и поиск по бренду на
сайте остаются согласованы.

### shop_editors_picks / product_pairings / product_reading — курация магазина

Три join-таблицы по образцу `home_slots` (ручной выбор редакции). Все: `id`,
`created_at`, `position` (порядок вывода), публичное чтение `using (true)`,
запись — `is_admin()`.

- **shop_editors_picks** — «Editors' picks this month» на `/shop` (4 товара).
  `product_id` (FK → products, on delete cascade), `unique(product_id)`.
- **product_pairings** — «Pairs well with» на странице товара (товар → товар, по
  3). `product_id` + `paired_product_id` (оба FK → products, cascade),
  `unique(product_id, paired_product_id)`, `check (product_id <> paired_product_id)`
  (без само-ссылок). Embed неоднозначен (2 FK на products) — загрузчик указывает
  явный хинт `products!product_pairings_paired_product_id_fkey`.
- **product_reading** — «Related reading» на странице товара (товар → **реальный
  рецепт**, по 3). `product_id` (FK → products) + `recipe_id` (FK → **recipes**,
  cascade), `unique(product_id, recipe_id)`. RLS даёт `using (true)`, но
  загрузчик embed'ит `recipes!inner` + `eq('recipe.is_published', true)` (плюс
  RLS на recipes пускает только опубликованные) — неопубликованные рецепты в
  блок не протекают (паттерн `fetchHomeSlots`). Проекция → `ReadingItem`
  (`href=/recipes/{slug}`, `eyebrow=category`, `imagePath=hero_image_path`).

Строка `pages.shop` (SEO хаба) добавлена миграцией 0007 — см. `pages` выше.

### subscribers — подписчики рассылки (миграция 0018)

Реальный сбор email из блока «The Culinary Dispatch» (`NewsletterBlock` /
`NewsletterForm` — главная и страницы блога), по образцу `cozycorner.subscribers`
(миграция 0025). `id`, `email` (`unique`, регистронезависимо — сервер пишет в
lower-case), `created_at`. Данные минимальны (GDPR): без IP/имени. Запись —
ТОЛЬКО через Route Handler `app/api/newsletter/route.ts` под `service_role`
(`lib/supabase/service.ts`, обходит RLS) ПОСЛЕ серверной проверки токена
Cloudflare Turnstile, поэтому запись реально гейтится, а не только UI; дубликат
email (`unique_violation` `23505`) отдаётся как успех — идемпотентно и не
раскрывает, подписан ли адрес. Ключи те же, что у рейтингов рецептов:
`SUPABASE_SECRET_KEY` и `TURNSTILE_SECRET_KEY` (server-only),
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (клиент). Гранты/RLS: анону не дано **ничего** —
дефолтный `select` схемы снят явным `revoke all … from anon` (без этого весь
список подписчиков читался бы публичным anon-ключом), `grant all` —
`authenticated` + `service_role`; RLS включён, публичных политик нет,
единственная политика `Admin manage subscribers` (`public.is_admin()`) —
просмотр/удаление/экспорт CSV в админке (раздел Subscribers,
[../admin-panel/subscribers.md](../admin-panel/subscribers.md); удаление = право
на забвение GDPR). Privacy Policy уже покрывает email рассылки и Turnstile, и
`pages.body` для slug=`privacy` пуст → рендерится код-версия
`app/privacy/page.tsx` — правок текста политики не потребовалось.

## 10. История миграций (репозиторий avocado.kiss, `supabase/migrations/`)

0001 схема `avocado_kiss` (categories, admin_folders, recipes, home_slots,
pages, footer_settings, media + гранты + RLS, шаблон cozycorner 0017) ·
0002 bucket `avocado-kiss-photos` (public read, запись `is_admin()`, шаблон
0018) · 0003 демо-сид (8 категорий из макета, демо-рецепты — тексты рецепта
zucchini и карточки главной из мокапов, `home_slots` на все слоты, строки
`pages.home` и `footer_settings`) · 0004 слот `mosaic_banner` (расширение
check-констрейнта `home_slots.slot` + демо-строка баннера; редизайн главной
v2) · 0005 модель контента: `tags` + `recipe_tags` + `posts` + `post_tags`,
полиморфные слоты (`home_slots.recipe_id` XOR `post_id`, check
`num_nonnulls=1`), сид тегов picks (редизайн главной v2, Editor's Picks) ·
0006 больше контента категорий: теги-дескрипторы блюд + новые рецепты
(Breakfast/Seafood были пусты) + бэкфилл hero-картинок (внешние URL) +
привязка тегов к рецептам категорий · 0007 Curated Shop: `shop_categories`,
`products` (текстовая `category`, без FK), курация `shop_editors_picks` +
`product_pairings` + `product_reading` (по образцу `home_slots`; RLS/гранты
шаблона 0001) + строка `pages.shop`. Посев (6 категорий, 36 товаров
`image_path=null`, 4 picks, по 3 пары/чтения на товар → опубликованные рецепты)
— через `avocado-content-ops`, не миграцией. · 0008 блог (Article): `authors`,
расширение `posts` (`template`/`author_id`/`subtitle`/`read_minutes`/seo-поля),
единая таблица блоков тела `post_sections` (все 6 типов в check), `post_related`
(Read also, полиморфно) + RLS/гранты шаблона 0005 + сид demo-essay «The quiet art
of the weeknight table» (8 секций). Роуты `/blog`, `/blog/[slug]`; nav «Article». ·
0009 `posts.hero_caption` + demo-посты interview («Recipes are just letters to
strangers», блоки qa) и roundup («20 pies…», блоки list_item) + теги
Interview/People/Test Kitchen + автор «The Test Kitchen». · 0010 hero-баннер в
`pages` (`hero_eyebrow`/`hero_title`/`hero_description`/`hero_image_path` для
`/shop` и `/blog`) + строка `pages.blog` + сид текущей копии. · 0011 категория
навигации Dinner (`categories` + `show_in_nav`). · 0012 рейтинги рецептов
(`recipes` рейтинг-поля, `recipe_ratings`, RPC `rate_recipe`). · **0013 Curated
Shop — паритет с cozy (аддитивно):** справочник `brands` (сид из distinct
`products.brand`), M2M `product_categories` (`products`↔`shop_categories`,
backfill по slug), `products.folder_id` + секция `products` в `admin_folders`
(расширен CHECK), `products.seo_title`/`seo_description`, slug-триггеры на
`products`/`shop_categories`, авто-`item_count` (триггер `sync_item_count`).
· **0014 очистка:** drop `products.category` + индекс — после перевода сайта
(`lib/shop.ts`) и скилла `avocado-content-ops` на M2M. Данные категории — в
`product_categories`. · **0015 posts.folder_id** (nullable FK → admin_folders, on
delete set null) + секция `'posts'` в `admin_folders.section` CHECK — папки блога в
web.admin (по образцу cozy 0022). Аддитивно; сайт `posts.folder_id` не читает.
· **0016 site_settings** (singleton: `x_url`/`pinterest_url`/`instagram_url` +
timestamps) — сайт-глобальные соцсети для header+footer с явными грантами,
public-read + `is_admin()`-write RLS, триггер `set_updated_at`, сид одной строкой.
Соцсети переехали сюда из `footer_settings.*_url` (те → legacy/unused). Сайт читает
через `fetchSiteSettings`/`buildSocials` в `app/layout.tsx`.
· **0017 статические страницы** (About/Contact/Privacy/Terms): `pages.body` (Markdown,
nullable — privacy/terms) + строки `pages` `about/contact/privacy/terms` (SEO);
singleton-таблицы `about_content` (intro/story/3 карточки) и `contact_content`
(eyebrow/heading/intro/email/response_note) — гранты, public-read + `is_admin()`-write
RLS, триггеры, сид по строке. Роуты `/about /contact /privacy /terms` (RSC, ISR);
футер-флаг `STATIC_PAGES_ENABLED` включён. Правятся в web.admin: Pages → редактор
по slug.
· **0018 subscribers** (реальная подписка на рассылку «The Culinary Dispatch»):
`id` + `email` (`unique`, lower-case) + `created_at`, GDPR-минимум (ни имени, ни
IP); `revoke all` от anon (снимает дефолтный schema-grant `select` — load-bearing)
+ `grant all` для `authenticated`/`service_role`; RLS без публичных политик —
запись только под service_role из `app/api/newsletter/route.ts` после проверки
Turnstile, чтение/удаление только admin (`Admin manage subscribers`,
`is_admin()`). Шаблон — cozycorner 0025. Раздел Subscribers в web.admin включён
для `avocado-kiss` через allowlist `sections`.
· **0019 preview_token** (превью черновиков на реальном фронте): `preview_token`
uuid not null default `gen_random_uuid()` в `recipes` И `posts` (бэкфилл дефолтом:
30 рецептов / 33 поста, все токены различны). Безопасна для уже задеплоенного
сайта — анонный `select("*")` продолжает работать, просто отдаёт лишнее поле.
· **0020 column-grant** — отзыв `preview_token` у `anon`: `revoke select on <table>
from anon` + `grant select (<все колонки, кроме preview_token>) to anon`, отдельно
для `recipes` и `posts`. ⚠️ Column-level `revoke select (preview_token)` НЕ работает
(табличный грант его не уменьшает) — тот же урок, что cozycorner выучил нерабочей
миграцией 0030. **Применена 2026-08-26**, после деплоя avocado.kiss с явными
списками колонок (`lib/columns.ts`) — до этого анонимный `?select=preview_token`
отдавал токены опубликованных материалов. Проверено на проде: анон
`?select=preview_token` и `select=*` → 401 `42501`; `has_column_privilege(anon,
'preview_token')` = false, `authenticated`/`service_role` = true; все запросы сайта
(включая браузерный «Load more» и `/search`) → 200.

· **0021 recipe_related** — ручные пины «Read also» страницы рецепта
(полиморфно рецепт | пост | товар, см. таблицу выше), гранты/RLS шаблона 0008.
Аддитивна: новая таблица, существующие данные и политики не тронуты. **Применена
2026-08-26.** Вместе с ней сайт перешёл на общий резолвер `lib/relations.ts`, а
блоки товара («Pairs well with», «Related reading») получили авто-подбор и
фолбэк, которых у них раньше не было (пустели без ручных пинов).

Ручной шаг после 0001: схема `avocado_kiss` добавлена в **Exposed schemas**
(готово). Картинки-заглушки для сида загружаются в бакет отдельным шагом
(не миграцией).

---

## 10. Таблицы схемы `urban_gardener`

Сайт **Urban Gardener** ([../sites/urban-gardener.md](../sites/urban-gardener.md)), бакет `urban-gardener-photos`, проект base-one.
Миграции живут в репо `urban.gardener/supabase/migrations/` (0001–0006 — Фаза 2, применены 2026-10-15; 0031 — Фаза X (гигиена прав), применена 2026-10-19; 0007–0011 — Фаза 3 (магазин), применены 2026-10-16; 0012–0016 — Фаза 4 (главная), применены 2026-10-16; 0017–0021 — Фаза 5 (About/Privacy/Terms + настройки сайта + шапка), применены 2026-10-16/17; 0022–0024 — Фаза 6 (поиск), применены 2026-10-17; 0025–0028 — Фаза 7 (рассылка и Contact), применены 2026-10-18; 0029–0030 — Фаза 8 (аналитика в настройках сайта, токены превью), применены 2026-10-19). Общие функции —
`public.slugify` / `public.set_updated_at` / `public.is_admin` (как у cozycorner/avocado_kiss). Контракт картинок — §4
(плоский ключ бакета или внешний URL). Slug везде генерирует БД-триггер (`<table>_set_slug`, при create из админки не отправлять).
Права — шаблон cozycorner 0017: `anon` читает под RLS, запись — только `public.is_admin()` (политика «Admin all …»).

⚠️ **Ручной шаг:** схему `urban_gardener` нужно добавить в **Exposed schemas** (Supabase → Project Settings → Data API),
иначе PostgREST отвечает `406 PGRST106 Invalid schema`.

| Таблица | Поля (кроме `id`, `created_at`, `updated_at`) | Чтение anon |
|---|---|---|
| `authors` | `name`, `slug` (unique), `role`, `avatar_path`, `bio` | все |
| `topics` | `name` (unique), `slug` (unique), `description` (вводный абзац `/topics/[slug]`), `seo_title`, `seo_description`, `position` | все |
| `levels` | `name` (unique), `slug` (unique), `position` | все |
| `articles` | `slug` (unique), `title`, `subtitle`, `excerpt` (not null, default `''`), `cover_path`, `cover_alt`, `level_id` → levels (**on delete set null**), `author_id` → authors (**NOT NULL, restrict**), `read_minutes` (check > 0), `published_at`, `is_published`, `seo_title`, `seo_description` | только `is_published` |
| `article_topics` | PK `(article_id, topic_id)`, `position` (**минимальная = основная тема**), cascade с обеих сторон, индекс по `topic_id` | только связи опубликованных статей |
| `article_blocks` | `article_id` (cascade), `position`, `type` (`text\|heading\|callout\|image\|list`), `text_variant` (`lead\|body`), `heading_level` (2\|3), `title`, `body`, `image_path`, `alt`, `caption`, `credit`, `items jsonb` (`[{label?, text}]`); индекс `(article_id, position)` | только блоки опубликованных статей |
| `shop_categories` | `name` (unique), `slug` (unique), `description` (вводный абзац `/shop/[slug]`), `image_path`, `image_style` (`photo\|cutout`), `position`, `seo_title`, `seo_description` | все |
| `brands` | `name` (unique), `slug` (unique), `position` | все |
| `products` | `slug` (unique), `name`, `short`, `description`, `image_path`, `image_alt` (not null, default `''`), `image_style`, `brand_id` → brands (**on delete set null**), `price numeric(10,2)` (≥ 0, nullable), `currency` (`^[A-Z]{3}$`, default `EUR`), `affiliate_url` (`^https://`), `light`, `water`, `size`, `pet_safety` (`pet_safe\|mildly_toxic\|toxic`), `published_at`, `is_published`, `seo_title`, `seo_description`; CHECK `products_published_needs_photo_link` (опубликованному нужны фото и ссылка) | только `is_published` |
| `product_categories` | PK `(product_id, category_id)`, `position` (**минимальная = основная категория**), cascade, индекс по `category_id` | только связи опубликованных товаров |
| `pages` | `slug` (unique; check `home\|about\|contact\|privacy\|terms`; засеяны `home`, `about`, `privacy`, `terms`), `seo_title`, `seo_description`, `hero_eyebrow`, `hero_title` (настоящий перевод строки; слова в `*звёздочках*` — акцент), `hero_description` (у `privacy`/`terms` — редактируемая шапка страницы: eyebrow / заголовок / строка под ним; null → «Legal» / встроенное название / автоматическое «Last updated»), `hero_image_path` (иллюстрация hero: плоский ключ бакета или внешний URL; null → встроенный лист), `body` (**Фаза 5**: markdown Privacy/Terms; null → встроенный текст на сайте; check `btrim <> ''`, ≤ 200000 символов, только у `privacy`/`terms`; токен `{{contact_email}}` подставляет сайт); все поля nullable (null → фолбэк сайта), `check (btrim(..) <> '')`; `updated_at` (триггер) — источник «Last updated» | все |
| `home_slots` | `slot` (`featured\|journal\|shop`), `position`, `article_id` → articles / `product_id` → products (**оба on delete cascade**; check: featured/journal ⇒ статья, shop ⇒ товар, ровно одна ссылка), `is_published` (скрыть карточку, не удаляя); partial unique `(slot, article_id)` и `(slot, product_id)`; индексы `(slot, position)`, `article_id`, `product_id`. Ёмкость 1/6/3 держит админка, сайт рисует первые N | только `is_published` слота **и** опубликованные статья/товар |
| `about_content` | **singleton** (unique-индекс `((true))`; authenticated — только select/update, insert/delete нет): `eyebrow`, `heading`, `intro`, `story_image_path`, `story_image_alt`, `story_heading`, `story_body_1`, `story_body_2`, `card1..3_icon/_title/_text`, `tip_title` (слова в `*звёздочках*` — акцент), `tip_text`; все text nullable (`btrim <> ''`; null → текст референса в коде сайта) | все |
| `site_settings` | **singleton** (как выше): `affiliate_disclosure`, `price_note`, `contact_email` (белый список символов), `instagram_url`/`x_url`/`pinterest_url` (`^https://` без пробелов; пусто → иконка скрыта), `footer_tagline`, `footer_columns jsonb not null` (1–4 колонки `{title, links:[{label, href}]}`, 1–8 ссылок), `footer_legal_links jsonb not null` (0–4 ссылок), `header_brand` (надпись рядом с логотипом; null → встроенная «Urban Soul of Plants»), `ga_measurement_id`/`gsc_verification` (0029, GA4 ID и токен Search Console; null = не задано), `nav_links jsonb not null` (меню шапки: 1–6 ссылок `{label, href}`, десктоп и мобильное меню — один список; **название сайта «Urban Gardener» остаётся в коде** — решение владельца); `href` — `/путь` (не `//`), `https://…` или `mailto:…`, без пробелов/управляющих/`\`; jsonb проверяют CHECK через `valid_footer_columns`/`valid_links` | все |
| `admin_folders` | `section` (check `media`), `name`; unique `(section, name)` | **нет** |
| `media` | `original_name`, `path` (unique), `mime`, `size`, `folder_id` | **нет** |

- **Блоки.** Одна таблица с типизированными nullable-колонками (как `post_sections` у Avocado). Текст — обычный, абзацы через пустую
  строку, без markdown; жирный лид-ин только в `list.items[].label`; emoji в `callout.title` допустимы.
- **Видимость дочерних таблиц.** Политики `article_topics` и `article_blocks` для anon проверяют `exists (… articles … is_published)`:
  черновик не утекает через связи и блоки (строже, чем «читать всё»). Проверено SQL (anon видит 10 опубликованных; тестовый черновик,
  его блок и связь — нет; запись → `42501`).
- **Служебные таблицы.** `media` и `admin_folders` — явный `revoke all … from anon` (default privileges иначе выдали бы `select`) +
  RLS только для админа.
- **Колонки статьи для anon.** Сайт читает `articles` явным списком колонок (`PUBLIC_ARTICLE_COLUMNS`), не `select('*')`: когда
  появится `preview_token` (Фаза 8), его скрывают табличным revoke + column-grant (урок cozycorner 0030/0031).
- **Индексы.** `articles(is_published, published_at desc, id desc)` (лента), `articles(level_id)`, `articles(author_id)`,
  `article_topics(topic_id)`, `article_blocks(article_id, position)`, `media(folder_id)`, unique по slug/name.

### Миграции репозитория urban.gardener

· **0001 urban_gardener_schema** — схема, гранты и default privileges, бакет `urban-gardener-photos` (публичное чтение; запись/изменение/удаление — `is_admin()`).
· **0002 articles_tables** — таблицы выше, триггеры slug/`updated_at`, гранты, RLS и политики.
· **0004 articles_hardening** — `check (btrim(name) <> '')` на authors/topics/levels; триггеры `touch_article` на `article_blocks` и `article_topics` (правка тела/тем обновляет `articles.updated_at` — для `dateModified`/`lastmod`, Фаза 8).
· **0005 replace_seed_cover_images** — шесть обложек сида заменены на рабочие Unsplash-фото растений (исходные ссылки референса перестали показывать растения).
· **0006 save_article_rpc** — функция `urban_gardener.save_article(p_id, p_article, p_blocks, p_topic_ids) → jsonb {id, block_ids}` (`security invoker`, execute только `authenticated`/`service_role`): атомарное сохранение статьи + блоков (diff по id) + тем, серверные правила публикации (обложка, ≥1 тема, время чтения → `23514`), `0` затронутых строк → `P0002`. Триггер `topics_guard_delete` — тему нельзя удалить, если опубликованная статья осталась бы без тем.
· **0007 shop_tables** — `shop_categories`, `brands`, `products`, `product_categories`; триггеры slug/`updated_at`/`touch_product`, гранты, RLS (anon — опубликованное; запись — `is_admin()`), триггер `shop_categories_guard_delete` (категорию нельзя удалить, если опубликованный товар остался бы без категорий).
· **0008 seed_shop** — сид из референса (D15): 4 категории (Easy care, Low light, Pet-friendly, Statement), 9 товаров (цена в EUR, плейсхолдер-ссылки Amazon без партнёрского тега — **владелец вносит реальные до запуска**), 11 связей; идемпотентна, генерируется из `lib/shop.fixtures.ts`.
· **0009 save_product_rpc** — `urban_gardener.save_product(p_id, p_product, p_category_ids) → jsonb {id}` (`security invoker`, execute только `authenticated`/`service_role`): товар + категории одной транзакцией, правила публикации (фото, https-ссылка, ≥1 категория → `23514`), `0` строк → `P0002`.
· **0010 shop_hardening** — ревью `database-reviewer`: у `anon`/`authenticated` отозваны TRUNCATE/REFERENCES/TRIGGER на таблицах магазина; триггер удаления категории блокирует строки товаров (`for update`) перед подсчётом; CHECK публикации (фото + ссылка); `touch_product` не трогает товар повторно в той же транзакции.
· **0011 seed_example_brands** — два **вымышленных примерных** бренда (Fern & Fable Nursery, Verdant Lane) по просьбе владельца, чтобы фильтр Brand работал; привязаны к 8 из 9 товаров. Заменить настоящими или удалить до запуска.
· **0012 home_tables** — `pages` и `home_slots` (см. таблицу выше), триггеры `updated_at`, `revoke all … from anon, authenticated` и затем только нужное: anon — `select`, authenticated — `select/insert/update/delete` (без TRUNCATE/REFERENCES/TRIGGER), RLS: «Public read pages», «Public read visible home_slots» (слот скрыт/черновой элемент → не виден), «Admin all …».
· **0013 seed_home** — `pages.home` с текстами референса и стартовые слоты (featured — «How to tell when a plant needs water…»; journal — 6 референсных статей (а **не** «6 самых свежих»: самая свежая — тестовая «Test Article»); shop — Monstera Deliciosa, Golden Pothos, Snake Plant); идемпотентна, при отсутствии нужного slug добирает самыми свежими опубликованными.
· **0014 save_home_page_rpc** — `urban_gardener.save_home_page(p_page_id, p_page jsonb, p_slots jsonb) → jsonb {page_id, slots}` (`security invoker`, execute только `authenticated`/`service_role`): тексты страницы `home` + ВСЕ слоты одной транзакцией (diff по id, плотные позиции внутри слота); чужой slot / несоответствие article↔product → `23514`, дубль карточки в слоте → `23505`, нет страницы/не админ → `P0002`.
· **0015 home_hardening** — ревью `database-reviewer`: строка слота с изменившейся целью пересоздаётся (нет ложных `23505` при обмене целями), дубль сравнивается по uuid, повторный `id` и невалидные uuid/boolean — понятные ошибки, `p_slots`/`p_page` обязательны (NULL больше не стирает данные), отсутствующий ключ `p_page` оставляет поле как есть (явный null/пустая строка очищает); у `authenticated` отозваны insert/delete на `pages`.
· **0016 home_hero_image** — правка Фазы 4 по просьбе владельца: `pages.hero_image_path` (check not blank) и `save_home_page` принимает ключ `hero_image_path` (отсутствует = не трогаем, null/пусто = очищаем → сайт рисует встроенный лист).
· **0017 static_pages_tables** — `pages.body`, singleton-таблицы `about_content` и `site_settings`, SQL-функции проверок `is_safe_href`/`valid_links`/`valid_footer_columns` (immutable, используются CHECK и RPC), гранты (anon — select; authenticated — select/update, **без insert/delete**; без TRUNCATE/REFERENCES/TRIGGER), RLS «Public read …» + «Admin all …».
· **0018 seed_static_pages** — строки `pages` about/privacy/terms (тексты Privacy/Terms — адаптация Cozy/Avocado, **черновик, не юридическая консультация**; оператор данных — заглушка «[Operator details … to be added before launch]»), одна строка `about_content` (текст референса дословно, решение P1) и `site_settings` (константы `lib/site.ts`). Идемпотентна; **генерируется из** `lib/static-pages.fixtures.ts`.
· **0019 static_pages_rpc** — `save_about_page(p_page_id, p_page, p_about) → jsonb` (SEO страницы `about` + `about_content` одной транзакцией) и `save_site_settings(p_settings) → jsonb` (`security invoker`, execute только `authenticated`/`service_role`; отсутствующий ключ — не трогаем, null/пусто — очищаем; не объект / неизвестный ключ / не текст → `22023`, формат → `23514`, нет строки/не админ → `P0002`). Privacy/Terms пишутся прямым `update pages`.
· **0020 static_pages_review_fixes** — ревью `database-reviewer`: `where true` в обновлении синглтонов (у роли `authenticator` PostgREST включён `safeupdate`, update без WHERE отвергается), `is_safe_href` без пробелов/управляющих/`\` (раньше `/\evil.com` и `/<TAB>/evil.com` читались браузером как `//evil.com`), `is_blank` с юникод-пробелами, белый список символов e-mail (иначе `]`/`)` ломали markdown-ссылку после подстановки `{{contact_email}}`), URL соцсетей без пробелов, лимит и привязка `pages.body`.
· **0021 header_settings** — по просьбе владельца 2026-10-17: `site_settings.header_brand` (check not blank) и `nav_links` (not null, check `valid_links(…, 1, 6)`), стартовые значения — нынешние константы (Home/Articles/Shop/About, «Urban Soul of Plants»); `save_site_settings` принимает ключи `header_brand`, `nav_links` (меню пустое/>6/небезопасная ссылка → `23514`).
· **0022 search_content / 0023 search_fuzzy_tuning / 0024 search_word_cap** — Фаза 6 (поиск). Расширение `pg_trgm` (схема `extensions`) + GIN `gin_trgm_ops` на `articles.title` и `products.name` (сейчас запросом **не используются** — `ilike`/`word_similarity` стоят внутри `greatest(case …)` без индексируемого предфильтра; на 11+10 строках не важно, при росте каталога — колонка `search_doc` + один `gin_trgm_ops` и предфильтр `search_doc ilike pat`) и RPC `urban_gardener.search_content(p_query text, p_article_limit int = 4, p_product_limit int = 4) → jsonb` вида `{"articles":{"total":n,"ids":[uuid…]},"products":{…}}`: `security invoker`, `stable`, `search_path = ''`, execute — `anon`/`authenticated`/`service_role` (revoke от public). `is_published = true` задан **внутри функции** (не только RLS). Запрос нормализуется (trim, схлопнуть пробелы, ≤ 80 символов; < 2 → пусто; зеркало — `lib/search-utils.ts normalizeQuery`), слова через пробел (**первые 6**, 0024), все должны найтись (AND), `\ % _` экранируются (`like … escape '\'`). Поля: статья — title 4, тема/уровень 3, subtitle 2, excerpt 1; товар — name 4, бренд/категория 3, short 2, description 1 (без полного текста статей, решение S1); +4 за точное совпадение с названием; порядок — балл ↓, `published_at` ↓, `id`. Опечатки (S2): `extensions.word_similarity(слово, поле) ≥ 0.42` только для слов **от 5 букв** и только по «именным» полям (название/тема/уровень/бренд/категория); 0.4 и 4 буквы давали шум (`rose`→`root`, `mold`→`Monstera`), подобрано на данных (`monsetra` 0.44, `pothus` 0.57, `calatea` 0.63, `alloe` 0.57). Лимиты зажимаются в 0..50, `null` → 0. NUL и одинокий суррогат в тексте PostgREST отвергает ещё до функции (HTTP 400) — их вычищает `normalizeQuery`. 0023/0024 применены патчем `pg_get_functiondef` (в репо — полный `create or replace` у 0022 и пояснение у 0023/0024).
· **0025 subscribers** — Фаза 7 (7A). `urban_gardener.subscribers(id uuid pk, email text unique, created_at)`; CHECK: `email = lower(email)`, ≤ 254 символов, формат `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Только e-mail и время (без имени и IP). `revoke all … from anon, authenticated` (схема по умолчанию отдаёт anon select — revoke несущий), затем `grant select, delete to authenticated`, `grant all to service_role`; RLS включён, политики «Admin read subscribers» (select) и «Admin delete subscribers» (delete) через `public.is_admin()`; публичных политик нет. Запись — только Route Handler `/api/newsletter` под `service_role` после проверки Turnstile; дубль адреса = unique_violation (23505) → «успех» (не раскрываем наличие адреса).
· **0026 newsletter_popup_settings** — Фаза 7 (7C). `site_settings.newsletter_popup_enabled boolean not null default true`, `newsletter_popup_days int not null default 30` (CHECK 1–365). `save_site_settings` принимает ключи `newsletter_popup_enabled` (строго boolean, иначе 22023) и `newsletter_popup_days` (число, целое 1–365: не число → 22023, вне диапазона/дробное → 23514); текстовая проверка «строка или null» к ним не применяется. Проверено 13 случаев (строка, null, 0, 366, 7.5, 1, 365, …).
· **0027 messages** — Фаза 7 (7D). `urban_gardener.messages(id uuid pk, name, email, subject null, message, is_read bool default false, created_at)`; CHECK: name не пусто и ≤ 120, e-mail формат и ≤ 254, subject ≤ 200, message не пусто и ≤ 2000; индекс `(is_read, created_at desc)`; **без IP**. Права: `revoke all` от anon/authenticated; `grant select, delete` + **`grant update (is_read)`** (column-level: админ не может править текст чужого сообщения) authenticated; `grant all` service_role; RLS: Admin read/update/delete через `is_admin()`. Запись — только `/api/contact` под `service_role` после Turnstile.
· **0028 contact_page** — Фаза 7 (7D). Строка `pages.slug='contact'` (slug уже разрешён CHECK 0012) с шапкой (`hero_eyebrow/title/description` = референс); singleton `contact_content` (`email_title/text`, `partners_title/text/address`, `where_title/text`, `social_title/text`, `form_title/hint`; пустая строка недопустима, титулы ≤ 120, тексты ≤ 400, `partners_address` — формат e-mail; сид = текст референса: `partners@urbansoulofplants.com`, «Amsterdam» — пункт чек-листа запуска); права как у `about_content` (anon select, authenticated select+update, RLS «Public read»/«Admin all»). Адрес карточки «Email us» берётся из `site_settings.contact_email`. RPC `save_contact_page(p_page_id uuid, p_page jsonb, p_contact jsonb) → jsonb` (security invoker, `search_path=''`; неизвестный ключ/не текст → 22023; адрес партнёров → 23514; нет строки/не админ → P0002; `where true` под pg_safeupdate). Проверено под ролями и 10 случаев RPC.
· **0029 analytics_settings** — Фаза 8 (8A). `site_settings` + `ga_measurement_id text null`, `gsc_verification text null`; CHECK `^G-[A-Z0-9]{6,14}$` и `^[A-Za-z0-9_-]{20,120}$` (null допустим). `save_site_settings` принимает оба ключа (пустая строка → null; неверный формат → 23514 с понятным текстом; не-строка → 22023). Права не менялись (anon читает, пишет только админ через RPC). Произвольный код НЕ принимается (решение P1). Проверено: 5 случаев RPC, advisors без новых замечаний. **Порядок выкладки: 0029 применяется ДО кода** (сайт и админка читают новые колонки — без них select падает, и падают все страницы).
· **0031 grants_hygiene_topic_guard** — Фаза X (B-004), применена к `base-one` 2026-10-19. `revoke truncate, references, trigger` у `anon, authenticated` на 8 таблицах Фазы 2 (`authors, topics, levels, articles, article_blocks, article_topics, media, admin_folders`; магазин — уже в 0010); `alter default privileges in schema urban_gardener revoke all on tables from anon, authenticated` (новая таблица получает права только явным `grant`); `guard_topic_delete` блокирует статьи темы (`order by id for no key update`) до подсчёта; блок `do $$` в конце миграции падает при лишних правах, выключенном RLS, записи у `anon`, чтении закрытых таблиц гостем, вставке в `subscribers/messages` вошедшим и читаемом `preview_token`. Остаток (взаимная блокировка 40P01 при одновременном удалении темы и сохранении статьи с ней, CHECK-и публикации у `articles`) — [B-011](../backlog/B-011-urban-db-hardening-leftovers.md).
· **0030 preview_tokens** — Фаза 8 (8B). `articles.preview_token` и `products.preview_token` (`uuid not null default gen_random_uuid()`, бэкфилл дефолтом). Токен — capability для `/preview/articles|products/<slug>?token=`; сравнивается В БАЗЕ (`.eq('preview_token', …)`), в выборки публичных загрузчиков не входит. **Закрыт от anon: `revoke select` на таблице + `grant select (все колонки, кроме preview_token)`** (DO-блок по `information_schema`; column-level revoke при табличном grant — no-op). authenticated/service_role не затронуты. **Правило на будущее: любая НОВАЯ колонка `articles`/`products` недоступна anon, пока ей не выдан `grant select (col) … to anon`; в запросах — только явные списки колонок; любая будущая миграция с `grant select on all tables in schema urban_gardener to anon` (шаблон 0002) снова откроет токен — не повторять.** Проверено под ролями: anon `select preview_token` → permission denied, `select *` → denied, опубликованные строки и RPC `search_content` читаются; authenticated/service_role видят токен. Известное: любой вошедший не-админ читает токен ОПУБЛИКОВАННЫХ строк (как у Avocado) — значимо только при открытой регистрации в Supabase Auth; кнопки смены токена нет (смена — SQL).
· **0003 seed_articles** — сид из референса (D15): автор Anna Sokolova (Senior editor), 4 уровня (Beginner/Easy/Medium/Essential), 9 тем,
  10 статей (13 связей статья↔тема, 80 блоков). Тела девяти статей, кроме «How to tell when a plant needs water…», — **черновики агента**,
  владелец переписывает их в админке до запуска. Картинки — внешние Unsplash-URL референса (перезалив в Storage — Фаза 9,
  [../methodology/external-image-rehosting.md](../methodology/external-image-rehosting.md)). Идемпотентна; генерируется скриптом из `lib/articles.fixtures.ts`.
