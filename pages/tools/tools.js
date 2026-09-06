var ble = require('../../utils/ble_session.js');
var sessionDigest = require('../../utils/session_digest.js');
var dcSim = require('../../utils/dc_simulator.js');

Page({
  data: {
    entries: [
      {
        id: 'dcsim',
        title: '直流充电模拟器',
        desc: '无采集盒 · 可设时长/采集模式 · 压测各工具',
        url: '/pages/dcsim/dcsim'
      },
      {
        id: 'cellhealth_soh',
        title: '容量测试',
        desc: '充一次电，估算电池还能存多少电',
        url: '/pages/cellhealth/cellhealth?mode=soh'
      },
      {
        id: 'cellhealth',
        title: '电芯鉴康',
        desc: '全面体检：容量、老化与电芯平衡',
        url: '/pages/cellhealth/cellhealth?mode=health'
      },
      {
        id: 'abcompare',
        title: '异同镜',
        desc: '异常与正常各采一段，对照哪条 ID 或数据在变',
        url: '/pages/abcompare/abcompare'
      },
      {
        id: 'dbcvw',
        title: '矩览',
        desc: '加载 DBC 与报文，搜索信号并画曲线观察变化',
        url: '/pages/dbcvw/dbcvw'
      },
      {
        id: 'verdictguide',
        title: '判定手册',
        desc: '桩/车/连接检查表、报文打分与裁决规则',
        url: '/pages/verdictguide/verdictguide'
      }
    ],
    hasSession: false,
    sessionTag: '',
    sessionHeadline: '',
    sessionRows: [],
    sessionAlerts: [],
    sessionVerdict: '',
    lineCount: 0
  },

  onShow: function () {
    this._refreshSession();
    if (!this._timer) {
      var that = this;
      this._timer = setInterval(function () {
        that._refreshSession();
      }, 1500);
    }
  },

  onHide: function () {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  onUnload: function () {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  _refreshSession: function () {
    var st = ble.getSessionStatus();
    var text = ble.exportFrames();
    var digest = text ? sessionDigest.buildDigest(text) : null;
    var collectMode = st.collectMode;
    var tag = '';
    if (st.simulatorMode) tag = dcSim.isBackgroundPlaying() ? '模拟进行中' : '模拟器';
    else if (st.connected) tag = '已连接';
    var modeLabel = collectMode === 'soh' ? '容量测试采集中' : (collectMode === 'health' ? '体检采集中' : '');

    this.setData({
      hasSession: !!(st.connected || st.lineCount > 0),
      sessionTag: tag + (modeLabel ? ' · ' + modeLabel : ''),
      sessionHeadline: digest ? digest.headline : (st.lineCount ? '有数据，待解析' : '暂无报文'),
      sessionRows: digest ? digest.rows : [],
      sessionAlerts: digest ? digest.alerts : [],
      sessionVerdict: digest ? digest.verdictLine : '',
      lineCount: st.lineCount || 0
    });
  },

  _syncCollectProgress: function () {
    this._refreshSession();
  },

  goConnect: function () {
    wx.switchTab({ url: '/pages/dcflow/dcflow' });
  },

  onEntry: function (e) {
    var url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.navigateTo({ url: url });
  }
});
