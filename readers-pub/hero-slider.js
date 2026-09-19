/* Readers Pub — hero-слайдер главной.
 * Авто-смена слайдов каждые 2 сек, стрелки ‹ ›, точки, пауза при наведении,
 * свайп на тач-устройствах, стрелки клавиатуры и синхронизация с верхним меню.
 */
(function () {
    "use strict";

    var slider = document.getElementById("heroSlider");
    if (!slider) return;
    var slides = Array.prototype.slice.call(slider.querySelectorAll(".hero-slide"));
    if (slides.length < 2) return;

    var dotsWrap = document.getElementById("heroDots");
    var prevBtn = document.getElementById("heroPrev");
    var nextBtn = document.getElementById("heroNext");
    var slidesEl = document.getElementById("heroSlides");
    var INTERVAL = 2000;
    var FADE = 300;            // мс, синхронно с transition в CSS (.hero-slides)
    var index = 0;
    var timer = null;
    var fadeTimer = null;

    // точки навигации
    var dots = slides.map(function (slide, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "hero-dot";
        dot.setAttribute("role", "tab");
        var label = slide.getAttribute("aria-label") || ("Слайд " + (i + 1));
        dot.setAttribute("aria-label", label);
        dot.addEventListener("click", function () { go(i); restart(); });
        if (dotsWrap) dotsWrap.appendChild(dot);
        return dot;
    });

    var photos = Array.prototype.slice.call(document.querySelectorAll(".hero-photo"));

    function render() {
        slides.forEach(function (slide, i) {
            var active = i === index;
            slide.classList.toggle("is-active", active);
            slide.setAttribute("aria-hidden", active ? "false" : "true");
        });
        dots.forEach(function (dot, i) {
            var active = i === index;
            dot.classList.toggle("is-active", active);
            dot.setAttribute("aria-selected", active ? "true" : "false");
        });
        // фото меняется вместе со слайдом (если кадров меньше — идут по кругу)
        if (photos.length) {
            var photoIndex = index % photos.length;
            photos.forEach(function (photo, i) {
                photo.classList.toggle("is-active", i === photoIndex);
            });
        }
    }

    function go(i) {
        var target = ((i % slides.length) + slides.length) % slides.length;
        if (target === index) return;
        if (fadeTimer) window.clearTimeout(fadeTimer);
        // погасить контейнер → подменить активный слайд, пока он невидим → проявить
        if (slidesEl) slidesEl.classList.add("is-fading");
        fadeTimer = window.setTimeout(function () {
            index = target;
            render();
            if (slidesEl) slidesEl.classList.remove("is-fading");
            fadeTimer = null;
        }, FADE);
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
