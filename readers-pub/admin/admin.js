/* ===== Бар Читателей — Админ-панель (каркас) =====
 * Vanilla JS SPA. Работает с сервером server.py:
 *   GET  /api/content          — контент сайта
 *   POST /api/admin/login      — вход по паролю
 *   POST /api/admin/content    — сохранить контент (заголовок X-Admin-Password)
 *   GET  /api/admin/bookings   — список броней (заголовок X-Admin-Password)
 *
 * ВНИМАНИЕ (безопасность): это КАРКАС. Авторизация — простой пароль для локальной
 * разработки. Перед боевым запуском вынесите админку за настоящую аутентификацию
 * (HTTPS + хеш пароля/сессии/OAuth) и не храните пароль в коде.
 */
(function () {
    "use strict";

    const TOKEN_KEY = "rp_admin_token";
    const $ = (s, r = document) => r.querySelector(s);

    /* Справочники сайта. Держать в синхроне со страницами проекта. */
    const PAGES = [
        { name: "Главная",            file: "index.html" },
        { name: "Меню",               file: "menu.html" },
        { name: "Бизнес-ланчи",       file: "biznes-lanchi.html" },
        { name: "Бронирование стола", file: "bronirovaniestola.html" },
        { name: "Стенд-ап",           file: "standup.html" },
        { name: "Политика конфиденциальности", file: "privacy.html" }
    ];

    /* Человеческие названия позиций — показываются в предпросмотре */
    const PHOTO_LABELS = {
        "hero":         "Главный баннер первого экрана",
        "promo":        "Баннер акций",
        "card-afisha":  "Карточка «Афиша»",
        "card-menu":    "Карточка «Меню»",
        "card-bankety": "Карточка «Банкеты»",
        "card-promo":   "Карточка «Акции»",
        "event-1":      "Афиша — событие 1",
        "event-2":      "Афиша — событие 2",
        "event-3":      "Афиша — событие 3",
        "event-4":      "Афиша — событие 4",
        "event-5":      "Афиша — событие 5",
        "menu":         "Фото в блоке «Меню»",
        "gallery-1":    "Атмосфера — большое фото",
        "gallery-2":    "Атмосфера — фото 2",
        "gallery-3":    "Атмосфера — фото 3",
        "banquet":      "Банкетный зал",
        "booking-bg":   "Фон страницы бронирования",
        "scan-food-1":  "Меню — супы, горячее, смокер",
        "scan-food-2":  "Меню — пицца и десерты",
        "scan-drinks-1":"Меню — безалкогольные, чай, кофе",
        "scan-drinks-2":"Меню — вино",
        "scan-drinks-3":"Меню — водка, коктейли, пиво",
        "scan-drinks-4":"Меню — крепкий алкоголь",
        "scan-season":  "Меню — осеннее",
        "scan-lunch":   "Страница бизнес-ланча"
    };

    /* Формат под каждую позицию: что именно просить у фотографа/маркетолога.
       ratio — пропорция, size — рекомендуемый размер в пикселях. */
    const PHOTO_HINTS = {
        "hero":         { ratio: "16:9 (горизонтальное)", size: "1920×1080",
                          note: "На телефоне кадр обрезается в вертикальный — держите главное по центру." },
        "promo":        { ratio: "4:3 (горизонтальное)",  size: "1920×1440",
                          note: "Для телефона нужен отдельный вертикальный макет 1080×1440 (3:4)." },
        "card-afisha":  { ratio: "3:4 (вертикальное)",    size: "900×1200" },
        "card-menu":    { ratio: "3:4 (вертикальное)",    size: "900×1200" },
        "card-bankety": { ratio: "3:4 (вертикальное)",    size: "900×1200" },
        "card-promo":   { ratio: "3:4 (вертикальное)",    size: "900×1200" },
        "event-1":      { ratio: "4:3 (горизонтальное)",  size: "800×600" },
        "event-2":      { ratio: "4:3 (горизонтальное)",  size: "800×600" },
        "event-3":      { ratio: "4:3 (горизонтальное)",  size: "800×600" },
        "event-4":      { ratio: "4:3 (горизонтальное)",  size: "800×600" },
        "event-5":      { ratio: "4:3 (горизонтальное)",  size: "800×600" },
        "menu":         { ratio: "3:4 на ПК, 4:3 на телефоне", size: "1200×1400",
                          note: "Кадр обрезается по центру — не ставьте важное у краёв." },
        "gallery-1":    { ratio: "4:3 (горизонтальное)",  size: "1400×1050", note: "Главное фото блока «Атмосфера»." },
        "gallery-2":    { ratio: "1:1 (квадрат)",         size: "800×800" },
        "gallery-3":    { ratio: "1:1 (квадрат)",         size: "800×800" },
        "banquet":      { ratio: "16:9 (горизонтальное)", size: "1600×900", note: "Фото банкетного зала." },
        "booking-bg":   { ratio: "16:9 (горизонтальное)", size: "1920×1080",
                          note: "Фон страницы бронирования — поверх ложится затемнение и текст." },
        "scan-food-1":  { ratio: "вертикальный скан",     size: "от 1400 px по ширине" },
        "scan-food-2":  { ratio: "вертикальный скан",     size: "от 1400 px по ширине" },
        "scan-drinks-1":{ ratio: "вертикальный скан",     size: "от 1400 px по ширине" },
        "scan-drinks-2":{ ratio: "вертикальный скан",     size: "от 1400 px по ширине" },
        "scan-drinks-3":{ ratio: "вертикальный скан",     size: "от 1400 px по ширине" },
        "scan-drinks-4":{ ratio: "вертикальный скан",     size: "от 1400 px по ширине" },
        "scan-season":  { ratio: "вертикальный скан",     size: "от 1400 px по ширине" },
        "scan-lunch":   { ratio: "вертикальный скан",     size: "от 1400 px по ширине",
                          note: "Страница бизнес-ланча целиком." }
    };

    /* Страницы, которые можно править в редакторе */
    const EDIT_PAGES = [
        { file: "index.html",             name: "Главная" },
        { file: "menu.html",              name: "Меню" },
        { file: "biznes-lanchi.html",     name: "Бизнес-ланчи" },
        { file: "bronirovaniestola.html", name: "Бронь" }
    ];

    const TEXT_LABELS = {
        /* Главная — первый экран (три слайда по очереди) */
        "home.hero.script":        "Слайд 1 — строка вязью",
        "home.hero.title":         "Слайд 1 — заголовок",
        "home.hero.subtitle":      "Слайд 1 — описание",
        "home.hero2.script":       "Слайд 2 — строка вязью",
        "home.hero2.title":        "Слайд 2 — заголовок",
        "home.hero2.subtitle":     "Слайд 2 — описание",
        "home.hero3.script":       "Слайд 3 — строка вязью",
        "home.hero3.title":        "Слайд 3 — заголовок",
        "home.hero3.subtitle":     "Слайд 3 — описание",

        /* Карточки разделов */
        "home.cards.afisha":       "Карточка — подпись «Афиша»",
        "home.cards.menu":         "Карточка — подпись «Меню»",
        "home.cards.bankety":      "Карточка — подпись «Банкеты»",
        "home.cards.promo":        "Карточка — подпись «Акции»",

        /* Афиша */
        "home.feed.eyebrow":       "Афиша — надзаголовок",
        "home.feed.title":         "Афиша — заголовок",
        "home.events.e1.date":     "Событие 1 — дата и время",
        "home.events.e1.title":    "Событие 1 — название",
        "home.events.e1.text":     "Событие 1 — описание",
        "home.events.e2.date":     "Событие 2 — дата и время",
        "home.events.e2.title":    "Событие 2 — название",
        "home.events.e2.text":     "Событие 2 — описание",
        "home.events.e3.date":     "Событие 3 — дата и время",
        "home.events.e3.title":    "Событие 3 — название",
        "home.events.e3.text":     "Событие 3 — описание",
        "home.events.e4.date":     "Событие 4 — дата и время",
        "home.events.e4.title":    "Событие 4 — название",
        "home.events.e4.text":     "Событие 4 — описание",
        "home.events.e5.date":     "Событие 5 — дата и время",
        "home.events.e5.title":    "Событие 5 — название",
        "home.events.e5.text":     "Событие 5 — описание",

        /* Бронирование */
        "home.booking.eyebrow":    "Бронирование — надзаголовок",
        "home.booking.title":      "Бронирование — заголовок",
        "home.booking.text":       "Бронирование — описание",
        "home.booking.form_title": "Бронирование — заголовок формы",
        "home.booking.form_note":  "Бронирование — подпись под формой",

        /* Меню */
        "home.menu.eyebrow":       "Блок «Меню» — надзаголовок",
        "home.menu.title":         "Блок «Меню» — заголовок",
        "home.menu.text":          "Блок «Меню» — описание (ПК)",
        "home.menu.text_mobile":   "Блок «Меню» — описание (телефон)",
        "home.menu.tag1":          "Блок «Меню» — плашка 1",
        "home.menu.tag2":          "Блок «Меню» — плашка 2",
        "home.menu.tag3":          "Блок «Меню» — плашка 3",
        "home.menu.tag4":          "Блок «Меню» — плашка 4",
        "home.menu.tag5":          "Блок «Меню» — плашка 5",
        "home.menu.tag6":          "Блок «Меню» — плашка 6",

        /* Атмосфера */
        "home.gallery.eyebrow":    "Атмосфера — надзаголовок",
        "home.gallery.title":      "Атмосфера — заголовок",
        "home.gallery.point1":     "Атмосфера — пункт 1",
        "home.gallery.point2":     "Атмосфера — пункт 2",
        "home.gallery.point3":     "Атмосфера — пункт 3",
        "home.gallery.caption1":   "Атмосфера — подпись к большому фото",
        "home.gallery.caption2":   "Атмосфера — подпись к фото 2",
        "home.gallery.caption3":   "Атмосфера — подпись к фото 3",

        /* Банкеты */
        "home.banquet.eyebrow":       "Банкеты — надзаголовок",
        "home.banquet.title":         "Банкеты — заголовок",
        "home.banquet.text_mobile":   "Банкеты — описание (телефон)",
        "home.banquet.pill1":         "Банкеты — формат 1",
        "home.banquet.pill2":         "Банкеты — формат 2",
        "home.banquet.pill3":         "Банкеты — формат 3",
        "home.banquet.pill4":         "Банкеты — формат 4",
        "home.banquet.pill5":         "Банкеты — формат 5",
        "home.banquet.pill6":         "Банкеты — формат 6",
        "home.banquet.contact_label": "Банкеты — строка над телефоном",
        "home.banquet.form_title":    "Банкеты — заголовок формы",

        /* Контакты */
        "home.contacts.eyebrow":   "Контакты — надзаголовок",
        "home.contacts.title":     "Контакты — заголовок",
        "home.contacts.map_title": "Контакты — подпись на карте",
        "home.contacts.map_text":  "Контакты — текст на карте",

        /* Общие значения — меняются один раз, обновляются везде */
        "settings.address":            "Адрес полностью (во всех местах сайта)",
        "settings.address_short":      "Адрес коротко (шапка, плашки)",
        "settings.hours_weekday":      "Часы Вс–Чт (во всех местах сайта)",
        "settings.hours_weekend":      "Часы Пт–Сб (во всех местах сайта)",
        "settings.hours_weekday_short":"Часы Вс–Чт коротко (плашки)",
        "settings.hours_weekend_short":"Часы Пт–Сб коротко (плашки)",

        /* Подвал — на всех страницах сразу */
        "footer.about":     "Подвал — описание под логотипом",
        "footer.legal":     "Подвал — реквизиты (ООО, ИНН, ОГРН, адрес)",
        "footer.copyright": "Подвал — строка копирайта",

        /* Страница меню */
        "menu.eyebrow":       "Меню — надзаголовок",
        "menu.title":         "Меню — заголовок страницы",
        "menu.lead":          "Меню — описание под заголовком",
        "menu.group_food":    "Меню — название группы «Кухня»",
        "menu.group_bar":     "Меню — название группы «Напитки и бар»",
        "menu.group_season":  "Меню — название группы «Осеннее меню»",

        /* Бизнес-ланчи */
        "lunch.eyebrow":      "Бизнес-ланчи — надзаголовок",
        "lunch.title":        "Бизнес-ланчи — заголовок",
        "lunch.lead":         "Бизнес-ланчи — описание",

        /* Страница брони */
        "booking.eyebrow":    "Бронь — надзаголовок",
        "booking.title":      "Бронь — заголовок",
        "booking.text":       "Бронь — описание",
        "booking.form_title": "Бронь — заголовок формы",
        "booking.form_hint":  "Бронь — подсказка над формой"
    };

    const MENU_SCANS = [
        { name: "Супы · Горячее · Смокер",        page: "Меню",          file: "menu-01-supy-goryachee-smoker.webp" },
        { name: "Римская пицца · Десерты",        page: "Меню",          file: "menu-02-pizza-deserty.webp" },
        { name: "Безалкогольные · Чай · Кофе",    page: "Меню",          file: "menu-03-bezalkogolnye-chay-kofe.webp" },
        { name: "Вино",                           page: "Меню",          file: "menu-04-vino.webp" },
        { name: "Водка · Коктейли · Пиво",        page: "Меню",          file: "menu-05-vodka-kokteyli-pivo.webp" },
        { name: "Крепкий алкоголь",               page: "Меню",          file: "menu-06-krepkiy-alkogol.webp" },
        { name: "Осеннее меню",                   page: "Меню",          file: "menu-07-osennee-menyu.webp" },
        { name: "Бизнес-ланч 12:00–16:00",        page: "Бизнес-ланчи",  file: "biznes-lanch.webp" }
    ];

    const loginView = $("#loginView");
    const appView = $("#appView");
    const viewEl = $("#view");
    const pageTitle = $("#pageTitle");
    const pageSubtitle = $("#pageSubtitle");

    let content = {};

    /* ---------- утилиты ---------- */
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    function getPath(obj, path) {
        return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    }
    function setPath(obj, path, val) {
        const keys = path.split(".");
        const last = keys.pop();
        let o = obj;
        keys.forEach((k) => { if (typeof o[k] !== "object" || o[k] == null) o[k] = {}; o = o[k]; });
        o[last] = val;
    }

    let toastTimer;
    function toast(msg, isError) {
        const t = $("#toast");
        t.textContent = msg;
        t.className = "toast" + (isError ? " toast-error" : "");
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
    }

    const token = () => sessionStorage.getItem(TOKEN_KEY) || "";

    async function api(path, opts) {
        opts = opts || {};
        const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
        if (token()) headers["X-Admin-Password"] = token();
        let res, data = {};
        try {
            res = await fetch(path, Object.assign({}, opts, { headers }));
            data = await res.json().catch(() => ({}));
        } catch (e) {
            return { ok: false, status: 0, data: { message: "Сервер недоступен" } };
        }
        if (res.status === 401 && path !== "/api/admin/login") {
            sessionStorage.removeItem(TOKEN_KEY);
            if (!appView.hidden) {
                showLogin();
                toast("Сессия истекла — войдите заново", true);
            }
        }
        return { ok: res.ok && data.ok !== false, status: res.status, data };
    }

    /* ---------- авторизация ---------- */
    async function doLogin(password) {
        const r = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
        if (r.ok && r.data.token) {
            sessionStorage.setItem(TOKEN_KEY, r.data.token);
            return true;
        }
        return false;
    }
    function logout() {
        sessionStorage.removeItem(TOKEN_KEY);
        location.hash = "";
        showLogin();
    }
    function showLogin() { appView.hidden = true; loginView.hidden = false; }
    async function showApp() {
        loginView.hidden = true;
        appView.hidden = false;
        await loadContent();
        await refreshPublish();
        if (!location.hash) location.hash = "#/dashboard";
        route();
    }
    async function loadContent() {
        const r = await api("/api/content");
        content = (r.data && r.data.content) ? r.data.content : {};
    }
    async function saveContent() {
        const r = await api("/api/admin/content", { method: "POST", body: JSON.stringify({ content }) });
        if (r.ok) {
            toast(r.data.published ? "Сохранено. На сайте появится через минуту" : "Сохранено ✓");
            refreshPublish();
        }
        else toast(r.data.message || "Ошибка сохранения", true);
    }

    /* ---------- рендер полей формы ---------- */
    function field(label, path, type) {
        const val = esc(getPath(content, path) || "");
        const input = type === "textarea"
            ? `<textarea data-bind="${path}">${val}</textarea>`
            : `<input type="text" data-bind="${path}" value="${val}">`;
        return `<div class="field"><label>${esc(label)}</label>${input}</div>`;
    }
    function bindFields(root) {
        root.querySelectorAll("[data-bind]").forEach((el) => {
            el.addEventListener("input", () => setPath(content, el.dataset.bind, el.value));
        });
    }
    const saveBar = `<div class="form-actions"><button class="btn btn-primary" data-save>Сохранить изменения</button></div>`;

    /* ---------- публикация правок на сайт ---------- */
    let publishState = null;

    async function refreshPublish() {
        const r = await api("/api/admin/publish-status");
        publishState = (r.ok && r.data.status) ? r.data.status : null;
        renderPublishBars();
    }

    function publishBarHTML() {
        const s = publishState;
        if (!s) return "";
        if (s.mode === "github") {
            return `<div class="publish-bar is-auto">
                <div><b>Правки уходят на сайт сразу</b>
                <span>Отдельно публиковать не нужно — сайт обновляется через минуту после сохранения.</span></div>
            </div>`;
        }
        if (s.mode === "none") {
            return `<div class="publish-bar is-off">
                <div><b>Публикация недоступна</b><span>${esc(s.message || "")}</span></div>
            </div>`;
        }
        const n = (s.pending || 0) + (s.ahead || 0);
        if (!n) {
            return `<div class="publish-bar is-clean">
                <div><b>Всё опубликовано</b><span>Новых правок нет.</span></div>
                <button class="btn btn-ghost" data-publish disabled>Опубликовать</button>
            </div>`;
        }
        const word = s.pending === 1 ? "правка" : (s.pending < 5 ? "правки" : "правок");
        return `<div class="publish-bar is-dirty">
            <div><b>Есть неопубликованные правки${s.pending ? `: ${s.pending} ${word}` : ""}</b>
            <span>Посетители сайта их пока не видят. Нажмите «Опубликовать».</span></div>
            <button class="btn btn-primary" data-publish>Опубликовать на сайт</button>
        </div>`;
    }

    function renderPublishBars() {
        document.querySelectorAll("[data-publish-bar]").forEach((host) => {
            host.innerHTML = publishBarHTML();
            const btn = host.querySelector("[data-publish]");
            if (btn && !btn.disabled) btn.addEventListener("click", () => doPublish(btn));
        });
    }

    async function doPublish(btn) {
        const idle = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Публикуем…";
        const r = await api("/api/admin/publish", { method: "POST" });
        btn.disabled = false;
        btn.textContent = idle;
        if (r.ok) toast(r.data.message || "Опубликовано");
        else toast(r.data.message || "Не удалось опубликовать", true);
        await refreshPublish();
    }

    /* ---------- загрузка и удаление фото ---------- */
    async function uploadPhoto(slot, file) {
        const dataUrl = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = () => reject(new Error("Не удалось прочитать файл"));
            fr.readAsDataURL(file);
        });
        const r = await api("/api/admin/upload", {
            method: "POST",
            body: JSON.stringify({ slot, type: file.type, data: String(dataUrl).split(",")[1] })
        });
        if (r.ok) {
            await loadContent();
            toast(r.data.published
                ? "Фото сохранено. На сайте появится через минуту"
                : "Фото загружено ✓");
            refreshPublish();
        }
        else toast(r.data.message || "Не удалось загрузить", true);
        return r.ok;
    }

    async function deletePhoto(slot) {
        const r = await api("/api/admin/photo-delete", { method: "POST", body: JSON.stringify({ slot }) });
        if (r.ok) { await loadContent(); toast("Фото убрано — вернулась заглушка"); refreshPublish(); }
        else toast(r.data.message || "Не удалось убрать", true);
        return r.ok;
    }

    /* ---------- разделы ---------- */
    const sections = {
        dashboard: {
            title: "Дашборд", sub: "Обзор состояния сайта",
            render: async () => {
                const b = await api("/api/admin/bookings");
                const count = (b.ok && b.data.bookings) ? b.data.bookings.length : "—";
                const media = (content.media || []).length;
                const upd = (content._meta && content._meta.updated_at) ? content._meta.updated_at.slice(0, 10) : "—";
                const formId = getPath(content, "settings.yandex_form_id");
                return `
                <div class="grid grid-stats">
                    <div class="card stat-card"><span class="stat-ico">📅</span><div class="stat-value">${count}</div><div class="stat-label">Заявок на бронь</div></div>
                    <div class="card stat-card"><span class="stat-ico">📄</span><div class="stat-value">${PAGES.length}</div><div class="stat-label">Страниц сайта</div></div>
                    <div class="card stat-card"><span class="stat-ico">🖼</span><div class="stat-value">${media}</div><div class="stat-label">Папок с медиа</div></div>
                    <div class="card stat-card"><span class="stat-ico">🕑</span><div class="stat-value" style="font-size:1.2rem">${esc(upd)}</div><div class="stat-label">Последнее обновление</div></div>
                </div>
                ${formId ? "" : `<div class="notice">Брони пока принимаются в Telegram: ID Яндекс Формы не задан. Заполните его в разделе «Настройки», чтобы заявки падали строкой в Яндекс Таблицу.</div>`}
                <div class="card">
                    <div class="section-head">
                        <div><div class="card-title">Страницы сайта</div><p class="card-hint" style="margin:0">Открываются в новой вкладке</p></div>
                    </div>
                    <div class="page-list">
                        ${PAGES.map((p) => `<a class="page-item" href="/${p.file}" target="_blank">
                            <span class="page-name">${esc(p.name)}</span>
                            <small>${esc(p.file)}</small>
                        </a>`).join("")}
                    </div>
                </div>
                <div class="card">
                    <div class="card-title">Быстрые действия</div>
                    <p class="card-hint">Начните с текстов главной или проверки новых броней.</p>
                    <div class="form-actions">
                        <a class="btn btn-primary" href="#/content">Редактировать тексты</a>
                        <a class="btn btn-ghost" href="#/bookings">Смотреть брони</a>
                        <a class="btn btn-ghost" href="/index.html" target="_blank">Открыть сайт</a>
                    </div>
                </div>`;
            }
        },
        help: {
            title: "Инструкция", sub: "Как менять сайт — по шагам",
            render: async () => `
                <div class="card">
                    <div class="card-title">Коротко</div>
                    <p class="card-hint">Менять на сайте можно <b>тексты и фотографии</b>. Расположение блоков,
                    цвета и шрифты через админку не меняются — это к разработчику.</p>
                    <ol class="howto">
                        <li>Откройте <a href="#/editor"><b>«Редактор страницы»</b></a>.</li>
                        <li>Поменяйте что нужно.</li>
                        <li>Нажмите <b>«Опубликовать на сайт»</b> наверху.</li>
                    </ol>
                </div>

                <div class="card">
                    <div class="card-title">Как поменять текст</div>
                    <ol class="howto">
                        <li>В «Редакторе страницы» сверху выберите нужную страницу.</li>
                        <li>Наведите курсор на страницу — всё, что можно менять, обводится пунктиром.</li>
                        <li>Нажмите на текст. Справа появится поле.</li>
                        <li>Правьте — текст сразу меняется в предпросмотре.</li>
                        <li>Нажмите <b>«Сохранить»</b>.</li>
                    </ol>
                    <p class="card-hint">Передумали — нажмите «Отмена», страница вернётся как была.</p>
                </div>

                <div class="card">
                    <div class="card-title">Как поменять фотографию</div>
                    <ol class="howto">
                        <li>Нажмите на фото (или на серый прямоугольник, если фото ещё нет).</li>
                        <li>Справа написано, какой нужен формат и размер — это же просите у фотографа.</li>
                        <li>Выберите файл. Админка проверит его и скажет, подходит ли.</li>
                        <li>Нажмите <b>«Загрузить»</b>. Серый прямоугольник сменится фотографией.</li>
                    </ol>
                    <p class="card-hint">Чтобы убрать фото и вернуть заглушку — кнопка «Убрать фото».
                    Подходят JPG, PNG, WebP и GIF.</p>
                </div>

                <div class="card">
                    <div class="card-title">Как опубликовать</div>
                    <p class="card-hint">Пока вы не нажали «Опубликовать», правки видите только вы.
                    Плашка наверху показывает, есть ли неопубликованное.</p>
                    <ul class="howto">
                        <li><b>Есть неопубликованные правки</b> — нажмите «Опубликовать на сайт».</li>
                        <li><b>Всё опубликовано</b> — ничего делать не нужно.</li>
                        <li><b>Правки уходят на сайт сразу</b> — публикация автоматическая, кнопка не нужна.</li>
                    </ul>
                    <p class="card-hint">После публикации сайт обновляется примерно за минуту.
                    Если не видите изменений — обновите страницу сайта.</p>
                </div>

                <div class="card">
                    <div class="card-title">Проверяйте на телефоне</div>
                    <p class="card-hint">Больше половины гостей заходят с телефона, а там вёрстка другая:
                    часть текстов короче, часть блоков скрыта. В «Редакторе страницы» есть переключатель
                    <b>ПК / Телефон</b> — посмотрите оба вида перед публикацией.</p>
                </div>

                <div class="card">
                    <div class="card-title">Если что-то пошло не так</div>
                    <ul class="howto">
                        <li><b>Просит войти заново</b> — обычное дело, вход живёт 12 часов.</li>
                        <li><b>«Файл больше 8 МБ»</b> — сожмите фото или возьмите меньшего размера.</li>
                        <li><b>«Пропорции не те»</b> — можно загружать, но края обрежутся. Лучше взять правильный формат.</li>
                        <li><b>Не удалось опубликовать</b> — напишите разработчику, покажите текст ошибки.</li>
                    </ul>
                    <p class="card-hint">Сломать сайт через админку нельзя: меняются только тексты и картинки,
                    а каждая публикация сохраняется в историю и её можно откатить.</p>
                </div>`
        },
        editor: {
            title: "Редактор страницы", sub: "Нажмите на текст или фото прямо на странице",
            render: async () => `
                <div class="editor-wrap">
                    <div class="editor-stage">
                        <div class="editor-toolbar">
                            <div class="editor-pages">
                                ${EDIT_PAGES.map((p, i) => `<button class="btn btn-ghost${i === 0 ? " is-active" : ""}" data-page="${p.file}">${esc(p.name)}</button>`).join("")}
                            </div>
                            <div class="editor-devices">
                                <button class="btn btn-ghost is-active" data-device="desktop">🖥 ПК</button>
                                <button class="btn btn-ghost" data-device="mobile">📱 Телефон</button>
                            </div>
                            <div class="editor-tools">
                                <button class="btn btn-ghost" data-reload>⟳ Обновить</button>
                                <a class="btn btn-ghost" id="openSite" href="/index.html" target="_blank">↗ Открыть</a>
                            </div>
                        </div>
                        <div class="editor-frame-box" data-device-box="desktop">
                            <div class="editor-viewport" id="siteViewport">
                                <iframe id="siteFrame" src="/index.html" title="Предпросмотр сайта"></iframe>
                            </div>
                        </div>
                    </div>
                    <aside class="editor-panel" id="editorPanel">
                        <div class="editor-empty">
                            <div class="editor-empty-ico">👆</div>
                            <h3>Выберите, что поменять</h3>
                            <p>Наведите курсор на страницу слева — редактируемые места подсветятся.
                               Нажмите на <b>текст</b>, чтобы переписать его, или на <b>фото</b>, чтобы загрузить своё.</p>
                            <p class="editor-empty-note">Структуру страницы изменить нельзя — только тексты и фотографии.</p>
                        </div>
                    </aside>
                </div>`,
            after: initEditor
        },
        content: {
            title: "Тексты списком", sub: "Все тексты сайта в одном месте",
            render: async () => {
                // группы собираются из подписей: всё, что до первого тире
                const GROUPS = [
                    ["Первый экран",        /^home\.hero/],
                    ["Карточки разделов",   /^home\.cards\./],
                    ["Афиша и события",     /^home\.(feed|events)\./],
                    ["Бронирование",        /^home\.booking\./],
                    ["Блок «Меню»",         /^home\.menu\./],
                    ["Атмосфера",           /^home\.gallery\./],
                    ["Банкеты",             /^home\.banquet\./],
                    ["Контакты",            /^home\.contacts\./],
                    ["Общее: адрес и часы", /^settings\.(address|hours)/],
                    ["Подвал",              /^footer\./],
                    ["Страница «Меню»",     /^menu\./],
                    ["Страница «Бизнес-ланчи»", /^lunch\./],
                    ["Страница «Бронь»",    /^booking\./]
                ];
                const all = Object.keys(TEXT_LABELS);
                const cards = GROUPS.map(([name, re_]) => {
                    const paths = all.filter((p) => re_.test(p));
                    if (!paths.length) return "";
                    return `<div class="card">
                        <div class="card-title">${esc(name)}</div>
                        ${paths.map((p) => {
                            const val = String(getPath(content, p) || "");
                            return field(TEXT_LABELS[p], p, val.length > 60 ? "textarea" : "");
                        }).join("")}
                    </div>`;
                }).join("");
                return `
                <div class="notice">Здесь те же тексты, что и в <a href="#/editor"><b>«Редакторе страницы»</b></a>, только списком.
                Редактором удобнее — там видно, где текст стоит. Этот раздел пригодится, когда нужно быстро пройтись по всему.</div>
                ${cards}
                ${saveBar}`;
            }
        },
        settings: {
            title: "Настройки", sub: "Контакты, часы работы, соцсети",
            render: async () => `
                <div class="card">
                    <div class="card-title">Контакты и режим работы</div>
                    <p class="card-hint">Используются в шапке, подвале и на странице броней.</p>
                    <div class="field-row">
                        ${field("Название", "settings.brand_name")}
                        ${field("Телефон (текст)", "settings.phone_label")}
                    </div>
                    <div class="field-row">
                        ${field("Телефон (ссылка tel:)", "settings.phone_href")}
                        ${field("Адрес", "settings.address")}
                    </div>
                    <div class="field-row">
                        ${field("Часы Вс–Чт", "settings.hours_weekday")}
                        ${field("Часы Пт–Сб", "settings.hours_weekend")}
                    </div>
                    <div class="field-row">
                        ${field("Часы бизнес-ланча", "settings.lunch_hours")}
                        ${field("Ссылка ВКонтакте", "settings.vk_url")}
                    </div>
                </div>
                <div class="card">
                    <div class="card-title">Приём броней</div>
                    <p class="card-hint">
                        Пока поле пустое, заявки со страницы бронирования уходят в Telegram.
                        Впишите ID Яндекс Формы — и они начнут падать строкой в Яндекс Таблицу.
                        ID — это часть ссылки на форму между <code>/u/</code> и следующей косой чертой.
                    </p>
                    ${field("ID Яндекс Формы", "settings.yandex_form_id")}
                </div>
                ${saveBar}`
        },
        media: {
            title: "Изображения", sub: "Баннеры, логотипы, форматы для маркетолога",
            render: async () => {
                const items = (content.media || []).map((m) => {
                    const isFolder = String(m.file).endsWith("/");
                    const thumb = isFolder
                        ? `<div class="media-folder">📁</div>`
                        : `<img src="/${esc(m.file)}" alt="${esc(m.alt)}" loading="lazy" onerror="this.style.opacity=0.25">`;
                    return `<div class="media-item">${thumb}
                        <div class="media-cap">${esc(m.title)}
                        <small class="media-spec">${esc(m.alt)}</small></div>
                    </div>`;
                }).join("");
                const photos = content.photos || {};
                const GROUPS = [
                    { page: "Главная", slots: ["hero", "promo", "card-afisha", "card-menu", "card-bankety", "card-promo",
                                               "event-1", "event-2", "event-3", "event-4", "event-5",
                                               "menu", "gallery-1", "gallery-2", "gallery-3", "banquet"] },
                    { page: "Меню", slots: ["scan-food-1", "scan-food-2", "scan-drinks-1", "scan-drinks-2",
                                            "scan-drinks-3", "scan-drinks-4", "scan-season"] },
                    { page: "Бизнес-ланчи", slots: ["scan-lunch"] },
                    { page: "Бронь", slots: ["booking-bg"] }
                ];
                const tables = GROUPS.map((g) => `
                    <div class="card">
                        <div class="card-title">${esc(g.page)}</div>
                        <table class="table">
                            <thead><tr><th>Позиция</th><th>Формат</th><th>Размер</th><th>Сейчас</th></tr></thead>
                            <tbody>
                                ${g.slots.map((s) => {
                                    const h = PHOTO_HINTS[s] || {};
                                    const loaded = !!photos[s];
                                    return `<tr>
                                        <td>${esc(PHOTO_LABELS[s] || s)}</td>
                                        <td>${esc(h.ratio || "—")}</td>
                                        <td>${esc(h.size || "—")}</td>
                                        <td>${loaded
                                            ? '<span class="badge badge-ok">своё фото</span>'
                                            : (s.indexOf("scan-") === 0
                                                ? '<span class="badge badge-pending">из вёрстки</span>'
                                                : '<span class="badge badge-pending">заглушка</span>')}</td>
                                    </tr>`;
                                }).join("")}
                            </tbody>
                        </table>
                    </div>`).join("");

                return `
                <div class="notice">Загружать фото нужно в разделе <a href="#/editor"><b>«Редактор страницы»</b></a> — там сразу видно, куда встанет снимок. Этот раздел — справочник: что заказывать фотографу или маркетологу.</div>
                ${tables}
                <div class="card">
                    <div class="card-title">Общие правила</div>
                    <ul class="howto">
                        <li>Файлы: JPG, PNG, WebP или GIF, до 12 МБ.</li>
                        <li>Если пропорции не совпали — фото <b>обрежется по центру</b>, края уйдут. Админка предупредит об этом при выборе файла.</li>
                        <li>Главный баннер и баннер акций на телефоне показываются вертикально: держите сюжет по центру кадра.</li>
                        <li>Сканы меню — от 1400 px по ширине, иначе текст будет мылить.</li>
                    </ul>
                </div>
                <div class="card">
                    <div class="card-title">Логотип и фирменный узор</div>
                    <p class="card-hint">Через админку не меняются — это к разработчику.</p>
                    <div class="media-grid">${items || "<p class='card-hint'>Пока нет изображений.</p>"}</div>
                </div>`;
            }
        },
        bookings: {
            title: "Брони", sub: "Заявки с сайта",
            render: async () => {
                const r = await api("/api/admin/bookings");
                if (!r.ok) return `<div class="card"><p class="card-hint">Не удалось загрузить брони: ${esc(r.data.message || "ошибка")}</p></div>`;
                const rows = (r.data.bookings || []).slice().reverse();
                if (!rows.length) return `<div class="card"><div class="stub"><div class="stub-ico">📭</div><h3>Пока нет заявок</h3><p>Новые брони будут появляться здесь.</p></div></div>`;
                const body = rows.map((b) => `
                    <tr>
                        <td>${esc(b.name || "—")}</td>
                        <td>${esc(b.phone || "—")}</td>
                        <td>${esc(b.date || "—")} ${esc(b.time || "")}</td>
                        <td>${esc(b.guests || "—")}</td>
                        <td><span class="badge badge-pending">${esc(b.status || b.type || "заявка")}</span></td>
                    </tr>`).join("");
                return `
                <div class="notice">Заявки на бронь приходят в Telegram — там их и смотрите. Этот список показывает заявки, сохранённые на сервере; на рабочем сайте он может быть пустым, это нормально.</div>
                <div class="card">
                    <table class="table">
                        <thead><tr><th>Имя</th><th>Телефон</th><th>Дата/время</th><th>Гостей</th><th>Статус</th></tr></thead>
                        <tbody>${body}</tbody>
                    </table>
                </div>`;
            }
        },
        menu: {
            title: "Меню и ланчи", sub: "Страницы меню — это картинки",
            render: async () => `
                <div class="notice">Меню на сайте — <b>сфотографированные или свёрстанные страницы</b>, а не список блюд.
                Чтобы обновить меню, не нужно вписывать блюда и цены: достаточно заменить картинку.</div>
                <div class="card">
                    <div class="card-title">Как заменить страницу меню</div>
                    <ol class="howto">
                        <li>Откройте раздел <a href="#/editor"><b>«Редактор страницы»</b></a>.</li>
                        <li>Сверху выберите страницу — <b>Меню</b> или <b>Бизнес-ланчи</b>.</li>
                        <li>Нажмите на ту страницу меню, которую нужно поменять.</li>
                        <li>Справа выберите новый файл и нажмите «Загрузить».</li>
                        <li>Когда всё готово — нажмите <b>«Опубликовать на сайт»</b> наверху.</li>
                    </ol>
                    <p class="card-hint">Картинка должна быть шириной не меньше 1400 точек, иначе текст меню будет
                    расплываться. Админка предупредит, если файл мелкий.</p>
                </div>
                <div class="card">
                    <div class="section-head">
                        <div><div class="card-title">Что сейчас на сайте</div>
                        <p class="card-hint" style="margin:0">Порядок страниц такой же, как на сайте</p></div>
                        <a class="btn btn-ghost" href="/menu.html" target="_blank">↗ Открыть меню</a>
                    </div>
                    <table class="table">
                        <thead><tr><th>Страница меню</th><th>Где показывается</th></tr></thead>
                        <tbody>
                            ${MENU_SCANS.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.page)}</td></tr>`).join("")}
                        </tbody>
                    </table>
                    <p class="card-hint">Добавить <b>новую</b> страницу меню (а не заменить существующую)
                    через админку нельзя — это к разработчику.</p>
                </div>`
        },
        events: {
            title: "События", sub: "Афиша на главной",
            render: async () => stub("★", "Афиша пока не редактируется", "Карточки ближайших событий (даты, названия, описания) меняет разработчик. Фотографии событий — можно самим, в «Редакторе страницы».")
        },
        users: {
            title: "Пользователи", sub: "Доступы к админке",
            render: async () => stub("👤", "Вход один на всех", "Сейчас в админку входят по одному общему паролю. Отдельные учётные записи для сотрудников — это к разработчику.")
        }
    };

    /* ---------- редактор страницы (предпросмотр + правка по клику) ---------- */
    function initEditor() {
        const frame = $("#siteFrame");
        const panel = $("#editorPanel");
        const box = viewEl.querySelector("[data-device-box]");
        if (!frame) return;

        const viewport = $("#siteViewport");
        // Ширина, в которой рендерится сайт, и высота «экрана» для каждого режима
        const DEVICES = { desktop: { w: 1280, h: 860 }, mobile: { w: 390, h: 780 } };
        let device = "desktop";

        /* Рендерим в настоящей ширине устройства и ужимаем масштабом,
           чтобы «ПК» показывал именно десктопную вёрстку. */
        function fitPreview() {
            const d = DEVICES[device];
            const avail = box.clientWidth - 28;               // минус padding
            const scale = Math.min(1, avail / d.w);
            frame.style.width = d.w + "px";
            frame.style.height = d.h + "px";
            frame.style.transform = "scale(" + scale + ")";
            viewport.style.width = Math.round(d.w * scale) + "px";
            viewport.style.height = Math.round(d.h * scale) + "px";
        }

        viewEl.querySelectorAll("[data-device]").forEach((b) => {
            b.addEventListener("click", () => {
                viewEl.querySelectorAll("[data-device]").forEach((x) => x.classList.remove("is-active"));
                b.classList.add("is-active");
                device = b.dataset.device;
                box.setAttribute("data-device-box", device);
                fitPreview();
            });
        });
        viewEl.querySelector("[data-reload]").addEventListener("click", () => reloadFrame());
        window.addEventListener("resize", fitPreview);
        fitPreview();

        /* переключение страниц сайта внутри предпросмотра */
        let currentPage = EDIT_PAGES[0].file;
        viewEl.querySelectorAll("[data-page]").forEach((b) => {
            b.addEventListener("click", () => {
                viewEl.querySelectorAll("[data-page]").forEach((x) => x.classList.remove("is-active"));
                b.classList.add("is-active");
                currentPage = b.dataset.page;
                $("#openSite").href = "/" + currentPage;
                frame.src = "/" + currentPage;
                openEmpty();
            });
        });

        function reloadFrame() {
            frame.contentWindow.location.replace("/" + currentPage);
        }

        /* Разметка подсветки внутри предпросмотра */
        function decorate() {
            let doc;
            try { doc = frame.contentDocument; } catch (e) { return; }
            if (!doc || !doc.body) return;

            if (!doc.getElementById("rpEditStyle")) {
                const st = doc.createElement("style");
                st.id = "rpEditStyle";
                st.textContent = `
                    [data-content], [data-photo] { cursor: pointer; }
                    [data-content]:hover, [data-photo]:hover {
                        outline: 2px dashed #95D4F2 !important;
                        outline-offset: 3px;
                    }
                    .rp-selected { outline: 3px solid #95D4F2 !important; outline-offset: 3px; }
                    [data-photo]:hover::before {
                        content: "Нажмите, чтобы заменить фото";
                        position: absolute; z-index: 40; left: 50%; top: 50%;
                        transform: translate(-50%, -50%);
                        padding: 7px 13px; border-radius: 999px;
                        background: rgba(35,40,69,.92); color: #FDFCF2;
                        font: 600 12px/1.2 Inter, system-ui, sans-serif;
                        white-space: nowrap; pointer-events: none;
                    }
                    [data-photo] { position: relative; }
                `;
                doc.head.appendChild(st);
            }

            doc.querySelectorAll("[data-content], [data-photo]").forEach((el) => {
                if (el.dataset.rpBound) return;
                el.dataset.rpBound = "1";
                el.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    doc.querySelectorAll(".rp-selected").forEach((x) => x.classList.remove("rp-selected"));
                    el.classList.add("rp-selected");
                    if (el.hasAttribute("data-photo")) openPhotoEditor(el.getAttribute("data-photo"));
                    else openTextEditor(el.getAttribute("data-content"), el);
                }, true);
            });

            // ссылки внутри предпросмотра никуда не уводят
            doc.querySelectorAll("a[href]").forEach((a) => {
                if (a.dataset.rpLink) return;
                a.dataset.rpLink = "1";
                a.addEventListener("click", (e) => {
                    if (!a.closest("[data-content]") && !a.closest("[data-photo]")) e.preventDefault();
                }, true);
            });
        }

        frame.addEventListener("load", () => setTimeout(decorate, 450));
        setTimeout(decorate, 900);

        /* --- панель: текст --- */
        function openTextEditor(path, el) {
            const label = TEXT_LABELS[path] || path;
            const val = esc(getPath(content, path) || (el ? el.textContent.trim() : ""));
            const long = String(val).length > 60;
            panel.innerHTML = `
                <div class="editor-head">
                    <span class="editor-kind">Текст</span>
                    <h3>${esc(label)}</h3>
                </div>
                <div class="field">
                    <label for="edText">Содержимое</label>
                    ${long ? `<textarea id="edText" rows="6">${val}</textarea>`
                           : `<input id="edText" type="text" value="${val}">`}
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" id="edSave">Сохранить</button>
                    <button class="btn btn-ghost" id="edCancel">Отмена</button>
                </div>
                <p class="card-hint">Меняется только этот текст. Расположение блока остаётся прежним.</p>`;

            const input = $("#edText", panel);
            input.focus();
            // живой предпросмотр прямо в странице
            input.addEventListener("input", () => { if (el) el.textContent = input.value; });

            $("#edSave", panel).addEventListener("click", async () => {
                setPath(content, path, input.value);
                await saveContent();
                openEmpty();
            });
            $("#edCancel", panel).addEventListener("click", () => { reloadFrame(); openEmpty(); });
        }

        /* --- панель: фото --- */
        function openPhotoEditor(slot) {
            const label = PHOTO_LABELS[slot] || slot;
            const hint = PHOTO_HINTS[slot];
            const current = (content.photos || {})[slot];
            const isScan = slot.indexOf("scan-") === 0;
            panel.innerHTML = `
                <div class="editor-head">
                    <span class="editor-kind">Фото</span>
                    <h3>${esc(label)}</h3>
                </div>
                ${current
                    ? `<div class="editor-photo"><img src="/${esc(current)}" alt=""></div>`
                    : `<div class="editor-photo editor-photo--empty">${isScan
                        ? "Сейчас показывается страница из вёрстки"
                        : "Сейчас здесь серая заглушка"}</div>`}
                ${hint ? `<div class="slot-spec">
                    <div class="slot-spec-row"><span>Формат</span><b>${esc(hint.ratio)}</b></div>
                    <div class="slot-spec-row"><span>Размер</span><b>${esc(hint.size)}</b></div>
                    ${hint.note ? `<p class="slot-spec-note">${esc(hint.note)}</p>` : ""}
                </div>` : ""}
                <div class="field">
                    <label for="edFile">Выбрать фото</label>
                    <input id="edFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
                </div>
                <p class="slot-check" id="edCheck" hidden></p>
                <div class="form-actions">
                    <button class="btn btn-primary" id="edUpload" disabled>Загрузить</button>
                    ${current ? `<button class="btn btn-ghost" id="edRemove">Убрать фото</button>` : ""}
                </div>
                <p class="card-hint">JPG, PNG, WebP или GIF, до 12 МБ.
                   ${isScan ? "Новая страница заменит текущую." : "Как только фото загружено, серая заглушка пропадает сама."}</p>`;

            const file = $("#edFile", panel);
            const btn = $("#edUpload", panel);
            const check = $("#edCheck", panel);

            // целевые пропорции — чтобы сразу сказать, подойдёт ли выбранный файл
            const WANT = {
                "16:9 (горизонтальное)": 16 / 9,
                "4:3 (горизонтальное)": 4 / 3,
                "3:4 (вертикальное)": 3 / 4,
                "1:1 (квадрат)": 1
            };

            file.addEventListener("change", () => {
                btn.disabled = !file.files.length;
                check.hidden = true;
                if (!file.files.length) return;

                const f = file.files[0];
                const img = new Image();
                img.onload = () => {
                    const ratio = img.width / img.height;
                    const want = hint ? WANT[hint.ratio] : null;
                    const mb = (f.size / 1048576).toFixed(1);
                    let msg = `Выбрано: ${img.width}×${img.height}, ${mb} МБ. `;
                    let bad = false;
                    if (want && Math.abs(ratio - want) / want > 0.12) {
                        msg += `Пропорции не те — нужно ${hint.ratio}. Фото обрежется по центру.`;
                        bad = true;
                    } else if (!want && img.width < 1400) {
                        msg += "Для скана меню маловато — нужна ширина от 1400 px, текст будет мылить.";
                        bad = true;
                    } else if (img.width < 800) {
                        msg += "Маловато по размеру — на больших экранах будет мылить.";
                        bad = true;
                    } else {
                        msg += "Подходит ✓";
                    }
                    check.textContent = msg;
                    check.className = "slot-check" + (bad ? " is-warn" : " is-ok");
                    check.hidden = false;
                    URL.revokeObjectURL(img.src);
                };
                img.onerror = () => {
                    check.textContent = "Не удалось прочитать файл — это точно картинка?";
                    check.className = "slot-check is-warn";
                    check.hidden = false;
                };
                img.src = URL.createObjectURL(f);
            });

            btn.addEventListener("click", async () => {
                if (!file.files.length) return;
                btn.disabled = true; btn.textContent = "Загружаем…";
                const ok = await uploadPhoto(slot, file.files[0]);
                btn.disabled = false; btn.textContent = "Загрузить";
                if (ok) { reloadFrame(); openPhotoEditor(slot); }
            });

            const rm = $("#edRemove", panel);
            if (rm) rm.addEventListener("click", async () => {
                if (await deletePhoto(slot)) { reloadFrame(); openPhotoEditor(slot); }
            });
        }

        function openEmpty() {
            panel.innerHTML = `
                <div class="editor-empty">
                    <div class="editor-empty-ico">✓</div>
                    <h3>Готово</h3>
                    <p>Нажмите на другой текст или фото, чтобы продолжить.</p>
                </div>`;
        }
    }

    function stub(ico, title, text) {
        return `<div class="card"><div class="stub">
            <div class="stub-ico">${ico}</div>
            <h3>${esc(title)}</h3>
            <p>${esc(text)}</p>
            <span class="stub-tag">В разработке</span>
        </div></div>`;
    }

    /* ---------- роутинг ---------- */
    async function route() {
        const name = (location.hash.replace(/^#\/?/, "") || "dashboard");
        const sec = sections[name] || sections.dashboard;
        document.querySelectorAll("#sidebarNav a").forEach((a) =>
            a.classList.toggle("active", a.dataset.nav === name));
        pageTitle.textContent = sec.title;
        pageSubtitle.textContent = sec.sub;
        viewEl.innerHTML = `<p class="card-hint">Загрузка…</p>`;
        viewEl.innerHTML = await sec.render();
        bindFields(viewEl);
        const saveBtn = viewEl.querySelector("[data-save]");
        if (saveBtn) saveBtn.addEventListener("click", saveContent);
        renderPublishBars();
        if (sec.after) sec.after();
    }

    /* ---------- инициализация ---------- */
    $("#loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const pass = $("#loginPassword").value;
        const err = $("#loginError");
        const btn = $("#loginBtn");
        err.hidden = true;
        btn.disabled = true; btn.textContent = "Вход…";
        const ok = await doLogin(pass);
        btn.disabled = false; btn.textContent = "Войти";
        if (ok) { showApp(); }
        else { err.textContent = "Неверный пароль или сервер недоступен."; err.hidden = false; }
    });
    $("#logoutBtn").addEventListener("click", logout);
    window.addEventListener("hashchange", () => { if (!appView.hidden) route(); });

    // автологин, если токен уже есть
    (async function init() {
        if (token()) {
            // проверяем именно закрытый эндпоинт: /api/content открыт всем,
            // по нему протухший токен выглядел бы живым
            const r = await api("/api/admin/publish-status");
            if (r.status !== 401) { showApp(); return; }
        }
        showLogin();
    })();
})();
