# Urban Gardener — Фаза 6 (Search): спека для агента

> Адресат — исполняющий агент. План для владельца — [../plans/2026-10-17-phase-6-search.md](../plans/2026-10-17-phase-6-search.md). Фаза поменялась номером с Newsletter/Contact по решению владельца 2026-10-17 (раньше была «7»).
> Рабочая директория: `urban.gardener/` (сайт, миграция). **`web.admin` не меняется** (админских экранов у поиска нет). Референс UI: `urban.gardener/mockups/Urban Gardener.html` (панель `.search-bar`/`.search-results` стр. 43–63, 337–350; страница `#page-search` стр. 745–770; логика `renderSearch`/`showAllResults` стр. 1006–1045).
> **Образцы:** CozyCorner — `cozycorner/lib/search.ts` (санитайзер, `ilike`, лимиты), `components/SearchBox.tsx` (панель с задержкой 300 мс, браузерный клиент), `app/search/page.tsx` (динамическая страница, `noindex, follow`). Urban — шапка `components/Header.tsx` (сейчас форма-«оболочка» `#site-search`, Фаза 1), загрузчики `lib/articles.ts`/`lib/shop.ts` + мапперы (`ARTICLE_LIST_SELECT`, `CARD_SELECT`), карточки `ArticleCard`/`ProductCard`, браузерный клиент `lib/supabase/client.ts`.

## Решения владельца (журнал)

| # | Решение | Статус |
|---|---|---|
| D12 | Поиск идёт по реальной БД (статьи + товары) — журнал проекта | принято давно |
| R1 | Фазы 6 и 7 поменялись местами: Search — Фаза 6, Newsletter/Contact — Фаза 7 (2026-10-17) | принято |
| S1 | **Что искать:** статьи — заголовок, подзаголовок, анонс, темы, уровень; товары — название, описание, бренд, категории; **без** полного текста статей | **принято 2026-10-17: вариант (а)** |
| S2 | **Опечатки:** терпим через `pg_trgm` («monsetra» → Monstera) | **принято 2026-10-17: вариант (б)** |
| S3 | **Темы и категории отдельной группой результатов:** нет, только статьи и товары (по макету) | **принято 2026-10-17: вариант (а)** |

Реализация: S1(а) + S2(б) + S3(а). Builder-check спеки (независимый читатель, 2026-10-17): «ничего важного не осталось»; мелочи (какую тему/категорию показывать в мета-строке — **основную, т. е. первую по position, как на карточках**; порог триграмм — подобрать на данных; у товара есть `published_at`) решает исполнитель.

## Цель и границы

**Цель.** Строка поиска в шапке показывает живые результаты (до 4 статей + до 4 товаров, «See all N results →»), Enter или «See all» ведут на страницу `/search?q=…` со всеми совпадениями (статьи, затем товары). Только опубликованное.

**Не входит:** фильтры/сортировка/пагинация результатов, подсветка совпадений, история запросов, подсказки при пустой строке, аналитика запросов (Фаза 8), синонимы, админские экраны, JSON-LD `SearchAction` (Фаза 8), поиск по авторам/страницам About/Privacy.
**Анти-цели:** показать черновик (статья/товар `is_published = false`) в панели или на странице; сломать запрос спецсимволами (`% _ \ , ( ) '` и т. п.); «вечная» панель при сбое сети; потеря ввода из-за устаревшего ответа (гонка запросов); панель недоступна с клавиатуры/скринридера.

## Поведение

**Запрос.** Нормализация: `trim`, схлопнуть пробелы, ≤ 80 символов; пусто или < 2 символов — «поиска нет» (панель закрыта/ничего не показываем). Слова запроса — через пробел, **все слова должны найтись** (AND) в любом из полей сущности (подстрока без учёта регистра; при S2(б) — ещё и совпадение по триграммам слова).

**Что ищем (вариант S1(а)).**
- Статья: `title`, `subtitle`, `excerpt`, названия тем (`article_topics → topics.name`), название уровня (`levels.name`). Только `is_published`.
- Товар: `name`, `short`, `description`, название бренда, названия категорий (`product_categories → shop_categories.name`). Только `is_published`.
- S1(б) добавляет `article_blocks.body`/`title`/`items` (текстовые блоки) с наименьшим весом.

**Ранжирование.** Баллы по лучшему совпадению слова: название (`title`/`name`) 4; тема/категория/бренд/уровень 3; подзаголовок/`short` 2; `excerpt`/`description` 1 (S1(б): тело статьи 0.5). Сумма по словам; порядок — балл ↓, затем статьи `published_at ↓`, товары `published_at ↓`, затем `id` (детерминированно). Точное совпадение целого запроса с названием — бонус +4.

**Панель в шапке** (десктоп и телефон — одна и та же полоса под шапкой, как в макете; результаты — абсолютно позиционированный блок `max-height: 64vh` с прокруткой):
- заголовки групп «Articles» / «Shop» (только непустые), до 4 строк в группе; строка = миниатюра 44 px (`resolveImage`, внешний Unsplash — `unoptimized`, пустая — нейтральная плитка) + название + мета («Тема · Уровень» / «Категория · цена»); клик — на страницу (`/articles/<slug>`, `/product/<slug>`);
- «See all N results for “q” →» (N = всего статей + товаров), ведёт на `/search?q=…`; нет совпадений — «No results for “q”.» (+ ссылка «See all» нет);
- задержка ввода 250 мс; устаревшие ответы отбрасываются (счётчик поколений); сбой запроса — строка «Search is unavailable right now. Try again.» (`role="status"`), не исключение; пока идёт запрос — прежние результаты остаются, без мигания;
- Enter без выбранной строки — переход на `/search?q=…` (`router.push`, форма `action="/search" method="get"` как запасной вариант без JS); Esc закрывает панель и возвращает фокус на кнопку Search (как сейчас); смена маршрута закрывает панель; открытие меню закрывает панель и наоборот (как сейчас).
- **Combobox по ARIA:** `input role="combobox" aria-expanded aria-controls aria-autocomplete="list" aria-activedescendant`; контейнер результатов `role="listbox"`, строки `role="option"` (`<a>`), группы `role="group" aria-labelledby`; ↓/↑ двигают активную строку (визуально и `aria-activedescendant`), Enter на активной строке открывает её, Home/End — к первой/последней; озвучивание в `aria-live="polite"` («5 results» / «No results»); фокус остаётся в поле ввода.

**Страница `/search`.**
- Динамическая (читает `searchParams`; явное исключение из правила «нет searchParams» — страница поиска не кэшируется ISR), `export const metadata = { title: 'Search', robots: { index: false, follow: true } }` (+ `generateMetadata` с «Results for “q”» в title), без canonical-вариантов, не в sitemap (Фаза 8 не добавляет).
- Шапка: `PageHead` eyebrow «Search», h1 «Results for “q”» (запрос обрезан до 60 символов с «…»; пустой запрос — h1 «Search»), строка «N results found» / «No results»; под шапкой — поле поиска (`<form action="/search" method="get">`, `defaultValue` = q) для уточнения.
- Секции «Articles» (`ArticleGrid`, до 24) и «Shop» (сетка `ProductCard`, до 24), только непустые; если найдено больше показанного — «Showing the first 24 of N» (без пагинации); нет результатов — «No matches found. Try a different word, or browse all articles or the shop.» со ссылками.
- Серверный `fetchSearch(q)` бросает ошибку при сбое Supabase (границы `error.tsx`), пустой результат — не ошибка; есть `loading.tsx` со скелетоном (страница динамическая).
- S3(б): над секциями строка пилюль-ссылок «Topics» (на `/topics/<slug>`) и «Shop categories» (на `/shop/<slug>`) — совпавшие по названию.

## Данные и БД (миграция `0022_search_content.sql`)

RPC `urban_gardener.search_content(p_query text, p_article_limit int, p_product_limit int) returns jsonb` — `language sql` или `plpgsql`, `stable`, **`security invoker`**, `set search_path = ''`, execute только `anon, authenticated, service_role` (revoke от public). Возвращает `{ "articles": { "total": n, "ids": [uuid, …] }, "products": { "total": n, "ids": [uuid, …] } }` — ids уже в порядке ранжирования, длина ≤ лимита, `total` — всех совпадений (для «See all N»). **Внутри функции явно `is_published = true` и для статей, и для товаров** (не полагаться только на RLS — урок preview-токенов). Лимиты зажимаются (`least(greatest(…,0), 50)`), запрос проходит ту же нормализацию в SQL (`left(btrim(q), 80)`, экранирование `\ % _` для `like … escape '\'`), < 2 символов — пустой результат. S2(б): `create extension if not exists pg_trgm with schema extensions;` + совпадение слова, если `extensions.word_similarity(word, field) ≥ 0.4` или подстрока; GIN-индексы `gin_trgm_ops` на `articles.title`, `products.name` (по желанию — на остальные поля; при 21 строке индексы не критичны, но задают масштаб); ошибка `22023`/`23514` на неверных типах не нужна — функция принимает любой текст.
Дальше клиент одним запросом читает карточки: `articles` `.select(ARTICLE_LIST_SELECT).in('id', ids).eq('is_published', true)`, `products` `.select(CARD_SELECT).in('id', ids).eq('is_published', true)` и **переставляет в порядок ids** (PostgREST порядок `in` не гарантирует), строки без пары отбрасывает (опубликованность могла измениться между запросами). Мапперы — существующие (`rowToArticle`/`toCard`, `rowToCardData`).
Код: `lib/search.ts` (серверная и браузерная `searchContent(client, query, limits)` — один код, клиент аргументом, как в Cozy), `lib/search-utils.ts` (чистая логика: `normalizeQuery`, `orderByIds`, `searchHref`, подписи «N results»), `lib/search.mappers.ts` не нужен. Фикстурная версия в 6A — поиск по `FIXTURE_ARTICLES`/`SHOP_PRODUCTS` тем же интерфейсом.
Проверка прав SQL (метод — `plans/2026-10-15-phase-3-kickoff.md`): anon вызывает RPC; черновая статья/товар не возвращаются; `%`, `_`, `\`, `'`, `,`, `(` в запросе — буквальные символы, без ошибок; пустая/односимвольная строка → пусто; огромный лимит зажат; не-анон роли не нужны. `get_advisors`; ревью `database-reviewer`.

## Сайт (`urban.gardener`)

- `components/search/HeaderSearch.tsx` (клиент) — вся полоса поиска вместо формы-«оболочки»; `Header.tsx` лишь подключает его (сохраняет логику «одна панель за раз», Esc, возврат фокуса, клик вне шапки). Поддерживающие компоненты: `SearchResultsPanel`, `SearchResultRow` (миниатюра + название + мета), CSS-модули, токены `globals.css`.
- `app/search/page.tsx` (+ `loading.tsx`, `SearchForm`, `SearchSection`), переиспользуются `PageHead`, `ArticleGrid`, `ProductCard`/`ProductList` (проверить: карточки используют `Reveal`/стретч-ссылку — на динамической странице OK).
- Запрос из браузера — `lib/supabase/client.ts` (публикуемый ключ, таймаут 15 с); на сервере — `createServerClient()` и `cache()`.
- Ничего не меняется в `web.admin`, `pages`, `site_settings`; меню шапки остаётся редактируемым — ссылки на `/search` в меню не добавляются.

## Шаги

Каждый шаг завершается зелёными `lint`, `tsc`, `test`, `build`; ветка `feat/search` от `main` (создана 2026-10-17), локальные коммиты, push/merge — только по команде.
- **6A. Фронт на тестовых данных:** `lib/search-utils.ts` (+тесты red-first: нормализация, порядок по ids, подписи), фикстурный `searchContent`, `HeaderSearch` (combobox), страница `/search`; визуальная сверка с макетом 1280/390.
- **6B. БД:** миграция 0022 (+ `pg_trgm` при S2(б)), проверка прав и спецсимволов SQL, advisors, `database-reviewer`.
- **6C. Сайт читает БД:** `searchContent` на RPC + выборка карточек; обработка гонок/ошибок; `silent-failure-hunter`.
- **6D. Тесты:** unit (утилиты), компонентные (`HeaderSearch`: клавиатура, aria, задержка, устаревшие ответы, ошибка, пустой результат; страница; строка группы), e2e `e2e/search.spec.ts` (по сидовым названиям: «monstera», пустой результат, спецсимволы, мобильная ширина, клавиатура); `test-engineer`.
- **6E. Ревью-гейт и документация:** `react-reviewer`, `typescript-reviewer`, `a11y-architect`, `silent-failure-hunter`, `database-reviewer`, `seo-specialist` (noindex-страница); `schema.md` (RPC 0022), `urban-gardener.md` (D37+), roadmap, `AGENTS.md`, `phase-x-checklist.md`, отчёт в плане.

## Подводные камни

- `/search` динамическая: нельзя читать `searchParams` в layout (сломает статичность всего сайта); поле поиска на странице — серверное, а не `useSearchParams` в шапке.
- PostgREST `.in('id', ids)` не сохраняет порядок — переставлять самому; вторая выборка может вернуть меньше строк (удалено/снято с публикации).
- Гонки: ответ на «mon» не должен перезаписать результат «monstera» (счётчик поколений как в `ProductGrid`).
- Экранирование: для RPC достаточно параметра `text` (никакого `.or()`-синтаксиса PostgREST, где `,` и `()` ломают запрос); экранирование `LIKE` — в SQL.
- Внешние картинки Unsplash в миниатюрах — `unoptimized` (контракт `resolveImage`); не тянуть большие файлы: `resolveImage(path, 88)`.
- Панель под sticky-шапкой не должна перекрывать фокус; на 390 px — без горизонтального скролла; `overflow-x: clip` на html/body (не `hidden`).
- Поле в шапке и поле на странице — разные `id`; на странице `/search` в шапке нет автозаполнения q (это сознательно: `useSearchParams` в layout недопустим).
