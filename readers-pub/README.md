# readers-pub — Сайт ресторана

Локальная копия сайта [readerspub.ru](http://readerspub.ru/).

## Запуск

```bash
cd readers-pub
python3 server.py
```

Откройте: **http://localhost:8081**

Брони и заявки на банкет уходят в Telegram (см. `.env.bot` в корне проекта).

## Структура

- `server.py` — сервер + API бронирования → Telegram
- `index.html` — главная
- `bronirovaniestola.html` — бронирование стола
- `menu.html` — меню
- `standup.html` — стенд-ап
- `privacy.html` — политика конфиденциальности
