var dcSeries = require('../../utils/dc_series.js');
var membership = require('../../utils/membership.js');

function speedNumText(speed) {
  if (!speed || !speed.numbers) return '';
  var n = speed.numbers;
  var parts = [];
  if (n.avgReqA != null) parts.push('需求 ' + n.avgReqA + 'A');
  if (n.avgOutA != null) parts.push('实出 ' + n.avgOutA + 'A');
  if (n.pileMaxA != null) parts.push('能力 ' + n.pileMaxA + 'A');
  if (n.gapA != null) parts.push('差 ' + n.gapA + 'A');
  if (n.soc != null) parts.push('SOC ' + n.soc + '%');
  return parts.join(' · ');
}

Page({
  data: {
    hasTrace: false,
    readable: {
      vin: '待识别(需完整 BRM)',
      batteryType: '待识别(需完整 BRM)',
      soc: '—',
      pileId: '待识别',
      note: '绝缘仅状态位，无 kΩ。'
    },
    meta: {},
    canvasW: 320,
    canvasH: 210,
    speedCanvasH: 180,
    speedVerdict: null,
    speedNumText: '',
    isVip: false,
    freeSpeedTitle: '',
    freeSpeedDesc: ''
  },

  pack: null,
  seriesFull: [],
  totalMs: 0,

  onReady() {
    var that = this;
    wx.getSystemInfo({
      success: function (res) {
        var w = res.windowWidth - 48;
        that.setData({
          canvasW: w,
          canvasH: Math.round(w * 0.62),
          speedCanvasH: Math.round(w * 0.52)
        });
        that.tryLoad();
      },
      fail: function () { that.tryLoad(); }
    });
  },

  onShow() {
    this.setData({ isVip: membership.isVip() });
    if (this.pack) {
      this._paintSpeedGate(this.pack.speed);
      this.drawFull();
    } else {
      this.tryLoad();
    }
  },

  tryLoad() {
    var app = getApp();
    var text = app.getFullTrace() || app.globalData.lastDcFlowLog || '';
    if (text && String(text).trim() && !/^全量\d+帧/.test(String(text).trim())) {
      this.loadText(text);
    } else {
      this.setData({ hasTrace: false });
    }
  },

  loadText(text) {
    var that = this;
    wx.showLoading({ title: '生成曲线', mask: true });
    setTimeout(function () {
      try {
        var pack = dcSeries.buildSeries(text);
        var display = dcSeries.downsample(pack.series, 800);
        that.pack = pack;
        that.seriesFull = display;
        that.totalMs = pack.totalMs || 0;
        getApp().globalData.lastSeriesPack = {
          meta: pack.meta,
          readable: pack.readable,
          totalMs: pack.totalMs,
          speed: pack.speed
        };
        that.setData({
          hasTrace: true,
          readable: pack.readable,
          meta: pack.meta,
          isVip: membership.isVip(),
          speedVerdict: pack.speed || null,
          speedNumText: speedNumText(pack.speed)
        });
        that._paintSpeedGate(pack.speed);
        that.drawFull();
        wx.hideLoading();
      } catch (e) {
        wx.hideLoading();
        that.setData({ hasTrace: false });
        wx.showToast({ title: '生成失败', icon: 'none' });
        console.error(e);
      }
    }, 20);
  },

  _paintSpeedGate(speed) {
    var vip = membership.isVip();
    var free = membership.toFreeSpeed(speed);
    this.setData({
      isVip: vip,
      freeSpeedTitle: free.title,
      freeSpeedDesc: free.desc,
      speedNumText: vip ? speedNumText(speed) : ''
    });
  },

  goVip() {
    wx.navigateTo({ url: '/pages/vip/vip' });
  },

  goConnect() {
    wx.switchTab({ url: '/pages/dcflow/dcflow' });
  },

  drawFull() {
    this.drawMain(this.totalMs);
    this.drawSpeed(this.totalMs);
  },

  drawMain(simMs) {
    var series = dcSeries.sliceUntil(this.seriesFull, simMs);
    var ctx = wx.createCanvasContext('seriesCanvas', this);
    var W = this.data.canvasW;
    var H = this.data.canvasH;
    var padL = 36;
    var padR = 36;
    var padT = 16;
    var padB = 28;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var totalMs = Math.max(this.totalMs, 1);

    ctx.setFillStyle('#FAFBFC');
    ctx.fillRect(0, 0, W, H);

    ctx.setStrokeStyle('#EAEAEA');
    ctx.setLineWidth(1);
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (plotH * g) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + plotW, gy);
      ctx.stroke();
    }

    var maxI = 10;
    series.forEach(function (p) {
      if (p.iOutAbs != null) maxI = Math.max(maxI, p.iOutAbs);
      if (p.iReqAbs != null) maxI = Math.max(maxI, p.iReqAbs);
    });
    maxI = Math.ceil(maxI / 10) * 10;

    function xOf(t) { return padL + (Math.min(t, totalMs) / totalMs) * plotW; }
    function ySoc(v) { return padT + plotH - (v / 100) * plotH; }
    function yI(v) { return padT + plotH - (v / maxI) * plotH; }
    function yIns(h) { return padT + plotH - ((h == null ? 0.5 : h) * 0.85 + 0.05) * plotH; }

    ctx.setFillStyle('#888');
    ctx.setFontSize(10);
    ctx.fillText('0', 4, padT + plotH);
    ctx.fillText('100', 2, padT + 10);
    ctx.fillText(String(maxI), W - 30, padT + 10);
    ctx.fillText('0A', W - 28, padT + plotH);

    function strokeSeries(getter, color, dashed, yMap) {
      ctx.setStrokeStyle(color);
      ctx.setLineWidth(2);
      if (dashed && ctx.setLineDash) ctx.setLineDash([6, 4]);
      else if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.beginPath();
      var started = false;
      for (var i = 0; i < series.length; i++) {
        var val = getter(series[i]);
        if (val == null || isNaN(val)) continue;
        var x = xOf(series[i].tMs);
        var y = yMap(val);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      if (started) ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
    }

    strokeSeries(function (p) { return p.soc; }, '#E64340', false, ySoc);
    strokeSeries(function (p) { return p.iOutAbs; }, '#07C160', false, yI);
    strokeSeries(function (p) { return p.iReqAbs; }, '#2F6BFF', true, yI);

    ctx.setStrokeStyle('#9B59B6');
    ctx.setLineWidth(2);
    if (ctx.setLineDash) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    var startedIns = false;
    for (var j = 0; j < series.length; j++) {
      if (series[j].insulHeight == null) continue;
      var xi = xOf(series[j].tMs);
      var yi = yIns(series[j].insulHeight);
      if (!startedIns) { ctx.moveTo(xi, yi); startedIns = true; }
      else ctx.lineTo(xi, yi);
    }
    if (startedIns) ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);

    ctx.draw();
  },

  drawSpeed(simMs) {
    var series = dcSeries.sliceUntil(this.seriesFull, simMs);
    var ctx = wx.createCanvasContext('speedCanvas', this);
    var W = this.data.canvasW;
    var H = this.data.speedCanvasH || 180;
    var padL = 36;
    var padR = 28;
    var padT = 14;
    var padB = 24;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var totalMs = Math.max(this.totalMs, 1);

    ctx.setFillStyle('#FAFBFC');
    ctx.fillRect(0, 0, W, H);

    ctx.setStrokeStyle('#EAEAEA');
    ctx.setLineWidth(1);
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (plotH * g) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + plotW, gy);
      ctx.stroke();
    }

    var maxI = 10;
    series.forEach(function (p) {
      if (p.iOutAbs != null) maxI = Math.max(maxI, p.iOutAbs);
      if (p.iReqAbs != null) maxI = Math.max(maxI, p.iReqAbs);
      if (p.pileMaxAbs != null) maxI = Math.max(maxI, p.pileMaxAbs);
    });
    maxI = Math.ceil(maxI / 10) * 10 || 10;

    function xOf(t) { return padL + (Math.min(t, totalMs) / totalMs) * plotW; }
    function yI(v) { return padT + plotH - (v / maxI) * plotH; }

    ctx.setFillStyle('#888');
    ctx.setFontSize(10);
    ctx.fillText(String(maxI) + 'A', 2, padT + 10);
    ctx.fillText('0', 8, padT + plotH);

    function strokeSeries(getter, color, dashed, width) {
      ctx.setStrokeStyle(color);
      ctx.setLineWidth(width || 2);
      if (dashed && ctx.setLineDash) ctx.setLineDash([6, 4]);
      else if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.beginPath();
      var started = false;
      for (var i = 0; i < series.length; i++) {
        var val = getter(series[i]);
        if (val == null || isNaN(val)) continue;
        var x = xOf(series[i].tMs);
        var y = yI(val);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      if (started) ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
    }

    strokeSeries(function (p) { return p.pileMaxAbs; }, '#E67E22', true, 2);
    strokeSeries(function (p) { return p.iReqAbs; }, '#2F6BFF', true, 2);
    strokeSeries(function (p) { return p.iOutAbs; }, '#07C160', false, 2.5);

    ctx.draw();
  }
});
