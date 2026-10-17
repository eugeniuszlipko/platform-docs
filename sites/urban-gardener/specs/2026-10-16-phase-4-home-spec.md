# Urban Gardener — Фаза 4 (Home): спека для агента

> Адресат — исполняющий агент. План для владельца — [../plans/2026-10-16-phase-4-home.md](../plans/2026-10-16-phase-4-home.md) (шаблон мета-скилла). Решения владельца 2026-10-16 (ниже) приоритетнее всего, что было раньше.
> Рабочие директории: `urban.gardener/` (сайт, миграции), `web.admin/` (4D). Референс UI: `urban.gardener/mockups/Urban Gardener.html` (страница `#page-home`, строки ~355–450 и CSS).
> **Образцы:** курирование главной Avocado ([../../../admin-panel/home-avocado-kiss.md](../../../admin-panel/home-avocado-kiss.md), `schema.md` §`home_slots`/`pages`), Phase 2/3 Urban (Articles, Shop: загрузчики, мапперы, RPC, админка).

## Решения владельца (журнал; приняты 2026-10-16)

| # | Решение |
|---|---|
| H1 | **Контент главной курируется вручную слотами**, как у Avocado: отдельная таблица `home_slots`; на главной три слота — `featured` («This week's read», 1 статья), `journal` («From the journal», до 6 статей), `shop` («Plants & everything they need», до 3 товаров) |
| H2 | **Пилюли тем под hero — все темы по порядку из админки** (автоматически, `topics.position`); «For beginners» из референса отдельной пилюлей не делаем (это фильтр уровня, есть в футере и на `/articles`) |
| H3 | **Блок рассылки** («One care tip in your inbox every Saturday») на главной **показываем сейчас, кнопка неактивна** («Subscribe — coming soon», поле e-mail неактивно); настоящая подписка — Фаза 7 |
| H4 | **Тексты hero (eyebrow, заголовок, подзаголовок) и SEO главной правятся в админке: Pages → Homepage.** Для этого заводится таблица `pages` (строка `home`); About/Privacy/Terms добавит Фаза 5 в ту же таблицу |

## Цель и границы

**Цель.** Главная `/` вместо заглушки: hero → пилюли тем → «This week's read» → «From the journal» → «Plants & everything they need» → блок рассылки. Контент берётся из БД, слоты и тексты правятся из админки; сайт видит правку ≤ 1 мин (ISR).

**Не входит:** рабочая подписка (Фаза 7), поиск (6), JSON-LD/sitemap/OG-картинки (8), страницы About/Privacy/Terms и их тексты (5), превью черновиков (8), preview-токен главной, замена `/design`.
**Анти-цели:** дыра в вёрстке при пустом слоте (секция скрывается, а не рисуется пустой); черновик статьи/товара на главной (виден только опубликованное); фейковая подписка на проде.

## Что на главной (по референсу)

| Блок | Источник | Ёмкость | Пусто |
|---|---|---|---|
| Hero: eyebrow, h1 (акцентные слова), lead + декоративный лист | `pages.home` (`hero_*`) с фолбэком на константы референса | — | фолбэк-константы |
| Пилюли тем | `topics` по `position`, ссылки `/topics/<slug>` (компонент `TopicPills` без «All») | все | ряд скрыт |
| «This week's read» | слот `featured` → статья | 1 | секция скрыта |
| «From the journal» + ссылка «All articles →» | слот `journal` → статьи (`ArticleGrid`, 3/2/1 колонки) | до 6 | секция скрыта |
| «Plants & everything they need» + «Visit the shop →» | слот `shop` → товары (`ProductList`/`ProductCard` из Фазы 3) | до 3 | секция скрыта |
| Блок рассылки | `TipBlock` (константы), форма-скелет неактивна | — | всегда |

- **Featured-карточка** — горизонтальная (картинка 1.15fr / текст 1fr, на ≤ 920px — в колонку): тег «тема · уровень» (как у `ArticleCard`), заголовок h3 (по референсу крупный), excerpt, строка «автор · N min read», ссылка «Read the article →»; вся карточка — растянутая ссылка на `/articles/<slug>`; фото `preload` (LCP главной).
- **Hero h1:** строка из админки (в БД — текст с **настоящим переводом строки**, в админке — `textarea` на 2 строки). Разметка акцента: слова в `*звёздочках*` выводятся акцентом (цвет `--leaf`, не курсив), перевод строки → `<br>`; парсер безопасный (никакого HTML из БД; не закрытая `*` выводится как есть). Пример значения референса: «Plant care that⏎actually *makes sense*». Лист — декоративный SVG из референса (токены `--leaf-front-*`/`--leaf-back-*` уже есть в `globals.css`), `aria-hidden`.
- **Заголовки:** один h1 (hero), секции — h2, карточки статей/товаров внутри секций — h3; featured — h3.
- `revalidate = 60`, никаких `searchParams`; `loading.tsx` у `/` не нужен (страница статическая, 404 нет).

## Модель данных (схема `urban_gardener`, миграции с `0012`)

Общие правила как в Фазах 2–3: uuid, `created_at`/`updated_at` с триггером, RLS по шаблону 0002/0007, `revoke truncate, references, trigger … from anon, authenticated` (урок 0010), явные политики, `check (btrim(...) <> '')`.

**`pages`** — фиксированный набор страниц с SEO; create/delete из админки нет.

| Поле | Тип | Назначение |
|---|---|---|
| `slug` | text, unique, check `in ('home','about','contact','privacy','terms')` | ключ страницы (read-only в админке); в Фазе 4 засевается только `home`; `contact` в списке про запас (текст страницы Contact — Фаза 7), расширить check при необходимости — одной миграцией |
| `seo_title`, `seo_description` | text, nullable | null → фолбэк (title: `SITE_NAME — TAGLINE`, description: `SITE_DESCRIPTION`) |
| `hero_eyebrow`, `hero_title`, `hero_description` | text, nullable | тексты hero главной; null → фолбэк-константы референса |

Чтение anon: все строки. Запись и чтение админом: политика «Admin all» (`public.is_admin()`). (Фаза 5 добавит `body` и строки статических страниц; Фаза 8 — `og_image_path`.)

**`home_slots`**

| Поле | Тип | Назначение |
|---|---|---|
| `slot` | text not null, check `in ('featured','journal','shop')` | слот |
| `position` | integer not null default 0 | порядок внутри слота |
| `article_id` | uuid nullable → `articles` **on delete cascade** | для `featured`/`journal` |
| `product_id` | uuid nullable → `products` **on delete cascade** | для `shop` |
| `is_published` | boolean not null default true | скрыть карточку, не удаляя; RLS: анону только `true` |

- Check: `num_nonnulls(article_id, product_id) = 1` **и** согласованность со слотом (`featured`/`journal` ⇒ `article_id`, `shop` ⇒ `product_id`).
- Индексы: `(slot, position)`, `article_id`, `product_id`; **уникальность внутри слота**: partial unique `(slot, article_id) where article_id is not null`, `(slot, product_id) where product_id is not null` (одна и та же карточка дважды в слоте невозможна; RPC на дубль → `23505` с понятным текстом). Между `featured` и `journal` БД повтор допускает, но админка не даёт выбрать уже стоящую в одном из двух статейных слотов статью, а сайт на всякий случай выбрасывает из `journal` статью, равную `featured`.
- **RLS anon:** строка видна, если `is_published` **и** её статья/товар опубликованы (`exists … is_published`) — как «черновик не утекает» у связей статей/товаров. Админ (политика «Admin all») видит все строки — отсюда бейджи `Hidden` (слот скрыт) и `Draft` (статья/товар не опубликован); бейджа «Missing» нет: удалённый элемент каскадом убирает и слот.
- Ёмкость (featured 1, journal 6, shop 3) валидирует админка; сайт рисует первые N по `position` (вёрстка не ломается).
- **RPC `save_home_page(p_page_id uuid, p_page jsonb, p_slots jsonb) → jsonb`** (`security invoker`, `set search_path = ''`, execute — `authenticated`/`service_role`): обновляет `pages` (hero/SEO) и **полностью пересобирает** `home_slots` (diff по `id`; плотные позиции; чужой/несуществующий slot → `23514`); `0` строк страницы → `P0002`. Образец — `0006_save_article_rpc.sql`/`0009_save_product_rpc.sql`.
- **Сид (`0013`):** строка `pages.home` с текстами референса (eyebrow «A journal of houseplant care», h1 «Plant care that⏎actually *makes sense*» (с настоящим переводом строки), lead «Clear, jargon-free guides on watering, light and repotting — so the plants in your home live long, healthy lives.»); слоты: `featured` = статья «How to tell when a plant needs water — and when to wait» (в референсе — «This week's read»), `journal` = 6 самых свежих опубликованных статей кроме featured, `shop` = первые три товара референса (Monstera Deliciosa, Golden Pothos, Snake Plant). Сид — по slug'ам, идемпотентный, без хардкода uuid. **Если нужного slug в живой БД уже нет** (владелец переименовал/удалил): `featured` берёт самую свежую опубликованную статью, `shop` добирает до 3 самыми свежими опубликованными товарами, `journal` — 6 самых свежих кроме featured; миграция не падает.
- Нумерация: `0012_home_tables` (pages, home_slots, RLS, триггеры, гранты), `0013_seed_home`, `0014_save_home_page_rpc`.

## Сайт (`urban.gardener`)

- `lib/home.ts` (серверный, `cache()`): `fetchHomePage(): Promise<HomeContent>` — hero/SEO с фолбэками + слоты. Ошибка Supabase → `throw` (ISR сохраняет прошлую страницу); пустой результат слотов — **не ошибка** (секция скрыта), но тихий RLS-отсев логируется `console.warn` (урок Фазы 3). Embed'ы — `articles!inner(...)`/`products!inner(...)` + `.eq('is_published', true)` на слот и на embed (скрытый/черновой элемент отбрасывает слот целиком). Явные списки колонок, мапперы бросают на битый embed; переиспользовать `ARTICLE_LIST_SELECT`/`rowToArticle` и `CARD_SELECT`/`rowToCardData`. `lib/home.mappers.ts` + `lib/home.types.ts` + `lib/home-utils.ts` (чистое: `parseHeroTitle(str) → segments[]`, фолбэки, `capacity` по слоту).
- `lib/home.fixtures.ts` — тест/сид-данные (сид 0013 генерируется из неё скриптом; скрипт одноразовый, в scratchpad).
- `components/home/` — `Hero` (+ `HeroLeaf` SVG), `FeaturedArticle`, `HomeJournal`/`HomeShop` (секции с `SectionHead`), `HomeTip` (обёртка `TipBlock` с заголовком «One <em>care tip</em> in your inbox every Saturday» и текстом референса «What to water, feed and watch for this week — no spam, no filler.» + `NewsletterPlaceholder`: input и button `disabled`, подпись «Subscribe — coming soon», `aria-disabled`, не `<form>` с action), скелеты не нужны.
- `app/page.tsx` — тонкая композиция; `generateMetadata` из `pages.home` (`title: { absolute }` только если задан `seo_title`, иначе дефолт layout), canonical `/`; `app/page.module.css` заменить; `app/page.test.tsx` обновить (заглушка уходит).
- `NAV`/футер: «Home» уже есть. `KNOWN_ROUTES` без изменений.
- Картинки: `resolveImage` (внешние Unsplash — `unoptimized`), `sizes` под сетку; featured — `preload`.

## Админка (`web.admin`), шаг 4D — **сначала короткая спека/описание владельцу и «утверждаю»**

Pages → Homepage (по образцу Avocado: один экран, один Save, черновик в значении формы):
- `sites.ts` Urban: `sections` += `pages`; пункт `Pages` в `NAV_ITEMS` уже есть; роуты `pages`, `pages/:pageId` общие с Avocado/Cozy: существующие `PagesListRoute`/`PagesEditRoute` (`features/pages/PagesRoutes.tsx`) получают ветку `urban_gardener` → `UgPagesPage`/`UgHomePage` (поведение Cozy/Avocado не меняется — регрессионный тест пишется первым); список Pages у Urban — одна строка «Homepage» (позже Фаза 5 добавит остальные).
- Экран Homepage: блок **Hero texts** (eyebrow, заголовок с подсказкой про `*акцент*` и перенос строки, подзаголовок, живой предпросмотр заголовка), **SEO** (title/description с подсказкой фолбэка), три группы слотов: Featured (1), From the journal (до 6), Shop (до 3) — карточки со ссылкой на статью/товар, миниатюрой, названием, бейджами `Hidden` / `Draft`, перестановка ↑/↓, удаление, «Add» через пикер (поиск по названию; не показывает уже добавленные в этом слоте, а для статейных слотов — уже стоящие в `featured` или `journal`; опубликованные первыми). Переполнение слота — кнопка Add неактивна. Неполный слот **не блокирует** Save (сайт скрывает секцию/рисует меньше) — жёлтое предупреждение «Section will be hidden» / «N of 6».
- Сохранение — **один вызов RPC `save_home_page`**; форма блокируется на время Save; после успеха перечитывается; `gcTime: 0` у запроса экрана; `mustAffect`-подход; гард несохранённых; тост подсказывает, что правка видна на сайте через ≤ 1 мин.
- `lib/ugHome.ts` (`getUgHome`, `saveUgHome`, `listUgHomeUsage`), `features/ug-home/` (`UgHomePage`, `UgHomeSlotsEditor`, `UgArticlePickerDialog`, `UgProductPickerDialog`, `ugHomeForm.ts`), ключи кэша `['ug-home', site.slug]`, `['ug-home-usage', site.slug]`.
- **Предупреждение при удалении** статьи/товара, стоящих на главной (каскад FK молча опустошает слот): в диалогах удаления `UgArticleEditPage` и `UgProductEditPage` — «This article is on the homepage — From the journal» + ссылка на Homepage (как `HomepageUsageWarning` у Avocado, только предупреждение, не запрет).
- `USAGE_SOURCES` (Media «Used by») не меняется: у главной нет картинок.

## Шаги

Каждый шаг завершается зелёными `lint`, `test`, `build`; ветки `feat/home` в `urban.gardener` и `web.admin` (от `main`), локальные коммиты, push/merge — только по команде. API Next 16 / Supabase сверять с `node_modules/next/dist/docs/` и Context7.

- **4A. Фронт на тестовых данных:** `lib/home.types.ts`, `home-utils.ts` (+ тесты, red-first для `parseHeroTitle`), `home.fixtures.ts`, `components/home/*`, страница `/` на фикстурах-загрузчике; визуальная сверка с референсом (1280/390).
- **4B. Миграции и сид:** 0012–0014; проверка прав SQL под ролями (anon видит только опубликованные слоты опубликованных элементов; не-админ не пишет и не вызывает RPC; админ собирает слоты; чужой slot / несоответствие article↔product → `23514`); `get_advisors`; ревью `database-reviewer`.
- **4C. Сайт на БД:** `lib/home.ts` + мапперы; `generateMetadata`; ревью `silent-failure-hunter`.
- **4D. Админка:** описание владельцу → «утверждаю» → impl-план админки → код → тесты.
- **4E. Тесты:** unit (парсер заголовка, мапперы, фолбэки, диспетчер, форма админки, RPC-вызов), компонентные (Hero, FeaturedArticle, секции скрываются при пустых слотах, неактивная подписка), e2e `e2e/home.spec.ts` (сидовые по названиям, не по числам; пилюли тем ведут на `/topics/<slug>`; featured → статья; блок рассылки не отправляет и кнопка `disabled`; 390px без горизонтального скролла; заголовки: один h1).
- **4F. Ревью-гейт и документация:** `database-reviewer`, `silent-failure-hunter`, `react-reviewer`, `a11y-architect`, `seo-specialist` (метаданные главной); `schema.md`, `urban-gardener.md` (D31+), roadmap, `AGENTS.md` обоих репо, `phase-x-checklist.md`, `admin-panel/home-urban-gardener.md`, отчёт в конце плана.

## Подводные камни

- Слот ссылается на статью/товар каскадом: удаление элемента молча опустошает слот → предупреждение в админке + секция скрывается, а не падает.
- `articles!inner`/`products!inner` + фильтр `is_published` на слот **и** на embed; без второго фильтра черновик, на который указывает слот, утечёт (RLS на `articles` это тоже закрывает, но код не должен на это полагаться — урок avocado-kiss preview).
- Hero-заголовок из БД — только безопасный разбор `*акцента*`/`\n`; никакого `dangerouslySetInnerHTML`.
- Неактивная подписка не должна выглядеть рабочей и не иметь `action`; запись в `phase-x-checklist.md`: к запуску блок заменён настоящей формой Фазы 7.
- Тот же `pages.slug` check и RLS должны выдержать Фазу 5 без переделки (новые строки — INSERT-миграцией, не изменением check'а: список slug'ов уже включает about/contact/privacy/terms).
- Не менять URL-ы Cozy/Avocado; админские маршруты `pages` общие — диспетчер по схеме обязан сохранить поведение Cozy/Avocado (тест).
