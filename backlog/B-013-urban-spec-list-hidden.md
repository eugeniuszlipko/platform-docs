# B-013 — Таблица характеристик товара скрыта на фронте (Urban): удалить или вернуть

**Что.** На странице товара под описанием была таблица Light / Water / Size / Pets (`SpecList`, поля товара `light`, `water`, `size`, `pet_safety`, D27). В референсе её нет — её завёл агент в Фазе 3, владелец такого не просил. 2026-10-20 по решению владельца таблица **скрыта на фронте** (убран вызов `<SpecList>` в `ProductDetail`); компонент `components/shop/SpecList.tsx` с тестами, поля БД и поля в админке («Plant details» в форме товара) оставлены.

**Предложение.** Пока таблица не нужна — оставить как есть. Если решено, что не пригодится: удалить `SpecList`, поля формы в `web.admin` (`UgProductEditPage`, `ugProductForm`), колонки `light/water/size/pet_safety` (миграция + `save_product` RPC); фильтр «Pet-friendly» не затрагивается (это категория). Если вернуть — вернуть один вызов `<SpecList product={product} />` в `ProductDetail.tsx` и тест-ожидания (`ProductDetail.test.tsx`, `e2e/shop.spec.ts`).

**Решение владельца 2026-11-19:** удалить совсем. Данные характеристик у 9 из 9 товаров будут потеряны.

**Статус:** реализовано в Фазе N, ждёт приёмки и применения 0037 (миграция написана, не применена; код не выкачен). Сайт: удалены `components/shop/SpecList.*`, `light/water/size/petSafety` убраны из мапперов/типов/фикстур/утилит. Админка: убран блок «Plant details» (Light/Water/Size/Pets) и подсказка Pet-friendly из формы товара Urban; обновлены `UgProduct`, `PRODUCT_COLUMNS`, zod, `toInput`, `toFormValues`. Миграция 0037 удаляет `products.light/water/size/pet_safety` (и `products_pet_safety_check`) и пересоздаёт `save_product` без них.
