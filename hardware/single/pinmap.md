# PanchongCAN-S1 引脚与连接器

## ESP32-C3-MINI-1（U1）

| 功能 | GPIO | 方向 | 接到 |
|---|---|---|---|
| TWAI TX | **GPIO7** | 出 | HVD230 TXD（D） |
| TWAI RX | **GPIO6** | 入 | HVD230 RXD（R） |
| 状态灯 | **GPIO10** | 出 | LED1 阴极（灌电流，亮=低） |
| BOOT | GPIO9 | 入 | SW1→GND，10k 上拉 |
| EN | EN | 入 | SW2→GND，10k 上拉 |
| USB D− | GPIO18 | USB | USB-C D− |
| USB D+ | GPIO19 | USB | USB-C D+ |
| UART0 TX | GPIO21 | 出 | 调试焊盘（可选） |
| UART0 RX | GPIO20 | 入 | 调试焊盘（可选） |
| Strapping | GPIO8 | — | 10k 上拉，不接重载 |
| 3V3 / GND | — | 电源 | LDO 输出；多点就近去耦 |

与双路 CH0 相同：TWAI 固定 **GPIO7/6**，固件不要再按经典 ESP32 的 5/4 去改。

## SN65HVD230（U2）

| 脚 | 名 | 接法 |
|---|---|---|
| 1 | TXD | GPIO7 + **4.7k 上拉到 3V3**。TXD 低 = 显性，会堵死整车 CAN、仪表蜂鸣 |
| 2 | GND | GND |
| 3 | VCC | 3V3 |
| 4 | RXD | GPIO6 |
| 5 | Vref | 10nF→GND |
| 6 | CANL | 经 PESD1CAN、JP1 |
| 7 | CANH | 经 PESD1CAN、JP1 |
| 8 | Rs | **不要直接 0Ω 接地。** 4.7k～47k 上拉到 3V3（待机）；要听的时候再由 GPIO 拉低，或飞线临时接地 |

## JP1 二选一（2×3，2.54）

```
枪 CANH  [1]  [2]  [3]  OBD-6  CANH
          \______/  CANH 从收发器来

枪 CANL  [4]  [5]  [6]  OBD-14 CANL
          \______/  CANL 从收发器来
```

- **默认（听充电）**：短路 1–2、4–5；JST-PH 出线夹 S+/S−
- **听整车**：短路 2–3、5–6；OBD 6/14 焊到板边焊盘
- **禁止**两组同时短上（两条总线会并在一起）

## 板边焊盘 / 插座

| 位号 | 网名 | 现场 |
|---|---|---|
| PAD_16 | VIN | OBD-16 常电 12V |
| PAD_GND | GND | OBD-4 或 5 |
| PAD_6 | OBD_CANH | 仅 JP1 打到「车」时用 |
| PAD_14 | OBD_CANL | 仅 JP1 打到「车」时用 |
| J2-1 | GUN_CANH | 枪 S+ |
| J2-2 | GUN_CANL | 枪 S− |
| J1 | USB-C | 刷机；可 5V 供电（与 Buck 或二极管） |

## 电源

| 网 | 来源 | 范围 |
|---|---|---|
| VIN | OBD-16 | 9–16V 典型；24V 需换 Buck/TVS |
| +5V | MP2315 | USB 5V 可经肖特基或入（可选） |
| 3V3 | AP2112K | MCU / HVD230 / 上拉 |

USB 与 OBD **禁止同时插**（除非已经加了 VBUS 或二极管）。打样先只从 USB 刷机；上车先只接 OBD **16 和 4/5**，6/14 用胶布包住。

## 插 OBD 狂响 / 刷不进去

1. 先不要再插车上。声音大十有八九是：电源短路（电感惨叫）或 **CAN 被拉成显性**（仪表蜂鸣器响）。
2. 万用表、板子只接 USB 或干脆不供电时量：
   - `PAD_16` 对 `USB VBUS`、`+5V`、`3V3`、`D+`、`D-` 必须全开路。任何一项导通，12V 已经能把 C3 的 USB 脚打坏。
   - `3V3` 对地不应接近 0Ω。
3. 只插 USB（不插 OBD）：`3V3` 应为 ~3.3V。若是 0、5V 或跟着 12V 走，MCU 多半已经废。
4. 电脑看不到串口：先按住 BOOT 再点 RST。仍没有，用 3.3V USB‑TTL 走 GPIO20/21（UART0）。USB 口坏了芯片还可能活着。
5. 线束：听充电时 OBD 插头里的 **6、14 不能接到板上**。接到了又碰上电 TXD 为低，仪表会一直叫。
