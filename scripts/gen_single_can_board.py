#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate readable PanchongCAN-S1 board / schematic PNGs."""
from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "assets", "circuit")
FONT = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"

NAVY = (15, 32, 56)
INK = (26, 32, 44)
MUTED = (90, 100, 112)
GREEN = (7, 193, 96)
ORANGE = (232, 140, 48)
PURPLE = (124, 92, 232)
BLUE = (47, 107, 255)
LINE = (210, 216, 224)
CARD = (255, 255, 255)
BG = (245, 246, 248)
GUN = (255, 247, 230)
MCU = (232, 240, 255)
PWR = (232, 248, 239)
CAN = (237, 233, 254)
PAD = (255, 243, 224)


def font(sz: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, sz)


def rounded(draw: ImageDraw.ImageDraw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def text(draw, xy, s, sz, fill=INK, anchor="lt"):
    draw.text(xy, s, font=font(sz), fill=fill, anchor=anchor)


def wrap_text(draw, xy, s, sz, fill, max_w):
    f = font(sz)
    x, y = xy
    line = ""
    for ch in s:
        trial = line + ch
        if f.getlength(trial) <= max_w:
            line = trial
        else:
            draw.text((x, y), line, font=f, fill=fill)
            y += sz + 4
            line = ch
    if line:
        draw.text((x, y), line, font=f, fill=fill)
        y += sz + 4
    return y


def chip(draw, box, title, lines, fill, title_c=INK):
    rounded(draw, box, 10, fill, (190, 196, 206), 1)
    x0, y0, x1, y1 = box
    text(draw, (x0 + 12, y0 + 10), title, 18, title_c)
    y = y0 + 36
    for ln in lines:
        text(draw, (x0 + 12, y), ln, 15, MUTED)
        y += 22


def arrow_row(draw, items, y, x0=40, gap=18):
    x = x0
    h = 54
    boxes = []
    for label, fill in items:
        w = max(120, int(font(16).getlength(label) + 28))
        box = (x, y, x + w, y + h)
        rounded(draw, box, 10, fill, (190, 196, 206), 1)
        text(draw, (x + w / 2, y + h / 2), label, 16, INK, "mm")
        boxes.append(box)
        x = x + w + gap
    for i in range(len(boxes) - 1):
        a = boxes[i][2]
        b = boxes[i + 1][0]
        mid = y + h / 2
        draw.line((a + 2, mid, b - 6, mid), fill=MUTED, width=2)
        draw.polygon([(b - 6, mid - 5), (b, mid), (b - 6, mid + 5)], fill=MUTED)
    return boxes


def gen_overview() -> Image.Image:
    W, H = 1400, 980
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 88), fill=NAVY)
    text(d, (40, 22), "判充 PanchongCAN-S1 · 单路板总览", 30, (255, 255, 255))
    text(d, (40, 58), "45×28 mm  ·  ESP32-C3 TWAI×1 + HVD230×1  ·  出线二选一（枪 S+/S- 或 OBD 6/14）", 16, (168, 190, 210))

    # board card
    rounded(d, (28, 110, 900, 620), 16, CARD, LINE, 1)
    text(d, (48, 126), "板框俯视（元件面）  X=45 mm →   Y=28 mm ↑", 18, INK)
    text(d, (48, 152), "与双路同框同孔，右侧不再放 MCP2515", 14, MUTED)

    # physical board  45*16 = 720, 28*16 = 448
    ox, oy, sc = 70, 180, 16
    bw, bh = 45 * sc, 28 * sc
    rounded(d, (ox, oy, ox + bw, oy + bh), 8, (250, 251, 253), (40, 55, 75), 2)

    def mm(x, y):
        return ox + x * sc, oy + (28 - y) * sc

    def mmbox(x, y, w, h):
        x0, y1 = mm(x, y)
        x1, y0 = mm(x + w, y + h)
        return (x0, y0, x1, y1)

    # pads
    rounded(d, mmbox(0.4, 4, 5.2, 20), 6, PAD, (230, 180, 110), 1)
    text(d, mm(3.0, 22.5), "焊盘区", 13, (140, 90, 20), "mm")
    for i, (lab, yy) in enumerate((("16 VIN", 20), ("GND", 15.5), ("6 H", 11), ("14 L", 6.5))):
        rounded(d, mmbox(0.8, yy - 1.4, 4.4, 2.8), 3, (255, 255, 255), (200, 150, 80), 1)
        text(d, mm(3.0, yy), lab, 12, INK, "mm")

    # power + mcu
    rounded(d, mmbox(6.2, 7.5, 20.5, 18.5), 8, MCU, (160, 185, 220), 1)
    text(d, mm(16.4, 24.2), "电源 + ESP32-C3-MINI-1", 14, BLUE, "mm")
    text(d, mm(16.4, 21.6), "Buck 5V → LDO 3.3V", 12, MUTED, "mm")
    text(d, mm(16.4, 19.2), "TWAI TX=GPIO7  RX=GPIO6", 12, INK, "mm")
    text(d, mm(16.4, 16.8), "USB D+=19  D-=18", 12, INK, "mm")
    text(d, mm(16.4, 14.4), "LED=GPIO10  BOOT=GPIO9", 12, INK, "mm")
    text(d, mm(16.4, 12.0), "天线朝 +Y，Keepout ≥4 mm", 12, MUTED, "mm")
    text(d, mm(16.4, 9.6), "无 SPI / 无 MCP2515", 12, MUTED, "mm")

    # usb
    rounded(d, mmbox(18, 26.2, 9, 1.8), 3, (230, 236, 244), (90, 110, 140), 1)
    text(d, mm(22.5, 27.1), "USB-C 板边", 11, MUTED, "mm")

    # can
    rounded(d, mmbox(27.4, 8, 16.8, 18), 8, CAN, (180, 168, 220), 1)
    text(d, mm(35.8, 24.2), "单路 CAN", 14, PURPLE, "mm")
    text(d, mm(35.8, 21.4), "HVD230 ×1", 13, INK, "mm")
    text(d, mm(35.8, 18.8), "无晶振 / 无第二路", 12, MUTED, "mm")
    text(d, mm(35.8, 16.2), "JP1 跳线 枪 / 车", 12, INK, "mm")
    text(d, mm(35.8, 13.6), "120Ω 默认不贴", 12, MUTED, "mm")
    text(d, mm(35.8, 11.0), "PESD1CAN 保护", 12, MUTED, "mm")

    # output
    rounded(d, mmbox(6.2, 1.2, 38, 5.6), 8, GUN, (230, 190, 130), 1)
    text(d, mm(25.2, 5.2), "出线（二选一，同一收发器）", 14, ORANGE, "mm")
    text(d, mm(25.2, 3.2), "A) JST-PH → 枪 S+ / S-     或     B) 焊盘 → OBD 6 / 14", 13, INK, "mm")
    text(d, mm(25.2, 1.6), "线束只接一端，勿同时接两条总线", 12, MUTED, "mm")

    # holes
    for hx, hy in ((2, 2), (43, 2), (2, 26), (43, 26)):
        cx, cy = mm(hx, hy)
        d.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), outline=(40, 55, 75), width=2)

    # right column
    rounded(d, (920, 110, 1372, 620), 16, CARD, LINE, 1)
    text(d, (944, 128), "相对双路 / 核对", 18, INK)
    deletes = [
        "删 MCP2515 + 8 MHz",
        "删第二颗 HVD230",
        "删 SPI（GPIO4/2/10）",
        "删 CH1 到 OBD 6/14 的常接",
    ]
    keeps = [
        "保留 TWAI GPIO6/7",
        "保留 USB-C GPIO19/18",
        "保留 Buck FB 51k/10k",
        "保留 OBD-16 取电 + BLE",
        "保留 listen-only、同壳同孔",
        "BOM 更短，C3 脚即可跑",
    ]
    y = 168
    for s in deletes:
        rounded(d, (944, y, 1348, y + 36), 8, (255, 236, 236), (240, 180, 180), 1)
        text(d, (958, y + 18), "删  " + s, 15, (176, 50, 50), "lm")
        y += 44
    for s in keeps:
        rounded(d, (944, y, 1348, y + 36), 8, PWR, (160, 210, 180), 1)
        text(d, (958, y + 18), "留  " + s, 15, (20, 120, 70), "lm")
        y += 44

    # bottom chain
    rounded(d, (28, 640, 1372, 950), 16, CARD, LINE, 1)
    text(d, (48, 658), "电源与信号路径", 18, INK)
    arrow_row(
        d,
        [
            ("OBD-16  12V", PAD),
            ("保险 + 防反 + TVS", GUN),
            ("Buck 5V", PWR),
            ("LDO 3.3V", PWR),
            ("ESP32-C3  BLE+TWAI", MCU),
            ("HVD230 ×1", CAN),
        ],
        700,
        48,
        16,
    )
    arrow_row(
        d,
        [
            ("JP1 跳线二选一", GUN),
            ("枪 S+ / S-  （默认，27930）", GUN),
            ("或 OBD 6 / 14  （整车 CAN）", CAN),
            ("手机 BLE  PanchongCAN-S1", MCU),
        ],
        780,
        48,
        22,
    )
    text(d, (48, 860), "固件：hardware/single/firmware/panchong_s1.ino    物料：BOM.csv    网络：netlist.txt    引脚：pinmap.md", 15, MUTED)
    wrap_text(
        d,
        (48, 890),
        "注意：听总线用 listen-only，120Ω 默认不焊；USB 只刷机。高压 DC+/DC- 不要上板。非隔离地=车身 12V 地，夹枪线前确认 S- 对 PE 无明显电位。",
        15,
        (140, 90, 30),
        1280,
    )
    return im


def gen_schematic() -> Image.Image:
    W, H = 1400, 980
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 88), fill=NAVY)
    text(d, (40, 22), "判充 PanchongCAN-S1 · 原理图分块", 30, (255, 255, 255))
    text(d, (40, 58), "打样对照用，不是 CAD 网表替代件。完整网络见 hardware/single/netlist.txt", 16, (168, 190, 210))

    chip(
        d,
        (40, 120, 430, 360),
        "1  电源",
        [
            "PAD_16 → F1 1A → D1 SS34",
            "TVS SMAJ24A（12V 车）",
            "U5 MP2315  → +5V",
            "  FB：R8 51k / R9 10k",
            "U6 AP2112K-3.3 → 3V3",
            "C：10u/50V、22u/16V、10u×2",
        ],
        PWR,
        (20, 120, 70),
    )
    chip(
        d,
        (460, 120, 900, 360),
        "2  MCU  ESP32-C3-MINI-1",
        [
            "3V3 / EN 10k 上拉 + RST",
            "GPIO7 → TWAI TX → HVD230 TXD",
            "GPIO6 ← TWAI RX ← HVD230 RXD",
            "GPIO19/18 = USB D+ / D−",
            "GPIO10 LED（亮=低）  GPIO9 BOOT",
            "GPIO8 10k 上拉（strapping）",
        ],
        MCU,
        BLUE,
    )
    chip(
        d,
        (930, 120, 1360, 360),
        "3  CAN  SN65HVD230",
        [
            "VCC=3V3  Rs=0Ω→GND",
            "Vref 10nF→GND",
            "CANH/L → PESD1CAN",
            "120Ω = DNP",
            "只听不发（TWAI listen-only）",
            "默认 250 kbit/s",
        ],
        CAN,
        PURPLE,
    )
    chip(
        d,
        (40, 390, 680, 640),
        "4  出线 JP1（2×3）",
        [
            "1–2 + 4–5  听充电：JST → 枪 S+ / S-",
            "2–3 + 5–6  听整车：焊盘 → OBD 6 / 14",
            "两组不可同时短接",
            "S+ = CANH    S- = CANL",
            "OBD-16 只供电，不提供 27930",
        ],
        GUN,
        ORANGE,
    )
    chip(
        d,
        (710, 390, 1360, 640),
        "5  蓝牙 / 小程序",
        [
            "广播名  PanchongCAN-S1",
            "NUS  6E400001 / 002 写 / 003 通知",
            "连上后写 listen",
            "行格式  12.345 1826F456 01 01 00",
            "与 pages/dcflow + utils/ble_session 对齐",
        ],
        MCU,
        BLUE,
    )

    rounded(d, (40, 670, 1360, 950), 16, CARD, LINE, 1)
    text(d, (60, 690), "接线核对（现场）", 18, INK)
    rows = [
        ("盒 ← 车 OBD", "16 = VIN，4 或 5 = GND。不要把 6/14 和枪线同时接到 JP1 两侧。"),
        ("盒 ← 充电枪", "默认夹 S+ / S-。DC+ / DC- / A+ 禁止上板。"),
        ("盒 → 手机", "蓝牙名含 Panchong 或 判充；小程序连接页点连接后自动 listen。"),
        ("听整车时", "改 JP1 到「车」，S+ 线从枪上拿开，改接到 OBD 6/14。"),
        ("终端电阻", "Rterm 120Ω 默认不焊。只有总线两端都空时才考虑补焊。"),
    ]
    y = 728
    for k, v in rows:
        rounded(d, (60, y, 220, y + 36), 8, PWR, None, 0)
        text(d, (140, y + 18), k, 14, (20, 120, 70), "mm")
        text(d, (236, y + 18), v, 15, INK, "lm")
        y += 42
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    o = gen_overview()
    s = gen_schematic()
    op = os.path.join(OUT, "single_overview.png")
    sp = os.path.join(OUT, "single_schematic.png")
    o.save(op, "PNG", optimize=True)
    s.save(sp, "PNG", optimize=True)
    print("wrote", op, o.size)
    print("wrote", sp, s.size)


if __name__ == "__main__":
    main()
