# B-027 — web.admin: загрузчики списков Cozy/Avocado без защиты от усечения на 1000 строк

**Что.** Найдено `silent-failure-hunter` в Фазе O. В `web.admin` у загрузчиков Cozy/Avocado нет защиты от усечения выдачи PostgREST на 1000 строк (у Urban она есть, в Фазе O стала точной: `{ count: 'exact' }` + `assertNotTruncated`).

**Где проявляется.**
- `src/lib/productCategories.ts` — `listProductCategories` (читает всю join-таблицу).
- `src/lib/homeSlots.ts` — `listHomeSlotUsage` (питает предупреждение при удалении).
- Растущие списки: `src/lib/products.ts`, `posts.ts`, `recipes.ts`, `articles.ts`.
- Небольшие таксономии: `src/lib/tags.ts`, `brands.ts`, `categories.ts`, `recipeCategories.ts`.

При превышении 1000 строк часть данных тихо выпадет из списка/предупреждения.

**Предложение.** `{ count: 'exact' }` + `assertNotTruncated(rows, count, what)`; первыми — `listProductCategories` и `listHomeSlotUsage`.

**Нужно решение владельца.** Нет (технический долг).

**Статус:** новая.
