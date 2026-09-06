var membership = require('../../utils/membership.js');

Page({
  data: {
    analysis: null,
    scoreBars: [],
    timeline: [],
    logSummary: null,
    codeCountText: '',
    isVip: false,
    freeTitle: '',
    freeDesc: ''
  },

  onShow() {
    var isVip = membership.isVip();
    var app = getApp();
    var analysis = app.globalData.lastAnalysis;
    if (!analysis) {
      try { analysis = wx.getStorageSync('gbt_last_analysis'); } catch (e) {}
    }
    if (!analysis) {
      this.setData({ analysis: null, isVip: isVip });
      return;
    }

    var free = membership.toFreeVerdict(analysis);
    if (!isVip) {
      this.setData({
        analysis: analysis,
        isVip: false,
        freeTitle: free.title,
        freeDesc: free.desc,
        scoreBars: [],
        timeline: [],
        logSummary: null,
        codeCountText: ''
      });
      return;
    }

    var scores = analysis.scores || {};
    var max = Math.max(scores.vehicle || 0, scores.pile || 0, scores.connection || 0, 1);
    var tagMap = { pile: '桩', vehicle: '车', connection: '连接', neutral: '备注' };
    var evidence = (analysis.evidence || []).map(function (e) {
      return {
        tag: e.tag === 'pile' || e.tag === 'vehicle' || e.tag === 'connection' ? e.tag : 'neutral',
        tagLabel: tagMap[e.tag] || '其他',
        text: e.text
      };
    });
    var timeline = [];
    if (analysis.session && analysis.session.timeline) {
      timeline = analysis.session.timeline.slice(0, 30);
    }
    var logSummary = analysis.logSummary;
    var codeCountText = '';
    if (logSummary && logSummary.codeCounts) {
      codeCountText = Object.keys(logSummary.codeCounts).map(function (k) {
        return k + '×' + logSummary.codeCounts[k];
      }).join('  ');
    }
    analysis = Object.assign({}, analysis, { evidence: evidence });
    this.setData({
      analysis: analysis,
      isVip: true,
      freeTitle: '',
      freeDesc: '',
      scoreBars: [
        { key: 'pile', name: '桩', val: scores.pile || 0, pct: Math.round(((scores.pile || 0) / max) * 100), color: '#07C160' },
        { key: 'vehicle', name: '车', val: scores.vehicle || 0, pct: Math.round(((scores.vehicle || 0) / max) * 100), color: '#2F6BFF' },
        { key: 'connection', name: '连接', val: scores.connection || 0, pct: Math.round(((scores.connection || 0) / max) * 100), color: '#E67E22' }
      ],
      timeline: timeline,
      logSummary: logSummary,
      codeCountText: codeCountText
    });
  },

  goHome() {
    wx.navigateTo({ url: '/pages/home/home' });
  },

  goIndex() {
    if (!membership.isVip()) {
      wx.navigateTo({ url: '/pages/vip/vip' });
      return;
    }
    wx.navigateTo({ url: '/pages/index/index' });
  },

  goVip() {
    wx.navigateTo({ url: '/pages/vip/vip' });
  }
});
