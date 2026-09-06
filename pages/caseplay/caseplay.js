var caseVin1070 = require('../../utils/case_vin1070.js');

var STEP_MS = 1800;

Page({
  data: {
    playing: false,
    play: null
  },

  timer: null,

  onLoad(query) {
    this.applyStep(0);
    if (query && query.auto === '1') {
      this.startPlay();
    }
  },

  onUnload() { this.stopTimer(); },
  onHide() {
    this.stopTimer();
    this.setData({ playing: false });
  },

  applyStep(idx) {
    this.setData({ play: caseVin1070.buildPlayState(idx) });
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  startPlay() {
    var that = this;
    this.stopTimer();
    var play = this.data.play;
    var start = play ? play.stepIndex : 0;
    if (start >= (play && play.stepCount) - 1) start = 0;
    this.applyStep(start);
    this.setData({ playing: true });
    this.timer = setInterval(function () {
      var cur = that.data.play.stepIndex;
      if (cur >= that.data.play.stepCount - 1) {
        that.stopTimer();
        that.setData({ playing: false });
        return;
      }
      that.applyStep(cur + 1);
    }, STEP_MS);
  },

  onToggle() {
    if (this.data.playing) {
      this.stopTimer();
      this.setData({ playing: false });
    } else {
      this.startPlay();
    }
  },

  onReplay() {
    this.stopTimer();
    this.applyStep(0);
    this.startPlay();
  },

  onPrev() {
    this.stopTimer();
    this.setData({ playing: false });
    var i = this.data.play.stepIndex;
    if (i > 0) this.applyStep(i - 1);
  },

  onNext() {
    this.stopTimer();
    this.setData({ playing: false });
    var i = this.data.play.stepIndex;
    if (i < this.data.play.stepCount - 1) this.applyStep(i + 1);
  },

  onPickStep(e) {
    var i = Number(e.currentTarget.dataset.index);
    if (isNaN(i)) return;
    this.stopTimer();
    this.setData({ playing: false });
    this.applyStep(i);
  },

  goHome() {
    wx.navigateTo({ url: '/pages/home/home' });
  },

  goAnalyze() {
    var c = caseVin1070.CASE || caseVin1070;
    var app = getApp();
    var analyzeUtil = require('../../utils/analyze.js');
    var capture = {
      chargeType: 'dc',
      logText: '',
      note: c.note,
      observations: (c.observations || []).slice(),
      at: Date.now()
    };
    var result = analyzeUtil.analyze(capture);
    result.evidence = (result.evidence || []).concat([
      { tag: 'connection', text: '链路断点：BMS1_stCC2=0（CC2 未识别）' },
      { tag: 'vehicle', text: 'BMS 故障等级2 + 单体欠压/停止码3，抑制充电' },
      { tag: 'connection', text: '充继电器未闭合，充电电流 0A' }
    ]);
    if (c.lean) {
      result.verdict = {
        label: c.lean.label,
        summary: c.lean.summary,
        color: '#E67E22'
      };
      result.scores = {
        pile: c.lean.pile || 0,
        vehicle: c.lean.vehicle || 0,
        connection: c.lean.connection || 0
      };
      result.advice = c.advice || result.advice;
    }
    app.persistCapture(capture);
    app.persistAnalysis(result);
    wx.navigateTo({ url: '/pages/result/result' });
  }
});
