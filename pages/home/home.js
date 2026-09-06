var analyzeUtil = require('../../utils/analyze.js');
var dcFlow = require('../../utils/dc_flow.js');

Page({
  data: {
    chargeType: 'dc',
    obsOptions: [],
    observations: [],
    logText: '',
    logDisplay: '',
    logFullCount: 0,
    note: ''
  },

  onShow() {
    this.refreshObs();
    try {
      var bleLog = wx.getStorageSync('gbt_ble_import_log');
      if (bleLog && String(bleLog).trim()) {
        wx.removeStorageSync('gbt_ble_import_log');
        var text = String(bleLog);
        this.setData({
          chargeType: 'dc',
          logText: text,
          logDisplay: text,
          logFullCount: text.split(/\r?\n/).length
        });
        this.refreshObs();
        wx.showToast({ title: '已载入蓝牙日志', icon: 'success' });
      }
    } catch (e) {}
  },

  refreshObs() {
    var opts = analyzeUtil.getObservationOptions(this.data.chargeType);
    var selected = this.data.observations || [];
    this.setData({
      obsOptions: opts.map(function (o) {
        return {
          id: o.id,
          label: o.label,
          checked: selected.indexOf(o.id) >= 0
        };
      })
    });
  },

  onSelectType(e) {
    var t = e.currentTarget.dataset.type;
    this.setData({ chargeType: t, observations: [] });
    this.refreshObs();
  },

  onObsChange(e) {
    this.setData({ observations: e.detail.value || [] });
  },

  onLogInput(e) {
    var text = e.detail.value || '';
    this.setData({
      logText: text,
      logDisplay: text,
      logFullCount: text ? text.split(/\r?\n/).length : 0
    });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value || '' });
  },

  onFillDemo() {
    var text = dcFlow.DEMO_LOGS.demo;
    var lines = text.split(/\r?\n/).length;
    this.setData({
      chargeType: 'dc',
      logText: text,
      logDisplay: text,
      logFullCount: lines
    });
    this.refreshObs();
    wx.showToast({ title: '已填入演示日志', icon: 'success' });
  },

  /** 现场 BLF：进入小程序内逐步回放 */
  onFillCaseVin1070() {
    wx.navigateTo({
      url: '/pages/caseplay/caseplay?id=vin1070_no_charge&auto=1'
    });
  },

  onClearLog() {
    this.setData({ logText: '', logDisplay: '', logFullCount: 0 });
  },

  onOpenBle() {
    wx.switchTab({ url: '/pages/dcflow/dcflow' });
  },

  onAnalyze() {
    var that = this;
    var observations = this.data.observations || [];
    var logText = this.data.logText || '';
    if (!observations.length && !String(logText).trim()) {
      wx.showToast({ title: '请勾选现象或粘贴日志', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '分析中', mask: true });
    setTimeout(function () {
      try {
        var capture = {
          chargeType: that.data.chargeType,
          logText: logText,
          note: that.data.note,
          observations: observations,
          at: Date.now()
        };
        var result = analyzeUtil.analyze(capture);
        var app = getApp();
        app.persistCapture(capture);
        app.persistAnalysis(result);

        if (capture.chargeType === 'dc' && String(logText).trim()) {
          app.persistFullTrace(logText);
          app.globalData.lastDcFlowLog = logText;
          try {
            wx.setStorageSync('gbt_dcflow_auto', true);
          } catch (e) {}
        }

        var route = analyzeUtil.routeAfterAnalyze(result, capture);
        try {
          require('../../utils/cloud_report.js').reportFault(result, capture);
        } catch (e) {}
        wx.hideLoading();
        if (route.type === 'dcflow') {
          wx.switchTab({ url: '/pages/dcflow/dcflow' });
        } else {
          wx.navigateTo({ url: '/pages/result/result' });
        }
      } catch (err) {
        wx.hideLoading();
        wx.showToast({ title: '分析失败', icon: 'none' });
        console.error(err);
      }
    }, 30);
  }
});
