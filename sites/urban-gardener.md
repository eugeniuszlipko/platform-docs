# Urban Gardener — архитектура и решения сайта

> Last updated: 2026-10-14 | Source: референс `urban.gardener/Urban Gardener.html`
> (статичный HTML-прототип) + решения владельца от 2026-10-14. Статус: **Фазы 0 и 1
> приняты (2026-10-15); дальше Фаза 2 (Articles).** Этапный план — [urban-gardener/plans/2026-10-14-urban-gardener-roadmap.md](urban-gardener/plans/2026-10-14-urban-gardener-roadmap.md).

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
| Env (production) | `NEXT_PUBLIC_SITE_URL` = временный URL (код пока не читает) |
| Индексация | `robots: noindex` в `app/layout.tsx` — **снять в Фазе 9** |
| Supabase | проект base-one; схема/бакет ещё не созданы (Фаза 2) |
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
| D20 | Начальный контент — 10 статей референса (featured + 9 карточек; полный текст есть только у featured). План — [urban-gardener/plans/2026-10-15-phase-2-articles.md](urban-gardener/plans/2026-10-15-phase-2-articles.md) |

## 3. Инвентарь страниц (объём, не спека)

Что есть в референсе. Детали, маршруты и данные каждой страницы фиксируются в спеке её среза.

| Страница | В референсе | Источник данных (предв.) |
|---|---|---|
| Home | hero + pills тем, «This week's read» (featured), «From the journal» (6 статей), «Plants & everything they need» (3 товара), newsletter-блок | статьи, товары, настройки главной |
| Articles | листинг + фильтр-pills по темам, newsletter-блок | статьи |
| Article | хлебные крошки, шапка (тег, заголовок, подзаголовок, автор), обложка, тело-блоки, теги, share-bar, «Keep reading» | статья, автор, блоки |
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

Media · Articles (+ Topics, Authors) · Products (+ Categories) · Pages (Home, About, Privacy, Terms, SEO) · Subscribers. (Messages — только если решим подключить Contact-форму, D9.) Каждый раздел строится в
своём срезе после фронта на тестовой структуре (D13); порядок — в roadmap.
