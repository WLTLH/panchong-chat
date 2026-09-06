# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FACE_OD = 65.0
CONTACTS = [
    ("DC+", 1, -16.0, 14.5, 25.4, 12.0),
    ("DC-", 2, 16.0, 14.5, 25.4, 12.0),
    ("PE", 3, 0.0, 0.0, 15.6, 8.0),
    ("S+", 4, -13.5, -15.0, 10.3, 3.6),
    ("S-", 5, 13.5, -15.0, 10.3, 3.6),
    ("CC1", 6, -20.5, -1.0, 10.3, 3.6),
    ("CC2", 7, 20.5, -1.0, 10.3, 3.6),
    ("A+", 8, -13.5, -28.0, 10.3, 3.6),
    ("A-", 9, 13.5, -28.0, 10.3, 3.6),
]
# label anchors in mm (outside face)
LABELS = {
    "DC+": (-42, 28),
    "DC-": (42, 28),
    "PE": (-42, 10),
    "CC1": (-44, -1),
    "CC2": (44, -1),
    "S+": (-42, -15),
    "S-": (42, -15),
    "A+": (-42, -34),
    "A-": (42, -34),
}

MM = 8.0
MARGIN = 30
PX = int((FACE_OD + MARGIN * 2) * MM)
cx = cy = PX / 2


def P(x, y):
    return cx + x * MM, cy - y * MM


def box(x0, y0, x1, y1):
    a, b = P(x0, y0)
    c, d = P(x1, y1)
    return [min(a, c), min(b, d), max(a, c), max(b, d)]


def main():
    img = Image.new("RGB", (PX, PX), (250, 250, 248))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("msyh.ttc", 20)
        font_sm = ImageFont.truetype("msyh.ttc", 14)
        font_pin = ImageFont.truetype("msyh.ttc", 16)
    except OSError:
        font = font_sm = font_pin = ImageFont.load_default()

    d.line([P(0, -38), P(0, 38)], fill=(190, 190, 190), width=1)
    d.line([P(-38, 0), P(38, 0)], fill=(190, 190, 190), width=1)
    ms = 36
    d.rectangle(box(-ms, ms, ms, -ms), outline=(200, 200, 198), width=1)

    R = FACE_OD / 2
    d.ellipse(box(-R, R, R, -R), fill=(215, 218, 208), outline=(30, 30, 30), width=3)
    d.rectangle(box(-5, R + 5, 5, R + 1), outline=(30, 30, 30), width=2)
    d.text(
        (cx, 16),
        "GB/T 20234.3 车辆插头端面 · 9 触头（PE 原点 · +Y 锁止）",
        fill=(20, 20, 20),
        font=font_sm,
        anchor="mt",
    )

    for key, no, x, y, hole, pin in CONTACTS:
        px, py = P(x, y)
        hr = hole / 2 * MM
        pr = pin / 2 * MM
        d.ellipse([px - hr, py - hr, px + hr, py + hr], fill=(25, 27, 30), outline=(55, 55, 55), width=2)
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(175, 165, 135), outline=(90, 80, 60), width=1)
        d.text((px, py), str(no), fill=(245, 245, 245), font=font_pin, anchor="mm")
        lx, ly = LABELS[key]
        lpx, lpy = P(lx, ly)
        d.line([(px, py), (lpx, lpy)], fill=(150, 150, 150), width=1)
        anc = "rm" if lx < 0 else "lm"
        d.text((lpx, lpy - 9), key, fill=(10, 10, 10), font=font, anchor=anc)
        d.text((lpx, lpy + 10), f"({x:g},{y:g}) φ{hole}", fill=(90, 90, 90), font=font_sm, anchor=anc)

    d.line([P(-26, -42), P(-6, -42)], fill=(0, 0, 0), width=3)
    d.text(P(-16, -44.5), "20 mm", fill=(0, 0, 0), font=font_sm, anchor="mm")
    d.text(
        (cx, PX - 14),
        f"统一比例 1 mm = {MM:.0f} px · 端面 φ{FACE_OD:.0f} · 与 utils/gbt20234_face.js 同坐标",
        fill=(80, 80, 80),
        font=font_sm,
        anchor="mb",
    )

    out = Path(r"e:/判充/assets/connect/demo_dc_face9.jpg")
    img.save(out, quality=90, optimize=True)
    print("wrote", out, img.size, out.stat().st_size)


if __name__ == "__main__":
    main()
