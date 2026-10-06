/* Бар Читателей — загрузчик контента.
 *
 * Читает content.json (его правит админка /admin) и подставляет на страницу:
 *   1) ТЕКСТЫ — в элементы с атрибутом data-content="path.to.value";
 *   2) ФОТО   — в элементы с атрибутом data-photo="слот".
 *
 * Для фото проставляется класс:
 *   .has-photo — снимок загружен, показываем его;
 *   .no-photo  — снимка нет, остаётся серая заглушка (правила в styles.css).
 * Поэтому заглушка пропадает сама, как только фото загрузили из админки.
 *
 * Если content.json недоступен — на странице остаётся текст, зашитый в HTML,
 * а все фото-позиции показываются серыми.
 */
(function () {
    "use strict";

    function getPath(obj, path) {
        return path.split(".").reduce(function (o, k) {
            return o == null ? undefined : o[k];
        }, obj);
    }

    function applyText(content) {
        document.querySelectorAll("[data-content]").forEach(function (el) {
            var val = getPath(content, el.getAttribute("data-content"));
            if (val != null && String(val).trim() !== "") el.textContent = val;
        });
    }

    function applyPhotos(content) {
        var photos = (content && content.photos) || {};
        document.querySelectorAll("[data-photo]").forEach(function (el) {
            var src = photos[el.getAttribute("data-photo")];
            var has = typeof src === "string" && src.trim() !== "";
            // data-photo-default — картинка уже вшита в вёрстку (сканы меню),
            // серую заглушку таким позициям не ставим
            var keepsOwn = el.hasAttribute("data-photo-default");

            el.classList.toggle("has-photo", has);
            el.classList.toggle("no-photo", !has && !keepsOwn);

            if (!has) {
                if (!keepsOwn) el.style.backgroundImage = "";
                return;
            }

            var img = el.tagName === "IMG" ? el : el.querySelector("img");
            if (img) {
                // srcset перебил бы src — убираем его вместе с sizes
                img.removeAttribute("srcset");
                img.removeAttribute("sizes");
                img.src = src;
                // у сканов меню ссылка ведёт на полный размер — обновляем и её
                var link = el.tagName === "A" ? el : el.closest("a[href]");
                if (link && /\.(webp|jpe?g|png|gif)(\?|$)/i.test(link.getAttribute("href") || "")) {
                    link.setAttribute("href", src);
                }
            } else {
                el.style.backgroundImage = 'url("' + src.replace(/"/g, "%22") + '")';
            }
        });
    }

    // до загрузки content.json позиции без своей картинки показываем серыми
    document.querySelectorAll("[data-photo]:not([data-photo-default])").forEach(function (el) {
        el.classList.add("no-photo");
    });

    fetch("content.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (content) {
            if (!content) return;
            applyText(content);
            applyPhotos(content);
            // админка открывает сайт в предпросмотре и ждёт этот сигнал
            window.dispatchEvent(new CustomEvent("rp:content-applied", { detail: content }));
        })
        .catch(function () { /* тихо оставляем HTML-текст и серые заглушки */ });
})();
