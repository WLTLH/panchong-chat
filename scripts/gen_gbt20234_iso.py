# -*- coding: utf-8 -*-
"""Generate GB/T 20234.3 DC coupler perspective schematics (plug + socket).

Coordinate system (mating face toward viewer, lock at +Y):
  origin at PE center, X right, Y up, unit mm.
Layout follows GB/T 20234.3 Fig.1 / Fig.2 contact arrangement.
Structural sizes follow Fig.4 / Fig.5 envelope (face φ65, mount 72×72).
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "connect"
REF = ROOT / "refs" / "国标-直流充电"

# --- GB/T 20234.3 face geometry (mm) ---
FACE_OD = 65.0  # insulating face outer diameter (Fig.4/5)
SHELL_OD = 70.0
BODY_LEN = 42.0
LOCK_W = 12.0
LOCK_H = 6.5

# Contact centers: PE origin, lock +Y (vehicle plug, Fig.1)
# Symmetric layout matching standard 2-3-2-2 rows
CONTACTS = [
    {"key": "DC+", "no": 1, "x": -16.0, "y": 14.5, "hole": 25.4, "pin": 12.0, "kind": "power"},
    {"key": "DC-", "no": 2, "x": 16.0, "y": 14.5, "hole": 25.4, "pin": 12.0, "kind": "power"},
    {"key": "PE", "no": 3, "x": 0.0, "y": 0.0, "hole": 15.6, "pin": 8.0, "kind": "pe"},
    {"key": "S+", "no": 4, "x": -13.5, "y": -15.0, "hole": 10.3, "pin": 3.6, "kind": "sig"},
    {"key": "S-", "no": 5, "x": 13.5, "y": -15.0, "hole": 10.3, "pin": 3.6, "kind": "sig"},
    {"key": "CC1", "no": 6, "x": -20.5, "y": -1.0, "hole": 10.3, "pin": 3.6, "kind": "sig"},
    {"key": "CC2", "no": 7, "x": 20.5, "y": -1.0, "hole": 10.3, "pin": 3.6, "kind": "sig"},
    {"key": "A+", "no": 8, "x": -13.5, "y": -28.0, "hole": 10.3, "pin": 3.6, "kind": "aux"},
    {"key": "A-", "no": 9, "x": 13.5, "y": -28.0, "hole": 10.3, "pin": 3.6, "kind": "aux"},
]

MOUNT_SQ = 72.0
MOUNT_HOLE = 7.0
PANEL_CUT = 79.0


def font(size: int):
    for name in (
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


class IsoCam:
    """Cabinet-ish perspective: face XY + depth along Z into scene."""

    def __init__(self, ox, oy, scale, yaw_deg=38, pitch_deg=22):
        self.ox = ox
        self.oy = oy
        self.scale = scale
        self.yaw = math.radians(yaw_deg)
        self.pitch = math.radians(pitch_deg)

    def project(self, x, y, z):
        # rotate around Y then X
        cy, sy = math.cos(self.yaw), math.sin(self.yaw)
        cp, sp = math.cos(self.pitch), math.sin(self.pitch)
        # model: x right, y up, z out of face toward viewer for plug front
        x1 = x * cy + z * sy
        z1 = -x * sy + z * cy
        y2 = y * cp - z1 * sp
        z2 = y * sp + z1 * cp
        # foreshortening
        px = self.ox + x1 * self.scale
        py = self.oy - y2 * self.scale
        return px, py, z2


def shade(base, k):
    return tuple(max(0, min(255, int(c * k))) for c in base)


def draw_ellipse(draw, cam, x, y, z, rx, ry, fill, outline, width=1, segs=48):
    pts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        px, py, _ = cam.project(x + rx * math.cos(a), y + ry * math.sin(a), z)
        pts.append((px, py))
    draw.polygon(pts, fill=fill, outline=outline)
    if width > 1:
        draw.line(pts + [pts[0]], fill=outline, width=width)


def draw_cylinder_ring(draw, cam, x, y, z0, z1, r, col_side, col_front, outline):
    # side as quad strip (back half first)
    segs = 36
    for i in range(segs):
        a0 = 2 * math.pi * i / segs
        a1 = 2 * math.pi * (i + 1) / segs
        # skip frontmost thin wedges for cleaner look — still draw all for solid body
        p0 = cam.project(x + r * math.cos(a0), y + r * math.sin(a0), z0)
        p1 = cam.project(x + r * math.cos(a1), y + r * math.sin(a1), z0)
        p2 = cam.project(x + r * math.cos(a1), y + r * math.sin(a1), z1)
        p3 = cam.project(x + r * math.cos(a0), y + r * math.sin(a0), z1)
        # lighting by normal x
        nx = math.cos((a0 + a1) * 0.5)
        k = 0.55 + 0.45 * max(0, nx * 0.7 + 0.3)
        draw.polygon([(p0[0], p0[1]), (p1[0], p1[1]), (p2[0], p2[1]), (p3[0], p3[1])], fill=shade(col_side, k))
    draw_ellipse(draw, cam, x, y, z1, r, r, col_front, outline, width=2)


def contacts_for(side: str):
    """side: 'plug' (车辆插头) or 'socket' (车辆插座). Socket is mirror of plug on X."""
    items = []
    for c in CONTACTS:
        x = -c["x"] if side == "socket" else c["x"]
        items.append({**c, "x": x})
    return items


def render_coupler(side: str, w=1100, h=780):
    """Perspective coupler. plug=枪头(插套凹孔), socket=车口(插针凸起)."""
    img = Image.new("RGB", (w, h), (18, 20, 24))
    draw = ImageDraw.Draw(img)
    # subtle vignette grid
    for i in range(0, w, 40):
        draw.line((i, 0, i, h), fill=(28, 30, 34))
    for j in range(0, h, 40):
        draw.line((0, j, w, j), fill=(28, 30, 34))

    cam = IsoCam(ox=w * 0.42, oy=h * 0.52, scale=7.2, yaw_deg=36 if side == "plug" else -36, pitch_deg=24)

    plastic = (55, 58, 62)
    plastic_hi = (78, 82, 88)
    face = (168, 178, 150) if side == "plug" else (150, 160, 168)
    pocket = (28, 30, 32)
    pin = (196, 198, 202)
    outline = (220, 222, 226)
    accent = (7, 193, 96)

    # body cylinder behind face
    z_face = 0.0
    z_back = -BODY_LEN
    draw_cylinder_ring(draw, cam, 0, 0, z_back, z_face - 2, SHELL_OD / 2, plastic, plastic_hi, outline)

    # face disc
    draw_ellipse(draw, cam, 0, 0, z_face, FACE_OD / 2, FACE_OD / 2, face, outline, width=2)

    # lock notch / latch at top
    lw, lh = LOCK_W / 2, LOCK_H
    lock_pts = []
    for lx, ly in [(-lw, FACE_OD / 2 - 1), (lw, FACE_OD / 2 - 1), (lw * 0.7, FACE_OD / 2 + lh), (-lw * 0.7, FACE_OD / 2 + lh)]:
        px, py, _ = cam.project(lx, ly, z_face + 0.2)
        lock_pts.append((px, py))
    draw.polygon(lock_pts, fill=shade(plastic_hi, 1.1), outline=outline)

    # optional flange for socket
    if side == "socket":
        half = MOUNT_SQ / 2 + 8
        flange = []
        for fx, fy in [(-half, -half), (half, -half), (half, half), (-half, half)]:
            px, py, _ = cam.project(fx, fy, z_back - 2)
            flange.append((px, py))
        draw.polygon(flange, fill=shade(plastic, 0.85), outline=outline)
        for mx, my in [(-MOUNT_SQ / 2, -MOUNT_SQ / 2), (MOUNT_SQ / 2, -MOUNT_SQ / 2), (MOUNT_SQ / 2, MOUNT_SQ / 2), (-MOUNT_SQ / 2, MOUNT_SQ / 2)]:
            draw_ellipse(draw, cam, mx, my, z_back - 1.5, MOUNT_HOLE / 2, MOUNT_HOLE / 2, (40, 42, 46), outline)

    # contacts
    for c in contacts_for(side):
        hx, hy = c["x"], c["y"]
        hr = c["hole"] / 2
        pr = c["pin"] / 2
        # pocket ring on face
        draw_ellipse(draw, cam, hx, hy, z_face + 0.3, hr, hr, pocket, outline, width=1)
        draw_ellipse(draw, cam, hx, hy, z_face + 0.3, hr - 1.2, hr - 1.2, shade(pocket, 0.7), None)
        if side == "socket":
            # male pin protruding toward viewer
            tip_z = 8.0 if c["kind"] == "pe" else (6.0 if c["kind"] == "power" else 4.5)
            draw_cylinder_ring(draw, cam, hx, hy, z_face + 0.5, tip_z, pr, pin, shade(pin, 1.15), outline)
        else:
            # female sleeve: short metal ring inside pocket
            draw_ellipse(draw, cam, hx, hy, z_face - 1.5, pr + 0.8, pr + 0.8, shade(pin, 0.9), outline)
            draw_ellipse(draw, cam, hx, hy, z_face - 1.5, pr * 0.45, pr * 0.45, pocket, None)

    # labels with leader lines
    f_title = font(28)
    f_label = font(18)
    f_dim = font(16)
    title = "车辆插头（充电枪）· GB/T 20234.3" if side == "plug" else "车辆插座（充电口）· GB/T 20234.3"
    draw.text((36, 28), title, fill=(235, 237, 240), font=f_title)
    draw.text((36, 68), "透视示意 · 触头布置按图1/图2 · 外形按图4/图5", fill=(160, 168, 176), font=f_dim)

    # right legend
    lx0, ly0 = w - 280, 120
    draw.rounded_rectangle((lx0 - 16, ly0 - 16, w - 24, ly0 + 420), radius=12, fill=(28, 30, 34), outline=(60, 64, 70))
    draw.text((lx0, ly0), "触头编号", fill=accent, font=f_label)
    for i, c in enumerate(sorted(contacts_for(side), key=lambda t: t["no"])):
        yy = ly0 + 36 + i * 36
        draw.text((lx0, yy), f"{c['no']}  {c['key']}", fill=(220, 222, 226), font=f_label)
        # leader to contact
        px, py, _ = cam.project(c["x"], c["y"], z_face + 2)
        draw.line((lx0 - 20, yy + 10, px, py), fill=(90, 140, 110), width=1)

    # dimension callouts
    dims = [
        f"端面 φ{FACE_OD:.0f} mm",
        f"安装孔距 {MOUNT_SQ:.0f}×{MOUNT_SQ:.0f} mm" if side == "socket" else f"壳体参考 φ{SHELL_OD:.0f} mm",
        "DC± 腔 ≈φ25.4  PE≈φ15.6  信号≈φ10.3",
        "耦合顺序: PE→CC2→DC±→A±→S±→CC1",
    ]
    for i, t in enumerate(dims):
        draw.text((36, h - 130 + i * 26), t, fill=(170, 176, 182), font=f_dim)

    # face labels near contacts
    for c in contacts_for(side):
        px, py, _ = cam.project(c["x"], c["y"] + c["hole"] / 2 + 3.5, z_face)
        draw.text((px - 14, py - 10), c["key"], fill=(245, 246, 248), font=f_dim)

    return img


def render_pair(w=1400, h=820):
    """Gun and inlet facing each other in one composition."""
    left = render_coupler("plug", 700, h)
    right = render_coupler("socket", 700, h)
    img = Image.new("RGB", (w, h), (18, 20, 24))
    img.paste(left.crop((0, 0, 700, h)), (0, 0))
    img.paste(right.crop((0, 0, 700, h)), (700, 0))
    draw = ImageDraw.Draw(img)
    draw.line((700, 40, 700, h - 40), fill=(60, 64, 70), width=2)
    f = font(22)
    draw.text((w // 2 - 90, 16), "对接关系（透视）", fill=(7, 193, 96), font=f)
    return img


def write_dim_json():
    import json

    data = {
        "standard": "GB/T 20234.3-2023",
        "ref_figures": ["图1 车辆插头触头布置", "图2 车辆插座触头布置", "图4 车辆插头结构尺寸", "图5 车辆插座结构尺寸"],
        "units": "mm",
        "face_od": FACE_OD,
        "shell_od": SHELL_OD,
        "mount": {"square": MOUNT_SQ, "hole": MOUNT_HOLE, "panel_cutout_nom": PANEL_CUT},
        "contacts_plug": CONTACTS,
        "note": "触头中心坐标以 PE 为原点、锁止方向为 +Y；插座为插头的 X 镜像。腔径为示意标定，产品公差以标准图4/图5为准。",
    }
    REF.mkdir(parents=True, exist_ok=True)
    (REF / "gbt20234_face_dims.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    write_dim_json()
    plug = render_coupler("plug")
    sock = render_coupler("socket")
    pair = render_pair()
    plug_path = OUT / "gb_plug_iso.jpg"
    sock_path = OUT / "gb_socket_iso.jpg"
    pair_path = OUT / "gb_pair_iso.jpg"
    plug.save(plug_path, quality=88, optimize=True)
    sock.save(sock_path, quality=88, optimize=True)
    pair.save(pair_path, quality=86, optimize=True)
    # also copy into refs for browsing
    plug.save(REF / "车辆插头_透视示意.jpg", quality=88)
    sock.save(REF / "车辆插座_透视示意.jpg", quality=88)
    pair.save(REF / "枪口对接_透视示意.jpg", quality=86)
    print("wrote", plug_path, plug_path.stat().st_size)
    print("wrote", sock_path, sock_path.stat().st_size)
    print("wrote", pair_path, pair_path.stat().st_size)


if __name__ == "__main__":
    main()
