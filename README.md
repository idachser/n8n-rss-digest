# RSS-дайджест → Telegram (n8n)

Пользователь управляет списком RSS/Atom-лент через Telegram-бота. Раз в день n8n собирает свежие публикации, LLM (Gemini или Claude) выбирает самое значимое и пишет короткую выжимку, а бот присылает её вам в личку или публикует в канал.

## Что внутри

| Файл | Что делает |
|---|---|
| `workflows/setup.json` | Создаёт Data Tables `rss_sources` и `rss_seen`. Запустить один раз вручную. |
| `workflows/bot.json` | Бот: `/add <url>`, `/list`, `/remove <номер или url>`. Перед добавлением проверяет, что лента читается и что её ещё нет в списке. |
| `workflows/digest.json` | Каждый день в 9:00: ленты → свежее за 26 ч → отсев уже обработанного → Gemini или Claude → пост в Telegram. |

Как работает дайджест:

- Все ленты читаются за один проход. Сломанная лента не роняет запуск: её можно получить отдельным сообщением админу (`adminChatId`).
- Все ссылки, которые уже были показаны модели (а не только опубликованные), хранятся в `rss_seen` 30 дней. Поэтому новость, которую сегодня отбросили, завтра не всплывёт снова как «свежая».
- Лимиты: не больше 20 публикаций с одного источника и 150 всего на один запрос к модели.
- Модель получает пронумерованный список и возвращает JSON (structured outputs): `id`, заголовок и выжимку. Ссылки и названия источников берутся из ленты, а не из ответа модели, поэтому выдуманных ссылок быть не может.
- Пост собирается в Telegram-HTML с экранированием. Если текст длиннее лимита Telegram, он делится на несколько сообщений.

## Установка

1. **Бот.** Создайте бота у [@BotFather](https://t.me/BotFather) и сохраните токен. Напишите боту `/start`, иначе он не сможет вам писать. Для публикации в канал добавьте бота **администратором** канала.
2. **Ваш Telegram user id** можно узнать у [@userinfobot](https://t.me/userinfobot). Бот будет слушать только этот id.
3. **Публичный HTTPS.** Telegram Trigger работает через webhook, поэтому n8n должен быть доступен снаружи по HTTPS: свой домен с reverse proxy или туннель, например `cloudflared tunnel --url http://localhost:5678`. Адрес пропишите в `.env`:
   ```sh
   cp .env.example .env   # WEBHOOK_URL=https://…/
   docker compose up -d
   ```
4. **Импорт:**
   ```sh
   docker compose exec n8n n8n import:workflow --separate --input=/workflows
   ```
   Или вручную через UI: *Workflows → Import from File*.
5. **Credentials** (в UI n8n, *Credentials → Add*):
   - **Telegram API**: токен бота. Выберите его в нодах `Telegram Trigger`, `Reply` и `Send to Telegram`.
   - **Header Auth** для Gemini: Name `x-goog-api-key`, Value — ключ из [Google AI Studio](https://aistudio.google.com/apikey). Выберите его в ноде `Gemini`.
   - **Header Auth** для Claude (если нужен): Name `x-api-key`, Value — ключ из [Claude Console](https://platform.claude.com/settings/keys). Выберите его в ноде `Claude`.
   - Telegram-credential выберите также в ноде `Notify admin`.
6. **Настройка:**
   - `RSS Digest — бот`, нода `Telegram Trigger`: в *Restrict to User IDs* — ваш id (несколько id — через запятую).
   - `RSS Digest — дайджест`, нода `Config`: `chatId` (ваш id для лички, `@канал` или `-100…`), `provider`, при желании `adminChatId`, `topN`, `lookbackHours` и т. д.
   - Расписание меняется в ноде `Schedule` (cron, часовой пояс берётся из `TZ`).
7. Один раз запустите `RSS Digest — создать таблицы`, затем **опубликуйте** (Publish) бота и дайджест.
8. Напишите боту `/add https://meduza.io/rss/all`, затем `/list`. Дайджест можно запустить вручную кнопкой *Execute workflow*.

> Если вы обновили JSON и импортировали его повторно, опубликуйте workflow заново: опубликованная версия сама не обновляется.

## Модель

Провайдер выбирается в `Config` полем `provider`:

- `gemini` (по умолчанию): `geminiModel: 'gemini-3.6-flash'`, вызов `models.generateContent`. У Gemini API есть бесплатный тариф для моделей Flash; актуальные лимиты смотрите в AI Studio. На бесплатном тарифе Google может использовать запросы для улучшения своих продуктов.
- `claude`: `claudeModel: 'claude-opus-5-5'` с `claudeEffort: 'medium'`, вызов Messages API. Включён `fallbacks: "default"`: если классификатор безопасности отклонит запрос, Anthropic повторит его на подходящей модели. Дешевле: `claude-sonnet-5-5` или `claude-haiku-5-5`.

Оба провайдера получают одинаковый промпт и JSON-схему ответа, остальная часть workflow от выбора не зависит.

## Разработка

Код Code-нод лежит в `src/` отдельными файлами. JSON в `workflows/` собирается скриптом:

```sh
node scripts/build.mjs
```
