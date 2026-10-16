# Фаза 3 (Shop) — стартовый промпт для свежего агента

> Для агента (владельцу ничего вставлять не нужно). Владелец стартует фразой **«Начинаем фазу 3»** — агент по мета-скиллу `meta-planning` §6 читает перечисленные ниже документы, отвечает 3–5 строками и начинает.
> **Читать:** план [2026-10-15-phase-3-shop.md](2026-10-15-phase-3-shop.md) (для владельца) → спеку [../specs/2026-10-16-phase-3-shop-spec.md](../specs/2026-10-16-phase-3-shop-spec.md) (она главная для работы) → план/отчёт Фазы 2 [2026-10-15-phase-2-articles.md](2026-10-15-phase-2-articles.md) → [phase-x-checklist.md](phase-x-checklist.md) → `urban.gardener/AGENTS.md`, `platform-docs/sites/urban-gardener.md` (D1–D29), `platform-docs/backlog/`, код CozyCorner (список в спеке).
> Правила: формат общения — мета-скилл; коммит/пуш — только по явной команде; шаг 3D (админка) — сначала спека и утверждение. План Фазы 3 утверждён 2026-10-16 — стартовать можно по фразе владельца.

## Состояние окружения (на 2026-10-15)

- **Репозитории** (каждый — свой git, ветка `main`, remote `github-avocado:eugeniuszlipko/…`; пуш в `main` = автодеплой Vercel, team `cozy-corner`, всегда `--scope cozy-corner`): `urban.gardener/`, `web.admin/`, `platform-docs/`. Корневой `AGENTS.md` лежит вне git.
- **Supabase:** проект base-one, id `zwrkphynupdubevzwdzy`, схема `urban_gardener` (**уже в Exposed schemas**), бакет `urban-gardener-photos`. Миграции Фазы 2: `0001–0006` в `urban.gardener/supabase/migrations/` — новые начинать с `0007`. Применять через MCP `apply_migration` и **дублировать файл в репо** (текст миграции в репо и в БД должен совпадать).
  Publishable key — как в `web.admin/src/config/sites.ts` (публичный). Секретных ключей нет и не нужно.
- **Проверка прав SQL** (как делали в Фазе 2): `begin; select set_config('request.jwt.claims', json_build_object('sub', (select user_id::text from public.admin_users limit 1), 'role','authenticated')::text, true); set local role authenticated; …; rollback;` — запись админа; `set local role anon;` — анон; не-админ — `sub` = любой несуществующий uuid. Ошибки отдельными запросами (ошибка рвёт транзакцию). Всегда `rollback`.
- **Сид из фикстур:** миграцию-сид генерируют скриптом из `lib/*.fixtures.ts` (`node --experimental-strip-types --no-warnings gen.mjs > supabase/migrations/0008_….sql`, в VALUES нулевые колонки типизировать `null::integer` / `null::jsonb`). Скрипт одноразовый — держать в scratchpad, не в репо.
- **Картинки Unsplash:** ссылки референса частично нерабочие/не растения. Рабочие берутся так: WebSearch по `unsplash.com` → страница фото → `WebFetch` с просьбой вернуть `https://images.unsplash.com/photo-…`; проверять `curl -sI` (200, image/jpeg). Хранить `?w=1200&q=80`, `resolveImage(path, width)` сам подставит ширину.
- **Порты и серверы:** e2e Playwright — порт **3200**; на **3000** у владельца может быть свой `next dev`. **Никогда не делай `rm -rf .next`** в `urban.gardener` и не запускай второй `next dev` в той же папке (Next запрещает; чистка ломает dev владельца → ChunkLoadError). Для e2e: `npm run build` → `npx next start -p 3200 &` → `npx playwright test` → `pkill -f "next start -p 3200"`.
- **Окружение сайта:** `.env.local` (в .gitignore) содержит `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` и `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (в production-сборке `getSiteUrl()` без этой переменной бросает ошибку). Vercel env уже заведены (production + preview).
- **Тесты:** `urban.gardener` — Vitest 245+ (`npm test`), в тестах `@/…`-алиас не работает → относительные импорты; `web.admin` — Vitest 258+, алиас работает. После правок: `npm run lint`, `npx tsc --noEmit` (+ `-p tsconfig.vitest.json`), `npm run build`. e2e не должны зависеть от точного числа живых статей/товаров — проверять сидовые по названиям.
- **Инструменты шелла:** macOS, `python3` 3.9, zsh (глоб `--include=*.md` без кавычек падает — кавычить), для текстов с кириллицей в python-скриптах — `io.open(..., encoding='utf-8')`.

## Что уже сделано и переиспользуется

- Общие примитивы сайта (`components/ui/*`: `Pill`, `Breadcrumb`, `PageHead`, `SectionHead`, `Tag`, `SmartLink`, `ButtonLink`…), `Reveal`, `Skeleton`, `.sr-only`, общий оверлейный скроллбар (D25).
- Паттерны Фазы 2: клиентский фильтр через `useSearchParams` под `<Suspense>` + `history.replaceState` (`FilteredArticleGrid`), `ArticleListing` как общий каркас, загрузчики с `throw` на ошибку и `cache()`, мапперы с явными колонками, `resolveImage`, `getSiteUrl/absoluteUrl`, route group `app/<section>/(listing)/` для `loading.tsx` без soft-404.
- Админка: `TaxonomyManager` с `config.usage` (счётчик по id), `mustAffect` (`0 строк` = ошибка), атомарный RPC `save_article` как образец для `save_product`, форма блокируется на время Save, `gcTime: 0` + `key` по id у страницы редактора.

## Не забыть (напоминания владельцу в отчёте)

- Плейсхолдеры `affiliate_url` в сиде — поисковые ссылки Amazon без тега: **реальные партнёрские ссылки внести в админке до запуска** (Фаза 9).
- Текст About с «No affiliate-driven recommendations» противоречит партнёрским ссылкам — **править в Фазе 5, блокирует запуск**.
- Старый черновик «Test Article» (опубликован владельцем при проверке) лежит в БД — владелец удалит сам.
