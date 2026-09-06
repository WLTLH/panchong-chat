# -*- coding: utf-8 -*-
"""Offline perspective preview of charging gun from GB/T 20234.3 Fig.9 space dims."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "connect"
REF = ROOT / "refs" / "国标-直流充电"

# Fig.9 nominal (mm)
UP, DOWN = 48.0, 43.0
WIDTH, TOP_W = 78.0, 36.0
SHOULDER_Y, R_BOT = 36.5, 44.0
NOSE_STEP_H, NOSE_STEP_L = 1.0, 8.0
HEAD_LEN, NOSE_LEN = 56.0, 24.0
FACE_OD, SHELL_OD = 65.0, 70.0
HANDLE_ANG, HANDLE_LEN = 75.0, 95.0
HANDLE_W, HANDLE_T = 34.0, 28.0

CONTACTS = [
    ("DC+", -16.0, 14.5, 25.4, 12.0),
    ("DC-", 16.0, 14.5, 25.4, 12.0),
    ("PE", 0.0, 0.0, 15.6, 8.0),
    ("S+", -13.5, -15.0, 10.3, 3.6),
    ("S-", 13.5, -15.0, 10.3, 3.6),
    ("CC1", -20.5, -1.0, 10.3, 3.6),
    ("CC2", 20.5, -1.0, 10.3, 3.6),
    ("A+", -13.5, -28.0, 10.3, 3.6),
    ("A-", 13.5, -28.0, 10.3, 3.6),
]


def font(size: int):
    for name in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simhei.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


class Cam:
    def __init__(self, ox, oy, scale=3.2, yaw=38, pitch=24):
        self.ox, self.oy, self.scale = ox, oy, scale
        self.yaw, self.pitch = math.radians(yaw), math.radians(pitch)

    def p(self, x, y, z):
        cy, sy = math.cos(self.yaw), math.sin(self.yaw)
        cp, sp = math.cos(self.pitch), math.sin(self.pitch)
        x1 = x * cy + z * sy
        z1 = -x * sy + z * cy
        y2 = y * cp - z1 * sp
        return self.ox + x1 * self.scale, self.oy - y2 * self.scale


def front_profile(n_arc=24):
    hw, tw = WIDTH * 0.5, TOP_W * 0.5
    y_join = -math.sqrt(max(0.0, R_BOT * R_BOT - hw * hw))
    pts = [
        (y_join, hw),
        (SHOULDER_Y, hw),
        (UP, tw),
        (UP, -tw),
        (SHOULDER_Y, -hw),
        (y_join, -hw),
    ]
    a0 = math.atan2(y_join, -hw)
    a1 = math.atan2(y_join, hw)
    span = math.pi * 2 - (a1 - a0)
    for i in range(1, n_arc):
        t = i / n_arc
        ang = a0 - t * span
        pts.append((R_BOT * math.sin(ang), R_BOT * math.cos(ang)))
    return pts


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def poly(draw, cam, pts3, fill, outline=None):
    pts = [cam.p(*p) for p in pts3]
    draw.polygon(pts, fill=fill, outline=outline)


def ellipse_yz(draw, cam, x, y, z, ry, rz, fill, outline=None, segs=40):
    pts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        pts.append(cam.p(x, y + ry * math.sin(a), z + rz * math.cos(a)))
    draw.polygon(pts, fill=fill, outline=outline)


def main():
    w, h = 1200, 900
    img = Image.new("RGB", (w, h), (245, 246, 248))
    draw = ImageDraw.Draw(img)
    # light grid
    for i in range(0, w, 36):
        draw.line((i, 0, i, h), fill=(232, 234, 236))
    for j in range(0, h, 36):
        draw.line((0, j, w, j), fill=(232, 234, 236))

    cam = Cam(ox=520, oy=430, scale=3.35, yaw=42, pitch=22)
    plastic = (78, 84, 90)
    plastic_hi = (110, 116, 122)
    face_c = (168, 178, 150)
    pocket = (36, 38, 40)
    pin_c = (196, 198, 202)
    outline = (40, 42, 46)

    prof = front_profile()
    x0, x1 = NOSE_LEN * 0.35, NOSE_LEN + HEAD_LEN

    # handle first (back)
    ang = math.radians(HANDLE_ANG)
    hx = NOSE_LEN + HEAD_LEN - 6
    hy = -6
    # handle corners in local then rotate around Z at root
    def rot_handle(lx, ly, lz):
        # local: y along handle down, x thickness
        ca, sa = math.cos(-(math.pi / 2 - ang)), math.sin(-(math.pi / 2 - ang))
        rx = lx * ca - ly * sa
        ry = lx * sa + ly * ca
        return hx + rx, hy + ry - 8, lz

    ht, hl, hw = HANDLE_T, HANDLE_LEN, HANDLE_W
    handle_box = [
        rot_handle(-ht / 2, 0, -hw / 2),
        rot_handle(ht / 2, 0, -hw / 2),
        rot_handle(ht / 2, -hl, -hw / 2),
        rot_handle(-ht / 2, -hl, -hw / 2),
    ]
    poly(draw, cam, handle_box, shade(plastic, 0.9), outline)
    handle_box2 = [
        rot_handle(-ht / 2, 0, hw / 2),
        rot_handle(ht / 2, 0, hw / 2),
        rot_handle(ht / 2, -hl, hw / 2),
        rot_handle(-ht / 2, -hl, hw / 2),
    ]
    poly(draw, cam, handle_box2, shade(plastic, 1.05), outline)

    # head extrusion sides (draw as quads)
    n = len(prof)
    for i in range(n):
        y0, z0 = prof[i]
        y1, z1 = prof[(i + 1) % n]
        # lighting
        midz = (z0 + z1) * 0.5
        k = 0.75 + 0.25 * max(0, midz / (WIDTH * 0.5))
        poly(
            draw,
            cam,
            [(x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1)],
            shade(plastic, k),
            outline,
        )

    # front face of head (at x0) house shape
    poly(draw, cam, [(x0, y, z) for y, z in prof], shade(plastic_hi, 0.95), outline)

    # nose cylinder body
    segs = 36
    for i in range(segs):
        a0 = 2 * math.pi * i / segs
        a1 = 2 * math.pi * (i + 1) / segs
        r = SHELL_OD * 0.5
        k = 0.7 + 0.3 * max(0, math.cos((a0 + a1) * 0.5))
        poly(
            draw,
            cam,
            [
                (0.5, r * math.sin(a0), r * math.cos(a0)),
                (NOSE_LEN, r * math.sin(a0), r * math.cos(a0)),
                (NOSE_LEN, r * math.sin(a1), r * math.cos(a1)),
                (0.5, r * math.sin(a1), r * math.cos(a1)),
            ],
            shade(plastic_hi, k),
            None,
        )
    ellipse_yz(draw, cam, 1.0, 0, 0, FACE_OD * 0.5, FACE_OD * 0.5, face_c, outline)

    # contacts on face
    for name, cx, cy, hole, pin in CONTACTS:
        # face: (y,z)=(cy,cx)
        ellipse_yz(draw, cam, 1.4, cy, cx, hole * 0.5, hole * 0.5, pocket, outline)
        ellipse_yz(draw, cam, 1.6, cy, cx, pin * 0.5, pin * 0.5, pin_c, outline)

    # lock tab
    poly(
        draw,
        cam,
        [
            (2, FACE_OD * 0.5 - 1, -4),
            (10, FACE_OD * 0.5 - 1, -4),
            (10, FACE_OD * 0.5 + 4, -4),
            (2, FACE_OD * 0.5 + 4, -4),
        ],
        (190, 194, 200),
        outline,
    )

    # dimension annotations
    f1, f2, f3 = font(30), font(20), font(17)
    draw.text((36, 28), "车辆插头三维模型 · GB/T 20234.3 图9", fill=(20, 22, 26), font=f1)
    draw.text((36, 70), "空间尺寸包络内名义建模 · 端面 9 触头按图1", fill=(90, 96, 104), font=f2)

    dims = [
        f"侧视：上 ≤50 → {UP:.0f}   下 ≤45 → {DOWN:.0f}   手柄角 ≤75° → {HANDLE_ANG:.0f}°",
        f"正视：宽 ≤80 → {WIDTH:.0f}   顶宽 ≤38 → {TOP_W:.0f}   肩高 36.5   底 ≤R45 → R{R_BOT:.0f}",
        f"前端台阶 1×≤9 → {NOSE_STEP_H:.0f}×{NOSE_STEP_L:.0f}   头部轴向 ≥50 → {HEAD_LEN:.0f}",
        f"端面 φ{FACE_OD:.0f} / 壳 φ{SHELL_OD:.0f} mm",
    ]
    box_y = h - 150
    draw.rounded_rectangle((28, box_y - 12, w - 28, h - 20), radius=12, fill=(255, 255, 255), outline=(210, 214, 218))
    for i, t in enumerate(dims):
        draw.text((44, box_y + i * 28), t, fill=(50, 54, 60), font=f3)

    OUT.mkdir(parents=True, exist_ok=True)
    REF.mkdir(parents=True, exist_ok=True)
    p1 = OUT / "gb_gun_fig9_3d.jpg"
    p2 = REF / "充电枪_图9三维模型.jpg"
    img.save(p1, quality=90, optimize=True)
    img.save(p2, quality=90, optimize=True)
    print("wrote", p1, p1.stat().st_size)


if __name__ == "__main__":
    main()
