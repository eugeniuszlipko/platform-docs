# Раздел Messages (Urban Gardener) — контракт админки

> Last updated: 2026-10-18 | Проект: web.admin — `src/features/messages/{MessagesPage,useUnreadMessages}`, `src/lib/messages.ts`, пункт меню и счётчик — `src/components/SiteLayout.tsx`,
> маршрут `messages` — `App.tsx`. Сайт-источник — urban.gardener `app/api/contact/route.ts`. Схема БД — [../database/schema.md](../database/schema.md) (миграция 0027).
> Решения — [../sites/urban-gardener.md](../sites/urban-gardener.md) D38 (форма Contact принимает и хранит сообщения; заменяет D9), N8 (уведомление — только счётчик).

## 1. Концепции

- **Источник — `urban_gardener.messages`**: `id`, `name`, `email`, `subject` (необязательна), `message` (≤ 2000), `is_read`, `created_at`. Без IP.
- **Запись не из админки.** Сообщение приходит с формы `/contact` через Route Handler под `service_role` после проверки Turnstile. Админка: читает (`select`), отмечает прочитанным (`update` **только колонки `is_read`** — column-level grant, текст чужого сообщения изменить нельзя), удаляет (право на удаление).
- **Никаких писем-уведомлений** (решение N8): о новом сообщении узнают по счётчику непрочитанных в пункте меню «Messages».
- Раздел включается на сайте через `sections` в `src/config/sites.ts` (`"messages"`) и пункт `NAV_ITEMS` (`to: 'messages'`); сейчас — только Urban Gardener.

## 2. Данные (`src/lib/messages.ts`)

- `listMessages(site)` — `select id,name,email,subject,message,is_read,created_at`, `created_at desc` (новые сверху).
- `countUnreadMessages(site)` — head-запрос `count: exact` с `is_read = false` (без тел сообщений) → число для бейджа.
- `setMessageRead(site, id, isRead)` — `update({is_read}).eq('id').select('id')`; **пустой ответ = ошибка** («Message not found or not allowed»): RLS молча отфильтровывает чужие строки, «успех» без изменений — тихая ошибка.
- `deleteMessage(site, id)` — `delete().eq('id', id)`.
- Ключи TanStack Query: `['messages', site.slug]`, `['messages-unread', site.slug]`; после любого изменения инвалидируются оба.

## 3. Экран

- Заголовок «Messages», счётчик «N · M unread», клиентский поиск (имя, e-mail, тема, текст), кнопка **Select** (массовое удаление через общий `useBulkDelete`).
- Таблица: точка «новое» (+ скрытый текст «New»/«Read» для скринридера), **From** (имя и e-mail), **Message** (тема, а без неё — начало текста; кнопка, открывающая сообщение), **Received** (дата и время), удаление с подтверждением. Непрочитанные — жирным.
- Открытое сообщение (диалог): тема, «From … <e-mail> · дата», полный текст (переносы строк сохраняются), кнопки **Mark as read / Mark as unread**, **Reply by e-mail** (`mailto:` с темой «Re: …»), **Delete**, **Done** (отметить прочитанным). Открытие само не отмечает прочитанным — только явная кнопка.
- Состояния: загрузка (скелетон), «No messages yet.», «No messages match your search.», ошибка загрузки (`role=alert`); ошибка «прочитано» — тост.
- **Счётчик в меню**: бейдж у пункта «Messages» (99+ при > 99); обновляется при фокусе окна и после действий; ошибка счётчика не ломает меню (бейдж просто не показан).

## 4. Проверено / не проверено

Автоматически: `MessagesPage.test.tsx` (список, пометка «новое», поиск, открытие, прочитано/непрочитано, удаление с подтверждением, ошибки), `sites.test.ts`. Права БД проверены SQL под ролями (anon — ничего; authenticated — select/delete и update только `is_read`).
**Не гонялось:** действия под живой сессией администратора (нужен вход владельца): отметка «прочитано» и удаление под реальным RLS, счётчик в меню.
