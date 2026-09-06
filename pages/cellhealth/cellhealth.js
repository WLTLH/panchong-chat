var DISCLAIMER_KEY = 'panchong_cellhealth_disclaimer_v1';

Page({
  data: {
    mode: 'health',
    modeTitle: '电芯鉴康',
    modeSubtitle: '',
    heroTitle: '',
    heroSub: '',
    collectGuide: null,
    collectSteps: [],
    keepLabels: [],
    requirements: [],
    collectReady: false,
    collecting: false,
    collectStats: '',
    socRange: null,
    progressPct: 0,
    progressText: '',
    manualRatedAh: '',
    result: null,
    resultHero: null,
    metricCards: [],
    showDisclaimer: false,
    showTechDetail: false,
    phase: 'guide',
    isSimulator: false,
    simHint: '',
    pipeStatus: '',
    pipeTone: 'idle',
    rawLineCount: 0,
    validLineCount: 0,
    collectModeLabel: ''
  },

  _collectTimer: null,

  onLoad: function (options) {
    options = options || {};
    var mode = options.mode === 'soh' ? 'soh' : 'health';
    this._initMode(mode);
    var showDisclaimer = false;
    try {
      showDisclaimer = !wx.getStorageSync(DISCLAIMER_KEY);
    } catch (e) {}
    this.setData({ showDisclaimer: showDisclaimer });
    if (!showDisclaimer) {
      this._tryLoadLastCapture();
    }
  },

  onShow: function () {
    var app = getApp();
    var session = this._readSession();
    if (this._shouldCollect(session)) {
      this._enterCollectPhase();
      this._syncCollectProgress();
      this._startCollectLoop();
    } else if (!this.data.result) {
      this._tryLoadLastCapture();
      this._syncPipeStatus(session);
    }
  },

  _readSession: function () {
    var ble = require('../../utils/ble_session.js');
    var app = getApp();
    var st = ble.getSessionStatus();
    st.collectMode = app.globalData.batteryCollectMode || st.collectMode;
    return st;
  },

  _shouldCollect: function (session) {
    session = session || this._readSession();
    var app = getApp();
    if (app.globalData.batteryCollectMode === this._mode) return true;
    if (session.simulatorMode && session.collectMode === this._mode) return true;
    if (session.simulatorMode && session.lineCount > 0 && session.collectMode === this._mode) return true;
    return false;
  },

  _syncPipeStatus: function (session) {
    session = session || this._readSession();
    var pipeStatus = '';
    var pipeTone = 'idle';
    if (session.simulatorMode && session.collectMode === this._mode && session.lineCount > 0) {
      pipeStatus = '检测到模拟器正在灌数据（' + session.lineCount + ' 行），点「开始」或切到采集中查看';
      pipeTone = 'ok';
    } else if (session.simulatorMode && session.collectMode && session.collectMode !== this._mode) {
      pipeStatus = '模拟器采集模式是「' + session.collectMode + '」，与当前页不一致，请在模拟器改选容量测试';
      pipeTone = 'warn';
    } else if (session.simulatorMode && !session.collectMode) {
      pipeStatus = '模拟器在跑但未开采集过滤，请在模拟器选「容量测试」后重新开始';
      pipeTone = 'warn';
    } else if (session.simulatorMode && session.lineCount === 0) {
      pipeStatus = '模拟器已开但还没有行写入，请确认模拟器已点「开始」';
      pipeTone = 'warn';
    }
    this.setData({ pipeStatus: pipeStatus, pipeTone: pipeTone });
  },

  onHide: function () {
    this._stopCollectLoop();
  },

  onUnload: function () {
    this._stopCollectLoop();
    if (this._demoJob && this._demoJob.cancel) {
      this._demoJob.cancel();
      this._demoJob = null;
    }
  },

  _enterCollectPhase: function () {
    var ble = require('../../utils/ble_session.js');
    var sim = ble.isSimulator();
    this.setData({
      collecting: true,
      phase: 'collect',
      isSimulator: sim,
      simHint: sim ? '模拟器正在灌入充电数据，进度会自动更新' : ''
    });
  },

  _startCollectLoop: function () {
    var that = this;
    if (this._collectTimer) return;
    this._collectTimer = setInterval(function () {
      if (that.data.phase !== 'collect') return;
      that._syncCollectProgress();
    }, 1000);
  },

  _stopCollectLoop: function () {
    if (this._collectTimer) {
      clearInterval(this._collectTimer);
      this._collectTimer = null;
    }
  },

  _onBleSimulatorChange: function (on) {
    if (!on) {
      this.setData({ isSimulator: false, simHint: '' });
      this._syncPipeStatus();
      return;
    }
    if (this._shouldCollect()) {
      this._enterCollectPhase();
      this._syncCollectProgress();
      this._startCollectLoop();
    } else {
      this._syncPipeStatus();
    }
  },

  _collectModeLabel: function (modeId) {
    if (modeId === 'soh') return '容量测试';
    if (modeId === 'health') return '电芯鉴康';
    return modeId || '未开';
  },

  _buildPipeMessage: function (session, text, assess) {
    session = session || this._readSession();
    var parts = [];
    if (session.simulatorMode) parts.push('模拟器');
    else if (session.connected) parts.push('采集盒已连');
    else parts.push('未连接');

    parts.push('缓冲 ' + session.lineCount + ' 行');

    if (session.collectMode) {
      parts.push('过滤「' + this._collectModeLabel(session.collectMode) + '」');
    } else if (session.simulatorMode) {
      parts.push('⚠ 未开采集模式');
    }

    if (text && assess) {
      parts.push('有效 ' + assess.frameCount + ' 帧');
      if (assess.socRange) parts.push('SOC ' + assess.socRange.min + '→' + assess.socRange.max + '%');
    } else if (session.lineCount > 0 && !text) {
      parts.push('⚠ 有数据但被过滤光，请核对采集模式');
    } else if (session.simulatorMode && session.lineCount === 0) {
      parts.push('等待模拟器发送…');
    } else if (!session.connected && !session.simulatorMode) {
      parts.push('请连采集盒或开模拟器');
    }

    var pipeTone = 'idle';
    if (assess && assess.ready) pipeTone = 'ok';
    else if (session.lineCount > 0 && text) pipeTone = 'ok';
    else if (session.simulatorMode || session.connected) pipeTone = 'warn';

    return { pipeStatus: parts.join(' · '), pipeTone: pipeTone };
  },

  _initMode: function (mode) {
    var bc = require('../../utils/battery_collect.js');
    var guide = bc.getCollectGuide(mode);
    this._mode = mode;
    this._bc = bc;
    this.setData({
      mode: mode,
      modeTitle: guide.mode.title,
      modeSubtitle: guide.mode.subtitle,
      heroTitle: mode === 'soh' ? '测一测电池还能存多少电' : '给电池做个全面体检',
      heroSub: mode === 'soh'
        ? '充一次电就能估算健康容量，不用懂技术'
        : '容量、老化、平衡一次看清，充一次电就行',
      collectGuide: guide,
      collectSteps: guide.steps,
      keepLabels: guide.keepLabels
    });
    wx.setNavigationBarTitle({
      title: mode === 'soh' ? '容量测试' : '电芯鉴康'
    });
  },

  onSwitchMode: function (e) {
    var mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.mode) return;
    this._initMode(mode);
    this.setData({ result: null, resultHero: null, metricCards: [], phase: 'guide' });
    this._tryLoadLastCapture();
  },

  _applyAssess: function (assess, statsLine) {
    var prog = this._bc.calcProgress(assess.requirements);
    this.setData({
      requirements: assess.requirements,
      collectReady: assess.ready,
      collectStats: statsLine || '',
      socRange: assess.socRange,
      progressPct: prog.pct,
      progressText: prog.done + '/' + prog.total + ' 项已就绪'
    });
  },

  _syncCollectProgress: function () {
    var ble = require('../../utils/ble_session.js');
    var sim = require('../../utils/dc_simulator.js');
    var session = this._readSession();
    var simOn = session.simulatorMode || sim.isBackgroundPlaying();
    var text = ble.exportFrames();
    var rawLineCount = session.lineCount;

    if (!text) {
      var emptyPipe = this._buildPipeMessage(session, '', null);
      this.setData({
        collectStats: simOn ? '模拟器运行中，等待有效报文…' : '等待充电数据…',
        requirements: [],
        collectReady: false,
        progressPct: 0,
        progressText: '0/3 项已就绪',
        isSimulator: simOn,
        rawLineCount: rawLineCount,
        validLineCount: 0,
        collectModeLabel: this._collectModeLabel(session.collectMode),
        simHint: simOn
          ? (rawLineCount > 0
            ? '已有 ' + rawLineCount + ' 行缓冲，若仍无进度请确认模拟器采集模式=容量测试'
            : '请确认「工具→直流充电模拟器」已点「开始」')
          : '',
        pipeStatus: emptyPipe.pipeStatus,
        pipeTone: emptyPipe.pipeTone
      });
      return;
    }
    var assess = this._bc.assessCollection(text, this._mode);
    var pipe = this._buildPipeMessage(session, text, assess);
    var statsLine = simOn
      ? ('模拟采集中 · 有效 ' + assess.frameCount + ' 帧' + (assess.ready ? ' · 可以出结果' : ''))
      : ('正在记录 · 有效 ' + assess.frameCount + ' 帧');
    this._applyAssess(assess, statsLine);
    this.setData({
      isSimulator: simOn,
      rawLineCount: rawLineCount,
      validLineCount: assess.frameCount,
      collectModeLabel: this._collectModeLabel(session.collectMode),
      simHint: simOn ? '数字在涨说明采集正常' : '',
      pipeStatus: pipe.pipeStatus,
      pipeTone: pipe.pipeTone
    });
  },

  _tryLoadLastCapture: function () {
    var app = getApp();
    var pack = app.loadBatteryCapture && app.loadBatteryCapture();
    if (!pack || !pack.filteredText) return;
    if (pack.mode && pack.mode !== this._mode) return;
    if (pack.assess) this._applyAssess(pack.assess, pack.statsSummary || '');
    this.setData({ collecting: false, phase: 'result' });
    this.runAnalyze(pack.filteredText, this.data.manualRatedAh);
  },

  onAgreeDisclaimer: function () {
    try {
      wx.setStorageSync(DISCLAIMER_KEY, 1);
    } catch (e) {}
    this.setData({ showDisclaimer: false });
  },

  onStartCollect: function () {
    var app = getApp();
    var ble = require('../../utils/ble_session.js');
    var sim = require('../../utils/dc_simulator.js');
    app.globalData.batteryCollectMode = this._mode;
    if (!ble.isSimulator() && !sim.isBackgroundPlaying()) {
      ble.clearLog();
    }
    this._enterCollectPhase();
    this.setData({
      result: null,
      resultHero: null,
      progressPct: 0,
      progressText: '0/3 项已就绪'
    });
    this._syncCollectProgress();
    this._startCollectLoop();
    if (ble.isSimulator() || sim.isBackgroundPlaying()) {
      wx.showToast({ title: '已接入模拟数据', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/dcflow/dcflow?battery=' + this._mode });
  },

  goDcsim: function () {
    wx.navigateTo({ url: '/pages/dcsim/dcsim' });
  },

  /** 手机上一键灌入 30 分钟 SOH 场景，无需采集盒/模拟器页 */
  onDemoSim: function () {
    var that = this;
    var sim = require('../../utils/dc_simulator.js');
    var ble = require('../../utils/ble_session.js');
    if (this._demoJob) {
      wx.showToast({ title: '演示进行中', icon: 'none' });
      return;
    }
    sim.stopBackgroundRun();
    sim.applyCollectMode(this._mode);
    ble.startSimulator({ name: '容量测试演示', clear: true });
    this._enterCollectPhase();
    this.setData({
      result: null,
      resultHero: null,
      progressPct: 0,
      progressText: '0/3 项已就绪'
    });
    this._startCollectLoop();
    var plan = sim.resolveRunPlan(this._mode === 'health' ? 'health_full' : 'soh_charge', {
      durationMin: 30,
      collectMode: this._mode,
      tickSec: 20
    });
    var handlers = {
      onLine: function (line) {
        ble.injectLine(line);
      },
      onProgress: function () {
        that._syncCollectProgress();
      },
      onDone: function () {
        that._demoJob = null;
        that._syncCollectProgress();
        wx.showToast({ title: '演示数据已灌完', icon: 'success' });
      }
    };
    if (plan.mode === 'procedural') {
      this._demoJob = sim.runInstantProcedural(plan, handlers);
      sim.registerBackgroundInstantJob(this._demoJob);
    } else {
      (plan.log || '').split(/\r?\n/).forEach(function (line) {
        if (line.trim()) ble.injectLine(line);
      });
      handlers.onDone();
    }
    wx.showToast({ title: '演示开始，请看进度', icon: 'none', duration: 2000 });
  },

  goDcflow: function () {
    wx.navigateTo({ url: '/pages/dcflow/dcflow?battery=' + this._mode });
  },

  onFinishCollect: function () {
    var app = getApp();
    var ble = require('../../utils/ble_session.js');
    var raw = ble.exportFrames();
    app.globalData.batteryCollectMode = null;
    this._stopCollectLoop();
    if (!raw) {
      wx.showToast({ title: '还没有充电数据', icon: 'none' });
      return;
    }
    var filtered = this._bc.filterLogText(raw, this._mode);
    var assess = this._bc.assessCollection(filtered.text, this._mode);
    if (!assess.ready) {
      wx.showModal({
        title: '数据可能还不够',
        content: (assess.missing && assess.missing[0]) || '建议继续充电一会儿，或拔掉重新插枪再试。',
        confirmText: '先看结果',
        cancelText: '继续充电',
        success: function (res) {
          if (res.confirm) this._saveAndAnalyze(filtered, assess);
          else app.globalData.batteryCollectMode = this._mode;
        }.bind(this)
      });
      return;
    }
    this._saveAndAnalyze(filtered, assess);
  },

  _saveAndAnalyze: function (filtered, assess) {
    var app = getApp();
    app.persistBatteryCapture({
      mode: this._mode,
      rawLineCount: filtered.stats.totalLines,
      filteredText: filtered.text,
      statsSummary: filtered.summary,
      createdAt: Date.now(),
      assess: assess
    });
    this._applyAssess(assess, '记录完成');
    this.setData({ collecting: false, phase: 'result' });
    this.runAnalyze(filtered.text, this.data.manualRatedAh);
  },

  onRestart: function () {
    this._stopCollectLoop();
    this.setData({
      collecting: false,
      result: null,
      resultHero: null,
      metricCards: [],
      phase: 'guide',
      collectStats: '',
      requirements: [],
      socRange: null,
      progressPct: 0
    });
  },

  onRatedInput: function (e) {
    this.setData({ manualRatedAh: e.detail.value });
  },

  onToggleTech: function () {
    this.setData({ showTechDetail: !this.data.showTechDetail });
  },

  goVerdictGuide: function () {
    try {
      var app = getApp();
      if (app && app.globalData) app.globalData.verdictGuideTab = 'impedance';
    } catch (e) {}
    wx.navigateTo({ url: '/pages/verdictguide/verdictguide' });
  },

  runAnalyze: function (text, manualRatedAh) {
    var rated = parseFloat(manualRatedAh);
    var opts = {};
    if (manualRatedAh !== '' && manualRatedAh != null && isFinite(rated) && rated > 0) {
      opts.manualRatedAh = rated;
    }
    var result;
    if (this._mode === 'soh') {
      var soh = require('../../utils/battery_soh.js');
      result = soh.analyzeBatterySoh(text || '', opts);
      result.findings = result.sohPct != null ? [{
        icon: '容',
        title: '健康容量 ' + result.sohPct + '%',
        confidence: result.confidence ? result.confidence.label : '—',
        text: result.summary,
        detail: ''
      }] : [];
    } else {
      var bh = require('../../utils/battery_health.js');
      result = bh.analyzeBatteryHealth(text || '', opts);
    }

    var n = result.numbers || {};
    var resultHero = null;
    if (n.sohPct != null) {
      resultHero = {
        value: n.sohPct,
        unit: '%',
        caption: '健康容量 SOH',
        ringPct: Math.min(100, Math.max(0, n.sohPct))
      };
    }

    var metricCards = [
      { label: '估算满充容量', value: n.estimatedCapacityAh != null ? n.estimatedCapacityAh + ' Ah' : '—', sub: '按本次充电推算' },
      { label: '标称容量', value: n.ratedCapacityAh != null ? n.ratedCapacityAh + ' Ah' : '—', sub: '车辆上报' },
      { label: '电池类型', value: n.batteryType || '—', sub: '' },
      { label: '单体压差', value: n.cellSpreadV != null ? n.cellSpreadV + ' V' : '—', sub: '越小越均衡' }
    ];

    this.setData({
      result: result,
      resultHero: resultHero,
      metricCards: metricCards,
      phase: 'result'
    });
  }
});
