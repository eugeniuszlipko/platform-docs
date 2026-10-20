# Backlog — находки и идеи «по ходу», чтобы не потерять

> Сюда попадает всё, что всплыло при работе над фазой, но не входит в неё: баги соседних проектов, идеи новых функций, вопросы без срочности.
> Правило (мета-скилл `meta-planning` §10): нашли — записали отдельным файлом здесь, дали номер, в чате назвали одной строкой. Фаза не раздувается, находка не теряется.
> Формат файла: **Что** · **Где/как проявляется** · **Предложение** · **Нужно решение владельца** · **Статус**. Статусы: `новая` / `ждёт решения` / `в плане` (в какой фазе) / `сделано` / `отклонено`.

| № | Тема | Проект | Статус |
|---|---|---|---|
| [B-001](B-001-cozycorner-category-breadcrumbs.md) | Хлебные крошки на странице категории зажаты между шапкой и баннером | cozycorner | сделано (запушено) |
| [B-002](B-002-configurable-currency.md) | Настраиваемая валюта сайта/товара (идея фичи) | urban.gardener (и другие) | новая |
| [B-003](B-003-product-url-structure-seo.md) | Структура URL товара и SEO — вопрос владельца и ответ | cozycorner, urban.gardener | сделано (решение принято) |
| [B-004](B-004-db-grants-truncate-and-guard-race.md) | Права `grant all` (TRUNCATE) и гонка триггера защиты в старых таблицах | urban.gardener, cozycorner, avocado.kiss | сделано для Urban в Фазе X (миграция 0031 применена 2026-10-19); Cozy/Avocado — не делалось |
| [B-005](B-005-urban-header-overflow-320.md) | Шапка не помещается в 320px (кнопка меню выступает на 4px) | urban.gardener | сделано и принято в Фазе X (2026-10-19) |
| [B-006](B-006-admin-global-a11y.md) | Доступность админки: reflow 320px, контраст фокуса, заголовки страниц | web.admin | новая |
| [B-007](B-007-e2e-decouple-from-live-data.md) | e2e Urban Gardener зависят от состава живых данных (красные из-за «Test product») | urban.gardener | сделано и принято в Фазе X (2026-10-19) |
| [B-008](B-008-focus-and-keyboard-audit.md) | Фокус и клавиатурная навигация: двойное кольцо в окне рассылки, Tab не доходит до кнопок (вероятно, настройка Safari) — единая политика и проход по проектам, отдельная фаза | urban.gardener (и другие) | принято 2026-10-19 (ветка `feat/focus-keyboard`, не закоммичена) |
| [B-009](B-009-admin-favicon-og-image.md) | Favicon и og:image меняются из админки (поля в Site settings, хранение в Storage) | urban.gardener, web.admin | в плане (Фаза 9) |
| [B-010](B-010-shop-category-crawlability.md) | Товары 13+ в категории не видны краулеру (только кнопка «Show more») | urban.gardener | новая (вернуться при > 12 товаров в категории) |
| [B-011](B-011-urban-db-hardening-leftovers.md) | БД Urban: CHECK-и публикации у `articles`, порядок блокировок | urban.gardener | новая |
| [B-012](B-012-row-limit-guards-and-admin-silent-drops.md) | Лимит 1000 строк PostgREST и тихие потери в админке Urban | urban.gardener, web.admin | новая |
| [B-013](B-013-urban-spec-list-hidden.md) | Таблица характеристик товара скрыта на фронте — удалить совсем или вернуть | urban.gardener, web.admin | ждёт решения |
| [B-014](B-014-urban-dormant-affiliate-columns.md) | Неиспользуемые колонки `affiliate_disclosure`/`price_note` в БД Urban | urban.gardener | новая |
| [B-015](B-015-urban-search-reliability.md) | Поиск: первые запросы не показывают подсказки, нужна проверка скорости и нагрузки (фаза Z) | urban.gardener | в плане (фаза Z) |

