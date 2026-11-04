# Pages → Brand — логотип, иконка сайта, картинка для соцсетей

> Last updated: 2026-11-04 | Фаза L (B-009) | Репозиторий `web.admin/`, пути `src/…`. Код готов, ждёт приёмки «Принимаем фазу L».

Экран для **avocado_kiss** и **urban_gardener** (cozycorner — нет). Правит три вещи сайта:
логотип шапки, одну квадратную иконку сайта и картинку по умолчанию для соцсетей (OG).
Пустое значение = сайт показывает файл из репо (`public/brand/`).
Модель данных — [../database/schema.md](../database/schema.md) (avocado §9 `site_settings`, миграция 0029; urban §10 `site_settings`, миграция 0036).
Спека и планы — `sites/workspace/plans/2026-11-04-phase-l-brand-from-admin.md`, `specs/2026-11-04-phase-l-brand-from-admin-spec.md`, `specs/2026-11-04-phase-l-impl-plan-*.md`.

## 1. Маршрут и вход

- Маршрут `/:siteSlug/pages/brand` (`BrandRoute` в `src/features/pages/PagesRoutes.tsx`): для сайтов, кроме avocado и urban, редирект в `/:siteSlug/pages`.
- В списке Pages закреплённая ссылка **«Brand»**: `AvocadoPagesPage.tsx` и `UgPagesPage.tsx`.
- Экран — `src/features/pages/BrandPage.tsx` (форма `BrandForm`), поле — `BrandAssetField.tsx`.
- `BrandForm` монтируется с `key={site.slug}`: выбранные, но не сохранённые файлы не переносятся на другой сайт (иначе ушли бы в чужой бакет).

## 2. Поля и правила файла

| Поле | Колонки `site_settings` | Требования к исходнику | Что загружается |
|---|---|---|---|
| Header logo | `logo_path`, `logo_width`, `logo_height` | ширина ≥ 240 px | один PNG, ширина не больше 1200 px |
| Site icon | `icon_path` (512), `icon_apple_path` (180), `icon_small_path` (48) | квадрат, ≥ 512×512 | три PNG 512 / 180 / 48 |
| Social sharing image | `og_image_path` | ≥ 1200×630 | один JPEG 1200×630 |

Общие правила (`src/lib/brandImage.ts`): форматы PNG, JPEG, WebP (SVG, ICO, GIF не принимаются); файл ≤ 6 MB; длинная сторона исходника ≤ 8000 px. Текст ошибки показывается под полем; прежний выбор и сохранённое значение при ошибке не меняются.

## 3. Обработка в браузере (`src/lib/brandProcess.ts`)

Всё идёт через canvas, поэтому метаданные (EXIF, GPS) в Storage не попадают.
- **Логотип:** перекодируется в PNG (прозрачность сохраняется), уменьшается до 1200 px по ширине, если шире.
- **Иконка:** цепочка 512 → 180 → 48 (каждый шаг от предыдущего). 48 px — кратно 48 (рекомендация Google для favicon).
- **OG:** центрированная обрезка «cover» до 1200×630; под прозрачностью белый фон; JPEG, качество 0.85.
- Выбор файла только готовит превью (blob-URL); в сеть ничего не уходит до Save. Превью показывает результат обработки.

## 4. Save и Reset (`src/lib/brand.ts`)

- **Save** (`saveBrand`): сначала загружаются ВСЕ выбранные файлы, затем один `update` строки `site_settings` по `id`, который возвращает свежую строку (`.select`), повторного чтения нет. Группа пишется целиком (иконка — все три размера, логотип — путь+ширина+высота).
  - Сбой загрузки → уже загруженные в этот Save объекты удаляются (по возможности), строка не меняется.
  - После начала `update` объекты **никогда не удаляются** (ответ мог потеряться после записи).
  - Update, вернувший 0 строк (RLS молча отфильтровал), считается ошибкой.
- **Reset to default** (`resetBrand`): обнуляет всю группу колонок (логотип — 3 колонки, иконка — 3, OG — 1) отдельным update; сайт снова берёт файл из репо. Кнопка рядом с подписью «(re-upload to undo)». Если есть невыбранное — вместо Reset показывается **Discard selection** (сбрасывает только несохранённый выбор).
- Чтение: `getBrandSettings` — первая строка по `created_at`, явные колонки. Query-ключ `['brand', site.slug]`; после Save/Reset кладётся `setQueryData`.
- Запись — прямой `update` под админ-сессией (RLS `is_admin()`); у urban RPC `save_site_settings` бренд-колонок не трогает.

## 5. Файлы в Storage

- Ключ: `brand/<часть>-<timestamp>.<ext>`, часть ∈ `logo`, `icon`, `icon-apple`, `icon-small`, `og`; бакет сайта (`avocado-kiss-photos` / `urban-gardener-photos`). В БД хранится только этот ключ (формат ограничен CHECK-ом, см. schema.md).
- **Строк в `media` не создаётся** — удаление картинки в медиатеке не сломает логотип.
- Старые объекты при замене не удаляются (новое имя на каждую замену = нет устаревшего кэша). Лимиты mime/size на самом бакете — открытый пункт B-026.

## 6. Доступность

`aria-disabled` вместо `disabled` во время работы (фокус не падает на `<body>`); живая область статуса (`role="status"`) у каждого поля; после Discard/Reset фокус возвращается на выбор файла, после Save — на заголовок `h1` «Brand»; панель Save стоит после полей (порядок Tab = визуальный).

## 7. Когда изменения видны на сайте

Тост после Save: «the site updates within a couple of minutes» — задержка до ~2 минут (`unstable_cache` 60 с + ISR 60 с). Кэши вне сайта дольше: иконка вкладки браузера — часы; favicon в поиске Google — дни–недели; превью в соцсетях кэшируются (Facebook Sharing Debugger для пересканирования). Urban остаётся `noindex`, пока не включён `ALLOW_INDEXING`.

## 8. Тесты

`src/lib/brandImage.test.ts`, `src/lib/brand.test.ts`, `src/features/pages/BrandPage.test.tsx`, `src/features/pages/BrandAssetField.test.tsx`. Canvas в jsdom не работает: математика вынесена в `brandImage.ts`, страница тестируется с моком обработки.

## 9. Вне объёма

SVG-логотип; удаление старых объектов Storage; запись брендовых файлов в `media`; ограничения mime/size бакета (B-026).
