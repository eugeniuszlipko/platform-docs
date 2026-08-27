# Админ-панель — статус, отклонения от спеки, следующие шаги

> Last updated: 2026-08-25 | Source project: web.admin (CLAUDE.md «Статус», сверено с фактическим состоянием репо cozycorner)

## Сделано (хронология по фазам)

- **Каркас**: Vite 8 + React 19 + TS, Tailwind v4 (vite-плагин), shadcn/ui.
  Шрифт — системный стек SF (Geist удалён).
- **Фаза 1 (Auth)**: `sites.ts`, `supabase.ts` (`getClient`/`getDb`), `auth.ts`,
  LoginPage (RHF+Zod+field), RequireAuth (сессия + is_admin + «Access denied»).
  Маршруты `/login` → `/dashboard` (карточки сайтов) → `/:siteSlug`. SiteSwitcher
  в шапке удалён — выбор сайта картами на /dashboard. Исправлен баг «первый логин
  не срабатывает» (сессию в кэш TanStack до navigate). `vercel.json` с SPA-rewrite;
  прод на Vercel задеплоен.
- **Фаза 2 (Media)**: менеджер фото по спеке §7 + доработки (грид 4 колонки,
  маркеры «не используется»/«>1 МБ», поиск, модалка деталей с rename, габаритами).
  Правила — [media.md](media.md); UX — [components.md](components.md) §3.6.
- **Фаза 3, шаг 1 (Products, v1–v4)**: CRUD товаров, `ImagePickerDialog`, generic
  `RichTextEditor` (TipTap v3 + @tiptap/markdown), SEO-фолбэк, гард несохранённых
  изменений (переход на data router). Правила — [products.md](products.md).
- **Фаза 3, шаг 2 (Blog)**: CRUD постов + конструктор модулей (diff-сохранение
  секций, пересинхронизация после Save). Правила — [blog.md](blog.md).
- **Итерация v2 раскладки редакторов**: sticky-панель действий, грид-шапка,
  фильтр статуса в списке постов.
- **Фаза 3, шаг 3 (Pages)**: SEO + hero-блоки (только update) + `pages.body`
  (markdown-тело terms/privacy). Правила — [pages.md](pages.md).
- **Переезд на Supabase-проект base-one (2026-07-16) — ЗАВЕРШЁН**: `sites.ts` →
  новый projectUrl/anonKey (коммит 569bcee), MCP-ref обновлён, строки
  `cozycorner.media` пересажены, оба админа заведены заново, публичная регистрация
  закрыта, e2e проверено на проде. Детали и диагностика —
  [../database/schema.md](../database/schema.md) §1, §8.
- **Папки в Media (2026-07-16)**: таблица `admin_folders` + `media.folder_id`
  (миграция `add_admin_folders` через MCP), FoldersPanel/MoveToFolderMenu,
  multi-select + bulk move.
- **Папки в Products/Blog + рефакторинг (2026-07-16)**: `products.folder_id`/
  `posts.folder_id` (миграция `add_content_folders` через MCP), общий код
  `src/features/folders/` (media переведён на него, `moveImages` удалён).
- **SEO Posts (2026-07-16)**: `posts.post_type` (миграция `add_seo_post_type`),
  разделы Blog и SEO Posts на одних компонентах (конфиг `sections.ts`), маршруты
  `/:siteSlug/seo-posts`, папки-секция `seo_posts`. Правила — [blog.md](blog.md) §1a.
- **Дубли MCP-миграций папок в репо сайта (2026-07-17)**: `0021_admin_folders.sql` +
  `0022_content_folders.sql` в `cozycorner/supabase/migrations/` — схемный дрейф
  закрыт (см. [../database/schema.md](../database/schema.md) §6).
- **UX-доработки медиа-выбора (2026-07-22)** — только фронт, без изменений схемы
  (спека/план `../archive/web.admin/superpowers/{specs,plans}/2026-07-22-picker-folders-bulk-delete-hover*`):
  - **Фильтр папок в `ImagePickerDialog`** — Select All/Unsorted/папки, upload в
    выбранную папку (пикер раньше папок не знал). Задействован в товарах, постах,
    страницах и hero-секциях (media.md §3).
  - **Bulk delete** во всех разделах (media/products/posts) — общий
    `BulkDeleteButton` + хук `useBulkDelete`; для media confirm предупреждает о
    занятых картинках. Дополняет прежний bulk move.
  - **Hover-превью** во всех точках добавления картинки — общий
    `ImagePreviewPicker` (ProductEditPage, PostEditPage cover, PageEditPage OG,
    hero bg); сам ведёт broken-состояние. У hero-секций превью раньше не было.
  - Код-ревью (память/эффективность): мемоизация counts/visible в пикере, убран
    двойной `form.watch` в hero, дедуп трёх мутаций удаления в `useBulkDelete`.
- **Полиш layout + унификация модалок (2026-07-22)** — только фронт (спека/план
  `../archive/web.admin/superpowers/{specs,plans}/2026-07-22-admin-dialog-layout-polish*`):
  контейнер `max-w-5xl` → `max-w-7xl`; примитив `ui/dialog.tsx` — flex-колонка +
  `max-h-[85svh]` + новый `DialogBody` (скролл-середина), на него переведены
  ImagePicker/ProductPicker/MediaDetails; кольцо выбранной картинки `ring-ring` →
  `ring-primary`; скроллбар пикера товаров больше не перекрывает чек-индикаторы.
- **Унификация Category & Brand (2026-07-22)** — БД + фронт (спека/план
  `../archive/web.admin/superpowers/{specs,plans}/2026-07-22-category-brand-unification*`):
  таблица `brands` (миграция 0023, сид из `products.brand`, RLS public read + admin
  write); `src/lib/categories.ts` + `src/lib/brands.ts` (CRUD + reorder + каскад
  rename/delete в products, app-level); generic `src/features/taxonomy/`
  (`config` + `TaxonomyManager` + `TaxonomyCombobox`); разделы Categories/Brands в
  навигации; в форме товара Brand/Category — единый combobox (выбор/создание +
  Manage); фильтр Brand в списке — из справочника. Известные хвосты: каскад не
  атомарен (2 запроса); hero_badge/hero_image_path категорий в админке не редактируются.
- **Доработки taxonomy по ревью (2026-07-22)** — только фронт (план
  `../archive/web.admin/superpowers/plans/2026-07-22-taxonomy-ux-refinement-plan.md`):
  - Списки Categories/Brands приведены к простому borderless-виду как Products/Blog
    (кликабельная зона + иконки-соседи), New + поиск сверху, reorder **оптимистичный**
    (мгновенно в UI, запись `Promise.all`; при поиске стрелки отключены).
  - Category — редактирование в модалке `CategoryEditDialog` (create+edit, «средний»
    набор: image_path через **инпут+Gallery** по контракту товара, name, hero_title,
    hero_description, SEO с живым фолбэком; клик по ряду открывает). Brand — inline-rename.
  - **Релевантные ошибки** (`src/lib/errors.ts`): `firstFieldErrorMessage` (тост
    показывает конкретное поле вместо «Fix validation errors») — в формах Product/Post/
    Page/Category; `humanizeError` (23505 дубликат имени и пр.) — в taxonomy-мутациях.
  - `TaxonomyConfig.plural` — корректное мн. число в текстах (categories, не «categorys»).
- **Полиш формы товара + режим выбора + фикс auth (2026-07-22)** — только фронт,
  без изменений схемы:
  - **Форма товара** ([components.md](components.md) §3.7, [products.md](products.md) §3):
    Price — узкий инпут `grid-cols-[8rem_1fr]`, `type=text inputMode=decimal` (без
    спиннеров); ряды пересобраны — Price+Image path и Referral URL в шапке, Category+Brand
    ниже; **Image style убран из вёрстки** (поле/схема/`toInput` целы, дефолт новых
    товаров `cutout`); контейнер `max-w-3xl` → `max-w-4xl`.
  - **Режим выбора** во всех разделах (media/products/posts) вместо всегда-видимых
    чекбоксов: кнопка **Select** → `selectionMode` (в `useFolders`), общий `SelectionBar`
    встаёт на место строки фильтров (без вертикального сдвига), Cancel очищает выбор.
    Плюс **Shift-выбор диапазона** (`selectRange` с якорем). Детали — [components.md](components.md) §4.
  - **Ложный «Access denied» при возврате во вкладку** — гонка focus-refetch ×
    обновление токена. Фикс: `isAdmin` бросает вместо `return false`; auth-запрос
    `refetchOnWindowFocus:false` + `staleTime:Infinity` (свежесть через
    `onAuthStateChange`). Детали — [api.md](api.md) §3.
  - Мелочь: пункты поповера `TaxonomyCombobox` — `cursor-pointer` + единый инсет.
- **Второй сайт Avocado Kiss (2026-08-08)** — мультисайтовость админки задействована:
  - **Media** для avocado: запись в `SITES` (schema `avocado_kiss`, bucket
    `avocado-kiss-photos`) + новый allowlist `SiteConfig.sections` (nav показывает
    только готовые разделы); `USAGE_SOURCES` в `src/lib/media.ts` сделан site-aware
    (map по схеме). БД (`media`/`admin_folders`/бакет) уже была готова — миграций нет.
  - **Curated Shop** для avocado (Products / Categories=`shop_categories` / Brands)
    на **том же generic-коде**, site-aware по `site.schema`:
    `src/lib/categories.ts` — модель по схеме (`categories` vs `shop_categories`),
    картинка нормализована к каноничному `image_path` (PostgREST-alias
    `image_path:hero_image_path`), поле `hero_eyebrow` (avocado); `CategoryEditDialog`
    — условный `hero_eyebrow`; `products.image_style` — cozycorner-only (не шлётся
    для avocado). `product_categories`/`brands`/`productCategories.ts`/`brands.ts`/
    `TaxonomyManager`/`CategoryChipsField` — без изменений (общие таблицы). Роуты
    `App.tsx` уже работали для любого `:siteSlug` — включение = allowlist. БД под
    Shop — миграции avocado `0013`/`0014` (M2M/brands/folders/триггеры). Cozy-тесты
    (50) зелёные — регресса нет.
  - **Жёсткий гейт разделов (по ревью):** `SiteConfig.sections` теперь гейтит не
    только nav, но и роуты — `SiteLayout` редиректит прямой URL на неразрешённый
    раздел на первый доступный (раньше `/avocado-kiss/subscribers` и т.п. рендерил
    бы неготовый раздел). Плюс `searchProducts` (avocado `lib/search.ts`) выставляет
    `category: null` после дропа колонки (типовая чистота).
  - **Код-ревью пройдено (2026-08-08):** независимый ревьюер + живые смоук-проверки
    (cozy-alias `categories`, avocado `brands`/`shop_categories`/M2M) — регрессов
    cozycorner и разрывов контракта админка↔сайт нет; `item_count` админка не пишет
    (триггер), картинка категории пишется в правильную колонку (`hero_image_path`
    для avocado через canonical `image_path`).
- **Blog (Article) + Pages для Avocado Kiss (2026-08-08)** — раздел Blog построен
  по контракту [blog-avocado-kiss.md](blog-avocado-kiss.md):
  - Отдельная feature-папка `src/features/articles/` + `src/lib/articles.ts`
    (единая таблица `post_sections`, 6 блоков, `posts.template` 3 шаблона, авторы,
    теги, Read-also пины). Роут `/blog` диспетчеризуется по `site.schema`
    (`BlogRoutes.tsx`) — cozycorner-блог не тронут. Конструктор блоков — «Add block»
    + выбор типа; авторы — select существующих (CRUD авторов пока нет).
  - Миграция avocado `0015`: `posts.folder_id` + секция `posts` в `admin_folders`
    (папки списка постов).
  - **avocado-специфичный раздел Pages** (`features/pages/AvocadoPageEditPage.tsx`,
    диспетчер `PagesRoutes.tsx`): у avocado баннер в hero_* колонках строки `pages`
    (не `hero_sections`+`body`, как cozy). Правит баннеры `/shop` и `/blog` (update-only,
    у `home` баннера нет). Общий раздел Pages сломался бы на avocado — поэтому диспетчер.
  - **Две правки по код-ревью:** (1) `toSections` пишет картинку блока `image` плоским
    ключом бакета, а не абсолютным URL (иначе тихая порча БД + разрыв учёта медиа);
    (2) Read-also пины — read-only чип рецепта (без мёртвых кнопок) + дедуп пикеров
    (у `post_related` нет unique-констрейнта). Юнит-тесты: articles/articleForm/
    ArticleEditPage/AvocadoPageEditPage — 71 зелёный, build+lint чисто.
  - ~~Preview-ссылки нет~~ — **сделана 2026-08-25**, см. раздел ниже.

## Отклонения от спеки (актуальные версии инструментов)

- Алиасы `@/*` — только `paths` в tsconfig, без `baseUrl` (deprecated в TS 6).
- shadcn v3: библиотека radix + пресет nova; вместо `form` — `field`.
- Один supabase-клиент на проект (schema public, сессия/rpc/storage) + `getDb(site)` =
  `.schema(site.schema)` per-query — вместо двух клиентов из спеки §6.
- Линтер шаблона — oxlint (не ESLint). 2 warning в shadcn-файлах — известные, игнорируем.

## Выполнено на стороне сайта (сверено с репо cozycorner 2026-07-17)

- ~~Рендер markdown в `products.description` и `post_text_sections.body`~~ —
  сделано: компонент `MarkdownText` + `stripMarkdown()` для мета-тегов.
- ~~`pages.body` для terms/privacy + ISR~~ — сделано: `LegalArticle` с пропом
  `body`, все контентные страницы ISR `revalidate = 60`; миграция
  `0019_pages_body.sql` в репо сайта.
- ~~SEO-посты на сайте~~ — сделано: лента/поиск фильтруют `post_type='blog'`,
  sitemap включает оба типа; миграция `0020_posts_post_type.sql` в репо сайта.

## Следующие шаги

1. Ручные e2e-чек-листы (после переезда media/products в основном проверены):
   - blog — `../archive/web.admin/superpowers/plans/2026-07-10-blog.md` Task 6.1;
   - pages — `…/2026-07-10-pages.md` Task 5.3;
   - папки Media — `…/2026-07-16-media-folders.md` Task 6.3 (регресс после
     рефакторинга — важно);
   - папки Products/Blog — `…/2026-07-16-content-folders.md` Task 6.5;
   - SEO Posts — `…/2026-07-16-seo-posts.md` Task 11.
2. Фаза 3 дальше: **categories → footer_settings** (CRUD в админке).
3. От пользователя:
   - удалить старый Supabase-проект `nkaobsivfzsjqypuaamw` (этап G) + его
     MCP-сервер из `~/.claude.json`;
   - прод-URL админки добавить в base-one → Auth → URL Configuration (нужно для
     ссылок сброса пароля);
   - загрузить `seo-posts-skill.md` в проект claude.ai, создающий
     SEO-посты;
   - ротация secret key base-one, использованного для импорта при переезде.

## Static pages (About + Contact + Privacy + Terms) для Avocado Kiss (2026-08-09)

Спек/план — `docs/superpowers/{specs,plans}/2026-08-09-avocado-static-pages-*`.
- **Миграция avocado `0017`**: `pages.body` (Markdown) + строки `pages` about/contact/privacy/terms;
  singleton `about_content` (intro/story/3 карточки) и `contact_content` (eyebrow/heading/intro/
  email/response_note). RLS/гранты/триггеры/сид по шаблону 0001.
- **Сайт avocado.kiss**: роуты `/about` (`about_content` → `components/about/*`), `/contact`
  (`contact_content` + соцсети из `buildSocials` → `components/contact/*`), `/privacy` + `/terms`
  (`pages.body` Markdown → `LegalArticle`+`MarkdownText`, `react-markdown`; фолбэк-шаблон).
  Все RSC+ISR, SEO из `pages` с фолбэком. Футер: `STATIC_PAGES_ENABLED=true` + ссылки Privacy/Terms.
  `app/sitemap.ts` расширен 4 роутами.
- **web.admin**: `AvocadoPageEditPage` стал условным по slug (hero shop/blog · body-markdown
  privacy/terms · About-редактор · Contact-редактор · SEO всегда). Строки about/contact/privacy/
  terms появляются в списке Pages автоматически. Новые: `src/lib/avocadoAbout.ts`,
  `src/lib/avocadoContact.ts`, `src/features/pages/{AvocadoAboutEditor,AvocadoContactEditor}.tsx`,
  чистый `avocadoPageForm.ts` (+тесты). Один Save пишет строку pages + нужную content-таблицу.
  `about_content.story_image_path` — в `USAGE_SOURCES`.
- Контракт БД — schema.md §9; сайт — sites/avocado-kiss.md §6; редактор — pages.md §9.

Отложено (не блокеры): текст/эмодзи фолбэков About и юр-текст Privacy/Terms — **шаблон**,
до запуска заменить реальными реквизитами/контактом/датой; форма Contact не рабочая (только
email `mailto` + соцсети). Инфра-нюанс: alias `@/` из `vite-tsconfig-paths` не применяется к
тест-файлам avocado (в `tsconfig.exclude`) — новый тест использует относительные импорты
(рантайм `@/` в тестах = латентная дыра, тикет при необходимости).

## Global sections (Footer + Socials) для Avocado Kiss (2026-08-09)

Сделан редактор глобальных секций avocado (спек/план — `docs/superpowers/{specs,plans}/2026-08-09-avocado-global-sections-*`):
- **Миграция avocado `0016`**: singleton `site_settings` (`x_url`/`pinterest_url`/`instagram_url`)
  — сайт-глобальные соцсети. Соцсети переехали из `footer_settings.*_url` (те → legacy/unused).
- **Сайт avocado.kiss**: соцсети теперь DB-driven — `fetchSiteSettings` + `buildSocials`
  (`lib/socials.ts`, `SOCIAL_ICONS` по стабильному ключу) в `app/layout.tsx` → Header/
  MobileMenu/Footer. Прежний захардкоженный `SOCIALS` удалён. Колонка Footer «Magazine»
  (About/Contact) — за флагом `STATIC_PAGES_ENABLED=false` до итерации статических страниц.
- **web.admin**: экран **Pages → «Footer & socials»** (`features/pages/AvocadoFooterEditPage.tsx`,
  роут `/:siteSlug/pages/footer` через `FooterEditRoute` в `PagesRoutes.tsx`, закреплённая
  ссылка в `AvocadoPagesPage`). Данные: `lib/avocadoFooter.ts` (footer_settings: tagline/
  copyright/made_with + newsletter) + `lib/avocadoSiteSettings.ts` (site_settings: соцсети);
  форм-маппинг `features/pages/avocadoFooterForm.ts` (unit-тесты). Один Save пишет обе
  таблицы (идемпотентно, без транзакции). Гард несохранённых изменений — как везде.
- Контракт БД — schema.md §9 (`site_settings`, `footer_settings`); сайт — sites/avocado-kiss.md §6.

Отложено: набор соцсетей фиксирован X/Pinterest/Instagram (`telegram_url`/`rss_url`
в `footer_settings` — legacy, без иконок); логотипы и ведущие пункты навигации хедера
остаются захардкоженными (осознанно).

## Доработки по разделу Blog/Pages avocado (после 2026-08-08)

Раздел построен и работает (пользователь подтвердил живьём); ниже — отложенное:
- **Ручная e2e-приёмка** раздела Blog avocado под админом: создать пост каждого из
  3 типов (essay/interview/roundup) → добавить/переставить все 6 блоков → теги
  (проверить порядок эйброу) → автор → 1–2 Read-also пина → черновик → публикация →
  проверить hero и рендер блоков на сайте (`/blog`, `/blog/<slug>`); папки: создать/
  переместить/bulk-delete. Автоматический Playwright-e2e (порт 3100, live Supabase) —
  предложен, не написан.
- **CRUD авторов** в админке (сейчас только select существующих `authors`; заводить/
  править — через Supabase-коннектор). Отдельный заход при необходимости.
- **Edge-case `/avocado-kiss/pages/header`** по прямому URL рендерит cozy
  `HeaderEditPage` (у avocado нет header-редактора) → упадёт. В навигации ссылки нет;
  при необходимости — диспетчеризовать/гейтить и этот роут.
- Возможные будущие правки самим пользователем (озвучены как «потом будут доработки»).

## Subscribers для Avocado Kiss (2026-08-13)

Раздел **Subscribers** включён для второго сайта — кода админки правка не
потребовала, раздел с самого начала multi-site (читает `<schema>.subscribers`
через `getDb(site)`).
- **Миграция avocado `0018`**: таблица `avocado_kiss.subscribers` (`email` unique
  lower-case + `created_at`, GDPR-минимум без имени/IP); `revoke all` от anon +
  `grant all` `authenticated`/`service_role`; RLS без публичных политик,
  единственная `Admin manage subscribers` (`is_admin()`) — админка читает и
  удаляет (право на забвение).
- **Сайт avocado.kiss**: блок «The Culinary Dispatch» (`NewsletterForm`) теперь
  реально пишет подписки — видимый виджет Turnstile + `POST /api/newsletter`
  (Turnstile verify → insert под service_role). Новых env-ключей нет: те же
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`/`SUPABASE_SECRET_KEY`,
  что у рейтингов рецептов.
- **web.admin**: единственное изменение — `"subscribers"` в allowlist `sections`
  записи `avocado-kiss` (`src/config/sites.ts`); существующий раздел (список +
  поиск + Export CSV + удаление) появился для Avocado Kiss как есть.
- Контракт БД — schema.md §9/§10; раздел — [subscribers.md](subscribers.md);
  сайт — ../sites/avocado-kiss.md §11.

## Recipes + Recipe categories для Avocado Kiss (2026-08-25)

Последний CPT сайта заведён в админку — **без миграций** (таблицы/RLS/папки/учёт
картинок были готовы с миграций 0001/0005/0012). Контракт раздела —
[recipes-avocado-kiss.md](recipes-avocado-kiss.md).
- **Новое в web.admin**: `src/lib/recipes.ts` (полный CRUD + replace-all `recipe_tags`),
  `src/lib/recipeCategories.ts`, `src/features/recipes/` (`RecipesPage` — список с
  папками/поиском/фильтрами Category+Status/bulk; `RecipeEditPage`; чистый `recipeForm.ts`
  +тесты; `ListEditor` — ingredients/steps со стрелками ↑/↓), раздел
  **Recipe categories** на generic `features/taxonomy/` (`recipeCategoryConfig` +
  `RecipeCategoryEditDialog`).
- **Правки общего кода**: `TaxonomyConfig.usageNoun` (счётчик ряда/диалог удаления
  считают рецепты, а не товары) + ветка в `TaxonomyManager`; `TagsField` умеет
  **создавать теги** (`createTag`); `FolderSection`/`SECTION_TABLES` знают `recipes`;
  `NAV_ITEMS` + роуты + allowlist `sections` (у **cozycorner теперь явный список** —
  иначе он получил бы рецептные пункты).
- **Отклонение от конвенции**: slug рецепта редактируемый (пусто → `null` → триггер
  пересоберёт из title); везде ещё slug не отправлялся вовсе.
- **Фронт avocado.kiss не менялся** — он уже читает ровно эту структуру
  (`ingredients`/`steps` как `text[]`, категория по имени, теги через `recipe_tags`).
- Прогон: `npm run build` + `npm run lint` чисто, `npx vitest run` — 97 зелёных.
- Отложено: курирование главной (`home_slots`/Editor's Picks) — **сделано ниже,
  раздел Home**; `product_reading` («Pairs well with» / «Related reading» товаров)
  — **сделано ниже**; preview черновиков — **сделано ниже**; ручная e2e-приёмка.

## Связи страницы товара для Avocado Kiss (2026-08-25)

Блоки **«Pairs well with»** (`product_pairings`, товар → товар) и **«Related reading»**
(`product_reading`, товар → рецепт) теперь редактируются в форме товара по принципу
пинов «Read also» из блога: порядок ↑/↓, удаление, добавление через существующие
пикеры, лимит 3. Миграций нет — таблицы из миграции 0007. Новое:
`src/lib/productRelations.ts`, `src/features/products/{ProductRelationsEditor,useRelationField}`;
у cozycorner блоки скрыты (`productRelationsEnabled` по `site.schema`). Правила —
[products.md](products.md) §3a. Прогон: build+lint чисто, vitest 108 зелёных.
> ⚠️ **Устарело с 2026-08-26** (см. «Единая система рекомендаций» ниже): эти три
> файла заменены общими `src/lib/contentRelations.ts` +
> `src/features/shared/{RelationsEditor,useRelationField}`.

## Единая система рекомендаций: посты + рецепты + товары (2026-08-26)

Три несогласованные реализации блока «что дальше» сведены к одной.

**Сайт (avocado.kiss).** Новый общий резолвер `lib/relations.ts`
(`resolveRelated`): пины по `position` → авто-подбор по скорингу (категория +3,
тег +2 с потолком 4, тот же тип +1) → **детерминированный** случайный фолбэк
(seed = id источника), чтобы блок не пустел. Загрузчики стали обёртками:
`fetchRelatedReading` (блог), `fetchProductPairings`/`fetchRelatedReading` (шоп —
получили авто-подбор и фолбэк, которых у них не было), новый `fetchRecipeRelated`.
Страница рецепта впервые показывает блок (`ReadAlso` внутри `RecipeArticle`, скрыт
в `@media print`), в том числе на `/preview/recipes/[slug]`. Подробности и
известное ограничение (нет общего словаря категорий магазина и рецептов) —
[../sites/avocado-kiss.md](../sites/avocado-kiss.md) §13.

**БД.** Миграция **0021 `recipe_related`** (полиморфно рецепт | пост | товар),
применена 2026-08-26; привилегии `anon` проверены явно.

**Админка.** `RelatedEditor` + `ProductRelationsEditor` → один
`src/features/shared/RelationsEditor.tsx` (+ `useRelationField`,
`src/lib/contentRelations.ts` с общим реестром связей). Подключён к постам
(через `Controller` на RHF-поле `related` — поведение блога сохранено), товарам и
**рецептам (новое)**. Во всех блоках подпись «Optional — auto-filled if empty».

**Прогон:** avocado.kiss — build + lint чисто, vitest **198 зелёных** (24 новых на
резолвер); web.admin — build + lint чисто, vitest **178 зелёных** (10 новых на
`RelationsEditor`). Детерминированность фолбэка подтверждена сравнением двух
независимых сборок.

**Осталось:** `cozycorner/lib/products.ts` → `fetchRelatedProducts` — третий
вариант той же идеи (авто-подбор по категории, без ручных пинов и без фолбэка).
В эту задачу не входил намеренно. Для приведения к общей схеме нужны: таблица
пинов `product_related` в схеме cozycorner, порт `lib/relations.ts` (у cozy своя
модель категорий — FK, а не текст), подключение `RelationsEditor` в форме товара
через `contentRelationsEnabled`.

## Курирование главной для Avocado Kiss (2026-08-25)

Раздел **Home** — последняя таблица, которую правили только через БД
(`avocado_kiss.home_slots`). Миграций нет (схема из 0001/0004/0005). Экран
сгруппирован по слотам в порядке макета, внутри слота — стрелки ↑/↓
(оптимистичный reorder), добавление через существующие пикеры
`RecipePickerDialog`/`PostPickerDialog`, оверрайды в модалке (RHF+Zod),
`is_published` слота, удаление с подтверждением. Ёмкости («2 / 3») мягкие —
предупреждают, но не блокируют. Правила — [home-avocado-kiss.md](home-avocado-kiss.md).
Новое: `src/lib/homeSlots.ts`, `src/features/home/{HomePage,HomeSlotEditDialog,homeSlotForm}`;
`home` в `NAV_ITEMS` + роут + allowlist **только у avocado**.

- 🐛 **Постановка расходилась с кодом сайта**: просили редактировать
  `eyebrow_secondary` «только в picks», но после редизайна v2 это поле **не
  читается нигде** — `fetchEditorsPicks` селектит лишь `id, slot, description,
  is_published`, а метки Editor's Picks берутся из тегов элемента. Заодно
  `eyebrow` не доходит до picks, а `description` из карточек мозаики выводит
  только `grid_large` и баннер. Разложено в таблицу — [home-avocado-kiss.md](home-avocado-kiss.md) §2.
- **Решение**: редактор показывает поле, если сайт его рендерит **или** значение
  уже лежит в строке (иначе легаси не вычистить); игнорируемое поле подписано
  «Stored but not shown on the site». Карта живёт в `SLOT_META.renders` и
  зафиксирована юнит-тестами.
- **Метка «Item is a draft»** в строке: сайт джойнит `recipes!inner` + фильтр
  `is_published`, поэтому слот с черновиком выпадает из выдачи целиком — без
  метки редактор видел бы полный слот и дыру на сайте.
- **Фронт avocado.kiss не менялся.**
- Прогон: `npm run build` + `npm run lint` чисто, `npx vitest run` — 130 зелёных
  (22 новых: ёмкости/маппинг слотов + карта рендеринга полей).
- Отложено: превью главной, замена элемента на месте, чистка легаси
  `eyebrow_secondary` в проде (4 строки), ручная e2e-приёмка.

## Курирование главной v2: переезд в Pages + явный Save (2026-08-26)

Пересборка раздела по фидбэку: отдельный пункт меню `Home` убран, курирование
переехало **внутрь страницы** `Pages → Homepage`, автосохранение заменено на явный
Save с жёсткой валидацией. Правила — [home-avocado-kiss.md](home-avocado-kiss.md).

- **Место**: `home` больше не пункт `NAV_ITEMS` (и не в allowlist `sections`);
  `HomePage.tsx` удалён, роут `/:siteSlug/home` снят. Курирование — блок
  «Homepage content» в `AvocadoPageEditPage` при `slug === 'home'`; в списке Pages
  строки подписаны через `PAGE_LABELS` (`home` → **Homepage**, «curated content»).
- **Явное сохранение**: правки копятся в черновике `HomeSlotDraft[]`, который
  лежит **в значении формы страницы** (поле `slots` в `pageSchema`) — `isDirty`,
  `useBlocker` и Save общие у SEO и мозаики. Запись — diff (`diffSlots` →
  `saveHomeSlots`: delete → update → insert, `position` из порядка строк).
  Модалка карточки теперь **Apply**, а не Save в БД.
  - ⚠️ После Save строки перечитываются и становятся новой базой diff'а — у
    вставленных появляются `id`. Иначе второй Save подряд вставил бы их повторно.
- **Блокировка Save на неполном слоте**: место считается занятым, только если
  карточка **отрендерится** (`isRenderable` = слот опубликован И элемент
  опубликован И элемент существует). Скрытая карточка, черновик-рецепт и висячая
  ссылка дают ту же дыру, что отсутствующая строка, — решение пользователя
  «считать всё, что не отрендерится». Переполнение не блокирует (сайт отрисует
  первые N).
- **Предупреждение при удалении рецепта**: `home_slots` каскадит по FK, поэтому в
  диалоге удаления (редактор рецепта и bulk в списке) показывается, в каких слотах
  он стоит, + ссылка **Open the homepage** на подмену. Занятость —
  `listHomeSlotUsage`, ключ `['home-slot-usage', site.slug]`. Удаление не
  запрещаем: неполный слот всё равно не даст сохранить главную.
- **Правка общего кода**: `RecipePickerDialog`/`PostPickerDialog` отдают вторым
  аргументом `onSelect` саму строку списка (черновику нужны title/картинка/
  публикация сразу); прежние вызовы не затронуты.
- **Фронт avocado.kiss не менялся.**
- Прогон: `npm run build` + `npm run lint` чисто, `npx vitest run` — 157 зелёных
  (в т.ч. diff insert/update/delete, правила `isRenderable`, блокировка Save на
  скрытой карточке и черновике-рецепте).
- Отложено: превью главной, замена элемента на месте, атомарный Save (RPC),
  ручная e2e-приёмка.

## На потом (не забыть)

- **Cloudflare Turnstile**. Ключи у пользователя уже есть: Secret Key → Supabase
  Auth → Attack Protection (Turnstile); Site Key → фронт (виджет в LoginPage +
  `captchaToken` в `signInWithPassword`). Включать CAPTCHA в Supabase ТОЛЬКО после
  деплоя фронта с виджетом, иначе логин сломается для всех.
- Удалить легаси-колонку `posts.content` миграцией в репо сайта.
- RPC-атомарное сохранение поста (см. [blog.md](blog.md) §5).
- Тёмная тема (dark-токены есть, переключателя нет).

## Превью черновиков для Avocado Kiss — рецепты и посты (2026-08-25)

Последний пункт паритета с cozycorner: черновик рецепта или поста открывается на
реальном фронте avocado.kiss по токенизированной ссылке, без публикации. Модель
повторена один-в-один с cozy (миграции 0029/0031 → здесь 0019/0020).

**БД (проект zwrkphynupdubevzwdzy, схема `avocado_kiss`):**
- **0019 применена 2026-08-25** — `preview_token uuid not null default
  gen_random_uuid()` в `recipes` И `posts`; бэкфилл дефолтом (30 рецептов / 33 поста,
  все токены различны).
- **0020 применена 2026-08-26** (после деплоя сайта) — `revoke select … from anon` +
  column-grant на все колонки, кроме `preview_token`.
- Ловушка Postgres (стоила cozy нерабочей миграции 0030): column-level
  `revoke select (col)` НЕ перекрывает табличный `grant select`. Проверено на
  изолированной пробной таблице: после `revoke select on <table>` + column-grant
  `has_column_privilege(anon,'preview_token')` = false, остальные колонки = true.

**avocado.kiss:** роуты `app/preview/{recipes,blog}/[slug]/page.tsx` (force-dynamic,
noindex, вне sitemap и `generateStaticParams`; `robots.ts` намеренно не трогали).
Загрузчики `fetchRecipeForPreview`/`fetchPostForPreview` читают через
`createServiceClient()` и отдают строку только при совпадении токена, вырезая сам
токен из результата. Блоки тела поста — `includeUnpublished: true`. Новый
`lib/columns.ts` (`PUBLIC_RECIPE_COLUMNS`/`PUBLIC_POST_COLUMNS`) заменил `select("*")`
в 7 местах: `fetchHomeSlots` (embed), `fetchRecipeBySlug`, `fetchRecipesByCategory`,
`POST_SELECT`, `POST_SELECT_TAG`, `searchRecipes`, `searchPosts`. Презентация сингла
рецепта вынесена в общий `components/RecipeArticle.tsx` (превью и живая страница —
одна вёрстка); вместе с ней переехал `@media print` в `RecipeArticle.module.css`.

**web.admin:** `preview_token` добавлен в `RECIPE_COLUMNS` и `ARTICLE_COLUMNS` (только
чтение — из `RecipeInput`/`ArticleInput` исключён). `CopyPreviewLinkButton` обобщён
пропом `segment: 'blog' | 'recipes'` и вставлен в sticky-панели `RecipeEditPage` и
`ArticleEditPage`; поведение cozycorner не изменилось.

Прогон: оба репо — `npm run build`, `npm run lint`, `npx vitest run` зелёные
(avocado 155, web.admin 131). Смоук на живой БД: все 7 переписанных запросов
отдают 200 под анон-ключом.

Приёмка на проде и код-ревью — 2026-08-26, см. раздел ниже.

## Код-ревью превью черновиков (2026-08-26)

Фича задеплоена и работает на проде. Ревью на уязвимости/баги + приёмка вживую.

**🔴 Критично — окно утечки было открыто, закрыто в ходе ревью.** Миграция 0020
после деплоя так и не была применена, поэтому у `anon` оставался табличный
`select` — публичным ключом (он лежит в браузерном бандле) выгружался
`preview_token` **любого опубликованного** рецепта и поста, а с ним открывалось
`/preview/...` этого материала, где показываются и неопубликованные блоки
`post_sections`. Проверено эксплуатацией: токен вытащен через
`?select=slug,preview_token` → превью отдало HTTP 200. Ущерба не случилось —
на момент проверки ни у одного опубликованного поста не было неопубликованных
блоков, а сами черновики закрыты RLS. **0020 применена**, дыра закрыта:
анонимные `?select=preview_token` и `select=*` → 401 `42501`;
`has_column_privilege(anon,'preview_token')` = false при
`authenticated`/`service_role` = true.

**🐛 Баг (исправлен в коде, ждёт деплоя).** `fetchRelatedReading` в блоке ручных
пинов проверял `is_published` у пинов-**постов**, но не у пинов-**рецептов** —
там полагались на RLS. Превью читает service-role клиентом, который RLS обходит,
поэтому неопубликованный рецепт-пин попал бы в «Read also» ссылкой на 404.
Добавлен `is_published` в embed и явная проверка; регрессионный тест в
`lib/preview.test.ts` (проверено: с откаченным фиксом падает). Данных, которые
триггерят баг, в БД сейчас нет — он был латентным.

**Проверено и чисто:** `preview_token` не попадает ни в HTML, ни в RSC-payload
обеих превью-страниц (в разметке встречается только сам URL из адресной строки);
неверный/пустой/дублированный `?token=`, чужой slug и токен рецепта на роуте блога
— всё 404 (fail-closed); `noindex, nofollow` в обеих превью; `/preview` нет в
sitemap; ответы отдаются с `cache-control: private, no-store`; консоль превью не
содержит ошибок фичи (favicon 404 и шум Cloudflare Turnstile есть и на живых
страницах); после отзыва гранта живые главная/блог/рецепт/категория/поиск/шоп и
браузерный «Load more» (анон-ключ) → 200.

**Мелочи (не чинили, вынесены в
[../sites/avocado-kiss.md](../sites/avocado-kiss.md) §2.2):** превью не задаёт
`<title>`/`description` (виден дефолтный тайтл layout'а); на превью черновика
рецепта виден блок оценки, но `rate_recipe` гейтит `is_published` — клик вернёт
ошибку; JSON-LD в `RecipeArticle` рендерится через `dangerouslySetInnerHTML` без
экранирования `<` (контент авторский, из админки — риск низкий, но `</script>` в
заголовке разорвал бы тег).

**⚠️ Черновиков в БД нет вообще** (0 неопубликованных рецептов и постов), поэтому
основной сценарий — превью *реального черновика* с неопубликованным блоком — вживую
никем не проверялся; приёмка шла на опубликованных материалах.

**🐛 Найдено попутно, к превью не относится:** на Vercel не задана
`NEXT_PUBLIC_SITE_URL`, из-за чего весь прод-`sitemap.xml` и `robots.txt` ссылаются
на `http://localhost:3000` — sitemap бесполезен для поисковиков. Чинится
переменной окружения + редеплоем, см. [../sites/avocado-kiss.md](../sites/avocado-kiss.md) §7.
