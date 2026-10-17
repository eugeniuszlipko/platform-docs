# About / Privacy / Terms и Site settings Urban Gardener — контракт админки

> Last updated: 2026-10-17 | Проект: web.admin, `src/features/ug-static/` + `src/lib/ugStatic.ts`, список — `src/features/pages/UgPagesPage.tsx`,
> диспетчер — `PagesRoutes.tsx` (`PagesEditRoute` → `UgPageEditRoute`, `SiteSettingsRoute`), маршрут `pages/site-settings` — `App.tsx`.
> Сайт-потребитель — urban.gardener (`app/{about,privacy,terms}/page.tsx`, `lib/static-pages*.ts`, `app/layout.tsx`). Схема БД —
> [../database/schema.md](../database/schema.md) §10 (`pages.body`, `about_content`, `site_settings`, миграции 0017–0020). Решения — [../sites/urban-gardener.md](../sites/urban-gardener.md) D34–D35.
> Образцы — [home-urban-gardener.md](home-urban-gardener.md) (паттерн экрана), Avocado `about_content`/`footer_settings`.

## 1. Где живёт

Всё — в **Pages** (`/:siteSlug/pages`). Список Urban: закреплённая строка **Site settings** (бейдж `global`, маршрут `pages/site-settings`,
стоит в роутере выше `pages/:pageId`), затем Homepage, About, Privacy, Terms. Строки `pages` заводят миграции (создать/удалить из админки нельзя).
`PagesEditRoute` для Urban — `UgPageEditRoute`: по `:pageId` находит строку и выбирает редактор **по её slug** (`home` → Homepage, `about` → About,
`privacy`/`terms` → текст); чужой id или страница без редактора (`contact`) → «Page not found.». У Cozy/Avocado поведение не менялось.

## 2. Экраны (общее)

Паттерн Homepage: sticky-шапка (Back to pages · заголовок · «Unsaved changes» · View on site · Save), форма RHF + zod, `useBlocker` + `beforeunload`
при несохранённых правках (диалог Stay/Discard/Save), `fieldset disabled` на время Save, запрос `gcTime: 0`, перечитывание после Save **отдельным шагом**
(его сбой ≠ сбой сохранения: «Saved» + предупреждение). Пустое необязательное поле → `null` (сайт берёт встроенный текст; в поле виден placeholder с этим текстом).
Правка видна на сайте через ≤ 1 мин (ISR 60 с у страниц и у layout).

## 3. Site settings

Один Save → RPC `save_site_settings` (11 ключей: `affiliate_disclosure`, `price_note`, `contact_email`, `instagram_url`, `x_url`, `pinterest_url`, `footer_tagline`, `footer_columns`, `footer_legal_links`, `header_brand`, `nav_links`).
- **Header** (первый блок экрана): **Header brand** — надпись рядом с логотипом (пусто → встроенная «Urban Soul of Plants»); **Menu** (`UgMenuEditor`) — 1–6 пунктов `{подпись, адрес}`, ↑ ↓ ✕ и «Add item», те же правила ссылок, что у футера; пустое меню сохранить нельзя. Меню шапки и мобильное меню сайта берутся из одного списка; подсветка «своего» раздела остаётся: пункт активен на своём адресе и на вложенных (`/articles/…`), а для стандартных адресов `/articles` и `/shop` сайт сам добавляет «темы → Articles» и «товар → Shop». **Название сайта «Urban Gardener»** (подвал, ©, суффикс заголовков вкладок) в админке НЕ редактируется — решение владельца 2026-10-17.
- **Affiliate & prices:** оговорка о партнёрских ссылках (страница товара и низ `/shop`), price note.
- **Contact:** e-mail — **обязательное** поле (белый список символов); подставляется вместо `{{contact_email}}` в Privacy/Terms. Пустой/неверный адрес в БД сайт заменяет адресом по умолчанию.
- **Social links:** Instagram/X/Pinterest — `https://…` без пробелов; пусто → иконка скрыта в шапке и меню.
- **Footer:** подпись; колонки (`UgFooterEditor`): до 4 колонок × до 8 ссылок, ↑ ↓ ✕ у колонок и ссылок, подписи ошибок у полей; нижние юр-ссылки до 4 (0 допустимо — нижняя строка скрыта). `href`: `/путь`, `https://…`, `mailto:…`.
- Если в БД лежал негодный jsonb (правка мимо админки), экран показывает только годное и жёлтую плашку («footer data in the database was invalid» / «The menu in the database was invalid») — Save чинит.

## 4. About

SEO (title ≤ 60 подсказка, «— Urban Gardener» добавляется автоматически; description 120–155) + блоки Intro (eyebrow, headline, intro), Story (фото из галереи/внешний https-URL,
**alt обязателен, если фото выбрано**; headline, два абзаца), Values (3 карточки: эмодзи-иконка, title, text), Newsletter block (title с `*акцентом*` и живым превью, text; форма на сайте неактивна до Фазы 6).
Один Save → RPC `save_about_page` (SEO страницы `about` + `about_content` одной транзакцией); все 19 ключей `about_content` уходят каждый раз (пустое → `null`). Фото учитывается в Media → «Used by» (`about_content.story_image_path`).

## 5. Privacy / Terms

**Page header** (первый блок экрана): **Eyebrow** (по умолчанию «Legal»), **Headline** (по умолчанию «Privacy policy» / «Terms of use») и **Line under the headline** (по умолчанию автоматическое «Last updated {дата}», обновляется при каждом Save; свой текст заменяет его целиком, например фиксированную дату). Пустое поле — встроенное значение. Хранится в колонках `pages.hero_eyebrow` / `hero_title` / `hero_description` строки страницы (миграция не нужна: колонки есть с Фазы 4); лимиты 40 / 80 / 160. Сайт: `LegalArticle` (`eyebrow`, `title`, `subtitle`); заголовок вкладки браузера берётся из SEO title (или встроенного названия), а не из Headline.

Редактор — общий `RichTextEditor` с **включёнными** `headings` (h2/h3) и `links` (кнопки Heading 2/3 и Link; адрес вводится через `window.prompt`, допустимы `/page`, `https://…`, `mailto:…`).
Без этих опций markdown из БД при открытии «сплющивался» бы (заголовки → текст, ссылки → без адреса) — по умолчанию (Cozy/Avocado) поведение редактора прежнее.
TipTap при сериализации экранирует `_` в тексте (`{{contact\_email}}`) — сайт подставляет e-mail в обе формы. «Last updated» — только чтение (`pages.updated_at`, UTC), обновляется при каждом Save страницы (в т. ч. при правке одного SEO).
Кнопка **Use the built-in text** очищает текст → `body = null` → сайт показывает встроенный (юридическая страница не бывает пустой); заметка о встроенном тексте. Save — прямой `update pages … select('id')` + `mustAffect` (0 строк → ошибка, не «Saved»).

## 6. Правила (зеркала — менять во всех местах сразу)

Ссылки (`isSafeHref`), e-mail (`UG_EMAIL`) и лимиты (4/8/4) совпадают в: БД (миграции 0017/0020: `is_safe_href`, `valid_links`, `valid_footer_columns`, CHECK и RPC), сайте (`lib/static-pages-utils.ts`), админке
(`src/lib/ugStatic.ts`, `ugStaticForm.ts`). Тексты по умолчанию (`UG_ABOUT_DEFAULTS`, `UG_SETTINGS_DEFAULTS`) — копия `ABOUT_FALLBACK` и констант `lib/site.ts` сайта (placeholder'ы полей); `ugHeroTitle.parseHeroTitle` — как у Homepage.

## 7. Ошибки сохранения

`P0002` → «Not found or not allowed — sign in again and retry» · `22023` → «Invalid data — reload the page and try again» · `23514` → текст проверки БД как есть · прочее — `humanizeError`.

## 8. Проверено / не проверено

Автоматически: данные и формы (`ugStatic.test.ts`, `ugStaticForm.test.ts`), экраны Site settings / About / Legal, диспетчер, round-trip markdown через настоящий TipTap (`RichTextEditor.test.tsx`, `UgLegalPage.test.tsx`).
**Не гонялось:** сохранение под живой сессией администратора (нужен вход владельца) — в частности что RPC с `where true` проходит `pg_safeupdate` PostgREST (у роли `authenticator` он включён), реальный набор текста и диалог ссылки в TipTap
(jsdom не поддерживает ввод в ProseMirror). Ручная проверка — по плану Фазы 5 §6, п. 4–8.
