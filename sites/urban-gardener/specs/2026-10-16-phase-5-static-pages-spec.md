# Urban Gardener — Фаза 5 (About, Privacy, Terms, Site settings): спека для агента

> Адресат — исполняющий агент. План для владельца — [../plans/2026-10-16-phase-5-static-pages.md](../plans/2026-10-16-phase-5-static-pages.md). Решения владельца 2026-10-16 (ниже) приоритетнее всего, что было раньше.
> Рабочие директории: `urban.gardener/` (сайт, миграции), `web.admin/` (5D). Референс UI: `urban.gardener/mockups/Urban Gardener.html` (`#page-about` ~638–678, `#page-privacy` ~772, `#page-terms` ~802; CSS `.about-grid`, `.values`, `.value`, `.article-body`).
> **Образцы:** Avocado — `about_content` (singleton «колонка на поле»), `site_settings`, `footer_settings` ([schema.md](../../../database/schema.md) §about_content/site_settings/footer_settings; админка `AvocadoAboutEditor`, `AvocadoFooterEditPage`); Cozy — `pages.body` (markdown) + `LegalArticle` + `MarkdownText` (`cozycorner/app/privacy/page.tsx`, [pages.md](../../../admin-panel/pages.md) §1); Urban Фаза 4 — `pages`, RPC `save_home_page`, `UgHomePage` ([home-urban-gardener.md](../../../admin-panel/home-urban-gardener.md)).

## Решения владельца (журнал; приняты 2026-10-16)

| # | Решение |
|---|---|
| P1 | Текст About — **как в референсе** (включая «since 2017», «small team», «52,000 plant lovers», «No affiliate-driven recommendations»); всё правится в админке. Фразу про affiliate **не переписываем** (решение владельца; риск — в плане §5, пункт в чек-листе запуска) |
| P2 | About правится **структурными полями** (как Avocado `about_content`): eyebrow, заголовок, вводный текст, фото истории, заголовок истории + 2 абзаца, 3 карточки ценностей (иконка/заголовок/текст), заголовок и текст блока рассылки |
| P3 | Privacy и Terms — **адаптация текстов Cozy/Avocado** под Urban (plain English, GDPR, cookie-согласие), описывают **состояние на запуске** (рассылка Turnstile+подписка, форма Contact, cookie-согласие + GA4, партнёрские ссылки Amazon). Оператор — **бренд «Urban Soul of Plants» + e-mail**; юрлицо/страна — явная пометка-заглушка в тексте, вносит владелец до запуска |
| P4 | Контактный e-mail — `hello@urbansoulofplants.com` (из референса), хранится в `site_settings.contact_email`, в markdown-текстах — токен `{{contact_email}}` |
| P5 | В админку переезжают **все глобальные тексты**: оговорка о партнёрских ссылках, `PRICE_NOTE`, соцсети (Instagram/X/Pinterest), e-mail и **весь футер** (подпись, колонки ссылок, нижние юр-ссылки). Меню шапки остаётся в коде |

## Цель и границы

**Цель.** `/about`, `/privacy`, `/terms` вместо «Coming soon»; тексты — из БД с фолбэком на код; глобальные тексты — из `site_settings`; всё правится из админки, сайт видит правку ≤ 1 мин (ISR 60).

**Не входит:** `/contact` и форма (Фаза 6; `ComingSoon` остаётся только у `/contact`), рабочая рассылка (6), cookie-баннер/GA4/`consent.ts` (8), JSON-LD/sitemap/OG (8), поиск (7), меню шапки в админке, превью черновиков.
**Анти-цели:** пустая юридическая страница (null body → встроенный текст); дыра в футере (пустой список колонок → встроенные колонки + `console.error`); HTML из БД в разметке (markdown без raw HTML, `javascript:`-ссылки блокируются); падение сайта из-за битого jsonb футера (валидатор + фолбэк).

## Модель данных (схема `urban_gardener`, миграции с `0017`)

Правила — как Фазы 2–4: uuid, `created_at`/`updated_at` + триггер `public.set_updated_at`, `check (… <> '')` для nullable-текстов, `revoke all … from anon, authenticated`, затем `grant select` anon, `select/insert/update/delete` authenticated, `all` service_role (шаблон 0012), RLS «Public read …» (`using (true)`) + «Admin all …» (`public.is_admin()`).

**`pages`** (расширяется). Колонка **`body text`** — markdown; `check (body is null or btrim(body) <> '')`. Строки `about`, `privacy`, `terms` — INSERT-ом в сиде (slug-check уже допускает). SEO (`seo_title`, `seo_description`) — как у `home`. Hero-колонки у этих страниц не используются.

**`about_content`** — singleton (unique-индекс `((true))`), «колонка на поле», все поля text nullable (`btrim <> ''`; null → код-фолбэк = текст референса): `eyebrow`, `heading`, `intro`; `story_image_path`, `story_image_alt`, `story_heading`, `story_body_1`, `story_body_2`; `card1_icon`/`card1_title`/`card1_text` … `card3_*` (`*_icon` — эмодзи-строка); `tip_title` (слова в `*звёздочках*` → `<em>`, как акцент hero), `tip_text`. Сид — одна строка с текстом референса (§ About ниже).

**`site_settings`** — singleton: `affiliate_disclosure`, `price_note`, `contact_email` (check `^[^@\s]+@[^@\s]+\.[^@\s]+$` или null), `instagram_url`, `x_url`, `pinterest_url` (check `^https://` или null), `footer_tagline`, `footer_columns jsonb` (массив ≤ 4 колонок `{title, links: [{label, href}]}`, ссылок ≤ 8 в колонке), `footer_legal_links jsonb` (массив ≤ 4 `{label, href}`). `href` — внутренний `/…`, `https://…` или `mailto:…`. Структуру проверяет RPC (и `check (jsonb_typeof(footer_columns) = 'array')`). Сид — из нынешних констант `lib/site.ts` (`AFFILIATE_DISCLOSURE`, `PRICE_NOTE`, `SOCIAL_LINKS`, `SITE_DESCRIPTION`, `FOOTER_COLUMNS`, `LEGAL_LINKS`), `contact_email = hello@urbansoulofplants.com`.

**RPC** (`security invoker`, `set search_path = ''`, execute — `authenticated`/`service_role`, ключи `p_*`: отсутствует = не трогаем, `null`/пусто = очищаем; не-объект → `22023`, не найдено/не админ → `P0002`; образец — `0015_home_hardening.sql`):
- `save_about_page(p_page_id uuid, p_page jsonb, p_about jsonb) → jsonb` — SEO страницы `about` + singleton `about_content` одной транзакцией.
- `save_site_settings(p_settings jsonb) → jsonb` — валидирует jsonb футера (структура, длины, `href`), email/URL; пишет singleton.
- Privacy/Terms — прямой `update pages set body, seo_*` (одна таблица), админка проверяет «0 строк» (`mustAffect`).

Нумерация: `0017_static_pages_tables`, `0018_seed_static_pages` (данные), `0019_static_pages_rpc`; правки по ревью — `0020+`.

## Тексты

- **About** — дословно референс: eyebrow «About us»; h1 «We're here to make plant care feel calm, not complicated»; intro «Urban Soul of Plants started in 2017 as a notebook of what actually worked on one very crowded windowsill. Today it's a small team writing the guides we wish we'd had when we started.»; история: h2 «Tested on real plants, in real homes», абзацы «Every guide we publish comes from hands-in-the-soil experience, not copied from a hundred other sites. We kill our share of plants so you don't have to.» и «No affiliate-driven recommendations, no fear-mongering, no fifty-step routines. Just the few things that genuinely matter, explained plainly.»; фото `photo-1545241047-6083a3684587` (alt «Plants in a home»); карточки: 🌱 «Beginner-first» / «If your grandmother couldn't follow it, we rewrite it. Clarity beats cleverness.»; 🔬 «Actually tested» / «We grow everything we write about before recommending a single thing.»; 💚 «Kind to plants & people» / «No guilt, no jargon. Plant care should lower your stress, not add to it.»; блок рассылки: «Grow with *us*» / «Join 52,000 plant lovers getting one practical care tip every Saturday.» (кнопка неактивна, как на главной — `NewsletterPlaceholder`).
- **Privacy / Terms** — исходники: `cozycorner/app/privacy/page.tsx`, `cozycorner/app/terms/page.tsx`, `avocado.kiss/app/{privacy,terms}/page.tsx`. Адаптация: бренд «Urban Soul of Plants» (а не CozyCorner), сайт — журнал по уходу за комнатными растениями + каталог с партнёрскими ссылками (Amazon), рассылка (подписка + Cloudflare Turnstile), форма Contact (отправка сообщений), cookie-согласие (отказ = ни одного запроса к Google) + GA4, партнёрские ссылки/комиссия, ссылки на сторонние ресурсы, поставщики (Vercel, Supabase, провайдер e-mail — без выдумывания названий, которых нет в проекте: брать из Cozy/Avocado только реально общие). Пометка оператора: «[Operator details — legal name and country — to be added before launch]» в «Who we are» (Privacy) и в Terms. Токен `{{contact_email}}` везде, где e-mail. Тексты хранятся в `lib/static-pages.fixtures.ts` (источник сида и фолбэка) в markdown: заголовки только `##`, абзацы, списки, ссылки.
- Шапка legal-страниц: eyebrow «Legal», h1 «Privacy policy» / «Terms of use» (в коде), строка «Last updated {date}» из `pages.updated_at` (формат `October 16, 2026`, en-US, UTC).

## Сайт (`urban.gardener`)

- Зависимость: `react-markdown` (^10.1.0 — версия Cozy/Avocado); `components/legal/MarkdownText.tsx` (серверный; raw HTML отключён по умолчанию; `h1`→`h2`; внешние ссылки `target=_blank rel="noopener noreferrer"`; `a`/`mailto`; стили через CSS Module, токены), `components/legal/LegalArticle.tsx` (`PageHead` eyebrow «Legal» + `narrow article-body`).
- `lib/static-pages.ts` (серверные загрузчики, `cache()`): `fetchStaticPage(slug)` (`pages` по slug, явные колонки `slug, seo_title, seo_description, body, updated_at`), `fetchAboutContent()`, `fetchSiteSettings()`. Ошибка Supabase → `throw` (`fail()`); **нет строки** → `console.error` + фолбэк на код-константы (а не падение). `lib/static-pages.mappers.ts` + `lib/static-pages-utils.ts` (чистое: `applyPlaceholders(md, { contact_email })` — заменяет только `{{contact_email}}`, незнакомые токены не трогает; `formatLegalDate(iso)`; `parseFooterColumns(json)`/`parseLegalLinks(json)` — валидатор, битое → фолбэк + `console.error`; `buildSocialLinks(settings)` — пустые URL не рендерятся; `resolveAbout(row|null)` с фолбэками на `ABOUT_FALLBACK`).
- `app/layout.tsx`: `export const revalidate = 60` (иначе правки футера не видны до редеплоя — урок Avocado), грузит `fetchSiteSettings()` и передаёт `Header` (`socials`) и `Footer` (`settings`); `components/Header.tsx`/`Footer.tsx` принимают данные пропсами, константы в `lib/site.ts` остаются **только фолбэками/сидом**. `Disclosure` получает текст пропсом (`app/shop/(hub)/page.tsx`, `app/product/[slug]/page.tsx` и места, где используется `PRICE_NOTE`, берут его из `fetchSiteSettings()`).
- `components/about/{AboutIntro,AboutStory,AboutValues}` + `app/about/page.tsx` (h1 в intro; h2 истории; карточки ценностей — h3; tip-блок — `HomeTip`-подобный компонент `AboutTip` с `NewsletterPlaceholder`, заголовок с `*акцентом*` → `<em>`); `app/privacy/page.tsx`, `app/terms/page.tsx` (`LegalArticle`); у трёх страниц убрать временный `robots: noindex` (сайт целиком закрыт layout'ом до Фазы 9), `generateMetadata` из SEO страницы (`title` без `absolute`: шаблон «… — Urban Gardener»; description фолбэк на текст по умолчанию), canonical `/about|/privacy|/terms`; `revalidate = 60`, без `searchParams`, без `loading.tsx`.
- Footer: `© {год} {SITE_NAME}` остаётся в коде (имя бренда не редактируется), подпись — `footer_tagline`; колонки и юр-ссылки — из настроек. `KNOWN_ROUTES`/тест целостности ссылок футера проверяет **сид и фолбэк-константы** (все `href` — существующие маршруты или `https:`).
- `ComingSoon` остаётся только у `/contact`; тест `coming-soon-pages.test.tsx` сузить до `/contact`.

## Админка (`web.admin`), шаг 5D — **сначала короткое описание экранов владельцу и «утверждаю»**

- `sites.ts` Urban: `sections` уже содержит `pages`. `PagesRoutes`: список — `UgPagesPage` (строки Homepage/About/Privacy/Terms + закреплённая сверху «Site settings» (бейдж `global`), по образцу `AvocadoPagesPage` «Footer & socials»); редактор выбирается **по slug страницы** (`useParams().pageId` → строка из `listUgPages`): `home` → `UgHomePage`, `about` → `UgAboutPage`, `privacy|terms` → `UgLegalPage`, иначе «Page not found» (закрывает замечание ревью Фазы 4); статический маршрут `pages/site-settings` → `UgSiteSettingsPage` (стоит выше `:pageId`).
- `UgAboutPage`: SEO (title/description + подсказки длины), блоки Intro / Story (фото из галереи Media + alt, заголовок, 2 абзаца) / Values (3 карточки: иконка-эмодзи, заголовок, текст) / Newsletter block (title с `*акцентом*`, text); пустое поле = «используется текст по умолчанию» (подсказка); один Save → RPC `save_about_page`; гард ухода, `gcTime: 0`, перечитывание после Save; `story_image_path` в `USAGE_SOURCES` (`about_content`, label About).
- `UgLegalPage` (privacy/terms): `RichTextEditor` (markdown, как `PageEditPage` Cozy), SEO, подсказка про токен `{{contact_email}}` и про заголовки `##`, «Last updated» (read-only, из `updated_at`), кнопка «View on site», кнопка «Use the built-in text» (очищает body → фолбэк); Save — `update` + `mustAffect`.
- `UgSiteSettingsPage`: блоки Affiliate & prices (disclosure, price note), Contact (e-mail), Social links (3 URL, пусто = иконка скрыта), Footer (tagline, колонки ссылок: добавить/удалить/↑↓ колонку и ссылку, поля label/href, лимиты 4/8, нижние юр-ссылки ≤ 4), живой предпросмотр футера не нужен; валидация `https://`/`/…`/`mailto:`; Save → RPC `save_site_settings`.
- Слой данных `src/lib/ugStatic.ts` (`getUgAbout`, `saveUgAbout`, `getUgLegalPage`, `saveUgLegalPage`, `getUgSiteSettings`, `saveUgSiteSettings`), ключи `['ug-about', slug]`, `['ug-legal', slug, pageSlug]`, `['ug-site-settings', slug]`; ошибки RPC `22023/23514/P0002` — понятные тексты.

## Шаги

Каждый шаг завершается зелёными `lint`, `test`, `build`; ветки `feat/static-pages` в обоих репо от `main`, локальные коммиты, push/merge — только по команде. API Next 16 / react-markdown / Supabase сверять с `node_modules/next/dist/docs/` и Context7.

- **5A. Фронт на тестовых данных:** `react-markdown`; `lib/static-pages.fixtures.ts` (тексты About/Privacy/Terms/настроек); `lib/static-pages-utils.ts` (+ тесты, red-first для `applyPlaceholders`/`parseFooterColumns`/`buildSocialLinks`); `components/about/*`, `components/legal/*`; страницы `/about /privacy /terms`; Header/Footer/Disclosure на пропсах (loader на фикстурах); визуальная сверка с референсом (1280/390).
- **5B. Миграции и сид:** 0017–0019; проверка прав SQL под ролями (anon читает; не-админ не пишет и не вызывает RPC; админ сохраняет; битый jsonb футера / не-https ссылка → `23514`); `get_advisors`; ревью `database-reviewer`.
- **5C. Сайт на БД:** загрузчики + мапперы; `layout` с `revalidate`; метаданные; ревью `silent-failure-hunter`.
- **5D. Админка:** описание владельцу → «утверждаю» → impl-план админки → код → тесты.
- **5E. Тесты:** unit (утилиты, мапперы, валидаторы, формы админки), компонентные (About-секции, MarkdownText: нет raw HTML/`javascript:`, LegalArticle, Footer из настроек, пустая соцсеть скрыта), e2e `e2e/static-pages.spec.ts` (по заголовкам/сидовому тексту, не по числам; `/about /privacy /terms` 200, один h1, ссылки футера работают, 390px без горизонтального скролла).
- **5F. Ревью-гейт и документация:** `database-reviewer`, `silent-failure-hunter`, `react-reviewer`, `a11y-architect`, `seo-specialist`, `typescript-reviewer`; `schema.md`, `urban-gardener.md` (D34+, правка D28 по решению P1), roadmap, `AGENTS.md` обоих репо, `phase-x-checklist.md`, `admin-panel/static-pages-urban-gardener.md`, отчёт в плане.

## Подводные камни

- **`app/layout.tsx` без `revalidate`** сделает футер/соцсети статичными до редеплоя; но layout с запросом к БД на каждый статический рендер — убедиться, что страницы остаются SSG (`next build` показывает `○`/`●`).
- **Footer/Header — клиентские/серверные границы:** `Header` клиентский (меню, `usePathname`) — данные соцсетей приходят пропсом из серверного layout; не тянуть Supabase в клиентский код.
- **jsonb футера руками правят из админки** — серверная валидация обязательна (RPC), на сайте — парсер с фолбэком, а не `as`.
- **Токен `{{contact_email}}`:** подставляется на сервере при рендере; в админке виден как есть; пустой `contact_email` → токен остаётся и логируется (не подставлять `undefined`).
- **Дубли текстов:** фолбэк в коде = сид; тест сверяет, что сид-миграция и фикстуры совпадают по ключевым фразам (нет расхождения «в БД одно, в коде другое»).
- Привязка к будущим фазам: Phase 6 заменяет `NewsletterPlaceholder` на About/Home настоящей формой и подключает `/contact` (ссылка в футере уже есть); Phase 8 добавляет cookie-баннер/GA4 — Privacy уже описывает их, там только сверка.
- Не менять URL-ы Cozy/Avocado; админские маршруты `pages` общие — поведение Cozy/Avocado сохранить (регрессионный тест `PagesRoutes.test.tsx` уже есть).
