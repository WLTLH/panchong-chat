# -*- coding: utf-8 -*-
"""按用户国标端面标注重绘：外圆 φ63，内宽 56.5 / R10，行距 15.5。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

MM = 12.0  # 1 mm = 12 px，更大更清晰
MARGIN = 36  # mm
FACE = 63.0
PAD = FACE + MARGIN * 2
W = H = int(PAD * MM)
CX = CY = W / 2


def xy(x_mm, y_mm):
    """PE/中心为原点，+Y 向上（锁止方向）。"""
    return CX + x_mm * MM, CY - y_mm * MM


def main():
    img = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("msyh.ttc", 22)
        font_sm = ImageFont.truetype("msyh.ttc", 16)
    except OSError:
        font = ImageFont.load_default()
        font_sm = font

    # —— 中心线 A / 竖轴 ——
    d.line([xy(-38, 0), xy(38, 0)], fill=(170, 170, 170), width=1)
    d.line([xy(0, -38), xy(0, 38)], fill=(170, 170, 170), width=1)

    # —— 外轮廓：φ63 圆 + 顶部削平 ——
    R = FACE / 2  # 31.5
    # 顶部平台高度：锁止键区域，约 y = +R - 少量
    flat_y = 28.0  # 顶部削平线相对中心（看原图约在圆顶下方）
    # 画完整圆
    d.ellipse([xy(-R, R), xy(R, -R)], outline=(15, 15, 15), width=3)
    # 顶部削平：用白矩形盖住圆顶再画平台与锁止
    # 削平线 y = flat_y
    x_flat = math.sqrt(max(0, R * R - flat_y * flat_y))
    d.rectangle([xy(-x_flat - 1, R + 2), xy(x_flat + 1, flat_y)], fill=(255, 255, 255))
    # 重画圆弧下半与两侧（用多边形近似顶部平台）
    d.arc([xy(-R, R), xy(R, -R)], start=0, end=180, fill=(15, 15, 15), width=3)
    # 平台线
    d.line([xy(-x_flat, flat_y), xy(x_flat, flat_y)], fill=(15, 15, 15), width=3)
    # 两侧竖边接到圆弧
    # 锁止凸台：外宽 14，内宽 10.15，在平台上方
    tab_out = 14.0 / 2
    tab_in = 10.15 / 2
    tab_h = 4.5
    d.rectangle([xy(-tab_out, flat_y + tab_h), xy(tab_out, flat_y)], outline=(15, 15, 15), width=2)
    d.rectangle([xy(-tab_in, flat_y + tab_h - 0.8), xy(tab_in, flat_y + 0.6)], outline=(15, 15, 15), width=2)

    # —— 内腔：宽 56.5，角 R10（圆角矩形，非同心圆）——
    half_w = 56.5 / 2  # 28.25
    # 内腔高度：下到约 -28，上到接近平台内侧
    y_top = flat_y - 3.5
    y_bot = -28.5
    rr = 10.0
    # 圆角矩形路径
    def rounded_rect(x0, y0, x1, y1, r, width=2):
        # y0 top, y1 bottom in mm coords (+Y up)
        pts = []
        # 用 PIL rounded_rectangle：注意图像坐标
        left, top = xy(x0, y0)
        right, bottom = xy(x1, y1)
        # xy 把 +Y 变成向上，所以 top 的像素 y 更小
        box = [min(left, right), min(top, bottom), max(left, right), max(top, bottom)]
        d.rounded_rectangle(box, radius=r * MM, outline=(15, 15, 15), width=width)

    rounded_rect(-half_w, y_top, half_w, y_bot, rr, width=2)

    # —— 触头（按行距标注）——
    def hole(x, y, od, id_=None, w=2):
        px, py = xy(x, y)
        hr = od / 2 * MM
        d.ellipse([px - hr, py - hr, px + hr, py + hr], outline=(10, 10, 10), width=w)
        if id_ is None:
            id_ = od * 0.35
        ir = id_ / 2 * MM
        d.ellipse([px - ir, py - ir, px + ir, py + ir], outline=(70, 70, 70), width=1)

    # 上排 E y=+15.5：三孔（中等）
    for x in (-13.5, 0.0, 13.5):
        hole(x, 15.5, 9.8, 3.2)
    # 中排：两大孔（略偏下更贴近实物，仍以 A 为几何参考）
    # 中心距取与下排接近的 28.5
    hole(-14.25, -1.5, 14.5, 6.0, w=3)
    hole(14.25, -1.5, 14.5, 6.0, w=3)
    # 中心小孔在 A 上
    hole(0.0, 0.0, 6.5, 2.5)
    # 下排 G y=-15.5：两孔，中心距 28.7
    hole(-14.35, -15.5, 9.8, 3.2)
    hole(14.35, -15.5, 9.8, 3.2)

    # —— 标注 ——
    d.text((CX, 22), "单位为毫米", fill=(0, 0, 0), font=font_sm, anchor="mt")
    d.text(xy(24, 30), "φ63±0.1", fill=(0, 0, 0), font=font)
    d.text(xy(-34, 15.5), "E", fill=(0, 0, 0), font=font, anchor="rm")
    d.text(xy(-34, 0), "A", fill=(0, 0, 0), font=font, anchor="rm")
    d.text(xy(-34, -15.5), "G", fill=(0, 0, 0), font=font, anchor="rm")
    # 竖直尺寸 15.5
    d.line([xy(-30, 0), xy(-30, 15.5)], fill=(0, 0, 0), width=1)
    d.line([xy(-31.2, 0), xy(-28.8, 0)], fill=(0, 0, 0), width=1)
    d.line([xy(-31.2, 15.5), xy(-28.8, 15.5)], fill=(0, 0, 0), width=1)
    d.text(xy(-31.5, 7.75), "15.5", fill=(0, 0, 0), font=font_sm, anchor="rm")
    d.line([xy(-30, 0), xy(-30, -15.5)], fill=(0, 0, 0), width=1)
    d.line([xy(-31.2, -15.5), xy(-28.8, -15.5)], fill=(0, 0, 0), width=1)
    d.text(xy(-31.5, -7.75), "15.5", fill=(0, 0, 0), font=font_sm, anchor="rm")
    # 下排 28.7
    d.line([xy(-14.35, -22), xy(14.35, -22)], fill=(0, 0, 0), width=1)
    d.line([xy(-14.35, -21), xy(-14.35, -23)], fill=(0, 0, 0), width=1)
    d.line([xy(14.35, -21), xy(14.35, -23)], fill=(0, 0, 0), width=1)
    d.text(xy(0, -24.2), "28.7", fill=(0, 0, 0), font=font_sm, anchor="mm")
    # 内宽 56.5
    d.line([xy(-half_w, -32), xy(half_w, -32)], fill=(0, 0, 0), width=1)
    d.text(xy(0, -34), "56.5", fill=(0, 0, 0), font=font_sm, anchor="mm")
    # 锁止
    d.text(xy(0, flat_y + tab_h + 3), "14 / 10.15", fill=(0, 0, 0), font=font_sm, anchor="mm")
    d.text(xy(half_w + 2, y_top - 2), "R10", fill=(0, 0, 0), font=font_sm)
    # 比例尺
    d.line([xy(-26, -40), xy(-6, -40)], fill=(0, 0, 0), width=4)
    d.text(xy(-16, -42.5), "20 mm", fill=(0, 0, 0), font=font_sm, anchor="mm")
    d.text((16, H - 24), "外圆φ63 · 内宽56.5/R10 · 行距15.5 · 1mm=12px", fill=(50, 50, 50), font=font_sm)

    out = Path(r"e:/判充/assets/connect/gb_face_user_scaled.png")
    img.save(out)
    img.save(out.with_suffix(".jpg"), quality=92, optimize=True)
    print("wrote", out, img.size)


if __name__ == "__main__":
    main()
