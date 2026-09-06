var analyzeUtil = require('../../utils/analyze.js');
var ble = require('../../utils/ble_session.js');
var dcFlow = require('../../utils/dc_flow.js');
var dcSeries = require('../../utils/dc_series.js');
var stateMachine = require('../../utils/state_machine.js');
var membership = require('../../utils/membership.js');
var sessionDigest = require('../../utils/session_digest.js');
var dcSim = require('../../utils/dc_simulator.js');

var EMPTY_VEHICLE = {
  hasData: false,
  vinText: '—',
  vinShort: '—',
  socDisplay: '—',
  socPct: 0,
  currentText: '—',
  currentUnit: '',
  currentSub: '等待车辆报文',
  charging: false,
  ringStyle: 'background: rgba(255,255,255,0.08);',
  ringColor: '#5c6670'
};

var GUN_WAIT_MS = 8000;

/** 仅驱动「插枪通信」栏：阶段定义来自 GB/T 27930 会话状态机 */
function buildGunComm(connected, logText, opts) {
  opts = opts || {};
  var showDetail = !!opts.showDetail;
  var emptyStages = stateMachine.STEP_DEFS.map(function (s) {
    return { key: s.key, title: s.title, status: 'pending', seenText: '' };
  });
  if (!connected) {
    return { gunOk: false, gunText: '未检测', gunNote: '', gunStages: [] };
  }
  var text = String(logText || '').trim();
  if (!text) {
    return {
      gunOk: false,
      gunText: '等待插枪通信',
      gunNote: '采集的是枪线 S+/S- 上的 27930 CAN。未见应用报文时，可能尚未插枪、未上辅助电源，或未开始充电会话。',
      gunStages: emptyStages
    };
  }
  var pack = dcFlow.analyzeDcFlow(text);
  var session = pack.session || {};
  var nodes = session.nodes || [];
  var stages = nodes.map(function (n, i) {
    var def = stateMachine.STEP_DEFS[i] || {};
    var seen = (n.seenCodes || []).filter(Boolean);
    var vip = membership.isVip();
    var showCodes = vip || showDetail;
    return {
      key: n.key,
      title: n.title || def.title,
      status: n.status || 'pending',
      seenText: showCodes ? seen.join(' ') : (seen.length ? seen.length + '项' : '')
    };
  });
  var active = nodes[session.stepIndex] || nodes[0];
  var gunText = '通信中';
  var gunOk = false;
  var gunNote = '';
  if (session.error) {
    gunOk = false;
    gunText = '通信错误 · ' + ((session.stopEvent && session.stopEvent.code) || (active && active.title) || '');
    gunNote = session.lastSummary || '出现 BEM/CEM 等错误报文';
  } else if (session.finished) {
    gunOk = true;
    var stopCode = session.stopEvent && session.stopEvent.code;
    gunText = stopCode ? ('已结束 · ' + stopCode) : '会话结束';
    gunNote = session.lastSummary || '';
  } else if (session.chargeStarted) {
    gunOk = true;
    gunText = '充电中';
    gunNote = '已见 BCL/CCS/BCS 充电循环报文';
  } else if (pack.totalFrames > 0) {
    gunOk = true;
    gunText = (active && active.title) || '进行中';
    var seenNow = (active && active.seenCodes) || [];
    gunNote = seenNow.length
      ? ('当前阶段已见：' + seenNow.join('、'))
      : ((active && active.desc) || '');
  } else {
    gunOk = false;
    gunText = '等待插枪通信';
    gunNote = '日志无可解析的 27930 应用帧';
  }
  return { gunOk: gunOk, gunText: gunText, gunNote: gunNote, gunStages: stages };
}

Page({
  data: {
    connected: false,
    busy: false,
    busyText: '连接中…',
    ctaText: '连接采集盒',
    hwOk: false,
    hwText: '未连接',
    gunOk: false,
    gunText: '未检测',
    gunNote: '',
    gunStages: [],
    frameCount: 0,
    frameText: '0 帧',
    hintText: '请先连接采集盒',
    hintTone: 'warn',
    verdictTitle: '',
    verdictDesc: '',
    verdictTone: '',
    isVip: false,
    showVipGate: false,
    vehicle: EMPTY_VEHICLE,
    batteryCollectMode: '',
    batteryCollectTitle: '',
    isSimulator: false,
    simRunning: false,
    digestHeadline: '',
    digestRows: [],
    digestAlerts: [],
    digestVerdict: ''
  },

  _foundMap: {},
  _scanTimer: null,
  _liveTimer: null,
  _gunTimer: null,
  _lastAnalyzedFrames: 0,
  _wantLive: false,
  _listenSince: 0,

  onShow() {
    var app = getApp();
    var mode = app.globalData.batteryCollectMode || '';
    var titles = { soh: '容量测试进行中', health: '电池体检进行中' };
    this.setData({
      isVip: membership.isVip(),
      batteryCollectMode: mode,
      batteryCollectTitle: mode ? titles[mode] : ''
    });
    this._paintIdleOrResume();
  },

  onHide() {
    try { wx.stopBluetoothDevicesDiscovery({}); } catch (e) {}
    try { wx.offBluetoothDeviceFound(); } catch (e1) {}
  },

  onUnload() {
    this._clearTimers(true);
    try { wx.stopBluetoothDevicesDiscovery({}); } catch (e) {}
    try { wx.offBluetoothDeviceFound(); } catch (e1) {}
  },

  _paintIdleOrResume() {
    var s = ble.state();
    if (s.connected) {
      ble.bindNotifyOnce();
      this._wantLive = true;
      this._listenSince = this._listenSince || Date.now();
      this._updateStatusUi();
      this._startLiveLoop();
      this._armGunWatch();
      return;
    }
    this._wantLive = false;
    this._clearTimers(true);
    this.setData({
      connected: false,
      hwOk: false,
      hwText: '未连接',
      gunOk: false,
      gunText: '未检测',
      gunNote: '',
      gunStages: [],
      frameCount: 0,
      frameText: '0 帧',
      hintText: '未检测到采集盒，请开机后点击连接',
      hintTone: 'warn',
      ctaText: '连接采集盒',
      busy: false,
      verdictTitle: '',
      verdictDesc: '',
      vehicle: EMPTY_VEHICLE
    });
  },

  _clearTimers(all) {
    if (this._scanTimer) {
      clearTimeout(this._scanTimer);
      this._scanTimer = null;
    }
    if (this._gunTimer) {
      clearTimeout(this._gunTimer);
      this._gunTimer = null;
    }
    if (all && this._liveTimer) {
      clearInterval(this._liveTimer);
      this._liveTimer = null;
    }
  },

  _frameCount() {
    var lines = (ble.state().logText || '').split(/\n/).filter(Boolean);
    var n = 0;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].charAt(0) !== '#') n++;
    }
    return n;
  },

  _updateStatusUi() {
    var s = ble.state();
    var connected = !!s.connected;
    var frames = this._frameCount();
    var logText = connected ? ble.exportFrames() : '';
    var isSim = !!s.simulatorMode;
    var simRunning = isSim && (dcSim.isBackgroundPlaying() || frames > 0);
    var showDetail = isSim || simRunning;
    var gun = buildGunComm(connected, logText, { showDetail: showDetail });
    var vehicle = connected
      ? (frames > 0 ? dcSeries.extractVehicleSnapshot(logText) : Object.assign({}, EMPTY_VEHICLE, { currentSub: '等待插枪通信…' }))
      : EMPTY_VEHICLE;
    var digest = frames > 0 ? sessionDigest.buildDigest(logText) : { empty: true, headline: '', rows: [], alerts: [], verdictLine: '' };
    var hintText = '';
    var hintTone = 'idle';
    var ctaText = '连接采集盒';
    var hwText = '未连接';

    if (connected) {
      hwText = isSim ? '模拟器' : '已连接';
    }

    if (!connected) {
      hintText = '未检测到采集盒与手机的连接，请确认采集盒已开机后重试';
      hintTone = 'warn';
      ctaText = '连接采集盒';
    } else if (isSim && !frames) {
      hintText = '模拟器已就绪，请在工具页点开始发送报文';
      hintTone = 'scan';
      ctaText = '刷新分析';
    } else if (!frames) {
      hintText = '采集盒已连接，但还没有 27930 报文。请确认已插枪并开始充电';
      hintTone = 'warn';
      ctaText = '重新检测';
    } else if (digest.verdictLine) {
      hintText = digest.headline;
      hintTone = 'ok';
      ctaText = '刷新分析';
    } else {
      hintText = digest.headline || '已按 GB/T 27930 阶段识别插枪通信';
      hintTone = 'ok';
      ctaText = '刷新分析';
    }

    this.setData({
      connected: connected,
      hwOk: connected,
      hwText: hwText,
      gunOk: gun.gunOk,
      gunText: gun.gunText,
      gunNote: gun.gunNote,
      gunStages: gun.gunStages,
      frameCount: frames,
      frameText: frames + ' 帧',
      hintText: hintText,
      hintTone: hintTone,
      ctaText: ctaText,
      vehicle: vehicle,
      isSimulator: isSim,
      simRunning: simRunning,
      digestHeadline: digest.headline || '',
      digestRows: digest.rows || [],
      digestAlerts: digest.alerts || [],
      digestVerdict: digest.verdictLine || ''
    });
    return frames;
  },

  _setBusy(on, text) {
    this.setData({ busy: !!on, busyText: text || '请稍候…' });
  },

  _armGunWatch() {
    var that = this;
    if (this._gunTimer) {
      clearTimeout(this._gunTimer);
      this._gunTimer = null;
    }
    if (!ble.state().connected) return;
    this._gunTimer = setTimeout(function () {
      if (!that._wantLive || !ble.state().connected) return;
      if (that._frameCount() > 0) return;
      that.setData({
        gunOk: false,
        gunText: '未见插枪通信',
        gunNote: '超时仍无 27930 应用报文。请检查：是否已插枪、辅助电源、S+/S- 是否接到采集盒',
        hintText: '已连接采集盒，但超时仍无充电通信报文',
        hintTone: 'err',
        ctaText: '重新检测'
      });
    }, GUN_WAIT_MS);
  },

  onOneTap() {
    var s = ble.state();
    if (ble.isSimulator()) {
      wx.showModal({
        title: '模拟器运行中',
        content: '请先在「工具 → 直流充电模拟器」停止模拟，再连接真机采集盒。',
        showCancel: false
      });
      return;
    }
    if (s.connected) {
      this._wantLive = true;
      this._listenSince = Date.now();
      this._enterListen();
      this._startLiveLoop();
      this._armGunWatch();
      this._updateStatusUi();
      if (this._frameCount() > 0) this._runLiveAnalyze(true);
      return;
    }
    this._wantLive = true;
    this._foundMap = {};
    this.setData({ verdictTitle: '', verdictDesc: '' });
    this._setBusy(true, '正在连接采集盒…');
    this.setData({
      hintText: '正在检测采集盒连接…',
      hintTone: 'scan',
      hwText: '连接中…',
      hwOk: false,
      gunText: '未检测',
      gunOk: false,
      gunNote: '',
      gunStages: []
    });

    var that = this;
    wx.openBluetoothAdapter({
      success: function () {
        that._startDiscovery();
      },
      fail: function () {
        that._setBusy(false);
        that.setData({
          hwOk: false,
          hwText: '未连接',
          hintText: '手机蓝牙未打开，无法连接采集盒',
          hintTone: 'err',
          ctaText: '连接采集盒'
        });
      }
    });
  },

  _isOurDevice(d) {
    var name = (d.name || d.localName || '').trim();
    if (name.indexOf('Panchong') >= 0 || name.indexOf('判充') >= 0) return true;
    var uuids = d.advertisServiceUUIDs || [];
    for (var i = 0; i < uuids.length; i++) {
      if (ble.normUuid(uuids[i]).indexOf('6E400001') >= 0) return true;
    }
    return false;
  },

  _startDiscovery() {
    var that = this;
    try { wx.offBluetoothDeviceFound(); } catch (e0) {}
    wx.onBluetoothDeviceFound(function (res) {
      (res.devices || []).forEach(function (d) {
        if (!that._isOurDevice(d)) return;
        that._foundMap[d.deviceId] = {
          deviceId: d.deviceId,
          name: (d.name || d.localName || '').trim() || 'PanchongCAN'
        };
      });
      var keys = Object.keys(that._foundMap);
      if (keys.length && !ble.state().connected) {
        var first = that._foundMap[keys[0]];
        that._connect(first.deviceId, first.name);
      }
    });

    var start = function (withSvc) {
      var opt = {
        allowDuplicatesKey: false,
        success: function () {
          that._scanTimer = setTimeout(function () {
            if (!ble.state().connected) {
              that._setBusy(false);
              that.setData({
                hwOk: false,
                hwText: '未连接',
                hintText: '未找到采集盒。请确认采集盒已开机并靠近手机后重试',
                hintTone: 'err',
                ctaText: '连接采集盒'
              });
              try { wx.stopBluetoothDevicesDiscovery({}); } catch (e) {}
            }
          }, 12000);
        },
        fail: function () {
          if (withSvc) return start(false);
          that._setBusy(false);
          that.setData({
            hwOk: false,
            hwText: '未连接',
            hintText: '无法搜索设备，请检查手机蓝牙与权限',
            hintTone: 'err'
          });
        }
      };
      if (withSvc) opt.services = [ble.SVC];
      wx.startBluetoothDevicesDiscovery(opt);
    };
    start(true);
  },

  _connect(deviceId, deviceName) {
    if (ble.state().connected) return;
    var that = this;
    wx.stopBluetoothDevicesDiscovery({});
    if (this._scanTimer) {
      clearTimeout(this._scanTimer);
      this._scanTimer = null;
    }
    wx.createBLEConnection({
      deviceId: deviceId,
      timeout: 10000,
      success: function () {
        var s = ble.state();
        s.connected = true;
        s.deviceId = deviceId;
        s.deviceName = deviceName || 'PanchongCAN';
        ble.bindConnectionMonitorOnce();
        that._discover(deviceId);
      },
      fail: function () {
        that._setBusy(false);
        that.setData({
          hwOk: false,
          hwText: '未连接',
          hintText: '采集盒连接失败，请靠近后重试',
          hintTone: 'err'
        });
      }
    });
  },

  _discover(deviceId) {
    var that = this;
    wx.getBLEDeviceServices({
      deviceId: deviceId,
      success: function (res) {
        var svc = '';
        (res.services || []).forEach(function (item) {
          if (ble.normUuid(item.uuid).indexOf('6E400001') >= 0) svc = item.uuid;
        });
        if (!svc) {
          that._setBusy(false);
          that.setData({
            hintText: '找到的设备不是判充采集盒',
            hintTone: 'err',
            hwText: '未连接',
            hwOk: false
          });
          return;
        }
        ble.state().serviceId = svc;
        wx.getBLEDeviceCharacteristics({
          deviceId: deviceId,
          serviceId: svc,
          success: function (cres) {
            var rx = '';
            var tx = '';
            (cres.characteristics || []).forEach(function (c) {
              var u = ble.normUuid(c.uuid);
              if (u.indexOf('6E400002') >= 0) rx = c.uuid;
              if (u.indexOf('6E400003') >= 0) tx = c.uuid;
            });
            if (!rx || !tx) {
              that._setBusy(false);
              that.setData({
                hintText: '设备协议不匹配',
                hintTone: 'err',
                hwOk: false,
                hwText: '未连接'
              });
              return;
            }
            ble.state().rxId = rx;
            ble.state().txId = tx;
            that._listenNotify(deviceId, svc, tx);
          },
          fail: function () {
            that._setBusy(false);
            that.setData({ hintText: '采集盒连接失败', hintTone: 'err' });
          }
        });
      },
      fail: function () {
        that._setBusy(false);
        that.setData({ hintText: '采集盒连接失败', hintTone: 'err' });
      }
    });
  },

  _listenNotify(deviceId, serviceId, characteristicId) {
    var that = this;
    wx.notifyBLECharacteristicValueChange({
      deviceId: deviceId,
      serviceId: serviceId,
      characteristicId: characteristicId,
      state: true,
      success: function () {
        ble.bindNotifyOnce();
        that._setBusy(false);
        that._listenSince = Date.now();
        that._wantLive = true;
        that._enterListen();
        that._startLiveLoop();
        that._armGunWatch();
        that._updateStatusUi();
      },
      fail: function () {
        that._setBusy(false);
        that.setData({
          hwOk: false,
          hwText: '未连接',
          hintText: '采集盒连接失败',
          hintTone: 'err'
        });
      }
    });
  },

  _enterListen() {
    if (ble.isSimulator()) return;
    ble.writeCmd('listen');
  },

  _startLiveLoop() {
    var that = this;
    if (this._liveTimer) return;
    this._liveTimer = setInterval(function () {
      if (!that._wantLive) return;
      if (!ble.state().connected) {
        that._paintIdleOrResume();
        return;
      }
      var frames = that._updateStatusUi();
      if (frames > 0 && that._gunTimer) {
        clearTimeout(that._gunTimer);
        that._gunTimer = null;
      }
      if (frames >= 3 && frames - that._lastAnalyzedFrames >= (ble.state().simulatorMode ? 1 : 3)) {
        that._runLiveAnalyze(false);
      }
    }, 1000);
  },

  _runLiveAnalyze(toast) {
    var text = ble.exportFrames();
    if (!text) {
      if (toast) {
        this.setData({
          hintText: '还没有报文。请确认已插枪并开始充电',
          hintTone: 'warn'
        });
      }
      return;
    }
    var frames = text.split(/\n/).filter(Boolean).length;
    this._lastAnalyzedFrames = frames;

    var capture = {
      chargeType: 'dc',
      observations: [],
      logText: text,
      note: '现场采集',
      createdAt: Date.now()
    };
    var result = analyzeUtil.analyze(capture);
    var app = getApp();
    app.persistCapture(capture);
    app.persistAnalysis(result);
    app.persistFullTrace(text);
    app.globalData.lastDcFlowLog = text;

    this._updateStatusUi();
    var present = membership.presentVerdict(result);
    this.setData({
      isVip: present.isVip,
      verdictTitle: present.title,
      verdictDesc: present.desc,
      verdictTone: present.key,
      showVipGate: present.locked,
      hintText: present.isVip ? '已完成详细分析' : '免费结论已出 · 详情需会员',
      hintTone: 'ok',
      ctaText: '刷新分析'
    });
    try {
      require('../../utils/cloud_report.js').reportFault(result, capture);
    } catch (e) {}
    if (toast) wx.showToast({ title: '已更新', icon: 'success' });
  },

  onDisconnect() {
    this._wantLive = false;
    this._clearTimers(true);
    ble.disconnect();
    this._paintIdleOrResume();
  },

  _onBleDisconnected() {
    if (ble.isSimulator()) return;
    if (!this.data.connected) return;
    this._wantLive = false;
    this._clearTimers(true);
    this._setBusy(false);
    this.setData({
      connected: false,
      hwOk: false,
      hwText: '已断开',
      gunOk: false,
      gunText: '未检测',
      gunNote: '',
      gunStages: [],
      hintText: '采集盒连接已断开，请重新连接',
      hintTone: 'warn',
      ctaText: '连接采集盒',
      verdictTitle: '',
      verdictDesc: '',
      vehicle: EMPTY_VEHICLE
    });
    wx.showToast({ title: '采集盒已断开', icon: 'none' });
  },

  _onBleSimulatorChange: function () {
    var s = ble.state();
    if (s.connected && s.simulatorMode) {
      this._wantLive = true;
      this._startLiveLoop();
    } else if (!s.connected) {
      this._wantLive = false;
      this._clearTimers(true);
    }
    this._updateStatusUi();
  },

  onOpenVip() {
    wx.navigateTo({ url: '/pages/vip/vip' });
  },

  onOpenFlow() {
    if (!membership.isVip()) {
      wx.navigateTo({ url: '/pages/vip/vip' });
      return;
    }
    var text = ble.exportFrames();
    if (!text) {
      this.setData({
        hintText: '还没有报文，无法查看结果',
        hintTone: 'warn'
      });
      return;
    }
    var app = getApp();
    app.persistFullTrace(text);
    app.globalData.lastDcFlowLog = text;
    this._runLiveAnalyze(false);
    wx.navigateTo({ url: '/pages/result/result' });
  },

  onFinishBatteryCollect: function () {
    var app = getApp();
    var mode = app.globalData.batteryCollectMode;
    if (!mode) return;
    var bc = require('../../utils/battery_collect.js');
    var raw = ble.exportFrames();
    if (!raw) {
      wx.showToast({ title: '还没有报文', icon: 'none' });
      return;
    }
    var filtered = bc.filterLogText(raw, mode);
    var assess = bc.assessCollection(filtered.text, mode);
    var saveAndBack = function () {
      app.globalData.batteryCollectMode = null;
      app.persistBatteryCapture({
        mode: mode,
        rawLineCount: filtered.stats.totalLines,
        filteredText: filtered.text,
        statsSummary: filtered.summary,
        createdAt: Date.now(),
        assess: assess
      });
      wx.navigateBack({
        fail: function () {
          wx.redirectTo({ url: '/pages/cellhealth/cellhealth?mode=' + mode });
        }
      });
    };
    if (!assess.ready) {
      wx.showModal({
        title: '数据可能不够',
        content: (assess.missing && assess.missing[0]) || '建议继续充电采集，或从插枪握手重新开始。',
        confirmText: '仍要完成',
        cancelText: '继续采集',
        success: function (res) {
          if (res.confirm) saveAndBack();
        }
      });
      return;
    }
    saveAndBack();
  }
});
