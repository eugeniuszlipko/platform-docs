# Urban Gardener — Фаза 5 (About, Privacy, Terms, Site settings), репо `web.admin`: impl-план (5D)

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (8 последовательных задач в одном репо, общие интерфейсы `ugStatic.ts` / `ugStaticForm.ts`). Шаги — чекбоксы `- [ ]`. Экраны утверждены владельцем 2026-10-17 («утверждаю» на описание 5D).

**Goal:** в Pages сайта Urban Gardener появляются строки **Site settings** (закреплена), **About**, **Privacy**, **Terms**; правка видна на сайте ≤ 1 мин.

**Architecture:** данные — `src/lib/ugStatic.ts` (чтение/запись: RPC `save_about_page`, `save_site_settings`, прямой `update pages` для Privacy/Terms); чистая логика форм — `src/features/ug-static/ugStaticForm.ts` (zod, маппинг форма↔БД, хелперы редактора футера). Экраны — `src/features/ug-static/*`; диспетчер `PagesRoutes` выбирает редактор **по slug страницы**. Паттерн экрана — `UgHomePage` (sticky-шапка, RHF + zod, `useBlocker`, `gcTime: 0`, перечитывание после Save).

**Tech Stack:** Vite + React 19 + TypeScript, shadcn/ui, react-hook-form + zod, TanStack Query, TipTap (`RichTextEditor`), Vitest + RTL.

**Spec:** `platform-docs/sites/urban-gardener/specs/2026-10-16-phase-5-static-pages-spec.md` («Админка (web.admin), шаг 5D»); схема БД и RPC — миграции 0017–0020 в `urban.gardener`. Сайт-часть уже сделана (`…-impl-plan-site.md`).

## Global Constraints

- UI-тексты (подписи, тосты, диалоги) — на английском; комментарии/доки — по-русски. Никакого service-role ключа; запись только под админской сессией.
- Пустое необязательное поле → `null` (сайт берёт встроенный текст). `slug`/`updated_at` не отправлять. Картинка: UI показывает публичный URL, в БД — плоский ключ бакета или внешний URL (`resolveImageUrl`/`toStoragePath`); новый `*_path` → `USAGE_SOURCES` (`about_content.story_image_path`).
- **`RichTextEditor` общий (Cozy/Avocado) — поведение по умолчанию не менять.** Заголовки `##`/`###` и ссылки включаются явными пропсами; для Privacy/Terms без них markdown из БД был бы молча «сплющен» при открытии (заголовки → текст, ссылки → без URL).
- Ссылки футера/юр-ссылки: `/путь`, `https://…`, `mailto:…`, без пробелов/управляющих символов/`\`, `//` запрещён; ≤4 колонок, ≤8 ссылок в колонке, ≤4 нижних юр-ссылок; соцсети — `https://` без пробелов; e-mail — белый список `^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$`. Правила зеркалят БД (0017/0020) и сайт (`lib/static-pages-utils.ts`) — менять во всех трёх местах. Лимиты длины в админке — щадящие потолки (affiliate 400, price note 120, tagline 200, email/URL 200, title колонки 40, label 60, href 300, SEO как у Homepage, body 200000).
- Контактный e-mail в форме — **обязательное** поле (владелец: очистить нельзя).
- Если `footer_columns`/`footer_legal_links` в БД не проходят проверку (правка мимо админки), форма открывается с отфильтрованным содержимым и жёлтой плашкой «Some footer data was invalid and was dropped here — Save to fix it»; экран не падает.
- Ошибки RPC: `23514` (текст RPC уже человекочитаемый — показать как есть), `22023` («Invalid data»), `P0002` («Not found or not allowed — sign in again and retry»); общий `humanizeError` остальное.
- Поведение Cozy/Avocado и Homepage Urban не менять (регресс — `PagesRoutes.test.tsx`, `UgHomePage.test.tsx`).
- Коммиты — локальные на `feat/static-pages`; push/merge — только по команде. Документы `platform-docs` не коммитить.
- «Готово» каждой задачи: `npm run build` + `npm run lint` (oxlint; 2 известных warning shadcn допустимы) + `npm test` зелёные.

## Review Focus

1. Открытие Privacy/Terms с сидовым markdown (заголовки, ссылки `[{{contact_email}}](mailto:{{contact_email}})`, жирная пометка оператора `**[…]**`, списки, `_ga`) и Save без правок → markdown **не теряет** заголовки и ссылки (тест round-trip через настоящий TipTap); экран не «грязный» сразу после загрузки.
2. Редактор футера: удалить все ссылки колонки / все колонки, 5-я колонка, 9-я ссылка, пробел в href, `javascript:`, `//evil.co`, пустой label → Save блокируется понятным текстом у поля, а не ошибкой RPC; отсутствие юр-ссылок допустимо (пустой список).
3. Сохранение пустого поля About → `null` в RPC (не `''`), а не затронутые ключи не очищаются; фото без alt → Save блокируется (alt нужен, если фото задано).
4. Открытие `/pages/<чужой id>`, `/pages/site-settings` на сайте не-Urban, и страницы, которой нет в списке → «Page not found»/редирект, не белый экран; Homepage открывается как раньше.
5. Неудачное перечитывание после Save не выглядит как неудачное сохранение (как в Homepage); при сбое Save форма остаётся с правками.

## File Structure

- `src/lib/ugStatic.ts` (+test) — данные; `src/lib/media.ts` — +`about_content` в `USAGE_SOURCES`.
- `src/features/ug-static/ugStaticForm.ts` (+test) — zod-схемы, маппинг, хелперы футера, дефолты About (зеркало `ABOUT_FALLBACK`).
- `src/features/ug-static/{UgSiteSettingsPage,UgFooterEditor,UgAboutPage,UgLegalPage,UgPageEditRoute}.tsx` (+ тесты в Task 8).
- Правки: `src/components/RichTextEditor.tsx` (опции `headings`, `links`), `src/features/pages/{PagesRoutes,UgPagesPage}.tsx` (+тесты), `src/App.tsx` (+`pages/site-settings`), `src/lazyPages.ts`.

### Task 1: Базовая линия

- [ ] **Step 1:** ветка `feat/static-pages` уже создана от `main`; `npm test && npm run lint && npm run build` — записать число тестов (на старте: 51 файл / 463 теста).
- [ ] **Step 2:** прочитать `platform-docs/admin-panel/pages.md`, `home-urban-gardener.md` (разделы про Pages/Urban), `src/features/pages/PageEditPage.tsx` (паттерн `RichTextEditor` + SEO), `src/lib/ugHome.ts` (RPC-паттерн), `src/features/ug-home/ugHomeForm.ts`.

### Task 2: Данные и чистая логика форм (red-first)

**Files:** Create `src/lib/ugStatic.ts`, `src/features/ug-static/ugStaticForm.ts`; Test `src/lib/ugStatic.test.ts`, `src/features/ug-static/ugStaticForm.test.ts`

**Interfaces — Produces** (`ugStatic.ts`): `UG_ABOUT_FIELDS` (19 колонок `about_content`, как в `urban.gardener/lib/static-pages.types.ts`) · типы `UgAboutRow` (`Record<field, string|null>`), `UgPageSeoRow = { id; slug; seo_title; seo_description; body: string|null; updated_at: string }`, `UgFooterLink = { label; href }`, `UgFooterColumn = { title; links: UgFooterLink[] }`, `UgSiteSettings = { id; affiliate_disclosure; price_note; contact_email; instagram_url; x_url; pinterest_url; footer_tagline: string|null; footer_columns: UgFooterColumn[]; footer_legal_links: UgFooterLink[]; footerRepaired: boolean }` · ключи `ugAboutKey(site)`, `ugLegalKey(site, slug)`, `ugSiteSettingsKey(site)` · `getUgAbout(site): Promise<{ page: UgPageSeoRow; about: UgAboutRow }>` · `saveUgAbout(site, pageId, page: {seo_title; seo_description}, about: UgAboutRow): Promise<void>` (RPC `save_about_page`) · `getUgLegalPage(site, slug: 'privacy'|'terms'): Promise<UgPageSeoRow>` · `saveUgLegalPage(site, id, input: { body: string|null; seo_title; seo_description }): Promise<void>` (`update pages … .select('id')`, ≠1 строки → `Error`) · `getUgSiteSettings(site): Promise<UgSiteSettings>` · `saveUgSiteSettings(site, input: Omit<UgSiteSettings,'id'|'footerRepaired'>): Promise<void>` (RPC `save_site_settings`) · `describeStaticSaveError(error): unknown` · `normalizeFooter(json: unknown): { columns: UgFooterColumn[]; repaired: boolean }` / `normalizeLegalLinks(json): { links; repaired }` (выбрасывают негодное, `repaired = true`).
**Produces** (`ugStaticForm.ts`): `isSafeHref(h)`, `UG_EMAIL`, `ugSettingsSchema`/`UgSettingsFormValues` (все поля строки; колонки/ссылки массивы), `ugAboutSchema`/`UgAboutFormValues`, `ugLegalSchema`/`UgLegalFormValues` · `toSettingsForm(s)`/`toSettingsInput(v)` · `toAboutForm(page, about)`/`toAboutInput(site, v)` (пустое → `null`, `story_image_path` → `toStoragePath`) · `toLegalForm(page)`/`toLegalInput(v)` (пустой body → `null`) · хелперы футера (иммутабельные): `addColumn`, `removeColumn`, `moveColumn(cols, i, ±1)`, `setColumnTitle`, `addLink(cols, i)`, `removeLink(cols, i, j)`, `moveLink`, `setLink(cols, i, j, patch)`, константы `FOOTER_LIMITS = { columns: 4, links: 8, legal: 4 }` · `UG_ABOUT_DEFAULTS` (тексты референса — зеркало `ABOUT_FALLBACK` сайта; нужны для плейсхолдеров).

- [ ] **Step 1: падающие тесты `ugStaticForm.test.ts`** (чистая логика): `isSafeHref` — те же таблицы accept/reject, что в `urban.gardener/lib/static-pages-utils.test.ts` (`/shop`, `https://x.co`, `mailto:a@b.co` ok; `//evil.co`, `/\evil`, таб/перевод строки, пробел, `javascript:`, `http://`, голые `https://`/`mailto:` — нет); `ugSettingsSchema`: e-mail обязателен и проходит белый список (`a@b.co](https://evil.example`, `a)b@c.co`, пробел — ошибка), соцсеть пустая ок / `http://…` / пробел — ошибка, 5 колонок / 9 ссылок / 5 юр-ссылок / пустой title / пустой label / плохой href — ошибка с путём; `toSettingsInput` — пустые тексты → `null`, соцсеть пустая → `null`, e-mail без пробелов по краям; хелперы футера: `addColumn` не добавляет пятую, `addLink` не добавляет девятую, `moveColumn` на границе — копия без изменений, `removeColumn`/`removeLink` по индексу, `setLink` не мутирует исходник; `toAboutInput`: пустое → `null`, фото → ключ бакета (`toStoragePath`), заданное сохраняется как есть (переводы строки/`*` не трогаем); `ugAboutSchema`: фото задано, alt пустой → ошибка у alt; фото пусто, alt пусто — ок; `toLegalInput`: пробельный body → `null`, длина > 200000 — ошибка схемы.
- [ ] **Step 2: падающие тесты `ugStatic.test.ts`** (паттерн `ugHome.test.ts`, мок `getDb`): `normalizeFooter` — валидный массив как есть/`repaired=false`; не массив → `[]`/`repaired=true`; колонка с плохой ссылкой теряет эту ссылку; колонка без валидных ссылок отбрасывается; 5-я колонка отброшена; `getUgSiteSettings` отдаёт `footerRepaired`; `saveUgSiteSettings` вызывает `rpc('save_site_settings', { p_settings })` ровно с 9 ключами; `saveUgAbout` — `rpc('save_about_page', { p_page_id, p_page, p_about })`; `saveUgLegalPage` — `update` с `body/seo_title/seo_description` по `id`, 0 строк → бросает «not found or not allowed»; `describeStaticSaveError`: `P0002` → текст про повторный вход, `23514` → сообщение RPC без изменений, `22023` → «Invalid data».
- [ ] **Step 3:** `npx vitest run src/lib/ugStatic.test.ts src/features/ug-static/ugStaticForm.test.ts` → FAIL (модулей нет); реализовать по сигнатурам → PASS.
- [ ] **Step 4:** `src/lib/media.ts`: добавить `{ table: "about_content", label: "About", name: "heading", columns: ["story_image_path"] }` в `urban_gardener`. **Step 5:** commit `feat(ug-static): data layer and form logic`.

### Task 3: `RichTextEditor` — заголовки и ссылки по опции

**Files:** Modify `src/components/RichTextEditor.tsx`; Test `src/components/RichTextEditor.test.tsx` (создать, если нет)

**Interfaces — Produces:** `RichTextEditor({ id?, value, onChange, headings?: boolean, links?: boolean })` — по умолчанию оба `false` (ровно прежнее поведение). `headings` включает уровни 2–3 (`StarterKit heading: { levels: [2, 3] }`) и кнопки «Heading 2/3» (`aria-pressed`); `links` включает `link` (без автооткрытия, `openOnClick: false`, разрешены схемы `https`, `mailto`, относительные `/…`) и кнопку «Link» (`window.prompt`-free: маленький inline-инпут URL или `prompt` — выбрать проще; пустой URL снимает ссылку).

- [ ] **Step 1: тесты (настоящий TipTap в jsdom; если jsdom не тянет — `// @vitest-environment` не менять, а сверить `getMarkdown()` через `editor` из `useEditor` в тестовой обёртке):** (a) без пропсов — `## Title` и `[x](https://a.co)` приходят в `onChange` уже «сплющенными» (фиксируем прежнее поведение: регресс Cozy/Avocado); (b) `headings` + `links`: сидовый фрагмент Privacy (`## 1. Who we are`, абзац с `**[Operator details — …]**`, `[{{contact_email}}](mailto:{{contact_email}})`, список `- **A.** text`, `_ga`) после монтирования и **любой** правки возвращается с теми же `##`, ссылками, списками (допустимы только безвредные нормализации: переносы строк, экранирование `_`/`[`); (c) кнопки Heading/Link есть только при включённых опциях. Если round-trip теряет ссылку `mailto:{{…}}` или заголовок — **стоп**: ruling в ledger (кастомное расширение/другой способ) до продолжения.
- [ ] **Step 2:** реализовать; **Step 3:** `npm test` целиком (Cozy/Avocado тесты не должны меняться) → PASS. **Step 4:** commit `feat(editor): optional headings and links`.

### Task 4: Диспетчер Pages, список и маршруты

**Files:** Create `src/features/ug-static/UgPageEditRoute.tsx`; Modify `src/features/pages/PagesRoutes.tsx`, `src/features/pages/UgPagesPage.tsx`, `src/App.tsx`, `src/lazyPages.ts`; Test `PagesRoutes.test.tsx`, `UgPagesPage.test.tsx` (обновить), `UgPageEditRoute.test.tsx` (новый)

**Interfaces — Produces:** `UgPageEditRoute()` — `useParams().pageId` → `listUgPages(site)` (ключ `ugPagesKey`) → по slug: `home` → `UgHomePage`, `about` → `UgAboutPage`, `privacy|terms` → `UgLegalPage slug`; загрузка — скелетон; ошибка — alert; нет такой строки/иной slug — «Page not found.» + ссылка назад · `SiteSettingsRoute()` (в `PagesRoutes.tsx`): Urban → `UgSiteSettingsPage`, прочие сайты → `<Navigate to={/${site.slug}/pages} replace />` · маршрут `pages/site-settings` в `App.tsx` **выше** `pages/:pageId` · `UgPagesPage`: закреплённая сверху строка «Site settings» (ссылка `site-settings`, бейдж `global`, подпись «disclosure, contact, socials, footer»), затем страницы по порядку home → about → privacy → terms (прочие slug'и — после, по алфавиту; `contact` без строки в БД не появляется); счётчик показывает число страниц (без Site settings); у Homepage подпись `curated content`, у About/Privacy/Terms — `seo_title` если задан.

- [ ] **Step 1:** обновить/написать тесты: список Urban показывает Site settings первым и четыре страницы (мок `listUgPages`), ссылки ведут на `site-settings` и `/…/pages/<id>`; `PagesEditRoute` для urban → `UgPageEditRoute` (в `PagesRoutes.test.tsx` мок как «urban page edit»; cozy/avocado не изменились); `UgPageEditRoute` по slug выбирает нужный редактор (моки), чужой id → «Page not found.»; `SiteSettingsRoute` — Urban → экран, cozy/avocado → редирект на список.
- [ ] **Step 2:** реализовать (временные заглушки `UgSiteSettingsPage`/`UgAboutPage`/`UgLegalPage` — пустые компоненты с именем, реальные приходят в Tasks 5–7; заглушки не коммитить отдельно от своих задач — допустимо один коммит на Task 4 с заглушками). **Step 3:** build/lint/test зелёные; commit `feat(ug-static): pages routing by slug, site settings row`.

### Task 5: Site settings

**Files:** Create `src/features/ug-static/UgSiteSettingsPage.tsx`, `UgFooterEditor.tsx`

**Interfaces — Consumes:** Tasks 2–4. **Produces:** `UgSiteSettingsPage()` (Pages → Site settings): sticky-шапка как у `UgHomePage` (Back to pages · «Site settings» · «Unsaved changes» · View on site (корень сайта) · Save), `useBlocker` + `beforeunload`, `gcTime: 0`, `fieldset disabled` на время Save; секции: **Affiliate & prices** (textarea «Affiliate disclosure», input «Price note»; пусто — подсказка «built-in text»), **Contact** (input e-mail, обязателен; подсказка: «used by `{{contact_email}}` in Privacy and Terms»), **Social links** (Instagram/X/Pinterest; пусто = иконка скрыта), **Footer** (tagline + `UgFooterEditor` колонки; «Legal links» — тот же редактор одного списка без title, ≤4); жёлтая плашка при `footerRepaired`. `UgFooterEditor({ columns, onChange, errors, disabled })`: карточка колонки (title, ↑ ↓ ✕, список ссылок: label, href, ↑ ↓ ✕, «Add link» (disabled на 8), «Add column» (disabled на 4)), подписи ошибок у полей; всё через хелперы Task 2. Save → `saveUgSiteSettings`, затем перечитывание (сбой перечитывания ≠ сбой сохранения; как в `UgHomePage`), тосты «Saved — the changes appear on the site within a minute».

- [ ] **Step 1:** реализовать (подсказки по полям — английский; доступность: `fieldset`/`legend` на колонку, кнопки с `aria-label` «Move column 2 up», «Remove link “Contact”»). **Step 2:** `npm run build && npm run lint` зелёные. **Step 3:** commit `feat(ug-static): site settings screen`.

### Task 6: About

**Files:** Create `src/features/ug-static/UgAboutPage.tsx`

**Produces:** `UgAboutPage()`: sticky-шапка (View on site → `/about`), SEO (title ≤60 подсказка «“ — Urban Gardener” is added automatically»; description 120–155), блоки **Intro** (eyebrow, heading, intro), **Story** (фото: `ImagePreviewPicker` + `ImagePickerDialog` как в Homepage + подпись alt обязательна при заданном фото; heading; 2 абзаца), **Values** (3 карточки: иконка-эмодзи, title, text), **Newsletter block** (title с подсказкой про `*акцент*` и живым превью через `parseHeroTitle` из `features/ug-home/ugHeroTitle`, text); каждое поле с placeholder = значение референса (`UG_ABOUT_DEFAULTS`) и подсказкой «Empty — the built-in text is used»; один Save → `saveUgAbout` (RPC), перечитывание, блокер ухода, `gcTime: 0`.

- [ ] **Step 1:** реализовать; **Step 2:** build/lint; **Step 3:** commit `feat(ug-static): about screen`.

### Task 7: Privacy / Terms

**Files:** Create `src/features/ug-static/UgLegalPage.tsx`

**Produces:** `UgLegalPage({ slug }: { slug: 'privacy'|'terms' })`: sticky-шапка («Privacy policy»/«Terms of use», View on site → `/privacy|/terms`), read-only «Last updated {дата, формат как на сайте: October 16, 2026, UTC}» из `updated_at`, `RichTextEditor headings links` (body), подсказка: «Use Heading 2 for sections. Write `{{contact_email}}` where the contact address belongs — the site fills it in from Site settings.», кнопка «Use the built-in text» (очищает body → при Save в БД `null`, сайт вернёт встроенный; подсказка «Save to apply»), при `body === null` — нейтральная плашка «This page currently shows the built-in text; typing here replaces it entirely», SEO как у About; Save → `saveUgLegalPage`; перечитывание; блокер.

- [ ] **Step 1:** реализовать; **Step 2:** build/lint; **Step 3:** commit `feat(ug-static): privacy and terms screen`.

### Task 8: Тесты и проверка

- [ ] **Step 1:** делегировать `test-engineer` (проект `web.admin`, скилл `testing`, спека 5D + Review Focus): компонентные тесты `UgSiteSettingsPage` (поля из БД; Save → RPC с ожидаемым payload; пустая соцсеть → `null`; e-mail пуст/плохой — блок с сообщением; редактор футера: добавить/удалить/↑↓, лимиты 4/8/4, плохой href → ошибка у поля, плашка `footerRepaired`), `UgAboutPage` (пустое → `null`, фото без alt блокирует, превью акцента, незатронутое не очищается — payload ключей), `UgLegalPage` (round-trip сидового markdown без потери заголовков/ссылок, «Use the built-in text» → `body: null`, «Last updated» формат, «Not found»/0 строк → ошибка), `UgPageEditRoute`, блокер ухода при несохранённом. Vitest+RTL; e2e для админки не пишем (нужна живая сессия админа — ручная приёмка по плану владельца §6).
- [ ] **Step 2:** принять отчёт; код≠спека → не чинить тест, вынести. Commit `test(ug-static): admin screens`.
- [ ] **Step 3:** `verification-before-completion`: `npm run build`, `npm run lint`, `npm test` — реальный вывод, числа в ledger.
- [ ] **Step 4:** ревьюеры (только читают): `react-reviewer`, `typescript-reviewer`, `a11y-architect`, `silent-failure-hunter` по `src/lib/ugStatic.ts`, `src/features/ug-static/*`, `RichTextEditor.tsx`; CRITICAL/HIGH исправить или вынести владельцу. Проверку живым RPC под админской сессией (в т.ч. что `where true` пропускает `pg_safeupdate`) вынести владельцу в ручную приёмку (план §6, п. 4–8).

## Self-review (спека → задачи)

Диспетчер по slug и список со строкой Site settings → Task 4; `UgAboutPage` (SEO, Intro/Story/Values/Newsletter, пустое = встроенный текст, один Save → RPC) → Task 6; `UgLegalPage` (markdown-редактор, SEO, Last updated, View on site, «Use the built-in text», update + проверка 0 строк) → Tasks 3, 7; `UgSiteSettingsPage` (Affiliate/Contact/Social/Footer, валидация href, RPC) → Tasks 2, 5; слой данных, ключи, ошибки `22023/23514/P0002` → Task 2; `USAGE_SOURCES` → Task 2; регресс Cozy/Avocado/Homepage → Tasks 3, 4; тесты и ревью-гейт админки → Task 8. Документация 5F (`admin-panel/static-pages-urban-gardener.md`, `status.md`, `AGENTS.md`) — после 5D, вне этого плана.
