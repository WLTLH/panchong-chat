/**
 * 直流流程分析 + 实时回放引擎 + 演示日志
 */

var gbt = require('./gbt27930.js');
var stateMachine = require('./state_machine.js');
var bstCst = require('./bst_cst.js');
var dcIdCatalog = require('./dc_id_catalog.js');
var connectAnim = require('./connect_anim.js');

var FLOW_STEPS = stateMachine.STEP_DEFS;

function fmtMs(ms) {
  ms = Math.max(0, Math.floor(ms || 0));
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  var ss = s % 60;
  var msec = ms % 1000;
  return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss + '.' +
    ('00' + msec).slice(-3);
}

function extractMetrics(frames) {
  var m = {
    currentAbs: null,
    currentSrc: '',
    pileId: null,
    pileIdSrc: '',
    batteryType: null,
    batteryTypeSrc: '',
    pileMaxVoltage: null,
    pileMaxCurrentAbs: null,
    pileCapSrc: '',
    vehicleMaxVoltage: null,
    vehicleMaxSrc: '',
    soc: null,
    socSrc: '',
    vin: null,
    insulationLabel: null
  };

  frames.forEach(function (f) {
    if (!f.metrics) return;
    var met = f.metrics;
    if (met.pileId != null) {
      m.pileId = met.pileId;
      m.pileIdSrc = f.code;
    }
    if (met.batteryType) {
      m.batteryType = met.batteryType;
      m.batteryTypeSrc = f.code;
    }
    if (met.vin) m.vin = met.vin;
    if (met.pileMaxVoltage != null) {
      m.pileMaxVoltage = met.pileMaxVoltage;
      m.pileCapSrc = f.code;
    }
    if (met.pileMaxCurrent != null) {
      m.pileMaxCurrentAbs = gbt.formatCurrentUi(met.pileMaxCurrent);
      m.pileCapSrc = f.code;
    }
    if (met.vehicleMaxVoltage != null) {
      m.vehicleMaxVoltage = met.vehicleMaxVoltage;
      m.vehicleMaxSrc = f.code;
    }
    if (met.soc != null) {
      m.soc = met.soc;
      m.socSrc = f.code;
    }
    if (met.outCurrent != null) {
      m.currentAbs = gbt.formatCurrentUi(met.outCurrent);
      m.currentSrc = 'CCS';
    } else if (met.reqCurrent != null && m.currentAbs == null) {
      m.currentAbs = gbt.formatCurrentUi(met.reqCurrent);
      m.currentSrc = 'BCL';
    }
    if (met.insulation) m.insulationLabel = met.insulation.label;
  });
  return m;
}

function metricsCards(metrics) {
  var cards = [];
  if (!metrics) return cards;
  if (metrics.currentAbs != null) {
    cards.push({ key: 'I', title: '电流|I|', value: metrics.currentAbs.toFixed(1) + ' A', src: metrics.currentSrc });
  }
  if (metrics.soc != null) {
    cards.push({ key: 'SOC', title: 'SOC', value: Number(metrics.soc).toFixed(0) + ' %', src: metrics.socSrc });
  }
  if (metrics.pileId != null) {
    cards.push({ key: 'pile', title: '桩ID', value: String(metrics.pileId), src: metrics.pileIdSrc });
  }
  if (metrics.batteryType) {
    cards.push({ key: 'bat', title: '电池类型', value: metrics.batteryType, src: metrics.batteryTypeSrc });
  }
  if (metrics.pileMaxVoltage != null || metrics.pileMaxCurrentAbs != null) {
    var cap = [];
    if (metrics.pileMaxVoltage != null) cap.push(metrics.pileMaxVoltage.toFixed(0) + 'V');
    if (metrics.pileMaxCurrentAbs != null) cap.push('|' + metrics.pileMaxCurrentAbs.toFixed(0) + 'A|');
    cards.push({ key: 'cml', title: '桩最大能力', value: cap.join(' / '), src: metrics.pileCapSrc || 'CML' });
  }
  if (metrics.vehicleMaxVoltage != null) {
    cards.push({ key: 'vmax', title: '车上限电压', value: metrics.vehicleMaxVoltage.toFixed(1) + ' V', src: metrics.vehicleMaxSrc });
  }
  if (metrics.vin) {
    cards.push({ key: 'vin', title: 'VIN', value: metrics.vin, src: 'BRM' });
  }
  return cards;
}

function inferStopReason(session, frames) {
  if (!session) return null;
  var stopEvent = session.stopEvent;
  if (stopEvent) {
    var decoded = null;
    if (stopEvent.metrics) decoded = stopEvent.metrics.stop || stopEvent.metrics.error;
    var side = bstCst.sideHintFromStop(stopEvent.code, decoded) || stopEvent.side || 'unknown';
    var sideLabel = { pile: '桩', vehicle: '车', link: '连接', unknown: '待判' }[side] || '待判';
    var fields = [];
    if (decoded && decoded.reasons) {
      decoded.reasons.forEach(function (r) {
        fields.push({ name: '原因', value: r });
      });
    }
    if (decoded && decoded.fields) {
      decoded.fields.slice(0, 8).forEach(function (f) {
        if (f.name !== '原始') fields.push(f);
      });
    }
    return {
      title: stopEvent.type === 'error' ? ('通信错误 · ' + stopEvent.code) : ('充电中止 · ' + stopEvent.code),
      detail: stopEvent.summary || '',
      side: side,
      sideLabel: sideLabel,
      source: stopEvent.code,
      fields: fields,
      tMs: stopEvent.tMs
    };
  }

  // 卡死未终态
  if (!session.finished && !session.chargeStarted) {
    var node = session.nodes[session.stepIndex];
    return {
      title: '会话未完成 · 卡在「' + (node && node.title) + '」',
      detail: '未见稳定充电循环或明确中止/错误报文。可能为连接、兼容或日志截断。仍在充电噪声中勿误判终态——当前按卡死展示。',
      side: 'unknown',
      sideLabel: '待判',
      source: session.lastCode || '—',
      fields: [],
      tMs: null,
      stuck: true
    };
  }
  return null;
}

function analyzeDcFlow(logText) {
  var parsed = gbt.decodeLogText(logText || '');
  var machine = stateMachine.createSessionMachine();
  var snapshots = [];
  for (var i = 0; i < parsed.frames.length; i++) {
    snapshots.push(machine.feed(parsed.frames[i]));
  }
  var session = machine.finalizeIfIncomplete();
  var metrics = extractMetrics(parsed.frames);
  var stop = inferStopReason(session, parsed.frames);

  var heroStatus = 'idle';
  var statusText = '充电流程';
  var summary = '暂无通信记录，请先在采集页粘贴日志并开始分析';
  if (parsed.totalFrames === 0) {
    heroStatus = 'idle';
  } else if (session.error) {
    heroStatus = 'failed';
    statusText = '失败 / 通信错误';
    summary = stop ? stop.detail : '检测到错误报文';
  } else if (session.finished) {
    heroStatus = 'success';
    statusText = stop && stop.source && (stop.source === 'CST' || stop.source === 'BST') ? '已结束（中止）' : '已结束';
    summary = stop ? stop.detail : '会话结束';
    if (stop && (stop.source === 'CEM' || stop.source === 'BEM')) {
      heroStatus = 'failed';
      statusText = '失败 / 通信错误';
    }
  } else if (session.chargeStarted) {
    heroStatus = 'running';
    statusText = '充电中（日志未完）';
    summary = '已进入充电循环，日志末尾未见明确中止';
  } else {
    heroStatus = 'failed';
    statusText = '未完成';
    summary = stop ? stop.detail : '流程未走完';
  }

  return {
    frames: parsed.frames,
    frameCount: parsed.frameCount,
    totalFrames: parsed.totalFrames,
    reassembledCount: parsed.reassembledCount,
    codeCounts: parsed.codeCounts,
    totalMs: parsed.totalMs,
    session: session,
    nodes: session.nodes,
    metrics: metrics,
    metricCards: metricsCards(metrics),
    stop: stop,
    heroStatus: heroStatus,
    statusText: statusText,
    summary: summary,
    lineCount: parsed.lineCount
  };
}

/**
 * 墙钟 × 倍速 = 仿真时间；约 50ms snapshot；全序索引推进，禁止跳帧分析
 */
function createRealtimePlayer(logText, options) {
  options = options || {};
  var speed = options.speed || 10;
  var analysis = analyzeDcFlow(logText);
  var frames = analysis.frames;
  var totalMs = analysis.totalMs || 0;
  var idx = 0;
  var simMs = 0;
  var playing = false;
  var timer = null;
  var machine = stateMachine.createSessionMachine();
  var lastSnap = machine.snapshot();
  var onUpdate = options.onUpdate || function () {};
  var tickMs = 50;
  var wallLast = 0;
  var observations = options.observations || [];
  var hasLog = !!(logText && String(logText).trim());
  var showcaseMode = !!options.showcaseMode;

  // precompute: feed all to get per-index session? Better: incremental feed
  function rebuildTo(targetIdx) {
    machine = stateMachine.createSessionMachine();
    var upto = Math.min(targetIdx, frames.length);
    for (var i = 0; i < upto; i++) machine.feed(frames[i]);
    lastSnap = machine.snapshot();
    idx = upto;
  }

  function currentMetrics() {
    return extractMetrics(frames.slice(0, idx));
  }

  function emit() {
    var timelineMs = totalMs;
    if (showcaseMode) {
      timelineMs = Math.max(5600, Math.min(8000, totalMs * 0.55 || 5600)) + totalMs;
    }
    var percent = timelineMs > 0 ? Math.min(100, (simMs / timelineMs) * 100) : (frames.length ? (idx / frames.length) * 100 : 0);
    var lastCode = idx > 0 ? frames[idx - 1].code : '';
    var lastMfr = '';
    if (idx > 0) {
      var lf = frames[idx - 1];
      lastMfr = lf.manufacturerText || '';
      if (!lastMfr) {
        var idn = dcIdCatalog.identifyFrame(lf.id, lf.idInfo && lf.idInfo.pf, lf.code);
        lastMfr = idn.manufacturerText;
      }
      if (lastMfr) lastMfr = '[' + lastMfr + ']';
    }
    var stop = inferStopReason(lastSnap, frames.slice(0, idx));
    var heroStatus = 'running';
    var statusText = '回放中';
    var summary = lastSnap.lastSummary || '';
    if (!playing && idx === 0 && simMs === 0) {
      // 有分析结果时直接展示终态文案，不对客户显示「待分析/就绪」
      if (analysis && analysis.totalFrames > 0) {
        heroStatus = analysis.heroStatus || 'idle';
        statusText = analysis.statusText || '充电流程';
        summary = analysis.summary || summary;
      } else {
        heroStatus = 'idle';
        statusText = '充电流程';
        summary = '暂无通信记录，请先在采集页开始分析';
      }
    }
    if (lastSnap.error) {
      heroStatus = 'failed';
      statusText = '失败 / 通信错误';
      summary = stop ? stop.detail : summary;
    } else if (lastSnap.finished && (simMs >= totalMs || idx >= frames.length)) {
      heroStatus = (stop && (stop.source === 'CEM' || stop.source === 'BEM')) ? 'failed' : 'success';
      statusText = heroStatus === 'failed' ? '失败 / 通信错误' : '已结束';
      summary = stop ? stop.detail : summary;
    } else if (!playing && idx >= frames.length) {
      heroStatus = lastSnap.error ? 'failed' : (lastSnap.finished ? 'success' : 'failed');
      statusText = heroStatus === 'success' ? '已结束' : (heroStatus === 'failed' ? '未完成/失败' : '暂停');
    }

    var anim = connectAnim.buildConnectAnim({
      session: lastSnap,
      simMs: simMs,
      totalMs: totalMs,
      playing: playing,
      observations: observations,
      stop: stop,
      hasLog: hasLog,
      showcaseMode: showcaseMode
    });

    if (showcaseMode && anim.story) {
      statusText = playing ? ('展示中 · ' + anim.story.title) : statusText;
      if (playing) summary = anim.story.narration;
    }

    onUpdate({
      simMs: simMs,
      totalMs: totalMs,
      idx: idx,
      total: frames.length,
      percent: percent,
      clockText: fmtMs(simMs) + ' / ' + fmtMs(timelineMs),
      progressText: idx + ' / ' + frames.length,
      lastCode: lastCode,
      lastMfr: lastMfr,
      session: lastSnap,
      nodes: lastSnap.nodes,
      metrics: currentMetrics(),
      metricCards: metricsCards(currentMetrics()),
      stop: stop,
      heroStatus: heroStatus,
      statusText: statusText,
      summary: summary,
      playing: playing,
      speed: speed,
      analysis: analysis,
      connectAnim: anim,
      story: anim.story,
      showcaseMode: showcaseMode
    });
  }

  function tick() {
    if (!playing) return;
    var now = Date.now();
    var dt = now - wallLast;
    wallLast = now;
    var holdMs = showcaseMode
      ? Math.max(5600, Math.min(8000, totalMs * 0.55 || 5600))
      : 0;
    var endMs = holdMs + totalMs;
    simMs += dt * speed;
    if (simMs > endMs) simMs = endMs;

    // 展示模式：先播完插枪分镜，再按相对时间喂入通信帧
    var feedMs = showcaseMode ? (simMs < holdMs ? -1 : (simMs - holdMs)) : simMs;

    while (idx < frames.length && feedMs >= 0) {
      var rel = frames[idx].relMs != null ? frames[idx].relMs : 0;
      if (rel > feedMs) break;
      lastSnap = machine.feed(frames[idx]);
      idx++;
    }

    emit();

    if (simMs >= endMs && idx >= frames.length) {
      playing = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      emit();
    }
  }

  function play() {
    if (playing) return;
    playing = true;
    wallLast = Date.now();
    if (!timer) timer = setInterval(tick, tickMs);
    emit();
  }

  function pause() {
    playing = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    emit();
  }

  function stopPlay() {
    pause();
    simMs = 0;
    rebuildTo(0);
    emit();
  }

  function replay() {
    pause();
    simMs = 0;
    rebuildTo(0);
    play();
  }

  function setSpeed(s) {
    speed = s || 1;
    emit();
  }

  function destroy() {
    pause();
    onUpdate = function () {};
  }

  // initial
  emit();

  return {
    play: play,
    pause: pause,
    stop: stopPlay,
    replay: replay,
    setSpeed: setSpeed,
    destroy: destroy,
    getAnalysis: function () { return analysis; },
    emit: emit
  };
}

// —— 演示日志 ——
// 电流 raw: physical = raw*0.1 - 400; -100A => raw = 3000 = 0x0BB8
// 电压 750.0V => 7500 = 0x1D4C

var DEMO_SUCCESS = [
  '00:00:00.000 1826F456 01 01 00',
  '00:00:00.050 182756F4 3C 0A',
  '00:00:00.300 1801F456 AA 39 30 01 31 32 33 34',
  // BRM 49 bytes via TP: SA=F4 DA=56 PGN=0x0200
  // BRM 49B，TP.CM PGN 小端 = 00 02 00
  '00:00:00.400 1CEC56F4 10 31 00 07 FF 00 02 00',
  '00:00:00.420 1CEB56F4 01 01 03 20 03 E8 0D 42',
  '00:00:00.440 1CEB56F4 02 41 54 54 01 02 03 04',
  '00:00:00.460 1CEB56F4 03 18 07 19 01 00 00 00',
  '00:00:00.480 1CEB56F4 04 00 00 00 4C 53 47 41',
  '00:00:00.500 1CEB56F4 05 4C 54 45 53 54 30 30',
  '00:00:00.520 1CEB56F4 06 30 30 30 30 31 56 31',
  '00:00:00.540 1CEB56F4 07 2E 30 2E 30 00 00 00',
  '00:00:00.600 1808F456 E8 0D 20 03 60 09 60 0D',
  '00:00:00.650 1807F456 25 07 01 12 00 00 00',
  // BCP 13B，PGN = 00 06 00
  '00:00:00.700 1CEC56F4 10 0D 00 02 FF 00 06 00',
  '00:00:00.720 1CEB56F4 01 A0 0F 60 09 2C 01 E8',
  '00:00:00.740 1CEB56F4 02 0D 78 FA 00 4C 1D 00',
  '00:00:01.000 100956F4 AA',
  '00:00:01.050 100AF456 AA',
  '00:00:01.200 181056F4 4C 1D B8 0B 02',
  '00:00:01.220 1812F456 4C 1D B8 0B 00 00 01',
  // BCS 9B，PGN = 00 11 00
  '00:00:01.250 1CEC56F4 10 09 00 02 FF 00 11 00',
  '00:00:01.270 1CEB56F4 01 4C 1D B8 0B 10 0A 28',
  '00:00:01.290 1CEB56F4 02 1E 00 00 00 00 00 00',
  '00:00:01.300 181356F4 01 78 01 5A 02 00 00',
  '00:00:02.200 181056F4 4C 1D B8 0B 02',
  '00:00:02.220 1812F456 4C 1D C0 0B 00 00 01',
  '00:00:03.200 181056F4 4C 1D B8 0B 02',
  '00:00:03.220 1812F456 4C 1D B0 0B 01 00 01',
  '00:00:04.000 101956F4 01 00 00 00',
  '00:00:04.050 181C56F4 2D DC 00 E8 00 5A 78',
  '00:00:04.100 181DF456 01 00 05 00 39 30 01 00'
].join('\n');

var DEMO_CEM = [
  '00:00:00.000 1826F456 01 01 00',
  '00:00:00.050 182756F4 3C 0A',
  '00:00:00.300 1801F456 AA 11 22 33 41 42 43 44',
  '00:00:00.400 1CEC56F4 10 31 00 07 FF 00 02 00',
  '00:00:00.420 1CEB56F4 01 01 03 20 03 E8 0D 42',
  '00:00:00.440 1CEB56F4 02 41 54 54 01 02 03 04',
  '00:00:00.460 1CEB56F4 03 18 07 19 01 00 00 00',
  '00:00:00.480 1CEB56F4 04 00 00 00 4C 53 47 41',
  '00:00:00.500 1CEB56F4 05 4C 54 45 53 54 30 30',
  '00:00:00.520 1CEB56F4 06 30 30 30 30 32 56 31',
  '00:00:00.540 1CEB56F4 07 2E 30 2E 30 00 00 00',
  '00:00:00.800 1808F456 E8 0D 20 03 60 09 60 0D',
  // 卡在参数/就绪：桩侧 CEM 报 BCP/BRO 超时
  '00:00:03.000 081FF456 14 00 00 00'
].join('\n');

var DEMO_CST = [
  '00:00:00.000 1826F456 01 01 00',
  '00:00:00.050 182756F4 3C 0A',
  '00:00:00.300 1801F456 AA 55 66 77 31 32 33 34',
  '00:00:00.500 1808F456 E8 0D 20 03 60 09 60 0D',
  '00:00:00.700 1CEC56F4 10 0D 00 02 FF 00 06 00',
  '00:00:00.720 1CEB56F4 01 A0 0F 60 09 2C 01 E8',
  '00:00:00.740 1CEB56F4 02 0D 78 FA 00 4C 1D 00',
  '00:00:01.000 100956F4 AA',
  '00:00:01.050 100AF456 AA',
  '00:00:01.200 181056F4 4C 1D B8 0B 02',
  '00:00:01.220 1812F456 4C 1D B8 0B 00 00 01',
  '00:00:01.300 181356F4 01 78 01 5A 02 00 00',
  '00:00:02.000 181056F4 4C 1D B8 0B 02',
  '00:00:02.020 1812F456 4C 1D A0 0B 00 00 01',
  // 桩故障中止 CST byte1 bit2 = 0x04
  '00:00:02.500 101AF456 04 00 00 00',
  '00:00:02.550 181DF456 00 00 01 00 55 66 77 00'
].join('\n');

var DEMO_LOGS = {
  success: DEMO_SUCCESS,
  cem: DEMO_CEM,
  cst: DEMO_CST,
  demo: DEMO_SUCCESS
};

module.exports = {
  FLOW_STEPS: FLOW_STEPS,
  analyzeDcFlow: analyzeDcFlow,
  createRealtimePlayer: createRealtimePlayer,
  extractMetrics: extractMetrics,
  metricsCards: metricsCards,
  inferStopReason: inferStopReason,
  DEMO_LOGS: DEMO_LOGS,
  fmtMs: fmtMs
};
