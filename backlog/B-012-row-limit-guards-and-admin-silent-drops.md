# B-012 — Лимит 1000 строк PostgREST и тихие потери в админке Urban

**Что (silent-failure-hunter и react-reviewer, Фаза X; для текущих объёмов не проявляется).**
- Сайт: `fetchArticles`, `fetchAllProductSlugs`, `fetchProductPage` (`lib/articles.ts`, `lib/shop.ts`, `lib/shop-queries.ts`) не защищены от усечения выдачи на 1000 строк (sitemap и фасеты категории защищены). При > 1000 статей/товаров часть тихо выпала бы из списка и `generateStaticParams`.
- Админка: `listUgAuthors`, `listUgBrands`, `listUgShopCategories` — то же (в Фазе X добавлено для статей, подписчиков и сообщений).
- `ugArticles.parseItems`/`rowToBlock` молча отбрасывают «битые» элементы списка/неизвестные блоки, следующее сохранение удаляет их из БД (для блоков CHECK не даёт такому случиться, для jsonb-элементов списка — может). Нужен `console.warn` или пометка «repaired», как в `ugStatic`.
- `reorderRows` (`lib/ugDb.ts`) — N параллельных update, не атомарно (при сбое позиции перемешаны; UI перечитывает и показывает ошибку).

**Предложение.** `assertNotTruncated`/`range()` везде, где список растёт; предупреждение при отбрасывании; RPC для перестановки. **Нужно решение владельца:** нет.

**Поправка.** `fetchProductPage` уже ограничен `.range` (`PAGE_SIZE` 12) — пункт про него в «Что» был неверным.

**Статус:** сделано в Фазе O (2026-11-19): миграции применены, код админки ждёт приёмки/деплоя. Фаза N (принята 2026-11-19, код в `main`) закрыла сайт и часть админки; остаток закрыт в Фазе O (см. ниже).

**Сделано в Фазе N.**
- Сайт (`urban.gardener`): новый `lib/row-limit.ts` с `assertComplete(what, rows, count)`; используется в sitemap, фасетах категории, `fetchArticles`, `fetchAllProductSlugs` (`count: 'exact'`; ошибка при усечении или отсутствии count). Следствие: при > 1000 опубликованных товаров/статей сборка упадёт, а не усечёт список молча — принято планом.
- Админка (`web.admin`): `assertNotTruncated` добавлен в `listUgAuthors`, `listUgShopCategories`, `listUgBrands`, `listUgTopics`, `listUgLevels` и `publishedArticlesOnlyInTopic`; `ugArticles.parseItems`/`rowToBlock` пишут `console.warn` при отбрасывании данных.

**Было открыто после Фазы N (закрыто в Фазе O, см. ниже).**
- `reorderRows` — атомарные RPC перестановки.
- Баннеры в UI админки об отброшенных элементах списка/блоках и показ `isError` в выпадающих списках формы редактирования.
- Защита в админке работает по эвристике 1000 строк, а не по точному count.

**Фаза O (2026-11-19): сделано; код `web.admin` на ветке, ждёт приёмки и деплоя.**
- Миграции применены к `base-one` 2026-11-19: `reorder_positions` в `avocado_kiss` (`0034_reorder_positions`), `cozycorner` (`0038_reorder_positions`), `urban_gardener` (`0039_reorder_positions_lock_order`). Описание функции — `database/schema.md`.
- `reorderRows` в `web.admin` вызывает RPC `reorder_positions` для всех списков перестановки; вызывающий обязан передавать полный список.
- Точный count: загрузчики берут `{ count: 'exact' }`, `assertNotTruncated(rows, count, what)` бросает ошибку, если count отсутствует или строк меньше count (раньше — эвристика 1000 строк).
- Баннер в редакторе статьи Urban, если блоки или элементы списка не удалось прочитать (`getUgArticle` возвращает `repaired`).
- `isError` в выборщиках: «Couldn't load <thing>.» + Retry, выбранные значения не сбрасываются.
- Не покрыто: загрузчики списков Cozy/Avocado без защиты от усечения — [B-027](B-027-admin-cozy-avocado-loaders-truncation-guard.md).
