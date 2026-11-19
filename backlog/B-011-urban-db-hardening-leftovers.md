# B-011 — БД Urban Gardener: остатки гигиены после аудита Фазы X

**Что (из ревью `database-reviewer`, Фаза X).**
1. У `articles` нет CHECK-ов публикации, как у `products` (`0010`): прямой PATCH/SQL админа может опубликовать статью без `cover_path`/`read_minutes` или с пустым `title`; правило держит только RPC `save_article`. Предложение: `check (not is_published or (nullif(btrim(coalesce(cover_path,'')),'') is not null and read_minutes is not null))` и `check (btrim(title) <> '')` — через `NOT VALID` + `VALIDATE` (сначала проверить существующие строки).
2. Порядок блокировок «тема → статья» в `save_article` (FK key-share при вставке `article_topics`) и «статья → тема» в `guard_topic_delete` / `guard_shop_category_delete` (`0010`, `0031`) допускает взаимную блокировку (40P01) при ОДНОВРЕМЕННОМ удалении темы и сохранении статьи с этой темой. Postgres прерывает одну операцию, тихой порчи нет; с одним админом практически не случается. Если админов станет несколько — в `save_article`/`save_product` первой строкой `perform 1 from … where id = any(...) order by id for key share`.

**Нужно решение владельца.** Нет (технический долг). Брать при росте числа админов или при следующей миграции схемы.

**Статус:** реализовано в Фазе N, ждёт приёмки и применения 0037 (миграция написана, не применена; код не выкачен).

**Что сделано в `0037_db_cleanup.sql` (Фаза N).**
- Пункт 1: добавлены CHECK-и `articles_published_needs_cover_and_read` (опубликована ⇒ непустой `cover_path` и `read_minutes` не null) и `articles_title_not_blank`.
- Пункт 2: `save_article` первой строкой берёт `for key share` на свои темы (`order by id`), `save_product` — на свои `shop_categories`; `guard_shop_category_delete` теперь блокирует товары `order by id for no key update`.
- Вывод: цикл блокировок «тема ↔ статья» с `guard_topic_delete` (0031) по статическому анализу был реальным (в 0031 описан как остаточный риск). Тест на двух сессиях не запускался (нужен `DO`-блок / подтверждение владельца); статического разбора сочтено достаточно.
- Остаётся (вне Фазы N, заметка): массовое удаление нескольких тем, бренды и уровни (`ON DELETE SET NULL`).
