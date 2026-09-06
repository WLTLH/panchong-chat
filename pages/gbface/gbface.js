var face = require('../../utils/gbt20234_face.js');
var gun3d = require('../../utils/gun_model3d.js');

Page({
  data: {
    tab: 'cutaway',
    tabs: [
      { id: 'cutaway', title: '半剖诊断' },
      { id: 'pair', title: '对接' },
      { id: 'gun', title: '充电枪' },
      { id: 'inlet', title: '充电口' },
      { id: 'model3d', title: '可旋转' }
    ],
    imgSrc: '/assets/connect/cutaway_demo_cc2_fail.jpg',
    standard: face.standard,
    coupleOrder: face.COUPLE_ORDER.join(' → '),
    contacts: face.CONTACTS_PLUG,
    spaceDims: [
      { k: '侧视上/下', v: '≤50 / ≤45 → 48 / 43 mm' },
      { k: '正视宽/顶宽', v: '≤80 / ≤38 → 78 / 36 mm' },
      { k: '肩高 / 底弧', v: '36.5 / ≤R45 → R44 mm' },
      { k: '手柄角', v: '≤75° → 75°' },
      { k: '头部长 / 台阶', v: '≥50 → 58 · 1×8 mm' },
      { k: '端面', v: 'φ' + face.FACE_OD + ' · 9 触头' }
    ],
    note: '客户展示：半剖透明看触头通路；绿=通 / 蓝=接通中 / 红=断点。',
    canvasW: 320,
    canvasH: 280,
    modelReady: false
  },

  renderer: null,
  _touchX: 0,
  _touchY: 0,
  _yaw: 0.35,
  _pitch: 0.22,

  onReady() {
    this._layoutCanvas();
  },

  onShow() {
    if (this.data.tab === 'model3d') this._mountGun();
  },

  onHide() {
    this._destroyGun();
  },

  onUnload() {
    this._destroyGun();
  },

  _layoutCanvas() {
    var that = this;
    wx.getSystemInfo({
      success: function (res) {
        var w = Math.floor(res.windowWidth - 48);
        that.setData({ canvasW: w, canvasH: Math.round(w * 0.78) });
        if (that.data.tab === 'model3d') that._mountGun();
      }
    });
  },

  _mountGun() {
    var that = this;
    this._destroyGun();
    wx.createSelectorQuery()
      .in(this)
      .select('#gunCanvas')
      .node()
      .exec(function (res) {
        var node = res && res[0] && res[0].node;
        if (!node) {
          that.setData({ modelReady: false });
          return;
        }
        var r = gun3d.createRenderer({ mode: 'demo' });
        var ok = r.mount(node, that.data.canvasW, that.data.canvasH, wx.getSystemInfoSync().pixelRatio || 2);
        that.renderer = r;
        that.setData({ modelReady: !!ok });
        if (ok) r.setView(that._yaw, that._pitch);
      });
  },

  _destroyGun() {
    if (this.renderer) {
      try { this.renderer.destroy(); } catch (e) {}
      this.renderer = null;
    }
    this.setData({ modelReady: false });
  },

  onTouchStart(e) {
    var t = e.touches && e.touches[0];
    if (!t) return;
    this._touchX = t.x;
    this._touchY = t.y;
  },

  onTouchMove(e) {
    var t = e.touches && e.touches[0];
    if (!t || !this.renderer) return;
    var dx = t.x - this._touchX;
    var dy = t.y - this._touchY;
    this._touchX = t.x;
    this._touchY = t.y;
    this._yaw += dx * 0.01;
    this._pitch = Math.max(-0.2, Math.min(0.85, this._pitch + dy * 0.008));
    this.renderer.setView(this._yaw, this._pitch);
  },

  onTab(e) {
    var id = e.currentTarget.dataset.id;
    var map = {
      cutaway: '/assets/connect/cutaway_demo_cc2_fail.jpg',
      pair: '/assets/connect/gb_pair_lin.jpg',
      gun: '/assets/connect/gb_gun_lin.jpg',
      inlet: '/assets/connect/gb_inlet_lin.jpg'
    };
    var prev = this.data.tab;
    this.setData({
      tab: id,
      imgSrc: map[id] || this.data.imgSrc,
      contacts: face.contactsFor(id === 'inlet' ? 'socket' : 'plug')
    });
    if (id === 'model3d' && prev !== 'model3d') {
      var that = this;
      setTimeout(function () { that._mountGun(); }, 40);
    } else if (id !== 'model3d') {
      this._destroyGun();
    }
  },

  onPreview() {
    wx.previewImage({
      current: this.data.imgSrc,
      urls: [
        '/assets/connect/cutaway_demo_cc2_fail.jpg',
        '/assets/connect/cutaway_demo_ok.jpg',
        '/assets/connect/cutaway_demo_charging.jpg',
        '/assets/connect/gb_pair_lin.jpg',
        '/assets/connect/gb_gun_lin.jpg',
        '/assets/connect/gb_inlet_lin.jpg'
      ]
    });
  },

  onPreviewGun() {
    wx.previewImage({
      current: '/assets/connect/gb_gun_lin.jpg',
      urls: [
        '/assets/connect/gb_gun_lin.jpg',
        '/assets/connect/gb_inlet_lin.jpg',
        '/assets/connect/gb_pair_lin.jpg'
      ]
    });
  }
});
