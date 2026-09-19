#!/usr/bin/env python3
"""
Генератор кропов для hero-слайдов «Бар Читателей».

Из ОДНОГО исходного фото делает три версии под разные экраны:
    <имя>-desktop.webp   1920 × 1080  (16:9)  — ПК
    <имя>-tablet.webp    1536 × 2048  (3:4)   — планшет
    <имя>-mobile.webp    1080 × 1920  (9:16)  — телефон

Это и есть форматы для макетов баннеров (см. README, раздел «Баннеры»).

Использование:
    python3 tools/make-hero-crops.py фото.jpg
    python3 tools/make-hero-crops.py фото.jpg --name hero-zal
    python3 tools/make-hero-crops.py фото.jpg --focus 0.5 0.35

--focus X Y — точка фокуса кадра в долях (0..1): что должно остаться
видимым при обрезке. По умолчанию 0.5 0.5 (центр). Для фото с людьми
или вывеской в верхней части ставьте Y меньше, например 0.35.

Файлы сохраняются в assets/hero/.
"""
import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Нужна библиотека Pillow:  pip3 install Pillow")

# (суффикс, ширина, соотношение сторон) → 1920×1080, 1536×2048, 1080×1920
VARIANTS = [
    ("desktop", 1920, 16 / 9),
    ("tablet", 1536, 3 / 4),
    ("mobile", 1080, 9 / 16),
]

OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "hero"


def crop_to_ratio(img: Image.Image, ratio: float, fx: float, fy: float) -> Image.Image:
    """Обрезает изображение до нужного соотношения, удерживая точку фокуса.

    Кроп всегда остаётся внутри исходного кадра: если фото шире нужного
    соотношения — режем по ширине, если выше — по высоте.
    """
    w, h = img.size
    if w / h > ratio:                       # фото шире цели → режем бока
        target_h = h
        target_w = int(round(h * ratio))
    else:                                   # фото выше цели → режем верх/низ
        target_w = w
        target_h = int(round(w / ratio))

    # прямоугольник вокруг точки фокуса, прижатый к границам кадра
    left = min(max(int(round(w * fx - target_w / 2)), 0), w - target_w)
    top = min(max(int(round(h * fy - target_h / 2)), 0), h - target_h)
    return img.crop((left, top, left + target_w, top + target_h))


def main() -> None:
    p = argparse.ArgumentParser(description="Кропы hero-фото под десктоп/планшет/телефон")
    p.add_argument("source", help="исходное фото (jpg/png/webp)")
    p.add_argument("--name", help="базовое имя файлов (по умолчанию — имя исходника)")
    p.add_argument("--focus", nargs=2, type=float, default=[0.5, 0.5],
                   metavar=("X", "Y"), help="точка фокуса в долях 0..1 (по умолчанию 0.5 0.5)")
    args = p.parse_args()

    src = Path(args.source)
    if not src.exists():
        sys.exit(f"Файл не найден: {src}")

    fx, fy = args.focus
    if not (0 <= fx <= 1 and 0 <= fy <= 1):
        sys.exit("--focus принимает значения от 0 до 1")

    base = args.name or src.stem
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    img = Image.open(src).convert("RGB")
    print(f"Исходник: {src.name} {img.size[0]}×{img.size[1]}")

    small = []
    for suffix, width, ratio in VARIANTS:
        out = crop_to_ratio(img, ratio, fx, fy)
        if out.width > width:
            out = out.resize((width, int(round(width / ratio))), Image.LANCZOS)
        elif out.width < width * 0.75:
            small.append(f"{suffix} ({out.width}px вместо {width}px)")
        path = OUT_DIR / f"{base}-{suffix}.webp"
        out.save(path, "WEBP", quality=82, method=6)
        print(f"  → {path.relative_to(OUT_DIR.parent.parent)}  {out.width}×{out.height}  "
              f"{path.stat().st_size // 1024} КБ")

    if small:
        print("\n⚠️  Исходник маловат, кропы вышли меньше рекомендованных: "
              + ", ".join(small)
              + "\n   Для чёткости на экранах Retina берите фото от 3000px по длинной стороне.")

    print("\nГотово. Подключите в index.html как слайд hero (см. data-photo).")


if __name__ == "__main__":
    main()
