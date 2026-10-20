# Фаза Y — спека для агента: чистка тестов и интеграционные тесты на локальной БД

> План владельца: ../plans/2026-10-20-phase-y-test-overhaul.md. Источник: ревью всех тестов 2026-10-20 (прочитаны построчно тесты cozycorner, avocado.kiss, urban.gardener и UI-тесты web.admin до `UgLegalPage`; `UgSiteSettingsPage`, `ugStaticForm`, `lib/ugHome|ugShop|ugStatic|ugTaxonomy` в web.admin просмотрены по названиям — перед правкой читать построчно). Тесты при ревью НЕ запускались.

## Принципы (слова владельца)
- Хороший тест ловит сломанную функциональность, а не заставляет хранить реализацию. Переписали код, поведение то же — тест проходит.
- Не нужны проверки вёрстки, форматирования и конкретных текстов страницы.
- Бэкенд: интеграционные тесты эндпоинтов/загрузчиков на тестовой БД. Юнит-тесты ради покрытия не нужны.
- Дешёвые юнит-тесты, ловящие реальные ошибки, остаются. Конкретный ожидаемый результат — норма; проверка магических чисел — нет.

## Решения владельца (2026-10-20)
1. Правило 390 px — вариант А: из автотестов остаётся только `urban.gardener/e2e/mobile-sweep.spec.ts` (нет переполнения, один h1, нет ошибок консоли) + ручной шаг «агент смотрит скриншот 390 px через Playwright MCP». Тесты пикселей/пропорций/координат/колец фокуса удаляются.
2. Тестовая БД — локально, Supabase CLI + Docker.
3. Исполнение — отдельными чатами по шагам Y1…Y5.

## Окружение (проверено 2026-10-20)
- Docker.app установлен, демон НЕ запущен (`docker info` не подключается) → владелец запускает Docker Desktop перед Y3.
- Supabase CLI не установлен; `brew` есть (`/opt/homebrew/bin/brew`) → `brew install supabase/tap/supabase` (спросить разрешения).
- Порты 54321–54324 свободны; на диске ~49 ГБ.
- Боевой проект один: ref `zwrkphynupdubevzwdzy` (из `web.admin/src/config/sites.ts`), в нём схемы `cozycorner`, `avocado_kiss`, `urban_gardener`. Тесты туда не ходят никогда.
- Миграции: cozycorner 31 (0001 создаёт `public.products` с нуля — хороший знак), avocado.kiss 21, urban.gardener 31; web.admin без своих. Seed — только `cozycorner/supabase/seed.sql`. Порядок накатки на проде был: cozycorner → avocado → urban (номера в каждом репо с 0001). Подтвердить в Y3.
- Ветки: `feat/test-overhaul` в каждом затронутом репо; без worktrees; коммит/пуш только по команде.

## Шаги и чаты
| Шаг | Чат (фраза) | Содержание | Выход |
|---|---|---|---|
| Y1 | «Начинаем фазу Y» | Удалить тесты (§Y1), править документы по правилу 390 px | Таблица «было → стало», `npm test`/`build`/`lint` зелёные в 4 репо |
| Y2 | «Начинаем фазу Y — шаг Y2» | Переписать тесты без БД (§Y2) | То же + список сохранённых сценариев |
| Y3 | «Начинаем фазу Y — шаг Y3» | Разведка и инфраструктура тестовой БД (§Y3). **Точка остановки** | Рабочая `npm run test:integration` с одним смоук-тестом; или отчёт «миграции не накатываются» с вариантами |
| Y4 | «Начинаем фазу Y — шаг Y4» (можно по репо: cozycorner / avocado / urban) | Интеграционные тесты API-роутов и загрузчиков (§Y4) | Тесты + «сломал → покраснел» |
| Y5 | «Начинаем фазу Y — шаг Y5» | Интеграционные тесты админки + RLS-тесты (§Y5) | Тесты + «сломал → покраснел» |

Уровень Superpowers по `superpowers-routing`: Y1/Y2 — уровень 2 (без миграций), Y3–Y5 — уровень 3, но impl-план отдельно не нужен (в спеке достаточно); перед Y3 прочитать скиллы `database-migrations`, `postgres-patterns`; ревью: `database-reviewer` на тестовых фикстурах/RLS-тестах, `typescript-reviewer` на помощниках. Перед любым кодом — `testing` (скилл) и `platform-docs/methodology/testing.md`. Внешний API (Supabase CLI, Vitest 4 `projects`, `globalSetup`) сверять через Context7.

---
## Y1 — Удалить (результат ревью; перед удалением сверять с файлом, список составлен по прочтению)

### Все репо
- `overlay-scrollbar.test.ts` — 4 идентичные копии (md5 совпадает). Оставить ОДНУ копию (где — решить, напр. urban.gardener) с тестами `computeThumb` и `scrollFromThumbOffset`; в остальных трёх — файл удалить (но `components/overlay-scrollbar/` в канонике `platform-docs/methodology/overlay-scrollbar/` обновить: «копии побайтово равны» относится к исходникам; тест живёт в одном репо). Из оставшейся копии убрать DOM-тесты `attachOverlayScrollbar`: «прячет полосу, пока контейнер не скроллится», «создаёт трек на каждую ось», «для окна кладёт фиксированный трек» (классы `.osb-track--disabled`, `.osb--fixed`; в jsdom размеры нулевые). Тест «ставит свой DOM рядом… убирает при отписке» переписать на проверку «после detach DOM чист» без классов и inline-стилей.

### cozycorner
- `app/loading.test.tsx` — все 3 (aria-busy, aria-hidden>0, нет текста Loading).
- `components/Breadcrumbs.test.tsx` — «embedded variant uses its own class».
- `components/about/AboutIntro.test.tsx` — «рендерит переданный eyebrow, h1, лид».
- `components/about/AboutStory.test.tsx` — «рендерит заголовок, абзацы, картинку» (+точный bucket-URL, дублирует `resolveProductImage`); «imagePath=null → плейсхолдер span».
- `components/about/AboutValues.test.tsx` — «рендерит ровно три карточки с переданным контентом».
- `lib/search.test.ts` — блок `searchPosts` (только аргументы `select/eq` на моке).

### avocado.kiss
- `app/loading.test.tsx` — все 3.
- `components/Footer.test.tsx` — тесты 1, 3, 4 (тексты settings, href About/Contact/Privacy/Terms); тест 2 оставить.
- `components/EditorsPicks.test.tsx` — «нумерованный пик», «feature с картинкой»; оставить «пусто → ничего».
- `components/MosaicBanner.test.tsx` — «заголовок-ссылка, eyebrow, абзац» (fallback на excerpt — оставить).
- `components/MosaicCard.test.tsx` — «заголовок/картинка», «НЕ показывает автора/время», «плейсхолдер [data-placeholder]», «подзаголовок»; «eyebrow-оверрайд» оставить.
- `components/PostCard.test.tsx` — оба. `components/PostSections.test.tsx` — единственный (дублирует blocks.test).
- `components/ProductCard.test.tsx` — все 4. `components/RatingBadge.test.tsx` — оба (дублирует lib/rating).
- `components/ReadAlso.test.tsx` — «заголовок и карточки»; оставить «пусто».
- `components/RecipeCard.test.tsx` — large, list, «medium без hero → плейсхолдер»; оставить «теги вместо категории», «eyebrow-оверрайд».
- `components/RecipeContent.test.tsx` — «ингредиенты», «шаги с 01/02»; оставить «пусто».
- `components/RecipeMeta.test.tsx` — «Serves/Cook time», «action slot» ×2; оставить «только присутствующие поля», «пусто».
- `components/ShopHero.test.tsx` — все 3.
- `components/about/*.test.tsx` — как в cozycorner.
- `components/blocks/blocks.test.tsx` — 6 из 10 (тексты); оставить «делит на абзацы» и три «пусто → ничего».
- `components/contact/ContactMethods.test.tsx` — все кроме «email=null → фолбэк mailto».
- `lib/columns.test.ts` — «содержат колонки…»; два теста про preview_token и '*' оставить.
- `lib/rating.test.ts` — `RATING_MIN is 4.1`; форматирование «1 Rating/3 Ratings», aria-label; «значение в 1..500»; «разные id → разные числа» (вероятностный); «на пороге ≤500». Оставить: детерминированность, ≥1, «после порога — реальное число».
- `lib/socials.test.ts` — `typeof Icon === 'function'` ×2.
- `lib/blog.test.ts` — `postPath`, `formatPostDate` (regex).
- `e2e/shop.spec.ts` — ассерт внутри `if (optionCount > 1)`.

### urban.gardener
Целиком: `app/design/page.test.tsx`, `app/design/palette.test.ts`, `app/template.test.tsx`, `components/Skeleton.test.tsx`, `SkipLink.test.tsx`, `icons/icons.test.tsx`, `home/HomeJournal.test.tsx`, `HomeShop.test.tsx`, `HomeTip.test.tsx`, `about/About.test.tsx`, `articles/ArticleCard.test.tsx`, `ArticleHeader.test.tsx`, `TopicPills.test.tsx`, `shop/CategoryCard.test.tsx`, `RelatedProducts.test.tsx`, `SpecList.test.tsx`, `ui/ButtonLink.test.tsx`, `Pill.test.tsx`, `primitives.test.tsx`, `search/SearchForm.test.tsx`, `lib/articles.fixtures.test.ts`, `lib/shop.fixtures.test.ts`, `lib/static-pages.fixtures.test.ts`, `lib/search.fixtures.test.ts`, `lib/site.test.ts`, `lib/supabase/server.test.ts`, `lib/supabase/fail.test.ts`.
Если после удаления тестов фикстур/`search.fixtures` перестаёт быть нужен — проверить использование (`Header.test`, `search-page.test` берут `searchFixtures`) и не удалять сами фикстуры, если их используют другие тесты.
Частично:
- `app/page.test.tsx` — «composes hero, topics…» (оставить 2 теста про скрытие пустых секций).
- `components/home/Hero.test.tsx` — 6 из 8; оставить XSS-тест (разметка из заголовка выводится текстом).
- `components/home/FeaturedArticle.test.tsx` — 5 из 7 (тексты, счёт «·» в textContent).
- `components/articles/ArticleBody.test.tsx` — всё кроме «неизвестный тип пропускается» и «битый путь картинки пропускается».
- `components/Footer.test.tsx` — 4 из 8 (бренд, колонки, подпись, legal из конфига); оставить кастомные колонки, пустой Legal, Cookie settings, год.
- `components/Header.test.tsx` — «renders brand/nav/social» (точный список), «social links at the very bottom».
- `components/Reveal.test.tsx` — убрать `210ms`, `700ms`, `data-reveal`, `transitionend`; оставить «видим без JS», «reduced motion», «нет IntersectionObserver».
- `components/newsletter/Turnstile.test.tsx` — `sitekey`, `interaction-only`, возня с тегом script (оставить «ошибка загрузки → onError»).
- `components/consent/CookieConsent.test.tsx` — «одинаковый className у кнопок», атрибут `data-cookie-banner`.
- `components/search/SearchResultsPanel.test.tsx` — уникальные id, tabindex=-1, aria-selected ×3, миниатюра w=88, `startsWith('lb')`.
- `components/shop/FiltersBar.test.tsx` — тексты опций «Under €15…», className `/on/`, DOM-позиция leading.
- `components/shop/ProductCard.test.tsx` — 6 из 9 (цена текстом, `[class*=price]`, `[class*=photoCutout]`).
- `components/shop/ProductDetail.test.tsx` — крошки текстом, `p[class*=desc]`, «не рендерит spec-list».
- `app/static-pages-metadata.test.ts` — `revalidate === 60`, тексты фолбэк-заголовков, «description > 20 символов».
- `lib/contact.test.ts` — `CONTACT_COLUMNS.length === 11`, тексты фолбэка.
- `lib/static-pages.mappers.test.ts` — блок `column lists`.
e2e (вёрстка — решение А): `e2e/shell.spec.ts` (три теста overlay scrollbar, sticky header, «search panel overlays without shifting», «header fits at 861/900/960»), `mobile-polish.spec.ts` (пропорция 1.25, border-radius 0, ellipsis), `narrow-320.spec.ts` (целиком), `a11y-final.spec.ts` (24px, overflowY), `focus.spec.ts` (проверки «ring 2px solid, offset 2px, цвет токена»; порядок Tab и возврат фокуса оставить), `consent.spec.ts` (ширина кнопок ±1px, баннер в 390), `contact.spec.ts` и `newsletter.spec.ts` (блоки «на телефоне ≥44px»), `home.spec.ts` («featured — колонка: фото выше текста»), `shop.spec.ts` («крошки слева от фильтров», «дропдауны шире 310px»). `mobile-sweep.spec.ts` ОСТАВИТЬ.

### web.admin
- `components/ComingSoonPage.test.tsx`, `components/RouteFallback.test.tsx`.
- `config/sites.test.ts` — «exposes only built sections» (копия массива); оставить «slug/schema/bucket уникальны».
- `features/folders/FoldersPanel.test.tsx` — «renders All/Unsorted + counts», «no longer renders ellipsis menu».
- `features/folders/FolderActionsBar.test.tsx` — «shows the folder name with Rename and Delete».
- `features/pages/AboutContentEditor.test.tsx` — все 4.
- `features/ug-products/ShopRoutes.test.tsx` — блок «other sites are untouched» (читает `sites.ts`).
- `lib/homeSlots.test.ts` — «slot capacities match the layout», «covers every slot (8)», «groups in layout order».
- `features/ug-home/ugHomeForm.test.ts` — «uses 1 / 6 / 3». `features/ug-products/ugProductForm.test.ts` — «offers EUR, USD, GBP».
- `components/RichTextEditor.test.tsx` — блок `toolbar` (наличие кнопок); round-trip markdown оставить.
- `features/ug-articles/UgTopicsField.test.tsx` и `features/ug-products/UgCategoriesField.test.tsx` — почти одинаковые; оставить один набор, убрать `.closest('.rounded-full')`.
- Дубли в `UgHomePage`, `UgAboutPage`, `UgLegalPage`, `UgSiteSettingsPage`: блоки «unsaved-changes guard» (оставить по 1–2 теста на страницу, остальное — отдельный тест общего хука) и «failed re-read after successful save is NOT a failed save» (оставить в одном файле). Тексты подсказок/placeholder'ов («We're here to make plant care feel calm…», `/Amsterdam/`, `0/60 characters…`), `className /emerald/`, `Last updated … (set automatically…`, «Add X is disabled at 4/8/4/6» (оставить по одному тесту на правило лимита), счётчики `1/1`, `2/6`, `1/3`, склеенный `'Plant care thatactually makes sense'`, aria-live сообщения и перенос фокуса в `UgHomePage`.

### Документы (правило 390 px, вариант А)
Править формулировки в:
- `AGENTS.md` (корень), протокол тестирования, шаг 5 (строка про «телефон 390 px»);
- `platform-docs/methodology/testing.md`: раздел «Проверка на телефоне (390 px)» (пп. 1–3) и подраздел «Общий проход на 390/320 px…» (убрать `narrow-320` и «боксы/координаты»; оставить `mobile-sweep`, Turnstile lazy);
- `platform-docs/skills/meta/meta-planning/SKILL.md` §5 (в строке «Исполнение» — «проверка на 390 px» оставить как осмотр скриншота, не как автотест) и `platform-docs/skills/meta/superpowers-routing/SKILL.md` п. 7 — сверить формулировку;
- `.claude/agents/test-engineer.md` и `.claude/skills/testing/` — grep «390» там ничего не нашёл; прочитать и убедиться, что они не требуют mobile-спеков;
- `platform-docs/methodology/focus-policy.md` — раздел про e2e `focus.spec.ts` (остаётся порядок Tab и возврат фокуса, без проверок размера кольца);
- исторический `superpowers-evaluation-2026-10.md` не править.
Новая формулировка: «срез с видимым результатом: (1) добавить страницу в `mobile-sweep`, если это новая страница; (2) агент смотрит скриншот на 390 px и пишет в отчёте „390 px: проверено по скриншоту“ или „не проверялось, потому что…“. Тестов на пиксели, пропорции, координаты и CSS не пишем».

Критерий Y1: удалены/урезаны файлы по списку; `npm test`, `npm run build`, `npm run lint` в cozycorner, avocado.kiss, urban.gardener, web.admin зелёные; e2e `mobile-sweep` и затронутые спеки проходят (e2e urban: порт 3200, нужен живой Supabase — если недоступно, сказать явно); таблица «репо — файлов/тестов было → стало» (посчитать до и после `vitest --reporter=json` или `grep -c`).

---
## Y2 — Переписать без базы
- cozycorner: `FiltersBar` (оставить «Clear только при выборе»; добавить «выбор бренда → onChange», «Clear сбрасывает»; убрать позицию через `closest("div")`); `GoogleAnalytics` («при Accept» — убрать ID `G-7CZ6DW45ED` и ровно 2 скрипта; проверять «до Accept скриптов нет, после — есть gtag-скрипт»); `ProductGrid` (убрать `aria-hidden === INITIAL.length`; добавить «поздний ответ не затирает свежий»); about-тесты → по одному тесту на компонент «пустые поля → страница не пустая»; `AboutValues` — «ровно три карточки, лишние отбрасываются».
- avocado.kiss: `HeroCarousel` (мок gsap + `className === styles.dotActive` → проверять активную точку по `aria-current`/`aria-pressed`; число 10000 мс — из экспорта); `NewsletterForm` (искать по `role=alert/status`, без текстов); `RatingSection` (убрать мок `setRated`); `BlogArchive` (`push toHaveBeenCalledWith(..., {scroll:false})` — реализация роутера; поведение «клик по активному не навигирует» оставить); `ProductGrid` (`grid.children.length`).
- urban.gardener: `HeaderSearch.test.tsx` (872 строки) → оставить 7–8 поведенческих (быстрый ввод → один запрос; устаревший ответ не затирает новый; ошибка → строка статуса; Enter → `/search?q=`; Clear; повтор из кэша без запроса; закрытие отбрасывает ответ; выбор подсказки ведёт на страницу), без чисел 250/249 мс, 5 с, `aria-activedescendant`, `scrollIntoView`, `preconnect`, `touchMove`. `NewsletterModal.test.tsx` → оставить: не на первом просмотре; не на /privacy|/terms|/contact; помнит показ; подписчику не показывается; закрывается Esc/✕/фоном; успех закрывает; убрать `500 ms`, `inert`, `overflow:hidden`, фокус на `<main>`, ловушку Tab ×4, «hidden iframe/input не tab stop» (дублирует `e2e/focus.spec.ts`). `NewsletterForm` (тексты ошибок, `aria-describedby`, `aria-disabled`, «узел alert заменяется»). `GoogleAnalytics` (убрать `toHaveLength(2)` и `data-src`). `shop/ProductGrid` (убрать `[tabindex="-1"]`, `aria-busy`). `ShopCatalog` (границы цен 15/30/50 в `toHaveBeenCalledWith` → «дешевле границы пропали»). `static-pages-utils` и mappers: оставить `isSafeHref`, trim, фолбэки; убрать магические лимиты «5 колонок / 9 ссылок / 7 пунктов» и `toThrow(/author/)`/текст `console.warn`.
- web.admin: `UgHomepageUsageWarning` (достаточно «ссылка на главную + названа секция»); `UgBlocksEditor` (`textContent == [...]`, `closest('div.rounded-xl')`); `UgAboutPage/UgContactPage/UgLegalPage` («sends ALL 19 about keys» повторяет `UG_ABOUT_FIELDS` → «пустое → null, заполненное тримится»); `parseHeroTitle` дублируется в `web.admin/src/features/ug-home/ugHeroTitle.ts` и `urban.gardener/lib/home-utils.ts` — не удалять без общего контракта; зафиксировать как наблюдение в backlog, если не договоримся.
- Критерий: поведение прежнее — для каждого переписанного теста назвать защищаемый сценарий; нарочно ломать поведение (не вёрстку) и видеть красный.

---
## Y3 — Инфраструктура тестовой БД (разведка, точка остановки)
Цель: локальный Postgres/Supabase со всеми тремя схемами, поднимаемый одной командой, и один смоук-тест на каждый репо.
1. Установка CLI (`brew install supabase/tap/supabase`, с разрешения), проверка `docker info`. Версию CLI и флаги сверить через Context7 (`/supabase/cli`).
2. Папка `platform-docs/test-db/`: `README.md`, `config.toml` (`supabase init` + отключить лишнее: studio, inbucket, edge runtime по необходимости), `up.sh`/`down.sh`/`reset.sh`, `apply-migrations.sh`. Миграции берутся прямо из репо (`cozycorner/supabase/migrations`, `avocado.kiss/...`, `urban.gardener/...`) в порядке cozycorner → avocado → urban (подтвердить зависимости: общие функции/расширения? `pg_trgm` для поиска Urban; расширения проверить `grep -rn "create extension"`). Накатывать `psql`-ом поштучно (номера в репо пересекаются, одной папкой `supabase db reset` не накатить) — либо временно склеить в `supabase/migrations` с префиксом репо. Выбрать по факту.
3. Что проверить: все 83 миграции накатились без правки; схемы `cozycorner`, `avocado_kiss`, `urban_gardener` созданы и экспонированы PostgREST (`db.schemas` в config.toml — сверить с настройкой «Exposed schemas» на проде); бакеты Storage созданы (`cozycorner-photos`, `avocado-kiss-photos`, `urban-gardener-photos`); роли anon/authenticated/service_role и гранты как на проде. Возможные расхождения: миграции, писавшиеся «поверх» (ссылки на объекты вне репо), дампы расширений. Любую правку миграций — только по решению владельца (миграции в репо — источник истины для прода).
4. Сид для тестов: не копировать прод. Минимальные фикстуры, создаваемые самим тестом (`beforeAll`/фабрики) с префиксом `it-`; сидовые миграции (`0003_seed_*`) накатываются как есть — для тестов использовать их данные только если стабильны, иначе создавать своё.
5. Общий помощник `platform-docs/test-db/client-helpers` не годится (репо независимы) → в каждом репо маленький `tests/integration/db.ts`: читает `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_KEY` (из `.env.test`, который пишет `up.sh`; файл в `.gitignore`), **кидает ошибку, если host не `127.0.0.1`/`localhost`**; создаёт anon-клиент и service-клиент; функция очистки по префиксу.
6. Vitest: отдельный проект/конфиг `vitest.integration.config.ts` (environment `node`, `include: ['**/*.integration.test.ts']`, `fileParallelism: false`, `globalSetup` проверяет доступность БД и печатает понятную ошибку «запустите test-db/up.sh»); скрипт `test:integration`. Обычный `npm test` исключает `*.integration.test.ts`. API Vitest 4 (projects/globalSetup) — Context7.
7. Смоук: в каждом репо по одному тесту «anon читает опубликованную запись / не видит черновик».
**Точка остановки.** Если п.3 не проходит без правки миграций — не продолжать Y4/Y5: отчёт владельцу (что именно падает, варианты: правка миграций, снимок схемы с прода через `pg_dump --schema-only`, отдельный проект). Допустимый альтернативный источник схемы — `supabase db dump`/MCP `list_tables` с прода только для чтения (владельцу сообщить, секреты не печатать).

---
## Y4 — Интеграционные тесты сайтов
Для каждого теста — «сломал → покраснел». Внешние HTTP (Turnstile `siteverify`) остаются заглушкой; БД — настоящая. Клиент для роутов: `createServiceClient` читает env — в тесте подставить локальные значения (`vi.stubEnv` до импорта), `server-only` мокать как в `avocado.kiss/lib/preview.test.ts`.
- avocado.kiss: `app/api/newsletter` (POST → строка в `subscribers` в нижнем регистре; дубль → 200 и одна строка; невалидный email → 400 без записи; Turnstile не прошёл → 403 без записи), `app/api/recipes/[slug]/rate` (оценка меняет `display_avg/display_count`; повтор того же `clientId` не удваивает; неизвестный slug → 404), загрузчики: `lib/blog.ts` (`fetchPostSections`: маппинг блоков, гидрация recipe_card), `lib/preview.ts`/`lib/blog.ts` (превью по токену отдаёт черновик, без токена/с чужим — `null`, `preview_token` не возвращается), `lib/shop.ts` (`fetchProductsPage` по категории, `fetchShopFilterOptions` бренды distinct+sorted, `fetchProductBySlug` главная категория), `lib/search.ts` (`searchRecipes`: поиск по title/excerpt/category/author_name; черновики не находятся), `lib/relations.ts` (`resolveRelated`: пины первыми по position; неопубликованный пин не попадает; авто-ранжирование категория+тег > категория > тег; свежий выигрывает при равенстве; лимит; фолбэк стабилен). Удалить после этого: тесты весов `scoreCandidate` (+3/+2/+1, потолок 4), «разные seed → разный порядок», самописный `fakeClient`.
- urban.gardener: `app/api/contact` (запись в `messages` нормализована; 23514 → 400; IP не пишется в БД; ошибка БД → 500; 503 при недоступном Turnstile — заглушка), `app/api/newsletter` (аналогично avocado + 23514), загрузчики `lib/articles.ts` (только опубликованные, порядок, блоки; ошибка → throw), `lib/home.ts` (слоты: featured/journal/shop, дедуп, лимиты 6/3, черновик не попадает), `lib/search.ts` (RPC `search_content`: сидовые статьи/товары находятся, опечатка «monsetra», `%`/`_` литералы, черновики не находятся, `total` корректен), `lib/sitemap.ts` (собирается из реальных строк), `lib/preview.ts` (`fetchArticleForPreview`/`fetchProductForPreview`: токен сравнивается в БД, anon не читает колонку `preview_token`).
- cozycorner: `lib/content.ts` (`fetchAboutContent` — первая строка по `created_at`), `lib/posts.ts` (анон не получает `preview_token`; неопубликованные посты не видны; превью по токену), `lib/products.ts` (`fetchProducts` с категорией и пагинацией; `fetchFilterOptions` бренды distinct+sorted; `fetchProductCategoryNames` по алфавиту; `fetchRelatedProducts` — дедуп, исключение себя, добор свежими), `lib/search.ts` (`searchPosts`).
- RLS-тесты (новое покрытие): anon не читает `preview_token` у recipes/posts/articles/products; anon не пишет в `subscribers`/`messages` напрямую (только через service-роут); anon не видит черновики.
Критерий: `npm run test:integration` зелёный в каждом репо; обычный `npm test` не требует Docker; удалены замененные мок-тесты.

---
## Y5 — Интеграционные тесты админки (web.admin)
- Неопределённость: как админка авторизуется (`getDb(site)` + сессия администратора) и какие политики RLS это разрешают. В Y5 первым делом прочитать `web.admin/src/lib/supabase.ts` и политики в миграциях; создать в локальной БД пользователя-администратора (через GoTrue admin API локального стека), логин получает JWT.
- Что проверять (вместо мок-цепочек в `lib/*.test.ts`): `deleteMessage`/`setMessageRead`/`deleteSubscriber`/`deleteUgArticle`/`deleteUgProduct` — «0 строк → ошибка, а не тихий успех» (в т. ч. под ролью без прав — RLS); `saveUgArticle`/`saveUgProduct`/`saveUgHome`/`saveUgAbout`/`saveUgSiteSettings` через RPC — запись видна при повторном чтении, правила публикации (23514) возвращаются; `deleteUgTopic` блокируется, если опубликованная статья осталась бы без тем; `deleteUgShopCategory` — если товар остался бы без категорий; `deleteUgAuthor` с статьями; usage-счётчики и лимит 1000 строк (`refuses to count a truncated result` — проверять на искусственно большом наборе или оставить юнитом); `getUgHome` (слот без читаемой цели → ошибка); `about`/`getAboutContent`.
- Страницы с `toHaveBeenCalledWith` на мок-RPC (`ArticleEditPage` «Save calls updateArticle», `AvocadoPageEditPage`, `ProductEditPage`, `RecipeEditPage`, `UgProductEditPage`) переписать: проверять итог после перечитывания, а не аргументы вызова — либо оставить только форму/валидацию.
Если Y5 упирается в авторизацию — остановиться и вынести владельцу вариант.

---
## Что оставить без изменений
Чистые функции и сценарии с конкретными ожидаемыми значениями: `consent`, `links`, `forms-validation`, `newsletter-popup`, `turnstile`, `indexing`, `images`/`resolveImageUrl`/`toStoragePath`, `site-url`, `search-utils`, `search-cache`, `sitemap-utils`, `shop-utils`, `article-utils`, `home-utils`, `csv`, `format`, `MarkdownText`, `LegalArticle`, `RichTextEditor` round-trip, `SmartLink`, все `*Form.test.ts` админки (`toInput/toFormValues`, zod-правила публикации), `mobile-sweep.spec.ts`, `preview.spec.ts`, `turnstile-lazy.spec.ts`, все `smoke.spec.ts`, `robots.test.ts`.

## Общие правила на всю фазу
- Читать файл перед правкой; удаление — только после чтения (список мог устареть).
- Не менять код сайтов/админки/миграции (кроме тестов, конфигов тестов, документов); если тест находит баг — не чинить, а записать в backlog и доложить (протокол testing: «код ≠ спека → код не трогаю»).
- Не коммитить и не пушить.
- В конце каждого шага: запись состояния (память, статус плана, фраза следующего чата).
