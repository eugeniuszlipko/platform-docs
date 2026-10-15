# Urban Gardener — Articles в web.admin (спека 2D)

> Статус: **утверждена владельцем и реализована** (2026-10-15). Итоговый контракт — [../../../admin-panel/articles-urban-gardener.md](../../../admin-panel/articles-urban-gardener.md).
> Контекст: [план Фазы 2](../plans/2026-10-15-phase-2-articles.md) (шаг 2D), модель БД — миграции
> `urban.gardener/supabase/migrations/0001–0003` (схема `urban_gardener`, применены в base-one),
> образец — [blog-avocado-kiss.md](../../../admin-panel/blog-avocado-kiss.md) и
> `web.admin/src/features/articles/*`. Общие паттерны (картинки, гарды, slug-триггеры) — [api.md](../../../admin-panel/api.md).

**Цель.** Владелец правит весь раздел статей сайта из web.admin: статьи (поля, обложка, автор, уровень, темы с порядком, SEO,
блоки тела), темы, уровни, авторов, медиа. Сайт видит правку через ≤1 мин (ISR).

## 1. Объём

Запись в `src/config/sites.ts`:

```ts
{
  slug: "urban-gardener", label: "Urban Gardener",
  projectUrl: "https://zwrkphynupdubevzwdzy.supabase.co", anonKey: "<publishable, как у соседних сайтов>",
  schema: "urban_gardener", bucket: "urban-gardener-photos",
  frontendUrl: "https://urban-gardener.vercel.app",
  sections: ["media", "articles", "topics", "levels", "authors"],
}
```

Новые пункты `NAV_ITEMS` (`SiteLayout.tsx`): **Articles** (`articles`), **Topics** (`topics`), **Levels** (`levels`), **Authors** (`authors`);
`media` — существующий общий менеджер. Порядок меню: Media · Articles · Topics · Levels · Authors.

| Раздел | Что делает | Основа |
|---|---|---|
| Media | общий менеджер бакета; в `USAGE_SOURCES` добавить `urban_gardener`: `articles.cover_path`, `authors.avatar_path`, `article_blocks.image_path` | существующий `features/media` |
| Articles | список (поиск, фильтр published/draft) + редактор статьи | копия-адаптация `features/articles` |
| Topics / Levels | справочники: список, add / edit / delete, порядок ↑↓, счётчик статей, delete с подсчётом затронутых | `TaxonomyManager` (расширить `usageNoun: 'article'`) |
| Authors | CRUD (у Avocado нет — только select) | новая страница по образцу Brands/Categories |

## 2. Редактор статьи

| Поле | Колонка | Контрол | Правило |
|---|---|---|---|
| Title | `articles.title` | text | обязателен |
| Slug | `slug` | read-only (edit) / скрыт (create) | генерит триггер БД, при create не отправлять |
| Subtitle | `subtitle` | text | пусто → `null` (сайт берёт excerpt) |
| Excerpt | `excerpt` | textarea | текст карточки и meta description |
| Cover + Alt | `cover_path`, `cover_alt` | `ImagePickerDialog` + text | контракт картинок: ключ бакета или внешний URL |
| Author | `author_id` | Select из `authors` | обязателен (NOT NULL в БД) |
| Level | `level_id` | Select из `levels` (+ «none») | — |
| Topics | `article_topics` | мультивыбор с порядком (↑↓): **первая = основная** | запись: `position` = индекс |
| Read time | `read_minutes` | number > 0 | — |
| Published at | `published_at` | datetime | сортировка ленты |
| Published | `is_published` | switch | см. валидацию |
| SEO | `seo_title`, `seo_description` | text / textarea с подсказкой фолбэка (title / excerpt) | значение = фолбэку или пусто → `null` |

**Валидация публикации.** Опубликованная статья требует: обложку, ≥1 тему, `read_minutes`, автора. Черновик сохраняется без этого.
`updated_at` не отправляется (триггер). Пустые optional-поля → `null`.

**Блоки тела** (`article_blocks`, `SectionsEditor`-подобный редактор, «Add block» + выбор типа, ↑↓, delete):

| Тип | Поля формы |
|---|---|
| `text` | variant (lead/body), body (абзацы через пустую строку — подсказка в UI) |
| `heading` | level (h2/h3), body |
| `callout` | title (emoji допустимы), body |
| `image` | картинка (`ImagePickerDialog`), alt (обязателен), caption, credit |
| `list` | элементы: `label` (необязательный жирный лид-ин) + `text`; добавить/удалить/порядок |

**Сохранение блоков — diff:** insert новых (без `id`) → update существующих (контент и `position` всегда) → delete пропавших; после Save —
пересинхронизация формы свежими данными (иначе повторный Save дублирует). `id` блока в форме называть `blockId` (useFieldArray резервирует `id`).
Без транзакции (как у Avocado): при частичном сбое Save повторяют — операция идемпотентна по состоянию формы.
Связь тем сохраняется так же: delete пропавших → upsert `(article_id, topic_id)` с актуальным `position`.

**Особенности БД, которые редактор обязан учесть (ревью миграций):**
- `articles.excerpt` — `NOT NULL default ''`: пустое значение отправлять как `''`, **не** `null` (исключение из правила «пусто → null»).
- Save — одна транзакция в БД (RPC `save_article`, см. A7 и контракт раздела): блоки, темы и статья пишутся атомарно.
- Триггеры `article_blocks_touch_article` / `article_topics_touch_article` (миграция 0004) сами обновляют `articles.updated_at` при правке блоков/тем —
  вручную не трогать.
- Коллизия slug (две статьи с одинаковым названием, «Plant health» vs «Plant-health») даёт `23505`: показывать «A topic/article with this name already exists».
- Позиции писать плотными (0..n-1); `position` не уникален — это нужно для перестановок.
- Смена `type` блока: обнулять поля, неприменимые к новому типу (иначе остаются «хвосты» от прежнего).
- Заголовки h2/h3: первый заголовок тела — h2 (иначе пропуск уровня после h1); подсказка в форме.
- Планирования публикации по дате **нет** (политика проверяет только `is_published`): поле `published_at` — лишь дата показа и сортировки, не выводить как «scheduled».

Удаление статьи: confirm; блоки и связи уходят каскадом БД. Удаление темы/уровня: диалог с числом затронутых статей (тема — каскад связей;
уровень — `level_id` становится `null`). **Тему нельзя удалить, если после этого опубликованная статья останется без тем** (блокировать с перечнем статей);
если удаляемая тема была основной у статьи — предупредить, что основной станет следующая. Удаление автора, у которого есть статьи, БД запрещает (FK) — UI показывает понятное
сообщение «Reassign articles first» (`humanizeError`).

## 3. Слой данных и файлы (web.admin)

- `src/lib/ugArticles.ts` — `listArticles`, `getArticle`, `saveArticle` (diff блоков и тем), `deleteArticle`, мапперы форма ↔ БД;
  `src/lib/ugTaxonomy.ts` (topics, levels), `src/lib/ugAuthors.ts`. Доступ — `getDb(site)`; slug не пишется.
- `src/features/ug-articles/` — `UgArticlesRoutes` (список / new / :id), `UgArticleEditPage`, `UgBlocksEditor`, `ugArticleForm.ts` (схема zod + чистые функции).
- `src/features/taxonomy/` — конфиги Topics/Levels + `TopicEditDialog` (name, description, SEO, порядок), `LevelEditDialog` (name); `features/authors/AuthorsPage` + `AuthorEditDialog`.
- Диспетчер роутов: `articles` у `urban_gardener` → `UgArticlesRoutes` (у Avocado `/blog` остаётся нетронутым).
- Превью черновиков в Фазе 2 **нет** (токены — Фаза 8); проверка — публикация и просмотр на сайте через ≤1 мин.

## 4. Решения на утверждение

| # | Вопрос | Рекомендация |
|---|---|---|
| A1 | Отдельная feature-папка `ug-articles` (копия-адаптация) или обобщить редактор Avocado под обе схемы | **Отдельная.** Модели разные (3 шаблона / QA / Read-also у Avocado против Topic+Level у нас); рефактор общего редактора рискует регрессией Avocado Blog. Общие мелочи выносим только если вынос тривиален |
| A2 | Topics/Levels: расширить `TaxonomyManager` (`usageNoun: 'article'`) или написать отдельные страницы | **Расширить** — готовы reorder, счётчик, delete с подсчётом; редактирование полей темы — модалкой по образцу `RecipeCategoryEditDialog` |
| A3 | Порядок тем в статье: ↑↓-кнопки или drag-and-drop | **↑↓** — как порядок блоков и уже есть в админке, без новой зависимости |
| A4 | `alt` у image-блока: обязателен или нет | **Обязателен** (a11y); пустой alt блокирует Save блока с подсказкой |
| A5 | Статья без автора/обложки/темы в черновике | Обложка/тема/время чтения — только для публикации; **автор нужен и черновику** (`articles.author_id` NOT NULL — выявлено при реализации; единственный автор предвыбирается) |
| A7 | Атомарность Save: отдельные запросы (как у Avocado) или RPC `save_article(jsonb)` (`security invoker`) | ~~Запросы + порядок записи~~ → **RPC** (решено при ревью реализации: десятки запросов давали полусохранённые статьи на живом сайте и дубли блоков при повторе). Миграция 0006 |
| A6 | Папки в Media | **Есть** (`admin_folders`, секция `media`); папок статей нет |

## 5. Тесты (web.admin)

Unit: `ugArticleForm` (zod-валидация публикации, мапперы форма↔БД, `null` для пустых), расчёт diff блоков/тем, порядок. Компонентные: блок-редактор
(add/remove/reorder, каждый тип, list-items), выбор тем с порядком, диспетчер роутов по `site.schema`. Playwright: логин-смоук без Supabase (как есть);
сквозной сценарий (создать статью → видна на сайте) — ручная проверка владельцем (2F, пункт 5 чек-листа).

## 6. Документация

`admin-panel/articles-urban-gardener.md` (контракт раздела по образцу blog-avocado-kiss.md), строка в `admin-panel/status.md`,
`database/schema.md` — раздел `urban_gardener` (делается в 2F), пункт «Used by» в `USAGE_SOURCES`.
