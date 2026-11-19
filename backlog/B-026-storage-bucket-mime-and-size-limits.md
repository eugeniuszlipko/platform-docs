# B-026 — Бакеты Storage без ограничения типов и размера файлов

**Что (2026-11-04, ревью безопасности Фазы L).** У `avocado-kiss-photos` и `urban-gardener-photos` в настройках бакета `allowed_mime_types` и `file_size_limit` пустые. Тип (PNG/JPEG/WebP/GIF) и размер (6 МБ) проверяет только админка в браузере. Писать в бакеты может только админ (политики `is_admin()`), поэтому риск низкий.

**Предложение.** Задать в бакетах `allowed_mime_types = {image/png,image/jpeg,image/webp,image/gif}` и `file_size_limit = 6 МБ` (GIF нужен медиатеке). Проверить, что админка не загружает другие типы.

**Нужно решение владельца:** да, при выборе момента (меняет настройки Storage в рабочем проекте). **Статус:** новая.

**Статус (2026-11-19):** сделано для `avocado-kiss-photos` и `urban-gardener-photos`: `allowed_mime_types = {png, jpeg, webp, gif}`, `file_size_limit = 6291456` (6 МБ). Миграции `avocado.kiss/0032_storage_bucket_limits.sql` и `urban.gardener/0038_storage_bucket_limits.sql`, применены к base-one. Все существующие файлы (jpeg/png/webp, до 3,7 МБ) под лимиты подходят; живая загрузка запрещённого типа не пробовалась. Бакет `cozycorner-photos` (то же пустое ограничение) не трогали — вне B-026, при желании тем же приёмом.
