# Urban Gardener — Фаза 8: impl-план, репозиторий `web.admin`

> **For agentic workers:** executing-plans, вместе с планом сайта (`…-impl-plan-site.md`); порядок: миграции 0029/0030 из плана сайта применены раньше задач админки.

**Goal:** блок «Analytics» в Pages → Site settings и кнопка «Preview» у статьи и товара Urban.
**Architecture:** новые поля идут тем же путём, что окно рассылки (Фаза 7C): `lib/ugStatic.ts` → `ugStaticForm.ts` (zod) → `UgSiteSettingsPage.tsx` → RPC `save_site_settings`. Preview — читаем `preview_token` в тех же запросах редактора (роль `authenticated` его видит) и открываем ссылку в новой вкладке.
**Tech Stack:** Vite + React, RHF + Zod, TanStack Query, shadcn/ui, Vitest + RTL.
**Spec:** `2026-10-19-phase-8-consent-preview-seo-spec.md` (8A, 8B). **Ветка:** `feat/consent-preview-seo`, локальные коммиты.

## Global Constraints
- Текст интерфейса админки — английский. Пустое необязательное поле → `null`.
- Регулярки зеркалят БД: GA4 `^G-[A-Z0-9]{6,14}$`, GSC `^[A-Za-z0-9_-]{20,120}$`.
- Без service-role ключа; записи только под админской сессией.
- Ссылка превью: `${site.frontendUrl}/preview/articles|products/${slug}?token=${token}`, `target="_blank" rel="noopener noreferrer"`.
- Экраны (Analytics, Preview) показываются владельцу описанием в чате и идут в работу после «утверждаю».

## Review Focus
1. Ввод GA ID в нижнем регистре (`g-abc123`) или с пробелами — понятная ошибка/обрезка до сохранения, а не ошибка БД.
2. Новая несохранённая статья/товар (нет slug/токена) — кнопки Preview нет, а не битая ссылка.
3. Сохранение Site settings без изменения Analytics не затирает ID (тест полезной нагрузки RPC).

## Files
- Modify: `src/lib/ugStatic.ts` (колонки, тип, нормализация), `src/features/ug-static/ugStaticForm.ts`, `UgSiteSettingsPage.tsx`, `src/lib/ugArticles.ts` (+`preview_token` в `ARTICLE_COLUMNS`), `src/lib/ugShop.ts` (+`preview_token` в `PRODUCT_COLUMNS`), `UgArticleEditPage.tsx`, `UgProductEditPage.tsx`.
- Create: `src/features/shared/PreviewButton.tsx` (+ test).
- Tests рядом: `ugStatic.test.ts`, `ugStaticForm.test.ts`, `UgSiteSettingsPage.test.tsx`, `ugArticles`/`ugShop` tests, `UgArticleEditPage`/`UgProductEditPage` tests.

---

### Task A1: Блок «Analytics» (после «утверждаю» владельца)
**Interfaces:** Consumes: колонки `ga_measurement_id`, `gsc_verification` (миграция 0029). Produces: поля формы `ga_measurement_id`, `gsc_verification` (строки), в RPC уходят `string|null`.
- [ ] Тест `ugStaticForm.test.ts` (красный первым): `' g-abc1234567 '`/`'abc'` → ошибка формата; `'G-TEST123456'` → ок; пусто → `null` в payload; GSC `'short'` → ошибка, 30 допустимых символов → ок.
- [ ] Добавить в `ugStatic.ts` в `SETTINGS_COLUMNS` и тип, нормализацию (как для `contact_email`); в `ugStaticForm.ts` — zod-поля, `toForm`/`toPayload`.
- [ ] Блок «Analytics» в `UgSiteSettingsPage.tsx` после «Newsletter popup»: заголовок `<h2>`, поле «GA4 ID» (placeholder `G-XXXXXXXXXX`, подсказка: «Leave empty to load no analytics. Loads only after a visitor clicks Accept.»), поле «Search Console verification» (подсказка: «Optional. The token from Google’s HTML-tag method. The DNS method needs no token here.»). Метки связаны с полями, ошибки через `FieldError`.
- [ ] Тест страницы: поля видны, ошибка формата блокирует сохранение, корректное значение уходит в RPC `save_site_settings` обоими ключами; без правки Analytics payload содержит прежние значения. Commit.

### Task A2: Кнопка «Preview» (после «утверждаю» владельца)
**Interfaces:** Produces: `<PreviewButton site slug token segment: 'articles'|'products' />` — `null`, если нет `frontendUrl`, slug или токена.
- [ ] Тест `PreviewButton.test.tsx`: корректный `href`/`target`/`rel`; без токена/slug → ничего не рендерит; `site.frontendUrl` без хвостового слеша.
- [ ] Реализовать (ссылка-кнопка `Button asChild variant="outline" size="sm"`, иконка `Eye`, текст «Preview»).
- [ ] Добавить `preview_token` в явные списки колонок и типы (`ugArticles.ts`, `ugShop.ts`); не отправлять токен при сохранении. Вставить кнопку в шапку `UgArticleEditPage` и `UgProductEditPage` рядом с существующей ссылкой «View on site» (она остаётся только у опубликованных). Тесты страниц: у сохранённого черновика кнопка есть, у новой записи — нет. Commit.

### Task A3: Проверка, ревью, документация
- [ ] `npm run build`, `npm run lint`, `npm test` — реальный вывод в отчёт.
- [ ] Ревью: `react-reviewer` один раз на репо; `a11y-architect` — только блок Analytics, если замечания к форме не покрыты прошлыми ревью.
- [ ] Обновить `AGENTS.md` репо (таблица доков не меняется) и `platform-docs/admin-panel/static-pages-urban-gardener.md` (Analytics), `articles-urban-gardener.md`/`shop-urban-gardener.md` (Preview). Без commit/push документов.
