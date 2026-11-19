# B-012 — Лимит 1000 строк PostgREST и тихие потери в админке Urban

**Что (silent-failure-hunter и react-reviewer, Фаза X; для текущих объёмов не проявляется).**
- Сайт: `fetchArticles`, `fetchAllProductSlugs`, `fetchProductPage` (`lib/articles.ts`, `lib/shop.ts`, `lib/shop-queries.ts`) не защищены от усечения выдачи на 1000 строк (sitemap и фасеты категории защищены). При > 1000 статей/товаров часть тихо выпала бы из списка и `generateStaticParams`.
- Админка: `listUgAuthors`, `listUgBrands`, `listUgShopCategories` — то же (в Фазе X добавлено для статей, подписчиков и сообщений).
- `ugArticles.parseItems`/`rowToBlock` молча отбрасывают «битые» элементы списка/неизвестные блоки, следующее сохранение удаляет их из БД (для блоков CHECK не даёт такому случиться, для jsonb-элементов списка — может). Нужен `console.warn` или пометка «repaired», как в `ugStatic`.
- `reorderRows` (`lib/ugDb.ts`) — N параллельных update, не атомарно (при сбое позиции перемешаны; UI перечитывает и показывает ошибку).

**Предложение.** `assertNotTruncated`/`range()` везде, где список растёт; предупреждение при отбрасывании; RPC для перестановки. **Нужно решение владельца:** нет.

**Поправка.** `fetchProductPage` уже ограничен `.range` (`PAGE_SIZE` 12) — пункт про него в «Что» был неверным.

**Статус:** частично (Фаза N, принята 2026-11-19; код запушен в `main`). Открыто: `reorderRows`, баннеры, `isError`, точный count в админке (см. ниже).

**Сделано в Фазе N.**
- Сайт (`urban.gardener`): новый `lib/row-limit.ts` с `assertComplete(what, rows, count)`; используется в sitemap, фасетах категории, `fetchArticles`, `fetchAllProductSlugs` (`count: 'exact'`; ошибка при усечении или отсутствии count). Следствие: при > 1000 опубликованных товаров/статей сборка упадёт, а не усечёт список молча — принято планом.
- Админка (`web.admin`): `assertNotTruncated` добавлен в `listUgAuthors`, `listUgShopCategories`, `listUgBrands`, `listUgTopics`, `listUgLevels` и `publishedArticlesOnlyInTopic`; `ugArticles.parseItems`/`rowToBlock` пишут `console.warn` при отбрасывании данных.

**Остаётся открытым.**
- `reorderRows` — атомарные RPC перестановки.
- Баннеры в UI админки об отброшенных элементах списка/блоках и показ `isError` в выпадающих списках формы редактирования.
- Защита в админке работает по эвристике 1000 строк, а не по точному count.
