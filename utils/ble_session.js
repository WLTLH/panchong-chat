/**
 * 采集盒 BLE 会话（跨页面保持连接）
 * 离开 blebox 页不断开；只有点「断开」或主动 close 才释放。
 */
var SVC = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
var RX = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
var TX = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

function state() {
  var app = getApp();
  if (!app.globalData.bleSession) {
    app.globalData.bleSession = {
      connected: false,
      deviceId: '',
      serviceId: '',
      rxId: '',
      txId: '',
      deviceName: '',
      logText: '',
      rxCache: '',
      lineCount: 0,
      byteCount: 0,
      notifyBound: false,
      connectionMonitorBound: false,
      simulatorMode: false
    };
  }
  return app.globalData.bleSession;
}

function notifyPagesRefresh(extra) {
  var pages = getCurrentPages();
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    if (extra === 'disconnect' && typeof p._onBleDisconnected === 'function') {
      p._onBleDisconnected();
    } else if (typeof p._onBleSimulatorChange === 'function') {
      p._onBleSimulatorChange(!!state().simulatorMode);
    }
    if (typeof p._updateStatusUi === 'function') p._updateStatusUi();
    if (typeof p.syncBleUi === 'function') p.syncBleUi();
    if (typeof p._syncCollectProgress === 'function') p._syncCollectProgress();
    if (typeof p.refresh === 'function') p.refresh();
  }
}

function notifyPagesDisconnected() {
  notifyPagesRefresh('disconnect');
}

/** 采集盒意外断开（断电、走远、被系统踢掉） */
function applyRemoteDisconnect(deviceId) {
  var s = state();
  if (s.simulatorMode) return false;
  if (!s.connected) return false;
  if (deviceId && s.deviceId && deviceId !== s.deviceId) return false;
  s.connected = false;
  s.deviceId = '';
  s.serviceId = '';
  s.rxId = '';
  s.txId = '';
  notifyPagesDisconnected();
  return true;
}

function bindConnectionMonitorOnce() {
  var s = state();
  if (s.connectionMonitorBound) return;
  s.connectionMonitorBound = true;
  wx.onBLEConnectionStateChange(function (res) {
    if (res.connected) return;
    applyRemoteDisconnect(res.deviceId);
  });
}

function normUuid(u) {
  return String(u || '').replace(/-/g, '').toUpperCase();
}

function ab2str(buf) {
  var arr = new Uint8Array(buf);
  var out = '';
  for (var i = 0; i < arr.length; i++) out += String.fromCharCode(arr[i]);
  try {
    return decodeURIComponent(escape(out));
  } catch (e) {
    return out;
  }
}

function str2ab(str) {
  var arr = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i) & 0xff;
  return arr.buffer;
}

function appendChunk(text) {
  if (!text) return;
  var s = state();
  s.rxCache += text;
  var parts = s.rxCache.split('\n');
  s.rxCache = parts.pop() || '';
  var added = [];
  for (var i = 0; i < parts.length; i++) {
    var line = parts[i].replace(/\r/g, '').trim();
    if (!line) continue;
    try {
      var app = getApp();
      var mode = app.globalData.batteryCollectMode;
      if (mode) {
        var bc = require('./battery_collect.js');
        if (!bc.isLineNeeded(line, mode)) continue;
      }
    } catch (e) {}
    added.push(line);
  }
  if (!added.length) return false;
  s.logText = s.logText ? s.logText + '\n' + added.join('\n') : added.join('\n');
  if (s.logText.length > 200000) s.logText = s.logText.slice(-180000);
  var lines = s.logText.split(/\n/).filter(Boolean);
  s.lineCount = lines.length;
  s.byteCount = s.logText.length;
  return true;
}

/** 与真机 notify 一致：有新报文时刷新各页 UI / 触发连接页 live 分析 */
function notifyDataChunk() {
  var pages = getCurrentPages();
  if (!pages || !pages.length) return;
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    if (typeof p._updateStatusUi === 'function') p._updateStatusUi();
    if (typeof p.syncBleUi === 'function') p.syncBleUi();
    if (typeof p._syncCollectProgress === 'function') p._syncCollectProgress();
    if (typeof p._syncSimMonitor === 'function') p._syncSimMonitor();
  }
}

function isSimulator() {
  return !!state().simulatorMode;
}

function startSimulator(opts) {
  opts = opts || {};
  var s = state();
  if (s.connected && !s.simulatorMode) {
    disconnect();
  }
  s.simulatorMode = true;
  s.connected = true;
  s.deviceId = '__sim__';
  s.deviceName = opts.name || 'DC充电模拟器';
  s.serviceId = 'sim';
  s.rxId = 'sim';
  s.txId = 'sim';
  if (opts.clear !== false) clearLog();
  notifyPagesRefresh();
  return true;
}

function stopSimulator(opts) {
  opts = opts || {};
  var s = state();
  if (!s.simulatorMode) return false;
  s.simulatorMode = false;
  if (s.deviceId === '__sim__') {
    s.connected = false;
    s.deviceId = '';
    s.serviceId = '';
    s.rxId = '';
    s.txId = '';
    s.deviceName = '';
  }
  if (!opts.silent) notifyPagesRefresh();
  return true;
}

function injectLine(line) {
  if (!state().simulatorMode) return false;
  var text = String(line || '').trim();
  if (!text) return false;
  if (appendChunk(text + '\n')) notifyDataChunk();
  return true;
}

function bindNotifyOnce() {
  var s = state();
  bindConnectionMonitorOnce();
  if (s.notifyBound) return;
  s.notifyBound = true;
  wx.onBLECharacteristicValueChange(function (res) {
    if (appendChunk(ab2str(res.value))) {
      notifyDataChunk();
    }
  });
}

function clearLog() {
  var s = state();
  s.rxCache = '';
  s.logText = '';
  s.lineCount = 0;
  s.byteCount = 0;
}

function exportFrames() {
  var lines = (state().logText || '').split(/\n/);
  var keep = [];
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim();
    if (!t || t.charAt(0) === '#') continue;
    keep.push(t);
  }
  return keep.join('\n');
}

function writeCmd(cmd, done) {
  var s = state();
  if (!s.connected || !s.deviceId || !s.serviceId || !s.rxId) {
    if (typeof done === 'function') done(false);
    return;
  }
  var payload = str2ab(cmd + '\n');
  var tryWrite = function (writeType, next) {
    var opt = {
      deviceId: s.deviceId,
      serviceId: s.serviceId,
      characteristicId: s.rxId,
      value: payload,
      success: function () {
        if (typeof done === 'function') done(true);
      },
      fail: function (err) {
        if (typeof next === 'function') return next(err);
        if (typeof done === 'function') done(false, err);
      }
    };
    if (writeType) opt.writeType = writeType;
    wx.writeBLECharacteristicValue(opt);
  };
  tryWrite('write', function () {
    tryWrite('writeNoResponse', function (err) {
      tryWrite(null, function (err2) {
        if (typeof done === 'function') done(false, err2 || err);
      });
    });
  });
}

function disconnect() {
  var s = state();
  if (s.simulatorMode) {
    stopSimulator({ silent: true });
  }
  try {
    wx.stopBluetoothDevicesDiscovery({});
  } catch (e) {}
  if (s.deviceId) {
    try {
      wx.closeBLEConnection({ deviceId: s.deviceId });
    } catch (e2) {}
  }
  try {
    wx.closeBluetoothAdapter({});
  } catch (e3) {}
  s.connected = false;
  s.deviceId = '';
  s.serviceId = '';
  s.rxId = '';
  s.txId = '';
  s.deviceName = '';
  // 保留 logText，便于导入；notifyBound 保持，下次 open 仍可用
}

function getStats() {
  var s = state();
  return {
    connected: !!s.connected,
    simulatorMode: !!s.simulatorMode,
    lineCount: s.lineCount || 0,
    byteCount: s.byteCount || 0,
    deviceName: s.deviceName || ''
  };
}

function getSessionStatus() {
  var s = state();
  var collectMode = null;
  var bgPlaying = false;
  try {
    var app = getApp();
    collectMode = app.globalData.batteryCollectMode || null;
    bgPlaying = require('./dc_simulator.js').isBackgroundPlaying();
  } catch (e) {}
  return {
    connected: !!s.connected,
    simulatorMode: !!s.simulatorMode,
    lineCount: s.lineCount || 0,
    byteCount: s.byteCount || 0,
    deviceName: s.deviceName || '',
    collectMode: collectMode,
    simRunning: !!s.simulatorMode && (bgPlaying || s.lineCount > 0)
  };
}

module.exports = {
  SVC: SVC,
  RX: RX,
  TX: TX,
  state: state,
  normUuid: normUuid,
  ab2str: ab2str,
  str2ab: str2ab,
  bindNotifyOnce: bindNotifyOnce,
  bindConnectionMonitorOnce: bindConnectionMonitorOnce,
  applyRemoteDisconnect: applyRemoteDisconnect,
  isSimulator: isSimulator,
  startSimulator: startSimulator,
  stopSimulator: stopSimulator,
  injectLine: injectLine,
  getStats: getStats,
  getSessionStatus: getSessionStatus,
  clearLog: clearLog,
  exportFrames: exportFrames,
  writeCmd: writeCmd,
  disconnect: disconnect
};
