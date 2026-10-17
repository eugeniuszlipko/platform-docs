# Urban Gardener — архитектура и решения сайта

> Last updated: 2026-10-15 | Source: референс `urban.gardener/Urban Gardener.html`
> (статичный HTML-прототип) + решения владельца от 2026-10-14. Статус: **Фазы 0 и 1
> приняты (2026-10-15); Фаза 2 (Articles) выполнена и проверена владельцем на проде (2026-10-15); план Фазы 3 (Shop) утверждён.** Этапный план — [urban-gardener/plans/2026-10-14-urban-gardener-roadmap.md](urban-gardener/plans/2026-10-14-urban-gardener-roadmap.md).

Журнал об уходе за комнатными растениями (английский UI) + курируемый каталог
растений и товаров с внешними ссылками (Amazon), без корзины и оплаты. Часть
экосистемы `web.admin`: контент правится в админке, сайт читает его из Supabase.
Паттерны — те же, что у [Avocado Kiss](avocado-kiss.md) и [CozyCorner](cozycorner.md);
общие правила сайтов — [overview.md](overview.md).

## 1. Идентичность

| Что | Значение |
|---|---|
| Название сайта | **Urban Gardener** |
| Слоган | *Urban Soul of Plants* (в референсе — как название, теперь слоган) |
| Подзаголовок референса | «A journal of houseplant care» |
| Язык UI | только английский |
| Домен | неизвестен; до решения — временный `*.vercel.app` |
| Slug в админке (`sites.ts`) | `urban-gardener` |
| Репозиторий / папка | `urban.gardener/` (GitHub-аккаунт `eugeniuszlipko`) |
| Postgres-схема / бакет | `urban_gardener` / `urban-gardener-photos` (Supabase-проект base-one) |
| Vercel-проект | `urban-gardener` |
| e2e-порт | **3200**, нужен live Supabase |

Тексты референса, упоминающие «Urban Soul of Plants» как имя бренда
(шапка, футер, About, Privacy/Terms, e-mail `…@urbansoulofplants.com`) — при
переносе заменяются на «Urban Gardener»; e-mail и домен ждут решения о домене.

## 1.1 Инфраструктура (факты на 2026-10-15)

| Что | Значение |
|---|---|
| GitHub | `eugeniuszlipko/urban-gardener`, remote `git@github-avocado:eugeniuszlipko/urban-gardener.git`, ветка `main` |
| Vercel | team `cozy-corner` (Hobby), проект `urban-gardener`, Git привязан, пуш в `main` → автодеплой (~30 с) |
| Временный URL | https://urban-gardener.vercel.app (публичный алиас; ссылки вида `…-<hash>-cozy-corner.vercel.app` закрыты Vercel-защитой деплоев) |
| Env (production) | `NEXT_PUBLIC_SITE_URL` = временный URL (читает `lib/site-url.ts`); `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (production + preview) |
| Индексация | `robots: noindex` в `app/layout.tsx` — **снять в Фазе 9** |
| Supabase | проект base-one; схема `urban_gardener` и бакет `urban-gardener-photos` созданы (Фаза 2B). ⚠️ Схему нужно добавить в **Exposed schemas** (Data API) — ручной шаг |
| CLI | Vercel CLI залогинен у агента (`vercel whoami`); всегда передавать `--scope cozy-corner`. `vercel git connect` не понимает SSH-алиас — на время вызова ставить https-remote |
| `npm install` с нуля | падает (`edgesOut`); lock-файл взят у `avocado.kiss` — не удалять `package-lock.json` |

## 2. Решения (журнал)

| # | Решение |
|---|---|
| D1 | Стек как у Avocado: Next.js 16 App Router (RSC), SSG + ISR `revalidate = 60`, CSS Modules + токены в `:root`, Supabase publishable key + RLS |
| D2 | Тот же Supabase-проект base-one, новая схема `urban_gardener`, свой бакет |
| D3 | Каталог без оплаты и корзины; кнопка «Find on Amazon» — внешняя ссылка (логика Avocado/CozyCorner) |
| D4 | Тело статьи — reorderable-блоки как в Avocado (text / callout / image / list …) |
| D5 | Автор — отдельная сущность (`authors`) |
| D6 | У товаров **и бейджи, и категории** (бейджи — доп. метки к категориям) |
| D7 | Таксономия статей: Topic + Level — **предварительно, подтвердить** перед Фазой 2 (§4) |
| D8 | Newsletter — как в Avocado: `/api/newsletter` + Turnstile + `subscribers`, только сбор адресов, без ESP |
| D9 | Contact-форма есть в референсе (страница Contact). **Пока только скелет на фронте, без подключения** (без API, БД и раздела Messages) — решение владельца 2026-10-15; подключение — по отдельной команде |
| D10 | Cookie-баннер + GA4 за согласием — порт из cozycorner/Avocado; GA-идентификатора пока нет |
| D11 | Превью черновиков по токену — как в Avocado (`/preview/...`), отдельным этапом |
| D12 | Поиск — по реальной БД (как в других проектах) |
| D13 | Разработка вертикальными срезами: фронт на тестовой структуре → БД и сид → фронт на БД → раздел админки → ручная проверка. Структура данных и детали раздела проектируются **когда доходим до среза**, не заранее |
| D14 | Тесты: Vitest + RTL + Playwright (порт 3200) |
| D15 | Начальный контент — данные референса (9 статей, 9 товаров, англ. тексты) |
| D16 | Документация на русском; код, UI, комментарии к данным — на английском |
| D17 | Таксономии статей (решение 2026-10-15): **Topic** (M2M, первая по порядку = основная) + **Level** (одна на статью); поля референса `tag`/`cat` отдельными таксономиями не переносятся. Карточка: бейдж Level на фото, внизу «N min · основная тема» |
| D18 | **Правило фильтров:** каждая таксономия, создаваемая в админке и приписываемая к контенту, имеет публичный фильтр (и, где нужно для SEO, свою страницу). Несостыковки референса в схему данных не копируем |
| D19 | Маршруты статей: `/articles`, `/articles/[slug]`, отдельная индексируемая страница темы `/topics/[slug]` (для SEO); фильтр Level — клиентский, `?level=` не индексируется (canonical без query) |
| D21 | Модель данных статей (миграции `urban.gardener/supabase/migrations/0001–0004`, схема — [../database/schema.md](../database/schema.md) §10): `authors`, `topics`, `levels`, `articles`, `article_topics` (M2M, `position` минимальная = основная тема), `article_blocks` (5 типов: text/heading/callout/image/list); `media`/`admin_folders` — только админ. RLS: anon видит только опубликованные статьи и их блоки/связи |
| D22 | Сайт читает данные только через `lib/articles.ts`; ошибка Supabase → throw (ISR сохраняет прошлую страницу), статья без автора и «все блоки невалидны» — тоже ошибка, а не пустая страница; неизвестные/пустые блоки пропускаются с `console.warn` |
| D23 | `NEXT_PUBLIC_SITE_URL` обязателен в production-сборке (canonical, OG, share-ссылки); на preview — `VERCEL_URL`, локально — localhost. Env Supabase (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`) заведены в Vercel (production, preview) |
| D24 | Фильтр уровня — клиентский (`?level=` через `useSearchParams` под `<Suspense>` + `history.replaceState`), страницы статические; canonical без query; сброс фильтра при смене темы — `key` на сетке |
| D25 | Общий оверлейный скроллбар воркспейса ([../methodology/overlay-scrollbar/README.md](../methodology/overlay-scrollbar/README.md)): нативная полоса скрыта, своя рисуется поверх контента — контент не сдвигается между страницами со скроллом и без. Подключён 2026-10-15 (в Фазе 1 был пропущен) |
| D26 | Каталог (Фаза 3, решение 2026-10-16): **структура как у CozyCorner** — главная структура **категории** (товар↔категории many-to-many, первая = основная), бывшие «бейджи» референса (Easy care, Low light, Pet-friendly, Statement) стали категориями; отдельной таксономии «бейджи» нет; **бренды** заводятся (на старте пусты); фильтры на странице категории — dropdown **Brand и Price**; хаб `/shop` — карточки категорий с фото; шапка Urban без фото-баннера, крошки внутри шапки; бесконечная прокрутка |
| D27 | Характеристики растения — поля товара (`light`/`water`/`size` текст, `pet_safety` — 3 значения), только spec-list; «Pet-friendly» — обычная категория; отдельной сущности «Растение» нет (§4 п.2 отложен) |
| D28 | Цена — **число + валюта у товара** (по умолчанию EUR); настраиваемая валюта — возможная фича [B-002](../backlog/B-002-configurable-currency.md); оговорка «prices may change» + disclosure (страница товара + строка внизу `/shop`); партнёрские ссылки `rel="sponsored noopener noreferrer"`, только https; противоречие About («No affiliate-driven recommendations») снимается в Фазе 5 — блокирует запуск |
| D29 | Адрес товара — плоский `/product/<slug>` (как у Cozy; [B-003](../backlog/B-003-product-url-structure-seo.md) — SEO-обоснование; URL-ы CozyCorner не меняем); «Related items» — автоподбор по общим категориям. План — [urban-gardener/plans/2026-10-15-phase-3-shop.md](urban-gardener/plans/2026-10-15-phase-3-shop.md), спека — [urban-gardener/specs/2026-10-16-phase-3-shop-spec.md](urban-gardener/specs/2026-10-16-phase-3-shop-spec.md) |
| D30 | Уточнения Фазы 3 по ответам владельца (2026-10-16): на странице категории **крошки слева и фильтры справа в одной строке** (как в Cozy, на телефоне друг под другом на всю ширину); выпадающие Brand/Price — закруглённые пилюли со своей стрелкой, выбранное подсвечено; «Back to shop» на странице товара **убран** (есть крошки); **два примерных вымышленных бренда** заведены, чтобы фильтр Brand работал (заменить настоящими/удалить до запуска); валюта в редакторе товара — список **EUR/USD/GBP**; админка — Products/Categories/Brands ([shop-admin-design](urban-gardener/specs/2026-10-16-shop-admin-design.md)) |
| D20 | Начальный контент — 10 статей референса (featured + 9 карточек; полный текст есть только у featured). План — [urban-gardener/plans/2026-10-15-phase-2-articles.md](urban-gardener/plans/2026-10-15-phase-2-articles.md) |
| D31 | Главная (Фаза 4, ответы владельца 2026-10-16): курируется **вручную слотами `home_slots`** как у Avocado (featured 1 / journal до 6 / shop до 3); пилюли — **все темы** по порядку админки (без «For beginners»); блок рассылки **показан, но неактивен** («Subscribe — coming soon»; настоящая подписка — Фаза 7); тексты hero и SEO правятся в админке **Pages → Homepage** (таблица `pages`, строка `home`). Акцент в заголовке — слова в `*звёздочках*`, перенос строки — Enter. План — [urban-gardener/plans/2026-10-16-phase-4-home.md](urban-gardener/plans/2026-10-16-phase-4-home.md), спека — [urban-gardener/specs/2026-10-16-phase-4-home-spec.md](urban-gardener/specs/2026-10-16-phase-4-home-spec.md), админка — [../admin-panel/home-urban-gardener.md](../admin-panel/home-urban-gardener.md) |
| D33 | Правка Фазы 4 при приёмке (владелец 2026-10-16): **иллюстрация hero заменяется из админки** (Pages → Homepage → Illustration; нет картинки — встроенный лист) и **прижата к нижней границе hero** (лист обрезан по основанию). Миграция 0016 |
| D34 | Страницы и глобальные настройки (Фаза 5, решения владельца 2026-10-16): **About — текст референса как есть** (включая «since 2017», «small team», «52,000 plant lovers», «No affiliate-driven recommendations»; правится в админке — риск записан, пункт в чек-листе запуска; **правка D28 по решению владельца: противоречие About ↔ disclosure НЕ снято текстом**); About правится **структурными полями** (`about_content`); **Privacy/Terms — адаптация текстов Cozy/Avocado** на состояние запуска (рассылка + Turnstile, форма Contact, cookie-согласие + GA4, партнёрские ссылки), markdown в `pages.body`, e-mail токеном `{{contact_email}}` (`hello@urbansoulofplants.com`, заглушка до выбора домена), оператор = бренд + e-mail (юрлицо/страна — пометка в тексте, вносит владелец до запуска); в админку переезжают **оговорка affiliate, price note, соцсети, e-mail и весь футер** (`site_settings`; меню шапки остаётся в коде). План — [urban-gardener/plans/2026-10-16-phase-5-static-pages.md](urban-gardener/plans/2026-10-16-phase-5-static-pages.md), спека — [urban-gardener/specs/2026-10-16-phase-5-static-pages-spec.md](urban-gardener/specs/2026-10-16-phase-5-static-pages-spec.md), админка — [../admin-panel/static-pages-urban-gardener.md](../admin-panel/static-pages-urban-gardener.md) |
| D35 | Уточнения Фазы 5 при исполнении (агент, на правку владельцу): пустой/неверный e-mail в настройках → адрес по умолчанию (токен на странице не остаётся); ссылки в футере и юр-текстах — только `/путь`, `https://…`, `mailto:…` без пробелов и `\` (иначе `/\evil` читается браузером как `//evil`), проверка продублирована в БД (CHECK) и в админке; плохая ссылка в футере → встроенный футер + причина в логе (админка не даст сохранить); ссылки в юр-текстах подчёркнуты и помечены «(opens in a new tab)» для скринридера; невидимый h2 «What we stand for» над карточками About; фото About без alt считается декоративным (в админке alt обязателен для своего фото); Terms **не** заявляют участие в Amazon Associates (статус не подтверждён) — формулировка общая; «Last updated» на Privacy/Terms берётся из `pages.updated_at`, вручную не вводится; обновление синглтонов в RPC — с `where true` (у роли `authenticator` PostgREST включён `safeupdate`) |
| D36 | Шапка сайта редактируется в админке (решение владельца 2026-10-17, добавлено в Фазу 5): **Header brand** (надпись рядом с логотипом) и **меню** (1–6 пунктов), Pages → Site settings → Header, миграция 0021. **Название сайта «Urban Gardener» — не меняется и остаётся в коде** (подвал, ©, суффикс заголовков вкладок); «Urban Soul of Plants» — слоган/надпись в шапке и в текстах. Подсветка раздела: свой адрес + вложенные; «темы → Articles», «товар → Shop» — встроенные для стандартных адресов. Поиск и иконки соцсетей — вне блока (соцсети — в Site settings, поиск — Фаза 6) |
| D37 | Поиск (Фаза 6, решения владельца S1–S3 2026-10-17 + уточнения агента): ищем по названиям/подзаголовкам/анонсам/темам/уровню статей и названиям/описаниям/брендам/категориям товаров, **без** полного текста статей (S1); опечатки терпим через `pg_trgm` (S2); темы и категории отдельной группой не показываем (S3). Панель в шапке (до 4+4, «See all N results», combobox по ARIA) и динамическая `/search` (до 24+24, `noindex, follow`, не в sitemap); шапка адрес не читает (`searchParams` — только на странице). Уточнения агента: опечатки — только для слов от 5 букв и сходства ≥ 0.42, только по именным полям (иначе шум); потолок 6 слов; Enter на запросе короче 2 символов ведёт на `/search` с подсказкой; «Try again» на странице ошибки теперь `unstable_retry` (раньше `reset` не перезапрашивал данные); поиск — только опубликованное (в функции БД и во второй выборке карточек) |
| D32 | Уточнения Фазы 4 при исполнении (агент, на правку владельцу): стартовый журнал — 6 референсных статей, а не «6 самых свежих» (самая свежая — тестовая «Test Article»); фото «статьи недели» без `preload` (оно ниже первого экрана, LCP главной — заголовок; вернуть, если замеры Фазы 8 скажут иное); неполный слот Save не блокирует (жёлтая подсказка), статья не повторяется между featured и journal; удаление статьи/товара со слотом — предупреждение в диалоге, не запрет |

## 3. Инвентарь страниц (объём, не спека)

Что есть в референсе. Детали, маршруты и данные каждой страницы фиксируются в спеке её среза.

| Страница | В референсе | Источник данных (предв.) |
|---|---|---|
| Home | hero + pills тем, «This week's read» (featured), «From the journal» (6 статей), «Plants & everything they need» (3 товара), newsletter-блок | статьи, товары, настройки главной |
| Articles | листинг + пилюли тем и уровней (фильтр уровня клиентский), счётчик; `/topics/[slug]` — страница темы. **Построено (Фаза 2).** Newsletter-блок — Фаза 7 | статьи, темы, уровни |
| Article | хлебные крошки, шапка (тема · уровень, заголовок, подзаголовок, автор), обложка, тело-блоки, пилюли тем и уровня, share-bar, «Keep reading». **Построено (Фаза 2)** | статья, автор, блоки |
| Shop | листинг + фильтры, newsletter-блок | товары, категории, бейджи |
| Product | крошки, фото, бейдж, цена, описание, «Find on Amazon», «Related items» (в CSS есть spec-list: свет/вода/размер/pet — в референсе не выводится) | товар |
| About | история, 3 ценности, newsletter-блок (в CSS есть «team», в разметке нет) | страница (`pages`), authors |
| Contact | способы связи, соцсети, **форма** (name, email, subject, message) | контакты — страница; форма — только фронт-скелет (D9) |
| Search | выпадающая панель с живыми результатами + страница результатов (статьи + товары) | БД |
| Privacy / Terms | текстовые страницы (в референсе «sample») | `pages.body` |
| Сквозное | шапка (pill-навигация, поиск, соцсети, мобильное меню), футер (4 колонки), newsletter-попап (на 2-м переходе), reveal-анимации, 404 | настройки сайта |
| Служебное (после основных) | cookie-баннер, GA4, sitemap/robots, SEO-метаданные/JSON-LD, preview-роуты | — |

**Расхождения референса, которые надо снять при переносе:**
- «No affiliate-driven recommendations» на About vs «Find on Amazon» на товарах → добавить affiliate-disclosure, переписать абзац.
- «Privacy-friendly analytics» в Privacy → привести к реальности (GA4 за согласием, [overview.md](overview.md)).
- Счётчик «52,000 plant lovers» и «team» — выдуманные данные прототипа, не переносить как факт.
- Несколько полей статьи (`lvl`, `tag`, `cat`) пересекаются → §4.

## 4. Открытые вопросы (решаем в срезе, не раньше)

1. ~~**Таксономия статей**~~ — **решено 2026-10-15** (D17/D18): Topic + Level, `cat`/`tag` не переносятся.
2. **Сущность «Растение»** (профиль ухода: свет, вода, размер, pet-safe), на которую ссылаются статьи и товары — отложено; пока `light/water/size/pet` рассматриваются как поля товара.
3. **Категории товаров vs бейджи**: список категорий, как они соотносятся с фильтрами Shop («Easy care», «Low light», «Pet-friendly», «Statement»).
4. **Маршруты**: статьи — решено (D19: `/articles`, `/articles/[slug]`, `/topics/[slug]`); остаются `/shop` и `/product/[slug]` (Фаза 3).
5. **Домен** → `NEXT_PUBLIC_SITE_URL`, `frontendUrl` в `sites.ts`, Turnstile-хостнеймы, e-mail контактов ([overview.md](overview.md) «Прод-адрес…»).
6. **Юридические тексты** Privacy/Terms — черновик пишет агент, финальную версию утверждает владелец.
7. **Разделы админки** и их порядок — определяются по срезам (D13).

## 5. Дизайн-система (из референса)

Перенос 1:1 в `app/globals.css`; никаких захардкоженных цветов — только токены.

- **Цвета:** `--paper #f4efe4`, `--paper-2 #ece3d2`, `--cream #fbf8f0`, `--ink #23291f`, `--ink-soft #5a614f`, `--ink-body #2c3327` (тело статьи), `--moss #2f4a2c`, `--leaf #4d7c3f`, `--clay #bd5b32`, `--clay-soft #d98b5f`, `--clay-strong #a84e28` (фон primary-кнопки, AA), `--clay-text #9c4423` (мелкий clay-текст, AA), `--line #ddd3bd`, `--tip-text #d9e2cf` (текст на moss), `--header-bg rgba(244,239,228,.82)`. Градиенты листа hero: `--leaf-front-from/to #3f7d33→#9fd567`, `--leaf-back-from/to #26391f→#4c8636`. Hex — только в `:root` (`app/globals.css`); стенд `/design` и тест `app/design/palette.test.ts` следят, чтобы подписи не разъехались.
- **Производные токены (Фаза 1):** радиусы `--radius-sm 10 / -md 12 / -card 16 / -lg 22 / -pill 40`; тени `--shadow-card`, `--shadow-nav`, `--shadow-menu`, `--shadow-panel` (лёгкая, панель поиска), `--shadow-step`/`-step-hover` («ступенька» primary-кнопки); каркас `--wrap 1240`, `--narrow 760`, `--gutter 32→20 (≤640)`, `--header-h 81px`; `--ease`, `--focus-ring`.
- **Шрифт:** системный SF-стек (без веб-шрифтов и без self-hosted woff2): `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`. Заголовки 600, letter-spacing −.03…−.045em; body 400, lh 1.6, ls −.011em.
- **Каркас:** контейнер `.wrap` 1240 / `.narrow` 760, паддинг 32 (20 на мобильном); sticky-шапка с blur; pill-навигация; зерно-оверлей `body::before` (SVG feTurbulence, opacity .035, multiply).
- **Компоненты:** карточка статьи (16px, hover −6px), карточка товара, pill/фильтр, tag, callout, figure, tip-блок (moss, newsletter), кнопки `btn-primary` (clay + «ступенька» moss), `find-btn`, newsletter-модалка, search-панель.
- **Брейкпоинты:** 920 / 860 (мобильная навигация) / 640.
- **Анимации:** `reveal` (opacity+translateY, stagger 70 мс, максимум 700 мс), `fade` при смене страницы, hover-подъёмы. Реализуем на CSS + IntersectionObserver (без GSAP), уважаем `prefers-reduced-motion`.
- ⚠️ `body { overflow-x: clip }`, не `hidden` — иначе ломается sticky-шапка (урок Avocado).
- **Картинки:** референс использует внешние Unsplash-URL; в проде — относительные ключи бакета или внешние URL по контракту [../database/schema.md](../database/schema.md) §4.

## 6. Целевая архитектура (черновик, уточняется по срезам)

```
urban.gardener/
  app/            # thin page.tsx: загрузка данных + композиция
  components/     # компонент = файл + CSS Module
  lib/            # весь доступ к данным (SQL не в компонентах), lib/supabase/
  supabase/migrations/   # единственный источник схемы urban_gardener
  mockups/        # Urban Gardener.html — референс, не деплоится
  e2e/ vitest.*   # тесты по methodology/testing.md
```

Админка: запись в `web.admin/src/config/sites.ts` (`slug: urban-gardener`, `sections` —
дописывается по мере готовности разделов, как у Avocado). Контент-операции
через коннектор — отдельный скилл `urban-gardener-content-ops` **после** запуска
(по образцу [../skills/README.md](../skills/README.md)).

## 7. Разделы админки (предварительный объём)

Media · Articles (+ Topics, Levels, Authors — **построены в Фазе 2D**, контракт: [../admin-panel/articles-urban-gardener.md](../admin-panel/articles-urban-gardener.md)) · Products (+ Categories) · Pages (Home, About, Privacy, Terms, SEO) · Subscribers. (Messages — только если решим подключить Contact-форму, D9.) Каждый раздел строится в
своём срезе после фронта на тестовой структуре (D13); порядок — в roadmap.
