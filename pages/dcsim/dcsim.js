var sim = require('../../utils/dc_simulator.js');
var ble = require('../../utils/ble_session.js');
var analyzeUtil = require('../../utils/analyze.js');
var membership = require('../../utils/membership.js');

function fmtBytes(n) {
  n = n || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

Page({
  data: {
    groups: [],
    durationPresets: [],
    quickPresets: [],
    tickPresets: [],
    collectModes: [],
    playModes: [],
    failureModes: [],
    failAtPresets: [],
    activeId: 'soh_charge',
    activeTitle: '',
    activeDesc: '',
    durationId: '1440',
    durationMin: 1440,
    customMin: '',
    tickSec: 60,
    collectMode: 'soh',
    playMode: 'timeline',
    failMode: 'none',
    failAtId: '300',
    failAtMin: '',
    failAtSecRem: '',
    failExpectText: '',
    monitorText: '',
    monitorTone: '',
    playing: false,
    speed: 20,
    progressPct: 0,
    progressText: '0 / 0 帧',
    statusText: '可用快捷预设：SOH 24小时 / 电池 30天',
    autoGoConnect: true,
    estimateText: '',
    warnText: '',
    liveText: '',
    simClock: '0',
    wallClock: '0'
  },

  onLoad: function () {
    var groups = sim.SCENARIO_GROUPS.map(function (g) {
      return {
        id: g.id,
        title: g.title,
        items: (g.items || []).map(function (it) {
          return { id: it.id, title: it.title, desc: it.desc };
        })
      };
    });
    this._player = null;
    this._instantJob = null;
    this._statsTimer = null;
    this._plan = null;
    this.setData({
      groups: groups,
      durationPresets: sim.DURATION_PRESETS,
      quickPresets: sim.QUICK_PRESETS,
      tickPresets: sim.TICK_PRESETS,
      collectModes: sim.COLLECT_MODES,
      playModes: sim.PLAY_MODES,
      failureModes: sim.FAILURE_MODES,
      failAtPresets: sim.FAIL_AT_PRESETS
    });
    this._selectScenario('soh_charge');
    this._refreshEstimate();
  },

  onUnload: function () {
    this._stopStatsTimer();
    sim.detachBackgroundUi();
    this._player = null;
    this._instantJob = null;
  },

  _resolveFailAtSec: function () {
    if (this.data.failAtId !== 'custom') {
      for (var i = 0; i < sim.FAIL_AT_PRESETS.length; i++) {
        if (sim.FAIL_AT_PRESETS[i].id === this.data.failAtId) {
          return sim.FAIL_AT_PRESETS[i].sec;
        }
      }
    }
    var min = parseInt(this.data.failAtMin, 10) || 0;
    var sec = parseInt(this.data.failAtSecRem, 10) || 0;
    return min * 60 + sec;
  },

  _runOpts: function () {
    var durationMin = this.data.durationMin;
    if (this.data.durationId === 'custom') {
      durationMin = parseInt(this.data.customMin, 10);
      if (!isFinite(durationMin) || durationMin <= 0) durationMin = 1440;
    }
    return {
      durationMin: durationMin,
      collectMode: this.data.collectMode,
      tickSec: this.data.tickSec,
      failMode: this.data.failMode,
      failAtSec: this._resolveFailAtSec()
    };
  },

  _rebuildPlan: function () {
    this._plan = sim.resolveRunPlan(this.data.activeId, this._runOpts());
    return this._plan;
  },

  _refreshEstimate: function () {
    var plan = this._rebuildPlan();
    var est = plan.estimate;
    if (!est) {
      this.setData({ estimateText: '', warnText: '' });
      return;
    }
    var dur = this._runOpts().durationMin;
    var lines = [
      '预计 ' + est.totalFrames.toLocaleString() + ' 帧',
      '模拟 ' + sim.fmtDuration(dur || est.simMin),
      '每 ' + this.data.tickSec + ' 秒一拍',
      this.data.collectMode === 'all'
        ? ('体积约 ' + fmtBytes(est.rawBytes))
        : ('过滤后约 ' + est.keptFrames.toLocaleString() + ' 帧 / ' + fmtBytes(est.keptBytes))
    ];
    var warn = '';
    if (est.procedural) {
      warn = '长测使用动态生成，不占内存；';
    }
    if (est.trimOver) {
      warn += '写入量远超 ' + fmtBytes(sim.LOG_TRIM_MAX) + '，日志会滚动截断（仅留尾部）— 这正是要验证的';
    } else     if (est.trimWarn) {
      warn += '接近日志上限，注意观察截断与性能';
    }
    var failExpectText = '';
    if (plan.failInject) {
      failExpectText = '失效 @ ' + sim.fmtSimClock(plan.failInject.atMs) +
        ' · ' + plan.failInject.expect;
    }
    this.setData({
      estimateText: lines.join(' · '),
      warnText: warn,
      failExpectText: failExpectText
    });
  },

  onShow: function () {
    var bg = sim.getBackgroundState();
    if (bg.hasPlayer) {
      this._player = bg.player || null;
      this._instantJob = bg.instantJob || null;
      this._startStatsTimer();
      this.setData({ playing: !!bg.playing });
      if (bg.progress) {
        var p = bg.progress;
        this.setData({
          progressPct: p.total ? Math.round(p.sent / p.total * 100) : 0,
          progressText: (p.sent || 0).toLocaleString() + ' / ' + (p.total || 0).toLocaleString() + ' 帧',
          statusText: bg.playing ? ('后台模拟中 · ' + sim.fmtSimClock(p.simMs || 0)) : '模拟完成',
          simClock: sim.fmtSimClock(p.simMs || 0),
          wallClock: sim.fmtSimClock(p.wallMs || 0)
        });
      }
    }
  },

  _destroyPlayer: function (stopBg) {
    if (stopBg) {
      sim.stopBackgroundRun();
    }
    this._player = null;
    this._instantJob = null;
  },

  _afterSimStartNav: function () {
    if (!this.data.autoGoConnect) return;
    if (this.data.collectMode === 'soh') {
      wx.navigateTo({ url: '/pages/cellhealth/cellhealth?mode=soh' });
      return;
    }
    if (this.data.collectMode === 'health') {
      wx.navigateTo({ url: '/pages/cellhealth/cellhealth?mode=health' });
      return;
    }
    wx.switchTab({ url: '/pages/dcflow/dcflow' });
  },

  _stopStatsTimer: function () {
    if (this._statsTimer) {
      clearInterval(this._statsTimer);
      this._statsTimer = null;
    }
  },

  _startStatsTimer: function () {
    var that = this;
    this._stopStatsTimer();
    this._statsTimer = setInterval(function () {
      that._syncLiveStats();
    }, 500);
  },

  _syncSimMonitor: function () {
    if (!this.data.playing && !ble.isSimulator()) return;
    this._syncLiveStats();
    this._refreshVerdictMonitor();
  },

  _verdictMatchesExpect: function (label, expect) {
    if (!label || !expect) return false;
    if (expect.indexOf('倾向桩端') >= 0) return label.indexOf('桩') >= 0;
    if (expect.indexOf('倾向车端') >= 0) return label.indexOf('车') >= 0;
    if (expect.indexOf('倾向连接') >= 0) return label.indexOf('连接') >= 0;
    if (expect.indexOf('位域细判') >= 0) return label.indexOf('混杂') >= 0 || label.indexOf('连接') >= 0 || label.indexOf('桩') >= 0 || label.indexOf('车') >= 0;
    if (expect.indexOf('正常') >= 0) return label.indexOf('不足') >= 0 || label.indexOf('正常') >= 0 || label.indexOf('混杂') >= 0;
    return false;
  },

  _refreshVerdictMonitor: function () {
    var text = ble.exportFrames();
    if (!text || text.split(/\n/).filter(Boolean).length < 3) {
      this.setData({ monitorText: '等待报文…', monitorTone: 'idle' });
      return;
    }
    var result = analyzeUtil.analyze({
      chargeType: 'dc',
      observations: [],
      logText: text,
      note: '模拟监控',
      createdAt: Date.now()
    });
    var present = membership.presentVerdict(result);
    var label = present.title || result.verdict.label || '—';
    var expect = this.data.failExpectText || '';
    var failMode = this.data.failMode;
    var monitorText = '实时裁决：' + label;
    var monitorTone = 'ok';
    if (failMode && failMode !== 'none') {
      var hit = this._verdictMatchesExpect(label, expect);
      monitorText += hit ? ' ✓ 与预期一致' : ' ✗ 与预期不符';
      monitorTone = hit ? 'ok' : 'warn';
      if (!hit && expect) monitorText += '（预期：' + expect.split('·').pop().trim() + '）';
    }
    this.setData({ monitorText: monitorText, monitorTone: monitorTone });
  },

  _syncLiveStats: function (extra) {
    extra = extra || {};
    var st = ble.getStats();
    var live = '已写入 ' + st.lineCount.toLocaleString() + ' 行 · ' + fmtBytes(st.byteCount);
    if (st.byteCount >= sim.LOG_TRIM_MAX * 0.95) {
      live += ' · 已在截断区滚动';
    } else if (st.byteCount > sim.LOG_TRIM_WARN) {
      live += ' · 接近上限';
    }
    this.setData({
      liveText: live,
      simClock: sim.fmtSimClock(extra.simMs || 0),
      wallClock: sim.fmtSimClock(extra.wallMs || 0)
    });
    if (this.data.playing) this._refreshVerdictMonitor();
  },

  _bindPlayerHandlers: function (est) {
    var that = this;
    return {
      onLine: function (line) {
        ble.injectLine(line);
      },
      onProgress: function (p) {
        sim.touchBackgroundProgress(p);
        var pct = p.total ? Math.round(p.sent / p.total * 100) : 0;
        that.setData({
          progressPct: pct,
          progressText: p.sent.toLocaleString() + ' / ' + p.total.toLocaleString() + ' 帧',
          statusText: p.playing ? ('发送中 · 模拟 ' + sim.fmtSimClock(p.simMs)) : '已暂停',
          simClock: sim.fmtSimClock(p.simMs),
          wallClock: sim.fmtSimClock(p.wallMs)
        });
        that._syncLiveStats(p);
        that._refreshVerdictMonitor();
      },
      onDone: function () {
        sim.touchBackgroundProgress({ playing: false, sent: est.totalFrames, total: est.totalFrames, simMs: est.simMs });
        that._stopStatsTimer();
        that._syncLiveStats({ simMs: est.simMs });
        that._refreshVerdictMonitor();
        that.setData({
          playing: false,
          statusText: '模拟完成 · 可到各工具验证采集结果'
        });
        wx.showToast({ title: '模拟完成', icon: 'success' });
      }
    };
  },

  _selectScenario: function (id) {
    var hit = sim.getScenario(id);
    if (!hit) return;
    this.setData({
      activeId: id,
      activeTitle: hit.title,
      activeDesc: hit.desc
    });
    this._refreshEstimate();
  },

  onQuickPreset: function (e) {
    var id = e.currentTarget.dataset.id;
    if (this.data.playing) return;
    var hit = null;
    for (var i = 0; i < sim.QUICK_PRESETS.length; i++) {
      if (sim.QUICK_PRESETS[i].id === id) hit = sim.QUICK_PRESETS[i];
    }
    if (!hit) return;
    this._selectScenario(hit.scenarioId);
    var patch = {
      durationId: String(hit.durationMin),
      durationMin: hit.durationMin,
      tickSec: hit.tickSec,
      collectMode: hit.collectMode,
      playMode: hit.playMode || 'timeline',
      statusText: '已套用：' + hit.label
    };
    if (hit.failMode) {
      patch.failMode = hit.failMode;
      if (hit.failAtSec != null) {
        patch.failAtId = 'custom';
        patch.failAtMin = String(Math.floor(hit.failAtSec / 60));
        patch.failAtSecRem = String(hit.failAtSec % 60);
      }
    }
    this.setData(patch);
    this._refreshEstimate();
  },

  onPickScenario: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id || id === this.data.activeId) return;
    if (this.data.playing) {
      wx.showToast({ title: '请先停止', icon: 'none' });
      return;
    }
    this._selectScenario(id);
  },

  onPickDuration: function (e) {
    var id = e.currentTarget.dataset.id;
    var min = Number(e.currentTarget.dataset.min) || 0;
    if (this.data.playing) return;
    var tickSec = this.data.tickSec;
    if (min >= 43200) tickSec = 300;
    else if (min >= 1440) tickSec = 60;
    this.setData({ durationId: id, durationMin: min, tickSec: tickSec });
    this._refreshEstimate();
  },

  onPickTick: function (e) {
    var sec = Number(e.currentTarget.dataset.sec) || 20;
    if (this.data.playing) return;
    this.setData({ tickSec: sec });
    this._refreshEstimate();
  },

  onCustomMinInput: function (e) {
    this.setData({ customMin: e.detail.value, durationId: 'custom' });
    this._refreshEstimate();
  },

  onPickCollect: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id || this.data.playing) return;
    this.setData({ collectMode: id });
    this._refreshEstimate();
  },

  onPickPlay: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id || this.data.playing) return;
    this.setData({ playMode: id });
  },

  onPickFailMode: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id || this.data.playing) return;
    this.setData({ failMode: id });
    this._refreshEstimate();
  },

  onPickFailAt: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id || this.data.playing) return;
    this.setData({ failAtId: id });
    this._refreshEstimate();
  },

  onFailAtMinInput: function (e) {
    this.setData({ failAtMin: e.detail.value, failAtId: 'custom' });
    this._refreshEstimate();
  },

  onFailAtSecInput: function (e) {
    this.setData({ failAtSecRem: e.detail.value, failAtId: 'custom' });
    this._refreshEstimate();
  },

  onToggleAutoGo: function () {
    this.setData({ autoGoConnect: !this.data.autoGoConnect });
  },

  onSpeed: function (e) {
    var speed = Number(e.currentTarget.dataset.speed) || 1;
    this.setData({ speed: speed });
    var player = this._player || sim.getBackgroundState().player;
    if (player) player.setSpeed(speed);
  },

  onStart: function () {
    if (this.data.playMode === 'instant') {
      this.onInstant();
      return;
    }
    this._startTimeline();
  },

  _startTimeline: function () {
    var that = this;
    if (this.data.playing) return;
    var plan = this._rebuildPlan();
    var est = plan.estimate;
    if (!est) {
      wx.showToast({ title: '无效配置', icon: 'none' });
      return;
    }
    this._destroyPlayer();
    sim.applyCollectMode(this.data.collectMode);
    ble.startSimulator({ name: 'DC充电模拟器', clear: true });
    this.setData({
      playing: true,
      progressPct: 0,
      progressText: '0 / ' + est.totalFrames.toLocaleString() + ' 帧',
      statusText: plan.failInject
        ? ('模拟进行中 · ' + sim.fmtDuration(this._runOpts().durationMin) + ' · 将在 ' + sim.fmtSimClock(plan.failInject.atMs) + ' 注入失效')
        : ('模拟进行中 · ' + sim.fmtDuration(this._runOpts().durationMin))
    });
    if (this.data.autoGoConnect) {
      this._afterSimStartNav();
    }
    this._startStatsTimer();
    var handlers = this._bindPlayerHandlers(est);
    if (plan.mode === 'procedural') {
      this._player = sim.createProceduralPlayer(plan, handlers);
      sim.registerBackgroundPlayer(this._player);
    } else {
      this._player = sim.createStreamPlayer(plan.log, handlers);
      sim.registerBackgroundPlayer(this._player);
    }
    this._player.setSpeed(this.data.speed);
    this._player.play();
  },

  onPause: function () {
    var player = this._player || sim.getBackgroundState().player;
    if (!player || !this.data.playing) return;
    player.pause();
    this.setData({ playing: false, statusText: '已暂停' });
  },

  onStop: function () {
    this._destroyPlayer(true);
    this._stopStatsTimer();
    sim.clearCollectMode();
    ble.stopSimulator();
    this.setData({
      playing: false,
      progressPct: 0,
      progressText: '0 / 0 帧',
      statusText: '已停止',
      liveText: '',
      simClock: '0',
      wallClock: '0',
      monitorText: '',
      monitorTone: ''
    });
  },

  onInstant: function () {
    var that = this;
    if (this.data.playing) this.onStop();
    var plan = this._rebuildPlan();
    var est = plan.estimate;
    if (!est) return;
    sim.applyCollectMode(this.data.collectMode);
    ble.startSimulator({ name: 'DC充电模拟器', clear: true });
    this.setData({ playing: true, statusText: '批量灌入中…' });
    this._startStatsTimer();
    var handlers = this._bindPlayerHandlers(est);
    if (plan.mode === 'procedural') {
      this._instantJob = sim.runInstantProcedural(plan, handlers);
      sim.registerBackgroundInstantJob(this._instantJob);
    } else {
      var lines = (plan.log || '').split(/\r?\n/);
      lines.forEach(function (line) { ble.injectLine(line); });
      handlers.onProgress({ sent: lines.length, total: lines.length, simMs: est.simMs, wallMs: 0, playing: false });
      handlers.onDone();
      this.setData({ playing: false });
    }
    if (this.data.autoGoConnect) {
      setTimeout(function () {
        that._afterSimStartNav();
      }, 300);
    }
  },

  goConnect: function () {
    wx.switchTab({ url: '/pages/dcflow/dcflow' });
  },

  goCellhealthSoh: function () {
    wx.navigateTo({ url: '/pages/cellhealth/cellhealth?mode=soh' });
  },

  goCellhealth: function () {
    wx.navigateTo({ url: '/pages/cellhealth/cellhealth?mode=health' });
  },

  goSlowcharge: function () {
    wx.navigateTo({ url: '/pages/slowcharge/slowcharge' });
  }
});
