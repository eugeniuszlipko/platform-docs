# Urban Gardener — Фаза 4 (Home), репо `web.admin`: impl-план (шаг 4D)

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (выбрано: 6 последовательных задач в одном репо, интерфейсы общие, держу в одном контексте). Шаги — чекбоксы `- [ ]`.

**Goal:** экран Pages → Homepage для Urban Gardener: тексты hero, SEO и три списка карточек (featured 1 / journal до 6 / shop до 3), один Save через RPC `save_home_page`; предупреждение при удалении статьи/товара, стоящих на главной.

**Architecture:** образец — Avocado (`features/pages/AvocadoPageEditPage`, `features/home/*`, `docs/admin-panel/home-avocado-kiss.md`) и Urban-редакторы (`UgProductEditPage`: RHF + zod, `useBlocker`, `gcTime: 0`, блокировка формы на время Save). Черновик карточек живёт в значении формы (общие `isDirty`/блокер/Save). Данные — `lib/ugHome.ts`; чистая логика формы — `features/ug-home/ugHomeForm.ts` (red-first). Роуты `pages` общие: `PagesRoutes` получает ветку `urban_gardener`, поведение Cozy/Avocado не меняется (регрессионный тест).

**Tech Stack:** Vite + React 19 + TS, Tailwind v4 + shadcn (компоненты `src/components/ui` не править), TanStack Query, RHF + Zod, sonner, Vitest + RTL.

**Spec:** `platform-docs/sites/urban-gardener/specs/2026-10-16-phase-4-home-spec.md` (раздел «Админка», шаг 4D). Сайт и БД (4A–4C, миграции 0012–0015) готовы.

## Global Constraints

- UI-тексты (подписи, тосты, диалоги) — английский; комментарии — по-русски.
- Никакого service-role; писать только под сессией админа. Сохранение — ТОЛЬКО RPC `urban_gardener.save_home_page(p_page_id, p_page, p_slots)`: `p_page` — объект с ключами `seo_title, seo_description, hero_eyebrow, hero_title, hero_description` (пустое → `null`); `p_slots` — упорядоченный массив `{id?, slot, article_id | product_id, is_published}` (позиции из порядка внутри слота).
- Ёмкость: featured 1, journal 6, shop 3. Переполнение — Add неактивна. Неполный слот Save **не блокирует**: жёлтая подсказка «Section will be hidden» (0 отрисуемых) / «N of M».
- Карточка «отрисуется на сайте», только если слот `is_published` И статья/товар опубликованы (иначе бейдж `Hidden` / `Draft`).
- Add-пикер не предлагает: уже добавленное в этот слот; для статейных слотов — статьи, уже стоящие в `featured` или `journal`; опубликованные первыми.
- `gcTime: 0` у запроса экрана, форма блокируется на время Save, после успеха — `reset` + инвалидация `['ug-home', slug]` и `['ug-home-usage', slug]`, тост «Saved — changes appear on the site within a minute».
- Не менять `USAGE_SOURCES` (у главной нет картинок). URL-ы и поведение Cozy/Avocado не трогать. Коммиты — локальные на `feat/home`; push/merge — только по команде.
- «Готово» каждой задачи: `npm run lint` + `npx tsc --noEmit` (или `npm run build`) + `npm test` зелёные.

## Review Focus

1. Два Save подряд без перезагрузки не дублируют слоты (после Save перечитываем `getUgHome`, у новых карточек появляются `id`).
2. Статью удалили в другой вкладке после загрузки формы: слот с несуществующей целью не должен уйти в RPC (при каскаде карточки уже нет; пикер/форма не падает на `null`-embed).
3. Статья в `featured`, затем её же пытаются добавить в `journal` — пикер её не показывает; а если стоит в обоих (допускает БД) — предупреждение, Save не блокируется.
4. Пустой hero-заголовок/SEO → `null` в RPC (сайт берёт фолбэк); заголовок с `*`/`\n` хранится как есть; предпросмотр не выполняет HTML.
5. Уход со страницы с несохранёнными правками → диалог «Discard / Save».

## File Structure

- `src/lib/ugHome.ts` (+test), `src/features/ug-home/ugHomeForm.ts` (+test), `ugHeroTitle.ts` (+test), `UgHomePage.tsx`, `UgHomeSlotsEditor.tsx`, `UgHomePickerDialog.tsx`, `UgHomepageUsageWarning.tsx`, `useUgHomepageUsage.ts`
- `src/features/pages/UgPagesPage.tsx`; правки: `PagesRoutes.tsx`, `src/config/sites.ts` (`sections` += `pages`), `UgArticleEditPage.tsx`, `UgProductEditPage.tsx` (предупреждение в диалоге удаления + инвалидация), `src/lib/ugArticles.ts` (в список статей добавить `cover_path` для миниатюр пикера)

### Task 1: Данные `lib/ugHome.ts`

Produces: `ugHomeKey(site)`, `ugHomeUsageKey(site)`, `ugPagesKey(site)`; `listUgPages(site)`; `getUgHome(site) → { page, cards }`; `saveUgHome(site, pageId, pageInput, cards)`; `listUgHomeUsage(site) → Map<targetId, UgHomeSlot[]>`; типы `UgHomeSlot`, `UgHomeCard` (`{ id?, slot, targetId, title, imagePath, is_published, targetPublished }`).
- [ ] getUgHome: `pages` (slug=home, maybeSingle) + `home_slots` с embed'ами `article:articles(id,title,cover_path,is_published)`, `product:products(id,name,image_path,is_published)`; порядок slot/position/created_at/id; строка с обоими embed = null (цель удалена) отбрасывается с `console.warn`. Нет строки `home` → ошибка «Homepage row is missing».
- [ ] saveUgHome → `rpc('save_home_page', …)`; ошибка пробрасывается.
- [ ] Тест (`ugHome.test.ts`, мок `getDb` как в `ugShop.test.ts`): payload RPC (пустые строки → null, порядок, id у существующих), `listUgHomeUsage`, отброс осиротевшей строки.

### Task 2: Чистая логика формы (red-first)

Produces (`features/ug-home/ugHomeForm.ts`): `UG_HOME_CAPACITY`, `ugHomeSchema` (zod: пять строк + `cards`), `toFormValues(home)`, `toPageInput(values)`, `isRenderable(card)`, `slotCards(cards, slot)`, `slotNotice(cards, slot) → { level: 'warn'; text } | null`, `canAdd(cards, slot)`, `pickerExcludeIds(cards, slot)`, `moveCard(cards, slot, index, delta)`, `removeCard(cards, slot, index)`, `addCard(cards, card)`, `duplicateFeaturedJournal(cards) → string[]` (заголовки). `ugHeroTitle.ts`: `parseHeroTitle` (копия правил сайта) для предпросмотра.
- [ ] Тесты: ёмкость и `canAdd`; `slotNotice` (0 отрисуемых → «Section will be hidden», 2 из 6 → «2 of 6 …», полный → null; Hidden/Draft не считаются); `pickerExcludeIds` для journal учитывает featured и наоборот, для shop — только shop; `moveCard` границы и порядок; `removeCard`; `toPageInput` пустое → null, сохраняет `\n` и `*`; `parseHeroTitle` те же кейсы, что на сайте (`*a*`, незакрытая `*`, `<script>`).
- [ ] Реализовать → PASS.

### Task 3: Экран и редактор слотов

- [ ] `UgHomePage.tsx`: `useQuery(ugHomeKey)` (`gcTime: 0`) → `UgHomeForm` (RHF + zodResolver, `useBlocker`, `beforeunload`, `fieldset disabled` на Save, sticky-шапка «Homepage» + «Unsaved changes» + Save; ссылка «View on site» = `frontendUrl`); блоки Hero texts (eyebrow `Input`, title `Textarea rows=2` с подсказкой про `*акцент*` и Enter, description `Textarea`, живой предпросмотр h-заголовка, счётчик), SEO (title ≤ 60, description 120–155: счётчики-подсказки, фолбэк-текст), три `UgHomeSlotsEditor`.
- [ ] `UgHomeSlotsEditor.tsx` (props: `slot`, `cards`, `onChange`, `site`): заголовок «This week's read (1)/From the journal (n/6)/Shop (n/3)», карточка = миниатюра + название (ссылка на статью/товар) + бейджи `Hidden`/`Draft` + переключатель «hidden on site» (is_published) + ↑/↓/удалить с `aria-label` по названию; пустой слот — пунктирная подсказка; `slotNotice` жёлтым `role="status"`; кнопка Add (неактивна на ёмкости).
- [ ] `UgHomePickerDialog.tsx`: поиск по названию, `excludeIds`, опубликованные первыми, миниатюры, бейдж Draft; `kind: 'article' | 'product'` (данные — `listUgArticles`/`listUgProducts`, общие ключи).
- [ ] После успешного Save: `getUgHome` перечитывается (форма `reset` на свежие данные), тост, инвалидация usage.

### Task 4: Pages list + роуты + sites

- [ ] `UgPagesPage.tsx` — строка «Homepage» («curated content») по образцу `AvocadoPagesPage` (без Footer-ссылки); `PagesRoutes`: ветка `urban_gardener` → `UgPagesPage` / `UgHomePage`; `FooterEditRoute` уже уводит назад.
- [ ] `sites.ts` Urban: `sections` += `"pages"`.
- [ ] Регрессионный тест `PagesRoutes.test.tsx`: Cozy → `PagesPage`, Avocado → `AvocadoPagesPage`, Urban → `UgPagesPage` (моки страниц).

### Task 5: Предупреждение при удалении

- [ ] `useUgHomepageUsage(site, kind, id)` (`['ug-home-usage', slug]` → `listUgHomeUsage`; ссылка на Homepage по `ugPagesKey`) + `UgHomepageUsageWarning` («This article is on the homepage — From the journal. Deleting it removes that card. Open the homepage…») в диалогах удаления `UgArticleEditPage` и `UgProductEditPage`; после удаления/сохранения статьи/товара инвалидируются `ugHomeKey` и `ugHomeUsageKey`.

### Task 6: Тесты и проверка

- [ ] `test-engineer`: компонентные тесты `UgHomePage` (загрузка, Save → RPC-вызов с payload, блокировка формы, неполные слоты не блокируют Save, Add disabled на ёмкости, пикер скрывает уже выбранное), `UgHomepageUsageWarning`, `UgPagesPage`.
- [ ] `npm run build`, `npm run lint`, `npm test` в `web.admin`; браузерная проверка экрана на живой сессии невозможна агентом без входа — фиксируется в отчёте как «не проверялось».
- [ ] Ревью: `react-reviewer`, `a11y-architect`, `silent-failure-hunter` (`lib/ugHome.ts`), `typescript-reviewer`; CRITICAL/HIGH исправить.
