# Amazon Associates и Google: правила, влияющие на карточки товаров Urban Gardener

> Записано 2026-10-19 по запросу владельца, **выдержки из первоисточников через пересказ, не юридическая консультация**. Перед решением перечитать актуальный текст по ссылкам. Когда владелец решит вопрос про цены и соберёт реальные партнёрские ссылки — пройти чек-лист ниже и обновить сайт/доки.

## Источники
- Amazon Associates Program Policies: https://affiliate-program.amazon.com/help/operating/policies
- Google, Product snippets: https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- Google, общие правила структурированных данных: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Google, Merchant listings (для страниц, где товар покупают на самом сайте): https://developers.google.com/search/blog/2022/09/merchant-listings

## Что говорит Amazon (по состоянию на 2026-10-19)
- **Цены и наличие** (Participation Requirements §2(b)): сайт «may only show prices and availability if» цены получены через Creators API / PA API либо ссылку с этими данными отдаёт сам Amazon. Цены, введённые вручную, этим условиям не соответствуют.
- **Отметка времени** (IP License §2(i), §2(k)): рядом с ценой/наличием — дата и время; если данные обновляются реже, чем раз в час, — обязательна; оговорка: «Product prices and availability are accurate as of the date/time indicated and are subject to change.»
- **Кэш** (IP License §2(h)): изображения из API не хранить; остальное содержимое — не дольше 24 часов, затем обновить; ASIN можно хранить бессрочно.
- **Сравнение цен**: показывая цены нескольких магазинов, показывать и самую низкую «new» цену Amazon.
- **Структурированные данные**: в правилах не упоминаются; ближайшие ограничения — на кэширование и выгрузку Product Advertising Content (§2(e)), запрет менять Program Content (§6(a)).
- Оговорка об аффилиатных ссылках обязательна на сайте со ссылками программы (формулировку брать из актуальных правил).

## Что говорит Google
- **Product snippets** предназначены в том числе для страниц, где товар купить нельзя: обзоры, агрегаторы. Нужен хотя бы один из `offers` / `review` / `aggregateRating`; в `offers` цена обязательна (валюта рекомендована, `availability` рекомендована, просроченный `priceValidUntil` скрывает сниппет). Пример из документации Google — страница обзора с `Offer`, ведущим на товар.
- **Merchant listings** — только для страниц, где можно купить на самом сайте: нам не подходят.
- Нельзя размечать то, чего не видно на странице; нельзя фейковые отзывы/рейтинги; нельзя вводить в заблуждение. Нарушение — ручная мера (страница теряет расширенный сниппет), на позиции в выдаче не влияет.
- Расширенный сниппет с рейтингом возможен только с настоящими отзывами/оценками (редакционный обзор — отдельный случай, у нас таких данных нет).

## Как это стыкуется с сайтом сейчас
- `components/shop/ProductDetail` показывает цену из `products.price/currency` (вручную, админка) + «Prices may change — check the retailer» (`site_settings.price_note`). Кнопка «Find on Amazon» — `affiliate_url`.
- `Product` JSON-LD (urban.gardener `lib/json-ld.ts` `productJsonLd`) **без `offers`** — решение 2026-10-19 (владелец: оставить как есть, пока не решены цены).

## Чек-лист — когда будут реальные ссылки на товары Amazon
1. Собрать реальные партнёрские ссылки по всем товарам (`products.affiliate_url`): формат (`amzn.to`/`amazon.<домен>/dp/<ASIN>?tag=<id>`), тег партнёра в каждой, домен магазина под регион аудитории, ссылки рабочие и ведут именно на этот товар.
2. Проверить условия аккаунта Associates: страна, одобренный сайт, доступ к API (PA/Creators API обычно требует квалифицирующих продаж) — выяснить, можно ли получать цены.
3. Решить по ценам (пункт 3 «Финального списка владельца» в `sites/urban-gardener/plans/phase-x-checklist.md`): убрать цены / подтягивать из API с отметкой времени / принять риск. Если цены из API — кэш не дольше 24 ч, изображения не кэшировать.
4. Оговорка об аффилиатных ссылках (`site_settings.affiliate_disclosure`) и страница Terms соответствуют актуальным правилам Amazon.
5. Только после п. 3: решить, добавлять ли `offers` в `productJsonLd` (цена + валюта, без выдуманных `availability`/рейтингов); проверить Rich Results Test и Search Console → Product snippets.
6. Обновить этот документ и `sites/urban-gardener.md` (журнал решений).
