# Urban Gardener — этапный план (roadmap)

> Last updated: 2026-10-14 | Контекст и решения — [../../urban-gardener.md](../../urban-gardener.md)
> Детальный план Фазы 1 (черновик на обсуждение): [2026-10-15-phase-1-design-system.md](2026-10-15-phase-1-design-system.md).
> Это **верхнеуровневый** план. Детальный пошаговый план (файлы, команды, код)
> пишется для каждой фазы отдельным файлом `YYYY-MM-DD-<фаза>.md` в этой папке,
> когда до неё доходим — по образцу `../../avocado-kiss/plans/`.

## Правила работы

1. **Одна фаза за раз.** Перед фазой — коротко проектируем её данные и маршруты
   (спека в `../specs/`), потом план, потом код. Следующая фаза не начинается,
   пока владелец не написал «принято» по ручной проверке текущей.
2. **Вертикальный срез** (для фаз с контентом): `A` фронт на тестовых данных в
   коде → `B` миграция БД + сид → `C` фронт переключён на БД → `D` раздел
   админки → `E` тесты → `F` ручная проверка владельцем.
3. Контракты репо те же, что у Avocado: токены вместо хардкода, RSC по умолчанию,
   ISR `revalidate = 60`, без `force-cache`, картинки только через резолвер
   пути, новая таблица → явный `revoke` от `anon` где надо (память
   «newsletter subscribe»), перед кодом на API Next 16 / React 19 — сверка
   с `node_modules/next/dist/docs/` и Context7.
4. Перед «готово» каждой фазы: `npm run build`, `npm run lint`, `npm test`.
5. Коммит и пуш — только по явной команде владельца.
6. **Ревью-гейт и скиллы** (подмножество ECC, [../../../skills/ecc/README.md](../../../skills/ecc/README.md)): перед работой над фазой загрузить скиллы из таблицы «Скиллы и агенты по фазам»; после реализации и **до** просьбы о приёмке — запустить ревьюеров (react/typescript/a11y/database/silent-failure/seo по ситуации), CRITICAL/HIGH исправить или вынести владельцу, результат — в отчёт фазы.
7. Статусы ниже обновляются по ходу: `[ ]` не начато, `[~]` в работе, `[x]` принято владельцем.

## Сводка

| Фаза | Что | Админка | Статус |
|---|---|---|---|
| 0 | Фундамент: репо, Vercel, скаффолд, реестр, тесты | — | [x] принято 2026-10-15 |
| 1 | Дизайн-система и каркас (шапка, футер, токены, reveal) | — | [x] принято 2026-10-15 |
| 2 | Срез **Articles**: листинг, статья, авторы, темы | Articles, Authors, Topics | [ ] |
| 3 | Срез **Shop**: каталог, товар, категории, бейджи | Products, Categories | [ ] |
| 4 | **Home** (сборка из статей и товаров) | Pages → Homepage | [ ] |
| 5 | Статичные страницы: About, Privacy, Terms | Pages | [ ] |
| 6 | **Newsletter** + **Contact** (форма — только скелет) | Subscribers | [ ] |
| 7 | **Search** по реальной БД | — | [ ] |
| 8 | SEO, cookie-баннер, GA4, sitemap/robots, **Preview** | — | [ ] |
| 9 | Запуск: домен, финальные тексты, чек-лист | — | [ ] |

Media (бакет `urban-gardener-photos`, менеджер фото) подключается в админке на
фазе 2 — первым, потому что обложки нужны уже статьям.

---

## Скиллы и агенты по фазам

Имена — из `platform-docs/skills/ecc/` (приоритет всегда у `AGENTS.md`, спек и скилла `testing`). Колонка «Скиллы» — загрузить перед работой, «Ревью» — запустить перед приёмкой.

| Фаза | Скиллы | Ревью |
|---|---|---|
| 0 Фундамент | — | — |
| 1 Дизайн-система и каркас | `frontend-a11y`, `react-patterns`, `testing`, `react-testing` | `a11y-architect`, `react-reviewer`, `typescript-reviewer` |
| 2 Articles | `react-patterns`, `react-performance`, `postgres-patterns`, `database-migrations`, `frontend-a11y` | `database-reviewer` (миграции), `react-reviewer`, `typescript-reviewer`, `silent-failure-hunter` (`lib/content.ts`) |
| 3 Shop | те же + `seo` (JSON-LD Product) | `database-reviewer`, `react-reviewer`, `typescript-reviewer`, `silent-failure-hunter` |
| 4 Home | `react-performance` (waterfalls: параллельные запросы) | `react-reviewer`, `typescript-reviewer` |
| 5 About / Privacy / Terms | `seo` | `seo-specialist`, `react-reviewer` |
| 6 Newsletter / Contact | `frontend-a11y` (формы), `react-testing`, `e2e-testing`, `database-migrations` | `a11y-architect`, `database-reviewer` (`subscribers`), `silent-failure-hunter` (`/api/newsletter`), `typescript-reviewer` |
| 7 Search | `postgres-patterns` (GIN/FTS vs ILIKE), `react-performance`, `frontend-a11y` (combobox-поиск) | `database-reviewer`, `a11y-architect`, `silent-failure-hunter`, `react-reviewer` |
| 8 SEO / consent / GA / Preview | `seo`, `database-migrations` (токен превью) | `seo-specialist`, `database-reviewer`, `typescript-reviewer` |
| 9 Запуск | `seo`, `react-performance`, `frontend-a11y` | `seo-specialist`, `a11y-architect` (финальный проход), `react-reviewer` |

Админка (`web.admin`, Vite + React) в каждом срезе: `react-patterns`, `frontend-a11y`, `react-testing` + ревью `react-reviewer`/`typescript-reviewer`.

---

## Фаза 0 — Фундамент

**Цель:** пустой, но живой сайт на временном `*.vercel.app`, подключённый ко всем
инструментам; репо готово к разработке и тестированию.

- [x] 0.1 Vercel CLI залогинен, `vercel whoami` показывает нужный аккаунт/team
- [x] 0.2 Пустой репозиторий `urban-gardener` на GitHub под `eugeniuszlipko` (создаёт владелец, без README); локально `urban.gardener/` → `git init -b main`, remote через SSH-алиас `github-avocado` ([github-account-per-repo.md](../../../methodology/github-account-per-repo.md))
- [x] 0.3 Референс переносится в `urban.gardener/mockups/Urban Gardener.html`
- [x] 0.4 Скаффолд Next.js 16 (по образцу `avocado.kiss`: `tsconfig`, `eslint`, `.gitignore`, `AGENTS.md`/`CLAUDE.md` репо), `app/layout.tsx`, заглушка главной
- [x] 0.5 Тест-инфраструктура по [testing.md](../../../methodology/testing.md) «Добавление нового проекта» (Vitest, RTL, Playwright на 3200, скрипты `test*`, baseline-тесты)
- [x] 0.6 Реестр: строка в корневом `AGENTS.md`, `platform-docs/AGENTS.md`, `sites/overview.md`
- [x] 0.7 Vercel-проект `urban-gardener` (team `cozy-corner`, Hobby) создан и привязан к репо (`vercel link` + `vercel git connect`). ⚠️ `vercel git connect` не понимает SSH-алиас remote: на момент вызова временно ставить https-URL remote, потом вернуть `git@github-avocado:…`. Env `NEXT_PUBLIC_SITE_URL` — после первого деплоя (когда известен URL)
- [x] 0.8 Первый пуш в `main` (2026-10-15) → автодеплой заглушки: https://urban-gardener.vercel.app (Ready, 26 с). `NEXT_PUBLIC_SITE_URL` (production) = этот URL

**Статус 2026-10-15:** 0.1–0.7 выполнены (build/lint/test/e2e зелёные локально). 0.8 выполнен. **Фаза 0 принята владельцем 2026-10-15.**

**Следующий шаг — Фаза 2** (срез Articles): перед кодом подтвердить таксономию статей (Topic + Level), решить маршруты фильтра и написать план `2026-..-phase-2-articles.md` в этой папке.

**Ручная проверка:** временный URL открывается и показывает заглушку; `npm run dev`,
`npm run build`, `npm run lint`, `npm test` зелёные; пуш в `main` вызывает деплой.

---

## Фаза 1 — Дизайн-система и каркас

**Цель:** общая оболочка сайта, визуально совпадающая с референсом.

- [x] 1.1 `globals.css`: токены, сброс, зерно-оверлей, `overflow-x: clip`, SF-стек
- [x] 1.2 Header: бренд-лого (SVG-лист), pill-навигация (Home/Articles/Shop/About), соцсети, кнопка Search (оболочка), мобильное меню (≤860), skip-link
- [x] 1.3 Footer: 4 колонки, нижняя строка, юр-ссылки
- [x] 1.4 Примитивы: Pill/Tag/Eyebrow, ButtonLink (primary/ghost/find), SectionHead, Breadcrumb, Callout, TipBlock, PageHead, `Reveal` (IntersectionObserver, reduced-motion), `Skeleton`, fade при смене страницы (`app/template.tsx`). Карточки статей/товаров — в срезах Фаз 2–3
- [x] 1.5 Страница-стенд `/design` (не `/_design` — `_` = private folder в Next, не маршрутизируется; не в sitemap, noindex). **Фаза 9: удалить или закрыть `/design`**
- [x] 1.6 Тесты: компонентные (Vitest) + `e2e/shell.spec.ts`; страницы Coming soon на `/articles /shop /about /contact /privacy /terms` (временные — заменят Фазы 2–6)

> Статус: **принято владельцем 2026-10-15.** Детали и отчёт — план фазы `2026-10-15-phase-1-design-system.md`.

**Ручная проверка:** стенд рядом с референсом на ширинах 1440 / 900 / 390: шрифт,
цвета, отступы, hover, мобильное меню, поведение sticky-шапки при скролле.

---

## Фаза 2 — Срез Articles

**Перед началом:** подтвердить таксономию (Topic + Level), решить маршруты фильтра,
спроектировать таблицы (`authors`, `topics`, `articles`, блоки тела, связь с темами) — спека фазы.

- [ ] 2A Фронт на тестовых данных: Articles (листинг + фильтр тем), Article (шапка, обложка, блоки text/callout/figure/list, теги, share, «Keep reading»), loading-скелетоны
- [ ] 2B Миграции: схема `urban_gardener`, гранты по шаблону 0017 cozycorner, бакет `urban-gardener-photos` (шаблон 0018), RLS, сид из референса (9 статей); схему добавить в **Exposed schemas** (дашборд Supabase)
- [ ] 2C Фронт на БД: `lib/content.ts`, ISR, `generateStaticParams`, 404
- [ ] 2D Админка: запись в `sites.ts` (`sections`), Media, Authors, Topics, Articles (редактор блоков — по [blog-avocado-kiss.md](../../../admin-panel/blog-avocado-kiss.md)); док раздела в `admin-panel/`
- [ ] 2E Тесты: unit (мапперы/резолвер картинок), компонентные, e2e «листинг → статья»
- [ ] 2F Ручная проверка

**Ручная проверка:** создать/отредактировать статью в админке → через ≤1 мин видна
на сайте; фильтр тем; все типы блоков; мобильная вёрстка статьи; автор и обложка.

---

## Фаза 3 — Срез Shop

**Перед началом:** решить категории товаров vs бейджи, судьбу `light/water/size/pet`,
affiliate-disclosure. Откладывается сущность «Растение» (urban-gardener.md §4).

- [ ] 3A Фронт на тестовых данных: Shop (листинг + фильтры), Product (+spec-list, «Find on Amazon», Related items)
- [ ] 3B Миграции: `products`, категории, бейджи, связи; сид (9 товаров)
- [ ] 3C Фронт на БД
- [ ] 3D Админка: Products, Categories (по [products.md](../../../admin-panel/products.md))
- [ ] 3E Тесты, 3F ручная проверка (внешние ссылки `rel`, фильтры, пустые состояния)

---

## Фаза 4 — Home

- [ ] 4A Фронт: hero с листом, pills тем, «This week's read», «From the journal», блок магазина, tip-блок (newsletter — заглушка до фазы 6)
- [ ] 4B Как курируется главная (featured статья, набор товаров) — решить: автоматически по дате/флагу или слоты `home_slots` как у Avocado
- [ ] 4C БД и админка (Pages → Homepage), тесты, ручная проверка

---

## Фаза 5 — About, Privacy, Terms

- [ ] 5A Фронт: About (история, ценности), Privacy, Terms
- [ ] 5B Тексты: правки под Urban Gardener, убрать несоответствия (affiliate, аналитика), черновик юр-текстов
- [ ] 5C `pages` (тело markdown) + админка Pages ([pages.md](../../../admin-panel/pages.md)), тесты, ручная проверка

---

## Фаза 6 — Newsletter и Contact (скелет)

- [ ] 6A Newsletter: порт `/api/newsletter` + Turnstile + таблица `subscribers` (revoke от anon), блоки на страницах, попап на втором переходе (с хранением «уже показан»)
- [ ] 6B Contact: страница с формой (name, email, subject, message) — **только фронт-скелет**: валидация на клиенте, состояния, без отправки (нет API-роута, БД, Messages). Подключение — отдельное решение владельца (решение 2026-10-15)
- [ ] 6C Админка: Subscribers ([subscribers.md](../../../admin-panel/subscribers.md))
- [ ] 6D Тесты, ручная проверка (реальная подписка, дубль e-mail, невалидные данные; форма Contact — состояния без отправки)

> Turnstile на `*.vercel.app` и localhost — см. память «avocado turnstile localhost»: тестовые ключи или добавить хостнейм.

---

## Фаза 7 — Search

- [ ] 7A Дизайн поиска: выпадающая панель (топ-4 статьи + топ-4 товара) + страница результатов `/search`
- [ ] 7B Запрос по БД (где искать, как ранжировать, ILIKE vs full-text — решить в спеке фазы)
- [ ] 7C Тесты, ручная проверка (пустой результат, спецсимволы, мобильная панель)

---

## Фаза 8 — SEO, согласие, аналитика, Preview

- [ ] 8A Метаданные страниц, OG, JSON-LD (Article, Product), `sitemap.ts` (`revalidate = 60`), `robots.ts`, canonical
- [ ] 8B `CookieConsent` + `consent.ts` + `GoogleAnalytics` (порт из cozycorner; GA-id позже), обновить Privacy
- [ ] 8C Preview черновиков по токену (`/preview/articles/[slug]`; миграция токена с column-grant по памяти «preview tokens»)
- [ ] 8D Тесты, ручная проверка

---

## Фаза 9 — Запуск

- [ ] 9.0 Удалить/закрыть стенд `/design` (временный, публичный noindex)
- [ ] 9.1 Домен (когда определён): Vercel Domains, `NEXT_PUBLIC_SITE_URL`, `frontendUrl` в `sites.ts`, Turnstile-хостнеймы, e-mail контактов
- [ ] 9.2 Финальные тексты (Privacy/Terms, About, контакты, соцссылки вместо `instagram.com` и т.п.)
- [ ] 9.3 Сквозной чек-лист: build/lint/test/e2e, Lighthouse, a11y-проход, 404, мобильные
- [ ] 9.4 Sitemap в Google Search Console (вручную), GA4
- [ ] 9.5 Документация: финальный `sites/urban-gardener.md`, `database/schema.md` (раздел urban_gardener), `admin-panel/status.md`, скилл `urban-gardener-content-ops`

---

## После запуска (бэклог, не в объёме)

- Сущность «Растение» с профилем ухода и связями со статьями/товарами
- Реальный ESP для рассылки (сейчас — только сбор адресов)
- Комментарии, RSS, мультиязычность — не планировались
