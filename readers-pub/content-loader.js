/* Readers Pub — загрузчик контента.
 * Читает content.json (его правит админка /admin) и подставляет значения
 * в элементы с атрибутом data-content="path.to.value".
 * Если файл недоступен — на странице остаётся текст, зашитый в HTML (fallback).
 */
(function () {
    "use strict";
    function getPath(obj, path) {
        return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    }
    fetch("content.json", { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : null))
        .then((content) => {
            if (!content) return;
            document.querySelectorAll("[data-content]").forEach((el) => {
                const val = getPath(content, el.getAttribute("data-content"));
                if (val != null && String(val).trim() !== "") el.textContent = val;
            });
        })
        .catch(() => { /* тихо оставляем HTML-текст как есть */ });
})();
