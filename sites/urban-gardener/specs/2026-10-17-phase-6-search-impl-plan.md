# Urban Gardener — Фаза 6 (Search), репо `urban.gardener`: impl-план (6A–6E)

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (выбрано: один репозиторий, 9 последовательных задач с общими интерфейсами `lib/search*` → UI → БД → RPC; цена ошибки в БД закрыта ревью-гейтом в Task 6 и Task 9; `web.admin` не меняется). Шаги — чекбоксы `- [ ]`.

**Goal:** живой поиск по опубликованным статьям и товарам: панель-combobox в шапке (до 4+4, «See all N results») и динамическая страница `/search`; сначала на фикстурах (6A), затем RPC `search_content` (6B), затем сайт читает БД (6C).

**Architecture:** весь доступ к данным — `lib/search.ts` (`searchContent(client, query, limits)`: один код для сервера и браузера, клиент аргументом, как `fetchProductPage`). В 6A тело — поиск по фикстурам (`lib/search.fixtures.ts`), в 6C — RPC возвращает ранжированные `ids` + `total`, затем одна выборка карточек (`ARTICLE_LIST_SELECT`/`CARD_SELECT`) с перестановкой в порядок ids. Чистая логика — `lib/search-utils.ts`. Панель — клиентский `HeaderSearch`, страница `/search` — серверная, поле на ней — обычная `<form method="get">`.

**Tech Stack:** Next.js 16.2.9 (читать `node_modules/next/dist/docs/`), React 19, Supabase JS (RPC), Postgres `pg_trgm`, CSS Modules + токены `globals.css`, Vitest + RTL, Playwright (порт 3200).

**Spec:** `platform-docs/sites/urban-gardener/specs/2026-10-17-phase-6-search-spec.md` (решения S1(а), S2(б), S3(а) — источник истины; пункт «S3(б)» про пилюли тем в спеке НЕ реализуется).

## Global Constraints

- UI на английском; документация на русском; никакого hex вне `:root` — только `var(--token)`; новая величина → новый токен.
- Лимиты: панель 4 статьи + 4 товара; страница `/search` 24 + 24; запрос `trim` + схлопнуть пробелы + ≤ 80 символов; < 2 символов — «поиска нет»; задержка ввода 250 мс; миниатюра 44 px (`resolveImage(path, 88)`).
- `/search`: динамическая (читает `searchParams` в самой странице), `robots: { index: false, follow: true }`, не в sitemap, `loading.tsx` со скелетоном, один `h1`. **`searchParams` не читать в `app/layout.tsx`, `Header` и других общих местах** — иначе весь сайт станет динамическим; `next build` по-прежнему показывает остальные страницы как `○`/`●`.
- Только `is_published = true`: условие в самой функции БД **и** во второй выборке карточек; строки без пары отбрасываются.
- Ошибка Supabase → `throw` через `fail()` (страница → `error.tsx`); в панели ошибка ловится и показывается строкой «Search is unavailable right now. Try again.» (`role="status"`), исключения наружу не летят.
- Combobox по ARIA (спека «Панель в шапке»): фокус остаётся в поле; ↓/↑/Home/End двигают `aria-activedescendant`; Enter на активной строке открывает её, иначе `router.push('/search?q=…')`; Esc закрывает и возвращает фокус на кнопку Search; `aria-live="polite"`.
- Миграция 0022: `security invoker`, `set search_path = ''`, `stable`, `revoke … from public` → `grant execute … to anon, authenticated, service_role`; `pg_trgm` в схеме `extensions`. Правки по ревью — 0023+.
- Не `rm -rf .next`, не запускать второй `next dev`. Коммиты — локальные на `feat/search`; push/merge — только по команде. Документы `platform-docs` не коммитить. Скрипты и тесты — из корня `urban.gardener`.

## Review Focus

1. Запрос со спецсимволами `50%`, `a_b`, `a\b`, `it's`, `a,b`, `(plant)`, `"x"` → без ошибок и без 500, символы буквальные (`50%` не находит «всё»); одиночные `%`, `_`, пробелы → «поиска нет».
2. Черновик (статья/товар с `is_published = false`), чьё название совпадает с запросом → не в панели, не на странице, не в `total` (проверка RPC под `anon` и второй выборки).
3. Гонка: медленный ответ на «mon» приходит после «monstera» → не затирает; ответ, пришедший после закрытия панели/смены маршрута, не открывает панель.
4. Сбой сети/таймаут RPC → строка «Search is unavailable right now…», панель не «вечная»; на `/search` — `error.tsx`, а не пустая страница «No matches».
5. Длинный (500 символов), юникод/эмодзи, регистр, лишние пробелы, запрос, состоящий только из стоп-символов → нормализуется, не падает; `total` больше показанного → «Showing the first 24 of N»; опечатка «monsetra»/«sanseveria» находит нужное, а короткие слова («sun») не дают лавину ложных совпадений (порог `word_similarity` подобрать на данных).

## File Structure

- `lib/search.types.ts`, `lib/search-utils.ts` (+test), `lib/search.fixtures.ts` (+test), `lib/search.ts` (+test, 6C)
- `components/search/{HeaderSearch,SearchResultsPanel,SearchResultRow}` (+css, +test), `components/search/{SearchForm,SearchSection}` (+css) для страницы
- `app/search/{page.tsx,loading.tsx,search-page.test.tsx}`
- Правки: `components/Header.tsx` (+css, +test: форма-оболочка → `HeaderSearch`), `app/globals.css` (токены), `e2e/search.spec.ts` (новый)
- `supabase/migrations/0022_search_content.sql`

### Task 1: Базовая линия и сверка с документацией

- [ ] **Step 1:** `npm test && npm run lint && npx tsc --noEmit` — записать число тестов как базовую линию.
- [ ] **Step 2:** прочитать в `node_modules/next/dist/docs/` про `searchParams` в странице (Promise), динамический рендер, `loading.tsx` у динамических страниц, `generateMetadata`. Сверить Context7: `@supabase/supabase-js` `.rpc()` + `.in()`. Загрузить скиллы: `postgres-patterns`, `react-performance`, `frontend-a11y`, `react-patterns`. Выводы — в ledger.
- [ ] **Step 3:** прочитать референс `mockups/Urban Gardener.html` (панель стр. 43–63, 337–350; `#page-search` 745–770; логика 1006–1045) и текущие `Header.module.css` (`.searchBar`…).

### Task 2: Типы и чистая логика (red-first)

**Files:** Create `lib/search.types.ts`, `lib/search-utils.ts`; Test `lib/search-utils.test.ts`

**Interfaces — Produces:**
```ts
// search.types.ts
export type SearchGroup<T> = { items: T[]; total: number }
export type SearchResults = { articles: SearchGroup<ArticleCardData>; products: SearchGroup<ProductCardData> }
export type SearchLimits = { articles: number; products: number }
export const PANEL_LIMITS: SearchLimits   // { articles: 4, products: 4 }
export const PAGE_LIMITS: SearchLimits    // { articles: 24, products: 24 }
// search-utils.ts
export const MIN_QUERY_LENGTH = 2, MAX_QUERY_LENGTH = 80
export function normalizeQuery(raw: string): string          // '' если «поиска нет»
export function orderByIds<T>(rows: readonly T[], ids: readonly string[], idOf: (row: T) => string): T[]
export function searchHref(query: string): string            // '/search?q=' + encodeURIComponent
export function truncateQuery(query: string, max?: number): string  // max=60, «…» в конце
export function resultsLabel(total: number): string          // 'No results' | '1 result' | 'N results'
export function seeAllLabel(total: number, query: string): string    // 'See all N results for “q” →'
export function shownOfTotal(shown: number, total: number): string | null  // 'Showing the first 24 of 31' | null
```

- [ ] **Step 1:** тесты (red): `normalizeQuery('  Mon   stera ')==='Mon stera'`; `'a'`→`''`; `'   '`→`''`; 500 символов → длина 80 без висящего пробела; не-строка/`undefined` → `''`. `orderByIds`: порядок ids, строки без пары отбрасываются, неизвестные строки отбрасываются, дубликаты ids не плодят строки. `searchHref('50% & a,b')` → `/search?q=50%25%20%26%20a%2Cb`. `truncateQuery` 61 символ → 60 + `…`. `resultsLabel(0|1|5)`, `shownOfTotal(24,24)`→`null`, `(24,31)`→строка выше.
- [ ] **Step 2:** `npx vitest run lib/search-utils.test.ts` → FAIL.
- [ ] **Step 3:** реализовать по сигнатурам; `normalizeQuery` — единственное место нормализации на клиенте (SQL повторяет ту же логику).
- [ ] **Step 4:** тесты → PASS; `npx tsc --noEmit`.
- [ ] **Step 5:** commit `feat(search): query utils and types`.

### Task 3: Фикстурный поиск и фасад `searchContent` (6A)

**Files:** Create `lib/search.fixtures.ts`, `lib/search.ts`; Test `lib/search.fixtures.test.ts`
**Interfaces — Consumes:** `FIXTURE_ARTICLES`, `SHOP_PRODUCTS`, `toCard` (`lib/article-utils.ts`), `rowToCardData`-эквивалент из `Product` (смотреть `lib/shop.fixtures.ts`/`shop-utils`), `normalizeQuery`. **Produces:** `searchFixtures(query: string, limits: SearchLimits): SearchResults`; `searchContent(client: ShopClient, query: string, limits: SearchLimits): Promise<SearchResults>` — в 6A делегирует в `searchFixtures` (клиент не используется).

- [ ] **Step 1:** `searchFixtures`: нормализация → слова → AND по полям спеки (S1(а)); веса и порядок спеки («Ранжирование»: 4/3/2/1, +4 за точное совпадение с названием, затем `publishedAt ↓`, `id`); подстрока без регистра (опечатки — только в БД, в фикстурах не нужны); только опубликованные.
- [ ] **Step 2:** тест (после реализации; не чистая-логика-TDD): «monstera» → товар Monstera первым; слово темы → статьи темы; два слова — AND; `zzzxx` → пусто; `limits` режет `items`, но `total` — всех; «поиска нет» → пусто.
- [ ] **Step 3:** `searchContent` + `export const` лимитов уже в types. Commit `feat(search): fixture search and searchContent facade`.

### Task 4: Панель поиска в шапке (6A)

**Files:** Create `components/search/{HeaderSearch,SearchResultsPanel,SearchResultRow}.tsx` + `.module.css`; Modify `components/Header.tsx`, `components/Header.module.css`, `components/Header.test.tsx`, `app/globals.css`
**Interfaces — Produces:** `HeaderSearch({ open, inputRef, onClose }: { open: boolean; inputRef: RefObject<HTMLInputElement | null>; onClose: () => void })` — рендерит `<form id="site-search" role="search" action="/search" method="get" hidden={!open}>` (вся текущая оболочка переезжает сюда; Esc, клик вне, возврат фокуса, закрытие по смене маршрута и «одна панель за раз» остаются в `Header`); `SearchResultRow({ id, href, thumb, title, meta, active })`; `SearchResultsPanel({ id, query, results, status, activeIndex, onNavigate })`.

- [ ] **Step 1:** `HeaderSearch`: состояние `value`, `results`, `status: 'idle'|'loading'|'ready'|'error'`; эффект с таймером 250 мс → `searchContent(getBrowserClient(), q, PANEL_LIMITS)`; счётчик поколений (устаревший ответ и ответ после `open=false` отбрасываются); пока `loading` прежние результаты остаются; ошибка → `status='error'` + `console.error`, без throw.
- [ ] **Step 2:** ARIA и клавиатура по Global Constraints: `role="combobox"` на `input` (`aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`), `role="listbox"` > `role="group" aria-labelledby` > `role="option"` (`<a>`), последняя строка «See all N results for “q” →» тоже `option`; `aria-live="polite"` (`resultsLabel`); Enter без активной строки → `router.push(searchHref(q))` + закрытие.
- [ ] **Step 3:** разметка и стили по макету: абсолютный блок `max-height: 64vh`, `overflow-y: auto`, миниатюра 44 px (`next/image`, `unoptimized` из `resolveImage`; пустая — нейтральная плитка), на 390 px без горизонтального скролла. Токены — в `globals.css`.
- [ ] **Step 4:** `Header.tsx` подключает `HeaderSearch`; существующий блок «search shell» в `Header.test.tsx` остаётся зелёным (`searchbox` теперь `combobox` — обновить запросы; `vi.mock('@/lib/search')`).
- [ ] **Step 5:** `npm run lint && npx tsc --noEmit && npm test`; визуальная сверка с макетом на 1280 и 390 (Playwright MCP, `next dev` уже запущен владельцем или `npm run dev` один экземпляр — спросить через `lsof -i :3200`); commit `feat(search): header search combobox on fixtures`.

### Task 5: Страница `/search` (6A)

**Files:** Create `app/search/{page.tsx,loading.tsx}`, `components/search/{SearchForm,SearchSection}.tsx` (+css); Test `app/search/search-page.test.tsx`
**Interfaces — Consumes:** `searchContent`, `PAGE_LIMITS`, `PageHead`, `ArticleGrid`, `ProductList`, `createServerClient`, `truncateQuery`, `resultsLabel`, `shownOfTotal`. **Produces:** `SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> })`; `generateMetadata` (title `Results for “q”`/`Search`, `robots: { index: false, follow: true }`).

- [ ] **Step 1:** `page.tsx`: `q` из `searchParams` (массив → первое значение) → `normalizeQuery`; пустой → `PageHead` «Search» + форма; иначе `PageHead` eyebrow «Search», h1 `Results for “{truncateQuery(q)}”`, строка `resultsLabel(total)`; под ней `SearchForm` (серверная `<form action="/search" method="get">`, `defaultValue = q`, отдельный `id`); секции «Articles» (`ArticleGrid`, `headingLevel` 3) и «Shop» (`ProductList`, `headingLevel` 3) — только непустые; `shownOfTotal`; ничего не найдено → «No matches found. Try a different word, or browse all articles or the shop.» со ссылками на `/articles` и `/shop`.
- [ ] **Step 2:** `loading.tsx` — скелетон на `Skeleton`; в 6A данные из `searchContent` (фикстуры).
- [ ] **Step 3:** тест страницы (RTL, `await SearchPage({searchParams})`): h1, счётчик, секции, пустой результат, `q` массивом, пустой `q`, «Showing the first…».
- [ ] **Step 4:** `npm run build` — убедиться, что `/search` помечена `ƒ`, остальные `○`/`●`; lint, tsc, test; commit `feat(search): /search page on fixtures`.

### Task 6: Миграция 0022 `search_content` (6B)

**Files:** Create `supabase/migrations/0022_search_content.sql`
**Interfaces — Produces (БД):** `urban_gardener.search_content(p_query text, p_article_limit int, p_product_limit int) returns jsonb` → `{"articles":{"total":n,"ids":[uuid…]},"products":{"total":n,"ids":[uuid…]}}`.

- [ ] **Step 1:** загрузить `database-migrations`; проверить текущее состояние через Supabase MCP (`list_tables`, `list_extensions`, `list_migrations` — проект `base-one`); убедиться, что 0017–0021 применены, а `pg_trgm` доступен.
- [ ] **Step 2:** написать миграцию: `create extension if not exists pg_trgm with schema extensions`; GIN `gin_trgm_ops` на `articles.title`, `products.name`; функция по спеке («Данные и БД»): нормализация `left(regexp_replace(btrim(p_query), '\s+', ' ', 'g'), 80)`, `< 2` символов → пустой результат, экранирование `\ % _` для `like … escape '\'`, слова через `string_to_array`, AND по словам; поля по S1(а), баллы 4/3/2/1 + бонус +4, порядок `score desc, published_at desc, id`; **`is_published = true` явно** для обеих сущностей; лимиты `least(greatest(coalesce(x,0),0),50)`; слово совпадает, если подстрока или `extensions.word_similarity(word, field) >= 0.4` (порог подобрать на данных, записать в ledger); `revoke … from public`, `grant execute … to anon, authenticated, service_role`.
- [ ] **Step 3:** применить через Supabase MCP `apply_migration` (как в Фазах 2–5); имя файла = имя миграции.
- [ ] **Step 4:** проверка под `anon` (`set local role anon` в `execute_sql`): «monstera», «monsetra», «sanseveria», слово темы, слово бренда/категории, `zzzxx`, ``, `a`, `%`, `_`, `\`, `it's`, `a,b`, `(plant)`; лимит 1000 → зажат 50; `total` > `ids`; временно сделать черновик из статьи/товара (в транзакции с откатом) → не находится; «sun»/«pot» не дают лавины.
- [ ] **Step 5:** `get_advisors` (security + performance); ревью `database-reviewer`; CRITICAL/HIGH — исправить правкой 0023+. Commit `feat(search): migration 0022 search_content`.

### Task 7: Сайт читает БД (6C)

**Files:** Modify `lib/search.ts`; Test `lib/search.test.ts`
**Interfaces — Consumes:** RPC из Task 6, `ARTICLE_LIST_SELECT`, `rowToArticle`, `toCard`, `CARD_SELECT`, `rowToCardData`, `fail`, `orderByIds`. **Produces:** `searchContent(client, query, limits)` без изменения сигнатуры; фикстурный путь остаётся только в `search.fixtures.ts` (используется тестами).

- [ ] **Step 1:** `normalizeQuery` → пусто — вернуть пустой результат без запроса; иначе `client.rpc('search_content', { p_query, p_article_limit, p_product_limit })`; ошибка → `fail('search', error)`; форму ответа проверять строго (не объект/не массив ids → throw).
- [ ] **Step 2:** одним `Promise.all` — выборка статей `.select(ARTICLE_LIST_SELECT).in('id', ids).eq('is_published', true)` и товаров `.select(CARD_SELECT).in('id', ids).eq('is_published', true)` (пустой `ids` — без запроса); `orderByIds`; `total` берётся из RPC.
- [ ] **Step 3:** тесты по спеке с моком клиента: порядок ids сохраняется при перемешанном ответе PostgREST; строка пропала между запросами → отбрасывается, `total` остаётся из RPC; RPC error → throw; кривая форма → throw; пустой запрос → клиент не вызван.
- [ ] **Step 4:** ручная проверка в браузере на реальных данных (панель, `/search`, опечатка, спецсимволы, телефон); `silent-failure-hunter` по `lib/search.ts` и `HeaderSearch`; commit `feat(search): site searches the database`.

### Task 8: Тесты (6D)

**Files:** `components/search/*.test.tsx`, `e2e/search.spec.ts` (создаёт `test-engineer` по спеке; код фичи не меняет)

- [ ] **Step 1:** передать `test-engineer` проект `urban.gardener`, спеку, план владельца §6 и Review Focus; требуемые кейсы: клавиатура и ARIA `HeaderSearch`, задержка 250 мс (fake timers), устаревший ответ, ошибка → status-строка, пустой результат, Esc/фокус, закрытие по смене маршрута; страница (Task 5) на RPC-моках; e2e на живом Supabase: «monstera», `zzzxx`, `50%`, `a,b`, опечатка, мобильная ширина 390 без горизонтального скролла, клавиатура ↓/Enter/Esc.
- [ ] **Step 2:** принять отчёт; баги «код ≠ спека» — вынести владельцу; прогнать `npm test` и `npm run test:e2e` (один раз, порт 3200).

### Task 9: Ревью-гейт, проверка и документация (6E)

- [ ] **Step 1:** ревьюеры (только читают): `react-reviewer`, `typescript-reviewer`, `a11y-architect`, `silent-failure-hunter`, `database-reviewer`, `seo-specialist` (noindex-страница). CRITICAL/HIGH — исправить или вынести владельцу; ревью на соответствие плану (`requesting-code-review`).
- [ ] **Step 2:** `verification-before-completion`: `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm test` (+ e2e) с реальным выводом.
- [ ] **Step 3:** документы (без коммита): `platform-docs/database/schema.md` (RPC 0022), `sites/urban-gardener.md` (D37+), roadmap (статусы 6A–6E), `urban.gardener/AGENTS.md` (срез Search, 0001–0022), `phase-x-checklist.md` («Фаза 6»), отчёт в плане владельца; память агента.
- [ ] **Step 4:** отчёт владельцу по `meta-planning` §8; ждём «принято». Merge/PR — по команде (три варианта опросником, `superpowers-routing` §6).

## Что решил сам (способ исполнения)

`executing-plans` инлайн: один репозиторий, жёсткая цепочка интерфейсов; независимый взгляд обеспечивают `test-engineer` (Task 8) и ревьюеры (Task 6, 9).
