var verdictRules = require('../../utils/verdict_rules.js');

Page({
  data: {
    tab: 'field',
    tabs: [
      { key: 'field', label: '现场' },
      { key: 'obs', label: '观察项' },
      { key: 'stop', label: '报文位域' },
      { key: 'verdict', label: '裁决' },
      { key: 'speed', label: '慢充' },
      { key: 'soh', label: '容量' },
      { key: 'impedance', label: '电池' }
    ],
    fieldGroups: [],
    observationTable: [],
    logPresenceRules: [],
    bstBitRules: [],
    cstBitRules: [],
    bemRule: null,
    cemRule: null,
    verdictThresholds: [],
    speedRuleTable: [],
    freeVerdictRules: [],
    sohGuide: null,
    impedanceGuide: null,
    imbalanceGuide: null
  },

  onLoad() {
    var g = verdictRules.getGuideData();
    var soh = require('../../utils/battery_soh.js');
    var hvImp = require('../../utils/hv_impedance.js');
    var batteryImbalance = require('../../utils/battery_imbalance.js');
    var tab = 'field';
    try {
      var app = getApp();
      if (app && app.globalData && app.globalData.verdictGuideTab) {
        tab = app.globalData.verdictGuideTab;
        app.globalData.verdictGuideTab = '';
      }
    } catch (e) {}
    this.setData({
      tab: tab,
      fieldGroups: [
        g.fieldChecklist.connection,
        g.fieldChecklist.pile,
        g.fieldChecklist.vehicle
      ],
      observationTable: g.observationTable,
      logPresenceRules: g.logPresenceRules,
      bstBitRules: g.bstBitRules,
      cstBitRules: g.cstBitRules,
      bemRule: g.bemRule,
      cemRule: g.cemRule,
      verdictThresholds: g.verdictThresholds,
      speedRuleTable: g.speedRuleTable,
      freeVerdictRules: g.freeVerdictRules,
      sohGuide: soh.getTestGuide(),
      impedanceGuide: hvImp.getImpedanceGuide(),
      imbalanceGuide: batteryImbalance.getImbalanceGuide()
    });
  },

  goCaptest() {
    wx.navigateTo({ url: '/pages/cellhealth/cellhealth?mode=soh' });
  },

  onTab(e) {
    var tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab: tab });
  }
});
