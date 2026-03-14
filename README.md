# Readers Pub

Сайт ресторана Readers Pub и Telegram-бот для приёма бронирований.

## Структура

- **readers-pub/** — сайт ресторана (статичные страницы + API бронирования)
- **bot_restaurant.py** — Telegram-бот с кнопками «Забронировать», «Меню», «Контакты»

## Установка

```bash
# Клонировать репозиторий
git clone https://github.com/rsn771/ReadersPub.git
cd ReadersPub

# Создать виртуальное окружение и установить зависимости
python3 -m venv venv
source venv/bin/activate   # Linux/macOS
# или: venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Настроить конфиг
cp .env.bot.example .env.bot
# Отредактировать .env.bot: TELEGRAM_RESTAURANT_BOT_TOKEN, OWNER_IDS
```

## Запуск

### Сайт (с API бронирования → Telegram)

```bash
cd readers-pub
python3 server.py
```

Сайт будет доступен по адресу **http://localhost:8081** (или другой свободный порт).

Брони столов и заявки на банкет отправляются в Telegram владельцам (OWNER_IDS).

### Бот

В отдельном терминале:

```bash
source venv/bin/activate
python bot_restaurant.py
```

Бот отвечает на /start, показывает кнопки «Забронировать стол», «Меню», «Контакты».

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_RESTAURANT_BOT_TOKEN` | Токен бота (от @BotFather) |
| `OWNER_IDS` | ID Telegram получателей заявок (через запятую) |
| `READERS_PUB_URL` | URL сайта для кнопок бота (по умолчанию https://readerspub.ru) |
| `PORT` | Порт сервера (по умолчанию 8081) |

## Деплой на Vercel

1. Импортируйте репозиторий в [Vercel](https://vercel.com)
2. **Важно:** в настройках проекта укажите **Root Directory** = `readers-pub`
3. Framework Preset: **Other**
4. Build Command: оставьте пустым
5. Output Directory: `.`
6. Добавьте переменные окружения:
   - `TELEGRAM_RESTAURANT_BOT_TOKEN` — токен бота
   - `OWNER_IDS` — ID получателей заявок (через запятую)

После деплоя сайт будет доступен по вашему Vercel-домену. API бронирования (`/api/booking`, `/api/banquet`) работает через serverless-функции.

## Лицензия

MIT
