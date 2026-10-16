# Superpowers subset — процесс агента для крупных фаз

> Last updated: 2026-10-16 | Решение владельца: **плагин не включаем**, берём подмножество
> [obra/superpowers](https://github.com/obra/superpowers) v7.0.0 (commit `bb92f77`, MIT) и подключаем
> **по уровням** через мета-скилл [`superpowers-routing`](../meta/superpowers-routing/SKILL.md).

## Зачем так

Superpowers окупается на крупных многофайловых фазах и тратит токены на мелочах (обзоры, небольшой эксперимент:
[mejba.me](https://www.mejba.me/blog/superpowers-plugin-claude-code-review)). Плагин-режим ставит хук `SessionStart`, который на каждой сессии
вставляет «используй скиллы всегда». Поэтому, как и ECC ([../ecc/README.md](../ecc/README.md)), берём только markdown-файлы без хуков.
Плагин `superpowers@claude-plugins-official` (v5.0.7) в `~/.claude/settings.json` остаётся `false`.

Разделение ролей: **`meta-planning` — формат общения с владельцем** (опросник, план из 7 разделов, «Начинаем фазу N»);
**Superpowers — процесс агента** (дизайн-спека, impl-план, исполнение, ревью, дебаг, проверка).

## Что взято (`skills/<name>/`, уровень по `superpowers-routing`)

| Скилл | Уровень | Для чего |
|---|---|---|
| `brainstorming` (+`builder-check-prompt.md`) | 3 | Выяснить, что нужно владельцу, написать агентскую спеку. Без visual companion |
| `writing-plans` | 3 | Impl-план по задачам, по одному на репозиторий |
| `subagent-driven-development` (+промпты, `scripts/`) | 3 | Исполнение: свежий субагент на задачу + ревью задачи |
| `executing-plans` (+`scripts/`) | 3 | Исполнение inline с журналом и одним финальным ревью |
| `requesting-code-review` (+`code-reviewer.md`) | 3 | Ревью на соответствие плану; далее ревьюеры ECC |
| `systematic-debugging` (+3 техники) | 2, 3 | Сначала причина, потом фикс |
| `verification-before-completion` | 2, 3 | Доказательство перед «готово» |

Не взяты: `using-superpowers` и хук, `using-git-worktrees`, `test-driven-development`, `finishing-a-development-branch`,
`dispatching-parallel-agents`, `receiving-code-review`, `writing-skills`, `diagnosing-superpowers`, скрипты visual companion (локальный Node-сервер).

## Что изменено относительно апстрима

Только: (1) `description` во frontmatter (чтобы скиллы не срабатывали сами на мелочах), (2) блок **Workspace notes** после frontmatter,
(3) `superpowers:<name>` → `<name>` в ссылках между скиллами. Остальной текст — как в v7.0.0. Приоритет: корневой `AGENTS.md` →
`meta-planning` → `superpowers-routing` → скилл. Прочитаны целиком и просканированы (сеть, `eval`, инъекции) 2026-10-16;
скрипты делают только `git`/`awk`/`bash` внутри репозитория, рабочая папка `.superpowers/sdd/` игнорируется git сама.

## Подключение

Симлинки в `.claude/skills/<name>` → `../../platform-docs/skills/superpowers/skills/<name>`; `superpowers-routing` →
`../../platform-docs/skills/meta/superpowers-routing`. Новая сессия подхватывает скиллы. Агент без скиллов читает те же markdown-файлы как чек-листы.

## Как обновлять

Ре-вендоринг: клонировать апстрим (`--branch vX.Y.Z`) в **пустую временную папку**, прочитать diff по взятым файлам целиком,
обновить файлы, пересобрать блок Workspace notes и `description`, поднять версию и commit здесь и в notes. Новые релизы выходят примерно раз в месяц;
обновлять осознанно, а не автоматически. Лицензия апстрима — [LICENSE](LICENSE).
