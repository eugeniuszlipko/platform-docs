# Urban Gardener — Фаза 8: спека для агента

> План для владельца: [../plans/2026-10-19-phase-8-consent-preview-seo.md](../plans/2026-10-19-phase-8-consent-preview-seo.md). Уровень по `superpowers-routing`: **3** (миграции + 2 репо) → перед кодом `writing-plans` (impl-план на репо), исполнение `executing-plans`. Ветки `feat/consent-preview-seo` в `urban.gardener` и `web.admin`. Миграции с 0029.
> Контекст «ничего не live»: GA-ID, GSC, снятие noindex — Фаза 9. Не подключать реальные ID.

## Решения владельца
P1 поле = только GA4 ID + токен GSC (без произвольного кода); P2 баннер всегда; P3 Preview — статьи + товары; P4 SEO-каркас без шлифовки; P5 фаза фокуса (B-008) после 8, до X.

## 8A. Согласие + GA (заготовка)

**Сайт (urban.gardener)** — порт из `avocado.kiss` (`lib/consent.ts`, `components/CookieConsent.tsx`, `components/GoogleAnalytics.tsx`) с изменениями:
- `lib/consent.ts`: ключ `ug_cookie_consent`, событие `ug-consent-change`; добавить `reopenConsent()` (событие `ug-consent-reopen`) для «Cookie settings». Тесты по образцу `avocado.kiss/lib/consent.test.ts`.
- `components/CookieConsent.tsx` (client) монтируется в `app/layout.tsx`; CSS-модуль на токенах Urban; кнопки одного веса (стиль `--field-border`/кольцо фокуса — глобальное, без локальных переопределений: см. B-008). Прячет себя от `/design`? нет — показывается везде. Не перекрывать модалку рассылки: пока открыт `NewsletterModal` — баннер ниже по z-order (или модалка не открывается, пока нет выбора согласия — **решить в impl-плане, проверить e2e**: окно рассылки + баннер на 390 px не конфликтуют, фокус-ловушка модалки не должна захватывать баннер некорректно).
- `components/GoogleAnalytics.tsx`: ID приходит **пропсом из `site_settings`** (читается в `layout.tsx`, `revalidate = 60` уже есть), а не из `lib/site.ts`. Нет ID, `development` или нет согласия → `null`. Скрипт не грузится ни до выбора, ни при Decline. В `window` ничего не создаётся до «Accept».
- Подвал: ссылка/кнопка «Cookie settings» (`<button>` в стиле ссылки, в `Footer`, не в редактируемых `footer_*` колонках — иначе админ может её удалить).
- `<meta name="google-site-verification">` в `metadata.verification.google` из `site_settings.gsc_verification` (пусто → нет тега). Это не скрипт, согласия не требует.
- Privacy: точечный `replace` в `pages.body` (slug `privacy`) — добавить пункт про `ug-newsletter` / `ug-newsletter-views` (localStorage/sessionStorage, строго необходимое, окно рассылки). **Не перезаписывать тело**: у владельца тестовые правки («Test.» в начале). Делать идемпотентно (если пункта нет). Сверить с кодом: что Privacy описывает баннер, GA, Turnstile, Contact и рассылку — совпадает с кодом (чек-лист «Фаза 5 (P3)»).

**БД (миграция 0029)**: `site_settings` + `ga_measurement_id text null`, `gsc_verification text null`; CHECK: `ga_measurement_id ~ '^G-[A-Z0-9]{6,14}$'`, `gsc_verification ~ '^[A-Za-z0-9_-]{20,120}$'` (или null); `save_site_settings` — добавить ключи в `c_text` + ветка проверки формата (пустая строка → null) по образцу 0026. Права: `site_settings` публично читается (значения не секретны — ID виден в HTML при Accept). `get_advisors` после миграции.

**Админка (web.admin)**: Pages → Site settings → блок «Analytics»: «GA4 ID» (`G-XXXXXXXXXX`, подсказка: «пусто = не загружается; грузится только после согласия посетителя») и «Search Console verification» (необяз.; подсказка про DNS-альтернативу). Валидация формата на клиенте зеркалит БД. **Шаг админки — по правилу 7E Фазы 7: сначала описание экрана → «утверждаю» владельца.** Тесты по образцу блока «Newsletter popup» (Фаза 7C).

## 8B. Preview (статьи + товары)

Модель — `avocado.kiss` 0019/0020 + память `avocado-kiss-preview-tokens` + `cozycorner-column-level-grants`.
- **Миграция 0030**: `articles.preview_token uuid not null default gen_random_uuid()`, то же для `products`. **Отдельным шагом после деплоя кода** (как у Avocado 0019→0020): закрыть колонку от `anon` — **table-level revoke select + column-level grant** списком всех колонок, кроме `preview_token` (column-level revoke при table-grant — no-op!). Дать `preview_token` роли `authenticated` (админка читает его для кнопки). Проверить под ролями anon / authenticated / service_role; новые колонки таблиц в будущем требуют явного grant (записать в `schema.md`).
- **Сайт**: `app/preview/articles/[slug]/page.tsx`, `app/preview/products/[slug]/page.tsx`: `dynamic = 'force-dynamic'`, `robots: noindex,nofollow`, нет токена/не совпал → `notFound()`. Чтение — service-role клиент (`SUPABASE_SECRET_KEY` уже в Vercel Urban с 2026-10-19). **Урок:** service-role обходит RLS → любой переиспользуемый загрузчик (связанные статьи, товары-рекомендации, блоки, бренд/уровень) обязан фильтровать `is_published` **в коде**, покрыть тестом. Превью показывает неопубликованные блоки тела (`includeUnpublished`). Переиспользовать компоненты страниц статьи/товара, а не копировать. Не должно быть в sitemap/`generateStaticParams`. Сверить с существующими Urban-загрузчиками (`lib/articles.ts`, `lib/shop.ts`): где они берут клиент и как фильтруют.
- **Админка**: кнопка «Preview» в редакторе статьи и товара (и в списках, если уместно): открывает `${frontendUrl}/preview/articles/${slug}?token=${token}` в новой вкладке (`rel="noopener"`). `frontendUrl` — из `sites.ts`. Админский экран — по правилу описание → «утверждаю».
- Смена токена: кнопки нет (риск §5 плана); в чек-лист Фазы X: «токены превью — смена через SQL».

## 8C. SEO-каркас

- `lib/indexing.ts`: `isIndexingAllowed()` = `process.env.ALLOW_INDEXING === 'true'` (только сервер; по умолчанию false). Единый источник для `app/layout.tsx` (`robots`), `app/robots.ts`, `sitemap`.
- `app/robots.ts`: выкл → `Disallow: /`, без `Sitemap`; вкл → `Allow: /`, `Sitemap: <site>/sitemap.xml`, **без** `Disallow: /search` (иначе краулер не увидит `noindex`; чек-лист Фазы 6) и без `/preview` (они закрыты `noindex` + токеном; допустим `Disallow: /preview/`? — нет: краулер не должен знать о них, ссылок на них нигде нет; оставить без правил).
- `app/sitemap.ts` (`revalidate = 60`): `/`, `/articles`, `/topics/*`, `/shop`, категории, статьи, товары (только `is_published`), `/about`, `/privacy`, `/terms`, `/contact`; `lastModified` из `pages.updated_at`/`updated_at` статей-товаров, **если колонка есть** (проверить схему; иначе опустить поле, не выдумывать). НЕ включать `/search`, `/design`, `/preview/*`. Сверить e2e: sitemap не зависит от состава живых данных (правило testing.md — сидовые slug).
- `lib/seo.ts`: общий хелпер метаданных (`alternates.canonical`, Open Graph `type/siteName/images` + fallback-картинка + alt, `twitter`), применить в страницах: хаб, статья, товар, тема, категория, About/Privacy/Terms/Contact. Заголовки/описания не шлифовать (Фаза X/9), но «шаблон layout не дублирует « — Urban Gardener»» сохранить.
- JSON-LD: `Organization` + `WebSite` в layout (`name` «Urban Gardener», `alternateName` «Urban Soul of Plants», `sameAs` из соцсетей `site_settings`, `contactPoint` из `contact_email`); `Article` на статье; `Product` на товаре (без `offers`, если нет цены/нет надёжной доступности — не врать разметкой); `AboutPage`/`WebPage` — по желанию. Экранирование `<` в `JSON.stringify` (XSS через `</script>`). SearchAction — **не добавлять** (чек-лист Фазы 6). Данные из админки (названия, тексты) попадают в JSON-LD → обязательно экранировать.
- Ссылка «Newsletter» в футере ведёт на `/about` — проверить, что так задумано (чек-лист Фазы 7), по возможности оставить, зафиксировать в отчёте.
- **Не делать:** снятие `noindex` (оно управляется переключателем, значение в Vercel — только Фаза 9); sitemap-ping; Search Console.

## 8D. Тесты, ревью, документация

- Unit: `consent.ts`, `GoogleAnalytics` (нет ID / нет согласия / dev / Decline → null; Accept + ID → скрипты), `CookieConsent` (выбор, повторное открытие, не показывается после выбора), `indexing`, `robots`, `sitemap` (исключения), JSON-LD-хелперы (экранирование), preview-загрузчики (нет токена → null; чужой токен → null; не опубликованное связанное не просачивается).
- e2e (Chromium, **390 px** для баннера — обязательное правило testing.md; только сидовые slug): баннер → Decline → перезагрузка → нет баннера → «Cookie settings» возвращает; до Accept нет запросов к `googletagmanager.com`; `/sitemap.xml` и `/robots.txt`; `/preview/articles/<slug>` без токена → 404; `meta[name=robots]` при выключенной индексации.
- Админка: тесты блока Analytics и кнопки Preview (по образцу 7C/7E).
- БД: проверка под ролями (anon не читает `preview_token`; authenticated читает), `get_advisors`.
- **Ревьюеры (по одному на слой):** `database-reviewer` (0029/0030), `silent-failure-hunter` (preview-загрузчики, sitemap, save-путь), `react-reviewer` (по разу на репо), `a11y-architect` (баннер: `role=region`/`aria-label`, фокус, контраст, кнопки одного веса, не перекрывает модалку), `seo-specialist` (каркас), `typescript-reviewer` — только на `lib/`-конвертеры.
- Документы: `schema.md` (0029–0030, правило column-grant), `sites/urban-gardener.md` (D-решения: GA/GSC из админки, переключатель индексации, превью), `admin-panel/` (Analytics, Preview), `phase-x-checklist.md` («Фаза 8»: токены превью; проверка с `ALLOW_INDEXING=true` на тестовом стенде; Privacy ↔ код), roadmap (статус 8; фаза B-008 «после 8, перед X»; Фаза 9: ввести GA-ID/GSC/`ALLOW_INDEXING=true`), память.
- Правки к Фазе 9 в roadmap: 9.4 — «ввести GA4 ID и GSC-токен в админке (Site settings → Analytics), `ALLOW_INDEXING=true` в Vercel Production, sitemap в GSC вручную».

## Порядок
1. impl-план по репо. 2. 8A (миграция 0029 → сайт → админка с «утверждаю»). 3. 8B (0030 часть 1 → код → деплой кода не требуется до приёмки; revoke-часть — отдельным шагом, перед пушем проверить, что сайт не читает `select('*')` с anon из `articles`/`products`). 4. 8C. 5. 8D + 390 px + ревью-гейт + отчёт (§8 мета-скилла).

## Открытые технические вопросы (решить в impl-плане, владельца не спрашивать)
- Конфликт баннера и `NewsletterModal` (порядок/z-index/фокус).
- Есть ли `updated_at` у статей/товаров для `lastModified`.
- Содержит ли какой-то Urban-код `select('*')` от anon по `articles`/`products` (важно для revoke `preview_token`).
