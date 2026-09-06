# -*- coding: utf-8 -*-
"""
GB/T 20234.3 engineering gun/port 3D render
Shape: Fig.9 space envelope + Fig.1/2 contacts
Look: Lin Huiyin — rice paper, celadon-grey shell, soft north light
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "connect"
REF = ROOT / "refs" / "国标-直流充电"

UP, DOWN = 48.0, 43.0
W_BODY, W_TOP = 78.0, 36.0
Y_SHOULDER, R_BOT = 36.5, 44.0
STEP_H, STEP_L = 1.0, 8.0
HEAD_LEN, NOSE_LEN = 58.0, 26.0
FACE_OD, SHELL_OD = 65.0, 69.0
HANDLE_LEN, HANDLE_W, HANDLE_T = 100.0, 32.0, 26.0
MOUNT_SQ, MOUNT_HOLE = 72.0, 7.0
FLANGE = 92.0

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

PAL = {
    "paper": (236, 232, 222),
    "ink": (42, 44, 48),
    "ink_soft": (90, 92, 96),
    "shell": (112, 122, 124),       # 青灰
    "shell_hi": (142, 152, 154),
    "face": (176, 186, 172),        # 牙青
    "face_in": (206, 212, 198),
    "pocket": (44, 46, 48),
    "pin": (188, 168, 128),         # 淡金
    "pin_hi": (222, 198, 150),
    "flange": (126, 132, 134),
    "accent": (78, 104, 92),
}


def font(size: int):
    for n in (
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simsun.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
    ):
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            pass
    return ImageFont.load_default()


@dataclass
class Tri:
    v0: np.ndarray
    v1: np.ndarray
    v2: np.ndarray
    color: tuple
    gloss: float = 0.15


def v(x, y, z):
    return np.array([x, y, z], dtype=np.float64)


def add_tri(mesh, a, b, c, color, gloss=0.15):
    mesh.append(Tri(a.copy(), b.copy(), c.copy(), color, gloss))


def add_quad(mesh, a, b, c, d, color, gloss=0.15):
    add_tri(mesh, a, b, c, color, gloss)
    add_tri(mesh, a, c, d, color, gloss)


def cyl(mesh, axis0, axis1, r, color, segs=36, caps=True, gloss=0.2):
    d = axis1 - axis0
    L = np.linalg.norm(d)
    if L < 1e-6:
        return
    z = d / L
    tmp = v(1, 0, 0) if abs(z[0]) < 0.9 else v(0, 1, 0)
    x = np.cross(z, tmp)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    ring0, ring1 = [], []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        off = x * (r * math.cos(a)) + y * (r * math.sin(a))
        ring0.append(axis0 + off)
        ring1.append(axis1 + off)
    for i in range(segs):
        j = (i + 1) % segs
        add_quad(mesh, ring0[i], ring0[j], ring1[j], ring1[i], color, gloss)
    if caps:
        for i in range(segs):
            j = (i + 1) % segs
            add_tri(mesh, axis0, ring0[j], ring0[i], color, gloss * 0.8)
            add_tri(mesh, axis1, ring1[i], ring1[j], color, gloss * 0.8)


def tube(mesh, axis0, axis1, ro, ri, color, segs=28, gloss=0.18):
    d = axis1 - axis0
    L = np.linalg.norm(d)
    if L < 1e-6:
        return
    z = d / L
    tmp = v(1, 0, 0) if abs(z[0]) < 0.9 else v(0, 1, 0)
    x = np.cross(z, tmp)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    for i in range(segs):
        a0 = 2 * math.pi * i / segs
        a1 = 2 * math.pi * (i + 1) / segs
        for rr, flip in ((ro, False), (ri, True)):
            p00 = axis0 + x * (rr * math.cos(a0)) + y * (rr * math.sin(a0))
            p01 = axis0 + x * (rr * math.cos(a1)) + y * (rr * math.sin(a1))
            p10 = axis1 + x * (rr * math.cos(a0)) + y * (rr * math.sin(a0))
            p11 = axis1 + x * (rr * math.cos(a1)) + y * (rr * math.sin(a1))
            if flip:
                add_quad(mesh, p00, p10, p11, p01, color, gloss)
            else:
                add_quad(mesh, p00, p01, p11, p10, color, gloss)


def front_profile(n_arc=28):
    hw, tw = W_BODY * 0.5, W_TOP * 0.5
    y_join = -math.sqrt(max(0.0, R_BOT * R_BOT - hw * hw))
    pts = [
        (y_join, hw),
        (Y_SHOULDER, hw),
        (UP, tw),
        (UP, -tw),
        (Y_SHOULDER, -hw),
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


def extrude_profile(mesh, profile, x0, x1, color, gloss=0.12):
    n = len(profile)
    for i in range(n):
        y0, z0 = profile[i]
        y1, z1 = profile[(i + 1) % n]
        add_quad(
            mesh,
            v(x0, y0, z0),
            v(x1, y0, z0),
            v(x1, y1, z1),
            v(x0, y1, z1),
            color,
            gloss,
        )
    cy = sum(p[0] for p in profile) / n
    cz = sum(p[1] for p in profile) / n
    c0, c1 = v(x0, cy, cz), v(x1, cy, cz)
    for i in range(n):
        y0, z0 = profile[i]
        y1, z1 = profile[(i + 1) % n]
        add_tri(mesh, c0, v(x0, y1, z1), v(x0, y0, z0), color, gloss * 0.7)
        add_tri(mesh, c1, v(x1, y0, z0), v(x1, y1, z1), color, gloss * 0.7)


def box(mesh, cx, cy, cz, sx, sy, sz, color, gloss=0.12):
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    p = [
        v(cx - hx, cy - hy, cz - hz),
        v(cx + hx, cy - hy, cz - hz),
        v(cx + hx, cy + hy, cz - hz),
        v(cx - hx, cy + hy, cz - hz),
        v(cx - hx, cy - hy, cz + hz),
        v(cx + hx, cy - hy, cz + hz),
        v(cx + hx, cy + hy, cz + hz),
        v(cx - hx, cy + hy, cz + hz),
    ]
    faces = [
        (0, 1, 2, 3),
        (5, 4, 7, 6),
        (4, 0, 3, 7),
        (1, 5, 6, 2),
        (3, 2, 6, 7),
        (4, 5, 1, 0),
    ]
    for a, b, c, d in faces:
        add_quad(mesh, p[a], p[b], p[c], p[d], color, gloss)


def transform(mesh, mat):
    for t in mesh:
        for attr in ("v0", "v1", "v2"):
            p = getattr(t, attr)
            h = np.array([p[0], p[1], p[2], 1.0])
            setattr(t, attr, (mat @ h)[:3])


def mat_translate(x, y, z):
    m = np.eye(4)
    m[0, 3] = x
    m[1, 3] = y
    m[2, 3] = z
    return m


def mat_rotate_y(rad):
    c, s = math.cos(rad), math.sin(rad)
    m = np.eye(4)
    m[0, 0] = c
    m[0, 2] = s
    m[2, 0] = -s
    m[2, 2] = c
    return m


def build_gun():
    mesh = []
    shell, shell_hi = PAL["shell"], PAL["shell_hi"]
    face_c, pocket, pin = PAL["face"], PAL["pocket"], PAL["pin"]

    prof = front_profile()
    x_head0 = NOSE_LEN * 0.55
    x_head1 = NOSE_LEN + HEAD_LEN
    extrude_profile(mesh, prof, x_head0, x_head1, shell, 0.10)
    box(
        mesh,
        STEP_L * 0.5,
        UP - STEP_H * 0.5 - 0.3,
        0,
        STEP_L,
        STEP_H + 0.6,
        W_TOP + 2,
        shell_hi,
        0.08,
    )
    # nose shell (open toward face — no front cap covering contacts)
    cyl(mesh, v(2.5, 0, 0), v(NOSE_LEN, 0, 0), SHELL_OD * 0.5, shell_hi, 48, False, 0.18)
    cyl(mesh, v(NOSE_LEN - 1, 0, 0), v(NOSE_LEN, 0, 0), SHELL_OD * 0.5, shell_hi, 36, True, 0.14)
    # face plate as annulus + back disk (holes cut by overlaying pocket wells)
    tube(mesh, v(0.0, 0, 0), v(2.4, 0, 0), FACE_OD * 0.5, FACE_OD * 0.5 - 1.2, face_c, 48, 0.10)
    tube(mesh, v(0.0, 0, 0), v(2.4, 0, 0), SHELL_OD * 0.5 + 0.2, FACE_OD * 0.5, shell, 40, 0.12)
    # face back plane (behind pockets)
    cyl(mesh, v(11.5, 0, 0), v(12.5, 0, 0), FACE_OD * 0.5 - 0.5, PAL["face_in"], 40, True, 0.06)
    box(mesh, 5, FACE_OD * 0.5 + 2.2, 0, 12, 5.5, 9, PAL["pin_hi"], 0.25)

    # handle: ~75 deg to horizontal, solid block
    root = v(NOSE_LEN + HEAD_LEN - 8, -8, 0)
    direction = v(math.sin(math.radians(15)), -math.cos(math.radians(15)), 0)
    direction /= np.linalg.norm(direction)
    z_axis = direction
    x_axis = np.cross(z_axis, v(0, 0, 1))
    x_axis /= np.linalg.norm(x_axis)
    y_axis = np.cross(z_axis, x_axis)
    tip = root + z_axis * HANDLE_LEN
    hw, ht = HANDLE_W * 0.5, HANDLE_T * 0.5
    corners_r = [
        root + x_axis * (a * ht) + y_axis * (b * hw)
        for a, b in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ]
    corners_t = [
        tip + x_axis * (a * ht * 0.92) + y_axis * (b * hw * 0.92)
        for a, b in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ]
    for i in range(4):
        j = (i + 1) % 4
        add_quad(mesh, corners_r[i], corners_r[j], corners_t[j], corners_t[i], shell, 0.11)
    add_quad(mesh, corners_r[0], corners_r[1], corners_r[2], corners_r[3], shell_hi, 0.1)
    add_quad(mesh, corners_t[0], corners_t[3], corners_t[2], corners_t[1], shell_hi, 0.1)
    box(mesh, root[0] - 2, root[1] + 2, 0, 28, 20, HANDLE_W + 6, shell_hi, 0.1)

    for name, cx, cy, hole, pin_d in CONTACTS:
        fy, fz = cy, cx
        # well wall from face into body
        tube(mesh, v(0.6, fy, fz), v(11.8, fy, fz), hole * 0.5, hole * 0.5 - 0.9, pocket, 18, 0.06)
        # well floor
        cyl(mesh, v(11.0, fy, fz), v(11.8, fy, fz), hole * 0.5 - 0.2, pocket, 16, True, 0.05)
        # metal sleeve
        tube(mesh, v(1.5, fy, fz), v(6.0, fy, fz), pin_d * 0.5 + 1.0, pin_d * 0.4, pin, 16, 0.38)
        # face rim highlight
        tube(
            mesh,
            v(0.2, fy, fz),
            v(1.0, fy, fz),
            hole * 0.5 + 0.45,
            hole * 0.5 - 0.15,
            PAL["face_in"],
            18,
            0.12,
        )
    return mesh


def build_inlet():
    mesh = []
    shell, flange_c = PAL["shell"], PAL["flange"]
    face_c, pin, pin_hi = PAL["face"], PAL["pin"], PAL["pin_hi"]

    box(mesh, -18, 0, 0, 8, FLANGE, FLANGE, flange_c, 0.08)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(
                mesh,
                v(-22, sy * MOUNT_SQ * 0.5, sx * MOUNT_SQ * 0.5),
                v(-14, sy * MOUNT_SQ * 0.5, sx * MOUNT_SQ * 0.5),
                MOUNT_HOLE * 0.5,
                PAL["pocket"],
                14,
                True,
                0.05,
            )
    cyl(mesh, v(-14, 0, 0), v(8, 0, 0), SHELL_OD * 0.5 + 1, shell, 44, True, 0.14)
    cyl(mesh, v(7.5, 0, 0), v(9.5, 0, 0), FACE_OD * 0.5, face_c, 44, True, 0.08)
    box(mesh, 8, FACE_OD * 0.5 + 1, 0, 6, 4, 11, PAL["pocket"], 0.05)

    for name, cx, cy, hole, pin_d in CONTACTS:
        fz, fy = -cx, cy
        cyl(mesh, v(2, fy, fz), v(9, fy, fz), hole * 0.5, PAL["pocket"], 18, True, 0.05)
        tip = 18.0 if name == "PE" else (15.0 if name.startswith("DC") else 12.0)
        cyl(
            mesh,
            v(8.5, fy, fz),
            v(8.5 + tip, fy, fz),
            pin_d * 0.5,
            pin_hi if name == "PE" else pin,
            16,
            True,
            0.4,
        )
        cyl(mesh, v(8.2, fy, fz), v(9.2, fy, fz), pin_d * 0.5 + 0.8, pin, 14, True, 0.25)
    return mesh


class Camera:
    def __init__(self, eye, target, up=None, fov=38, w=1200, h=860):
        self.eye = eye.astype(np.float64)
        self.target = target.astype(np.float64)
        self.up = (up if up is not None else v(0, 1, 0)).astype(np.float64)
        self.fov = math.radians(fov)
        self.w, self.h = w, h
        f = self.target - self.eye
        f /= np.linalg.norm(f)
        s = np.cross(f, self.up)
        s /= np.linalg.norm(s)
        u = np.cross(s, f)
        self.f, self.s, self.u = f, s, u
        self.focal = 0.5 * h / math.tan(self.fov * 0.5)

    def project(self, p):
        d = p - self.eye
        x = np.dot(d, self.s)
        y = np.dot(d, self.u)
        z = np.dot(d, self.f)
        if z < 1.0:
            return None
        px = self.w * 0.5 + self.focal * x / z
        py = self.h * 0.5 - self.focal * y / z
        return px, py, z


def render(mesh, cam, bg, light_dir=None, ambient=0.34):
    w, h = cam.w, cam.h
    rgb = np.zeros((h, w, 3), dtype=np.float64)
    rgb[:, :] = np.array(bg, dtype=np.float64)
    noise = np.random.default_rng(7).normal(0, 2.0, (h, w, 1))
    rgb = np.clip(rgb + noise, 0, 255)
    zbuf = np.full((h, w), 1e18, dtype=np.float64)

    if light_dir is None:
        light_dir = v(-0.4, 0.82, 0.4)
    light_dir = light_dir / np.linalg.norm(light_dir)
    fill = v(0.45, 0.25, -0.4)
    fill /= np.linalg.norm(fill)

    for tri in mesh:
        p0 = cam.project(tri.v0)
        p1 = cam.project(tri.v1)
        p2 = cam.project(tri.v2)
        if p0 is None or p1 is None or p2 is None:
            continue
        n = np.cross(tri.v1 - tri.v0, tri.v2 - tri.v0)
        nn = np.linalg.norm(n)
        if nn < 1e-9:
            continue
        n /= nn
        view = cam.eye - (tri.v0 + tri.v1 + tri.v2) / 3
        if np.dot(n, view) <= 0:
            continue
        nd = max(0.0, np.dot(n, light_dir))
        nf = max(0.0, np.dot(n, fill))
        half = light_dir + view / (np.linalg.norm(view) + 1e-9)
        half /= np.linalg.norm(half) + 1e-9
        spec = (max(0.0, np.dot(n, half)) ** 48) * tri.gloss
        shade = ambient + 0.52 * nd + 0.18 * nf + spec
        col = np.clip(np.array(tri.color, dtype=np.float64) * shade, 0, 255)

        xs = np.array([p0[0], p1[0], p2[0]])
        ys = np.array([p0[1], p1[1], p2[1]])
        zs = np.array([p0[2], p1[2], p2[2]])
        minx, maxx = max(0, int(xs.min())), min(w - 1, int(xs.max()) + 1)
        miny, maxy = max(0, int(ys.min())), min(h - 1, int(ys.max()) + 1)
        if minx >= maxx or miny >= maxy:
            continue
        area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])
        if abs(area) < 1e-6:
            continue
        sign = -1.0 if area < 0 else 1.0
        area_s = abs(area)
        XX, YY = np.meshgrid(np.arange(minx, maxx + 1), np.arange(miny, maxy + 1))
        w0 = sign * ((p1[0] - XX) * (p2[1] - YY) - (p2[0] - XX) * (p1[1] - YY))
        w1 = sign * ((p2[0] - XX) * (p0[1] - YY) - (p0[0] - XX) * (p2[1] - YY))
        w2 = sign * ((p0[0] - XX) * (p1[1] - YY) - (p1[0] - XX) * (p0[1] - YY))
        mask = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not mask.any():
            continue
        z = (w0 * zs[0] + w1 * zs[1] + w2 * zs[2]) / area_s
        z_slice = zbuf[miny : maxy + 1, minx : maxx + 1]
        closer = mask & (z < z_slice)
        if not closer.any():
            continue
        z_slice[closer] = z[closer]
        rgb[miny : maxy + 1, minx : maxx + 1][closer] = col

    img = Image.fromarray(rgb.astype(np.uint8), "RGB")
    return img.filter(ImageFilter.SMOOTH_MORE)


def paper_backdrop(w, h):
    rng = np.random.default_rng(3)
    base = np.array(PAL["paper"], dtype=np.float64)
    arr = np.zeros((h, w, 3), dtype=np.float64)
    for y in range(h):
        arr[y, :] = base + rng.normal(0, 1.6, 3) + (y / h) * np.array([-4, -3, -2])
    yy, xx = np.mgrid[0:h, 0:w]
    vignette = 1 - 0.12 * (((xx - w * 0.5) / w) ** 2 + ((yy - h * 0.45) / h) ** 2)
    arr *= vignette[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def draw_annotations(img, title, lines):
    draw = ImageDraw.Draw(img)
    w, h = img.size
    f1, f2, f3 = font(34), font(20), font(17)
    draw.text((48, 40), title, fill=PAL["ink"], font=f1)
    draw.line((48, 88, 300, 88), fill=PAL["accent"], width=2)
    card_h = 36 + 28 * len(lines)
    card = (40, h - 40 - card_h, w - 40, h - 28)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(card, radius=14, fill=(248, 245, 238, 215), outline=(180, 176, 168, 220))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)
    draw.text(
        (60, card[1] + 12),
        "GB/T 20234.3  |  engineering schematic  |  tolerances per official figures",
        fill=PAL["accent"],
        font=f2,
    )
    for i, t in enumerate(lines):
        draw.text((60, card[1] + 42 + i * 26), t, fill=PAL["ink_soft"], font=f3)
    return img


def compose(img, title, lines):
    w, h = img.size
    paper = paper_backdrop(w, h)
    out = Image.blend(paper, img, 0.90)
    out = Image.blend(out, Image.new("RGB", (w, h), PAL["paper"]), 0.06)
    return draw_annotations(out, title, lines)


def render_scene(kind: str):
    w, h = 1200, 860
    if kind == "gun":
        mesh = build_gun()
        # match Fig.9 isometric: face left-front, handle down-back
        eye, target = v(-95, 70, 150), v(35, -25, 0)
        title = "车辆插头  ·  充电枪"
        lines = [
            "外形按图9：屋形截面 ≤80，上≤50 / 下≤45，底≤R45，手柄≤75°",
            "枪嘴 φ69 / 端面 φ65；台阶 1×8；头部长 58（≥50）",
            "端面 9 触头按图1（凹孔套筒）：DC± PE CC1/CC2 S± A±",
        ]
    elif kind == "inlet":
        mesh = build_inlet()
        eye, target = v(130, 55, 140), v(8, 0, 0)
        title = "车辆插座  ·  充电口"
        lines = [
            "法兰安装 72×72、4-φ7；筒体与枪嘴几何配合",
            "端面 9 触头按图2（插头 X 镜像）；凸针长度按耦合顺序分级",
            "耦合：PE → CC2 → DC± → A± → S± → CC1",
        ]
    else:
        gun, inlet = build_gun(), build_inlet()
        # inlet left: pins +X; gun right: face looks -X (no 180 flip)
        transform(inlet, mat_translate(-55, 0, 0))
        transform(gun, mat_translate(85, 0, 0))
        mesh = inlet + gun
        eye, target = v(20, 90, 230), v(20, -18, 0)
        title = "枪 / 口 对接"
        lines = [
            "左：车辆插座（充电口）　　右：车辆插头（充电枪）",
            "几何：GB/T 20234.3 图9 空间尺寸 + 图1/图2 触头布置",
            "表达：宣纸底 · 青灰壳体 · 淡金触头 · 软北光 · 少装饰",
        ]

    cam = Camera(eye, target, fov=36, w=w, h=h)
    img = render(mesh, cam, PAL["paper"])
    return compose(img, title, lines)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REF.mkdir(parents=True, exist_ok=True)
    jobs = {
        "gun": ("gb_gun_lin.jpg", "充电枪_工程三维_林徽因质感.jpg"),
        "inlet": ("gb_inlet_lin.jpg", "充电口_工程三维_林徽因质感.jpg"),
        "pair": ("gb_pair_lin.jpg", "枪口对接_工程三维_林徽因质感.jpg"),
    }
    for kind, (a, b) in jobs.items():
        print("rendering", kind, flush=True)
        img = render_scene(kind)
        p1, p2 = OUT / a, REF / b
        img.save(p1, quality=92, optimize=True)
        img.save(p2, quality=92, optimize=True)
        print(" ", p1.name, p1.stat().st_size, flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
