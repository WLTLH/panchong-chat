/**
 * 电池体检客户采集：只保留必要 27930 报文 + 采集引导 + 完成度检查
 */

var gbt = require('./gbt27930.js');

var KEEP_SOH = {
  'CHM': true, 'BHM': true, 'CRM': true, 'BRM': true,
  'BCP': true, 'CML': true, 'CTS': true, 'BRO': true, 'CRO': true,
  'BCL': true, 'BCS': true, 'CCS': true, 'BSM': true,
  'TP.CM': true, 'TP.DT': true
};

var KEEP_HEALTH = Object.assign({}, KEEP_SOH, {
  'BSD': true, 'CSD': true, 'BST': true, 'CST': true
});

var MODES = {
  soh: {
    id: 'soh',
    title: '容量测试',
    subtitle: '估算电池 SOH（健康容量）',
    keep: KEEP_SOH,
    minSocSpan: 15,
    analyze: 'soh'
  },
  health: {
    id: 'health',
    title: '电芯鉴康',
    subtitle: '容量 · 阻抗 · 平衡 全面体检',
    keep: KEEP_HEALTH,
    minSocSpan: 10,
    analyze: 'health'
  }
};

var COLLECT_STEPS = [
  {
    id: 'prepare',
    icon: '🔌',
    title: '插上充电枪',
    desc: '电量建议在 20%–30%，正常插枪即可，不必跑干也不用刻意充满。'
  },
  {
    id: 'connect',
    icon: '📡',
    title: '连接判充盒',
    desc: '打开蓝牙，在「连接」页连上采集盒，看到通信正常就可以。'
  },
  {
    id: 'charge',
    icon: '⚡',
    title: '边充边记录',
    desc: '点「开始充电体检」，正常充电到 75%–85%，或电量上涨 20% 以上。'
  },
  {
    id: 'analyze',
    icon: '📋',
    title: '查看报告',
    desc: '充电够了点完成，自动生成健康报告，无需复制粘贴任何数据。'
  }
];

var USER_REQ_LABELS = {
  brm: '车辆与电池信息',
  bcs: '电量变化',
  ccs: '充电过程',
  bcl: '充电需求',
  bsd: '结束统计'
};

var KEEP_LABELS = [
  { code: 'BRM', label: '额定容量', need: 'SOH 分母' },
  { code: 'BCS', label: 'SOC / 单体电压', need: '容量与告警' },
  { code: 'CCS', label: '充电电流', need: '安时积分' },
  { code: 'BCL', label: '车需求电流', need: '限流判断' },
  { code: 'CML', label: '桩能力', need: '可选' },
  { code: 'BSM', label: '温度', need: '阻抗置信度' },
  { code: 'BSD', label: '结束统计', need: '鉴康·压差' },
  { code: 'TP', label: '多帧传输', need: 'BRM/BCS 重组' }
];

function getMode(modeId) {
  return MODES[modeId] || MODES.health;
}

function lineCode(line) {
  var f = gbt.parseLogLine(line, 0);
  return f && f.code ? f.code : null;
}

function isLineNeeded(line, modeId) {
  var code = lineCode(line);
  if (!code) return false;
  var keep = getMode(modeId).keep;
  return !!keep[code];
}

/**
 * 精简日志：只保留电池分析必要报文
 */
function filterLogText(logText, modeId) {
  modeId = modeId || 'health';
  var keep = getMode(modeId).keep;
  var lines = String(logText || '').split(/\r?\n/);
  var out = [];
  var stats = { totalLines: 0, keptLines: 0, droppedLines: 0, byCode: {} };

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var line = raw.trim();
    if (!line || line.charAt(0) === '#') continue;
    stats.totalLines++;
    var f = gbt.parseLogLine(line, i);
    if (!f || !f.code || !keep[f.code]) {
      stats.droppedLines++;
      continue;
    }
    out.push(line);
    stats.keptLines++;
    stats.byCode[f.code] = (stats.byCode[f.code] || 0) + 1;
  }

  var ratio = stats.totalLines ? Math.round(stats.keptLines / stats.totalLines * 100) : 0;
  return {
    text: out.join('\n'),
    stats: stats,
    saveRatio: ratio,
    summary: '保留 ' + stats.keptLines + '/' + stats.totalLines + ' 行（约 ' + ratio + '%）'
  };
}

function checkRequirements(codeCounts, modeId) {
  var c = codeCounts || {};
  var items = [
    { key: 'brm', label: 'BRM 额定容量', userLabel: USER_REQ_LABELS.brm, ok: (c.BRM || 0) > 0, hint: '请从插枪握手开始记录' },
    { key: 'bcs', label: 'BCS（SOC）', userLabel: USER_REQ_LABELS.bcs, ok: (c.BCS || 0) >= 3, hint: '充电中需记录到电量变化' },
    { key: 'ccs', label: 'CCS（电流）', userLabel: USER_REQ_LABELS.ccs, ok: (c.CCS || 0) >= 3, hint: '需进入正常充电阶段' },
    { key: 'bcl', label: 'BCL（车需求）', userLabel: USER_REQ_LABELS.bcl, ok: (c.BCL || 0) >= 2, hint: '有助于判断限流', optional: true }
  ];
  if (modeId === 'health') {
    items.push({
      key: 'bsd',
      label: 'BSD（结束统计）',
      userLabel: USER_REQ_LABELS.bsd,
      ok: (c.BSD || 0) > 0,
      hint: '充到结束或拔枪前更易有',
      optional: true
    });
  }
  var required = items.filter(function (x) { return !x.optional; });
  var ready = required.every(function (x) { return x.ok; });
  return { items: items, ready: ready };
}

function assessCollection(logText, modeId) {
  var filtered = filterLogText(logText, modeId);
  var parsed = gbt.decodeLogText(filtered.text);
  var req = checkRequirements(parsed.codeCounts, modeId);
  var socRange = null;
  var socs = [];
  (parsed.frames || []).forEach(function (f) {
    if (f.code === 'BCS' && f.metrics && f.metrics.soc != null) {
      socs.push(Number(f.metrics.soc));
    }
  });
  if (socs.length >= 2) {
    var min = Math.min.apply(null, socs);
    var max = Math.max.apply(null, socs);
    socRange = { min: min, max: max, span: max - min };
  }
  var mode = getMode(modeId);
  var socOk = !socRange || socRange.span >= mode.minSocSpan;
  return {
    ready: req.ready && socOk,
    requirements: req.items,
    socRange: socRange,
    socOk: socOk,
    filtered: filtered,
    codeCounts: parsed.codeCounts,
    frameCount: parsed.totalFrames,
    missing: req.items.filter(function (x) { return !x.ok && !x.optional; }).map(function (x) { return x.hint; })
  };
}

function getCollectGuide(modeId) {
  var mode = getMode(modeId);
  return {
    mode: mode,
    steps: COLLECT_STEPS,
    keepLabels: KEEP_LABELS.filter(function (k) {
      if (k.code === 'BSD') return modeId === 'health';
      if (k.code === 'TP') return true;
      return KEEP_SOH[k.code] || k.code === 'TP';
    }),
    tip: '充电时自动记录必要数据，忽略无关信息，不占满手机存储。'
  };
}

function calcProgress(requirements) {
  var items = requirements || [];
  var required = items.filter(function (x) { return !x.optional; });
  var done = required.filter(function (x) { return x.ok; });
  var pct = required.length ? Math.round(done.length / required.length * 100) : 0;
  return { pct: pct, done: done.length, total: required.length };
}

module.exports = {
  MODES: MODES,
  getMode: getMode,
  getCollectGuide: getCollectGuide,
  isLineNeeded: isLineNeeded,
  filterLogText: filterLogText,
  assessCollection: assessCollection,
  checkRequirements: checkRequirements,
  calcProgress: calcProgress,
  COLLECT_STEPS: COLLECT_STEPS
};
