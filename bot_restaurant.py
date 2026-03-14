#!/usr/bin/env python3
"""
Бот для ресторана Readers Pub.
Отдельный код от bot.py (услуги и поддержка). Используется для сайта readers-pub.
"""
import logging
import os

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)


def _load_env(path=".env.bot"):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()

BOT_TOKEN = (
    os.environ.get("TELEGRAM_RESTAURANT_BOT_TOKEN") or
    os.environ.get("TELEGRAM_BOT_TOKEN") or
    ""
).strip()
_owner_str = os.environ.get("OWNER_IDS", "5651149188,728379071")
OWNER_IDS = [int(x.strip()) for x in _owner_str.split(",") if x.strip()]

SITE_URL = os.environ.get("READERS_PUB_URL", "https://readerspub.ru")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

START_TEXT = (
    "✅ <b>Бот работает!</b>\n\n"
    "🍺 <b>Readers Pub</b> — ресторан-паб в центре Ижевска\n\n"
    "Европейская кухня, удмуртская гастрономия, импортное пиво.\n\n"
    "Выберите действие:"
)

CONTACTS_TEXT = (
    "📍 <b>Контакты Readers Pub</b>\n\n"
    "Пушкинская, 223, Ижевск\n\n"
    "📞 Бронирование: +7 3412 693-001\n"
    "📞 Банкеты: +7 982 121 73 75\n\n"
    "⏰ Вс-Чт: 12:00–00:00\n"
    "⏰ Пт-Сб: 12:00–02:00"
)


def main_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🪑 Забронировать стол", url=f"{SITE_URL}/bronirovaniestola")],
        [InlineKeyboardButton("📋 Меню", url=f"{SITE_URL}/page118643816.html")],
        [InlineKeyboardButton("📍 Контакты", callback_data="contacts")],
    ])


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    await update.message.reply_text(
        START_TEXT,
        reply_markup=main_keyboard(),
        parse_mode="HTML",
    )


async def contacts_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if query:
        await query.answer()
        await query.edit_message_text(
            CONTACTS_TEXT + "\n\n" + START_TEXT,
            reply_markup=main_keyboard(),
            parse_mode="HTML",
        )


async def forward_booking_request(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Любое сообщение — заявка на бронь (имя, телефон, дата и т.д.)"""
    message = update.message
    if not message:
        return

    user = message.from_user
    user_info = f"{user.full_name} (@{user.username}) id={user.id}"

    header = f"🪑 <b>Заявка на бронь (Readers Pub)</b> от {user_info}:\n\n"
    text = message.text or message.caption or ""

    if text:
        for owner_id in OWNER_IDS:
            await context.bot.send_message(
                chat_id=owner_id,
                text=header + text,
                parse_mode="HTML",
            )
        await message.reply_text(
            "Спасибо! Ваша заявка принята. Мы свяжемся с вами в ближайшее время."
        )
    else:
        await message.reply_text(
            "Напишите, пожалуйста, желаемую дату, время и количество гостей.\n"
            "Или перейдите по кнопке «Забронировать стол» для оформления заявки.",
            reply_markup=main_keyboard(),
        )


def main() -> None:
    if not BOT_TOKEN:
        print("⚠️  TELEGRAM_RESTAURANT_BOT_TOKEN или TELEGRAM_BOT_TOKEN не задан в .env.bot")
        return

    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(contacts_callback, pattern="^contacts$"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, forward_booking_request))

    print("Readers Pub bot is running. Press Ctrl+C to stop.")
    app.run_polling()


if __name__ == "__main__":
    main()
