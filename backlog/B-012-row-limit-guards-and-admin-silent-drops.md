# B-012 — Лимит 1000 строк PostgREST и тихие потери в админке Urban

**Что (silent-failure-hunter и react-reviewer, Фаза X; для текущих объёмов не проявляется).**
- Сайт: `fetchArticles`, `fetchAllProductSlugs`, `fetchProductPage` (`lib/articles.ts`, `lib/shop.ts`, `lib/shop-queries.ts`) не защищены от усечения выдачи на 1000 строк (sitemap и фасеты категории защищены). При > 1000 статей/товаров часть тихо выпала бы из списка и `generateStaticParams`.
- Админка: `listUgAuthors`, `listUgBrands`, `listUgShopCategories` — то же (в Фазе X добавлено для статей, подписчиков и сообщений).
- `ugArticles.parseItems`/`rowToBlock` молча отбрасывают «битые» элементы списка/неизвестные блоки, следующее сохранение удаляет их из БД (для блоков CHECK не даёт такому случиться, для jsonb-элементов списка — может). Нужен `console.warn` или пометка «repaired», как в `ugStatic`.
- `reorderRows` (`lib/ugDb.ts`) — N параллельных update, не атомарно (при сбое позиции перемешаны; UI перечитывает и показывает ошибку).

**Предложение.** `assertNotTruncated`/`range()` везде, где список растёт; предупреждение при отбрасывании; RPC для перестановки. **Нужно решение владельца:** нет. **Статус:** новая.
