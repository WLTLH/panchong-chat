# -*- coding: utf-8 -*-
"""按 GB/T 20234.3 图1 触头布置：端面 φ65 居中，全图统一 mm 比例。"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

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

# 原图式构图：端面为主体，四周等宽留白（锁止+比例尺），禁止用标注拉开画布
MARGIN_MM = 18.0
CONTENT_MM = FACE_OD + MARGIN_MM * 2
PX = 720
MM = PX / CONTENT_MM  # px / mm，全图唯一比例


def main():
    out = Path(__file__).resolve().parents[1] / "assets" / "connect" / "gb_face_fig1.png"
    cx = cy = PX / 2
    img = Image.new("RGB", (PX, PX), (247, 248, 246))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("msyh.ttc", 18)
        font_sm = ImageFont.truetype("msyh.ttc", 14)
    except OSError:
        font = ImageFont.load_default()
        font_sm = font

    ms = 72.0 * MM / 2
    d.rectangle([cx - ms, cy - ms, cx + ms, cy + ms], outline=(180, 180, 176), width=1)

    R = FACE_OD * MM / 2
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(210, 214, 200), outline=(40, 44, 48), width=3)
    d.rectangle([cx - 9, cy - R - 14, cx + 9, cy - R + 2], outline=(40, 44, 48), width=2)
    d.line([cx, cy - R - 4, cx, cy + R + 4], fill=(170, 170, 168), width=1)
    d.line([cx - R - 4, cy, cx + R + 4, cy], fill=(170, 170, 168), width=1)

    for key, no, x, y, hole, pin in CONTACTS:
        px_ = cx + x * MM
        py_ = cy - y * MM
        hr = hole * MM / 2
        pr = pin * MM / 2
        d.ellipse([px_ - hr, py_ - hr, px_ + hr, py_ + hr], fill=(28, 30, 32), outline=(70, 74, 78), width=2)
        d.ellipse([px_ - pr, py_ - pr, px_ + pr, py_ + pr], fill=(168, 158, 128), outline=(100, 90, 70), width=1)
        bb = d.textbbox((0, 0), str(no), font=font)
        d.text(
            (px_ - (bb[2] - bb[0]) / 2, py_ - (bb[3] - bb[1]) / 2 - 1),
            str(no),
            fill=(245, 245, 245),
            font=font,
        )

    sx, sy = 36, PX - 40
    d.line([sx, sy, sx + 20 * MM, sy], fill=(30, 30, 30), width=3)
    d.line([sx, sy - 6, sx, sy + 6], fill=(30, 30, 30), width=2)
    d.line([sx + 20 * MM, sy - 6, sx + 20 * MM, sy + 6], fill=(30, 30, 30), width=2)
    d.text((sx + 4 * MM, sy - 22), "20 mm", fill=(30, 30, 30), font=font_sm)
    d.text((24, 16), "GB/T 20234.3 图1 触头布置 · 原图等比", fill=(30, 30, 30), font=font_sm)
    d.text((24, 38), f"统一比例 1 mm = {MM:.2f} px · 端面 φ{FACE_OD:.0f}", fill=(90, 90, 90), font=font_sm)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    print("wrote", out, "scale", MM)


if __name__ == "__main__":
    main()
