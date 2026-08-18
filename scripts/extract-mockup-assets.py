"""Extract homepage visual assets from approved desktop mockup."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MOCKUP = ROOT / "docs" / "cursor_visual_refs" / "desktop" / "01-home.png"
OUT = ROOT / "web" / "src" / "shared" / "brand" / "mockup"


def crop_box(im: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    return im.crop(box)


def main() -> None:
    im = Image.open(MOCKUP)
    (OUT / "rating").mkdir(parents=True, exist_ok=True)
    (OUT / "news").mkdir(parents=True, exist_ok=True)
    (OUT / "partners").mkdir(parents=True, exist_ok=True)

    # Hero graphic: from 01-home.png, graphic only (no headline bleed), to viewport edge.
    crop_box(im, (1490, 130, 2800, 960)).save(OUT / "hero-composition.png")

    rating_cards = [(900, 1418), (1438, 1956), (1976, 2494)]
    crop_box(im, (362, 3060, 880, 3300)).save(OUT / "rating" / "map-1.png")
    for index, (left, right) in enumerate(rating_cards, start=2):
        crop_box(im, (left, 3060, right, 3300)).save(
            OUT / "rating" / f"map-{index}.png"
        )

    news_cards = [(362, 1000), (1032, 1670), (1702, 2340)]
    for index, (left, right) in enumerate(news_cards, start=1):
        crop_box(im, (left, 4050, right, 4270)).save(
            OUT / "news" / f"photo-{index}.png"
        )

    partner_boxes = {
        "tv7": (1185, 4745, 1469, 4839),
        "yenisei-siberia": (1494, 4745, 1778, 4839),
        "delovaya-rossiya": (1803, 4745, 2087, 4839),
        "artstyle": (1185, 4858, 1469, 4952),
        "project-development": (1494, 4858, 1778, 4952),
        "krasnoyarsk-admin": (1803, 4857, 2087, 4952),
    }
    for name, box in partner_boxes.items():
        crop_box(im, box).save(OUT / "partners" / f"{name}.png")

    print(f"Assets written to {OUT}")


if __name__ == "__main__":
    main()
