# 判充单路盒 · PanchongCAN-S1

现场听 **一路 CAN** 的采集盒：默认听充电枪 `S+ / S-` 上的 GB/T 27930，也可改接到 OBD 6/14 听整车 CAN。与双路板共用 **45×28 mm** 外形和 OBD 取电，去掉 MCP2515 第二路，BOM 更短、更好焊。

> 只听不发。不定责。不替代官方诊断仪。

## 和双路的差别

| | 双路 Dual-CAN XL | **单路 S1（本设计）** |
|---|---|---|
| CAN 路数 | CH0 充电 + CH1 整车，同时听 | **1 路**，枪或 OBD **二选一** |
| 控制器 | ESP32-C3 TWAI + MCP2515 | 仅 ESP32-C3 **TWAI** |
| 收发器 | HVD230 ×2 | **HVD230 ×1** |
| 板框 | 45×28×1.0 mm | **同框**（右侧空出，天线更松） |
| 固件 | 双路尚未在本仓库落地 | 本目录 `firmware/panchong_s1.ino` |
| 适用 | 要对拍「枪线 vs 车内」 | 判充主路径、成本件、先打样 |

判充主数据在枪线 S+/S-，不在 OBD。单路足够跑通小程序连接页、流程回放和曲线。

## 系统链

```
OBD-16 (12V，可选 24V 换料)
    → 1A 保险 → 防反 → TVS
    → Buck 5V (MP2315, FB 51k/10k)
    → LDO 3.3V (AP2112K-3.3)
    → ESP32-C3-MINI-1 (BLE + TWAI)
         │
         ├─ USB-C  GPIO19/18  刷机 / 日志
         └─ TWAI GPIO7 TX / GPIO6 RX
                → SN65HVD230
                    → JP1 跳线二选一
                         ├─ JST-PH → 枪 S+ / S-
                         └─ 焊盘   → OBD 6 / 14
```

手机：蓝牙名含 `Panchong` 或 `判充`，Nordic UART，连上后写 `listen`。

## 关键约定（与小程序对齐）

- BLE 广播名：`PanchongCAN-S1`
- Service `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
- RX（手机写）`6E400002-…`  · TX（盒 notify）`6E400003-…`
- 命令：`listen` 开始；`stop` 停止；`baud 250|500`；`info`
- CAN：**listen-only**，默认 **250 kbit/s**（27930-2015）
- 上行每行：`秒.毫秒 IDHEX DD DD …`  
  例：`12.345 1826F456 01 01 00`
- 120Ω 终端 **默认不焊**（车上已有）
- 不要同时把枪线和 OBD CAN 接到同一收发器

## 本目录

| 文件 | 内容 |
|---|---|
| `BOM.csv` | 可下单物料 |
| `pinmap.md` | C3 引脚与连接器 |
| `netlist.txt` | 打板用网络表 |
| `firmware/panchong_s1.ino` | Arduino-ESP32 听总线固件 |
| `preview.html` | 浏览器看设计（非原理图 CAD） |

板图 / 原理图块：`assets/circuit/single_overview.png`、`single_schematic.png`（`scripts/gen_single_can_board.py` 生成）。小程序「工具 → 充电采集电路 → 单路板」同步展示。

## 安全

- 盒地 = 车辆 12V 地。枪线 S+/S- 在部分车上接近 PE，**非隔离**听口与双路相同，先确认 S- 对 PE 无明显电位再夹线。
- 需要隔离时改 ISO1050 + 隔离电源，本成本件不做。
- 高压 DC+/DC-、A+ 不要接到本板。
- 固件禁止在 listen-only 以外默认发帧。
