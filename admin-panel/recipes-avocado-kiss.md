# Раздел Recipes (Avocado Kiss) — контракт админки

> Last updated: 2026-08-25 | Проект: web.admin, `src/features/recipes/` + справочник
> `src/features/taxonomy/` (recipe categories). Сайт-потребитель — avocado.kiss.
> Схема БД — [../database/schema.md](../database/schema.md) §9; страница рецепта на
> сайте — [../sites/avocado-kiss.md](../sites/avocado-kiss.md) §2.

Раздел закрывает последний CPT Avocado Kiss. **Миграций не потребовалось**: таблицы,
RLS и папки (`admin_folders.section = 'recipes'`, `recipes.folder_id`) заведены ещё
миграциями 0001/0005/0012, а `recipes.hero_image_path` уже был в `USAGE_SOURCES`
(учёт занятости картинок в Media).

## 1. Что редактируется

| Блок формы | Колонки `avocado_kiss.recipes` |
|---|---|
| Шапка | `title`, `category`, `excerpt`, `hero_image_path` |
| Мета | `author_name`, `published_at`, `time_label`, `servings_label`, `slug` |
| Теги | `recipe_tags` (M2M, `position` = порядок) |
| Ingredients | `ingredients text[]` — порядок массива = порядок списка на сайте |
| Method | `steps text[]` — порядок массива = номера 01, 02, … |
| Rating baseline | `seed_count`, `seed_sum`, `min_display_rating` |
| SEO | `seo_title`, `seo_description` (живой фолбэк title/excerpt → `null`) |
| Панель действий | `is_published` (Draft/Published), Save, Delete |

Списки (`ListEditor`) — строки с перестановкой **стрелками ↑/↓** (`useFieldArray.move`,
тот же паттерн, что у блоков блога), добавлением и удалением; Enter в поле ингредиента
добавляет следующую строку. Пустые строки при сохранении отбрасываются.

**Rating baseline**: в БД лежат `seed_count`/`seed_sum` (сумма), в форме — «Seed votes»
и «Seed rating» (среднее); при сохранении `seed_sum = round(count × avg)`, при загрузке
`avg = sum / count`. Реальные голоса (`ratings_count`/`ratings_sum`) и вычисляемые
`display_avg`/`display_count` — read-only, их растит только RPC `rate_recipe` с сайта.

**Slug редактируемый** (отклонение от общего правила «slug не шлём»): поле пустое →
шлём `null` → триггер `recipes_set_slug` пересобирает его из `title`. Смена slug рвёт
существующие ссылки — предупреждение стоит под полем.

## 2. Recipe categories — отдельный справочник

`recipes.category` — **текст, равный `categories.name`** (FK нет), а таблица
`avocado_kiss.categories` — это разделы журнала (навигация шапки), НЕ `shop_categories`,
которые редактирует раздел Categories. Поэтому заведён отдельный раздел
**Recipe categories** на том же generic-коде `features/taxonomy/`:

- `recipeCategoryConfig` (`kind: 'recipe_category'`, `usageNoun: 'recipe'`) — счётчик ряда
  и текст диалога удаления считают рецепты, а не товары;
- `RecipeCategoryEditDialog` — name, `show_in_nav` (видимость в шапке сайта), SEO;
  картинок/hero-полей у рецептных категорий нет;
- порядок ↑/↓ пишет `position` = порядок ссылок в шапке сайта;
- **каскады на уровне приложения** (`src/lib/recipeCategories.ts`, связь по имени):
  rename → `recipes.category` обновляется у всех рецептов раздела; delete → у рецептов
  раздела `category` становится `null`. Не атомарно (два запроса) — тот же компромисс,
  что был у cozycorner до перехода на M2M.

Тот же справочник подставляется в форму рецепта через `TaxonomyCombobox`
(выбрать / создать на месте / Manage…).

## 3. Теги

`TagsField` (общий с блогом) научен **создавать теги**: если введённого имени нет,
в поповере появляется «Create "…"» → `createTag` (`src/lib/tags.ts`, slug ставит
триггер `tags_set_slug`). Таблица `tags` общая для рецептов и постов.

## 4. Удаление рецепта

`recipes` каскадит: `recipe_tags`, `recipe_ratings`, `home_slots` (слоты главной!),
`product_reading` («Related reading» у товаров), `post_related` (Read also);
`post_sections.recipe_id` обнуляется (SET NULL). Диалог удаления об этом предупреждает.

## 5. Гейт разделов

`SiteConfig.sections` теперь **явно задан и у cozycorner** — иначе он получил бы все
пункты `NAV_ITEMS`, включая рецептные. У avocado в allowlist добавлены `recipes` и
`recipe-categories`.

## 6. Чего в разделе НЕТ (осознанно)

- **Курирование главной** (`home_slots`: hero/сетки/wide/Editor's Picks) — отдельная
  итерация; сейчас слоты правятся только через БД/коннектор.
- **«Pairs well with» / «Related reading» товаров** — сделаны в форме товара
  (2026-08-25), см. [products.md](products.md) §3a.
- **Preview черновика** на сайте: у avocado нет `posts/recipes.preview_token`, RLS отдаёт
  анону только опубликованное (как в блоге).
- Ингредиенты и шаги — плоские строки: групп («For the dough»), разметки и ссылок нет
  ни в схеме, ни на сайте.
