var gbt = require('../../utils/gbt27930.js');

var SIDE = { pile: '桩→车', vehicle: '车→桩', unknown: '未知' };

Page({
  data: {
    input: '',
    chips: [
      { code: 'CHM' }, { code: 'BHM' }, { code: 'CRM' }, { code: 'BCL' },
      { code: 'CCS' }, { code: 'BSM' }, { code: 'BST' }, { code: 'CST' }, { code: 'CEM' }
    ],
    single: null,
    batch: null
  },

  onShow() {
    try {
      var fill = wx.getStorageSync('gbt_decode_fill');
      if (fill) {
        wx.removeStorageSync('gbt_decode_fill');
        this.setData({ input: fill });
        this.decodeText(fill);
      }
    } catch (e) {}
  },

  onInput(e) {
    this.setData({ input: e.detail.value || '' });
  },

  onClear() {
    this.setData({ input: '', single: null, batch: null });
  },

  onChip(e) {
    var code = e.currentTarget.dataset.code;
    var meta = gbt.getMessageMeta(code);
    if (!meta) return;
    var line = meta.exampleId + ' ' + meta.exampleData;
    if (code === 'BRM' || meta.exampleData.indexOf('TP') >= 0) {
      line = '1826F456 01 01 00';
      if (code === 'BCL') line = '181056F4 4C 1D B8 0B 02';
    }
    if (code === 'CHM') line = '1826F456 01 01 00';
    if (code === 'BHM') line = '182756F4 3C 0A';
    if (code === 'CRM') line = '1801F456 AA 01 02 03 31 32 33 34';
    if (code === 'BCL') line = '181056F4 4C 1D B8 0B 02';
    if (code === 'CCS') line = '1812F456 4C 1D B8 0B 05 00 01';
    if (code === 'BSM') line = '181356F4 01 78 01 5A 02 00 00';
    if (code === 'BST') line = '101956F4 01 00 00 00';
    if (code === 'CST') line = '101AF456 04 00 00 00';
    if (code === 'CEM') line = '081FF456 14 00 00 00';
    this.setData({ input: line });
    this.decodeText(line);
  },

  onDecode() {
    this.decodeText(this.data.input);
  },

  decodeText(text) {
    text = String(text || '').trim();
    if (!text) {
      wx.showToast({ title: '请输入报文', icon: 'none' });
      return;
    }
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length === 1) {
      var r = gbt.decodeFrame(lines[0]);
      if (!r.ok) {
        this.setData({ single: null, batch: null });
        wx.showToast({ title: '无法解析', icon: 'none' });
        return;
      }
      this.setData({
        single: {
          code: r.code,
          stage: r.stage,
          idHex: r.idHex,
          saHex: r.sa != null ? r.sa.toString(16).toUpperCase() : '--',
          sideLabel: SIDE[r.side] || r.side,
          summary: r.summary,
          fields: r.fields,
          manufacturerText: r.manufacturerText || '未识别厂家',
          labelText: r.labelText || ''
        },
        batch: null
      });
    } else {
      var parsed = gbt.decodeLogText(text);
      var preview = [];
      for (var i = 0; i < parsed.frames.length && preview.length < 40; i++) {
        var f = parsed.frames[i];
        if (f.code === 'TP.CM' || f.code === 'TP.DT') continue;
        preview.push({ code: f.code, summary: f.summary || '' });
      }
      var codeText = Object.keys(parsed.codeCounts).map(function (k) {
        return k + '×' + parsed.codeCounts[k];
      }).join('  ');
      this.setData({
        single: null,
        batch: {
          frameCount: parsed.frameCount,
          reassembledCount: parsed.reassembledCount,
          totalMs: parsed.totalMs,
          codeText: codeText,
          preview: preview
        }
      });
    }
  }
});
