# Urban Gardener — Фаза 8: impl-план, репозиторий `urban.gardener`

> **For agentic workers:** executing-plans (выбор агента: задачи идут цепочкой и делят интерфейсы `lib/consent`, `SiteSettings.analytics`, `lib/indexing`, `lib/seo`; ревью — один раз в конце). Шаги — чекбоксы.

**Goal:** согласие + GA-заготовка, Preview статей/товаров, SEO-каркас с одним переключателем индексации; ничего live.
**Architecture:** GA-ID/GSC-токен лежат в `site_settings` (читаются layout'ом, ISR 60 с); согласие — localStorage + событие; превью — отдельный сегмент `/preview/*` (`force-dynamic`, noindex, токен), главная строка читается service-role клиентом, всё остальное (связанные материалы) — обычным anon-клиентом, поэтому черновики не просачиваются; индексация — одна функция `isIndexingAllowed()`.
**Tech Stack:** Next.js 16.2.9 (App Router), React 19, Supabase JS, Vitest/RTL, Playwright.
**Spec:** `2026-10-19-phase-8-consent-preview-seo-spec.md`. Админская часть — `…-impl-plan-admin.md`.
**Ветка:** `feat/consent-preview-seo`. Коммиты локальные, без push.

## Global Constraints
- Ключ согласия `ug_cookie_consent`, события `ug-consent-change` и `ug-consent-reopen`.
- GA ID: `^G-[A-Z0-9]{6,14}$`; GSC-токен: `^[A-Za-z0-9_-]{20,120}$`; пустая строка → `null` (БД и админка).
- Без ID, при dev, до выбора и при Decline — ни одного запроса к Google, `window.dataLayer` не создаётся.
- Переключатель: `process.env.ALLOW_INDEXING === 'true'`, по умолчанию выключен; в Vercel его НЕ ставим (Фаза 9).
- В sitemap нет `/search`, `/design`, `/preview/*`. SearchAction в JSON-LD не добавляем. `robots.txt` без `Disallow: /search` и без правил для `/preview`.
- JSON-LD: `<` экранируется как `<`; `Product` без `offers`, если цена/валюта не заданы.
- Кнопки баннера одинакового веса; текст английский (UI сайта); комментарии кода — по-русски, как в репо.
- Данные: явные списки колонок, `select('*')` нет (проверено grep'ом 2026-10-19) — поэтому revoke `preview_token` безопасен.
- У `article_blocks` нет флага публикации (нет `is_published`) — «показ неопубликованных блоков» из спеки к Urban неприменим.

## Review Focus
1. Баннер и окно рассылки одновременно на 390 px: окно не появляется, пока баннер на экране (тест + e2e).
2. Невалидный/пустой `ga_measurement_id` из БД (мусор, пробелы) → GA не грузится, страница не падает (тест mapper'а).
3. `/preview/articles/<slug>?token=` с токеном от другой статьи, с пустым токеном, с не-UUID → 404, без 500 (тест загрузчика).
4. Название статьи/товара с `</script>` и кавычками в JSON-LD → безопасный вывод (тест хелпера).
5. Sitemap при пустой БД/ошибке Supabase: ошибка пробрасывается (не пустая карта, которую закэшируют) (тест).

## Files
- Create: `supabase/migrations/0029_analytics_settings.sql`, `0030_preview_tokens.sql`; `lib/consent.ts`(+test); `lib/indexing.ts`(+test); `lib/seo.ts`(+test); `lib/json-ld.ts`(+test); `lib/supabase/service.ts` (уже есть); `components/consent/CookieConsent.tsx`(+css, test), `CookieSettingsButton.tsx`, `GoogleAnalytics.tsx`(+test); `app/robots.ts`, `app/sitemap.ts`(+tests); `app/preview/articles/[slug]/page.tsx`, `app/preview/products/[slug]/page.tsx`; `components/articles/ArticleView.tsx`, `components/shop/ProductView.tsx` (вынос тела страниц, чтобы превью их переиспользовало); e2e `e2e/consent.spec.ts`, `e2e/seo.spec.ts`, `e2e/preview.spec.ts`.
- Modify: `lib/static-pages.types.ts`/`.mappers.ts`/`-utils.ts` (analytics), `app/layout.tsx`, `components/Footer.tsx`, `components/newsletter/NewsletterModal.tsx`, `lib/articles.ts`, `lib/shop.ts`, страницы (metadata через `lib/seo`), `AGENTS.md`.

---

### Task 1: Миграция 0029 — поля аналитики в site_settings
**Interfaces:** Produces: `site_settings.ga_measurement_id text null`, `gsc_verification text null`; `save_site_settings` принимает оба ключа.
- [ ] Написать `0029_analytics_settings.sql` по образцу 0026: `add column if not exists`, CHECK-ограничения по regex из Global Constraints (имена `site_settings_ga_id_format`, `site_settings_gsc_format`), в `save_site_settings` ключи добавить в `c_text`, ветка «пустая строка → null, неверный формат → 23514» (сообщения: `GA4 ID must look like G-XXXXXXXXXX`, `Search Console token may contain letters, digits, - and _ (20–120 characters)`), присвоения в `update` через `nullif(btrim(...), '')`. Тело функции — копия из 0026 + только эти изменения.
- [ ] Применить к `base-one` (MCP `apply_migration`), проверить: валидный `G-TEST123456` сохраняется, `abc` → 23514, `''` → null, неизвестный ключ → 22023; вернуть значения в null. `get_advisors` (security) — новых замечаний нет.
- [ ] Commit: `feat(db): analytics settings columns (Phase 8: 0029)`.

### Task 2: Настройки аналитики в типах и мапперах сайта
**Interfaces:** Produces: `SiteSettings.analytics: { gaId: string | null; gscVerification: string | null }`.
- [ ] Тест (красный первым, чистая логика) в `static-pages-utils.test.ts`: `resolveSettings` с `ga_measurement_id: 'G-ABCDEF1234'` → `gaId` задан; `' G-ABCDEF1234 '` → обрезан; `'abc'`, `''`, `null`, число → `null`; то же для `gsc_verification` (regex из Global Constraints).
- [ ] Добавить колонки в `SETTINGS_COLUMNS`, типы строки, `resolveSettings`; обновить фикстуры, если тип требует.
- [ ] `npm test` по файлу зелёный. Commit.

### Task 3: `lib/consent.ts` (чистая логика, тест первым)
**Interfaces:** Produces: `type ConsentValue = 'accepted'|'declined'`; `getStoredConsent(): ConsentValue|null`; `setStoredConsent(v): void`; `subscribeConsent(cb): () => void`; `hasAnalyticsConsent(): boolean`; `reopenConsent(): void`; `subscribeReopen(cb): () => void`.
- [ ] `lib/consent.test.ts` по образцу `avocado.kiss/lib/consent.test.ts`: неверное значение → null; недоступный localStorage → null без throw; `setStoredConsent` шлёт `ug-consent-change`; `reopenConsent` шлёт `ug-consent-reopen` и НЕ меняет сохранённый выбор.
- [ ] Реализовать порт `avocado.kiss/lib/consent.ts` (ключ/события из Global Constraints). Commit.

### Task 4: Баннер, «Cookie settings», окно рассылки уступает баннеру
**Interfaces:** Consumes: Task 3. Produces: `<CookieConsent />`, `<CookieSettingsButton />`; атрибут `data-cookie-banner` на баннере.
- [ ] `components/consent/CookieConsent.tsx` (client): порт Avocado; `role="region" aria-label="Cookie consent"`, задержка ~400 мс, слушает `subscribeReopen` (показать снова). Текст: «We use only essential storage to make Urban Gardener work. With your consent we may also use optional analytics — nothing is collected if you decline. See our Privacy Policy.» Кнопки Decline/Accept одного класса и размера (без «главной» кнопки); стили на токенах Urban (`--line`, `--ink`, `--field-border`), на ≤480 px кнопки в ряд, баннер не выше ~40% экрана; кольцо фокуса — глобальное.
- [ ] `CookieSettingsButton` (client): `<button type="button">Cookie settings</button>` в стиле юр-ссылок, вызывает `reopenConsent()`. Вставить в `Footer` в нижнюю полосу рядом с юр-ссылками (не в редактируемые колонки); обновить `Footer.test.tsx`.
- [ ] `NewsletterModal`: в месте, где окно уже уступает открытому меню/поиску, добавить условие «баннер на экране» (`document.querySelector('[data-cookie-banner]')`) → не открывать, попробует на следующей странице. Тест в `NewsletterModal.test.tsx`.
- [ ] Смонтировать `<CookieConsent />` в `app/layout.tsx` (после `OverlayScrollbar`). Тесты компонента: нет выбора → через 400 мс видно; Decline сохраняет и скрывает; есть сохранённый выбор → не показывается; `reopenConsent()` → показывается снова; обе кнопки доступны по имени. Commit.

### Task 5: GoogleAnalytics + верификация Search Console
**Interfaces:** Consumes: Task 2, 3. Produces: `<GoogleAnalytics gaId={string|null} />`.
- [ ] Тесты: `gaId=null` → null; нет согласия → null (нет `<script>`); Decline → null; `NODE_ENV=development` → null; Accept + ID → два Script (src с `?id=`, инициализация). ID, не прошедший regex, не рендерится (защита от внедрения в inline-скрипт даже при испорченной БД).
- [ ] Порт `avocado.kiss/components/GoogleAnalytics.tsx`; ID — проп; смонтировать в layout (`settings.analytics.gaId`).
- [ ] В `app/layout.tsx` metadata → перейти на `generateMetadata()`, где `verification: { google: settings.analytics.gscVerification }` только если токен задан; `robots` — из `isIndexingAllowed()` (Task 7). Commit.

### Task 6: Privacy — одна строка про ug-newsletter
- [ ] Прочитать текущее `pages.body` (slug `privacy`) и раздел про cookies/хранилище; подготовить идемпотентный `update … set body = replace(…)` с условием `body not like '%ug-newsletter%'`, только точечная вставка пункта: «Newsletter window: we remember in your browser that the window was shown or that you subscribed (`ug-newsletter`, `ug-newsletter-views`). This is strictly necessary storage and is not used for tracking.» Тестовые правки владельца («Test.» в начале) не трогать.
- [ ] Выполнить через `execute_sql`, перечитать тело, убедиться что остальное не изменилось. Сверить Privacy с кодом: баннер, GA после согласия, Turnstile, Contact, рассылка — расхождения записать в чек-лист Фазы X, не править без владельца. Commit не требуется (данные БД) — записать в отчёт и в `phase-x-checklist.md`.

### Task 7: Индексация, robots, sitemap
**Interfaces:** Produces: `isIndexingAllowed(): boolean`; `app/robots.ts`; `app/sitemap.ts` (`revalidate = 60`).
- [ ] Тесты (красные первыми): `isIndexingAllowed` — `'true'` → true; `undefined`/`'false'`/`'TRUE'`/`'1'` → false. `robots()` выкл → `{ rules: { userAgent: '*', disallow: '/' } }` без sitemap; вкл → `allow: '/'` + `sitemap: <site>/sitemap.xml`, в правилах нет `/search` и `/preview`. `sitemap()` с моками загрузчиков: содержит статические страницы, `/articles/<slug>`, `/product/<slug>`, `/topics/<slug>`, `/shop/<category>`; не содержит `/search`, `/design`, `/preview`; ошибка загрузчика → reject.
- [ ] Реализовать. В sitemap: статьи/товары — `lastModified` из `updated_at` (колонка есть; добавить нужные поля в явные select'ы загрузчиков slug'ов — новые функции `fetchArticleSlugs`/`fetchProductSlugs` только публичные поля), страницы — `pages.updatedAt` если есть; темы/категории — без lastModified.
- [ ] `app/layout.tsx` `robots` ← `isIndexingAllowed() ? { index: true, follow: true } : { index: false, follow: false }`. Commit.

### Task 8: SEO-хелперы и JSON-LD
**Interfaces:** Produces: `buildPageMetadata({ title, description, path, image?, type? }): Metadata`; `jsonLdScript(data: object): string` (безопасная сериализация); компонент `<JsonLd data={…} />`.
- [ ] Тесты: `jsonLdScript({ name: '</script><b>' })` не содержит `<`; `buildPageMetadata` ставит canonical = path, `og:site_name`, `og:image` fallback и `twitter:card`.
- [ ] Реализовать. Применить в хабах и страницах (articles hub, article, topic, shop hub, category, product, about, privacy, terms, contact), сохранив текущие title/description и правило «шаблон layout не дублирует название». Если у страницы нет картинки — общий fallback из `public/` (проверить, что файл есть; иначе OG без image).
- [ ] JSON-LD: `Organization`+`WebSite` в layout (name, alternateName=TAGLINE, url, sameAs из соцсетей `settings.socials`, contactPoint из `contact_email`); `Article` (headline, datePublished, dateModified=`updatedAt`, author, image) на статье; `Product` (name, image, description, brand; `offers` только при валидных price+currency; без rating). Данные админки экранируются `jsonLdScript`. Ссылку «Newsletter → /about» не менять, зафиксировать в отчёте. Commit.

### Task 9: Миграция 0030 — preview_token и закрытие колонки
**Interfaces:** Produces: `articles.preview_token`, `products.preview_token` (uuid, not null, default gen_random_uuid()), недоступны anon.
- [ ] `0030_preview_tokens.sql`: добавить колонки; затем `do $$` блок: для каждой из двух таблиц `revoke select … from anon`, `grant select (<все колонки кроме preview_token из information_schema>) … to anon`. Комментарий-ловушка про column-level revoke как в `avocado.kiss/0020`. `authenticated`/`service_role` не трогать (у них `grant all`).
- [ ] Перед применением: grep исходников и RPC на `articles.*`/`products.*`/`to_jsonb(a)` (search_content — проверено: нет). Применить к `base-one`. Проверить под ролями через `execute_sql` с `set local role`: anon `select preview_token` → permission denied; anon `select id, slug, title` работает; anon читает опубликованное как раньше (сайт `curl` страниц локально); authenticated/service_role видят токен. `get_advisors`. Commit.

### Task 10: Загрузчики превью и маршруты
**Interfaces:** Produces: `fetchArticleForPreview(client, slug, token): Promise<Article|null>`, `fetchProductForPreview(client, slug, token): Promise<Product|null>` (токен сверяется в коде, в результат не попадает); `ArticleView({ article, related })`, `ProductView({ product, related, settings })`.
- [ ] Тесты (фейковый клиент, как `avocado.kiss/lib/preview.test.ts`): нет совпадения токена → null; пустой/не-UUID токен → null без запроса; результат не содержит `preview_token`; неопубликованная статья с верным токеном возвращается.
- [ ] Вынести тела `ArticlePage`/`ProductPage` в `ArticleView`/`ProductView` (поведение страниц не меняется — их тесты зелёные).
- [ ] `app/preview/articles/[slug]/page.tsx` и `…/products/[slug]/page.tsx`: `dynamic = 'force-dynamic'`, `robots: noindex,nofollow`, нет токена → `notFound()`; основная строка — `createServiceClient()`; связанные статьи/товары — обычные `fetchArticles()`/`fetchRelatedProducts()` (anon → только опубликованные), поэтому service-role не расширяет выборку. Страницы не в sitemap и не в `generateStaticParams`.
- [ ] Commit.

### Task 11: Тесты, проверка, ревью, документация
- [ ] `test-engineer` (скилл `testing`): e2e `consent.spec.ts` (390 px: баннер → Decline → перезагрузка → нет баннера → «Cookie settings» возвращает; до Accept нет запросов к googletagmanager; окно рассылки не открывается поверх баннера), `seo.spec.ts` (`/robots.txt` Disallow, `/sitemap.xml` без `/search`, `<meta name="robots" content="noindex">`), `preview.spec.ts` (без токена 404). Только сидовые slug.
- [ ] `npm run build`, `npm run lint`, `npm test`, e2e — реальный вывод в отчёт. Проверка на 390 px в браузере (Playwright MCP): баннер, футер, окно рассылки.
- [ ] Ревью по слоям (по одному): `database-reviewer` (0029/0030), `silent-failure-hunter` (preview-загрузчики, sitemap), `react-reviewer`, `a11y-architect` (баннер), `seo-specialist` (каркас), `typescript-reviewer` на `lib/`-хелперы. CRITICAL/HIGH исправить.
- [ ] Обновить `AGENTS.md` репо, затем документы `platform-docs` (schema.md 0029–0030 + правило column-grant, sites/urban-gardener.md, phase-x-checklist «Фаза 8», roadmap, план §8-отчёт), память. Без commit/push документов.
