# Avocado Kiss — архитектура сайта

> Last updated: 2026-08-25 | Source project: avocado.kiss (AGENTS.md,
> sites/avocado-kiss/specs/2026-07-17-avocado-kiss-v1-design.md) — пути файлов
> относятся к репозиторию `avocado.kiss/`

Кулинарный журнал (рецепты, английский UI): курируемая через `home_slots`
главная, страницы рецептов, страницы категорий. **Next.js 16** (App Router,
RSC) + Supabase + Vercel. Шрифт Fira Sans — self-hosted woff2 (лицензия OFL).
Модель данных — [../database/schema.md](../database/schema.md) §9 (раздел
avocado_kiss).

> ⚠️ Это **не привычный Next.js** — версия с breaking changes. Перед написанием
> кода сверяйтесь с гайдами в `node_modules/next/dist/docs/` (см. AGENTS.md
> репозитория).

Фаза A (сайт + БД) реализована и жива; интеграция с общей админкой
`web.admin` — **фаза B**, идёт по разделам. Готово: **Media** + **Curated Shop**
(Products / Categories = `shop_categories` / Brands). Ещё не в админке:
курирование главной (`home_slots`), Recipes, Pages, Footer — правятся напрямую
через БД / коннектор-скилл.

## 1. Структура репозитория

```
app/
  layout.tsx              # root layout: Header + Footer, метаданные (SEO/OG), lang="en"
  globals.css              # дизайн-токены (:root) + @font-face Fira Sans + сброс
  page.tsx                 # home: hero-карусель + курируемая сетка + Editor's Picks + newsletter
  recipes/[slug]/page.tsx  # страница рецепта (SSG+ISR): meta, image, Ingredients/Method; кнопка Print recipe (см. §2.1)
  category/[slug]/page.tsx # архив категории (SSG+ISR): только сетка RecipeCard (без заголовка/эйброу)
  shop/page.tsx            # хаб Curated Shop (SSG+ISR): ShopHero + сетка категорий + Editors' picks
  shop/[category]/page.tsx # категория магазина (SSG+ISR): ShopHero + ShopCatalog (ShopFilters + ProductGrid)
  product/[slug]/page.tsx  # товар (SSG+ISR): ProductDetail + «Pairs well with» + «Related reading»
  api/newsletter/route.ts  # POST подписки: валидация e-mail + Turnstile verify → insert
                           #   в subscribers под service_role (§11)
  not-found.tsx            # глобальная 404
  sitemap.ts               # sitemap.xml из БД (ISR 60s): главная + категории + опубл. рецепты
  robots.ts                # robots.txt: allow all + sitemap
components/            # один компонент = файл + CSS Module; SVG-иконки — в icons/
  Header.tsx / CategoryNav (внутри Header) / MobileMenu.tsx  # шапка + навигация категорий
  HeroCarousel.tsx      # клиентский hero-слайдер: GSAP-сдвиг трека (translateX), автоплей 10с, точки+стрелки
  RecipeCard.tsx        # унифицированная карточка: image-box с фикс-пропорцией (medium 4:3)
                        #   + MediaPlaceholder-фолбэк без фото + hover→accent заголовок;
                        #   варианты large/medium/list/wide. medium (сетка категории) с пропом
                        #   tags показывает теги вместо (дублирующей) категории
  TagLabels.tsx         # общий рендер меток-тегов «TAG | TAG» (Editor's Picks и карточки категории)
  EditorsPicks.tsx      # секция «Editor's Picks»: нумерованный список + sticky-карточка (метки — TagLabels)
  # --- Curated Shop (магазин) ---
  ProductCard.tsx       # карточка товара (brand/name/price/Shop) — общая: хаб, категория, «Pairs well with»
  ShopCategoryCard.tsx / ShopCategoryGrid.tsx  # «Shop by category»: image + name + «N items»
  ShopHero.tsx          # hero /shop и /shop/[category] (eyebrow + h1 + p + фон)
  EditorsPicksProducts.tsx  # «Editors' picks this month» (4 ProductCard) — НЕ путать с EditorsPicks (рецепты)
  ProductGrid.tsx       # клиентская сетка 3×3 + Load more (браузерный fetchProductsPage, дедуп по id); перезагружается при смене filters
  ShopFilters.tsx       # контролируемая панель фильтров (Brand/Price/Sort + Clear) — значения/onChange от ShopCatalog
  ShopCatalog.tsx       # композиция: держит выбор селектов, транслирует в ProductQuery для ProductGrid (паттерн cozycorner)
  ProductDetail.tsx     # товар: image + brand + title + description + price + «Buy from …» + бэклинк
  RelatedProducts.tsx / RelatedReading.tsx  # «Pairs well with» (товары) / «Related reading» (рецепты)
  NewsletterBlock.tsx / NewsletterForm.tsx  # блок рассылки «The Culinary Dispatch»; форма — реальная
                        #   подписка: видимый виджет Turnstile + POST /api/newsletter (§11)
  Footer.tsx            # подвал (текст из footer_settings)
  Reveal.tsx            # GSAP reveal-обёртка (prefers-reduced-motion учтён)
  icons/                # ChevronLeft/Right, ArrowLeft (бэклинк товара), Clock, Menu, Search, Users + соц-иконки XIcon/PinterestIcon/InstagramIcon
lib/
  supabase/client.ts / server.ts  # браузерный/серверный клиенты (db.schema='avocado_kiss'), тип DbClient
  content.ts            # fetchCategories (все), fetchNavCategories (только show_in_nav — для шапки),
                        # fetchCategoryBySlug, fetchHomeSlots (сгруппировано по слоту),
                        # fetchRecipeBySlug, fetchRecipesByCategory (embed'ит recipe_tags → recipe.tags),
                        # fetchEditorsPicks, fetchRecipeSlugs, fetchPageSeo, fetchFooterSettings
  images.ts             # resolveRecipeImage() (контракт путей картинок рецептов)
  shop.ts               # загрузчики магазина: fetchShopCategories/…/fetchProductsPage/fetchShopFilterOptions/fetchEditorsPicks/
                        #   fetchProductPairings/fetchRelatedReading + resolveProductImage/formatPrice/productPath;
                        #   типы ProductQuery (categorySlug/brand/priceMin/priceMax/sort) + ProductSort
                        #   (НЕ server-only — ProductGrid зовёт fetchProductsPage из браузера)
  types.ts              # Recipe/Category/Tag/Post/EditorPick/HomeSlot/PageSeo/FooterSettings + HOME_SLOTS;
                        #   Product/ShopCategory/ReadingItem + SHOP_PAGE_SIZE (магазин);
                        #   Subscriber/NewSubscriber (рассылка, §11 — сайт только пишет)
supabase/migrations/    # единственное место изменения схемы БД (workflow — schema.md §7, история — §10)
mockups/                # исходные SingleFile-макеты Lovable: v1 (home, recipe) + version-2/ (home v2, shop) — referencia для вёрстки
```

Папки `docs/` в репозитории нет — вся документация в `platform-docs/` (этот файл).

## 2. Рендеринг и SEO

- Все контентные страницы пререндерятся статически с ISR
  (`export const revalidate = 60`) — правка данных в БД появится на сайте в
  пределах ~минуты без редеплоя (после запуска фазы B — из админки; сейчас —
  через прямые изменения БД).
- ⚠️ Supabase-клиент не передаёт в fetch своих опций кэша — запросы наследуют
  сегментные 60s. **Не добавлять `force-cache`** в клиент — заморозит данные.
- Метадата: дефолт — `app/layout.tsx` (`title.template`, OpenGraph); страница
  home читает `pages` (slug `home`) через `fetchPageSeo`, рецепт — свои
  `seo_title`/`seo_description` (фолбэк `title`/`excerpt`), категория — свои
  `seo_title`/`seo_description` (фолбэк — автоформула из `name`).
- `sitemap.ts` включает главную, `/shop`, все категории рецептов и магазина
  (`/category/[slug]`, `/shop/[slug]`), все опубликованные рецепты
  (`/recipes/[slug]`) и все товары (`/product/[slug]`). Рецепты грузятся
  `fetchRecipeSlugs` (анон видит только опубликованные — RLS `is_published`);
  категории и товары — публичные целиком. `robots.ts` — allow all + ссылка на
  sitemap.
- ⚠️ **Правило: любой новый или изменённый публичный роут обновляет
  `app/sitemap.ts` в том же изменении** (и `generateStaticParams` страницы, если
  роут динамический). Sitemap строится из БД-загрузчиков (`lib/content.ts`,
  `lib/shop.ts`) — добавил тип контента с публичной страницей → добавь его слаги
  в sitemap. Не полагайся на память: сверь список папок-роутов в `app/` с
  записями `sitemap.ts`.

### 2.1. Печать рецепта (Print recipe)

- Кнопка **«Print recipe»** — внутри мета-бара рецепта, сразу после Cook time
  (опциональный слот `action` у `RecipeMeta`). Компонент `PrintButton.tsx`
  (`'use client'`) по клику вызывает `window.print()` — один клик, без
  навигации и отдельной страницы.
- Чистый вывод даёт **`@media print` в `app/recipes/[slug]/page.module.css`**:
  скрываются глобальные `<header>`/`<footer>` (`:global(body > header/footer)`),
  верхний рейтинг-бейдж, hero-картинка, `RatingSection` (обёрнут в
  `.ratingSectionWrap`) и сама кнопка; контент — в одну колонку; белый фон;
  `@page { margin: 16mm }`. Остаётся: категория → заголовок → описание → мета →
  ингредиенты → шаги.
- Отдельного `/print`-роута **нет** (был удалён как избыточный) — печатается
  сама страница рецепта. Соответственно в `sitemap.ts` печать не добавляется.

## 3. Курирование главной — модель `home_slots`

Главная не собирается кодом по фиксированной выборке — она **курируется**:
каждая строка `home_slots` указывает, какой рецепт показать в каком слоте
макета и в каком порядке внутри слота. Загрузчик `fetchHomeSlots()`
(`lib/content.ts`) делает один запрос с `recipes!inner` embed и двойным
фильтром `is_published = true` (и на слот, и на `recipe.is_published`) —
слот с неопубликованным рецептом просто не попадает в выдачу, а не рендерится
пустым. Результат группируется по имени слота в `Record<HomeSlotName, HomeSlot[]>`.

Слоты и роль по макету v2 (валидирует админка фазы B; сайт рендерит что есть,
не проверяет лимиты):

| Слот | Ёмкость | Где на странице (v2) |
|---|---|---|
| `hero` | 3 | Hero-карусель (слайды) |
| `grid_large` | 1 | Мозаика: feature-карточка c7 (3/2) + подзаголовок |
| `grid_medium` | 2 | Мозаика: карточки c5 (1/1) и c4 (4/5) |
| `grid_list` | 5 | Мозаика: карточки c4/c8/c3 (были текстовым списком — теперь плитки с фото) |
| `wide` | 2 | Мозаика: карточки c3 (1/1) и c6 (16/10) |
| `mosaic_banner` | 1 | Мозаика: широкий баннер c12 (21/6) с текстом поверх градиента |
| `pick` | 3 | Editor's Picks — нумерованный список 1–3 |
| `pick_feature` | 1 | Editor's Picks — карточка справа (sticky, с фото) |

Мозаика (`app/page.tsx`, компоненты `MosaicCard`/`MosaicBanner`) — фиксированный
шаблон на 12-колоночной сетке, питается **только рецептными** слотами
(`grid_*`, `wide`, `mosaic_banner`). `pick`/`pick_feature` отданы секции
Editor's Picks и могут ссылаться на рецепт **или** пост (см. ниже).

Оверрайды и фолбэки (поля `home_slots`, не `recipes`):
- `eyebrow` — оверрайд лейбла над карточкой/hero-заголовком; пусто →
  категория рецепта (или «Recipe of the week» для hero — фолбэк в `app/page.tsx`).
- `eyebrow_secondary` — **устар.** (до v2 — второй лейбл picks); метки Editor's
  Picks теперь берутся из тегов элемента, не из этого поля.
- `description` — оверрайд описания (feature-карточка мозаики, Editor's Picks);
  пусто → `excerpt` элемента.

### 3.1 Типы контента и теги (модель v2)

Три типа контента (post types):
1. **recipe** (рецепт) — таблица `recipes`, свой single-page `/recipes/[slug]`.
2. **post** (пост блога) — таблица `posts` + динамические секции тела
   `post_sections` + авторы `authors`; архив `/blog` (баннер+бокс `ShopHero` из
   строки `pages.blog` — hero_eyebrow/title/description/image, мигр. 0010, фолбэк
   на код-константу; фильтр по тегам + Load more) и single-page `/blog/[slug]`;
   в шапке ведёт пункт
   **Article**. Данные — `lib/blog.ts` (`fetchPosts`/`fetchPostBySlug`/
   `fetchPostSlugs`/`fetchPostSections`/`fetchRelatedReading`/`fetchBlogTags`).
   Три шаблона (`posts.template`) реализованы: **essay** (полноэкранный hero +
   отдельный byline), **interview** (сплит-hero, блок `qa`), **roundup**
   (центрированный hero + широкая фигура с подписью `posts.hero_caption`, блок
   `list_item` с номером + вложенной карточкой рецепта). byline/share у essay —
   отдельной полосой (`ArticleByline`), у interview/roundup — внутри hero
   (`ArticleMeta`). Hero-вариант выбирается `ArticleHero` по `template`.
   **Блоки тела** (`post_sections`, единая таблица, дискриминант `type`,
   порядок `position`): `text` (вариант lead/body), `quote`, `image`,
   `recipe_card` (FK → recipes), `qa`, `list_item` — переиспользуемые, редактор
   добавляет в любом порядке (компонент-диспетчер `PostSections`). Hero-эйброу —
   теги поста через « · ». **Read also** (`fetchRelatedReading`) — гибрид: ручные
   пины `post_related` (полиморфно recipe/post) сверху, затем авто-добор постами
   (общий тег → свежесть), затем рецептами до 3 карточек.
3. **product** (товар) — по образцу cozycorner; **ещё не реализован**, заведём
   позже; пункт шапки **Curated Shop** (`/shop`).

**Категории vs теги** — разные сущности:
- **Категории** (`categories`, поле `recipes.category`) — раздел рецепта,
  показываются в карточках (SEASONAL). Рецепт может относиться к нескольким.
- **Теги** (`tags` + `recipe_tags`/`post_tags`) — сквозные метки контента,
  общие для всех типов. Два пласта: журнальные (LIFE, COMMUNITY) и дескрипторы
  блюда (Vegetarian, Quick, Comfort Food, …). Выводятся через «\|»
  (`VEGETARIAN | QUICK`) общим компонентом `TagLabels` — в Editor's Picks и в
  теле карточки на странице категории (там теги **заменяют** дублирующую
  категорию; данные — `fetchRecipesByCategory` embed'ит `recipe_tags`).

**Editor's Picks** (`fetchEditorsPicks`, компонент `EditorsPicks`): слоты
`pick`/`pick_feature` разрешаются в рецепт или пост; выводятся заголовок,
описание, теги, а у правой карточки — ещё и фото. Админка фазы B выбирает для
каждого слота элемент (рецепт/пост) и держит набор тегов элемента коротким.

## 4. Картинки

- Формат хранения — [schema.md §4](../database/schema.md): относительный
  плоский ключ бакета `avocado-kiss-photos` ИЛИ внешний URL. Разбор —
  `resolveRecipeImage()` (`lib/images.ts`) → `{ url, unoptimized }` (или
  `null`, если путь пуст).
- Свои картинки оптимизируются через `next/image` (хост `*.supabase.co`
  разрешён в `next.config.ts`, `pathname: '/storage/v1/object/public/**'`);
  внешние рендерятся с `unoptimized: true` — их хосты в `remotePatterns`
  добавлять не нужно (тот же принцип, что в cozycorner — не расширять
  allowlist, не тратить квоту оптимизации Vercel на чужие CDN).
- Поля картинок рецептов в v1 — `recipes.hero_image_path` (используется и как
  обложка карточки, и как hero-фото страницы рецепта); отдельного поля под
  картинку рецептной категории нет. У магазина (§8) свои поля картинок:
  `products.image_path` и `shop_categories.hero_image_path` (тот же контракт
  бакета `avocado-kiss-photos`), разбор — `resolveProductImage()` (`lib/shop.ts`,
  зеркало `resolveRecipeImage`, тот же бакет). Тестовый сид товаров —
  `image_path=null` → рендерится `MediaPlaceholder`.
- Битый/пустой путь → `resolveRecipeImage` возвращает `null`; карточки мозаики,
  Editor's Picks и `RecipeCard` (сетка категории) рендерят брендовый плейсхолдер
  `MediaPlaceholder` (надпись «Avocado Kiss» на бумажном градиенте) вместо
  пустого прямоугольника — поэтому ячейки сетки категории не «схлопываются».
- `RecipeCard` держит фикс-пропорцию image-box на `.imageWrap` (medium — 4:3,
  large — 5:4, wide/portrait — 4:5), чтобы фото и плейсхолдер занимали одну
  рамку и лента категории была ровной.

## 5. GSAP-анимации

- **`HeroCarousel`** (`components/HeroCarousel.tsx`, клиентский): слайды выложены
  в горизонтальный flex-**трек** (`.track`) внутри `overflow:hidden`-вьюпорта;
  переключение — GSAP-сдвигом трека (`xPercent: -100*index`, `power2.inOut`,
  600ms) — виден «проезд», не кроссфейд. **Бесшовный вперёд-луп:** за последним
  слайдом рендерится клон первого; долистав до клона, `onComplete` мгновенно
  снапит трек на слайд 0 (`gsap.set`). Автоплей каждые **10с** (`AUTOPLAY_MS`,
  задел под настройку в админке) с паузой при hover (`hovered` ref) и `animating`
  ref-гардом против наложения твинов; точки/стрелки — вручную. `prefers-reduced-
  motion` → мгновенный сдвиг (`duration: 0`). Не текущие слайды (и клон) помечены
  `aria-hidden` + `tabIndex=-1` — вне tab-order/скринридера. Ширина: слайдер
  центрируется на `--hero-slider-max` (**1400px** — чуть шире контентного
  `--shell-max` 1320px, но не во всю ширину), с малыми боковыми отступами
  (`padding-inline: clamp(0.75rem,1.5vw,1.5rem)`). Высота (≥768): не aspect-ratio,
  а `height: calc(100svh - 11.5rem)` (вычтены sticky-шапка bar+nav 8rem, верхний
  отступ 2rem, зазор снизу), `min/max-height` — чтобы слайдер целиком помещался
  во вьюпорт при первой загрузке.
- **`Reveal`** (`components/Reveal.tsx`, клиентский): обёртка вокруг секций/
  карточек — GSAP `from()` (`autoAlpha: 0, y: 24`) через `ScrollTrigger`
  (`start: "top 88%", once: true`), `@gsap/react`'s `useGSAP` со `scope`.
  Контент рендерится на сервере как обычно — прячет и анимирует его только
  клиентский GSAP после гидрации, поэтому SEO/no-JS не страдают.
  `prefers-reduced-motion` → анимация не запускается, контент остаётся
  видимым. Пропс `delay` — для стаггера соседних карточек (напр. лента
  категории). Мозаика главной в `Reveal` не оборачивается (плитки видны сразу).
- Hover-зум картинок карточек и смена цвета заголовков — чистый CSS
  (transition), без GSAP — как в cozycorner.

## 6. Навигация и структура страниц

- **Header**: sticky, **сплошной непрозрачный фон** (`--background`, без blur —
  чтобы при скролле контент не просвечивал); слева — **рабочая** строка поиска
  (десктоп, ≥768px), логотип по центру; справа — соц-иконки (Instagram/X/Pinterest,
  line-стиль под набор, ссылки на **домашние страницы сервисов**, видны ≥768px) и
  **иконка-триггер поиска** (мобайл, <768px, открывает полноэкранный оверлей — как
  в cozycorner); под шапкой — `CategoryNav` из **`fetchNavCategories()`** (только
  `show_in_nav = true`, сортировка `position, name`), а следом — статические пункты
  **Articles** (архив блога, в работе) и **Curated Shop** (`/shop`). Оба варианта
  шапки (`Header` и `MobileMenu`) содержат эти ссылки. Скрытая из нав категория
  (напр. `Seafood`, `show_in_nav=false`) остаётся доступна по `/category/<slug>`,
  в поиске и на главной — страницы/sitemap берут полный `fetchCategories()`.
  Глобальный поиск — §9.
- **MobileMenu**: простое раскрытие (не отдельный диалог) — см. «Вне объёма v1»
  в спеке дизайна.
- **Footer**: бренд + tagline, колонка Magazine (**About, Contact** — ссылки живые,
  флаг `STATIC_PAGES_ENABLED=true`, миграция 0017), колонка Follow (соцсети), нижняя
  строка copyright/made_with из `footer_settings` + ссылки **Privacy** и **Terms**.
- **Статические страницы (миграция 0017):** роуты `/about`, `/contact`, `/privacy`,
  `/terms` — RSC + ISR `revalidate=60`, SEO из строк `pages` (`fetchPageSeo`) с
  код-фолбэком. About — `about_content` (intro/story/3 карточки, компоненты
  `components/about/*`); Contact — `contact_content` (email `mailto` + соцсети из
  `buildSocials`, компоненты `components/contact/*`); Privacy/Terms — `pages.body`
  (Markdown) через `LegalArticle`+`MarkdownText` (`react-markdown`), null → встроенный
  шаблон-фолбэк (⚠️ до запуска вставить реальные юрлицо/контакт/дату). Все поля
  nullable → безопасный фолбэк. Правятся в web.admin: Pages → редактор по slug.
- **Глобальные секции (соцсети) — DB-driven (миграция 0016):** соцсети
  (**Instagram / X / Pinterest** — порядок задан массивом `defs` в `buildSocials()`
  и оттуда единообразно расходится в шапку, футер и бургер) — сайт-глобальные,
  лежат в `site_settings`
  (`x_url`/`pinterest_url`/`instagram_url`), читаются один раз в `app/layout.tsx`
  (`fetchSiteSettings`) и через `buildSocials` (`lib/socials.ts`) прокидываются в
  Header, MobileMenu и Footer. Иконки — в коде (`SOCIAL_ICONS`, ключ — стабильный
  `x`/`pinterest`/`instagram`, не label; клиентский `MobileMenu` резолвит иконку по
  ключу, т.к. компонент-функцию нельзя передать через RSC-границу). Пустой URL —
  сеть не рендерится. Правится в админке: web.admin → Pages → «Footer & socials»
  (один Save пишет `footer_settings` + `site_settings`). `revalidate=60` в layout —
  правки видны в течение минуты. Прежний захардкоженный `SOCIALS` удалён.
- Глобальный поиск в шапке — реализован (§9).

## 7. Окружение и деплой

```
NEXT_PUBLIC_SUPABASE_URL=https://zwrkphynupdubevzwdzy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…   # публичный ключ, не secret!
# Мутации сайта (рейтинги рецептов §10 + подписка на рассылку §11) — одни и те же ключи.
NEXT_PUBLIC_TURNSTILE_SITE_KEY=…                 # публичный site key виджета Turnstile
TURNSTILE_SECRET_KEY=…                           # server-only: проверка токена у Cloudflare
SUPABASE_SECRET_KEY=sb_secret_…                  # server-only: запись под service_role
```

- SUPABASE-переменные нужны всегда (главная и рецепты тянут данные при сборке);
  шаблон — `.env.example`. Для чтения контента сайту хватает публичного ключа;
  service-role и секреты Turnstile нужны только двум серверным мутациям —
  рейтингам рецептов (§10) и подписке на рассылку (§11), новых ключей подписка не
  добавила. Схема `avocado_kiss` уже добавлена в **Exposed schemas** (готово, не
  pending).
- **Деплой на Vercel ещё не настроен** — прод-URL pending. Когда появится
  проект на Vercel: связать с GitHub-репозиторием, задать те же переменные
  окружения (Production + Preview), `NEXT_PUBLIC_SITE_URL` — реальным доменом.
- Интеграция с общей админкой `web.admin` — **фаза B**, по разделам. Сделано:
  запись в `SITES` (slug `avocado-kiss`, `sections` allowlist), разделы **Media**
  и **Curated Shop** (Products / Categories = `shop_categories` / Brands — на
  generic-коде cozy, site-aware по `site.schema`). Осталось: Recipes, Home (пикер
  слотов), Pages, Footer. Контракт БД — schema.md; план — `plans/2026-08-08-*`.

## 8. Curated Shop (раздел магазина)

Куратируемый магазин: сетка категорий + товары + карточки товара со связанной
курацией. Собственная таксономия (`shop_categories`), товары в `products`,
связь товар↔категория — **M2M `product_categories`** (миграция 0013, паритет с
cozy; старая текстовая `products.category` удалена в 0014), курация тремя
join-таблицами (schema.md §9). Данные — `lib/shop.ts` (загрузчики поверх
Supabase; **не** `server-only` — `ProductGrid` вызывает `fetchProductsPage` из
браузера для Load more). Типы — `lib/types.ts` (`Product`, `ShopCategory`,
`ReadingItem`, `SHOP_PAGE_SIZE = 9`).

**Маршруты (все SSG + ISR `revalidate = 60`):**

- `/shop` — хаб: `ShopHero` из hero-полей строки `pages.shop`
  (`hero_eyebrow`/`hero_title`/`hero_description`/`hero_image_path`, мигр. 0010;
  фолбэк на код-константу `HUB_HERO`, если поле пусто) + сетка категорий
  (`fetchShopCategories`, сортировка `position, name`, «N items» из
  `item_count`) + «Editors' picks this month» (`fetchEditorsPicks`, 4 товара).
  SEO и hero-баннер — из одной строки `pages.shop` (`fetchPageSeo('shop')`).
- `/shop/[category]` — страница категории: `ShopHero` из полей `shop_categories`
  (`generateStaticParams` ← `fetchShopCategorySlugs`) + `ShopCatalog` = рабочая
  панель `ShopFilters` + `ProductGrid` (паттерн cozycorner `ShopCatalog`).
  Фильтры: **Brand** (реальные бренды категории через `fetchShopFilterOptions(client,
  categorySlug)`), **Price** (диапазоны Under $30 / $30–$60 / $60 and up), **Sort**
  (Newest / Price ↑ / Price ↓) + кнопка **Clear** (видна, когда что-то выбрано).
  `ShopCatalog` держит выбор в клиентском состоянии (**без URL-параметров** — как
  cozycorner) и транслирует его в `ProductQuery`; смена фильтров сбрасывает сетку и
  грузит её заново с первой страницы. Категория страницы — постоянный фильтр поверх
  выбора. `ProductGrid` рендерит первую страницу (9, сетка 3×3) на сервере и
  догружает следующие кнопкой **Load more** через браузерный
  `fetchProductsPage(supabase, {categorySlug, page, ...filters})`; дедуп по `id`;
  кнопка прячется, когда пришло < `SHOP_PAGE_SIZE`. Порядок «Newest first»
  детерминирован (`created_at desc, id desc`); сортировки по цене — `price` +
  вторичный ключ `id desc`.
- `/product/[slug]` — страница товара (`generateStaticParams` ←
  `fetchProductSlugs`): `ProductDetail` (`fetchProductBySlug`; эйброу/бэклинк —
  **главная категория** товара, наименьший `position` из M2M) +
  «Pairs well with» (`fetchProductPairings` → 3 товара, без само-ссылки) +
  «Related reading» (`fetchRelatedReading` → 3 **опубликованных** рецепта).

**Курация:** `fetchRelatedReading` embed'ит `recipes!inner` +
`eq('recipe.is_published', true)` — неопубликованные рецепты в блок не
протекают (паттерн `fetchHomeSlots`); проекция рецепта → `ReadingItem`
(`href=/recipes/{slug}`). Связь товар↔категория — **M2M `product_categories`**
(→ `shop_categories`): `fetchProductsPage` фильтрует категорию через membership
(`slug → id → product_id`, затем `.in("id", …)`), `attachCategoryNames` достраивает
главную категорию (`primaryCategory`, наименьший `position`), а
`fetchShopFilterOptions` берёт бренды товаров категории тем же путём.
`shop_categories.item_count` держит триггер `sync_item_count`. Бренд остаётся
текстом `products.brand` (справочник `brands` — только для пикера админки), поэтому
фильтр и поиск по бренду читают `products.brand` напрямую.

**Картинки товаров:** бакет `avocado-kiss-photos` (§4), `products.image_path` /
`shop_categories.hero_image_path`; разбор — `resolveProductImage()`. Тестовый
сид — `image_path=null` → `MediaPlaceholder`.

**Контент/посев:** через скилл `avocado-content-ops` (6 категорий, 36 товаров,
4 picks, по 3 пары/чтения на товар). Правка — тем же скиллом; фаза B добавит
секции магазина в `web.admin`.

## 9. Глобальный поиск

Поиск по всему сайту (порт из cozycorner). **Обычный ilike-подстрочный поиск
через PostgREST `.or()`** — RPC/FTS/`pg_trgm` для текущего размера каталога не
нужны, отдельных миграций/индексов нет. Данные — `lib/search.ts` (**не**
`server-only`: те же функции работают и в браузере — live-панель в шапке, — и на
сервере — страница `/search`). Функции принимают `client: DbClient` аргументом.

**Что ищется (5 типов, порядок выдачи — рецепты первыми):**
рецепты → категории рецептов → статьи блога → товары → категории магазина.

| Функция | Таблица | Поля (`.or()` ilike) | Фильтр | Сортировка |
|---|---|---|---|---|
| `searchRecipes` | `recipes` | title, excerpt, category, author_name | `is_published=true` | `published_at desc, id desc` |
| `searchCategories` | `categories` | name | — | `position, name` |
| `searchPosts` | `posts` | title, excerpt | `is_published=true` (у posts **нет** `post_type`) | `published_at desc, id desc` |
| `searchProducts` | `products` | title, description, brand | — (нет `is_published`; наличие = живой) | `created_at desc, id desc` |
| `searchShopCategories` | `shop_categories` | name | — | `position, name` |

- `sanitizeSearchQuery` — обрезает до 100 символов, заменяет ломающие `.or()`
  символы `,()` пробелами, экранирует спецсимволы LIKE `\ % _`; пустая строка на
  выходе = «поиска нет». `searchPath(q)` → `/search?q=…`. `SearchResult<T> =
  { items, total }` (`count:"exact"` — для счётчиков и «See all N»). Лимиты —
  константы `SEARCH_*_LIMIT` + `SEARCH_DROPDOWN_LIMIT=5` / `SEARCH_OVERLAY_LIMIT=10`.
- `searchProducts` **не** достраивает `category_name` (ни строка выпадашки, ни
  `ProductCard` его не используют) — лишний lookup к `shop_categories` не делается.

**UI — `components/SearchBox.tsx`** (`"use client"`): общий хук `useSiteSearch`
(query + debounce 300ms + стоп-контроль устаревших ответов `seqRef` + сброс при
навигации) и две поверхности, переключаемые по брейкпоинту **768px** (совпадает с
шапкой):

- **Десктоп (≥768px)** — `SearchBox` (default export): инлайн-инпут слева в шапке
  + live-панель `#header-search-results`. `Enter` → `/search`, `Escape` / клик вне
  закрывают панель.
- **Мобайл (<768px)** — `SearchMobile` (named export): иконка-триггер **справа** в
  шапке → полноэкранный оверлей (`role="dialog"`, блокировка прокрутки фона,
  автофокус). Крестик/`Escape` закрывают.
- Активна всегда только видимая поверхность (у скрытой query пустой → без
  запросов), поэтому дублирования запросов нет.
- **Cmd/Ctrl+K** (расширение сверх cozycorner): фокус инпута на десктопе / открытие
  оверлея на мобайле.
- Миниатюры строк: `resolveRecipeImage` (рецепты/статьи/категории магазина),
  `resolveProductImage` (товары); у категорий рецептов картинки нет → плитка-
  заглушка.

**Страница `/search`** (`app/search/page.tsx`, RSC): динамическая (`await
searchParams`), `robots: { index: false }` — **намеренно не в `sitemap.ts`**. Hero
(`ShopHero`) + сводка непустых групп + секции карточек в том же порядке
(рецепты первыми), переиспользуют `RecipeCard`/`PostCard`/`ProductCard`/
`ShopCategoryCard`; категории рецептов — лёгкие текст-карточки-ссылки.

## 10. Рейтинги рецептов (звёзды)

Оценка рецептов на странице `/recipes/[slug]`. Две поверхности:

- **Read-only бейдж** (`RatingBadge`) **над заголовком** рецепта (под эйброу
  категории) — звёзды + отображаемое среднее и число оценок.
- **Интерактивный 5-звёздочный пикер** (`RatingSection`) в самом низу рецепта —
  посетитель ставит оценку. При отправке звёзды остаются подсвечены на выбранном
  значении + плавающий тултип-пилюля со спиннером «Sending your rating…»
  (абсолютно спозиционирован, не двигает разметку); после ответа — «Thanks! You
  rated N★» + свежее среднее. Ошибка/непройденный челлендж — тем же тултипом.

Отображаемое среднее **`display_avg` берётся с полом `min_display_rating`
(default 4.1)** и может быть «затравлено» админом (`seed_count`/`seed_sum`) —
модель данных и GENERATED-колонки в [../database/schema.md](../database/schema.md)
§9 (`recipes` рейтинги, `recipe_ratings`, `rate_recipe`).

**Отображаемое число оценок — не `display_count` напрямую.** Пока реальных
оценок ≤100, показывается стабильное псевдослучайное число **1–500**,
детерминированно выведенное из `recipe.id` (`socialProofCount` в
`avocado.kiss/lib/rating.ts`) — одинаковое между рендерами/перезагрузками
(не мигает) и никогда не «0 Ratings». Как только реальных оценок станет **>100**
(`REAL_COUNT_THRESHOLD`) — показывается реальное `display_count`. Это чисто
витринное число: в БД оно не хранится, применяется и к бейджу, и к секции.

JSON-LD `aggregateRating` (schema.org Recipe) отдаётся только при
`display_count > 0` и содержит **честный** реальный `display_count`/`display_avg`
(не витринный 1–500) — иначе выдуманные счётчики отзывов в структурированных
данных нарушают правила Google.

Голоса пишутся через `POST /api/recipes/[slug]/rate` — **Route Handler, первая
мутация в репозитории**: он проверяет токен Cloudflare Turnstile и пишет
service-role ключом через RPC `rate_recipe` (server-only секреты
`SUPABASE_SECRET_KEY` + `TURNSTILE_SECRET_KEY`, никогда не `NEXT_PUBLIC_`).
Дедуп «один голос на браузер» — **только localStorage** (UX-подсказка, на сервере
не форсится). Это API-роут (не страница), нового публичного PAGE-роута нет —
`sitemap.ts` не меняется.

**Раскладка страницы рецепта** (`app/recipes/[slug]/page.module.css`): hero-фото
короче (aspect-ratio `16/9` на мобиле, `2/1` от 768px, `max-height: 60vh`);
`.article` **без нижнего паддинга** — нижний зазор страницы держит последняя
секция (`RatingSection`, симметричный `padding-block`), чтобы её верхний и нижний
отступы были равны и одинаковы на всех разрешениях (не добавляй `padding-bottom`
статье обратно).

Спека: [avocado-kiss/specs/2026-08-06-recipe-ratings-design.md](avocado-kiss/specs/2026-08-06-recipe-ratings-design.md).

**Тесты:** `lib/search.test.ts` (unit: `sanitizeSearchQuery`, `searchPath`,
`searchRecipes`), `e2e/search.spec.ts` (Playwright, :3100, live Supabase: десктоп
выпадашка → `Enter` → `/search`, прямой переход, empty-state; мобайл триггер →
оверлей → ввод → закрытие).

## 11. Форма подписки на рассылку (Cloudflare Turnstile)

Блок **«The Culinary Dispatch»** (`NewsletterBlock` + `NewsletterForm`; рендерится
на главной и на страницах блога) — реальный сбор email в
`avocado_kiss.subscribers` ([schema.md](../database/schema.md) §9, миграция 0018).
Тексты блока — из `footer_settings` (newsletter\_\*). Поток:

1. Клиент (`NewsletterForm`, `"use client"`) рендерит **видимый** виджет Turnstile
   (`components/Turnstile.tsx`) прямо в блоке — тот же паттерн, что у
   `RatingSection` (рейтинги рецептов, §10), — и получает токен **заранее**, до
   сабмита. Нет токена → запрос не уходит («Just a moment while we verify…»).
   Токен Turnstile **одноразовый**, поэтому после каждой завершённой попытки
   виджет перемонтируется (инкремент `key`) и выдаёт свежий — иначе вторая
   подписка с той же страницы получила бы 403.
2. Email + токен уходят `POST /api/newsletter`
   (`app/api/newsletter/route.ts`, Route Handler). На сервере: валидация email,
   проверка токена у Cloudflare (`challenges.cloudflare.com/turnstile/v0/siteverify`,
   `TURNSTILE_SECRET_KEY` + `remoteip`), затем insert через
   `lib/supabase/service.ts` (`createServiceClient()`, **service_role**, схема
   `avocado_kiss`). Email пишется в lower-case.
3. Коды ответа: **400** — невалидный email или битое тело; **403** — токена нет
   или он не прошёл проверку; **200 `{ok:true}`** — записано; **200 `{ok:true}`**
   и на `unique_violation` `23505` (дубликат = успех, идемпотентно; факт того, что
   адрес уже подписан, наружу не раскрывается); **500** — прочие ошибки БД.
4. Форма показывает статус: Subscribing… / Thanks for subscribing! / текст ошибки.

**Отличие от cozycorner (осознанное):** cozy использует **невидимый** виджет
(`execution: "execute"`) и Server Action `lib/newsletter.ts`; avocado.kiss
переиспользует **свою** конвенцию — видимый виджет + Route Handler, как у
рейтингов. Site key Turnstile **один на весь сайт** (общий для рейтингов и
подписки); режим виджета настраивается в дашборде Cloudflare и общий для обоих.

**Почему service_role, а не anon INSERT:** публичный anon-ключ есть в браузере;
разреши анону INSERT — бот слал бы POST прямо в Supabase REST в обход Turnstile.
Запись только под service_role убирает публичный путь записи → Turnstile реально
гейтит каждую строку. Таблица закрыта для анона полностью (дефолтный schema-grant
`select` снят явным `revoke`), публичных RLS-политик нет; смотреть/удалять может
только admin (`Admin manage subscribers`, `is_admin()`) — право на забвение GDPR.
Данные минимальны: только email + дата, без имени и IP.

**Ключи — новых нет.** Подписке служат те же три переменные, что уже были у
рейтингов рецептов (§7, `.env.example`): `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
(клиент, вшивается в билд), `TURNSTILE_SECRET_KEY` и `SUPABASE_SECRET_KEY`
(оба server-only, никогда не `NEXT_PUBLIC_`). В настройках виджета Cloudflare
должен быть добавлен домен прода, иначе токен не пройдёт; локально — тестовые
всегда-проходящие ключи Cloudflare.

**Privacy Policy — правок не потребовалось:** политика avocado.kiss уже покрывает
и email рассылки, и Turnstile. `pages.body` для slug=`privacy` пуст → рендерится
код-версия `app/privacy/page.tsx` (искать текст в БД не нужно).

**Админка:** список/поиск/экспорт CSV/удаление — раздел **Subscribers** в
`web.admin` (multi-site, читает `<schema>.subscribers`); для Avocado Kiss включён
добавлением `"subscribers"` в allowlist `sections` записи `avocado-kiss`
(`web.admin/src/config/sites.ts`). Правила раздела —
[../admin-panel/subscribers.md](../admin-panel/subscribers.md).

Это API-роут (не страница) — нового публичного PAGE-роута нет, `sitemap.ts` не
меняется.

## 12. CSS-конвенции: токены, ссылки, оболочка страницы

Дизайн-система целиком живёт в `:root` внутри `app/globals.css` — компоненты
берут только `var(--token)` и не хардкодят значения. Введено 2026-08-25, спека
[avocado-kiss/specs/2026-08-25-links-green-layout-design.md](avocado-kiss/specs/2026-08-25-links-green-layout-design.md).

### 12.1 Зелёный — один

Акцент ровно один: **`--accent: #467748`**. Ни одного второго зелёного в сборке
нет (проверено обходом computed styles всего DOM на `/blog` и странице рецепта).
Производные оттенки — тоже токены, а не инлайновые `color-mix()`:

| Токен | Значение | Где |
|---|---|---|
| `--accent` | `#467748` | эйброу, буллеты, номера шагов, активный чип, кнопки |
| `--accent-foreground` | `#fcfaf6` | текст поверх заливки `--accent` |
| `--accent-border` | `#90a78c` | рамка чипа/карточки на ховере (плоская смесь `accent 50% + --border`) |
| `--accent-soft` | `rgba(70, 119, 72, 0.08)` | подложка ховера кнопок и пунктов меню |

`--accent-border` посчитан вручную и при смене `--border` **сам не
пересчитается**. `--accent-soft` намеренно оставлен полупрозрачным: ложится и на
`--background`, и на `--card`.

Зелёный `#3f6b46` встречается в `mockups/version-2/avocado-kiss-home.html` как
CSS-фолбэк — это артефакт макета Lovable, в сборку не попадает, за эталон не брать.

### 12.2 Цвета ссылок — непрозрачными литералами

`:visited` вычисляется браузером в **ограниченном режиме приватности**: значения
с альфой, `color-mix()`, `color(srgb …)` и цепочка `inherit` там отбрасываются, и
ссылка откатывается к дефолтному «посещённому» цвету UA. Отсюда два правила:

1. **Цвет ссылки задаётся непрозрачным литералом через токен**, а не `color-mix()`.
   Для этого и заведены `--icon-muted: #47545f` (иконки соцсетей),
   `--nav-link: #3b4854` (навигация в шапке), `--menu-link: #283745` (бургер) —
   это плоские значения прежних смесей над `--background`.
2. **Состояния перечисляются явно:** `.x, .x:link, .x:visited` для базового цвета
   и `.x:hover, .x:focus-visible` для ховера. Индикация посещённости на этом сайте
   не нужна нигде.

⚠️ **Глобальные правила для `a` держим нулевой специфичности.** Голый
`a:link`/`a:visited` — это (0,1,1), он перебивает **любой** одноклассовый цвет
ссылки в CSS-модулях (все они (0,1,0)) и разом красит их в `inherit`. Именно так
однажды почернели чипы фильтра блога. Предохранитель пишется отдельным правилом
через `:where()`:

```css
a { color: inherit; text-decoration: none; }
a:where(:link, :visited) { color: inherit; text-decoration: none; }
```

`:where()` обнуляет вклад псевдоклассов → правило остаётся (0,0,1). Отдельным
правилом, а не одним списком: браузер без `:where()` отбросит только
предохранитель, базовое `a` уцелеет. Устойчивость к `:visited` даётся **точечно**,
на уровне компонента, где специфичность и так выше.

Следствие для компонентов с двумя состояниями (`BlogFilters`: `.chip` /
`.chip.active`): тройку `:link`/`:visited` получают **оба** правила. Покрыть
только `.chip` нельзя — он станет (0,1,1) и перебьёт `.active` (0,1,0). И
`.active:hover` обязан повторять `background`/`border-color`, иначе `.chip:hover`
(0,2,0) кладёт поверх зелёной заливки бледный `--accent-border`.

### 12.3 Оболочка страницы — sticky-футер

`body` — flex-колонка высотой `min-height: 100svh`, контент распирает её:

```css
body { min-height: 100svh; display: flex; flex-direction: column; }
body > main { flex: 1 0 auto; }
```

Шапка прижата к верху, футер — к низу, контент занимает остаток. Видно на
коротких страницах: пустая категория, поиск без результатов, 404.

Обёртки нет намеренно — **каждая страница проекта обязана рендерить `<main>`
первым элементом**, селектор `body > main` опирается на это. Новая страница без
`<main>` не сломается, но потеряет прижатие футера. `svh`, а не `vh`: на
мобильных `100vh` считается по развёрнутому окну и даёт лишнюю прокрутку.

`display: flex` на `body` совместим с липкой шапкой (`position: sticky` внутри
flex-контейнера работает) и с `overflow-x: clip` на `html, body` — но `clip`
менять на `hidden` по-прежнему нельзя, это ломает sticky.

### 12.4 Шрифт: self-hosted Fira Sans — проверять покрытие файла

Шесть `@font-face` в `globals.css` → `public/fonts/fira-sans-{300,300-italic,400,500,600,700}.woff2`,
все — **latin-подмножество** Google Fonts (229 кодпоинтов: `U+0020-007E`,
`U+00A0-00FF`, типографские кавычки/тире, `U+20AC` и т.п.). Preload в
`app/layout.tsx` — только 400 и 600, остальные подтягиваются по требованию с
`font-display: swap`.

⚠️ **Ловушка при добавлении веса.** CSS с `fonts.googleapis.com/css2` отдаёт
**семь** `@font-face` подряд — по одному на подмножество, и **первым идёт
`cyrillic-ext`**, а нужный `latin` — последним. Скачав «первый woff2 из ответа»,
получаешь файл без единой латинской буквы. Ровно это и произошло с Light 300
(2026-08-04): в `fira-sans-300.woff2` лежал `cyrillic-ext` — 193 кодпоинта,
`U+0460-052F` плюс пробел и одинокая `A`. Латиница в нём отсутствовала целиком,
поэтому **весь текст весом 300 на сайте рисовался системным шрифтом** через
по-глифовый фолбэк: лид `/about` и `/contact`, dek статьи (`ArticleHero`), лид-
абзац поста (`TextBlock .lead`), цитаты (`QuoteBlock`). Внешне читалось как
«тут другой шрифт», при том что `getComputedStyle` честно показывал
`font-family: "Fira Sans"` — подмена происходит на уровне глифов, в CSS её не
видно. Исправлено 2026-08-25 заменой на `latin`-файл.

**Проверка нового файла шрифта — обязательна, глазами на computed style её не
поймать:**

```python
from fontTools.ttLib import TTFont           # pip install fonttools brotli
new, ref = TTFont('fira-sans-300.woff2'), TTFont('fira-sans-400.woff2')
n, r = set(new.getBestCmap()), set(ref.getBestCmap())
assert not (r - n), sorted(r - n)            # покрытие не уже эталонного 400
assert all(ord(c) in n for c in 'abcxyzABCXYZ')
print(new['OS/2'].usWeightClass)             # должен совпасть с font-weight в @font-face
```

Признак-подсказка без инструментов: **размер файла**. У latin-подмножества Fira
Sans все веса ~18–25 КБ и близки друг к другу; файл, заметно выпадающий из ряда,
почти наверняка не то подмножество.

Вес 300 (Light) — не украшение, а часть типографики: им набраны лид-абзацы и
цитаты («текст разной толщины», см. комментарий в `TextBlock.module.css`).
Поэтому битый Light ломает вид сразу пяти поверхностей, а не одной страницы.
