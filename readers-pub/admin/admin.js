/* ===== Readers Pub — Админ-панель (каркас) =====
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
        if (!location.hash) location.hash = "#/dashboard";
        route();
    }
    async function loadContent() {
        const r = await api("/api/content");
        content = (r.data && r.data.content) ? r.data.content : {};
    }
    async function saveContent() {
        const r = await api("/api/admin/content", { method: "POST", body: JSON.stringify({ content }) });
        if (r.ok) toast("Сохранено ✓");
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

    /* ---------- разделы ---------- */
    const sections = {
        dashboard: {
            title: "Дашборд", sub: "Обзор состояния сайта",
            render: async () => {
                const b = await api("/api/admin/bookings");
                const count = (b.ok && b.data.bookings) ? b.data.bookings.length : "—";
                const media = (content.media || []).length;
                const upd = (content._meta && content._meta.updated_at) ? content._meta.updated_at.slice(0, 10) : "—";
                return `
                <div class="grid grid-stats">
                    <div class="card stat-card"><span class="stat-ico">📅</span><div class="stat-value">${count}</div><div class="stat-label">Заявок на бронь</div></div>
                    <div class="card stat-card"><span class="stat-ico">📄</span><div class="stat-value">5</div><div class="stat-label">Страниц сайта</div></div>
                    <div class="card stat-card"><span class="stat-ico">🖼</span><div class="stat-value">${media}</div><div class="stat-label">Изображений</div></div>
                    <div class="card stat-card"><span class="stat-ico">🕑</span><div class="stat-value" style="font-size:1.2rem">${esc(upd)}</div><div class="stat-label">Последнее обновление</div></div>
                </div>
                <div class="card">
                    <div class="card-title">Быстрые действия</div>
                    <p class="card-hint">Начните с редактирования главной страницы или проверки новых броней.</p>
                    <div class="form-actions">
                        <a class="btn btn-primary" href="#/content">Редактировать контент</a>
                        <a class="btn btn-ghost" href="#/bookings">Смотреть брони</a>
                        <a class="btn btn-ghost" href="/index.html" target="_blank">Открыть сайт</a>
                    </div>
                </div>`;
            }
        },
        content: {
            title: "Контент главной", sub: "Тексты главной страницы сайта",
            render: async () => `
                <div class="notice">Изменения сохраняются в <code>content.json</code>. Раздел живой: hero-блок уже связан с сайтом. Остальные тексты — задел под дальнейшее подключение.</div>
                <div class="card">
                    <div class="card-title">Первый экран (Hero)</div>
                    <p class="card-hint">Главный заголовок и подзаголовок на входе.</p>
                    ${field("Надзаголовок (eyebrow)", "home.hero.eyebrow")}
                    ${field("Заголовок", "home.hero.title")}
                    ${field("Подзаголовок", "home.hero.subtitle", "textarea")}
                </div>
                <div class="card">
                    <div class="card-title">Блок «Кухня»</div>
                    ${field("Надзаголовок", "home.kitchen.eyebrow")}
                    ${field("Заголовок", "home.kitchen.title")}
                    ${field("Текст", "home.kitchen.text", "textarea")}
                </div>
                <div class="card">
                    <div class="card-title">Блок «Бар»</div>
                    ${field("Надзаголовок", "home.bar.eyebrow")}
                    ${field("Заголовок", "home.bar.title")}
                    ${field("Текст", "home.bar.text", "textarea")}
                </div>
                ${saveBar}`
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
                        ${field("Ссылка ВКонтакте", "settings.vk_url")}
                        ${field("ID Яндекс Формы (брони)", "settings.yandex_form_id")}
                    </div>
                </div>
                ${saveBar}`
        },
        media: {
            title: "Изображения", sub: "Медиа-библиотека сайта",
            render: async () => {
                const items = (content.media || []).map((m) => `
                    <div class="media-item">
                        <img src="/${esc(m.file)}" alt="${esc(m.alt)}" loading="lazy" onerror="this.style.opacity=0.25">
                        <div class="media-cap">${esc(m.title)}<small>${esc(m.file)}</small></div>
                    </div>`).join("");
                return `
                <div class="notice">Каркас медиа-библиотеки. Загрузка файлов подключается через backend (endpoint <code>/api/admin/upload</code>) — в скелете показаны текущие изображения сайта.</div>
                <div class="card">
                    <div class="section-head">
                        <div><div class="card-title">Текущие изображения</div><p class="card-hint" style="margin:0">Из <code>content.json → media</code></p></div>
                        <button class="btn btn-ghost" onclick="alert('Загрузка файлов — следующий этап (нужен backend-приём файлов).')">＋ Загрузить</button>
                    </div>
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
                <div class="notice">Заявки читаются из <code>bookings.json</code>. После перехода на Яндекс Форму брони будут приходить в кабинет Яндекс Форм — этот раздел можно связать с их API/выгрузкой.</div>
                <div class="card">
                    <table class="table">
                        <thead><tr><th>Имя</th><th>Телефон</th><th>Дата/время</th><th>Гостей</th><th>Статус</th></tr></thead>
                        <tbody>${body}</tbody>
                    </table>
                </div>`;
            }
        },
        menu: {
            title: "Меню", sub: "Позиции и категории",
            render: async () => stub("🍽", "Редактор меню", "Здесь появится управление категориями и позициями меню (сейчас меню в menu.html).")
        },
        events: {
            title: "События", sub: "Афиша и стендапы",
            render: async () => stub("★", "Афиша событий", "Управление анонсами и расписанием стендапов (сейчас в standup.html).")
        },
        users: {
            title: "Пользователи", sub: "Доступы к админке",
            render: async () => stub("👤", "Управление доступами", "Роли и учётные записи администраторов. Требует настоящей серверной авторизации.")
        }
    };

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
            const r = await api("/api/content");
            if (r.ok || r.status === 200) { showApp(); return; }
        }
        showLogin();
    })();
})();
