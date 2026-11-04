# B-024 — Avocado: удалить старую колонку `recipes.author_name`

**Что (2026-11-04).** Автор рецепта переведён на справочник `authors` (миграция `0028`, колонка `recipes.author_id`, решение владельца). Текстовая `recipes.author_name` больше не читается новым кодом сайта и админки, но оставлена (expand-contract): прод-сайт до деплоя ещё выбирает её в `PUBLIC_RECIPE_COLUMNS`.

**Значения, которые не перенеслись:** «Mark P.» и «Test» (в справочнике авторов таких нет) — эти рецепты теперь без автора. «Anna I.» → Anna Ivarsson.

**Предложение.** После деплоя avocado.kiss и web.admin — миграция `alter table avocado_kiss.recipes drop column author_name` (column-grant anon на неё снимется сам).

**Нужно решение владельца:** нет. **Статус:** новая (ждёт деплоя).
