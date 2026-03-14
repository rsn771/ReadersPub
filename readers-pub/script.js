// Readers Pub - Script (брони уходят в Telegram через server.py)

function getApiBase() {
    return window.location.origin;
}

async function submitForm(url, data) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Ошибка отправки');
    return json;
}

document.addEventListener('DOMContentLoaded', () => {
    const api = getApiBase();

    // Banquet form
    const banquetForm = document.getElementById('banquetForm');
    if (banquetForm) {
        banquetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = banquetForm.querySelector('button[type="submit"]');
            const origText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Отправка...';
            try {
                const data = {
                    event_type: banquetForm.querySelector('[name="event_type"]').value,
                    comments: banquetForm.querySelector('[name="comments"]').value
                };
                await submitForm(api + '/api/banquet', data);
                alert('Спасибо! Ваша заявка принята. Мы свяжемся с вами в ближайшее время.');
                banquetForm.reset();
            } catch (err) {
                alert('Ошибка: ' + err.message + '\n\nЗапустите сервер: cd readers-pub && python3 server.py');
            } finally {
                btn.disabled = false;
                btn.textContent = origText;
            }
        });
    }

    // Booking form
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = bookingForm.querySelector('button[type="submit"]');
            const origText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Отправка...';
            try {
                const data = {
                    name: bookingForm.querySelector('[name="name"]').value,
                    phone: bookingForm.querySelector('[name="phone"]').value,
                    date: bookingForm.querySelector('[name="date"]').value,
                    time: bookingForm.querySelector('[name="time"]').value,
                    guests: bookingForm.querySelector('[name="guests"]').value
                };
                await submitForm(api + '/api/booking', data);
                alert('Бронирование отправлено! Ждём вас в Readers Pub.');
                bookingForm.reset();
            } catch (err) {
                alert('Ошибка: ' + err.message + '\n\nЗапустите сервер: cd readers-pub && python3 server.py');
            } finally {
                btn.disabled = false;
                btn.textContent = origText;
            }
        });
    }
});
