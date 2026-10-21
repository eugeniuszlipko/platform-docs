# B-022 — Avocado: у `posts`/`recipes` снова табличный SELECT для anon (`preview_token` читается)

**Что (найдено 2026-10-21 при проверке Фазы D2).** Миграция `0020_preview_tokens_column_grant` закрыла `preview_token` у `avocado_kiss.posts`/`recipes` (табличный revoke + column-grant). Но `0021_recipe_related` (2026-08-26) выполнила `grant select on all tables in schema avocado_kiss to anon` и вернула табличный SELECT — сейчас `has_column_privilege('anon', …, 'preview_token', 'select') = true`. Заодно anon видит и новую колонку `publish_at` (D2).

**Реальный риск низкий:** RLS отдаёт anon только опубликованные строки, а токен нужен лишь для черновиков — токены черновиков anon не получает. Но защита «в глубину» из 0020 фактически не работает, а схему описывают как закрытую.

**Предложение.** Новая миграция: `revoke select on avocado_kiss.posts, avocado_kiss.recipes from anon` + `grant select (<все колонки кроме preview_token и publish_at>)` (список из information_schema, как в 0020/0023). Безопасно: публичные загрузчики сайта читают явные списки колонок (`lib/columns.ts`; `select("*")` остался только в `lib/search.ts`, `lib/blog.ts:191`, `lib/shop.ts:86,100` — проверить, не anon ли это по этим таблицам, и перевести на явные списки ДО миграции). Не повторять `grant select on all tables` в будущих миграциях.

**Статус:** СДЕЛАНО 2026-10-21 (avocado.kiss миграция `0026`, применена к base-one). `preview_token` и `publish_at` anon больше не читает (`has_column_privilege` = false); публичные страницы и полная сборка (139 страниц) работают. Заодно сняты права anon на таблицы только для админа/сервера: `subscribers`, `recipe_ratings`, `admin_folders`, `media` (публичный код их не читает; подписка идёт service-role).
