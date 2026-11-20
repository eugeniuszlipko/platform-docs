# Главная Urban Gardener (Pages → Homepage) — контракт админки

> Last updated: 2026-11-20 (Фаза R, §2) | Проект: web.admin, `src/features/ug-home/` + `src/lib/ugHome.ts`, страница списка —
> `src/features/pages/UgPagesPage.tsx`, диспетчер — `PagesRoutes.tsx` (ветка `urban_gardener`).
> Сайт-потребитель — urban.gardener (`app/page.tsx`, `lib/home.ts`). Схема БД — [../database/schema.md](../database/schema.md) §10
> (`pages`, `home_slots`, миграции 0012–0015). Решения — [../sites/urban-gardener.md](../sites/urban-gardener.md) D31–D32.
> Образец — [home-avocado-kiss.md](home-avocado-kiss.md).

## 1. Где живёт

Отдельного пункта меню нет: **Pages → Homepage** (`/:siteSlug/pages/:pageId`, строка `pages` со slug `home`). В меню Urban пункт
`Pages` добавлен в `sections`. С Фазы 5 список Pages содержит ещё Site settings, About, Privacy, Terms — см.
[static-pages-urban-gardener.md](static-pages-urban-gardener.md); `PagesEditRoute` выбирает редактор по `page.slug` (`UgPageEditRoute`), поэтому
чужой id больше не открывает Homepage («Page not found.»). Маршруты `pages` общие с Cozy/Avocado: диспетчер по `site.schema`
(поведение Cozy/Avocado не менялось, регрессионный тест `PagesRoutes.test.tsx`).

## 2. Экран

Один экран, один Save; черновик карточек лежит в значении RHF-формы (поле `cards`), поэтому `isDirty`, `useBlocker`, «Unsaved changes»
и Save общие у текстов и слотов.

- **Hero texts:** eyebrow, Headline (`textarea` на 2 строки: Enter — перенос; слова в `*звёздочках*` на сайте зелёные) с живым
  предпросмотром (`ugHeroTitle.parseHeroTitle` — копия правил сайта, менять в обоих репо), Intro text. Пустое → `null` → сайт берёт фолбэк.
- **Illustration** (в блоке Hero texts): иллюстрация справа внизу hero (по умолчанию — встроенный лист). Выбор из галереи Media или внешний https-URL; ключ хранится плоским (`toStoragePath`), `http://` отклоняется; кнопка «Use the built-in leaf» очищает поле. Рекомендация: PNG/WebP с прозрачным фоном без пустого поля снизу (SVG админка не загружает). Картинка декоративна (alt пустой) и вписывается в бокс 380×508 с прижатием к нижней границе. Используется в Media → «Used by» (`pages.hero_image_path`).
- **SEO:** title (подсказка ≤ 60, на сайте выводится как есть, без имени сайта), description (подсказка 120–155). Пустое → дефолты сайта.
- **Три слота** (`UgHomeSlotsEditor`): «This week's read» (1 статья), «From the journal» (до 6 статей), «Plants & everything they need»
  (до 3 товаров). Карточка: миниатюра, название (ссылка на статью/товар), бейджи `Draft` (статья/товар не опубликован) и `Hidden`
  (слот выключен переключателем «Shown»), стрелки ↑/↓, удаление. Add открывает пикер (`UgHomePickerDialog`): поиск по названию,
  опубликованные первыми, **не показывает** уже добавленное в слот (для статейных слотов — стоящее в featured **или** journal).
  Add неактивна на ёмкости. Одна статья в featured и journal (допустимо в БД) — жёлтое предупреждение; сайт покажет её один раз.
- **Фаза R (2026-11-20; ветка `feat/phase-r`, не влито): режимы Auto/Manual.** У «From the journal» и «Plants & everything they need» переключатель Auto/Manual (колонки `pages.journal_mode`/`shop_mode`, миграция 0040) со списком-предпросмотром того, что сайт показывает сейчас. Auto-журнал — 6 последних опубликованных статей без featured; Auto-магазин — последние товары, плюс select «limit» 6/9/12 (`pages.shop_limit`). «This week's read» остаётся ручным. Ёмкость Manual-слота магазина — 12 (было 3). Редактор карточек (с ёмкостью, стрелками и пикером) остаётся для Manual; ключи `journal_mode`, `shop_mode`, `shop_limit` уходят в RPC `save_home_page` внутри `p_page`. Код — `src/features/ug-home/`, `src/lib/ugHome.ts`. Описание ёмкости 1/6/3 выше относится к режиму до Фазы R (для shop теперь 12).
- **Неполный слот Save не блокирует** (решение владельца): жёлтая подсказка «Empty — this section will be hidden…» /
  «N of M cards will be shown…». Карточка «заполняет место» (`isRenderable`), только если слот включён И статья/товар опубликованы.

## 3. Сохранение

Один вызов RPC **`save_home_page(p_page_id, p_page, p_slots)`** (`lib/ugHome.ts → saveUgHome`): `p_page` — объект с шестью ключами (+ `hero_image_path`)
(пустое → `null`), `p_slots` — карточки всех слотов по порядку (`{id?, slot, article_id | product_id, is_published}`; позиции из
порядка внутри слота). После успеха экран **отдельным шагом** перечитывается (`getUgHome`): у новых карточек появляются `id`
(иначе второй Save пересоздавал бы их). Сбой перечитывания не выдаётся за сбой сохранения: «Saved» + предупреждение перезагрузить.
Форма на время Save заблокирована (`fieldset disabled`), Discard в диалоге ухода неактивен; запрос экрана `gcTime: 0`.
Тост: «Saved — the changes appear on the site within a minute». Ключи кэша: `['ug-home', slug]`, `['ug-home-usage', slug]`, `['ug-pages', slug]`.

**getUgHome бросает, а не пропускает** нечитаемую строку слота (null-цель, неизвестный slot, неоднозначный embed): Save пересобирает
слоты целиком, и пропущенная строка исчезла бы из БД. Ошибки RPC: `23503` → «статья/товар удалены (возможно, в другой вкладке) —
перезагрузите страницу», `23505` → текст RPC (не «имя занято»).

## 4. Предупреждение при удалении

В диалогах удаления статьи (`UgArticleEditPage`) и товара (`UgProductEditPage`) — `UgHomepageUsageWarning`: «This article is on the
homepage — “From the journal”. Deleting it removes that card…» + ссылка на Homepage (запрета нет: FK каскадит слот). Данные —
`listUgHomeUsage` (ключ `['ug-home-usage', slug]`, инвалидируется после Save главной и после правок/удаления статьи/товара). Если проверка
не загрузилась — предупреждение «Couldn’t check…», пока идёт — «Checking homepage usage…» (не молчит).

## 5. Известные ограничения

- **Потерянные обновления между вкладками:** Save пересобирает слоты целиком; вкладка со старым снимком сотрёт карточки, добавленные
  в другой (как и у остальных редакторов Urban). Нужен `updated_at`-гард, если админов станет больше одного.
- Удалённая в другой вкладке статья/товар: Save падает с понятным текстом, выход — перезагрузка (правки текстов теряются).
- Сквозной сценарий под реальной админской сессией агент вживую не гонял (нужен вход владельца) — ручная проверка по плану Фазы 4 §6.
