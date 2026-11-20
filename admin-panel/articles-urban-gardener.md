# Urban Gardener — Articles и справочники в web.admin — контракт раздела

> Last updated: 2026-10-15 | Site: **urban.gardener** (схема `urban_gardener`, бакет `urban-gardener-photos`).
> Разделы в web.admin **ПОСТРОЕНЫ** (Фаза 2D, 2026-10-15): Media (общий), **Articles**, **Topics**, **Levels**, **Authors**.
> Спека и решения — [../sites/urban-gardener/specs/2026-10-15-articles-admin-design.md](../sites/urban-gardener/specs/2026-10-15-articles-admin-design.md);
> модель БД — [../database/schema.md](../database/schema.md) §10; как сайт рендерит — [../sites/urban-gardener.md](../sites/urban-gardener.md).
> ⚠️ Не путать с [blog-avocado-kiss.md](blog-avocado-kiss.md): у Avocado модель другая (3 шаблона, теги, QA, «Read also»,
> превью-токены). Код Urban Gardener живёт отдельно (`features/ug-articles`, `lib/ug*.ts`) — Avocado Blog не затронут.

> **Фаза R (2026-11-20; ветка `feat/phase-r`, не влито) меняет этот документ — в тексте ниже остаётся состояние до фазы, актуальное — здесь:**
> - **Levels удалены:** раздел Levels (меню, роут `/levels`, `levelConfig`) и поле Level в статье убраны; в БД таблица `levels` и `articles.level_id` исчезнут с миграцией 0041 (**ещё не применена**: порядок сайт → админка → 0041). Строки про Levels в §1–§5 устарели.
> - **Автор и Read time необязательны:** `author_id` nullable («No author»), у Read time подсказка «Leave empty — calculated from the text»; `read_minutes` пусто → сайт показывает `read_minutes_auto`, которое считает `save_article`. Публикации нужны обложка и ≥1 тема (CHECK `articles_published_needs_cover`; время чтения больше не требуется).
> - **Блоки text и callout** редактируются через `RichTextEditor` с ссылками (жирный, курсив, ссылки, списки) — тело хранится как Markdown. Правило «обычный текст без markdown» из §3 больше не верно для этих блоков.
> - **Новые блоки** (`UgBlocksEditor`, `UgBlockTargets.tsx`): «Article link» (`type = article`, поле `linked_article_id`; пикер статьи) и «Products» (`type = products`, `product_ids` 1–3, порядок и удаление; поведение Save при «мёртвом» Products-блоке (товары удалены/сняты) в этих доках не проверено — см. `UgBlocksEditor.tsx`). Миграция 0040; FK на `linked_article_id` снят миграцией 0040a и вернётся в 0041. Запросы, встраивающие блоки статей, должны использовать подсказку `article_blocks!article_blocks_article_id_fkey`.

## 1. Реестр и навигация

`web.admin/src/config/sites.ts`: `slug: "urban-gardener"`, `schema: "urban_gardener"`, `bucket: "urban-gardener-photos"`,
`frontendUrl: "https://urban-gardener.vercel.app"` (временный; при подключении домена обновить — чек-лист в sites/urban-gardener.md),
`sections: ["media","articles","topics","levels","authors"]`. Пункты меню (`SiteLayout.NAV_ITEMS`): Articles (`articles`), Topics (`topics`),
Levels (`levels`), Authors (`authors`); `media` — общий менеджер. Роуты: `/articles`, `/articles/new`, `/articles/:articleId`, `/topics`, `/levels`, `/authors`.
`USAGE_SOURCES.urban_gardener` (`lib/media.ts`): `articles.cover_path`, `article_blocks.image_path`, `authors.avatar_path` («Used by» в Media).

## 2. Файлы

| Что | Где |
|---|---|
| Слой данных статей | `src/lib/ugArticles.ts` — `listUgArticles`, `getUgArticle`, `createUgArticle`, `updateUgArticle`, `deleteUgArticle`, `syncBlocks`, `syncTopics`, мапперы `rowToBlock`/`blockToValues` |
| Темы и уровни | `src/lib/ugTaxonomy.ts` — CRUD + `reorder` (через RPC `reorder_positions`, Фаза O) + счётчики `topicUsage`/`levelUsage` + `deleteUgTopic` с защитой |
| Авторы | `src/lib/ugAuthors.ts` — CRUD + `deleteUgAuthor` с защитой |
| Список и редактор статьи | `src/features/ug-articles/` — `UgArticlesPage`, `UgArticleEditPage`, `UgBlocksEditor`, `UgTopicsField`, `ugArticleForm.ts` (zod-схема + конвертеры) |
| Темы / уровни | `src/features/taxonomy/` — `TopicsPage`, `LevelsPage`, `TopicEditDialog` + `topicForm.ts`; `TaxonomyManager` расширен `config.usage` (`topicConfig`, `levelConfig` в `config.ts`) |
| Авторы (UI) | `src/features/authors/` — `AuthorsPage`, `AuthorEditDialog` + `authorForm.ts` |

Query-ключи: `['ug-articles', site.slug]` (+ `, id`), `['ug-topics', …]`, `['ug-levels', …]`, `['ug-authors', …]`, счётчики `['ug-topic-usage', …]` / `['ug-level-usage', …]`.
Не форкать свои ключи для тех же данных.

## 3. Статья

| Поле формы | Колонка | Правило |
|---|---|---|
| Title | `title` | обязателен; slug — триггер БД (create не отправлять, edit read-only) |
| Subtitle | `subtitle` | пусто → `null` (сайт берёт excerpt) |
| Excerpt | `excerpt` | **NOT NULL default `''`**: пустое пишется как `''`, не `null` |
| Cover + alt | `cover_path`, `cover_alt` | `ImagePickerDialog`; в БД ключ бакета или внешний URL; для публикации cover обязателен |
| Author | `author_id` | **обязателен всегда** (NOT NULL, FK restrict); единственный автор предвыбирается |
| Level | `level_id` | необязателен; `null` → бейджа нет |
| Topics | `article_topics` | мультивыбор с порядком (←/→): **первая = основная**; для публикации ≥1 |
| Read time | `read_minutes` | целое ≥ 1; для публикации обязателен |
| Published at | `published_at` | дата показа и сортировки; **не планировщик** (политика читает только `is_published`). С 2026-11-20 у Scheduled поле скрыто, `published_at = publish_at` (см. [products.md](products.md), «Change 2026-11-20») |
| Published | `is_published` | switch; новая статья начинается черновиком |
| SEO | `seo_title`, `seo_description` | значение = фолбэку (title / excerpt) или пусто → `null` |

**Блоки** (`article_blocks`, «Add block» + тип, ↑↓, удаление): `text` (style Body/Lead; обычный текст, абзацы через пустую строку), `heading` (H2/H3;
**первый заголовок тела обязан быть H2**), `callout` (title с emoji + текст), `image` (картинка, **alt обязателен**, caption, credit), `list`
(элементы: необязательный жирный lead-in + текст; ≥1 элемента). Позиции плотные (индекс блока). Блок неизвестного типа в БД админка не показывает
и не трогает (его не удалит diff, т.к. он не попадает в форму — но и не редактируется).

**Баннер «repaired» (Фаза O, 2026-11-19; код ждёт деплоя).** Если блоки или элементы списка не удалось прочитать, `getUgArticle` возвращает `repaired`, и редактор показывает янтарную плашку «Some blocks or list items could not be read and will be removed when you save. Check the article before saving.» Выборщики автора, уровня, тем (и бренда/категорий у товара) при ошибке загрузки показывают «Couldn't load <thing>.» + Retry и не сбрасывают выбранные значения.

## 4. Сохранение — одна транзакция (RPC `save_article`)

Статья, блоки и темы пишутся **одним вызовом** `urban_gardener.save_article(p_id, p_article, p_blocks, p_topic_ids)` (миграция 0006, `security invoker`:
RLS и `is_admin()` действуют как для прямой записи; anon выполнить не может). Всё или ничего: сбой откатывает всё целиком, на живом сайте не бывает
полусохранённой статьи, повторный Save не дублирует блоки.

- **Блоки:** diff по `id` внутри функции — отсутствующие в массиве удаляются, существующие upsert'ятся, у новых `id` генерируется; `position` = индекс в массиве;
  неизменённые блоки не обновляются (иначе `updated_at` статьи рос бы при каждом Save). Блок с id чужой статьи — ошибка. Функция возвращает `{id, block_ids}` в порядке формы —
  форма проставляет id новым блокам **без перезагрузки** (поле `blockId`, не `id`: useFieldArray его резервирует).
- **Темы:** лишние удаляются, остальные upsert'ятся с `position` = порядок в массиве (первая = основная).
- **Правила публикации проверяются и на сервере:** обложка, ≥1 тема, время чтения (иначе `23514` с понятным текстом); автор нужен всегда (NOT NULL).
  Снятие с публикации и правка тела — в одной транзакции.
- **Update чужой/удалённой строки:** `0` затронутых строк — ошибка (`P0002` «not found or not allowed»), а не «успех» (сессия истекла / статью удалили в другой вкладке).
- На время сохранения форма заблокирована (`fieldset disabled`): правки «по ходу» не затираются reset'ом. Страница статьи монтируется с `key` по id и берёт свежие данные
  (`gcTime: 0`) — устаревший кэш не перезапишет чужие правки.
- `updated_at` не отправляется; триггеры `article_blocks_touch_article` / `article_topics_touch_article` (0004) обновляют его у статьи.
- Ошибки: `23505` → «That name is already taken» (`humanizeError`); тексты ограничений публикации и защиты темы показываются как есть.
- Клиент: `lib/ugArticles.saveUgArticle` (проверяет форму ответа), `deleteUgArticle` и все update/delete справочников/авторов запрашивают затронутые строки
  (`.select('id')` + `lib/ugDb.mustAffect`) — «0 строк» больше не выглядит как успех.

## 5. Темы, уровни, авторы

- **Topics** (`TaxonomyManager` + `TopicEditDialog`): имя, intro-текст страницы `/topics/<slug>`, SEO; порядок ↑↓ = порядок пилюль на сайте; счётчик статей.
  slug генерируется при создании и **не меняется при переименовании** (URL стабильны). **Удаление блокируется**, если после него опубликованная статья
  осталась бы без тем: клиент проверяет заранее (в ошибке — названия до трёх статей), а триггер БД `topics_guard_delete` (0006) — страховка от гонок; иначе связи уходят каскадом.
- **Levels** (inline-rename как у брендов): порядок = порядок пилюль-фильтра; удаление ставит `level_id = null` у затронутых статей (диалог показывает число).
- **Authors** (`AuthorsPage` + `AuthorEditDialog`): имя, роль, фото (необязательно; без него сайт рисует инициалы), bio. **Автора со статьями удалить нельзя**
  (FK restrict): перед удалением считаем статьи и показываем «Reassign … first».

## 6. Чего нет (сознательно)

Превью черновиков (токены — Фаза 8; проверка — публикация и просмотр на сайте через ≤1 мин), «Read also»/рекомендации, папки статей, планирование публикации.

## 7. Тесты

Vitest: `ugArticleForm` (правила публикации, блоки, конвертеры), `lib/ugArticles` (мапперы, форма RPC-вызова, проверка ответа), `lib/ugTaxonomy`
(защита удаления темы/автора, «0 строк» = ошибка, счётчики), `lib/ugDb`, `topicForm`, `authorForm`, `config/sites`, компоненты `UgBlocksEditor`, `UgTopicsField`,
`TaxonomyManager` с `config.usage`. RPC и триггер проверены на живой БД SQL-симуляцией сессии админа в транзакции с откатом (2026-10-15): создание/обновление/перестановка блоков, правила публикации, защита темы, отказ не-админу и anon.

## Preview (Фаза 8, миграция 0030)

Кнопка **Preview** в шапке редактора (рядом с «View on site») открывает `<frontendUrl>/preview/{articles|products}/<slug>?token=<preview_token>` в новой вкладке (`target=_blank`, `rel="noopener noreferrer"`). Видна у любой СОХРАНЁННОЙ записи (черновик или опубликованная); у новой несохранённой (нет slug/токена) и при отсутствии `frontendUrl` кнопки нет. Токен читается вместе с записью (`preview_token` — колонка доступна роли `authenticated`, anon её не видит) и при сохранении НЕ отправляется (исключён из типа input). Компонент — `src/features/shared/PreviewButton.tsx`, сборка ссылки — `src/lib/ugPreview.ts` (`previewUrl`, кодирует slug/токен). Ссылка = пароль к черновику; кнопки смены токена нет (смена — SQL, см. phase-x-checklist «Фаза 8»). Тесты: `PreviewButton.test.tsx`, `UgArticleEditPage.preview.test.tsx`, `UgProductEditPage.test.tsx` («Preview»).
