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
| 2 | Срез **Articles**: листинг, статья, авторы, темы | Articles, Authors, Topics | [x] принято 2026-10-16 |
| 3 | Срез **Shop**: каталог, товар, категории, бренды | Products, Categories, Brands | [x] принято 2026-10-16 |
| 4 | **Home** (сборка из статей и товаров) | Pages → Homepage | [ ] план утверждён 2026-10-16, код не начат ([план](2026-10-16-phase-4-home.md)) |
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

**Детальный план:** [2026-10-15-phase-2-articles.md](2026-10-15-phase-2-articles.md) (**утверждён 2026-10-15**; старт 2A — по команде владельца).
Решения владельца 2026-10-15: Topic (несколько на статью) + Level (одна); маршруты `/articles`, `/articles/[slug]`, `/topics/[slug]`; у каждой таксономии есть фильтр; `cat`/`tag` не отдельные таксономии; контент — из референса. Загрузчики — `lib/articles.ts` (вместо `lib/content.ts`).

- [x] 2A Фронт на тестовых данных: Articles (листинг + фильтр тем), Article (шапка, обложка, блоки text/callout/figure/list, теги, share, «Keep reading»), loading-скелетоны
- [x] 2B Миграции (0001–0004 применены; ⚠️ Exposed schemas — ручной шаг владельца): схема `urban_gardener`, гранты по шаблону 0017 cozycorner, бакет `urban-gardener-photos` (шаблон 0018), RLS, сид из референса (9 статей); схему добавить в **Exposed schemas** (дашборд Supabase)
- [~] 2C Фронт на БД (код и тесты готовы; сборку на живой БД проверить после Exposed schemas): `lib/content.ts`, ISR, `generateStaticParams`, 404
- [x] 2D Админка (построена 2026-10-15, контракт — admin-panel/articles-urban-gardener.md): запись в `sites.ts` (`sections`), Media, Authors, Topics, Articles (редактор блоков — по [blog-avocado-kiss.md](../../../admin-panel/blog-avocado-kiss.md)); док раздела в `admin-panel/`
- [~] 2E Тесты (unit/компонентные готовы; e2e написаны, прогон — после Exposed schemas): unit (мапперы/резолвер картинок), компонентные, e2e «листинг → статья»
- [ ] 2F Ручная проверка

> Статус: **принята владельцем 2026-10-15** (проверено на проде: сайт, фильтры, админка, публикация статьи из админки). Отчёт — в конце [плана Фазы 2](2026-10-15-phase-2-articles.md).

**Ручная проверка:** создать/отредактировать статью в админке → через ≤1 мин видна
на сайте; фильтр тем; все типы блоков; мобильная вёрстка статьи; автор и обложка.

---

## Фаза 3 — Срез Shop

**Детальный план:** [2026-10-15-phase-3-shop.md](2026-10-15-phase-3-shop.md) (**УТВЕРЖДЁН владельцем 2026-10-16**; спека — [../specs/2026-10-16-phase-3-shop-spec.md](../specs/2026-10-16-phase-3-shop-spec.md); решения: структура как у CozyCorner — категории (бывшие бейджи) + бренды, фильтры Brand/Price, цена числом с валютой, шапка без фото-баннера; запуск — фразой «Начинаем фазу 3»).

**Перед началом:** решить категории товаров vs бейджи, судьбу `light/water/size/pet`,
affiliate-disclosure. Откладывается сущность «Растение» (urban-gardener.md §4).

- [ ] 3A Фронт на тестовых данных: хаб `/shop` (карточки категорий), категория (фильтры Brand/Price, бесконечная сетка), Product (+spec-list, «Find on Amazon», Related items)
- [ ] 3B Миграции: `products`, `shop_categories` (M2M), `brands`, RPC `save_product`; сид (9 товаров, 4 категории)
- [ ] 3C Фронт на БД
- [ ] 3D Админка: Products, Categories, Brands (по образцу CozyCorner; спека — на утверждение до кода)
- [ ] 3E Тесты, 3F ручная проверка (внешние ссылки `rel`, фильтры, пустые состояния)

---

## Фаза 4 — Home

> План для владельца — [2026-10-16-phase-4-home.md](2026-10-16-phase-4-home.md); спека — [../specs/2026-10-16-phase-4-home-spec.md](../specs/2026-10-16-phase-4-home-spec.md). Статус: **принята 2026-10-16** (+ правка: иллюстрация hero из админки, D33); ветки `feat/home` в `urban.gardener` и `web.admin` не запушены — ждут выбора способа завершения.

- [x] 4A Фронт: hero с листом, pills тем, «This week's read», «From the journal», блок магазина, tip-блок (newsletter — заглушка до фазы 6)
- [x] 4B Курирование — ручные слоты `home_slots` (решение H1); миграции 0012–0015, сид по референсу, RPC `save_home_page`
- [x] 4C Сайт читает БД (ISR 60 с; черновик/скрытая карточка не показываются)
- [x] 4D Админка Pages → Homepage ([home-urban-gardener.md](../../../admin-panel/home-urban-gardener.md)): тексты hero/SEO + три слота, один Save, предупреждение при удалении статьи/товара
- [x] 4E Тесты (сайт: unit/компонентные/e2e; админка: unit/компонентные)
- [x] 4F Ревью-гейт (db, silent-failure, react, a11y, seo — оба репо; typescript-reviewer — см. отчёт) и документация
- [x] Приёмка владельцем 2026-10-16 (живую проверку админки владелец провёл сам)

---

## Фаза 5 — About, Privacy, Terms и настройки сайта

> План для владельца — [2026-10-16-phase-5-static-pages.md](2026-10-16-phase-5-static-pages.md); спека — [../specs/2026-10-16-phase-5-static-pages-spec.md](../specs/2026-10-16-phase-5-static-pages-spec.md). Статус: **принята владельцем 2026-10-17**; код на ветках `feat/static-pages` обоих репо, не слит и не запушен (ждём команду владельца).

- [x] 5A Фронт: About (по референсу), Privacy, Terms (markdown), футер/соцсети/оговорки на пропсах — на тестовых данных
- [x] 5B БД (0017–0020 применены): `pages.body`, `about_content`, `site_settings`, RPC `save_about_page`/`save_site_settings`, сид (тексты Privacy/Terms — адаптация Cozy/Avocado)
- [x] 5C Сайт читает БД (ISR 60, layout с `revalidate`), фолбэки на код
- [x] 5D Админка Pages ([static-pages-urban-gardener.md](../../../admin-panel/static-pages-urban-gardener.md)): About, Privacy, Terms, Site settings (описание экранов → «утверждаю»)
- [x] 5E Тесты, 5F ревью-гейт и документация
- [x] Приёмка владельцем 2026-10-17 (чек-лист плана §6; добавлено при приёмке: шапка сайта и шапка Privacy/Terms)

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

## Фаза X — Итоговая проверка проекта (перед запуском)

**Решение владельца 2026-10-16:** после последней функциональной фазы (8) и **до** запуска агент заново проходит весь проект с тестами — **строго по решениям, принятым по ходу проекта**
(журнал решений [urban-gardener.md](../../urban-gardener.md) §2, отчёты и чек-листы принятых фаз). Правила Фазы X — [мета-скилл](../../../skills/meta/meta-planning/SKILL.md) §7.
Накопительный список проверок (дописывается при приёмке каждой фазы): [phase-x-checklist.md](phase-x-checklist.md).

- [ ] X.1 Аудит решений: по каждому пункту журнала D1…Dn и чек-листа — «как проверено → итог» (таблица в отчёте)
- [ ] X.2 Прогон всего: unit/компонентные и e2e во всех репозиториях (`urban.gardener`, `web.admin`), `build`, `lint`, типы
- [ ] X.3 База данных: права под ролями (anon / не-админ / админ), RLS, функции RPC, `get_advisors`; сид и живой контент не расходятся с кодом
- [ ] X.4 Ревьюеры по всему коду (db, react, typescript, silent-failure, a11y, seo), мобильная/десктопная ширина, 404 и пустые состояния
- [ ] X.5 Предзапусковые пункты контента: реальные партнёрские ссылки, тексты About/Privacy/Terms, тестовые данные удалены, соцссылки, noindex снимается только в Фазе 9
- [ ] X.6 Отчёт владельцу (шаблон мета-скилла §8); расхождения исправляются до запуска, спорные — опросником

**Приёмка:** владелец пишет «принято» по отчёту — только после этого Фаза 9.

---

## Фаза 9 — Запуск

- [ ] 9.0 Удалить/закрыть стенд `/design` (временный, публичный noindex)
- [ ] 9.1 Домен (когда определён): Vercel Domains, `NEXT_PUBLIC_SITE_URL`, `frontendUrl` в `sites.ts`, Turnstile-хостнеймы, e-mail контактов
- [ ] 9.2 Финальные тексты (Privacy/Terms, About, контакты, соцссылки вместо `instagram.com` и т.п.)
- [ ] 9.3 Lighthouse на боевом домене (прогон build/lint/test/e2e, a11y, 404, мобильные — уже в Фазе X)
- [ ] 9.4 Sitemap в Google Search Console (вручную), GA4
- [ ] 9.5 Документация: финальный `sites/urban-gardener.md`, `database/schema.md` (раздел urban_gardener), `admin-panel/status.md`, скилл `urban-gardener-content-ops`

---

## После запуска (бэклог, не в объёме)

- Сущность «Растение» с профилем ухода и связями со статьями/товарами
- Реальный ESP для рассылки (сейчас — только сбор адресов)
- Комментарии, RSS, мультиязычность — не планировались
