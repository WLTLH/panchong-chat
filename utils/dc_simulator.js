/**
 * 直流充电报文模拟器：按时间线把 27930 日志注入 ble_session，供连接页/工具联调。
 */

var dcFlow = require('./dc_flow.js');
var chargeSpeed = require('./charge_speed.js');
var batteryCollect = require('./battery_collect.js');

var DURATION_PRESETS = [
  { id: 'raw', min: 0, label: '场景原始', desc: '不加时，用场景自带长度' },
  { id: '5', min: 5, label: '5 分钟', desc: '短测' },
  { id: '30', min: 30, label: '30 分钟', desc: '容量测试常用' },
  { id: '120', min: 120, label: '2 小时', desc: '中长' },
  { id: '1440', min: 1440, label: '24 小时', desc: 'SOH 长测' },
  { id: '10080', min: 10080, label: '7 天', desc: '电池一周' },
  { id: '43200', min: 43200, label: '30 天', desc: '电池一月' }
];

/** 超过此时长改用动态生成，不预建全文 */
var PROCEDURAL_MIN = 121;

var QUICK_PRESETS = [
  {
    id: 'soh24h',
    label: 'SOH 24小时',
    durationMin: 1440,
    collectMode: 'soh',
    scenarioId: 'soh_charge',
    tickSec: 60,
    playMode: 'timeline'
  },
  {
    id: 'bat30d',
    label: '电池 30天',
    durationMin: 43200,
    collectMode: 'health',
    scenarioId: 'health_full',
    tickSec: 300,
    playMode: 'timeline'
  },
  {
    id: 'fail_cst5',
    label: '失效测试',
    durationMin: 15,
    collectMode: 'all',
    scenarioId: 'success',
    tickSec: 20,
    playMode: 'timeline',
    failMode: 'cst_fault',
    failAtSec: 300
  }
];

var TICK_PRESETS = [
  { id: '20', sec: 20, label: '20 秒/拍', desc: '接近实车' },
  { id: '60', sec: 60, label: '60 秒/拍', desc: '24h 长测推荐' },
  { id: '300', sec: 300, label: '5 分/拍', desc: '30天 压测推荐' }
];

var MAX_LINES_PER_TICK = 120;

/** 失效注入：可选时刻，验证连接页/裁决能否识别 */
var FAIL_AT_PRESETS = [
  { id: '30', sec: 30, label: '30 秒' },
  { id: '120', sec: 120, label: '2 分钟' },
  { id: '300', sec: 300, label: '5 分钟' },
  { id: '600', sec: 600, label: '10 分钟' },
  { id: '1800', sec: 1800, label: '30 分钟' },
  { id: '3600', sec: 3600, label: '1 小时' }
];

var FAILURE_MODES = [
  { id: 'none', label: '不失效', group: '', expect: '正常充电', code: '' },
  { id: 'cem_bcp', label: 'CEM · BCP 超时', group: '桩报错误', expect: '倾向车端：桩收不到车参数', code: 'CEM' },
  { id: 'cem_bro', label: 'CEM · BRO 超时', group: '桩报错误', expect: '倾向车端：桩收不到车就绪', code: 'CEM' },
  { id: 'cem_bcp_bro', label: 'CEM · BCP+BRO', group: '桩报错误', expect: '倾向车端：参数+就绪超时', code: 'CEM' },
  { id: 'bem_crm', label: 'BEM · CRM 超时', group: '车报错误', expect: '倾向桩端：车收不到桩辨识', code: 'BEM' },
  { id: 'bem_ccs', label: 'BEM · CCS 超时', group: '车报错误', expect: '倾向桩端：车收不到充电电流', code: 'BEM' },
  { id: 'cst_fault', label: 'CST · 故障中止', group: '桩中止', expect: '倾向桩端：桩故障中止', code: 'CST' },
  { id: 'cst_connector', label: 'CST · 连接器故障', group: '桩中止', expect: '倾向连接/桩：连接器故障', code: 'CST' },
  { id: 'cst_emergency', label: 'CST · 急停', group: '桩中止', expect: '倾向桩端：充电机急停', code: 'CST' },
  { id: 'bst_insulation', label: 'BST · 绝缘故障', group: '车中止', expect: '倾向车端：绝缘故障', code: 'BST' },
  { id: 'bst_connector', label: 'BST · 连接器故障', group: '车中止', expect: '倾向连接/车：连接器故障', code: 'BST' },
  { id: 'bst_cst_both', label: 'BST+CST 双中止', group: '双中止', expect: '应按位域细判，不单边 +3', code: 'BST/CST' }
];

function failLine(tMs, canId, dataHex) {
  return { relMs: tMs, line: fmtTs(tMs) + ' ' + canId + ' ' + dataHex };
}

function buildFailureEvents(modeId, atMs) {
  atMs = Math.max(0, atMs | 0);
  if (!modeId || modeId === 'none') return [];
  switch (modeId) {
    case 'cem_bcp':
      return [failLine(atMs, '081FF456', '04 00 00 00')];
    case 'cem_bro':
      return [failLine(atMs, '081FF456', '10 00 00 00')];
    case 'cem_bcp_bro':
      return [failLine(atMs, '081FF456', '14 00 00 00')];
    case 'bem_crm':
      return [failLine(atMs, '081E56F4', '01 00 00 00')];
    case 'bem_ccs':
      return [failLine(atMs, '081E56F4', '00 01 00 00')];
    case 'cst_fault':
      return [
        failLine(atMs, '101AF456', '04 00 00 00'),
        failLine(atMs + 80, '181DF456', '00 00 01 00 55 66 77 00')
      ];
    case 'cst_connector':
      return [
        failLine(atMs, '101AF456', '00 02 00 00'),
        failLine(atMs + 80, '181DF456', '00 00 01 00 55 66 77 00')
      ];
    case 'cst_emergency':
      return [
        failLine(atMs, '101AF456', '00 10 00 00'),
        failLine(atMs + 80, '181DF456', '00 00 01 00 55 66 77 00')
      ];
    case 'bst_insulation':
      return [
        failLine(atMs, '101956F4', '00 01 00 00'),
        failLine(atMs + 80, '181C56F4', '50 DC 00 E8 00 5A 78')
      ];
    case 'bst_connector':
      return [
        failLine(atMs, '101956F4', '00 08 00 00'),
        failLine(atMs + 80, '181C56F4', '50 DC 00 E8 00 5A 78')
      ];
    case 'bst_cst_both':
      return [
        failLine(atMs, '101956F4', '00 01 00 00'),
        failLine(atMs + 60, '101AF456', '04 00 00 00'),
        failLine(atMs + 120, '181C56F4', '50 DC 00 E8 00 5A 78'),
        failLine(atMs + 140, '181DF456', '00 00 01 00 55 66 77 00')
      ];
    default:
      return [];
  }
}

function getFailureMode(modeId) {
  for (var i = 0; i < FAILURE_MODES.length; i++) {
    if (FAILURE_MODES[i].id === modeId) return FAILURE_MODES[i];
  }
  return FAILURE_MODES[0];
}

function resolveFailAtMs(runOpts) {
  runOpts = runOpts || {};
  if (runOpts.failAtSec != null && runOpts.failAtSec !== '') {
    return Math.max(0, Number(runOpts.failAtSec) * 1000) || 0;
  }
  var min = parseInt(runOpts.failAtMin, 10) || 0;
  var sec = parseInt(runOpts.failAtSecRem, 10) || 0;
  return (min * 60 + sec) * 1000;
}

function resolveFailInject(runOpts) {
  var modeId = runOpts.failMode || 'none';
  if (!modeId || modeId === 'none') return null;
  var meta = getFailureMode(modeId);
  var atMs = resolveFailAtMs(runOpts);
  var events = buildFailureEvents(modeId, atMs);
  if (!events.length) return null;
  return {
    modeId: modeId,
    atMs: atMs,
    events: events,
    expect: meta.expect,
    code: meta.code,
    extraFrames: events.length,
    stopAfterFail: true
  };
}

function mergeFailureIntoLog(logText, failInject) {
  if (!failInject || !failInject.events.length) return logText;
  var frames = parseLogLines(logText).concat(failInject.events);
  frames.sort(function (a, b) { return a.relMs - b.relMs; });
  if (failInject.stopAfterFail) {
    var cutMs = failInject.events[failInject.events.length - 1].relMs;
    frames = frames.filter(function (f) { return f.relMs <= cutMs; });
  }
  return frames.map(function (f) { return f.line; }).join('\n');
}

function enrichPlanWithFail(plan, runOpts) {
  var fail = resolveFailInject(runOpts);
  if (!fail) return plan;
  plan.failInject = fail;
  if (plan.estimate) {
    plan.estimate.totalFrames += fail.extraFrames;
    plan.estimate.failMode = fail.modeId;
    plan.estimate.failAtMs = fail.atMs;
  }
  if (plan.mode === 'static' && plan.log) {
    plan.log = mergeFailureIntoLog(plan.log, fail);
    if (plan.estimate) {
      plan.estimate = estimateRun(plan.log, runOpts.collectMode || 'all');
      plan.estimate.failMode = fail.modeId;
      plan.estimate.failAtMs = fail.atMs;
    }
  }
  return plan;
}

var COLLECT_MODES = [
  { id: 'all', label: '全量', desc: '不过滤，等同真机全 CAN' },
  { id: 'soh', label: '容量测试', desc: '只保留 SOH 必要报文' },
  { id: 'health', label: '电芯鉴康', desc: '只保留体检必要报文' }
];

var PLAY_MODES = [
  { id: 'timeline', label: '时间线', desc: '按时间戳逐帧发送' },
  { id: 'instant', label: '一次性', desc: '瞬间灌入，跳过等待' }
];

var LOG_TRIM_WARN = 180000;
var LOG_TRIM_MAX = 200000;

function fmtTs(ms) {
  ms = Math.max(0, ms | 0);
  var sec = Math.floor(ms / 1000);
  var msec = ms % 1000;
  var h = Math.floor(sec / 3600);
  var mi = Math.floor((sec % 3600) / 60);
  var s = sec % 60;
  return (h < 10 ? '0' : '') + h + ':' +
    (mi < 10 ? '0' : '') + mi + ':' +
    (s < 10 ? '0' : '') + s + '.' + ('00' + msec).slice(-3);
}

function fmtDuration(min) {
  if (!min) return '场景原始';
  if (min < 60) return min + ' 分钟';
  if (min < 1440) {
    var h = Math.round(min / 60 * 10) / 10;
    return h + ' 小时';
  }
  if (min < 43200) {
    var d = Math.round(min / 1440 * 10) / 10;
    return d + ' 天';
  }
  var mo = Math.round(min / 43200 * 10) / 10;
  return mo + ' 个月';
}

function fmtSimClock(ms) {
  ms = Math.max(0, ms | 0);
  var sec = Math.floor(ms / 1000);
  if (sec < 3600) {
    var mi = Math.floor(sec / 60);
    var s = sec % 60;
    return (mi < 10 ? '0' : '') + mi + ':' + (s < 10 ? '0' : '') + s;
  }
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  if (h < 48) return h + 'h' + (m < 10 ? '0' : '') + m;
  var d = Math.floor(h / 24);
  h = h % 24;
  return d + 'd' + h + 'h';
}

function parseTsMs(ts) {
  var m = /^(\d+):(\d+):(\d+)(?:\.(\d+))?/.exec(String(ts || '').trim());
  if (!m) return null;
  var h = parseInt(m[1], 10);
  var mi = parseInt(m[2], 10);
  var s = parseInt(m[3], 10);
  var frac = m[4] || '0';
  var ms = parseInt((frac + '000').slice(0, 3), 10);
  return ((h * 3600 + mi * 60 + s) * 1000 + ms) | 0;
}

function parseLogLines(logText) {
  var raw = String(logText || '').split(/\r?\n/);
  var out = [];
  var base = null;
  for (var i = 0; i < raw.length; i++) {
    var line = raw[i].trim();
    if (!line || line.charAt(0) === '#') continue;
    var sp = line.indexOf(' ');
    if (sp <= 0) {
      out.push({ relMs: out.length * 40, line: line });
      continue;
    }
    var ts = line.slice(0, sp);
    var tms = parseTsMs(ts);
    if (tms == null) {
      out.push({ relMs: out.length * 40, line: line });
      continue;
    }
    if (base == null) base = tms;
    out.push({ relMs: Math.max(0, tms - base), line: line });
  }
  return out;
}

function chargeCycleLines(tMs, soc, v, reqA, outA) {
  var vHex = chargeSpeed.encVoltage(v);
  var iReq = chargeSpeed.encCurrent(-reqA);
  var iOut = chargeSpeed.encCurrent(-outA);
  var socHex = ('0' + Math.max(0, Math.min(100, Math.round(soc))).toString(16)).slice(-2).toUpperCase();
  var lines = [];
  lines.push(fmtTs(tMs) + ' 181056F4 ' + vHex + ' ' + iReq + ' 02');
  lines.push(fmtTs(tMs + 80) + ' 1812F456 ' + vHex + ' ' + iOut + ' 00 00 01');
  lines.push(fmtTs(tMs + 200) + ' 1CEC56F4 10 09 00 02 FF 00 11 00');
  lines.push(fmtTs(tMs + 220) + ' 1CEB56F4 01 ' + vHex + ' ' + iOut + ' 10 0A ' + socHex);
  lines.push(fmtTs(tMs + 240) + ' 1CEB56F4 02 1E 00 00 00 00 00 00');
  lines.push(fmtTs(tMs + 260) + ' 188356F4 01 55 01 53 01 00 ' + socHex);
  return lines;
}

function buildSohChargeLog() {
  return buildExtendedLog(dcFlow.DEMO_LOGS.success, {
    durationMin: 30,
    socStart: 28,
    socEnd: 52,
    tickSec: 20
  });
}

function buildHealthChargeLog() {
  var base = buildExtendedLog(chargeSpeed.buildImpedanceDemoLog(), {
    durationMin: 15,
    socStart: 40,
    socEnd: 65,
    tickSec: 25,
    handshakeCutMs: 8000
  });
  var vHex = chargeSpeed.encVoltage(740);
  return base + '\n' +
    '00:00:14.800 1CEC56F4 10 09 00 02 FF 00 1C 00\n' +
    '00:00:14.820 1CEB56F4 01 A3 01 4C 1D B8 0B 58\n' +
    '00:00:14.840 1CEB56F4 02 4C 1D B0 0B 00 00 00';
}

function buildExtendedLog(baseLog, opts) {
  opts = opts || {};
  var durationMin = opts.durationMin || 0;
  if (!durationMin) return String(baseLog || '');

  var durationMs = durationMin * 60 * 1000;
  var tickMs = Math.max(5000, (opts.tickSec || 20) * 1000);
  var socStart = opts.socStart != null ? opts.socStart : 25;
  var socEnd = opts.socEnd != null ? opts.socEnd : 85;
  var cutMs = opts.handshakeCutMs != null ? opts.handshakeCutMs : 12000;
  var v = opts.voltage != null ? opts.voltage : 710;
  var reqA = opts.reqA != null ? opts.reqA : 80;
  var outA = opts.outA != null ? opts.outA : 78;

  var baseFrames = parseLogLines(baseLog);
  var handshake = [];
  for (var i = 0; i < baseFrames.length; i++) {
    if (baseFrames[i].relMs <= cutMs) handshake.push(baseFrames[i].line);
  }
  if (!handshake.length && baseFrames.length) {
    handshake = baseFrames.slice(0, Math.min(baseFrames.length, 20)).map(function (f) { return f.line; });
  }

  var t = cutMs;
  var lines = handshake.slice();
  var tick = 0;
  while (t < durationMs) {
    var soc = socStart;
    if (durationMs > cutMs + tickMs) {
      soc = socStart + (socEnd - socStart) * (t - cutMs) / (durationMs - cutMs);
    }
    var chunk = chargeCycleLines(t, soc, v, reqA, outA);
    lines = lines.concat(chunk);
    t += tickMs;
    tick++;
  }

  if (opts.withEnd) {
    lines.push(fmtTs(Math.min(durationMs, t)) + ' 101956F4 01 00 00 00');
    lines.push(fmtTs(Math.min(durationMs, t + 50)) + ' 181C56F4 2D DC 00 E8 00 5A 78');
    lines.push(fmtTs(Math.min(durationMs, t + 100)) + ' 181DF456 01 00 05 00 39 30 01 00');
  }

  return lines.join('\n');
}

function extractHandshakeLines(baseLog, cutMs) {
  var baseFrames = parseLogLines(baseLog);
  var out = [];
  for (var i = 0; i < baseFrames.length; i++) {
    if (baseFrames[i].relMs <= cutMs) out.push(baseFrames[i]);
  }
  if (!out.length && baseFrames.length) {
    out = baseFrames.slice(0, Math.min(baseFrames.length, 20));
  }
  return out;
}

function mergeExtendOpts(hit, runOpts) {
  return Object.assign({}, hit.extendOpts || {}, {
    durationMin: runOpts.durationMin,
    socStart: runOpts.socStart,
    socEnd: runOpts.socEnd,
    tickSec: runOpts.tickSec || (hit.extendOpts && hit.extendOpts.tickSec) || 20
  });
}

function calcSoc(tMs, cutMs, durationMs, socStart, socEnd) {
  if (durationMs <= cutMs) return socStart;
  var p = (tMs - cutMs) / (durationMs - cutMs);
  if (p < 0) p = 0;
  if (p > 1) p = 1;
  return socStart + (socEnd - socStart) * p;
}

function estimateProcedural(hit, runOpts, ext) {
  var durationMin = runOpts.durationMin || 0;
  var collectMode = runOpts.collectMode || 'all';
  var cutMs = ext.handshakeCutMs != null ? ext.handshakeCutMs : 12000;
  var tickMs = Math.max(5000, (ext.tickSec || 20) * 1000);
  var durationMs = durationMin * 60 * 1000;
  var handshake = extractHandshakeLines(hit.baseLog || hit.log, cutMs);
  var cycles = Math.max(0, Math.floor((durationMs - cutMs) / tickMs));
  var linesPerCycle = 6;
  var endLines = durationMin >= 15 ? 3 : 0;
  var totalFrames = handshake.length + cycles * linesPerCycle + endLines;
  var avgBytes = collectMode === 'all' ? 78 : 68;
  var rawBytes = totalFrames * avgBytes;
  var keepRatio = collectMode === 'soh' ? 0.84 : (collectMode === 'health' ? 0.88 : 1);
  var keptBytes = Math.round(rawBytes * keepRatio);
  var keptFrames = Math.round(totalFrames * keepRatio);
  return {
    totalFrames: totalFrames,
    simMs: durationMs,
    simMin: durationMin,
    rawBytes: rawBytes,
    keptFrames: keptFrames,
    keptBytes: keptBytes,
    trimWarn: keptBytes > LOG_TRIM_WARN,
    trimOver: keptBytes > LOG_TRIM_MAX,
    procedural: true,
    cycles: cycles,
    tickSec: ext.tickSec || 20
  };
}

function resolveRunPlan(scenarioId, runOpts) {
  runOpts = runOpts || {};
  var hit = getScenario(scenarioId);
  if (!hit) return { mode: 'static', log: '', estimate: null };
  var durationMin = runOpts.durationMin != null ? runOpts.durationMin : 0;
  var collectMode = runOpts.collectMode || 'all';
  if (!durationMin) {
    var log0 = hit.baseLog || hit.log;
    return enrichPlanWithFail({
      mode: 'static',
      log: log0,
      estimate: estimateRun(log0, collectMode)
    }, runOpts);
  }
  var ext = mergeExtendOpts(hit, runOpts);
  if (durationMin >= PROCEDURAL_MIN) {
    var estP = estimateProcedural(hit, runOpts, ext);
    return enrichPlanWithFail({
      mode: 'procedural',
      scenarioId: scenarioId,
      durationMin: durationMin,
      collectMode: collectMode,
      handshake: extractHandshakeLines(hit.baseLog || hit.log, ext.handshakeCutMs || 12000),
      cutMs: ext.handshakeCutMs != null ? ext.handshakeCutMs : 12000,
      tickMs: Math.max(5000, (ext.tickSec || 20) * 1000),
      tickSec: ext.tickSec || 20,
      socStart: ext.socStart != null ? ext.socStart : 25,
      socEnd: ext.socEnd != null ? ext.socEnd : 85,
      voltage: ext.voltage != null ? ext.voltage : 710,
      reqA: ext.reqA != null ? ext.reqA : 80,
      outA: ext.outA != null ? ext.outA : 78,
      withEnd: durationMin >= 15 && !(runOpts.failMode && runOpts.failMode !== 'none'),
      estimate: estP
    }, runOpts);
  }
  var log = buildExtendedLog(hit.baseLog || hit.log, Object.assign({}, ext, {
    withEnd: durationMin >= 15 && !(runOpts.failMode && runOpts.failMode !== 'none')
  }));
  return enrichPlanWithFail({
    mode: 'static',
    log: log,
    estimate: estimateRun(log, collectMode)
  }, runOpts);
}

function buildLogForRun(scenarioId, runOpts) {
  var plan = resolveRunPlan(scenarioId, runOpts);
  return {
    log: plan.log || '',
    estimate: plan.estimate,
    plan: plan
  };
}

function estimateRun(logText, collectMode) {
  collectMode = collectMode || 'all';
  var frames = parseLogLines(logText);
  var simMs = frames.length ? frames[frames.length - 1].relMs : 0;
  var rawBytes = String(logText || '').length;
  var keptFrames = frames.length;
  var keptBytes = rawBytes;
  if (collectMode !== 'all') {
    var filtered = batteryCollect.filterLogText(logText, collectMode);
    keptFrames = filtered.stats.keptLines;
    keptBytes = filtered.text.length;
  }
  return {
    totalFrames: frames.length,
    simMs: simMs,
    simMin: Math.round(simMs / 600) / 100,
    rawBytes: rawBytes,
    keptFrames: keptFrames,
    keptBytes: keptBytes,
    trimWarn: keptBytes > LOG_TRIM_WARN,
    trimOver: keptBytes > LOG_TRIM_MAX
  };
}

var SCENARIO_GROUPS = [
  {
    id: 'connect',
    title: '连接与裁决',
    items: [
      {
        id: 'success',
        title: '正常直流充电',
        desc: '完整握手 → 充电循环 → 结束统计',
        log: dcFlow.DEMO_LOGS.success,
        extendOpts: { socStart: 30, socEnd: 75, tickSec: 20, handshakeCutMs: 3500 }
      },
      {
        id: 'cem',
        title: '桩侧 CEM 超时',
        desc: '参数阶段桩报超时错误',
        log: dcFlow.DEMO_LOGS.cem,
        extendOpts: { handshakeCutMs: 5000, tickSec: 30 }
      },
      {
        id: 'cst',
        title: '桩故障 CST 中止',
        desc: '充电中桩侧故障中止',
        log: dcFlow.DEMO_LOGS.cst,
        extendOpts: { socStart: 35, socEnd: 55, tickSec: 25 }
      }
    ]
  },
  {
    id: 'speed',
    title: '充电慢分析',
    items: chargeSpeed.DEMO_SCENARIOS.map(function (s) {
      return {
        id: s.id,
        title: s.title.replace(/^示例：/, ''),
        desc: s.desc,
        log: s.log,
        extendOpts: { handshakeCutMs: 8000, socStart: 35, socEnd: 70, tickSec: 20 }
      };
    })
  },
  {
    id: 'battery',
    title: '电池体检',
    items: [
      {
        id: 'soh_charge',
        title: '容量测试场景',
        desc: 'SOC 爬升，含 BRM/BCS/CCS',
        log: dcFlow.DEMO_LOGS.success,
        extendOpts: { socStart: 22, socEnd: 88, tickSec: 60, handshakeCutMs: 12000 }
      },
      {
        id: 'health_full',
        title: '电芯鉴康场景',
        desc: '高阻抗 + BSM/BSD',
        log: chargeSpeed.buildImpedanceDemoLog(),
        extendOpts: { socStart: 20, socEnd: 92, tickSec: 300, handshakeCutMs: 8000 }
      }
    ]
  }
];

function listScenarios() {
  var flat = [];
  SCENARIO_GROUPS.forEach(function (g) {
    (g.items || []).forEach(function (item) {
      flat.push({
        id: item.id,
        group: g.title,
        title: item.title,
        desc: item.desc,
        log: item.log,
        baseLog: item.log,
        extendOpts: item.extendOpts || {}
      });
    });
  });
  return flat;
}

function getScenario(id) {
  var all = listScenarios();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}

function applyCollectMode(modeId) {
  try {
    var app = getApp();
    if (!app || !app.globalData) return;
    if (modeId === 'soh' || modeId === 'health') {
      app.globalData.batteryCollectMode = modeId;
    } else {
      app.globalData.batteryCollectMode = null;
    }
  } catch (e) {}
}

function clearCollectMode() {
  applyCollectMode('all');
}

function createProceduralPlayer(plan, handlers) {
  handlers = handlers || {};
  var handshake = plan.handshake || [];
  var durationMs = plan.durationMin * 60 * 1000;
  var cutMs = plan.cutMs;
  var tickMs = plan.tickMs;
  var totalCycles = Math.max(0, Math.floor((durationMs - cutMs) / tickMs));
  var endLines = plan.withEnd ? 3 : 0;
  var failInject = plan.failInject || null;
  var failFired = false;
  var totalFrames = handshake.length + totalCycles * 6 + endLines;
  if (failInject) totalFrames += failInject.extraFrames;

  var hsIdx = 0;
  var cycleIdx = 0;
  var endDone = false;
  var sent = 0;
  var playing = false;
  var timer = null;
  var simMs = 0;
  var wallLast = 0;
  var wallStart = 0;
  var speed = 1;
  var tickMsWall = 50;

  function emitProgress() {
    if (typeof handlers.onProgress === 'function') {
      handlers.onProgress({
        sent: sent,
        total: totalFrames,
        simMs: simMs,
        simTotalMs: durationMs,
        wallMs: wallStart ? (Date.now() - wallStart) : 0,
        playing: playing,
        procedural: true
      });
    }
  }

  function emitEnd(t) {
    if (endDone || !plan.withEnd) return;
    var lines = [
      fmtTs(t) + ' 101956F4 01 00 00 00',
      fmtTs(t + 50) + ' 181C56F4 2D DC 00 E8 00 5A 78',
      fmtTs(t + 100) + ' 181DF456 01 00 05 00 39 30 01 00'
    ];
    for (var i = 0; i < lines.length; i++) {
      if (typeof handlers.onLine === 'function') handlers.onLine(lines[i]);
      sent++;
    }
    endDone = true;
  }

  function emitDue(maxLines) {
    var budget = maxLines || MAX_LINES_PER_TICK;
    var pushed = false;
    while (budget > 0) {
      if (hsIdx < handshake.length) {
        if (handshake[hsIdx].relMs > simMs) break;
        if (typeof handlers.onLine === 'function') handlers.onLine(handshake[hsIdx].line);
        hsIdx++;
        sent++;
        budget--;
        pushed = true;
        continue;
      }
      if (cycleIdx < totalCycles) {
        var t = cutMs + cycleIdx * tickMs;
        if (t > simMs) break;
        var soc = calcSoc(t, cutMs, durationMs, plan.socStart, plan.socEnd);
        var chunk = chargeCycleLines(t, soc, plan.voltage, plan.reqA, plan.outA);
        for (var ci = 0; ci < chunk.length; ci++) {
          if (typeof handlers.onLine === 'function') handlers.onLine(chunk[ci]);
          sent++;
          budget--;
          if (budget <= 0) { pushed = true; break; }
        }
        cycleIdx++;
        pushed = true;
        continue;
      }
      if (!endDone && simMs >= durationMs - 100) {
        emitEnd(durationMs);
        budget -= 3;
        pushed = true;
      }
      break;
    }
    return pushed;
  }

  function tick() {
    if (!playing) return;
    var now = Date.now();
    simMs += (now - wallLast) * speed;
    wallLast = now;
    if (simMs > durationMs) simMs = durationMs;
    if (failInject && simMs >= failInject.atMs && !failFired) {
      failFired = true;
      for (var fi = 0; fi < failInject.events.length; fi++) {
        if (typeof handlers.onLine === 'function') handlers.onLine(failInject.events[fi].line);
        sent++;
      }
      if (failInject.stopAfterFail) {
        cycleIdx = totalCycles;
        endDone = true;
      }
    }
    emitDue(MAX_LINES_PER_TICK);
    emitProgress();
    var done = sent >= totalFrames || (simMs >= durationMs && hsIdx >= handshake.length &&
      cycleIdx >= totalCycles && (endDone || !plan.withEnd));
    if (done) {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      emitProgress();
      if (typeof handlers.onDone === 'function') handlers.onDone();
    }
  }

  return {
    getFrameCount: function () { return totalFrames; },
    play: function () {
      if (playing) return;
      playing = true;
      wallLast = Date.now();
      wallStart = wallLast;
      if (!timer) timer = setInterval(tick, tickMsWall);
      emitProgress();
    },
    pause: function () {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      emitProgress();
    },
    stop: function () {
      this.pause();
      hsIdx = 0;
      cycleIdx = 0;
      endDone = false;
      failFired = false;
      sent = 0;
      simMs = 0;
      wallStart = 0;
      emitProgress();
    },
    setSpeed: function (s) {
      speed = Math.max(0.25, Math.min(200, Number(s) || 1));
      emitProgress();
    },
    destroy: function () {
      this.pause();
      handlers = {};
    }
  };
}

function runInstantProcedural(plan, handlers) {
  handlers = handlers || {};
  var cancelled = false;
  var handshake = plan.handshake || [];
  var durationMs = plan.durationMin * 60 * 1000;
  var cutMs = plan.cutMs;
  var tickMs = plan.tickMs;
  var totalCycles = Math.max(0, Math.floor((durationMs - cutMs) / tickMs));
  var failInject = plan.failInject || null;
  var failFired = false;
  var totalFrames = handshake.length + totalCycles * 6 + (plan.withEnd ? 3 : 0);
  if (failInject) totalFrames += failInject.extraFrames;
  var sent = 0;
  var hsIdx = 0;
  var cycleIdx = 0;
  var batchCycles = 40;

  function progress() {
    if (typeof handlers.onProgress === 'function') {
      handlers.onProgress({ sent: sent, total: totalFrames, simMs: durationMs, playing: true, procedural: true });
    }
  }

  function fireFailIfDue(tMs) {
    if (!failInject || failFired || tMs < failInject.atMs) return false;
    failFired = true;
    for (var fi = 0; fi < failInject.events.length; fi++) {
      if (typeof handlers.onLine === 'function') handlers.onLine(failInject.events[fi].line);
      sent++;
    }
    return !!failInject.stopAfterFail;
  }

  function step() {
    if (cancelled) return;
    var end = Math.min(cycleIdx + batchCycles, totalCycles);
    for (; cycleIdx < end; cycleIdx++) {
      var t = cutMs + cycleIdx * tickMs;
      if (fireFailIfDue(t)) {
        cycleIdx = totalCycles;
        break;
      }
      var soc = calcSoc(t, cutMs, durationMs, plan.socStart, plan.socEnd);
      var chunk = chargeCycleLines(t, soc, plan.voltage, plan.reqA, plan.outA);
      for (var i = 0; i < chunk.length; i++) {
        if (typeof handlers.onLine === 'function') handlers.onLine(chunk[i]);
        sent++;
      }
    }
    progress();
    if (cycleIdx < totalCycles) {
      setTimeout(step, 0);
      return;
    }
    if (!failFired && failInject && fireFailIfDue(durationMs)) {
      progress();
      if (typeof handlers.onDone === 'function') handlers.onDone();
      return;
    }
    if (plan.withEnd && !(failInject && failInject.stopAfterFail && failFired)) {
      var tl = durationMs;
      [fmtTs(tl) + ' 101956F4 01 00 00 00',
        fmtTs(tl + 50) + ' 181C56F4 2D DC 00 E8 00 5A 78',
        fmtTs(tl + 100) + ' 181DF456 01 00 05 00 39 30 01 00'].forEach(function (ln) {
        if (typeof handlers.onLine === 'function') handlers.onLine(ln);
        sent++;
      });
    }
    progress();
    if (typeof handlers.onDone === 'function') handlers.onDone();
  }

  for (; hsIdx < handshake.length; hsIdx++) {
    if (fireFailIfDue(handshake[hsIdx].relMs)) break;
    if (typeof handlers.onLine === 'function') handlers.onLine(handshake[hsIdx].line);
    sent++;
  }
  progress();
  if (failInject && failInject.stopAfterFail && failFired) {
    if (typeof handlers.onDone === 'function') handlers.onDone();
    return { cancel: function () { cancelled = true; } };
  }
  setTimeout(step, 0);

  return {
    cancel: function () { cancelled = true; }
  };
}

function createStreamPlayer(logText, handlers, opts) {
  handlers = handlers || {};
  opts = opts || {};
  var frames = parseLogLines(logText);
  var idx = 0;
  var playing = false;
  var timer = null;
  var simMs = 0;
  var wallLast = 0;
  var wallStart = 0;
  var speed = 1;
  var tickMs = 50;
  var maxSimMs = opts.maxSimMs || null;

  function emitProgress() {
    if (typeof handlers.onProgress === 'function') {
      handlers.onProgress({
        sent: idx,
        total: frames.length,
        simMs: simMs,
        simTotalMs: frames.length ? frames[frames.length - 1].relMs : 0,
        wallMs: wallStart ? (Date.now() - wallStart) : 0,
        playing: playing
      });
    }
  }

  function tick() {
    if (!playing) return;
    var now = Date.now();
    simMs += (now - wallLast) * speed;
    wallLast = now;
    if (maxSimMs != null && simMs > maxSimMs) simMs = maxSimMs;
    var pushed = false;
    while (idx < frames.length && frames[idx].relMs <= simMs) {
      if (typeof handlers.onLine === 'function') handlers.onLine(frames[idx].line);
      idx++;
      pushed = true;
    }
    if (pushed) emitProgress();
    var done = idx >= frames.length || (maxSimMs != null && simMs >= maxSimMs);
    if (done) {
      playing = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      emitProgress();
      if (typeof handlers.onDone === 'function') handlers.onDone();
    }
  }

  return {
    getFrameCount: function () { return frames.length; },
    play: function () {
      if (playing || !frames.length) return;
      playing = true;
      wallLast = Date.now();
      wallStart = wallLast;
      if (!timer) timer = setInterval(tick, tickMs);
      emitProgress();
    },
    pause: function () {
      playing = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      emitProgress();
    },
    stop: function () {
      this.pause();
      idx = 0;
      simMs = 0;
      wallStart = 0;
      emitProgress();
    },
    setSpeed: function (s) {
      speed = Math.max(0.25, Math.min(50, Number(s) || 1));
      emitProgress();
    },
    destroy: function () {
      this.pause();
      handlers = {};
    }
  };
}

/** 后台模拟任务：离开模拟器页（switchTab）后继续灌报文 */
var bgRun = {
  player: null,
  instantJob: null,
  playing: false,
  progress: null
};

function stopBackgroundRun() {
  if (bgRun.instantJob && bgRun.instantJob.cancel) {
    bgRun.instantJob.cancel();
  }
  bgRun.instantJob = null;
  if (bgRun.player && bgRun.player.destroy) {
    bgRun.player.destroy();
  }
  bgRun.player = null;
  bgRun.playing = false;
  bgRun.progress = null;
}

function registerBackgroundPlayer(player) {
  stopBackgroundRun();
  bgRun.player = player;
  bgRun.playing = true;
}

function registerBackgroundInstantJob(job) {
  stopBackgroundRun();
  bgRun.instantJob = job;
  bgRun.playing = true;
}

function touchBackgroundProgress(p) {
  bgRun.progress = p || null;
  if (p && p.playing === false && p.sent >= p.total) {
    bgRun.playing = false;
  }
}

function isBackgroundPlaying() {
  return !!bgRun.playing;
}

function getBackgroundState() {
  return {
    playing: !!bgRun.playing,
    progress: bgRun.progress,
    hasPlayer: !!(bgRun.player || bgRun.instantJob),
    player: bgRun.player,
    instantJob: bgRun.instantJob
  };
}

function detachBackgroundUi() {
  /* 页面卸载时只解绑 UI，不停止任务 */
}

module.exports = {
  DURATION_PRESETS: DURATION_PRESETS,
  QUICK_PRESETS: QUICK_PRESETS,
  TICK_PRESETS: TICK_PRESETS,
  FAIL_AT_PRESETS: FAIL_AT_PRESETS,
  FAILURE_MODES: FAILURE_MODES,
  PROCEDURAL_MIN: PROCEDURAL_MIN,
  COLLECT_MODES: COLLECT_MODES,
  PLAY_MODES: PLAY_MODES,
  LOG_TRIM_WARN: LOG_TRIM_WARN,
  LOG_TRIM_MAX: LOG_TRIM_MAX,
  SCENARIO_GROUPS: SCENARIO_GROUPS,
  listScenarios: listScenarios,
  getScenario: getScenario,
  getFailureMode: getFailureMode,
  resolveRunPlan: resolveRunPlan,
  buildLogForRun: buildLogForRun,
  estimateRun: estimateRun,
  applyCollectMode: applyCollectMode,
  clearCollectMode: clearCollectMode,
  parseLogLines: parseLogLines,
  createStreamPlayer: createStreamPlayer,
  createProceduralPlayer: createProceduralPlayer,
  runInstantProcedural: runInstantProcedural,
  buildExtendedLog: buildExtendedLog,
  buildSohChargeLog: buildSohChargeLog,
  buildHealthChargeLog: buildHealthChargeLog,
  fmtDuration: fmtDuration,
  fmtSimClock: fmtSimClock,
  stopBackgroundRun: stopBackgroundRun,
  registerBackgroundPlayer: registerBackgroundPlayer,
  registerBackgroundInstantJob: registerBackgroundInstantJob,
  touchBackgroundProgress: touchBackgroundProgress,
  isBackgroundPlaying: isBackgroundPlaying,
  getBackgroundState: getBackgroundState,
  detachBackgroundUi: detachBackgroundUi
};
