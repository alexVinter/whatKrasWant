"""Prepare homepage news card images: trim brandbook padding, uniform composition."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
NEWS_DIR = ROOT / "web" / "src" / "shared" / "brand" / "mockup" / "news"
REF = ROOT / "docs" / "cursor_visual_refs" / "desktop" / "01-home.png"

# Matches --k400-beige (#F3EBDD); card image area ≈ 506×220 @1x.
TARGET_W = 1012
TARGET_H = 440
BEIGE = (243, 235, 221)
CONTENT_FILL = 0.82


def is_background(r: int, g: int, b: int, a: int = 255) -> bool:
    if a < 16:
        return True
    if r > 238 and g > 232 and b > 215:
        return True
    return abs(r - BEIGE[0]) < 24 and abs(g - BEIGE[1]) < 24 and abs(b - BEIGE[2]) < 24


def content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.convert("RGBA")
    w, h = px.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px.getpixel((x, y))
            if not is_background(r, g, b, a):
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not found:
        return (0, 0, w, h)
    pad = 4
    return (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + pad + 1),
        min(h, max_y + pad + 1),
    )


def prepare_card_image(source: Image.Image) -> Image.Image:
    box = content_bbox(source)
    content = source.crop(box)
    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), BEIGE + (255,))
    cw, ch = content.size
    max_w = int(TARGET_W * CONTENT_FILL)
    max_h = int(TARGET_H * CONTENT_FILL)
    scale = min(max_w / cw, max_h / ch)
    nw = max(1, int(cw * scale))
    nh = max(1, int(ch * scale))
    content = content.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (TARGET_W - nw) // 2
    y = (TARGET_H - nh) // 2
    if content.mode == "RGBA":
        canvas.paste(content, (x, y), content.split()[3])
    else:
        canvas.paste(content, (x, y))
    return canvas.convert("RGB")


def extract_from_reference() -> None:
    ref = Image.open(REF)
    news_cards = [(362, 1000), (1032, 1670), (1702, 2340)]
    y0, y1 = 4050, 4270
    for index, (left, right) in enumerate(news_cards, start=1):
        ref.crop((left, y0, right, y1)).save(NEWS_DIR / f"_raw-{index}.png")


def main() -> None:
    extract_from_reference()
    for index in (1, 2, 3):
        raw = NEWS_DIR / f"_raw-{index}.png"
        out = NEWS_DIR / f"photo-{index}.png"
        prepared = prepare_card_image(Image.open(raw))
        prepared.save(out, optimize=True)
        print(f"Wrote {out.name} {prepared.size}")


if __name__ == "__main__":
    main()
