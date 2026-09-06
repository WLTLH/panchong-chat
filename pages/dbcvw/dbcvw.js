var dbc = require('../../utils/dbc_analyze.js');
var dbcStore = require('../../utils/dbc_store.js');
var dbcLive = require('../../utils/dbc_live.js');
var dbcDecode = require('../../utils/dbc_decode.js');
var ble = require('../../utils/ble_session.js');
var logIo = require('../../utils/log_io.js');
var dbcSeries = require('../../utils/dbc_series.js');
var filePick = require('../../utils/file_pick.js');

var STORAGE_LAST = 'dbc_view_last_name';
var STORAGE_LOG_NAME = 'dbc_view_last_log_name';

var TAG_LABEL = {};
(dbc.TAG_DEFS || []).forEach(function (t) {
  TAG_LABEL[t.id] = t.label;
});

function decorateList(messages) {
  return (messages || []).map(function (m, idx) {
    return Object.assign({}, m, {
      _idx: idx,
      tagLabels: (m.tags || []).map(function (id) {
        return TAG_LABEL[id] || id;
      })
    });
  });
}

function applyFilter(that) {
  var result = that.data.result;
  if (!result) {
    that.setData({ filtered: [] });
    return;
  }
  var list = dbc.filterMessages(result.messages, {
    q: that.data.query,
    tag: that.data.activeTag
  });
  that.setData({ filtered: decorateList(list) });
}

Page({
  data: {
    result: null,
    filtered: [],
    fileName: '',
    encoding: '',
    query: '',
    activeTag: '',
    nodesText: '',
    showPaste: false,
    pasteText: '',
    detail: null,
    liveDetail: null,
    lastFileName: '',
    canPickChat: true,
    viewMode: 'matrix',
    bleConnected: false,
    bleFrameCount: 0,
    liveFeed: [],
    liveMatched: 0,
    liveUnknown: 0,
    liveMatchedOnly: false,
    liveSource: 'ble',
    logFileName: '',
    logLineCount: 0,
    showLogPaste: false,
    logPasteText: '',
    lastLogFileName: '',
    signalSearchQuery: '',
    signalSearchResults: [],
    chartSignals: [],
    focusSignalKey: '',
    chartHint: '',
    chartPointText: '',
    canvasW: 320,
    canvasH: 220,
    hasLogForChart: false
  },

  _liveSession: null,
  _liveTimer: null,
  _dbcText: '',
  _localLogText: '',
  _signalIndex: [],
  _chartMap: {},

  onReady() {
    var that = this;
    wx.getSystemInfo({
      success: function (res) {
        var w = res.windowWidth - 48;
        that.setData({
          canvasW: w,
          canvasH: Math.round(w * 0.55)
        });
        if (that.data.chartSignals.length) that.drawChart();
      }
    });
  },

  onShow() {
    var last = '';
    var lastLog = '';
    try {
      last = wx.getStorageSync(STORAGE_LAST) || '';
      lastLog = wx.getStorageSync(STORAGE_LOG_NAME) || '';
    } catch (e) {}
    this.setData({
      canPickChat: !!wx.chooseMessageFile,
      lastFileName: last,
      lastLogFileName: lastLog
    });
    this._restoreDbcIfNeeded();
    if (ble.state().connected) ble.bindNotifyOnce();
    if (this.data.result) {
      this._startLiveLoop();
      this._syncLive();
    }
  },

  onHide() {
    this._stopLiveLoop();
  },

  onUnload() {
    this._stopLiveLoop();
  },

  _restoreDbcIfNeeded() {
    if (this.data.result || dbcStore.getActive()) {
      if (!this.data.result && dbcStore.getActive()) {
        var active = dbcStore.getActive();
        this._applyActiveToUi(active);
      }
      return;
    }
    var text = '';
    try {
      text = wx.getStorageSync(dbcStore.STORAGE_TEXT) || '';
    } catch (e) {}
    if (text && dbc.isLikelyDbc(text)) {
      var meta = {};
      try {
        meta = wx.getStorageSync(dbcStore.STORAGE_META) || {};
      } catch (e2) {}
      this._dbcText = text;
      this.applyResult(text, meta.fileName || '上次矩阵.dbc', 'cached', true);
    }
  },

  _applyActiveToUi(active) {
    if (!active) return;
    var result = {
      messageCount: active.messageCount,
      signalCount: active.signalCount,
      nodeCount: active.nodeCount || (active.nodes || []).length,
      nodes: active.nodes || [],
      messages: active.messages || [],
      tagList: active.tagList || [],
      warnings: active.warnings || []
    };
    var nodesText = (active.nodes || []).slice(0, 24).join(' · ');
    if ((active.nodes || []).length > 24) nodesText += ' …';
    this.setData({
      result: result,
      fileName: active.fileName || 'matrix.dbc',
      nodesText: nodesText
    });
    this._liveSession = dbcLive.createSession(active.byId);
    this._signalIndex = dbcSeries.buildSignalIndex(result.messages);
    applyFilter(this);
  },

  _getById() {
    var active = dbcStore.getActive();
    if (active && active.byId) return active.byId;
    if (this._liveSession && this._liveSession.byId) return this._liveSession.byId;
    return {};
  },

  _getLogText() {
    if (this.data.liveSource === 'local' && this._localLogText) return this._localLogText;
    if (this._localLogText) return this._localLogText;
    return ble.exportFrames() || (ble.state().logText || '');
  },

  _updateChartLogFlag() {
    var has = !!String(this._getLogText() || '').trim();
    if (has !== this.data.hasLogForChart) {
      this.setData({ hasLogForChart: has });
    }
    return has;
  },

  _startLiveLoop() {
    var that = this;
    if (this._liveTimer) return;
    this._liveTimer = setInterval(function () {
      if (that.data.liveSource === 'local') return;
      that._syncLive();
    }, 600);
  },

  _stopLiveLoop() {
    if (this._liveTimer) {
      clearInterval(this._liveTimer);
      this._liveTimer = null;
    }
  },

  _syncLive() {
    if (!this._liveSession || !this.data.result) return;
    var s = ble.state();
    var pack;
    if (this.data.liveSource === 'local') {
      pack = dbcLive.loadLogText(this._liveSession, this._localLogText || '');
    } else {
      pack = dbcLive.processLogText(this._liveSession, s.logText || '');
    }
    var feed = pack.feed || [];
    if (this.data.liveMatchedOnly) {
      feed = feed.filter(function (x) {
        return x.matched;
      });
    }
    this.setData({
      bleConnected: !!s.connected,
      bleFrameCount: s.lineCount || 0,
      logLineCount: logIo.lineCount(this._localLogText || ''),
      liveFeed: feed,
      liveMatched: pack.matched,
      liveUnknown: pack.unknown
    });
    this._updateChartLogFlag();
  },

  onSwitchLiveSource(e) {
    var src = e.currentTarget.dataset.src;
    if (!src || src === this.data.liveSource) return;
    this.setData({ liveSource: src, viewMode: 'live' });
    if (this._liveSession) dbcLive.resetSession(this._liveSession);
    this._startLiveLoop();
    this._syncLive();
  },

  onPickLogFile() {
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
        if (err && err.errMsg && err.errMsg.indexOf('unsupported') >= 0) {
          wx.showToast({ title: '请用粘贴报文', icon: 'none' });
          that.setData({ showLogPaste: true });
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
            that.applyLocalLog(norm.text, name, norm.format, norm.frameCount);
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

  applyLocalLog(text, name, logFormat, frameHint) {
    if (!this.data.result || !this._liveSession) {
      wx.hideLoading();
      wx.showToast({ title: '请先加载 DBC', icon: 'none' });
      return;
    }
    this._localLogText = String(text || '');
    var lines = frameHint || logIo.lineCount(this._localLogText);
    var pack = dbcLive.loadLogText(this._liveSession, this._localLogText);
    var feed = pack.feed || [];
    if (this.data.liveMatchedOnly) {
      feed = feed.filter(function (x) {
        return x.matched;
      });
    }
    var fmtLabel = logIo.formatLabel(logFormat || 'plain');
    wx.hideLoading();
    this.setData({
      liveSource: 'local',
      viewMode: 'live',
      logFileName: (name || '本地报文') + (logFormat && logFormat !== 'plain' ? ' · ' + fmtLabel : ''),
      logLineCount: lines,
      liveFeed: feed,
      liveMatched: pack.matched,
      liveUnknown: pack.unknown,
      showLogPaste: false
    });
    try {
      wx.setStorageSync(STORAGE_LOG_NAME, name || '');
    } catch (e) {}
    wx.showToast({
      title: fmtLabel + ' · 匹配 ' + pack.matched + ' 条',
      icon: 'none'
    });
    this._updateChartLogFlag();
    if (this.data.viewMode === 'chart') this._refreshChart();
  },

  onToggleLogPaste() {
    this.setData({ showLogPaste: !this.data.showLogPaste });
  },

  onLogPasteInput(e) {
    this.setData({ logPasteText: e.detail.value || '' });
  },

  onParseLogPaste() {
    var text = this.data.logPasteText || '';
    if (!String(text).trim()) {
      wx.showToast({ title: '请先粘贴报文', icon: 'none' });
      return;
    }
    if (!logIo.isLikelyCanLog(text)) {
      wx.showToast({ title: '内容不像 CAN 日志', icon: 'none' });
      return;
    }
    var norm = logIo.normalizeCanLog(text, 'paste.txt');
    if (!norm.ok) {
      wx.showToast({ title: '无法解析报文', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '解码中' });
    this.applyLocalLog(norm.text, '粘贴报文.txt', norm.format, norm.frameCount);
  },

  onImportBleLog() {
    var text = ble.exportFrames() || '';
    if (!String(text).trim()) {
      wx.showToast({ title: '蓝牙会话无报文', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '解码中' });
    var norm = logIo.normalizeCanLog(text, 'ble.log');
    this.applyLocalLog(norm.ok ? norm.text : text, '蓝牙会话.log', norm.format || 'plain', norm.frameCount);
  },

  syncBleUi() {
    this._syncLive();
  },

  onSwitchMode(e) {
    var mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.viewMode) return;
    this.setData({ viewMode: mode });
    if (mode === 'live') {
      this._startLiveLoop();
      this._syncLive();
    } else if (mode === 'chart') {
      this._updateChartLogFlag();
      this._runSignalSearch(this.data.signalSearchQuery);
      var that = this;
      setTimeout(function () {
        that._refreshChart();
      }, 80);
    }
  },

  onSignalSearch(e) {
    var q = e.detail.value || '';
    this.setData({ signalSearchQuery: q });
    this._runSignalSearch(q);
  },

  _runSignalSearch(q) {
    if (!this._signalIndex.length && this.data.result) {
      this._signalIndex = dbcSeries.buildSignalIndex(this.data.result.messages);
    }
    var list = dbcSeries.searchSignals(this._signalIndex, q, 50);
    this.setData({ signalSearchResults: list });
  },

  onAddChartSignal(e) {
    var key = e.currentTarget.dataset.key;
    if (!key) return;
    if (!this._updateChartLogFlag()) {
      wx.showToast({ title: '请先加载报文', icon: 'none' });
      return;
    }
    var exists = (this.data.chartSignals || []).some(function (s) {
      return s.key === key;
    });
    if (exists) {
      this.setData({ focusSignalKey: key });
      this.drawChart();
      return;
    }
    wx.showLoading({ title: '生成曲线' });
    var that = this;
    setTimeout(function () {
      that._addChartSignal(key);
      wx.hideLoading();
    }, 20);
  },

  _addChartSignal(key) {
    var series = dbcSeries.buildSignalSeries(this._getLogText(), this._getById(), key);
    if (!series || !series.pointCount) {
      wx.showToast({ title: '报文中无此信号', icon: 'none' });
      return;
    }
    this._chartMap[key] = series;
    var color = dbcSeries.CHART_COLORS[(this.data.chartSignals || []).length % dbcSeries.CHART_COLORS.length];
    var meta = {
      key: key,
      label: series.label,
      sigName: series.sigName,
      unit: series.unit,
      color: color,
      pointCount: series.pointCount,
      isEnum: series.isEnum
    };
    var list = (this.data.chartSignals || []).concat([meta]);
    this.setData({
      chartSignals: list,
      focusSignalKey: key,
      chartHint: series.pointCount + ' 点'
    });
    this.drawChart();
  },

  onRemoveChartSignal(e) {
    var key = e.currentTarget.dataset.key;
    if (!key) return;
    delete this._chartMap[key];
    var list = (this.data.chartSignals || []).filter(function (s) {
      return s.key !== key;
    });
    var focus = this.data.focusSignalKey === key ? '' : this.data.focusSignalKey;
    this.setData({ chartSignals: list, focusSignalKey: focus });
    this.drawChart();
  },

  onFocusChartSignal(e) {
    var key = e.currentTarget.dataset.key;
    if (!key) return;
    var next = this.data.focusSignalKey === key ? '' : key;
    this.setData({ focusSignalKey: next });
    this.drawChart();
  },

  onClearChart() {
    this._chartMap = {};
    this.setData({
      chartSignals: [],
      focusSignalKey: '',
      chartHint: '',
      chartPointText: ''
    });
    this.drawChart();
  },

  onRefreshChart() {
    if (!(this.data.chartSignals || []).length) {
      wx.showToast({ title: '请先添加信号', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '刷新曲线' });
    var that = this;
    setTimeout(function () {
      that._refreshChart();
      wx.hideLoading();
    }, 20);
  },

  _refreshChart() {
    this._updateChartLogFlag();
    var log = this._getLogText();
    var byId = this._getById();
    var list = this.data.chartSignals || [];
    var nextMap = {};
    for (var i = 0; i < list.length; i++) {
      var s = dbcSeries.buildSignalSeries(log, byId, list[i].key);
      if (s && s.pointCount) nextMap[list[i].key] = s;
    }
    this._chartMap = nextMap;
    this.drawChart();
  },

  drawChart() {
    var ctx = wx.createCanvasContext('dbcChart', this);
    var W = this.data.canvasW;
    var H = this.data.canvasH;
    var padL = 42;
    var padR = 16;
    var padT = 18;
    var padB = 28;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    ctx.setFillStyle('#FAFBFC');
    ctx.fillRect(0, 0, W, H);

    var all = this.data.chartSignals || [];
    var focus = this.data.focusSignalKey;
    var visible = all.filter(function (m) {
      return !focus || m.key === focus;
    });

    if (!visible.length) {
      ctx.setFillStyle('#8A96A8');
      ctx.setFontSize(12);
      ctx.fillText('搜索信号并加入曲线', padL, padT + 40);
      ctx.draw();
      return;
    }

    var seriesList = [];
    var tMin = Infinity;
    var tMax = 0;
    var vMin = Infinity;
    var vMax = -Infinity;
    var lastText = '';

    for (var i = 0; i < visible.length; i++) {
      var meta = visible[i];
      var raw = this._chartMap[meta.key];
      if (!raw || !raw.points.length) continue;
      var pts = dbcSeries.downsample(raw.points, 600);
      seriesList.push({ meta: meta, points: pts });
      for (var j = 0; j < pts.length; j++) {
        var p = pts[j];
        tMin = Math.min(tMin, p.tMs);
        tMax = Math.max(tMax, p.tMs);
        if (p.phys != null && !isNaN(p.phys)) {
          vMin = Math.min(vMin, p.phys);
          vMax = Math.max(vMax, p.phys);
        }
      }
      var last = raw.points[raw.points.length - 1];
      lastText += meta.label + '=' + last.text + '  ';
    }

    if (!seriesList.length) {
      ctx.setFillStyle('#8A96A8');
      ctx.setFontSize(12);
      ctx.fillText('报文中未找到数据点', padL, padT + 40);
      ctx.draw();
      return;
    }

    if (vMin === vMax) {
      vMin -= 1;
      vMax += 1;
    } else {
      var padV = (vMax - vMin) * 0.08;
      vMin -= padV;
      vMax += padV;
    }
    if (!isFinite(tMin)) tMin = 0;
    if (tMax <= tMin) tMax = tMin + 1000;
    var totalMs = tMax - tMin;

    ctx.setStrokeStyle('#EAEAEA');
    ctx.setLineWidth(1);
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (plotH * g) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + plotW, gy);
      ctx.stroke();
    }

    function xOf(t) {
      return padL + ((t - tMin) / totalMs) * plotW;
    }
    function yOf(v) {
      return padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
    }

    ctx.setFillStyle('#888');
    ctx.setFontSize(10);
    ctx.fillText(String(Math.round(vMax * 100) / 100), 4, padT + 8);
    ctx.fillText(String(Math.round(vMin * 100) / 100), 4, padT + plotH);
    ctx.fillText('0', padL, H - 6);
    ctx.fillText(dbcSeries.fmtMs(totalMs), padL + plotW - 36, H - 6);

    for (var s = 0; s < seriesList.length; s++) {
      var item = seriesList[s];
      ctx.setStrokeStyle(item.meta.color);
      ctx.setLineWidth(focus ? 2.5 : 2);
      if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.beginPath();
      var started = false;
      for (var k = 0; k < item.points.length; k++) {
        var pt = item.points[k];
        if (pt.phys == null || isNaN(pt.phys)) continue;
        var x = xOf(pt.tMs);
        var y = yOf(pt.phys);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      if (started) ctx.stroke();
    }

    ctx.draw();
    this.setData({
      chartPointText: lastText.trim(),
      chartHint: seriesList.length + ' 条曲线 · ' + dbcSeries.fmtMs(totalMs)
    });
  },

  onPickChatFile() {
    var that = this;
    filePick.showPickSheet('DBC', {
      chat: function () { that._pickDbcFromChat(); },
      local: function () { that._pickDbcFromLocal(); }
    });
  },

  _pickDbcFromChat() {
    var that = this;
    filePick.pickChatDocument({}, function (ok, f, err) {
      if (!ok) {
        if (filePick.isCancel(err)) return;
        if (err && err.tip) {
          wx.showToast({ title: err.tip, icon: 'none' });
          return;
        }
        if (err && err.errMsg && err.errMsg.indexOf('unsupported') >= 0) {
          wx.showModal({
            title: '当前环境不支持',
            content: '请升级微信，或使用下方「粘贴 DBC 文本」。',
            showCancel: false
          });
          that.setData({ showPaste: true });
          return;
        }
        wx.showToast({ title: '未选到文件', icon: 'none' });
        return;
      }
      that.readAndParse(f.path, f.name || 'matrix.dbc', f.size);
    });
  },

  _pickDbcFromLocal() {
    var that = this;
    filePick.pickLocalDocument({}, function (ok, f, err) {
      if (!ok) {
        if (filePick.isCancel(err)) return;
        wx.showToast({ title: '未选到文件', icon: 'none' });
        return;
      }
      that.readAndParse(f.path, f.name || 'matrix.dbc', f.size);
    });
  },

  readAndParse(filePath, name, size) {
    var that = this;
    if (size && size > 8 * 1024 * 1024) {
      wx.showModal({
        title: '文件较大',
        content: '超过 8MB，解析可能较慢或失败。仍要打开？',
        success: function (res) {
          if (res.confirm) that._readFile(filePath, name);
        }
      });
      return;
    }
    this._readFile(filePath, name);
  },

  _readFile(filePath, name) {
    var that = this;
    wx.showLoading({ title: '读取中' });
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      success: function (res) {
        try {
          var dec = dbc.decodeDbcBytes(res.data);
          if (!dbc.isLikelyDbc(dec.text)) {
            wx.hideLoading();
            wx.showModal({
              title: '不像 DBC 文件',
              content: '「' + name + '」里没有识别到 BO_/SG_ 报文定义。请确认选的是 .dbc 矩阵文件。',
              showCancel: false
            });
            return;
          }
          that.applyResult(dec.text, name, dec.encoding);
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '解析失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '读取失败', icon: 'none' });
      }
    });
  },

  applyResult(text, name, encoding, silent) {
    var result;
    try {
      result = dbc.analyzeDbcText(text, { fileName: name });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: 'DBC 格式异常', icon: 'none' });
      return;
    }
    wx.hideLoading();
    if (!result.messageCount) {
      wx.showModal({
        title: '未解析到报文',
        content: '文件已读取，但没有 BO_ 报文。请换一份 DBC 再试。',
        showCancel: false
      });
      return;
    }
    this._dbcText = text;
    dbcStore.setActive(result, name, text);
    this._liveSession = dbcLive.createSession(dbcDecode.buildIdIndex(result.messages));
    dbcLive.resetSession(this._liveSession);
    this._liveSession.byId = dbcDecode.buildIdIndex(result.messages);
    this._signalIndex = dbcSeries.buildSignalIndex(result.messages);
    this._chartMap = {};

    var nodesText = (result.nodes || []).slice(0, 24).join(' · ');
    if ((result.nodes || []).length > 24) nodesText += ' …';
    var goLive = !!ble.state().connected;
    this.setData({
      result: result,
      fileName: name || '未命名.dbc',
      encoding: encoding || '',
      nodesText: nodesText,
      query: '',
      activeTag: '',
      detail: null,
      liveDetail: null,
      showPaste: false,
      lastFileName: name || '',
      viewMode: goLive ? 'live' : 'matrix',
      liveFeed: [],
      liveMatched: 0,
      liveUnknown: 0,
      signalSearchQuery: '',
      signalSearchResults: [],
      chartSignals: [],
      focusSignalKey: '',
      chartHint: '',
      chartPointText: ''
    });
    applyFilter(this);
    this._startLiveLoop();
    this._syncLive();
    try {
      wx.setStorageSync(STORAGE_LAST, name || '');
    } catch (e2) {}
    if (!silent) {
      wx.showToast({
        title: goLive ? '已载入，实时解码中' : result.messageCount + ' 条报文',
        icon: 'none'
      });
    }
  },

  onTogglePaste() {
    this.setData({ showPaste: !this.data.showPaste });
  },

  onPasteInput(e) {
    this.setData({ pasteText: e.detail.value || '' });
  },

  onParsePaste() {
    var text = this.data.pasteText || '';
    if (!String(text).trim()) {
      wx.showToast({ title: '请先粘贴', icon: 'none' });
      return;
    }
    if (!dbc.isLikelyDbc(text)) {
      wx.showToast({ title: '内容不像 DBC', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '解析中' });
    this.applyResult(text, '粘贴.dbc', 'text');
  },

  onLoadDemo() {
    wx.showLoading({ title: '解析中' });
    this.applyResult(dbc.getDemoDbc(), '演示矩阵.dbc', 'utf-8');
  },

  onReset() {
    this._stopLiveLoop();
    dbcStore.clearActive();
    this._liveSession = null;
    this._dbcText = '';
    this._localLogText = '';
    this.setData({
      result: null,
      filtered: [],
      detail: null,
      liveDetail: null,
      query: '',
      activeTag: '',
      viewMode: 'matrix',
      liveFeed: [],
      liveMatched: 0,
      liveUnknown: 0,
      liveSource: 'ble',
      logFileName: '',
      logLineCount: 0,
      signalSearchQuery: '',
      signalSearchResults: [],
      chartSignals: [],
      focusSignalKey: '',
      chartHint: '',
      chartPointText: '',
      hasLogForChart: false
    });
    this._signalIndex = [];
    this._chartMap = {};
  },

  onGoBle() {
    wx.switchTab({ url: '/pages/dcflow/dcflow' });
  },

  onClearLive() {
    if (this._liveSession) dbcLive.resetSession(this._liveSession);
    this.setData({ liveFeed: [], liveMatched: 0, liveUnknown: 0 });
  },

  onResyncLive() {
    if (!this._liveSession) return;
    if (this.data.liveSource === 'local') {
      if (!this._localLogText) {
        wx.showToast({ title: '请先加载本地报文', icon: 'none' });
        return;
      }
      dbcLive.loadLogText(this._liveSession, this._localLogText);
    } else {
      dbcLive.resetSession(this._liveSession);
    }
    this._syncLive();
    wx.showToast({ title: '已重新解码', icon: 'none' });
  },

  onToggleMatchedOnly() {
    var next = !this.data.liveMatchedOnly;
    this.setData({ liveMatchedOnly: next });
    this._syncLive();
  },

  onQuery(e) {
    this.setData({ query: e.detail.value || '' });
    applyFilter(this);
  },

  onTag(e) {
    var tag = e.currentTarget.dataset.tag;
    if (tag == null) tag = '';
    this.setData({ activeTag: tag });
    applyFilter(this);
  },

  onOpenMsg(e) {
    var index = e.currentTarget.dataset.index;
    var list = this.data.filtered || [];
    var msg = list[index];
    if (!msg) return;
    this.setData({ detail: msg, liveDetail: null });
  },

  onOpenLive(e) {
    var index = e.currentTarget.dataset.index;
    var item = (this.data.liveFeed || [])[index];
    if (!item || !item.matched) return;
    this.setData({
      liveDetail: item,
      detail: null
    });
  },

  onCloseDetail() {
    this.setData({ detail: null, liveDetail: null });
  }
});
