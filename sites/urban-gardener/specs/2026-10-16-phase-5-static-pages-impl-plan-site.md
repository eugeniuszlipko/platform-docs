# Urban Gardener — Фаза 5 (About, Privacy, Terms, Site settings), репо `urban.gardener`: impl-план (5A–5C + тесты сайта)

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (выбрано: 10 последовательных задач в одном репо с общими интерфейсами — типы/утилиты → компоненты → БД → загрузчики; цена ошибки в БД закрыта ревью-гейтом в Task 7 и Task 8). Шаги — чекбоксы `- [ ]`.

**Goal:** вместо заглушек — настоящие `/about`, `/privacy`, `/terms`; глобальные тексты (оговорки, e-mail, соцсети, футер) читаются из БД; сначала на фикстурах (5A), затем таблицы/RPC/сид (5B), затем сайт читает Supabase (5C).

**Architecture:** страницы тонкие: загрузчик + композиция. Весь доступ к данным — `lib/static-pages.ts` (в 5A тело на фикстурах, в 5C на Supabase, сигнатуры те же). Чистая логика (подстановка токена, дата, валидаторы футера, соцсети, фолбэки About) — `lib/static-pages-utils.ts`. Тексты Privacy/Terms — markdown в `pages.body`, рендер `react-markdown` без raw HTML. `Header`/`Footer`/`Disclosure`/`ProductDetail` получают данные пропсами из серверного кода; константы `lib/site.ts` остаются фолбэками и источником сида.

**Tech Stack:** Next.js 16.2.9 (читать `node_modules/next/dist/docs/` перед API), React 19, Supabase JS, `react-markdown` ^10.1.0, CSS Modules + токены `globals.css`, Vitest + RTL, Playwright (порт 3200).

**Spec:** `platform-docs/sites/urban-gardener/specs/2026-10-16-phase-5-static-pages-spec.md` (решения P1–P5 — источник истины). Админка (5D) — **отдельный impl-план `…-impl-plan-admin.md` после «утверждаю» владельца на описание экранов**; в этот план не входит. 5F (ревью-гейт целиком + документация) — после 5D.

## Global Constraints

- UI на английском; документация на русском; никакого hex вне `:root` — только `var(--token)`; новая величина → новый токен.
- `/about`, `/privacy`, `/terms`: SSG + `export const revalidate = 60`, **нет `searchParams`**, **нет `loading.tsx`**; один `h1`; временный `robots: noindex` со страниц убран (сайт закрыт layout'ом до Фазы 9); canonical `/about|/privacy|/terms`; `/nope` остаётся 404.
- `app/layout.tsx`: `export const revalidate = 60`; `next build` по-прежнему показывает страницы как `○`/`●` (не динамические).
- Markdown из БД: **без raw HTML** (react-markdown по умолчанию), `javascript:`/`data:`-ссылки блокируются, `h1`→`h2`, внешние ссылки `target="_blank" rel="noopener noreferrer"`, допустимые элементы: `p ul ol li strong em a h2 h3 br`. Никакого `dangerouslySetInnerHTML`.
- Пустое/`null` поле БД → встроенный текст (фолбэк = константы референса/сида); нет строки `pages.<slug>`/singleton → `console.error` + фолбэк (не падение); ошибка Supabase → `throw` через `fail()` (ISR сохраняет прошлую страницу).
- Токен `{{contact_email}}` подставляется на сервере; пустой `contact_email` → токен остаётся и логируется; незнакомые токены не трогаются.
- Битый jsonb футера (не массив, >4 колонок, >8 ссылок, пустой `label`, `href` не `/…`/`https://`/`mailto:`) → фолбэк `FOOTER_COLUMNS`/`LEGAL_LINKS` + `console.error`; пустая ссылка соцсети → иконка не рендерится.
- Блок рассылки на About — тот же `NewsletterPlaceholder` (не `<form>`, `disabled`), но с уникальными `id` (на странице может быть один экземпляр — id параметризуется пропсом).
- Миграции: uuid, `created_at`/`updated_at` + триггер `public.set_updated_at`, `check (… <> '')`, `revoke all … from anon, authenticated` → точечные `grant`, RLS «Public read» + «Admin all», RPC `security invoker` + `set search_path = ''` (шаблон 0012/0015). Нумерация 0017–0019; правки по ревью — 0020+.
- URL-ы Cozy/Avocado не трогать. Не `rm -rf .next`, не запускать второй `next dev`. Коммиты — локальные на `feat/static-pages`; push/merge — только по команде. Документы `platform-docs` не коммитить.
- «Готово» каждой задачи: `npm run lint` + `npx tsc --noEmit` + `npm test` зелёные; `npm run build` — в задачах страниц/метаданных и в конце.

## Review Focus

1. Privacy/Terms `body` с `<script>`, `<img onerror>`, `[x](javascript:alert(1))`, `# h1`, пустыми/пробельными строками → ничего исполняемого в DOM, нет второго `h1`, пустое/пробельное → встроенный текст.
2. `footer_columns` jsonb: `null`, `{}`, `[]`, 5 колонок, колонка без ссылок, ссылка с `javascript:`, `label` из пробелов → фолбэк и `console.error`, футер всегда с колонками; `footer_legal_links = []` → нижняя навигация не рендерится (не пустой `<nav>`).
3. `contact_email = null`/пусто, а в тексте `{{contact_email}}` → токен остаётся и логируется, ссылка `mailto:undefined` не появляется; `{{unknown}}` не трогается; e-mail с `$&` / `$1` не ломает подстановку (replace-функцией, не строкой).
4. Одна из соцсетей пуста (`x_url = null`) → иконки X нет ни в шапке, ни в меню; все пустые → блока иконок нет вообще; не-`https` URL из БД отбрасывается.
5. `pages.updated_at` невалидна/в другой зоне → «Last updated» корректна по UTC (`formatLegalDate('2026-10-16T23:30:00-05:00')` = `October 17, 2026`); невалидная дата → строка «Last updated» не рендерится, а не «Invalid Date».

## File Structure

- `lib/static-pages.types.ts`, `lib/static-pages-utils.ts` (+test), `lib/static-pages.fixtures.ts` (+test сверки с сидом), `lib/static-pages.ts` (загрузчики), `lib/static-pages.mappers.ts` (+test, 5C)
- `components/legal/{MarkdownText,LegalArticle}` (+css, +test), `components/about/{AboutIntro,AboutStory,AboutValues,AboutTip}` (+css)
- Правки: `components/Header.tsx`, `components/Footer.tsx`, `components/shop/{Disclosure,ProductDetail}.tsx`, `app/layout.tsx`, `app/shop/(hub)/page.tsx`, `app/product/[slug]/page.tsx`, `components/home/NewsletterPlaceholder.tsx` (проп `idPrefix`), `lib/site.ts` (комментарии: константы = фолбэк/сид), `app/{about,privacy,terms}/page.tsx`, `app/coming-soon-pages.test.tsx` (только `/contact`)
- `supabase/migrations/0017_static_pages_tables.sql`, `0018_seed_static_pages.sql`, `0019_static_pages_rpc.sql`
- `e2e/static-pages.spec.ts`

### Task 1: Базовая линия

**Files:** — (ветка `feat/static-pages` уже создана в обоих репо от `main`)

- [ ] **Step 1:** в `urban.gardener`: `npm test && npm run lint && npx tsc --noEmit` — записать число пройденных тестов как базовую линию.
- [ ] **Step 2:** прочитать в `node_modules/next/dist/docs/` разделы про `revalidate` в layout/route segment config и `generateMetadata`/`alternates.canonical` (Next 16); сверить через Context7 `react-markdown` v10 (`allowedElements`, `unwrapDisallowed`, `components`, `urlTransform`). Выводы — в ledger.

### Task 2: Типы и чистая логика (red-first)

**Files:** Create `lib/static-pages.types.ts`, `lib/static-pages-utils.ts`; Test `lib/static-pages-utils.test.ts`

**Interfaces — Produces** (`lib/static-pages.types.ts`):
```ts
export type SiteSettings = {
  affiliateDisclosure: string; priceNote: string; contactEmail: string | null
  socials: SocialLink[]            // уже отфильтрованные: только непустые https-URL
  footerTagline: string
  footerColumns: FooterColumn[]; footerLegalLinks: NavLink[]
}
export type AboutCard = { icon: string; title: string; text: string }
export type AboutContent = {
  eyebrow: string; heading: string; intro: string
  storyImagePath: string; storyImageAlt: string; storyHeading: string; storyBody1: string; storyBody2: string
  cards: [AboutCard, AboutCard, AboutCard]; tipTitle: string; tipText: string
}
export type StaticPage = { slug: 'about'|'privacy'|'terms'; seoTitle: string | null; seoDescription: string | null; body: string | null; updatedAt: string | null }
export type LegalSlug = 'privacy' | 'terms'
```
**Produces** (`lib/static-pages-utils.ts`): `applyPlaceholders(markdown: string, values: { contact_email: string | null }): string` · `formatLegalDate(iso: string | null | undefined): string | null` (`October 16, 2026`, en-US, UTC; невалидное → `null`) · `parseFooterColumns(json: unknown): FooterColumn[] | null` · `parseLegalLinks(json: unknown): NavLink[] | null` (`null` = невалидно → вызывающий берёт фолбэк и логирует) · `isSafeHref(href: unknown): href is string` (`/…` не `//…`, `https://…`, `mailto:…`) · `buildSocialLinks(s: { instagram_url: string|null; x_url: string|null; pinterest_url: string|null }): SocialLink[]` (порядок instagram, x, pinterest; пусто/не-https — пропуск) · `ABOUT_FALLBACK: AboutContent` (реэкспорт из фикстур не нужен: константа живёт здесь, фикстуры/сид сверяются с ней) · `resolveAbout(row: Partial<Record<AboutColumn, string|null>> | null): AboutContent` (каждое пустое/пробельное поле → значение `ABOUT_FALLBACK`) · `resolveSettings(row: SiteSettingsRow | null): SiteSettings` (собирает фолбэки из `lib/site.ts`; ошибки валидации → `console.error` с именем поля) · `parseAccentText` — **не новая функция**: для `tip_title` используется `parseHeroTitle` из `lib/home-utils.ts` (сегмент `accent` → `<em>`).

- [ ] **Step 1: падающие тесты** (`lib/static-pages-utils.test.ts`):
  - `applyPlaceholders('Mail {{contact_email}} / {{contact_email}}', { contact_email: 'a@b.co' })` → оба токена заменены; `{{unknown}}` остаётся; email `'x$&y@z.co'` вставляется буквально; `contact_email: null` или `''` → строка без изменений.
  - `formatLegalDate('2026-10-16T12:00:00Z')` → `'October 16, 2026'`; `'2026-10-16T23:30:00-05:00'` → `'October 17, 2026'`; `'nonsense'`, `''`, `null`, `undefined` → `null`.
  - `isSafeHref`: `'/shop'`, `'/articles?level=beginner'`, `'https://x.co'`, `'mailto:a@b.co'` → true; `'//evil.co'`, `'javascript:alert(1)'`, `'http://x.co'`, `'data:text/html,x'`, `''`, `42`, `null` → false.
  - `parseFooterColumns`: валидный массив из 3 колонок → тот же результат; `null`, `{}`, `'x'`, `[]`, 5 колонок, колонка без `links`/с 9 ссылками/пустым `title`, ссылка с `javascript:`/пустым `label`/лишним типом → `null`; `label` с пробелами по краям триммится.
  - `parseLegalLinks`: `[]` → `[]` (пусто допустимо); 5 ссылок → `null`; невалидный `href` → `null`; `null`/не-массив → `null`.
  - `buildSocialLinks`: все три → порядок instagram/x/pinterest с подписями `Instagram`/`X`/`Pinterest`; `x_url: null` и `''` → X пропущен; `'http://x.com'` и `'javascript:x'` → пропущены; все пустые → `[]`.
  - `resolveAbout(null)` → `ABOUT_FALLBACK` (ключевые фразы референса: `heading` содержит «calm, not complicated», 3 карточки с иконками 🌱 🔬 💚); строка с `heading: '  '` и `card2_title: null` → фолбэки по этим полям, остальные из строки.
  - `resolveSettings(null)` → значения из `lib/site.ts` (`AFFILIATE_DISCLOSURE`, `PRICE_NOTE`, `FOOTER_COLUMNS`, `LEGAL_LINKS`, `SOCIAL_LINKS`, `contactEmail: 'hello@urbansoulofplants.com'`); битый `footer_columns` → фолбэк-колонки и `console.error` вызван; пустой `footer_tagline` → `SITE_DESCRIPTION`.
- [ ] **Step 2:** `npx vitest run lib/static-pages-utils.test.ts` → FAIL (модуль не найден).
- [ ] **Step 3:** реализовать по сигнатурам. `applyPlaceholders` — `replace(/\{\{contact_email\}\}/g, () => email)`; валидатор футера — ручной, без `as`; `formatLegalDate` — `Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })`. `lib/site.ts`: добавить `CONTACT_EMAIL = 'hello@urbansoulofplants.com'`, обновить комментарии (константы = фолбэк/сид с Фазы 5).
- [ ] **Step 4:** тот же запуск → PASS. **Step 5:** `git commit -m "feat(static-pages): types and pure logic"`.

### Task 3: Тексты — фикстуры About/Privacy/Terms/настроек

**Files:** Create `lib/static-pages.fixtures.ts`, `lib/static-pages.fixtures.test.ts`

**Interfaces — Produces:** `ABOUT_ROW_FIXTURE` (все колонки `about_content` с текстом референса — спека «Тексты»), `PRIVACY_BODY`, `TERMS_BODY` (markdown; `##`-заголовки, абзацы, списки, ссылки; токен `{{contact_email}}`; пометка `[Operator details — legal name and country — to be added before launch]` в «Who we are» Privacy и в начале Terms), `SETTINGS_ROW_FIXTURE` (значения из констант `lib/site.ts`, `contact_email` = `CONTACT_EMAIL`).

- [ ] **Step 1:** написать тексты, адаптируя `cozycorner/app/{privacy,terms}/page.tsx` и `avocado.kiss/app/{privacy,terms}/page.tsx` (читать целиком): бренд «Urban Soul of Plants», журнал + каталог с партнёрскими ссылками Amazon, рассылка (подписка + Cloudflare Turnstile), форма Contact, cookie-согласие + GA4 (отказ = ни одного запроса к Google), поставщики только реальные (Vercel, Supabase, Google, Cloudflare; e-mail-провайдер не называть), права GDPR/CCPA, дети, международные передачи, хранение, изменения, контакты через `{{contact_email}}`. Заголовки только `##`. Без выдуманных фактов о компании.
- [ ] **Step 2: тесты фикстур:** `PRIVACY_BODY`/`TERMS_BODY` непусты, содержат `{{contact_email}}` и пометку оператора, не содержат `# ` (h1), `<`, `javascript:`; в Privacy есть слова `newsletter`, `Turnstile`, `Google Analytics`, `affiliate`; `ABOUT_ROW_FIXTURE.heading` = «We're here to make plant care feel calm, not complicated»; `resolveAbout(ABOUT_ROW_FIXTURE)` совпадает с `ABOUT_FALLBACK` по всем полям (фолбэк = сид); `resolveSettings(SETTINGS_ROW_FIXTURE)` без `console.error`.
- [ ] **Step 3:** `npx vitest run lib/static-pages.fixtures.test.ts` → PASS. **Step 4:** commit `feat(static-pages): page texts and fixtures`.

### Task 4: Компоненты `legal/*` и `about/*` (5A)

**Files:** Modify `package.json` (+lock: `npm i react-markdown@^10.1.0` — сверено с Cozy/Avocado), `components/home/NewsletterPlaceholder.tsx` (+ тест Phase 4 остаётся зелёным); Create `components/legal/{MarkdownText,LegalArticle}.tsx` + `.module.css`, `components/about/{AboutIntro,AboutStory,AboutValues,AboutTip}.tsx` + `.module.css`

**Interfaces — Produces:**
- `MarkdownText({ content, className? }: { content: string; className?: string })` — серверный; `ReactMarkdown` с `allowedElements`, `unwrapDisallowed`, `components`: `h1` → `h2`, `a` → внешняя ссылка с `target="_blank" rel="noopener noreferrer"`, внутренняя (`/…`) — `next/link`, `urlTransform` пропускает только `isSafeHref` (иначе `''` → ссылка без `href` рендерится как текст).
- `LegalArticle({ eyebrow = 'Legal', title, updatedAt, body }: { eyebrow?: string; title: string; updatedAt: string | null; body: string })` — `PageHead` (eyebrow «Legal», h1, «Last updated {formatLegalDate}» только если дата валидна) + `<div className="narrow article-body">` с `MarkdownText`; типографика как у `ArticleBody.module.css` (токены, не копипаст hex).
- `NewsletterPlaceholder({ idPrefix = 'home-tip' }: { idPrefix?: string })` — `id` = `${idPrefix}-email`/`${idPrefix}-soon`.
- `AboutIntro({ content })` — `PageHead` (eyebrow, h1, intro); `AboutStory({ content })` — `.about-grid` (фото `next/image` через `resolveImage(path, 900)`, внешний Unsplash → `unoptimized`; alt из контента; `h2` + 2 абзаца; на ≤920px — колонка); `AboutValues({ cards })` — три карточки (иконка-эмодзи `aria-hidden`, `h3`, текст; ≤860px — 2 колонки, ≤560px — 1); `AboutTip({ title, text })` — `TipBlock` с заголовком из `parseHeroTitle` (акцент → `<em>`) + `NewsletterPlaceholder idPrefix="about-tip"`, обёрнутый в `wrap`.

- [ ] **Step 1:** `npm i react-markdown@^10.1.0`; реализовать компоненты по интерфейсам; стили сверять с `mockups/Urban Gardener.html` (`.about-grid` стр. 209–212, `.values/.value` 213–217, `.article-body` 189–195, адаптив 288/309); новые значения → токены в `globals.css`.
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint && npx vitest run components/home` → чисто. **Step 3:** commit `feat(static-pages): legal and about components`.

### Task 5: Страницы `/about /privacy /terms`, Header/Footer/Disclosure на пропсах (5A)

**Files:** Create `lib/static-pages.ts`; Modify `app/about/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/layout.tsx`, `components/Header.tsx`, `components/Footer.tsx`, `components/shop/Disclosure.tsx`, `components/shop/ProductDetail.tsx`, `app/shop/(hub)/page.tsx`, `app/product/[slug]/page.tsx`, `app/coming-soon-pages.test.tsx`; тесты Header/Footer/Disclosure/ProductDetail обновить под пропсы

**Interfaces — Produces** (`lib/static-pages.ts`, в 5A тело на фикстурах — шапка файла: «в 5C заменяется чтением Supabase»): `fetchStaticPage = cache(async (slug: 'about'|'privacy'|'terms'): Promise<StaticPage>)` · `fetchAboutContent = cache(async (): Promise<AboutContent>)` · `fetchSiteSettings = cache(async (): Promise<SiteSettings>)`. **Consumes:** `resolveAbout`, `resolveSettings`, `applyPlaceholders`, `formatLegalDate`, фикстуры.
Пропсы: `Header({ socials }: { socials: readonly SocialLink[] })` · `Footer({ settings }: { settings: Pick<SiteSettings,'footerTagline'|'footerColumns'|'footerLegalLinks'> })` · `Disclosure({ text, className? })` · `ProductDetail` получает `affiliateDisclosure`/`priceNote` пропсами.

- [ ] **Step 1:** страницы: `export const revalidate = 60`; `about`: `fetchAboutContent()` → `AboutIntro` → `AboutStory` → `AboutValues` → `AboutTip`; `privacy`/`terms`: `fetchStaticPage(slug)` + `fetchSiteSettings()` → `LegalArticle` с `body = applyPlaceholders(page.body ?? FALLBACK_BODY, …)`; `generateMetadata`: `title: page.seoTitle ?? 'About us'|'Privacy policy'|'Terms of use'` (без `absolute`), `description` фолбэк, `alternates: { canonical: '/about' }`; убрать `robots`.
- [ ] **Step 2:** `app/layout.tsx`: `export const revalidate = 60`, `async RootLayout`, `const settings = await fetchSiteSettings()` → `Header socials`/`Footer settings`. Footer: подпись из `settings.footerTagline`, колонки/юр-ссылки — из настроек; пустой список юр-ссылок → `<nav aria-label="Legal">` не рендерится. Header: `SocialLinks` берёт `socials` пропсом (пустой массив → контейнер иконок не рендерится в обоих местах).
- [ ] **Step 3:** `Disclosure`/`ProductDetail`/страницы shop берут тексты из `fetchSiteSettings()` (серверные страницы), клиентские компоненты — только пропсом. Обновить существующие тесты на пропсы (значения — константы `lib/site.ts`). `coming-soon-pages.test.tsx` сузить до `/contact`.
- [ ] **Step 4:** `npm test && npm run lint && npx tsc --noEmit && npm run build` → зелёные; в выводе build `/about /privacy /terms /` и product/shop — `○`/`●`, не `ƒ`.
- [ ] **Step 5:** визуальная сверка в браузере (Playwright MCP) на работающем `next dev` (не запускать второй) — 1280 и 390: About (шапка, фото+история, три карточки, блок рассылки), Privacy, Terms (узкая колонка, «Last updated», e-mail внизу); сравнить с референсом; нет горизонтального скролла; `/nope` — 404. Расхождения исправить.
- [ ] **Step 6:** commit `feat(static-pages): pages and settings-driven shell on fixtures (5A)`.

### Task 6: Миграции 0017–0019 и проверка прав (5B)

**Files:** Create `supabase/migrations/0017_static_pages_tables.sql`, `0018_seed_static_pages.sql`, `0019_static_pages_rpc.sql`. Перед SQL загрузить скиллы `database-migrations`, `postgres-patterns`.

**Interfaces — Produces (БД):** `pages.body text` (+`check`); таблицы `urban_gardener.about_content`, `urban_gardener.site_settings` (singleton, unique-индекс `((true))`); RPC `urban_gardener.save_about_page(p_page_id uuid, p_page jsonb, p_about jsonb) returns jsonb` и `urban_gardener.save_site_settings(p_settings jsonb) returns jsonb` (колонки и правила — спека, «Модель данных»; ключи `p_*`: отсутствует = не трогаем, `null`/пусто = очищаем; не-объект → `22023`; не найдено/не админ → `P0002`; нарушение формата → `23514`).

- [ ] **Step 1: 0017.** `alter table pages add column body text` + `pages_body_not_blank`; `about_content` и `site_settings` по спеке (все check'и, `jsonb_typeof(footer_columns) = 'array'`, singleton-индекс, триггеры `updated_at`); гранты (revoke all → select anon; select/insert/update/delete authenticated — для singleton'ов **insert/delete authenticated не даём** (урок 0015) → select/update; all service_role; затем `revoke truncate, references, trigger … from anon, authenticated`); RLS «Public read» (`using (true)`) + «Admin all» (`public.is_admin()`).
- [ ] **Step 2: 0018 (сид, идемпотентный `on conflict do nothing`/`where not exists`).** `pages`: строки `about` (SEO null), `privacy`, `terms` (с `body` из фикстур, дословно); `about_content` — одна строка (`ABOUT_ROW_FIXTURE`); `site_settings` — одна строка (`SETTINGS_ROW_FIXTURE`, `footer_columns`/`footer_legal_links` — jsonb из `FOOTER_COLUMNS`/`LEGAL_LINKS`). Миграцию **сгенерировать скриптом из фикстур** (не переписывать руками; скрипт — в scratchpad), чтобы БД = код.
- [ ] **Step 3: 0019.** `save_about_page`: проверка типов (`p_page`, `p_about` — объекты), whitelist ключей `about_content`, SEO страницы `about` (0 строк → `P0002`), апдейт singleton (0 строк → `P0002`); пустые строки → `null`; `save_site_settings`: валидация e-mail, `https://` у соцсетей, структуры/длин/`href` jsonb футера (тот же набор правил, что `parseFooterColumns`), ошибки `23514` с понятным текстом. Образец — `0015_home_hardening.sql`. `revoke all … from public, anon; grant execute … to authenticated, service_role`.
- [ ] **Step 4: применить** по очереди через Supabase MCP (`apply_migration`; проект `base-one` — сверить по `list_projects`), затем `get_advisors` (security + performance) — новых предупреждений по новым таблицам быть не должно.
- [ ] **Step 5: проверка прав SQL** (метод — `plans/2026-10-15-phase-3-kickoff.md`: `begin; set_config('request.jwt.claims', …); set local role …; …; rollback;`, ошибки отдельными запросами): (a) anon читает `pages` (about/privacy/terms), `about_content`, `site_settings`; `insert/update/delete` и оба RPC — отказ; (b) authenticated не-админ — запись и RPC отказ; (c) админ: оба RPC сохраняют, отсутствующий ключ не трогает поле, `null` очищает; `contact_email = 'nope'` → `23514`; `x_url = 'http://x.co'` → `23514`; `footer_columns` из 5 колонок / ссылка `javascript:` / не-массив → `23514`; `footer_legal_links` из 5 → `23514`; `pages.body = '   '` → `23514`; (d) singleton: второй `insert` → нарушение unique (под service_role); (e) `truncate` под anon/authenticated запрещён (`has_table_privilege`).
- [ ] **Step 6:** ревью — субагент `database-reviewer` (только читает); CRITICAL/HIGH исправить следующей миграцией (`0020_…`) или вынести владельцу. Commit `feat(db): pages.body, about_content, site_settings, save RPCs (5B)`.

### Task 7: Сайт читает базу (5C)

**Files:** Create `lib/static-pages.mappers.ts`, `lib/static-pages.mappers.test.ts`; Modify `lib/static-pages.ts`

**Interfaces — Produces** (`lib/static-pages.mappers.ts`): `PAGE_COLUMNS = 'slug, seo_title, seo_description, body, updated_at'` · `ABOUT_COLUMNS` (явный список всех колонок `about_content`) · `SETTINGS_COLUMNS` (явный список `site_settings`) · типы `StaticPageRow`, `AboutRow`, `SettingsRow` · `rowToStaticPage(row): StaticPage` (slug вне whitelist → throw).

- [ ] **Step 1: падающие тесты маппера:** `rowToStaticPage` с `body: null` → `body: null`; slug `'home'` → бросает; колонки-константы не содержат `*` и покрывают все ключи, которые читают `resolveAbout`/`resolveSettings` (тест сверяет множества).
- [ ] **Step 2:** `npx vitest run lib/static-pages.mappers.test.ts` → FAIL; реализовать → PASS.
- [ ] **Step 3:** `lib/static-pages.ts`: три загрузчика на Supabase (`cache()`); `fetchStaticPage`: `.from('pages').select(PAGE_COLUMNS).eq('slug', slug).maybeSingle()`; ошибка → `fail(...)`; **нет строки** → `console.error('[static-pages] pages.<slug> row is missing — …')` и страница с фолбэк-текстом (`body: null`, `updatedAt: null`); `fetchAboutContent`/`fetchSiteSettings`: `.limit(1).maybeSingle()`, нет строки → `console.error` + `resolveAbout(null)`/`resolveSettings(null)`; ошибка → `fail`. Фикстуры из загрузчика убрать (остаются для тестов/сида/фолбэка текстов Privacy/Terms).
- [ ] **Step 4:** `npm test && npm run lint && npx tsc --noEmit && npm run build` → зелёные; в браузере страницы показывают сид; временно через SQL (MCP) изменить `site_settings.footer_tagline` и `pages.about`… (в `about_content.heading`) → после ревалидации (≤ 60 с) видно на сайте, затем вернуть как было (запись — через `service_role`/SQL, не меняя код).
- [ ] **Step 5:** ревью — субагент `silent-failure-hunter` на `lib/static-pages*.ts`, `app/layout.tsx`; CRITICAL/HIGH исправить. Commit `feat(static-pages): site reads Supabase (5C)`.

### Task 8: Тесты сайта (часть 5E)

**Files:** Create `components/legal/*.test.tsx`, `components/about/*.test.tsx`, `e2e/static-pages.spec.ts`

- [ ] **Step 1:** делегировать субагенту `test-engineer` (проект `urban.gardener`, спека Фазы 5, скилл `testing`): компонентные — `MarkdownText` (нет raw HTML/`<script>`, `javascript:` не становится `href`, `# h1` → `h2`, внешняя ссылка с `rel`, пустой контент), `LegalArticle` (один `h1`, «Last updated» при валидной дате и без неё), About-секции (`AboutValues` — три `h3`, иконки `aria-hidden`; `AboutTip` — акцент в `<em>`, кнопка `disabled`, нет `<form>`, `id` с префиксом), `Footer`/`Header` из пропсов (пустая соцсеть скрыта; пустые юр-ссылки — нет `nav`), страницы (`/privacy` подставляет e-mail из настроек; пустой `body` → встроенный текст); e2e `e2e/static-pages.spec.ts` (порт 3200, живой Supabase; по заголовкам/сидовому тексту): `/about /privacy /terms` 200, один `h1`, нет текста «Coming soon», ссылки футера (кроме `/contact`) ведут на 200, e-mail в Privacy = `hello@urbansoulofplants.com`, 390px без горизонтального скролла, `/nope` — 404.
- [ ] **Step 2:** принять отчёт: расхождение «код ≠ спека» — не чинить тест, вынести владельцу. Commit `test(static-pages): component and e2e tests (5E site)`.

### Task 9: Проверка, ревью-гейт сайта и стоп перед 5D

**Files:** —

- [ ] **Step 1:** `verification-before-completion`: в `urban.gardener` `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` — реальный вывод; записать числа.
- [ ] **Step 2:** ревьюеры `react-reviewer`, `typescript-reviewer`, `a11y-architect`, `seo-specialist` (метаданные трёх страниц, canonical, h-иерархия) по новому коду — только читают; CRITICAL/HIGH исправить или вынести владельцу.
- [ ] **Step 3:** записать прогресс в память агента; кратко описать владельцу экраны 5D опросным/описательным сообщением (по `meta-planning`, не документ) и ждать «утверждаю». В 5D — отдельный impl-план для `web.admin`.

## Self-review (спека → задачи)

About (структура, фолбэки, фото, карточки, tip) → Tasks 2–5; Privacy/Terms (markdown, токен, пометка оператора, дата) → Tasks 2–5; `react-markdown` + безопасный рендер → Task 4; `pages.body`, `about_content`, `site_settings`, RPC, сид, права → Task 6; загрузчики + фолбэки + `revalidate` в layout → Tasks 5, 7; Header/Footer/Disclosure/price note из настроек → Task 5; метаданные/canonical/noindex-снятие → Task 5; `ComingSoon` только у `/contact` → Task 5; тест «сид = фолбэк» → Task 3; тесты 5E (сайт) → Task 8; ревью-гейт сайта → Tasks 6, 7, 9; админка 5D и документация 5F — осознанно вне этого плана.
