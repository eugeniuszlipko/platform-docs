# Фаза P (часть 1) — спека для агента: обновление скиллов + SEO-посты Avocado/Urban

> Статус фазы: ОТЛОЖЕНА владельцем 2026-10-20 (вернёмся позже; ничего не начато, код не менялся).

План для владельца: [../plans/2026-10-20-phase-p1-skills-upgrade.md](../plans/2026-10-20-phase-p1-skills-upgrade.md). Уровень: P1–P3, P6 — документы (уровень 1–2, без Superpowers-полного пути); P4, P5 — уровень 3 (миграции/RLS, 2 репо: сайт + web.admin) → на старте каждого короткая дизайн-спека и «да» владельца, impl-план по репо (миграции + два репо), ревью-гейт.
Скиллы для загрузки: `database-migrations`, `postgres-patterns` (P4/P5), `seo`, `react-patterns`, `frontend-a11y`. Ревьюеры (по одному на слой): `database-reviewer`, `react-reviewer`, `seo-specialist`, `silent-failure-hunter` (лоадеры `lib/`).
Контекст7: сверять Next.js 16 sitemap/ISR, Supabase JS — не по памяти.

## 0. Отправные факты (проверено 2026-10-20)
- Исходники скиллов: `platform-docs/skills/{cozycorner,avocado}-content-ops/SKILL.md`, SEO-скилл — `platform-docs/admin-panel/seo-posts-skill.md` (frontmatter `name: seo-posts-cozycorner`; в claude.ai синхронизирован, совпадает). Скилла Urban нет.
- **Дрейф CozyCorner** (скилл от 2026-07-23; нет упоминаний): `product_categories` (миграции 0027/0028, M2M), `posts.preview_token` (0029–0031, column-grant, `anon` не читает), `admin_folders`/`folder_id` (0021/0022). Есть: brands, header_settings, subscribers, about_content, post_type.
- **Дрейф Avocado** (репо-версия правлена 2026-08-08; копия в claude.ai от 2026-08-04 ещё старее — пишет `products.category`, колонка удалена в 0014). В репо-версии нет: `preview_tokens` (0019/0020), `site_settings` (0016), `pages.body` + `about_content`/`contact_content` (0017), `subscribers` (0018), `recipe_ratings` (0012), `recipe_related` (0021, единый резолвер блоков «читайте также»), `posts` folders (0015). Следить: блог-админка, рецепты-админка, `home_slots` курирование (память: только БД).
- **Urban** (схема `urban_gardener`, миграции 0001–0031): `articles` (+ `save_article_rpc`), topics, levels, authors, shop (`save_product_rpc`, brands, categories), home/static pages (RPC), header/site/analytics settings, newsletter popup settings, subscribers, messages, contact page, preview tokens (0030), search RPC. Правила: не писать в таблицы напрямую там, где есть RPC (`save_*` — изучить, можно ли вызывать через коннектор).
- Эталон SEO-постов CozyCorner: `posts.post_type` (`blog|seo`, миграция 0020); лоадеры `lib/posts.ts`, `lib/search.ts` фильтруют `.eq("post_type","blog")` для лент/related/поиска, одиночный пост по slug **не** фильтрует; `app/sitemap.ts` включает blog+seo; в админке — раздел `seo-posts` (`PostsPage section={SEO_POSTS_SECTION}`), папки `admin_folders.section='seo_posts'`. Скилл: `post_type='seo'`, `seo_title`/`seo_description` обязательны, `is_published=false` по умолчанию, slug из триггера, позиции модулей — общая последовательность по двум таблицам секций.
- Жёсткие запреты (решение владельца 2026-10-20, подтверждено): SEO-страницы **не** cloaking: ни редиректов, ни UA-логики, ни `noindex`; открываются по прямому URL всем, входят в sitemap.

## 1. P1 — CozyCorner
1. Через коннектор (`list_tables`, `execute_sql` read-only) снять живую схему `cozycorner`; сверить с каждой секцией скилла и `database/schema.md`.
2. Правки: M2M `product_categories` (инструкция для товара: вставка строк `(product_id, category_id)`; primary = минимальная `categories.position` — сверить с кодом сайта), `preview_token` (агент не трогает; ссылка предпросмотра берётся из админки; колонка закрыта для `anon`), папки (`folder_id` по умолчанию `null`).
3. Пробный прогон: один черновик поста «TEST» → проверить → удалить (спросить подтверждение на удаление по правилам скилла). Товары не создавать без необходимости.
4. Версия/дата в `metadata` frontmatter (`metadata: {version: "YYYY-MM-DD", updated: "YYYY-MM-DD"}`; сверить допустимые ключи с `skill-creator` перед записью). Собрать zip (папка скилла + `SKILL.md`) → в папку `~/Desktop/skills-export/` (согласовать путь с владельцем в отчёте); в отчёте — «загрузите в claude.ai».

## 2. P2 — Avocado
Как P1, схема `avocado_kiss`. Дополнительно:
- Пройти каждый пункт «Дрейф Avocado»; сверить `home_slots` (мозаика/баннер 0004, polymorphic slots 0005), `categories`/`tags`, блоки постов (0008/0009 шаблоны), `recipe_related` + единый резолвер (память `avocado-kiss-unified-recommendations`), preview tokens (память `avocado-kiss-preview-tokens`: сервис-роль обходит RLS → фильтр `is_published` в коде; агенту через коннектор ничего не меняется, но предупреждение о токенах нужно).
- Новые таблицы должны быть закрыты от `anon` явным revoke (память `avocado-kiss-newsletter-subscribe`); в скилле — запрет читать/писать `subscribers`.
- Магазин: оставить ⚠️ «нет черновиков»; добавить обязательное подтверждение «опубликуется сразу». Вопрос черновиков → [B-020](../../../backlog/B-020-avocado-shop-drafts.md).
- Пробный прогон: рецепт-черновик «TEST» → проверка → удаление. Магазин — не пишем.

## 3. P3 — правила пакетной генерации
Единый блок «Batch generation» вставить в каждый content-ops и SEO-скилл (одинаковый текст):
- Максимум **10** сущностей за один запрос; >10 — сначала вопрос владельцу «создать N? Да/нет», после «да» — пачками по ≤10.
- Всё создаётся черновиком (`is_published=false`, явно); публикация — только по явной просьбе по конкретным записям. Исключение — Avocado Shop (черновиков нет): перед ЛЮБОЙ вставкой предупредить «опубликуется сразу» и ждать «да» (на каждую пачку).
- Перед пачкой: показать список заголовков/слагов и получить «да» (для >3 штук); после: итоговая таблица «создано/пропущено/ошибки». Не придумывать фактов, цены/ссылки/характеристики товаров только от пользователя.
- SEO: каждая запись — уникальный запрос/намерение, не вариации одного текста; тонкие/дубли — отказ (ссылка на правила качества SEO-скилла).
- Ошибка посреди пачки — стоп, отчёт, не продолжать молча.

## 4. P4 — SEO-посты Avocado (уровень 3; короткая спека → «да» владельца → impl-план)
Что решить в дизайн-спеке (владельцу — ключевые вопросы опросником, мелочи — в «Что решил сам»):
- Миграция `0022`: `posts.post_type text not null default 'blog' check (post_type in ('blog','seo'))`; индексы по необходимости; проверить гранты/RLS (публичное чтение уже по `is_published`), `database-reviewer`. Проверить, нужна ли колонка в вьюхах/RPC.
- Сайт `avocado.kiss`: **исключить `seo` из** ленты блога, поиска, главной (`home_slots` полиморфные), единого резолвера рекомендаций (post/recipe/product блоки), `related`, тегов/категорий-листингов, RSS (если есть); **не** исключать на странице одиночного поста по slug; включить в `sitemap` (ISR, память `ga4-consent-gated`: sitemap ISR); `generateMetadata` без `noindex`. Каноникал/JSON-LD как у обычного поста. Тест: SEO-пост не в списках, но открывается и в sitemap.
- Админка `web.admin`: раздел `seo-posts` в `sections` avocado; переиспользовать компонент постов с `section`-параметром или адаптировать блог-редактор (у Avocado шаблоны + блоки) — решить в спеке; папки `admin_folders`/posts folders (0015) по образцу Cozy.
- Скилл `seo-posts-avocado` (`platform-docs/skills/seo-posts-avocado/SKILL.md`): контракт данных (posts + body blocks), чек-лист SEO (`seo_title`, `seo_description`, длины), правила качества и запреты cloaking, блок P3, ссылка на content-ops. Образец структуры — `seo-posts-cozycorner`.
- Тесты по `methodology/testing.md` (по спеке, не по коду; 390 px; e2e не от живых данных).

## 5. P5 — Urban: скилл + SEO-посты (уровень 3; до Фазы 9 — решение владельца)
- Скилл `urban-gardener-content-ops`: схема `urban_gardener`; статьи (темы/уровни/авторы, `save_article_rpc`), магазин (`save_product_rpc`, brands, categories), страницы (home/about/contact/privacy/terms через RPC), заметки о том, что не трогать (settings, subscribers, messages, analytics). Для каждой сущности — как агент пишет: напрямую или через RPC (проверить права ролей `authenticated`/`service_role` через коннектор). Блок P3. После Фазы 9 — короткая повторная сверка (запись в Фазу X).
- SEO-посты Urban: у `articles` поле `post_type`/`article_type` (`article|seo`) — имя выбрать по коду; миграция в схеме `urban_gardener` (+ обновление `save_article_rpc` и триггеров/CHECK публикации — см. B-011); сайт: исключить `seo` из лент, поиска (`search_content` RPC!), тем/уровней, главной, related; оставить по прямому URL и в sitemap; админка: раздел `seo-posts` в `sections` urban (статьи имеют темы/уровни/авторов — решить, обязательны ли они для SEO-статьи).
- Скилл `seo-posts-urban` (по образцу).

## 6. P6 — порядок хранилища
- Перенести `admin-panel/seo-posts-skill.md` → `skills/seo-posts-cozycorner/SKILL.md` (git mv), симлинки `.claude/skills/` для новых скиллов, обновить `skills/README.md` (таблица, раздел «как грузить в claude.ai», версия/дата), `platform-docs/AGENTS.md`, ссылки в `admin-panel/status.md`, `schema.md` (раздел про `post_type`), `sites/*.md`.
- `AGENTS.md` реестр/таблицы — при необходимости; память агента обновить в конце каждого шага.

## 7. Определение готовности / проверка
`build` + `lint` + `test` в изменённых репо; ревью-гейт перед приёмкой (P4/P5); миграции применены и проверены `get_advisors`; в отчёте — что проверено, что нет. Отдельно: после P2/P4/P5 владелец загружает скилл в claude.ai — зафиксировать в плане статус «загружено».
