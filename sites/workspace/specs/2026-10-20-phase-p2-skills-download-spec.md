# Фаза P (часть 2) — спека для агента: раздел «Skills» в web.admin

> Статус фазы: ОТЛОЖЕНА владельцем 2026-10-20 (вернёмся позже; ничего не начато, код не менялся).

План для владельца: [../plans/2026-10-20-phase-p2-skills-download.md](../plans/2026-10-20-phase-p2-skills-download.md). Репо: только `web.admin` (+ правки документации). Миграций нет → уровень 2 (`systematic-debugging` при проблемах, `verification-before-completion`); если упрётся в CORS и придётся делать GitHub Action — решение к владельцу. Скиллы: `react-patterns`, `frontend-a11y`, `testing`, `react-testing`; ревью: `react-reviewer` (один), `a11y-architect` по необходимости. Контекст7: JSZip/fflate, Vite fetch, React Router 7.
Зависимость: Фаза P (часть 1) принята (в `SKILL.md` есть `metadata.version/updated`; SEO-скилл Cozy перенесён в `skills/`).

## 1. Решения (2026-10-20)
- Вариант A: ZIP собирается в браузере из файлов `platform-docs` на GitHub (raw). Раздел — в каждом сайте, пункт внизу `NAV_ITEMS` (`SiteLayout.tsx`), доступ через `sections` в `sites.ts`.
- Принято владельцем с учётом: репозиторий `platform-docs` публичный (проверено `gh`: PUBLIC), `web.admin` приватный; секретов в скиллах нет (grep: ключей/паролей нет, project ref публичен).

## 2. Устройство
1. **Конфиг скиллов.** Новый `src/config/skills.ts`: массив `{ id, siteSlugs[], repoPath, files[] }`, где `repoPath` = `skills/<name>`, `files` — явный список файлов скилла (GitHub API без токена ограничен 60 req/h → дерево не листаем). Привязка к сайтам: cozycorner → `cozycorner-content-ops`, `seo-posts-cozycorner`; avocado → `avocado-content-ops`, `seo-posts-avocado`; urban → `urban-gardener-content-ops`, `seo-posts-urban`.
2. **Источник.** `https://raw.githubusercontent.com/eugeniuszlipko/platform-docs/main/<repoPath>/<file>` (ветка/владелец — константы; владелец репозитория менялся 2026-09-18, см. память `github-account-migration-avocado`). Проверить CORS у raw.githubusercontent.com из браузера (ожидаемо `access-control-allow-origin: *`) **в самом начале P9**; не проходит → вернуться к владельцу с вариантом B (Release из GitHub Action: ZIP при пуше в `platform-docs`, стабильная ссылка `releases/latest/download/<name>.zip`).
3. **Метаданные карточки.** Читаем начало `SKILL.md`: `name`, `description`, `metadata.version/updated` (простой парсер frontmatter; ошибка парсинга → карточка с названием и без версии, но кнопка работает).
4. **Сборка ZIP.** Папка верхнего уровня `<skill-name>/` + файлы (формат загрузки claude.ai: архив с папкой, внутри `SKILL.md`). Библиотека — `fflate` или `JSZip` (**согласовать с владельцем перед установкой**, Context7 сверить). Blob + `URL.createObjectURL`, имя `<skill-name>.zip`. Без кэша `no-store`/cache-bust, чтобы не отдавать устаревшее (raw кэшируется ~5 минут — это окно показать в подсказке).
5. **UI.** Страница `SkillsPage` (`src/features/skills/`), ленивый маршрут `skills` в `App.tsx` + `lazyPages.ts`, пункт `{ to: 'skills', label: 'Skills', icon: ... }` последним в `NAV_ITEMS`; `sections` каждого сайта дополнить `"skills"`. Карточки на shadcn/ui, кнопка «Скачать» с состояниями (загрузка/ошибка), `aria-live` для ошибки; инструкция «Settings → Capabilities → Skills → Upload» (сверить актуальный путь в интерфейсе claude.ai при реализации; не писать по памяти).
6. **Ошибки.** GitHub недоступен/404/CORS → toast + текст в карточке, не пустой ZIP; частичная загрузка файлов скилла → не отдавать архив (всё или ничего). Защита от `silent-failure-hunter` обязательна (см. B-012: тихие потери).
7. **Тесты** (`testing` скилл, по спеке): парсер frontmatter (unit), сборка ZIP из мок-fetch (структура папки, имена), компонент (карточки по сайту, ошибка), e2e без живых данных — подмена сети (правило `testing.md`), 390 px для страницы. `sites.test.ts`: у каждого сайта есть `"skills"`.

## 3. Документация
`admin-panel/status.md` (раздел Skills), `skills/README.md` (раздел «Скачивание из админки»: как работает, ограничение публичного репо, переход на B), `web.admin/AGENTS.md`, запись в Фазу X-чек-лист (проверить кнопку на всех сайтах, CORS, свежесть).

## 4. Проверка
`npm --prefix web.admin run build`, `lint`, `test`, e2e раздела; ручная: скачанный ZIP принят claude.ai (владелец), содержимое = текущий `main`. Коммит/пуш только по команде.
