# Urban Gardener — Фаза 2: срез Articles

> Статус: **утверждён владельцем 2026-10-15** (ответы на открытые вопросы — «да» по всем трём). Исполнять — свежим агентом, по шагам 2A–2F.
> Контекст: [../../urban-gardener.md](../../urban-gardener.md), [roadmap](2026-10-14-urban-gardener-roadmap.md) (Фаза 2), образец реализации — Avocado Kiss
> ([blog-avocado-kiss.md](../../../admin-panel/blog-avocado-kiss.md), `database/schema.md` §9). Рабочая директория: `urban.gardener/`
> (2D — `web.admin/`, отдельный репо). Референс: `urban.gardener/mockups/Urban Gardener.html`.

**Цель.** Раздел статей от начала до конца: данные в БД → страницы сайта (листинг, тема, статья) → правка в админке → тесты.
Идём вертикальным срезом (D13): 2A фронт на тестовых данных → 2B БД и сид → 2C фронт на БД → 2D админка → 2E тесты → 2F проверка владельцем.
**Не входит:** главная и «This week's read» (Фаза 4), рассылка и tip-блок с формой (Фаза 7), поиск (Фаза 6), JSON-LD / sitemap / превью черновиков (Фаза 8), карточки товаров (Фаза 3).

## Решения владельца (2026-10-15)

1. **Маршруты:** `/articles` (листинг), `/articles/[slug]` (статья), `/topics/[slug]` (страница темы — для SEO отдельный индексируемый URL со своими title/description/h1/canonical). `/blog` не используем: в навигации уже «Articles», это гайды, не дневник.
2. **Таксономии статьи — две:** **Topic** (несколько на статью; первая по порядку — основная) и **Level** (одна). Поля `cat` и `tag` из референса как отдельные таксономии **не переносим**.
3. **Карточка статьи:** бейдж на фото — Level; в нижней строке «`N min` · `<основная тема>`» (на месте `cat` референса — принадлежность к теме).
4. **Правило фильтров (на все фазы):** каждая таксономия, которую заводят в админке и приписывают к контенту, имеет публичный фильтр. Topic → пилюли + страницы `/topics/[slug]`; Level → пилюли-фильтр. Несостыковки референса (темы без пилюль, «Pests» / «Diseases» / «Pests & diseases» как разные примеры) в схему не копируем — темы это произвольные записи админки. Правило сохранено в памяти агента (`taxonomy-needs-filter`).
5. **Контент:** данные референса (D15) — см. «Что в референсе на самом деле».

## Что в референсе на самом деле (факты, проверено)

- Статей **10, а не 9**: «This week's read» (featured, полный текст) + 9 карточек массива `articles`. Полный текст есть **только у featured** («How to tell when a plant needs water — and when to wait»); у 9 карточек — только `lvl, tag, t, d, min, cat, img`.
- Все карточки в прототипе ведут на одну и ту же страницу статьи. Автор в референсе один: Anna Sokolova, Senior editor. Дата — «May 2026», время — «8 min read».
- Фильтр листинга в референсе: пилюля = `tag`, но «Beginners» фильтрует по **`lvl`**; темы Diseases / Succulents / Fertilizing пилюль не имеют (→ правило 4 их закрывает).
- Теги внизу статьи — «Watering, Beginners, Plant health»: то есть несколько тем + уровень → модель M2M оправдана.
- Блоки тела в референсе: lead-абзац, h2/h3, абзацы, список с жирными лид-ином (`<strong>Thirsty:</strong> …`), callout (заголовок с emoji + текст), figure (картинка + подпись), на странице ещё share-bar и «Keep reading» (3 карточки).
- Темы по данным референса (для сида): Watering, Light, Repotting, Pests, Diseases, Propagation, Succulents, Fertilizing, Plant health. Уровни: Beginner, Easy, Medium, Essential.

## Модель данных (схема `urban_gardener`, образец — `avocado_kiss`)

Проектируется по D13 здесь, в срезе. Общие правила: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (триггер `public.set_updated_at`), slug генерит БД-триггер (`public.slugify`, как `authors_set_slug` в avocado 0008; при create из админки не отправляется), пустые optional-поля — `null`.

| Таблица | Поля (кроме общих) | Чтение анон |
|---|---|---|
| `authors` | `name`, `slug` (unique), `role`, `avatar_path`, `bio` | все |
| `topics` | `name` (unique), `slug` (unique), `description` (вводный абзац страницы темы), `seo_title`, `seo_description`, `position` | все |
| `levels` | `name` (unique), `slug` (unique), `position` | все |
| `articles` | `slug` (unique), `title`, `subtitle`, `excerpt` (карточка/meta), `cover_path`, `cover_alt`, `level_id` → levels (nullable, on delete set null), `author_id` → authors, `read_minutes int check > 0`, `published_at`, `is_published`, `seo_title`, `seo_description` | только `is_published` |
| `article_topics` | `(article_id, topic_id)` PK, `position` (минимальная = основная тема), cascade с обеих сторон, индекс по `topic_id` | все (видимость гейтит статья) |
| `article_blocks` | `article_id` cascade, `position`, `type` check `text\|heading\|callout\|image\|list`; `text_variant` (lead\|body), `heading_level` (2\|3), `body`, `title`, `image_path`, `alt`, `caption`, `credit`, `items jsonb` (`[{label?, text}]`); индекс `(article_id, position)` | блоки опубликованной статьи |
| `media` | метаданные файлов бакета (по шаблону avocado/cozycorner) | **нет** (только админ) |

- **Blocks.** Одна таблица с типизированными nullable-колонками, как `post_sections` у Avocado. Текстовый блок — обычный текст, абзацы через пустую строку (без markdown); жирный лид-ин только в `list.items[].label`; emoji в `callout.title` допустимы. Нумерованные списки и цитаты — не в объёме (добавляются новым значением `type`).
- **Права** — шаблон cozycorner 0017 / avocado: `grant usage` + `select` для `anon`, всё для `authenticated` / `service_role`, `alter default privileges`; запись — политика `public.is_admin()`. ⚠️ Уроки: новые таблицы без публичного чтения (`media`) нужно **явно** `revoke select … from anon` (дефолтные привилегии выдают его всем); колонку, которую позже нужно скрыть от anon (`preview_token`, Фаза 8), скрывать только «табличный revoke + column-grant» — поэтому сайт сразу читает `articles` **явным списком колонок** (`PUBLIC_ARTICLE_COLUMNS`), не `select('*')`.
- **Бакет** `urban-gardener-photos`: публичное чтение, запись — `is_admin()` (шаблон cozycorner 0018). Пути картинок — по контракту (`database/schema.md` §4): плоский ключ бакета или внешний URL; сид использует внешние Unsplash-URL референса (с `?w=` под нужный размер), перезалив в Storage — по [external-image-rehosting.md](../../../methodology/external-image-rehosting.md) в Фазе 9.
- **Ручной шаг владельца** после миграции: добавить схему `urban_gardener` в **Exposed schemas** (Supabase → Settings → Data API). Агент проверяет REST-запросом с `Accept-Profile: urban_gardener` и просит владельца, если 406.

## Маршруты, рендер, SEO

- Все страницы — SSG + ISR `revalidate = 60`, `generateStaticParams` для `/articles/[slug]` и `/topics/[slug]`; неизвестный slug → `notFound()` (+ общий `app/not-found.tsx`). Никаких `force-cache` в запросах Supabase.
- **`searchParams` в страницах не используем** (сделали бы их динамическими). Фильтр уровня — клиентский компонент над уже загруженным списком: состояние синхронизируется с `?level=<slug>` через `useSearchParams` под `<Suspense>`; canonical страницы всегда без query, `?level=` не индексируется.
- **Листинг `/articles`:** `PageHead` («Library» / «Articles & guides for every plant parent» — тексты референса) → ряд пилюль тем (`All` + все темы, ссылки на `/articles` и `/topics/<slug>`, `aria-current="true"` у текущей) → ряд пилюль уровней (`All` + уровни, кнопки `aria-pressed`) → счётчик результатов (`role="status"`) → сетка карточек. Пустое состояние — «No articles match» + кнопка сброса.
- **Страница темы `/topics/[slug]`:** тот же каркас; eyebrow «Topic», h1 = имя темы, описание = `topics.description`, пилюля темы активна. Тема без опубликованных статей → `robots: noindex`. Уровень фильтруется так же.
- **Статья `/articles/[slug]`:** `Breadcrumb` (Home › основная тема › название) → eyebrow «`<тема>` · `<уровень>`» → h1 → subtitle (fallback — excerpt) → автор (аватар-инициалы или фото, «`role` · `N min read` · `Месяц ГГГГ`») → обложка (`narrow`) → блоки тела → пилюли всех тем (+ уровень → `/articles?level=`) → share-bar (ссылки X / Facebook с `NEXT_PUBLIC_SITE_URL` + кнопка «Copy link», клиентская) → «Keep reading» (3 карточки: сначала та же основная тема, затем свежие; текущая исключена; чистая функция `pickRelated`).
- **Метаданные** (`generateMetadata`): title (`seo_title` ?? `title`), description (`seo_description` ?? `excerpt`), canonical (нужен `metadataBase` из `NEXT_PUBLIC_SITE_URL` в `layout.tsx`), OpenGraph (`article`, обложка). Глобальный `noindex` не трогаем до Фазы 9. JSON-LD (`Article`, `BreadcrumbList`) и sitemap с `articles` + `topics` — Фаза 8.
- **Навигация:** в `NAV` у Articles добавить `matches: ['/topics']`, чтобы пункт шапки был активен на страницах тем; ссылки футера «Care»/«Sections» перевести на реальные `/topics/<slug>` и `/articles?level=beginner` (ссылки на несуществующие темы не оставляем; `KNOWN_ROUTES` и тест обновить).
- **Картинки:** порт `avocado.kiss/lib/images.ts` (резолвер пути + признак внешней ссылки → `unoptimized`), `next/image` везде. Карточки: `sizes` под сетку 3/2/1 колонки; обложка статьи — `priority`.

## Шаги

Каждый шаг заканчивается зелёными `npm run lint`, `npm test`, `npm run build`. Коммитов и пушей агент не делает без команды. Перед кодом на API Next 16 / Supabase JS — сверка с `node_modules/next/dist/docs/` и Context7.

### 2A. Фронт на тестовых данных
- `lib/articles.types.ts` — типы `Article`, `ArticleBlock` (дискриминируемый union по `type`), `Topic`, `Level`, `Author`.
- `lib/articles.fixtures.ts` — 10 статей референса (+ тела: featured дословно из референса, остальные — по решению владельца, вопрос 1), темы, уровни, автор. Фикстуры — временный источник; 2C заменяет на БД, сид 2B строится по ним.
- Компоненты (`components/articles/`, один компонент = файл + CSS Module): `ArticleCard` (бейдж уровня, `N min · тема`, заголовок с настраиваемым уровнем h2/h3, excerpt), `TopicPills` (nav «Topics»), `FilteredArticleGrid` (клиент: фильтр уровня + `role="status"` + пустое состояние), `ArticleHeader`, `AuthorRow`, `ArticleBody` (серверный диспетчер блоков) + блоки `TextBlock` / `HeadingBlock` / `ImageBlock` (figure) / `ListBlock`, `Callout` (уже есть), `ArticleTags`, `ShareBar` (клиент), `RelatedArticles`.
- Страницы `app/articles/page.tsx` (заменяет заглушку), `app/articles/[slug]/page.tsx`, `app/topics/[slug]/page.tsx`, `app/not-found.tsx`; `loading.tsx` для каждого маршрута из `Skeleton` (контейнер `aria-busy` + скрытый текст «Loading…» в `role="status"`).
- `Reveal` вокруг карточек (stagger `i % 3`) и блоков статьи; `ArticleCard` и пилюли добавить на стенд `/design`.
- Блок неизвестного типа не рендерится и не роняет страницу (в dev — `console.warn`).

### 2B. Миграции и сид
- Миграции в `urban.gardener/supabase/migrations/` (нумерация с `0001`): схема + права + бакет; таблицы и RLS; триггеры slug/updated_at; сид. Применять через Supabase MCP `apply_migration` **и сразу дублировать файл в репо**. Проект base-one.
- Сид: автор (Anna Sokolova, Senior editor), 4 уровня, 9 тем, 10 статей с темами и блоками из фикстур 2A. Даты `published_at` — по убыванию, чтобы порядок листинга был детерминирован.
- Проверка прав SQL-запросами: анон видит только опубликованные статьи и их блоки; черновик и его блоки скрыты; `media` для анона пуст; запись анону запрещена. `get_advisors` (security) после миграций; ревью `database-reviewer`.
- Ручной шаг: Exposed schemas (см. выше). Типы: `generate_typescript_types` → `lib/database.types.ts`.

### 2C. Фронт на БД
- `lib/supabase/` — серверный клиент (publishable key, `db: { schema: 'urban_gardener' }`); env `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` проверить в `.env.local` **и в Vercel** (production) — при отсутствии добавить (`vercel env`, `--scope cozy-corner`).
- `lib/articles.ts` — загрузчики (`fetchArticles`, `fetchArticleBySlug`, `fetchTopics`, `fetchTopicBySlug`, `fetchLevels`) + чистые мапперы строк БД в типы (`rowToArticle`) и `pickRelated`, `filterByLevel`. Явные списки колонок. **Ошибка Supabase → throw, не пустой список** (иначе ISR закэширует пустую страницу; при throw Next оставляет прошлую рабочую версию). Фикстуры остаются только для тестов.
- Подключить загрузчики к страницам 2A, `generateStaticParams`, `revalidate = 60`, `generateMetadata`, `metadataBase`, обновить `NAV`/футер/`KNOWN_ROUTES`.
- Ревью: `silent-failure-hunter` по `lib/articles.ts`.

### 2D. Админка (`web.admin/`, отдельный репо)
Перед кодом — собственная короткая спека `sites/urban-gardener/specs/…-articles-admin-design.md` по образцу Avocado blog admin (решения владельцу — на утверждение). Предварительный объём:
- запись в `src/config/sites.ts`: `slug: urban-gardener`, `schema: urban_gardener`, `bucket: urban-gardener-photos`, `frontendUrl: https://urban-gardener.vercel.app`, `sections: [media, articles, topics, levels, authors]`;
- Media (общий менеджер бакета), Topics и Levels (на базе `TaxonomyManager`), Authors (CRUD — у Avocado его нет, добавляем), Articles (список + редактор: поля, обложка через `ImagePickerDialog`, select автора и уровня, мультивыбор тем с порядком — первая = основная, SEO-поля, `is_published`, редактор блоков по образцу `SectionsEditor` с diff-сохранением);
- валидация в редакторе: опубликованная статья требует обложку, ≥1 темы и `read_minutes`; slug read-only, `updated_at` не отправляется;
- док раздела `admin-panel/articles-urban-gardener.md`, строка в `admin-panel/status.md`, пункт «Used by» в `USAGE_SOURCES` (`src/lib/media.ts`) для `cover_path` / `avatar_path` / `image_path`.

### 2E. Тесты
- Unit: мапперы, `pickRelated`, `filterByLevel`, резолвер картинок, SEO-fallback'ы (title/description), диспетчер блоков.
- Компонентные: `ArticleCard` (бейдж, `N min · тема`, href), `TopicPills` (`aria-current`), `FilteredArticleGrid` (переключение, счётчик, пустое состояние, синхронизация с `?level=` — мок `next/navigation`), `ArticleBody` по каждому типу блока, `ShareBar` (копирование — мок clipboard), пустая/длинная тема.
- e2e (`e2e/articles.spec.ts`, нужен live Supabase, порт 3200): листинг → 10 карточек; пилюля темы → `/topics/watering`; открыть статью → h1, блоки, крошки, 3 «Keep reading»; фильтр уровня; неизвестный slug → статус 404; нет горизонтального скролла на 390px; canonical без query.
- Миграции — SQL-проверки прав из 2B; e2e после правки в админке (2F).

### 2F. Ревью-гейт и проверка владельцем
- Ревью до просьбы о приёмке: `database-reviewer` (миграции), `react-reviewer`, `typescript-reviewer`, `silent-failure-hunter` (`lib/articles.ts`), по возможности `a11y-architect` (фильтры, пилюли) — CRITICAL/HIGH исправить или вынести владельцу.
- Документация: `database/schema.md` (раздел `urban_gardener`), `sites/urban-gardener.md` (решения D17+, инвентарь страниц, открытые вопросы 1 и 4 закрыты), roadmap, `urban.gardener/AGENTS.md` («Key files»), отчёт в конце этого файла.

## Скиллы и ревьюеры

Загрузить перед работой: `react-patterns`, `react-performance` (параллельные запросы, без waterfall), `postgres-patterns`, `database-migrations`, `frontend-a11y`, `testing`, `react-testing`. Ревью — см. 2F.

## Подводные камни

- `searchParams` в странице делает её динамической — фильтр уровня только клиентский (см. «Маршруты»).
- Клиентская сетка с фильтром держит состояние от монтирования: между `/articles` и `/topics/x` ключом (`key={topic.slug}`) пересоздавать компонент, иначе фильтр «прилипнет» (урок Avocado: client grid stale state).
- Внешние Unsplash-картинки отдаются `unoptimized`: в сиде использовать `?w=` под размер; крупные оригиналы — только после перезалива.
- Нет пагинации: при десятках статей листинг станет тяжёлым — вернуться к вопросу, когда статей станет >40 (маршрут вида `/articles/page/[n]`).
- Каждая новая таблица без публичного чтения — явный `revoke … from anon`.

## Закрытые вопросы (владелец принял рекомендации 2026-10-15)

1. **Тексты 9 статей.** В референсе полный текст есть только у featured. Рекомендую: агент пишет короткие черновики (lead + 2 раздела + callout, ≈300 слов, английский) для остальных девяти, помечает их как черновые в отчёте, владелец переписывает в админке до запуска (пункт 9.2 roadmap). Альтернатива — карточки без тела (страница статьи пустая). **Принято.**
2. **Level как таблица.** Рекомендую таблицу `levels` с разделом в админке (по правилу «таксономия = запись админки + фильтр»), а не жёсткий enum. **Принято.**
3. **Eyebrow над заголовком карточки.** В референсе над названием стоит `tag` (тема), внизу — `cat`. Раз внизу теперь тема, eyebrow над заголовком **убираем** (иначе дубль); на странице статьи и в featured остаётся «тема · уровень». **Принято.**

## Ручная проверка владельцем (чек-лист)

1. `/articles`: 10 карточек, бейдж уровня на фото, внизу «N min · тема», пилюли тем и уровней, счётчик; фильтр уровня работает и меняет `?level=`.
2. Клик по теме → `/topics/<slug>` с заголовком и описанием темы; пункт Articles в шапке подсвечен.
3. Статья: крошки, шапка, автор, обложка, все типы блоков, пилюли тем, share, «Keep reading»; на 390px ничего не уезжает.
4. Неизвестный адрес (`/articles/nope`, `/topics/nope`) → страница 404.
5. В админке создать статью (тема, уровень, обложка, блоки) → через ≤1 мин она на сайте; снять публикацию → пропала; изменить порядок тем → меняется основная тема на карточке.
6. Ссылки футера «Care» и «For beginners» ведут на реальные страницы.

---

## Отчёт об исполнении (2026-10-15)

**Статус:** выполнена и **принята владельцем 2026-10-15** (проверка на проде). Запушено: urban-gardener `2dabef8`, web.admin `53b5953`, platform-docs `06d77c9`; последующие правки — `da6dcf3`, `176b7d2`.

| Шаг | Итог |
|---|---|
| 2A фронт | `/articles`, `/articles/[slug]`, `/topics/[slug]`, 404, error-страница; компоненты `components/articles/*`; клиентский фильтр уровня (`?level=` через `history.replaceState`, страницы остаются статическими) |
| 2B БД | миграции `urban.gardener/supabase/migrations/0001–0006` применены в base-one: схема+бакет, таблицы+RLS, сид (10 статей, 9 тем, 4 уровня, автор, 80 блоков), укрепление (0004), замена нерабочих обложек (0005), атомарное сохранение статьи `save_article` + защита удаления темы (0006). Права проверены SQL (anon: только опубликованное; media закрыта; запись запрещена; запись админа проходит) |
| 2C фронт на БД | `lib/articles.ts` (+ мапперы, `cache()`), ошибка Supabase → throw; env Supabase заведены в `.env.local` и Vercel (production, preview); `NEXT_PUBLIC_SITE_URL` обязателен в production-сборке |
| 2D админка | web.admin: Articles, Topics, Levels, Authors (+ общий Media); спека [specs/2026-10-15-articles-admin-design.md](../specs/2026-10-15-articles-admin-design.md), контракт [admin-panel/articles-urban-gardener.md](../../../admin-panel/articles-urban-gardener.md) |
| 2E тесты | urban.gardener: 228 unit/компонентных + 16 e2e по статьям (все зелёные на prod-сборке, порт 3200); web.admin: 247 (в т.ч. 70+ новых) |
| 2F ревью | database-, react-, typescript-reviewer, silent-failure-hunter, a11y-architect (сайт и админка): CRITICAL/HIGH не найдено; исправлено — статья без автора = ошибка, а не молчаливый пропуск; фокус после сброса фильтра; disabled-фильтр до гидрации; `resolveImage`/`site-url` без мусорных значений; порядок записи в админке и др. |

**Решения и находки по ходу:**
- `loading.tsx` включает стриминг → HTTP 200 вместо 404 для неизвестного slug (soft-404; Next сам ставит `noindex`). Скелетоны у `[slug]`-маршрутов убраны, скелетон листинга оставлен в route group `app/articles/(listing)/` (иначе он оборачивал бы и статью). Настоящий 404 проверен e2e.
- Фото референса (Unsplash) частично «протухли»; шесть обложек заменены на рабочие. Остальные внешние картинки — до перезалива в Storage (Фаза 9).
- `articles.author_id` NOT NULL → автор нужен и черновику (в спеке 2D было «разрешено без автора» — исправлено).
- Миграция 0004: правка блоков/тем обновляет `articles.updated_at` (нужно для `dateModified`/`lastmod` в Фазе 8).
- Ревью админки (react-/typescript-reviewer + silent-failure-hunter) сошлись на неатомарном сохранении (десятки отдельных запросов): исправлено RPC `save_article` в одну транзакцию (0006), правила публикации продублированы на сервере, защита удаления темы — триггером БД, update/delete с «0 строк» стали ошибкой, форма блокируется на время Save, страница статьи берёт свежие данные (`gcTime: 0`, `key` по id).
- Тела девяти статей, кроме «How to tell when a plant needs water…», — **черновики агента**; сид публикует все 10 статей (сайт `noindex` до Фазы 9) — владелец переписывает тексты в админке (roadmap 9.2).

**Не вошло (по плану):** главная и «This week's read» (Фаза 4), рассылка (6), поиск (7), JSON-LD/sitemap/превью (8), карточки товаров (3).
