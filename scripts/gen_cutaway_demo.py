# -*- coding: utf-8 -*-
"""
半剖透明枪/口对接图 — 客户展示用
暗场产品片底 + 玻璃壳 + 可见触头；触头可叠状态色
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "connect"

# 画布（与 cad 同比例便于替换舞台）
W, H = 960, 640

# 触头纵向排布（侧视半剖，上→下，直观耦合顺序相关）
# y 为画布比例；len_in / len_gun 表示凸出长度视觉
PINS = [
    {"key": "DC+", "y": 0.22, "thick": True, "label": "DC+", "role": "高压+"},
    {"key": "DC-", "y": 0.32, "thick": True, "label": "DC-", "role": "高压-"},
    {"key": "PE", "y": 0.44, "thick": True, "label": "PE", "role": "保护地·最先接"},
    {"key": "CC2", "y": 0.54, "thick": False, "label": "CC2", "role": "桩端确认"},
    {"key": "A+", "y": 0.62, "thick": False, "label": "A+", "role": "辅助+"},
    {"key": "A-", "y": 0.68, "thick": False, "label": "A-", "role": "辅助-"},
    {"key": "S+", "y": 0.76, "thick": False, "label": "S+", "role": "通信+"},
    {"key": "S-", "y": 0.82, "thick": False, "label": "S-", "role": "通信-"},
    {"key": "CC1", "y": 0.90, "thick": False, "label": "CC1", "role": "车端确认·最后接"},
]


def font(size: int):
    for n in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simhei.ttf"):
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            pass
    return ImageFont.load_default()


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def draw_glass_body(draw, box, fill, edge, radius=28):
    x0, y0, x1, y1 = box
    # soft glass fill
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=edge, width=2)


def ellipse_aa(img, box, fill):
    """Draw soft ellipse via temp layer."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse(box, fill=fill)
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    return Image.alpha_composite(img, layer)


def make_base(gap_px=110):
    """半剖对接底图：左充电口、右充电枪，外壳半透，触头可见。gap=对接缝宽度。"""
    img = Image.new("RGBA", (W, H), (18, 20, 24, 255))
    d = ImageDraw.Draw(img)

    # 暗场氛围
    for i in range(H):
        shade = 18 + int(10 * (i / H))
        d.line((0, i, W, i), fill=(shade, shade + 2, shade + 4, 255))

    # 中心对接轴
    mid_y = int(H * 0.52)
    seam_x = W // 2

    # —— 左：车辆插座（口）——
    inlet_x1 = seam_x - gap_px // 2
    inlet_x0 = inlet_x1 - 210
    # 法兰
    d.rounded_rectangle(
        (inlet_x0 - 36, 90, inlet_x0 + 10, H - 70),
        radius=10,
        fill=(70, 78, 82, 220),
        outline=(160, 170, 175, 180),
        width=2,
    )
    # 玻璃壳体（半剖：只画上半透明罩 + 下半实体暗示）
    body = (inlet_x0, 120, inlet_x1, H - 90)
    draw_glass_body(d, body, (90, 120, 125, 70), (180, 210, 205, 140), 36)
    # 内腔更深
    d.rounded_rectangle(
        (inlet_x0 + 18, 145, inlet_x1 - 8, H - 115),
        radius=24,
        fill=(30, 36, 40, 160),
        outline=(120, 140, 138, 80),
    )
    # 半剖切割线（斜向）
    d.line((inlet_x0 + 8, 130, inlet_x1 - 4, H - 100), fill=(200, 210, 200, 60), width=1)

    # —— 右：车辆插头（枪）——
    gun_x0 = seam_x + gap_px // 2
    gun_x1 = gun_x0 + 230
    draw_glass_body(
        d,
        (gun_x0, 115, gun_x1, H - 95),
        (95, 125, 130, 68),
        (185, 215, 210, 145),
        36,
    )
    d.rounded_rectangle(
        (gun_x0 + 10, 140, gun_x1 - 20, H - 120),
        radius=24,
        fill=(28, 34, 38, 150),
        outline=(120, 145, 142, 70),
    )
    # 手柄暗示
    hx0, hy0 = gun_x1 - 40, H - 200
    d.polygon(
        [(hx0, hy0), (gun_x1 + 20, hy0 + 30), (gun_x1 + 8, H - 40), (hx0 - 25, H - 70)],
        fill=(80, 100, 105, 90),
        outline=(170, 195, 190, 120),
    )

    # 对接引导光缝
    for i in range(6):
        a = 40 - i * 6
        d.line(
            (seam_x - gap_px // 2 - 2, 150 + i, seam_x + gap_px // 2 + 2, 150 + i),
            fill=(120, 200, 160, a),
        )

    # 触头（口侧凸针 + 枪侧插套）— 中性金属色，状态由叠层改色
    pin_meta = []
    for p in PINS:
        cy = int(H * p["y"])
        r = 11 if p["thick"] else 7
        # inlet pin tip x
        pin_tip = inlet_x1 - 6
        pin_root = inlet_x1 - (52 if p["key"] == "PE" else (42 if p["thick"] else 34))
        # gun sleeve
        sleeve_mouth = gun_x0 + 6
        sleeve_end = gun_x0 + (48 if p["thick"] else 38)

        # pin shaft (inlet)
        d.rounded_rectangle(
            (pin_root, cy - r + 1, pin_tip, cy + r - 1),
            radius=r - 1,
            fill=(198, 180, 140, 230),
            outline=(230, 215, 180, 200),
        )
        # pin tip round
        img = ellipse_aa(img, (pin_tip - r, cy - r, pin_tip + r, cy + r), (220, 200, 160, 240))
        d = ImageDraw.Draw(img)

        # gun sleeve (hollow look)
        d.rounded_rectangle(
            (sleeve_mouth, cy - r - 2, sleeve_end, cy + r + 2),
            radius=r,
            fill=(60, 70, 74, 180),
            outline=(190, 200, 195, 160),
            width=2,
        )
        # inner metal ring
        d.ellipse(
            (sleeve_mouth + 4, cy - r + 2, sleeve_mouth + 4 + 2 * (r - 2), cy + r - 2),
            fill=(170, 160, 140, 200),
            outline=(210, 200, 175, 180),
        )

        # connection gap bridge (neutral, will be colored by overlay)
        bridge_x0 = pin_tip + 2
        bridge_x1 = sleeve_mouth - 2
        pin_meta.append(
            {
                "key": p["key"],
                "cy": cy,
                "r": r,
                "bridge": (bridge_x0, cy - 3, bridge_x1, cy + 3),
                "pin_box": (pin_root - 4, cy - r - 4, pin_tip + r + 2, cy + r + 4),
                "sleeve_box": (sleeve_mouth - 2, cy - r - 6, sleeve_end + 4, cy + r + 6),
                "label": p["label"],
                "role": p["role"],
                "thick": p["thick"],
            }
        )

        # labels left
        f = font(15)
        d.text((48, cy - 9), p["label"], fill=(210, 215, 218, 230), font=f)
        d.text((48, cy + 8), p["role"], fill=(120, 130, 136, 200), font=font(11))

    # 左右身份标
    f1, f2, f3 = font(22), font(14), font(18)
    d.rounded_rectangle((inlet_x0 + 40, 128, inlet_x0 + 130, 158), radius=8, fill=(0, 0, 0, 120), outline=(160, 190, 180, 100))
    d.text((inlet_x0 + 52, 132), "充电口", fill=(210, 230, 220, 240), font=f3)
    d.rounded_rectangle((gun_x1 - 120, 128, gun_x1 - 30, 158), radius=8, fill=(0, 0, 0, 120), outline=(160, 190, 180, 100))
    d.text((gun_x1 - 108, 132), "充电枪", fill=(210, 230, 220, 240), font=f3)

    # HUD
    d.text((36, 28), "半剖透明 · 枪 / 口对接", fill=(230, 232, 228, 255), font=f1)
    d.text((36, 58), "左=车端充电口(凸针)  右=桩端充电枪(插套)  · 绿通/蓝接/红断", fill=(140, 160, 150, 220), font=f2)
    d.text((W - 220, 28), "CUSTOMER DEMO", fill=(180, 170, 140, 200), font=f2)

    # 保存 meta
    return img, pin_meta, {"seam_x": seam_x, "gap": gap_px, "inlet_x1": inlet_x1, "gun_x0": gun_x0}


def tint_overlay(meta, state_map):
    """Generate transparent overlay: green/red/blue bridges + pin halos."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    colors = {
        "ok": (40, 200, 120),
        "pending": (70, 140, 255),
        "fail": (230, 70, 70),
        "off": (120, 120, 120),
    }
    for p in meta:
        st = state_map.get(p["key"], "off")
        c = colors.get(st, colors["off"])
        a_bridge = 0 if st == "off" else (210 if st != "pending" else 160)
        a_halo = 0 if st == "off" else 90
        if a_bridge:
            x0, y0, x1, y1 = p["bridge"]
            # glow bridge
            d.rounded_rectangle((x0, y0 - 2, x1, y1 + 2), radius=4, fill=c + (a_bridge,))
            # pulse tips
            d.ellipse(
                (x0 - 6, p["cy"] - 6, x0 + 6, p["cy"] + 6),
                fill=c + (a_halo + 40,),
            )
            d.ellipse(
                (x1 - 6, p["cy"] - 6, x1 + 6, p["cy"] + 6),
                fill=c + (a_halo + 40,),
            )
        if st in ("ok", "fail", "pending"):
            # pin / sleeve halo
            bx = p["pin_box"]
            d.rounded_rectangle(bx, radius=8, outline=c + (140,), width=2)
            sx = p["sleeve_box"]
            d.rounded_rectangle(sx, radius=8, outline=c + (120,), width=2)
            if st == "fail":
                # X mark at bridge
                mx = (p["bridge"][0] + p["bridge"][2]) // 2
                my = p["cy"]
                d.line((mx - 8, my - 8, mx + 8, my + 8), fill=c + (230,), width=3)
                d.line((mx - 8, my + 8, mx + 8, my - 8), fill=c + (230,), width=3)
    return img


def composite_demo(base, overlay):
    return Image.alpha_composite(base, overlay)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # 几个关键演示帧
    scenes = {
        "idle": {},
        "seated": {k: "pending" for k in ["PE", "CC2", "DC+", "DC-"]},
        "ok": {p["key"]: "ok" for p in PINS},
        "cc2_fail": {
            **{p["key"]: "ok" for p in PINS if p["key"] not in ("CC2", "CC1", "S+", "S-", "A+", "A-")},
            "CC2": "fail",
            "PE": "ok",
            "DC+": "ok",
            "DC-": "ok",
        },
        "charging": {p["key"]: "ok" for p in PINS},
    }

    # 近距 / 分离两版底图
    for gap, tag in ((150, "far"), (36, "near")):
        base, meta, geom = make_base(gap_px=gap)
        base_path = OUT / f"cutaway_base_{tag}.png"
        base.save(base_path, optimize=True)
        print("base", base_path.name, base_path.stat().st_size)

        # also jpg for pack size
        bg = Image.new("RGB", (W, H), (18, 20, 24))
        bg.paste(base, mask=base.split()[3])
        bg.save(OUT / f"cutaway_base_{tag}.jpg", quality=86, optimize=True)

        import json

        (OUT / f"cutaway_meta_{tag}.json").write_text(
            json.dumps({"pins": meta, "geom": geom, "canvas": [W, H]}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        if tag == "near":
            for name, smap in scenes.items():
                ov = tint_overlay(meta, smap)
                frame = composite_demo(base, ov)
                # flatten
                flat = Image.new("RGB", (W, H), (18, 20, 24))
                flat.paste(frame, mask=frame.split()[3])
                # diagnosis banner for fail
                if name == "cc2_fail":
                    d = ImageDraw.Draw(flat)
                    d.rounded_rectangle((240, H - 78, 720, H - 28), radius=12, fill=(60, 24, 24), outline=(230, 90, 90))
                    d.text((270, H - 62), "断点：CC2 连接确认异常 · 后续通信/高压不再推进", fill=(255, 200, 200), font=font(16))
                if name == "charging":
                    d = ImageDraw.Draw(flat)
                    d.rounded_rectangle((260, H - 78, 700, H - 28), radius=12, fill=(20, 50, 36), outline=(40, 200, 120))
                    d.text((300, H - 62), "高压通路建立 · DC± / PE 导通充电中", fill=(180, 255, 210), font=font(16))
                outp = OUT / f"cutaway_demo_{name}.jpg"
                flat.save(outp, quality=88, optimize=True)
                print(" ", outp.name, outp.stat().st_size)

            # 单独状态叠层（透明 PNG，供运行时着色）— 每触头三态
            for p in meta:
                for st, rgb in (
                    ("ok", (40, 200, 120)),
                    ("fail", (230, 70, 70)),
                    ("pending", (70, 140, 255)),
                ):
                    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                    ld = ImageDraw.Draw(layer)
                    x0, y0, x1, y1 = p["bridge"]
                    ld.rounded_rectangle((x0, y0 - 2, x1, y1 + 2), radius=4, fill=rgb + (210,))
                    ld.ellipse((x0 - 7, p["cy"] - 7, x0 + 7, p["cy"] + 7), fill=rgb + (120,))
                    ld.ellipse((x1 - 7, p["cy"] - 7, x1 + 7, p["cy"] + 7), fill=rgb + (120,))
                    if st == "fail":
                        mx = (x0 + x1) // 2
                        my = p["cy"]
                        ld.line((mx - 8, my - 8, mx + 8, my + 8), fill=rgb + (240,), width=3)
                        ld.line((mx - 8, my + 8, mx + 8, my - 8), fill=rgb + (240,), width=3)
                    key = p["key"].replace("+", "p").replace("-", "m").lower()
                    layer.save(OUT / f"cut_pin_{key}_{st}.png", optimize=True)

    print("done")


if __name__ == "__main__":
    main()
