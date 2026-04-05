const BOOKING_PHONE_HREF = 'tel:+73412693001';
const BOOKING_PHONE_LABEL = '+7 3412 693-001';

function getApiBase() {
    return window.location.origin;
}

function formatDateForDisplay(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const dayOfWeek = days[d.getDay()];
    return `${day}.${String(month).padStart(2, '0')} (${dayOfWeek})`;
}

function formatTodayForInput() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function submitForm(url, data) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    let json = null;
    try {
        json = await res.json();
    } catch (_) {
        throw new Error('Сервис временно недоступен. Попробуйте ещё раз чуть позже.');
    }
    if (!res.ok) throw new Error((json && json.message) || 'Ошибка отправки');
    if (json.ok === false && json.message) throw new Error(json.message);
    return json;
}

async function fetchAvailability(api, dateStr, timeStr = '') {
    if (!dateStr) return null;

    const params = new URLSearchParams({ date: dateStr });
    if (timeStr) params.set('time', timeStr);

    const res = await fetch(api + '/api/availability?' + params.toString());
    let json = null;
    try {
        json = await res.json();
    } catch (_) {
        throw new Error('Сервис проверки брони временно недоступен.');
    }
    if (!res.ok && !json.ok) {
        throw new Error(json.message || 'Не удалось получить доступность.');
    }
    return json;
}

function formatAvailabilityMessage(payload) {
    if (!payload) return '';
    if (payload.message) {
        if (payload.next_available) {
            return `${payload.message} Ближайшее доступное окно: ${formatDateForDisplay(payload.next_available.date)} в ${payload.next_available.time}.`;
        }
        return payload.message;
    }
    if (payload.summary) return payload.summary;
    return payload.opening_hours_hint || '';
}

function setupScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const selectorGroups = [
        '.hero-copy',
        '.kitchen-showcase-copy',
        '.bar-showcase-copy',
        '.hero-panel',
        '.trust-item',
        '.mobile-action-card',
        '.mobile-jump-nav a',
        '.story-copy',
        '.feature-card',
        '.signature-card',
        '.gallery-copy',
        '.gallery-photo',
        '.banquet-copy',
        '.banquet-form-shell',
        '.contacts-card',
        '.contacts-map',
        '.booking-info',
        '.booking-form',
        '.menu-category',
        '.surface-card'
    ];

    const seen = new Set();
    const revealNodes = [];

    selectorGroups.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => {
            if (seen.has(node)) return;
            seen.add(node);
            revealNodes.push(node);
        });
    });

    if (!revealNodes.length) return;

    document.documentElement.classList.add('has-motion');

    revealNodes.forEach((node) => {
        const parent = node.parentElement;
        const siblings = parent ? Array.from(parent.children).filter((child) => child.matches(node.tagName.toLowerCase() + (node.className ? '.' + String(node.className).trim().split(/\s+/).join('.') : ''))) : [];
        const siblingIndex = siblings.length > 1 ? siblings.indexOf(node) : 0;
        const delay = siblingIndex >= 0 ? Math.min(siblingIndex, 5) * 70 : 0;

        node.setAttribute('data-reveal', node.classList.contains('trust-item') || node.classList.contains('mobile-action-card') ? 'soft' : 'up');
        node.style.setProperty('--reveal-delay', `${delay}ms`);
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px'
    });

    revealNodes.forEach((node) => observer.observe(node));
}

function setupEveningRotator() {
    const rotator = document.querySelector('[data-evening-rotator]');
    if (!rotator) return;

    const slides = Array.from(rotator.querySelectorAll('[data-evening-slide]'));
    const dots = Array.from(rotator.querySelectorAll('[data-evening-dot]'));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (slides.length < 2) return;

    let activeIndex = 0;
    let rotateTimer = null;

    function activateSlide(nextIndex) {
        activeIndex = (nextIndex + slides.length) % slides.length;

        slides.forEach((slide, index) => {
            const isActive = index === activeIndex;
            const slideLink = slide.querySelector('.text-link');

            slide.classList.toggle('is-active', isActive);
            slide.setAttribute('aria-hidden', String(!isActive));

            if (slideLink) {
                slideLink.tabIndex = isActive ? 0 : -1;
            }
        });

        dots.forEach((dot, index) => {
            dot.classList.toggle('is-active', index === activeIndex);
        });
    }

    function stopRotation() {
        if (!rotateTimer) return;
        clearInterval(rotateTimer);
        rotateTimer = null;
    }

    function startRotation() {
        if (prefersReducedMotion || rotateTimer) return;
        rotateTimer = window.setInterval(() => {
            activateSlide(activeIndex + 1);
        }, 3000);
    }

    activateSlide(0);
    startRotation();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopRotation();
            return;
        }

        startRotation();
    });
}

function setFormStatus(el, type, message, showBookingCallAction = false) {
    if (!el) return;
    if (!message) {
        el.replaceChildren();
        el.className = 'form-status';
        return;
    }

    const textNode = document.createElement('span');
    textNode.textContent = message;
    el.replaceChildren(textNode);

    if (showBookingCallAction) {
        const phoneLink = document.createElement('a');
        phoneLink.href = BOOKING_PHONE_HREF;
        phoneLink.className = 'form-status-call';
        phoneLink.textContent = `Позвонить по брони: ${BOOKING_PHONE_LABEL}`;
        el.appendChild(phoneLink);
    }

    el.className = `form-status is-visible ${type === 'success' ? 'is-success' : 'is-error'}`;
}

function setButtonLoading(button, isLoading, idleText, loadingText) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : idleText;
}

document.addEventListener('DOMContentLoaded', () => {
    const api = getApiBase();

    setupScrollReveal();
    setupEveningRotator();

    const banquetForm = document.getElementById('banquetForm');
    const banquetStatus = document.getElementById('banquetFormStatus');

    if (banquetForm) {
        const banquetButton = banquetForm.querySelector('button[type="submit"]');
        const banquetIdleText = banquetButton ? banquetButton.textContent : 'Отправить';

        banquetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setFormStatus(banquetStatus, '', '');
            setButtonLoading(banquetButton, true, banquetIdleText, 'Отправляем...');

            try {
                const data = {
                    event_type: banquetForm.querySelector('[name="event_type"]').value,
                    phone: banquetForm.querySelector('[name="phone"]').value,
                    comments: banquetForm.querySelector('[name="comments"]').value
                };
                await submitForm(api + '/api/banquet', data);
                setFormStatus(
                    banquetStatus,
                    'success',
                    'Заявка отправлена. Мы свяжемся с вами в ближайшее время, чтобы обсудить детали мероприятия.'
                );
                banquetForm.reset();
            } catch (err) {
                setFormStatus(
                    banquetStatus,
                    'error',
                    'Не удалось отправить заявку: ' + err.message
                );
            } finally {
                setButtonLoading(banquetButton, false, banquetIdleText, 'Отправляем...');
            }
        });
    }

    const bookingForm = document.getElementById('bookingForm');
    const bookingStatus = document.getElementById('bookingFormStatus');

    if (bookingForm) {
        const dateInput = bookingForm.querySelector('input[name="date"]');
        const timeInput = bookingForm.querySelector('input[name="time"]');
        const bookingButton = bookingForm.querySelector('button[type="submit"]');
        const bookingIdleText = bookingButton ? bookingButton.textContent : 'Отправить бронь';
        let eventHintEl = null;
        let availabilityRequestId = 0;

        if (dateInput) {
            dateInput.min = formatTodayForInput();
        }

        function ensureHintElement() {
            if (!eventHintEl) {
                eventHintEl = document.createElement('p');
                eventHintEl.className = 'form-status is-visible is-info';
                timeInput.closest('.form-group').appendChild(eventHintEl);
            }
        }

        async function updateTimeRestriction() {
            const dateStr = dateInput.value;
            const timeStr = timeInput.value;
            const requestId = ++availabilityRequestId;

            setFormStatus(bookingStatus, '', '');

            if (!dateStr) {
                if (eventHintEl) eventHintEl.remove();
                eventHintEl = null;
                return;
            }

            try {
                const payload = await fetchAvailability(api, dateStr, timeStr);
                if (requestId !== availabilityRequestId) return;

                ensureHintElement();

                if (!timeStr) {
                    eventHintEl.className = payload.blocked_periods && payload.blocked_periods.length
                        ? 'form-status is-visible is-info'
                        : 'form-status is-visible is-success';
                    eventHintEl.replaceChildren(formatAvailabilityMessage(payload));
                    return;
                }

                setFormStatus(
                    eventHintEl,
                    payload.available ? 'success' : 'error',
                    formatAvailabilityMessage(payload),
                    !payload.available
                );
            } catch (err) {
                ensureHintElement();
                setFormStatus(
                    eventHintEl,
                    'error',
                    'Не удалось проверить доступность: ' + err.message
                );
            }
        }

        dateInput.addEventListener('change', updateTimeRestriction);
        dateInput.addEventListener('input', updateTimeRestriction);
        timeInput.addEventListener('change', updateTimeRestriction);
        timeInput.addEventListener('input', updateTimeRestriction);

        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setFormStatus(bookingStatus, '', '');

            const dateStr = bookingForm.querySelector('[name="date"]').value;
            const timeStr = bookingForm.querySelector('[name="time"]').value;

            setButtonLoading(bookingButton, true, bookingIdleText, 'Отправляем...');

            try {
                const availability = await fetchAvailability(api, dateStr, timeStr);
                if (!availability.available) {
                    const msg = formatAvailabilityMessage(availability);
                    setFormStatus(bookingStatus, 'error', msg, true);
                    if (availability.next_available) {
                        bookingForm.querySelector('[name="time"]').value = availability.next_available.time;
                        await updateTimeRestriction();
                    }
                    return;
                }

                const data = {
                    name: bookingForm.querySelector('[name="name"]').value,
                    phone: bookingForm.querySelector('[name="phone"]').value,
                    date: dateStr,
                    time: timeStr,
                    guests: bookingForm.querySelector('[name="guests"]').value
                };
                const response = await submitForm(api + '/api/booking', data);
                setFormStatus(
                    bookingStatus,
                    'success',
                    response.message || 'Бронь отправлена. Мы свяжемся с вами по указанному телефону.'
                );
                bookingForm.reset();
                if (eventHintEl) {
                    eventHintEl.remove();
                    eventHintEl = null;
                }
            } catch (err) {
                setFormStatus(
                    bookingStatus,
                    'error',
                    'Не удалось отправить бронь: ' + err.message
                );
            } finally {
                setButtonLoading(bookingButton, false, bookingIdleText, 'Отправляем...');
            }
        });
    }
});
