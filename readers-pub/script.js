// Readers Pub - Script (брони уходят в Telegram через server.py)

function getApiBase() {
    return window.location.origin;
}

// График мероприятий: во время игр брони не принимаются. После 22:30 — можно.
// Вс (2 игры): блок 14:00–22:29. Остальные дни: блок 18:00–22:29. С 22:30 брони доступны.
const EVENT_DAYS_2026_03 = {
    '2026-03-01': { sunday: true },  '2026-03-03': { sunday: false }, '2026-03-04': { sunday: false },
    '2026-03-05': { sunday: false },  '2026-03-06': { sunday: false }, '2026-03-07': { sunday: false },
    '2026-03-08': { sunday: true },  '2026-03-09': { sunday: false }, '2026-03-10': { sunday: false },
    '2026-03-11': { sunday: false }, '2026-03-12': { sunday: false }, '2026-03-13': { sunday: false },
    '2026-03-15': { sunday: true },  '2026-03-16': { sunday: false }, '2026-03-17': { sunday: false },
    '2026-03-18': { sunday: false }, '2026-03-19': { sunday: false }, '2026-03-20': { sunday: false },
    '2026-03-22': { sunday: true },  '2026-03-23': { sunday: false }, '2026-03-24': { sunday: false },
    '2026-03-25': { sunday: false }, '2026-03-26': { sunday: false }, '2026-03-27': { sunday: false },
    '2026-03-29': { sunday: true },  '2026-03-30': { sunday: false }, '2026-03-31': { sunday: false }
};

function getEventBlockForDate(dateStr) {
    const event = EVENT_DAYS_2026_03[dateStr];
    if (!event) return null;
    return event.sunday
        ? { start: '14:00', end: '22:29', label: 'На этот день запланировано мероприятие (2 игры). Брони доступны до 14:00 и с 22:30.' }
        : { start: '18:00', end: '22:29', label: 'На этот день запланировано мероприятие. Брони доступны до 18:00 и с 22:30.' };
}

function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

// Режим работы: Пн–Чт, Вс 12:00–00:00; Пт–Сб 12:00–02:00
function isWithinOpeningHours(dateStr, timeStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay(); // 0 Вс, 1 Пн, ..., 6 Сб
    const t = timeToMinutes(timeStr);
    const fromNoon = 12 * 60;   // 720
    const twoAM = 2 * 60;      // 120
    if (day >= 1 && day <= 4 || day === 0) {
        return t >= fromNoon || t === 0;
    }
    return t >= fromNoon || t <= twoAM;
}

function getOpeningHoursHint(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    if (day === 5 || day === 6) return 'В этот день ресторан работает 12:00–02:00.';
    return 'В этот день ресторан работает 12:00–00:00.';
}

function isTimeInBlockedRange(timeStr, block) {
    if (!block) return false;
    const t = timeToMinutes(timeStr);
    const start = timeToMinutes(block.start);
    const end = timeToMinutes(block.end);
    return t >= start && t <= end;
}

function getNearestAvailableSlot(dateStr, block) {
    if (!block) return null;
    return { date: dateStr, time: '22:30' };
}

function formatDateForDisplay(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const dayOfWeek = days[d.getDay()];
    return `${day}.${String(month).padStart(2, '0')} (${dayOfWeek})`;
}

async function submitForm(url, data) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Ошибка отправки');
    if (json.ok === false && json.message) throw new Error(json.message);
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
        const dateInput = bookingForm.querySelector('input[name="date"]');
        const timeInput = bookingForm.querySelector('input[name="time"]');
        let eventHintEl = null;

        function updateTimeRestriction() {
            const dateStr = dateInput.value;
            if (!dateStr) {
                timeInput.removeAttribute('min');
                timeInput.removeAttribute('max');
                if (eventHintEl) eventHintEl.remove();
                return;
            }
            const block = getEventBlockForDate(dateStr);
            if (block) {
                timeInput.removeAttribute('min');
                timeInput.removeAttribute('max');
                if (!eventHintEl) {
                    eventHintEl = document.createElement('p');
                    eventHintEl.className = 'event-hint';
                    eventHintEl.style.cssText = 'margin-top:6px;font-size:0.85rem;color:rgba(255,255,255,0.85);';
                    timeInput.closest('.form-group').appendChild(eventHintEl);
                }
                eventHintEl.textContent = block.label;
            } else {
                timeInput.removeAttribute('min');
                timeInput.removeAttribute('max');
                if (eventHintEl) eventHintEl.textContent = '';
            }
        }

        dateInput.addEventListener('change', updateTimeRestriction);
        dateInput.addEventListener('input', updateTimeRestriction);

        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dateStr = bookingForm.querySelector('[name="date"]').value;
            const timeStr = bookingForm.querySelector('[name="time"]').value;
            const block = getEventBlockForDate(dateStr);

            if (!isWithinOpeningHours(dateStr, timeStr)) {
                alert('Ресторан в этот день закрыт в выбранное время. Пн–Чт, Вс: 12:00–00:00. Пт–Сб: 12:00–02:00.');
                return;
            }
            if (block && isTimeInBlockedRange(timeStr, block)) {
                const slot = getNearestAvailableSlot(dateStr, block);
                const msg = slot
                    ? `На выбранное время запланировано мероприятие. Пожалуйста, выберите другое время или дату.\n\nБлижайшее доступное: ${formatDateForDisplay(slot.date)} в ${slot.time}`
                    : 'На выбранное время запланировано мероприятие. Выберите время до ' + (block.start === '14:00' ? '14:00' : '18:00') + ' или с 22:30.';
                alert(msg);
                if (slot) {
                    bookingForm.querySelector('[name="time"]').value = slot.time;
                }
                return;
            }

            const btn = bookingForm.querySelector('button[type="submit"]');
            const origText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Отправка...';
            try {
                const data = {
                    name: bookingForm.querySelector('[name="name"]').value,
                    phone: bookingForm.querySelector('[name="phone"]').value,
                    date: dateStr,
                    time: timeStr,
                    guests: bookingForm.querySelector('[name="guests"]').value
                };
                await submitForm(api + '/api/booking', data);
                alert('Бронирование отправлено! Ждём вас в Readers Pub.');
                bookingForm.reset();
                updateTimeRestriction();
            } catch (err) {
                alert('Ошибка: ' + err.message + '\n\nЗапустите сервер: cd readers-pub && python3 server.py');
            } finally {
                btn.disabled = false;
                btn.textContent = origText;
            }
        });
    }
});
