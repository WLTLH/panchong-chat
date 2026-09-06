var abCompare = require('../../utils/ab_compare.js');
var ble = require('../../utils/ble_session.js');
var filePick = require('../../utils/file_pick.js');
var logIo = require('../../utils/log_io.js');
var STORAGE_A = 'ab_compare_log_a';
var STORAGE_B = 'ab_compare_log_b';

var KIND_META = {
  only_a: { label: '仅异常', tone: 'tone-fail' },
  only_b: { label: '仅正常', tone: 'tone-ok' },
  payload: { label: '数据变', tone: 'tone-chg' },
  rate: { label: '频率差', tone: 'tone-rate' },
  code_only_a: { label: '国标·异', tone: 'tone-fail' },
  code_only_b: { label: '国标·常', tone: 'tone-ok' },
  code_rate: { label: '国标频率', tone: 'tone-rate' }
};

function metaOf(text) {
  var t = String(text || '').trim();
  if (!t) return '尚未录入';
  var lines = t.split(/\r?\n/).filter(Boolean).length;
  return lines + ' 行 · ' + t.length + ' 字';
}

function decorateResult(raw) {
  if (!raw || !raw.diff) return null;
  var diff = raw.diff;
  function mapList(list) {
    return (list || []).map(function (item) {
      var meta = KIND_META[item.kind] || { label: item.kind, tone: 'tone-chg' };
      return Object.assign({}, item, {
        kindLabel: meta.label,
        tone: meta.tone
      });
    });
  }
  return {
    sumA: raw.sumA,
    sumB: raw.sumB,
    diff: {
      meta: diff.meta,
      highlights: mapList(diff.highlights),
      onlyA: mapList(diff.onlyA),
      onlyB: mapList(diff.onlyB),
      payloadChanged: mapList(diff.payloadChanged),
      rateChanged: mapList(diff.rateChanged)
    }
  };
}

function flagsFrom(a, b) {
  return {
    hasA: !!String(a || '').trim(),
    hasB: !!String(b || '').trim(),
    metaA: metaOf(a),
    metaB: metaOf(b)
  };
}

Page({
  data: {
    step: 0,
    textA: '',
    textB: '',
    metaA: '尚未录入',
    metaB: '尚未录入',
    hasA: false,
    hasB: false,
    result: null,
    showLimit: 40
  },

  onLoad() {
    this.loadStorage();
  },

  onShow() {
    this.loadStorage(true);
  },

  loadStorage() {
    var a = '';
    var b = '';
    try {
      a = wx.getStorageSync(STORAGE_A) || '';
      b = wx.getStorageSync(STORAGE_B) || '';
    } catch (e) {}
    this.setData(Object.assign({ textA: a, textB: b }, flagsFrom(a, b)));
  },

  saveSlot(which, text) {
    var key = which === 'a' ? STORAGE_A : STORAGE_B;
    try {
      wx.setStorageSync(key, text || '');
    } catch (e) {
      wx.showToast({ title: '存储失败(过大?)', icon: 'none' });
    }
  },

  onGotoStep(e) {
    var s = Number(e.currentTarget.dataset.step);
    if (isNaN(s)) return;
    this.setData({ step: s });
    if (s === 3 && !this.data.result) this.onRunCompare();
  },

  onGotoMirror() {
    this.setData({ step: 3 });
    this.onRunCompare();
  },

  onStartA() {
    this.setData({ step: 1 });
  },

  onLogInput(e) {
    var text = e.detail.value || '';
    if (this.data.step === 1) {
      this.setData(Object.assign({ textA: text }, flagsFrom(text, this.data.textB)));
      this.saveSlot('a', text);
    } else if (this.data.step === 2) {
      this.setData(Object.assign({ textB: text }, flagsFrom(this.data.textA, text)));
      this.saveSlot('b', text);
    }
  },

  onImportBle() {
    var text = '';
    try {
      text = ble.exportFrames() || ((ble.state() && ble.state().logText) || '');
    } catch (e) {}
    if (!String(text).trim()) {
      wx.showToast({ title: '蓝牙会话无日志', icon: 'none' });
      return;
    }
    this._applySlotText(text);
    wx.showToast({ title: '已导入', icon: 'success' });
  },

  onPickLocalFile() {
    var that = this;
    filePick.showPickSheet('报文', {
      chat: function () { that._pickLogFromChat(); },
      local: function () { that._pickLogFromLocal(); }
    });
  },

  _pickLogFromChat() {
    var that = this;
    filePick.pickChatDocument({}, function (ok, f, err) {
      if (!ok) {
        if (filePick.isCancel(err)) return;
        if (err && err.tip) {
          wx.showToast({ title: err.tip, icon: 'none' });
          return;
        }
        wx.showToast({ title: '未选到文件', icon: 'none' });
        return;
      }
      that._readLogFile(f.path, f.name || 'capture.log', f.size);
    });
  },

  _pickLogFromLocal() {
    var that = this;
    filePick.pickLocalDocument({}, function (ok, f, err) {
      if (!ok) {
        if (filePick.isCancel(err)) return;
        wx.showToast({ title: '未选到文件', icon: 'none' });
        return;
      }
      that._readLogFile(f.path, f.name || 'capture.log', f.size);
    });
  },

  _readLogFile(filePath, name, size) {
    var that = this;
    var read = function () {
      wx.showLoading({ title: '读取报文' });
      wx.getFileSystemManager().readFile({
        filePath: filePath,
        success: function (res) {
          try {
            var dec = logIo.decodeLogBytes(res.data);
            var norm = logIo.normalizeCanLog(dec.text, name);
            if (!norm.ok) {
              wx.hideLoading();
              wx.showModal({
                title: '无法识别报文',
                content: '「' + name + '」不是支持的 CAN 日志。支持 .txt / .log / .asc / .trc',
                showCancel: false
              });
              return;
            }
            that._applySlotText(norm.text);
            wx.hideLoading();
            wx.showToast({
              title: (logIo.formatLabel(norm.format) || '已载入') + ' · ' + (norm.frameCount || 0) + ' 行',
              icon: 'none'
            });
          } catch (e) {
            wx.hideLoading();
            wx.showToast({ title: '读取失败', icon: 'none' });
          }
        },
        fail: function () {
          wx.hideLoading();
          wx.showToast({ title: '读取失败', icon: 'none' });
        }
      });
    };
    if (size && size > 8 * 1024 * 1024) {
      wx.showModal({
        title: '文件较大',
        content: '超过 8MB，解析可能较慢。仍要打开？',
        success: function (res) {
          if (res.confirm) read();
        }
      });
      return;
    }
    read();
  },

  _applySlotText(text) {
    if (this.data.step === 1) {
      this.setData(Object.assign({ textA: text }, flagsFrom(text, this.data.textB)));
      this.saveSlot('a', text);
    } else if (this.data.step === 2) {
      this.setData(Object.assign({ textB: text }, flagsFrom(this.data.textA, text)));
      this.saveSlot('b', text);
    } else {
      wx.showToast({ title: '请先进入异/常步骤', icon: 'none' });
    }
  },
  onClearSlot() {
    var that = this;
    wx.showModal({
      title: '清空本段？',
      success: function (res) {
        if (!res.confirm) return;
        if (that.data.step === 1) {
          that.setData(Object.assign({ textA: '' }, flagsFrom('', that.data.textB)));
          that.saveSlot('a', '');
        } else {
          that.setData(Object.assign({ textB: '' }, flagsFrom(that.data.textA, '')));
          that.saveSlot('b', '');
        }
      }
    });
  },

  onGoBle() {
    wx.switchTab({ url: '/pages/dcflow/dcflow' });
  },

  onNextFromSlot() {
    if (this.data.step === 1) {
      if (!String(this.data.textA || '').trim()) {
        wx.showToast({ title: '请先录入异常态', icon: 'none' });
        return;
      }
      this.saveSlot('a', this.data.textA);
      this.setData({ step: 2 });
      return;
    }
    if (this.data.step === 2) {
      if (!String(this.data.textB || '').trim()) {
        wx.showToast({ title: '请先录入正常态', icon: 'none' });
        return;
      }
      this.saveSlot('b', this.data.textB);
      this.setData({ step: 3 });
      this.onRunCompare();
    }
  },

  onRunCompare() {
    var a = this.data.textA || '';
    var b = this.data.textB || '';
    if (!String(a).trim() || !String(b).trim()) {
      wx.showToast({ title: '异常与正常都需有日志', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '对照中' });
    var raw;
    try {
      raw = abCompare.compareLogs(a, b);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '对照失败', icon: 'none' });
      return;
    }
    wx.hideLoading();
    this.setData({ result: decorateResult(raw), step: 3 });
    var n = (raw.diff && raw.diff.highlights && raw.diff.highlights.length) || 0;
    wx.showToast({
      title: n ? ('镜中 ' + n + ' 处差异') : '未见明显差异',
      icon: 'none'
    });
  },

  onLoadDemo() {
    var pair = abCompare.getDemoPair();
    this.setData(Object.assign({
      textA: pair.a,
      textB: pair.b,
      step: 3
    }, flagsFrom(pair.a, pair.b)));
    this.saveSlot('a', pair.a);
    this.saveSlot('b', pair.b);
    this.onRunCompare();
  }
});
