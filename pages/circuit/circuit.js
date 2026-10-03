Page({
  data: {
    tab: 'wire', // wire | dual | single
    confirmNote: '请对照现场核对：供电是否走 OBD-16、充电 CAN 是否接枪 S+/S-、整车 CAN 是否接 OBD 6/14。',
    pins: [
      { io: 'GPIO7', fn: 'TWAI TX', to: 'HVD230 TXD' },
      { io: 'GPIO6', fn: 'TWAI RX', to: 'HVD230 RXD' },
      { io: 'GPIO19 / 18', fn: 'USB D+ / D−', to: 'USB-C 刷机' },
      { io: 'GPIO10', fn: '状态灯', to: '亮 = 正在 listen' },
      { io: 'GPIO9 / EN', fn: 'BOOT / RST', to: '轻触按键' }
    ],
    bom: [
      { ref: 'U1', name: 'ESP32-C3-MINI-1-N4', why: 'BLE + 一路 TWAI' },
      { ref: 'U2', name: 'SN65HVD230', why: '3.3V CAN 收发，只一颗' },
      { ref: 'U5', name: 'MP2315 + 51k/10k', why: 'OBD-16 → 5V，与双路同料' },
      { ref: 'U6', name: 'AP2112K-3.3', why: '给 MCU / CAN / RF' },
      { ref: 'JP1', name: '2×3 跳线', why: '枪或 OBD 二选一' },
      { ref: 'J2', name: 'JST-PH 2P', why: '默认出线到枪 S+/S-' }
    ],
    bleRows: [
      { k: '广播名', v: 'PanchongCAN-S1' },
      { k: 'Service', v: '6E400001-…CCA9E' },
      { k: '命令', v: 'listen / stop / baud 250|500' },
      { k: '波特率', v: '默认 250 k（27930-2015）' },
      { k: '行格式', v: '12.345 1826F456 01 01 00' }
    ]
  },

  onLoad(q) {
    var t = q && q.tab;
    if (t === 'single' || t === 'dual' || t === 'wire') this.setData({ tab: t });
  },

  onTab(e) {
    var t = e.currentTarget.dataset.tab;
    if (t) this.setData({ tab: t });
  },

  preview(e) {
    var src = e.currentTarget.dataset.src;
    if (!src) return;
    wx.previewImage({
      current: src,
      urls: [
        '/assets/circuit/dual_overview.png',
        '/assets/circuit/single_overview.png',
        '/assets/circuit/single_schematic.png'
      ]
    });
  }
});
