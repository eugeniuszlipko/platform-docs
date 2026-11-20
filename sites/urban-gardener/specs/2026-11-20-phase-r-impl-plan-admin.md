# Phase R — web.admin impl plan

> Spec: `2026-11-20-phase-r-urban-cozy-fixes-spec.md` (раздел «Admin — web.admin»). Репо `web.admin`, ветка `feat/phase-r`.
> Без коммитов/пушей/установки зависимостей. БД-контракт — миграция 0040 (параллельно); в тестах Supabase мокается.

## Задача 1 — убрать Levels
- Удалить: `src/features/taxonomy/LevelsPage.tsx`, `levelConfig` в `taxonomy/config.ts`, `levels`-функции/тип/ключ в `src/lib/ugTaxonomy.ts`.
- Убрать route `levels` (`App.tsx`, `lazyPages.ts`), пункт навигации (`components/SiteLayout.tsx`), `levels` из `sections` в `config/sites.ts`.
- `lib/ugArticles.ts`: убрать `level_id` из типа/`ARTICLE_COLUMNS`, `level:levels(name)` из списка; `UgArticlesPage.tsx` — бейдж уровня.
- `UgArticleEditPage.tsx` / `ugArticleForm.ts`: поле Level, `level_id` в схеме/`toInput`/`toFormValues`; инвалидация `ug-level-usage`.
- Тесты: убрать level-кейсы (`ugTaxonomy.test`, `reorder.test`, `sites.test`, фикстуры статей).

## Задача 2 — автор и время чтения необязательны
- `ugArticleForm.ts`: `author_id` без валидации (`''` → null), убрать правила «needs a reading time»; `read_minutes_auto` в типе статьи.
- `UgArticleEditPage.tsx`: Select автора с «No author», подсказки под Read time («Leave empty — calculated from the text», «Auto: N min»).
- `lib/ugArticles.ts`: `author_id: string | null`, `read_minutes_auto` читается (в payload не уходит).

## Задача 3 — блоки: RichTextEditor + «Article link» + «Products»
- `lib/ugArticles.ts`: типы блоков `article` / `products`, `BlockRow` + `BLOCK_COLUMNS` (`linked_article_id`, `product_ids`), `rowToBlock`, `blockToPayload`.
- `ugArticleForm.ts`: схемы блоков (article — цель обязательна; products — 1–3), `emptyBlock`, `toBlocks`, `toBlockFormValue`.
- Новые файлы: `UgBlockArticlePicker` (диалог выбора статьи, исключает текущую, бейдж Draft) и `UgBlockProductsField` (выбор 1–3 товаров, порядок, удаление) в `features/ug-articles/`; `UgBlocksEditor.tsx` — меню, text/callout на `RichTextEditor` (`links`), заметка «no longer exists».
- Пикер товаров — `UgHomePickerDialog` (kind=product); для статей добавляется опция `excludeIds` (уже есть) — переиспользуем.

## Задача 4 — Homepage: Auto/Manual
- `lib/ugHome.ts`: поля `journal_mode`, `shop_mode`, `shop_limit` в `UgHomePageRow` / `PAGE_COLUMNS` / `UgHomePageInput`; `fetchUgJournalAutoPreview`, `fetchUgShopAutoPreview` (явный `is_published=true`, `published_at desc, id desc`, journal без featured).
- Новый `features/ug-home/UgHomeModeControl.tsx` + хуки превью; `UgHomeSlotsEditor.tsx` — режим, dim + «Saved — shown when Manual is selected» + `aria-describedby`.
- `ugHomeForm.ts`: схема/значения/`toPageInput`; `UG_HOME_CAPACITY.shop` 3→12; подсказки слотов.
- `UgHomePage.tsx`: проброс режима/лимита в слоты.

## Задача 5 — сортировка товаров
- `UgProductsPage.tsx`: Select «Sort products» (Newest / Oldest / Name A–Z / Name Z–A), чистая функция сортировки (`sortProducts` в `ugProductForm.ts`), совместима с фильтрами.

## Задача 6 — тесты
- `ugArticleForm.test.ts`, `ugArticles.test.ts` (схема, payload, маппинг), `UgBlocksEditor.test.tsx` (add/remove новых блоков, RichTextEditor), `ugHome.test.ts` (запросы превью), `ugHomeForm.test.ts`, `UgHomePage.test.tsx` (режимы, dim, shop_limit), `UgProductsPage.test.tsx` (сортировка).

## Задача 7 — проверка
- `npm test`, `npm run lint`, `npm run build`; новых `tsc`-ошибок в `tsconfig.vitest` нет.
