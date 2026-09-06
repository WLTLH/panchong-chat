var cloudApi = require('./utils/cloud_api.js');

App({
  globalData: {
    version: '1.0.0',
    appName: '判充',
    /** 云开发环境 ID，见 utils/cloud_config.js；也可在此覆盖 */
    cloudEnvId: '',
    lastCapture: null,
    lastAnalysis: null,
    fullTraceText: '',
    lastDcFlowLog: '',
    lastSeriesPack: null,
    bleSession: null,
    dbcActive: null,
    isVip: false,
    /** 电池体检采集：'soh' | 'health' | null，开启后 BLE 只记必要报文 */
    batteryCollectMode: null,
    lastBatteryCapture: null
  },

  onLaunch() {
    try {
      const capture = wx.getStorageSync('gbt_last_capture');
      const analysis = wx.getStorageSync('gbt_last_analysis');
      const fullTrace = wx.getStorageSync('gbt_full_trace');
      const vip = wx.getStorageSync('panchong_vip');
      if (capture) this.globalData.lastCapture = capture;
      if (analysis) this.globalData.lastAnalysis = analysis;
      if (fullTrace) this.globalData.fullTraceText = fullTrace;
      const batCap = wx.getStorageSync('gbt_battery_capture');
      if (batCap) this.globalData.lastBatteryCapture = batCap;
      this.globalData.isVip = !!vip;
    } catch (e) {
      // storage may be empty on first launch
    }
    cloudApi.init();
    try {
      require('./utils/ble_session.js').bindConnectionMonitorOnce();
    } catch (e) {}
  },

  persistCapture(capture) {
    this.globalData.lastCapture = capture;
    try {
      wx.setStorageSync('gbt_last_capture', capture);
    } catch (e) {}
  },

  persistAnalysis(analysis) {
    this.globalData.lastAnalysis = analysis;
    try {
      wx.setStorageSync('gbt_last_analysis', analysis);
    } catch (e) {}
  },

  persistFullTrace(text) {
    this.globalData.fullTraceText = text || '';
    try {
      wx.setStorageSync('gbt_full_trace', text || '');
    } catch (e) {}
  },

  getFullTrace() {
    const g = this.globalData.fullTraceText;
    if (g && !/^全量\d+帧/.test(String(g).trim())) return g;
    try {
      const s = wx.getStorageSync('gbt_full_trace');
      if (s) {
        this.globalData.fullTraceText = s;
        return s;
      }
    } catch (e) {}
    return g || '';
  },

  persistBatteryCapture(pack) {
    this.globalData.lastBatteryCapture = pack;
    try {
      wx.setStorageSync('gbt_battery_capture', pack);
    } catch (e) {}
  },

  loadBatteryCapture() {
    if (this.globalData.lastBatteryCapture) return this.globalData.lastBatteryCapture;
    try {
      var p = wx.getStorageSync('gbt_battery_capture');
      if (p) this.globalData.lastBatteryCapture = p;
    } catch (e) {}
    return this.globalData.lastBatteryCapture;
  }
});
