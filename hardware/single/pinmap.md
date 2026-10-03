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
| 1 | TXD | GPIO7 |
| 2 | GND | GND |
| 3 | VCC | 3V3 |
| 4 | RXD | GPIO6 |
| 5 | Vref | 10nF→GND |
| 6 | CANL | 经 PESD1CAN、JP1 |
| 7 | CANH | 经 PESD1CAN、JP1 |
| 8 | Rs | 0Ω→GND（高速） |

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

USB 与 OBD 不要长时间双供电。打样可只从 OBD 取电，USB 只走 D+/D−。
