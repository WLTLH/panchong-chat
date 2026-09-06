Page({
  data: {
    scenarios: [],
    activeId: '',
    logText: '',
    result: null,
    numRows: []
  },

  onLoad: function () {
    var cs = require('../../utils/charge_speed.js');
    this._cs = cs;
    this.setData({
      scenarios: cs.DEMO_SCENARIOS.map(function (s) {
        return { id: s.id, title: s.title, desc: s.desc };
      })
    });
    this.applyScenario('vehicle_limit');
  },

  applyScenario: function (id) {
    var cs = this._cs || require('../../utils/charge_speed.js');
    var hit = null;
    for (var i = 0; i < cs.DEMO_SCENARIOS.length; i++) {
      if (cs.DEMO_SCENARIOS[i].id === id) {
        hit = cs.DEMO_SCENARIOS[i];
        break;
      }
    }
    if (!hit) return;
    this.setData({ activeId: id, logText: hit.log });
    this.runAnalyze(hit.log);
  },

  onPickDemo: function (e) {
    this.applyScenario(e.currentTarget.dataset.id);
  },

  onLogInput: function (e) {
    this.setData({ logText: e.detail.value });
  },

  onAnalyze: function () {
    this.runAnalyze(this.data.logText);
  },

  onPasteLast: function () {
    var app = getApp();
    var text = '';
    try {
      var cap = app.globalData.lastCapture || wx.getStorageSync('gbt_last_capture');
      if (cap && cap.logText) text = cap.logText;
    } catch (err) {}
    if (!text) {
      wx.showToast({ title: '暂无采集日志', icon: 'none' });
      return;
    }
    this.setData({ activeId: '', logText: text });
    this.runAnalyze(text);
  },

  runAnalyze: function (text) {
    var cs = this._cs || require('../../utils/charge_speed.js');
    var result = cs.analyzeChargeSpeed(text || '');
    var n = result.numbers || {};
    var numRows = [
      { k: '车需求 BCL', v: n.avgReqA != null ? n.avgReqA + ' A' : '—' },
      { k: '桩实出 CCS', v: n.avgOutA != null ? n.avgOutA + ' A' : '—' },
      { k: '差距', v: n.gapA != null ? n.gapA + ' A' : '—' },
      { k: '桩能力 CML', v: n.pileMaxA != null ? n.pileMaxA + ' A' : '—' },
      { k: 'SOC', v: n.soc != null ? n.soc + ' %' : '—' },
      { k: '电池类型', v: n.batteryType || '—' },
      { k: '最高单体', v: n.maxCellV != null ? n.maxCellV + ' V' : '—' },
      { k: '样本', v: 'BCL×' + (n.bclCount || 0) + ' / CCS×' + (n.ccsCount || 0) }
    ];
    if (result.hiddenSoc && result.hiddenSoc.primary) {
      numRows.push({ k: '隐藏电量线索', v: result.hiddenSoc.primary.label });
    }
    if (result.numbers && result.numbers.batteryChemistrySource === 'bcs_inferred') {
      numRows.push({ k: '电池类型', v: (result.numbers.batteryType || '—') + '（电压推断）' });
    }
    if (result.impedanceHint) {
      numRows.push({ k: '高阻抗线索', v: result.impedanceHint.label + '（' + result.impedanceHint.confidence + '）' });
    }
    if (result.imbalanceHint) {
      numRows.push({ k: '不平衡线索', v: '压差 ' + result.imbalanceHint.spreadV + 'V（' + result.imbalanceHint.confidence + '）' });
    }
    this.setData({ result: result, numRows: numRows });
    try {
      require('../../utils/cloud_report.js').reportSpeed(result);
    } catch (e) {}
  }
});
