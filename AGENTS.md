# Workspace: workspace-one

## Projects in this workspace
- `platform-docs/` — shared documentation (this project)
- `cozycorner/` — public catalog site for cozy home goods (Next.js 16 App Router + Supabase); live: https://www.cozycorner.me
- `avocado.kiss/` — culinary recipe magazine (Next.js 16 App Router + Supabase)
- `urban.gardener/` — houseplant-care journal + curated plant/product catalog (Next.js 16 App Router + Supabase); phases 0–6 accepted and deployed to the temporary URL https://urban-gardener.vercel.app (noindex until Phase 9); Phase 7 (Newsletter + Contact) planned
- `web.admin/` — multi-site admin panel for managing site content (Vite + React SPA + Supabase)

## Documentation index
Read these files only when the task requires it:

| Topic | File | Read when |
|---|---|---|
| Database schema | platform-docs/database/schema.md | Any DB query, migration, or Supabase task |
| Admin panel API | platform-docs/admin-panel/api.md | Building features that call admin endpoints |
| Admin components | platform-docs/admin-panel/components.md | Reusing or extending admin UI components |
| Admin Media section | platform-docs/admin-panel/media.md | Editing Media section or folders (any section) |
| Admin Products section | platform-docs/admin-panel/products.md | Editing Products; before any new CRUD section |
| Admin Blog/SEO Posts (cozycorner) | platform-docs/admin-panel/blog.md | Editing cozycorner Blog or SEO Posts sections |
| Admin Blog editor (Avocado Kiss) | platform-docs/admin-panel/blog-avocado-kiss.md | Building the Avocado Kiss Blog (Article) editor in web.admin |
| Admin Recipes section (Avocado Kiss) | platform-docs/admin-panel/recipes-avocado-kiss.md | Editing the Avocado Kiss Recipes section or Recipe categories |
| Admin homepage curation (Avocado Kiss) | platform-docs/admin-panel/home-avocado-kiss.md | Curating the Avocado Kiss homepage (`home_slots`, Editor's Picks) — lives in Pages → Homepage |
| Admin: About / Privacy / Terms / Site settings (Urban Gardener) | platform-docs/admin-panel/static-pages-urban-gardener.md | Pages → Site settings / About / Privacy / Terms (web.admin `features/ug-static/`, `lib/ugStatic.ts`; RPC `save_about_page`, `save_site_settings`) |
| Admin Pages section | platform-docs/admin-panel/pages.md | Editing Pages section |
| Admin status & roadmap | platform-docs/admin-panel/status.md | Planning admin work; checking pending tasks |
| Sites overview | platform-docs/sites/overview.md | Starting work on any public-facing site |
| CozyCorner architecture | platform-docs/sites/cozycorner.md | Any work in the cozycorner repo |
| Avocado Kiss architecture | platform-docs/sites/avocado-kiss.md | Any work in the avocado.kiss repo |
| Urban Gardener (decisions, pages, design tokens) | platform-docs/sites/urban-gardener.md | Any work in the urban.gardener repo |
| Urban Gardener roadmap (phases + checklists) | platform-docs/sites/urban-gardener/plans/2026-10-14-urban-gardener-roadmap.md | Planning or starting a phase of urban.gardener |
| Coding standards | platform-docs/methodology/coding-standards.md | New files, refactoring, code review |
| Overlay scrollbar module | platform-docs/methodology/overlay-scrollbar/README.md | Touching scrollbars anywhere; vendoring the shared module into a repo |
| Testing strategy | platform-docs/methodology/testing.md | Writing/running tests; choosing a test tool; CI |
| External image re-hosting (concept, not implemented) | platform-docs/methodology/external-image-rehosting.md | Considering fixing unoptimized Amazon/Unsplash image weight on a site |
| Per-repo GitHub account (SSH setup) | platform-docs/methodology/github-account-per-repo.md | Moving a repo to a different GitHub account (Vercel Hobby plan limits), setting up push access locally |
| ECC subset (external skills + reviewers) | platform-docs/skills/ecc/README.md | Choosing which skill/reviewer agent to use for React, a11y, DB migrations, SEO; adding or updating vendored skills |
| Backlog (находки по ходу: баги соседних проектов, идеи фич) | platform-docs/backlog/README.md | Нужно записать находку, не раздувая фазу; посмотреть, что отложено |
| **Мета** (общие правила всех проектов: планирование, вопросы, старт/приёмка фазы, Фаза X) | platform-docs/skills/meta/README.md, skills/meta/meta-planning/SKILL.md | Любое планирование фазы/фичи, вопросы владельцу, старт «Начинаем фазу N», приёмка, итоговая проверка |
| Connector content-ops skills | platform-docs/skills/README.md | Loading/editing the claude.ai content-ops skills (per-site content editing) |

## Workflow rules
1. Before starting a task — check if a relevant doc file exists in the index above
2. Before writing code or tests against an external library API — verify it with **Context7 MCP** (`resolve-library-id` → `query-docs`); the workspace runs recent majors (Next.js 16, React 19, Vite 8, Vitest 4), so model memory is often stale. Our own specs (this index) stay the source of truth for schema, features, and conventions — see root `../AGENTS.md` → «Внешняя документация — Context7»
3. After completing a task that changes architecture, API, or DB — update the relevant doc file
4. Never write feature details into AGENTS.md — put them in the appropriate doc file above
5. When creating a new site project — add it to "Projects" section, create sites/[site-name].md, AND wire testing: register it in the root `../AGENTS.md` project registry and follow methodology/testing.md → «Добавление нового проекта» (so any AI agent auto-picks it up for test routing)

## Context discipline
- AGENTS.md = index only (you are reading it now)
- Doc files = loaded on demand, only when needed
- Never summarize doc file contents back into AGENTS.md
