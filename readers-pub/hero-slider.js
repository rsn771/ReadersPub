/* Точная высота фиксированной шапки → в переменную --header-h.
   Подгонять числом нельзя: на разных ширинах шапка разной высоты,
   и даже пара пикселей расхождения даёт просвет под ней. */
(function () {
    "use strict";
    var header = document.querySelector(".header");
    if (!header) return;
    function sync() {
        var h = Math.round(header.getBoundingClientRect().height);
        document.documentElement.style.setProperty("--header-h", h + "px");
    }
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("load", sync);
    if (window.ResizeObserver) new ResizeObserver(sync).observe(header);
})();

/* Readers Pub — hero-слайдер главной.
 * Авто-смена слайдов каждые 2 сек, стрелки ‹ ›, точки, пауза при наведении,
 * свайп на тач-устройствах, стрелки клавиатуры и синхронизация с верхним меню.
 */
(function () {
    "use strict";

    // Внутри редактора админки (?editor=1) слайдер не запускаем: все слайды
    // показываются сразу и каждый доступен для клика (правила в styles.css).
    if (new URLSearchParams(location.search).get("editor") === "1") {
        document.documentElement.classList.add("rp-editor");
        return;
    }

    var slider = document.getElementById("heroSlider");
    if (!slider) return;
    // На главном экране только баннеры: слайдер крутит их.
    var photos = Array.prototype.slice.call(document.querySelectorAll(".hero-photo"));
    if (photos.length < 2) return;

    var dotsWrap = document.getElementById("heroDots");
    var prevBtn = document.getElementById("heroPrev");
    var nextBtn = document.getElementById("heroNext");
    var INTERVAL = 5000;   // баннер держится дольше, чем строка текста
    var index = 0;
    var timer = null;

    // точки навигации
    var dots = photos.map(function (photo, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "hero-dot";
        dot.setAttribute("role", "tab");
        var label = "Баннер " + (i + 1);
        dot.setAttribute("aria-label", label);
        dot.addEventListener("click", function () { go(i); restart(); });
        if (dotsWrap) dotsWrap.appendChild(dot);
        return dot;
    });

    function render() {
        photos.forEach(function (photo, i) {
            photo.classList.toggle("is-active", i === index);
        });
        dots.forEach(function (dot, i) {
            var active = i === index;
            dot.classList.toggle("is-active", active);
            dot.setAttribute("aria-selected", active ? "true" : "false");
        });
    }

    function go(i) {
        var target = ((i % photos.length) + photos.length) % photos.length;
        if (target === index) return;
        index = target;
        render();   // слои сами перетекают друг в друга (transition в CSS)
    }
    function next() { go(index + 1); }
    function prev() { go(index - 1); }

    function start() {
        stop();
        timer = window.setInterval(next, INTERVAL);
    }
    function stop() {
        if (timer) { window.clearInterval(timer); timer = null; }
    }
    function restart() { start(); }

    if (nextBtn) nextBtn.addEventListener("click", function () { next(); restart(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { prev(); restart(); });

    // пауза только при наведении на сам слайдер и стрелки (не на весь экран),
    // иначе автопрокрутка "замирает" от курсора где угодно в hero.
    var hero = slider.closest(".hero") || slider;
    [slider, prevBtn, nextBtn].forEach(function (el) {
        if (!el) return;
        el.addEventListener("mouseenter", stop);
        el.addEventListener("mouseleave", start);
    });
    slider.addEventListener("focusin", stop);
    slider.addEventListener("focusout", start);

    // пауза, когда вкладка не активна
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else start();
    });

    // клавиатура
    slider.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { prev(); restart(); }
        else if (e.key === "ArrowRight") { next(); restart(); }
    });

    // свайп
    var startX = null;
    hero.addEventListener("touchstart", function (e) {
        startX = e.touches[0].clientX;
        stop();
    }, { passive: true });
    hero.addEventListener("touchend", function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
        startX = null;
        start();
    });

    // синхронизация с верхним меню (пункты с data-slide)
    document.querySelectorAll(".nav a[data-slide]").forEach(function (link) {
        link.addEventListener("click", function () {
            var n = parseInt(link.getAttribute("data-slide"), 10);
            if (!isNaN(n)) { go(n); restart(); }
        });
    });

    render();
    start();
})();
