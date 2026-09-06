/**
 * 高压电池 SOH（容量健康度）估算
 *
 * 方法：充电段安时积分 ΔAh ÷ ΔSOC% × 100，与 BRM 额定容量对比。
 * 数据：27930 BRM（额定 Ah）+ BCS（SOC）+ CCS（输出电流，优先）。
 * 辅助估算，非官方 SOH；隐藏 SOC、未充满放满、恒压段会拉偏结果。
 */

var gbt = require('./gbt27930.js');
var batteryChem = require('./battery_chemistry.js');
var hiddenSoc = require('./hidden_soc.js');
var chargeSpeed = require('./charge_speed.js');

var MIN_CHARGE_A = 3;
var MIN_SOC_SPAN = 8;
var GOOD_SOC_SPAN = 20;
var MIN_DURATION_SEC = 120;
var MID_SOC_LO = 15;
var MID_SOC_HI = 90;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round0(n) {
  return Math.round(n);
}

function median(arr) {
  if (!arr.length) return null;
  var a = arr.slice().sort(function (x, y) { return x - y; });
  var m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function collectSeries(frames) {
  var meta = {
    batteryType: '',
    batteryTypeCode: null,
    ratedCapacityAh: null,
    ratedVoltage: null,
    vin: ''
  };
  var bcs = [];
  var ccs = [];

  (frames || []).forEach(function (f) {
    var m = f.metrics || {};
    var t = f.relMs != null ? f.relMs : (f.tMs || 0);
    if (f.code === 'BRM') {
      if (m.batteryType) meta.batteryType = m.batteryType;
      if (m.batteryTypeCode != null) meta.batteryTypeCode = m.batteryTypeCode;
      if (m.ratedCapacityAh != null) meta.ratedCapacityAh = m.ratedCapacityAh;
      if (m.ratedVoltage != null) meta.ratedVoltage = m.ratedVoltage;
      if (m.vin) meta.vin = m.vin;
    }
    if (f.code === 'BCS' && m.soc != null) {
      bcs.push({
        t: t,
        soc: Number(m.soc),
        i: m.measCurrent != null ? Math.abs(m.measCurrent) : null
      });
    }
    if (f.code === 'CCS' && m.outCurrent != null) {
      ccs.push({
        t: t,
        i: Math.abs(m.outCurrent)
      });
    }
  });

  bcs.sort(function (a, b) { return a.t - b.t; });
  ccs.sort(function (a, b) { return a.t - b.t; });
  return { meta: meta, bcs: bcs, ccs: ccs };
}

function socAt(bcs, t) {
  if (!bcs.length) return null;
  if (t <= bcs[0].t) return bcs[0].soc;
  if (t >= bcs[bcs.length - 1].t) return bcs[bcs.length - 1].soc;
  for (var i = 1; i < bcs.length; i++) {
    var a = bcs[i - 1];
    var b = bcs[i];
    if (t >= a.t && t <= b.t) {
      if (b.t === a.t) return b.soc;
      var r = (t - a.t) / (b.t - a.t);
      return a.soc + r * (b.soc - a.soc);
    }
  }
  return null;
}

function currentAt(ccs, bcs, t) {
  var src = ccs.length ? ccs : bcs;
  if (!src.length) return 0;
  if (t <= src[0].t) return src[0].i || 0;
  if (t >= src[src.length - 1].t) return src[src.length - 1].i || 0;
  for (var i = 1; i < src.length; i++) {
    var a = src[i - 1];
    var b = src[i];
    if (t >= a.t && t <= b.t) {
      var ai = a.i || 0;
      var bi = b.i || 0;
      if (b.t === a.t) return bi;
      var r = (t - a.t) / (b.t - a.t);
      return ai + r * (bi - ai);
    }
  }
  return 0;
}

function integrateAh(ccs, bcs, t0, t1) {
  var useCcs = ccs.length > 0;
  var src = useCcs ? ccs : bcs;
  if (!src.length || t1 <= t0) return 0;

  var points = [];
  src.forEach(function (p) {
    if (p.t >= t0 && p.t <= t1 && p.i != null) points.push(p);
  });
  if (points.length < 2) {
    var i0 = currentAt(ccs, bcs, t0);
    var i1 = currentAt(ccs, bcs, t1);
    return ((i0 + i1) / 2) * (t1 - t0) / 3600000;
  }

  var ah = 0;
  var prevT = t0;
  var prevI = currentAt(ccs, bcs, t0);
  for (var i = 0; i < points.length; i++) {
    var pt = points[i];
    if (pt.t > prevT) {
      ah += ((prevI + pt.i) / 2) * (pt.t - prevT) / 3600000;
    }
    prevT = pt.t;
    prevI = pt.i;
  }
  if (t1 > prevT) {
    var iEnd = currentAt(ccs, bcs, t1);
    ah += ((prevI + iEnd) / 2) * (t1 - prevT) / 3600000;
  }
  return ah;
}

function buildChargeWindows(series) {
  var bcs = series.bcs;
  var ccs = series.ccs;
  if (bcs.length < 2) return [];

  var tStart = bcs[0].t;
  var tEnd = bcs[bcs.length - 1].t;
  var windows = [];
  var win = null;

  for (var t = tStart; t <= tEnd; t += 1000) {
    var i = currentAt(ccs, bcs, t);
    var soc = socAt(bcs, t);
    var charging = i >= MIN_CHARGE_A;
    if (charging) {
      if (!win) win = { t0: t, t1: t, soc0: soc, soc1: soc, samples: 0, iSum: 0 };
      win.t1 = t;
      win.soc1 = soc;
      win.samples += 1;
      win.iSum += i;
    } else if (win) {
      windows.push(win);
      win = null;
    }
  }
  if (win) windows.push(win);

  return windows.map(function (w) {
    var soc0 = socAt(bcs, w.t0);
    var soc1 = socAt(bcs, w.t1);
    var spanSec = (w.t1 - w.t0) / 1000;
    var avgI = w.samples ? w.iSum / w.samples : 0;
    var ah = integrateAh(ccs, bcs, w.t0, w.t1);
    var dSoc = soc0 != null && soc1 != null ? soc1 - soc0 : 0;
    return {
      t0: w.t0,
      t1: w.t1,
      spanSec: spanSec,
      soc0: soc0,
      soc1: soc1,
      dSoc: dSoc,
      avgI: avgI,
      ah: ah,
      midSoc: soc0 != null && soc1 != null ? (soc0 + soc1) / 2 : null
    };
  }).filter(function (w) {
    return w.spanSec >= MIN_DURATION_SEC && w.dSoc >= MIN_SOC_SPAN && w.ah > 0;
  });
}

function estimateFromWindow(win, ratedAh) {
  if (!ratedAh || ratedAh <= 0 || win.dSoc < MIN_SOC_SPAN) return null;
  var cap = win.ah / (win.dSoc / 100);
  var soh = cap / ratedAh * 100;
  return {
    estimatedCapacityAh: round1(cap),
    sohPct: round1(soh),
    ah: round1(win.ah),
    dSoc: round1(win.dSoc),
    spanSec: Math.round(win.spanSec),
    soc0: round1(win.soc0),
    soc1: round1(win.soc1),
    avgI: round1(win.avgI),
    midSoc: win.midSoc != null ? round1(win.midSoc) : null
  };
}

function scoreConfidence(estimates, series, hidden) {
  if (!estimates.length) return { level: 'none', label: '无法估算', score: 0 };

  var best = estimates[0];
  var span = Math.abs(best.dSoc || 0);
  var mid = best.midSoc != null ? best.midSoc : 50;
  var score = 30;

  if (span >= GOOD_SOC_SPAN) score += 30;
  else if (span >= 15) score += 18;
  else score += 8;

  if (best.spanSec >= 600) score += 15;
  else if (best.spanSec >= MIN_DURATION_SEC) score += 8;

  if (mid >= MID_SOC_LO && mid <= MID_SOC_HI) score += 15;
  else score += 5;

  if (series.meta.ratedCapacityAh) score += 10;
  if (series.ccs.length >= 4) score += 10;
  else if (series.bcs.some(function (p) { return p.i != null; })) score += 4;

  if (hidden && hidden.detected) score -= 15;
  if (estimates.length >= 2) score += 5;

  if (score >= 75) return { level: 'high', label: '较高', score: score };
  if (score >= 50) return { level: 'medium', label: '中等', score: score };
  return { level: 'low', label: '偏低', score: score };
}

function gradeSoh(sohPct) {
  if (sohPct == null || !isFinite(sohPct)) {
    return { label: '—', color: '#8A8A8A', summary: '数据不足，无法给出 SOH' };
  }
  if (sohPct >= 95) {
    return {
      label: '健康',
      color: '#07C160',
      summary: '估算 SOH ' + round1(sohPct) + '%，容量衰减不明显（辅助估算，非官方值）。'
    };
  }
  if (sohPct >= 85) {
    return {
      label: '良好',
      color: '#2F6BFF',
      summary: '估算 SOH ' + round1(sohPct) + '%，轻微衰减，可继续观察。'
    };
  }
  if (sohPct >= 70) {
    return {
      label: '关注',
      color: '#E67E22',
      summary: '估算 SOH ' + round1(sohPct) + '%，容量衰减较明显，建议结合满充放满或专业设备复测。'
    };
  }
  return {
    label: '偏低',
    color: '#E74C3C',
    summary: '估算 SOH ' + round1(sohPct) + '%，容量衰减大或日志段不满足测试条件，建议复测。'
  };
}

function pickBestEstimates(windows, ratedAh) {
  var all = [];
  windows.forEach(function (w) {
    var est = estimateFromWindow(w, ratedAh);
    if (!est) return;
    if (est.midSoc != null && (est.midSoc < MID_SOC_LO || est.midSoc > MID_SOC_HI)) {
      est.note = 'SOC 区间偏边缘';
    }
    all.push(est);
  });

  if (!all.length) return [];

  var midPreferred = all.filter(function (e) {
    return e.midSoc != null && e.midSoc >= 20 && e.midSoc <= 85;
  });
  var pool = midPreferred.length ? midPreferred : all;
  pool.sort(function (a, b) { return b.dSoc - a.dSoc; });
  return pool;
}

/**
 * @param {string} logText
 * @param {{ manualRatedAh?: number }} opts
 */
function analyzeBatterySoh(logText, opts) {
  opts = opts || {};
  var parsed = gbt.decodeLogText(logText || '');
  var frames = parsed.frames || [];
  var series = collectSeries(frames);
  var chem = batteryChem.resolveChemistry(frames);
  var hidden = hiddenSoc.detectHiddenSocHints(frames);

  var ratedAh = opts.manualRatedAh != null && opts.manualRatedAh > 0
    ? Number(opts.manualRatedAh)
    : series.meta.ratedCapacityAh;

  var windows = buildChargeWindows(series);
  var estimates = ratedAh ? pickBestEstimates(windows, ratedAh) : [];
  var primary = estimates.length ? estimates[0] : null;

  var sohValues = estimates.map(function (e) { return e.sohPct; });
  var sohMedian = median(sohValues);
  var capMedian = median(estimates.map(function (e) { return e.estimatedCapacityAh; }));

  var confidence = scoreConfidence(estimates, series, hidden);
  var grade = gradeSoh(sohMedian);

  var status = 'ok';
  var issues = [];
  if (!series.bcs.length) issues.push('缺少 BCS（SOC）报文');
  if (!series.ccs.length && !series.bcs.some(function (p) { return p.i != null; })) {
    issues.push('缺少 CCS 电流，无法安时积分');
  }
  if (!ratedAh) {
    status = 'no_rated';
    issues.push('缺少 BRM 额定容量，请在下方手动填写额定 Ah');
  } else if (!windows.length) {
    status = 'insufficient';
    issues.push('充电段不足：需连续充电 ≥' + MIN_DURATION_SEC + 's 且 SOC 变化 ≥' + MIN_SOC_SPAN + '%');
  } else if (!estimates.length) {
    status = 'insufficient';
    issues.push('有效充电窗口内 SOC 变化过小');
  }

  if (hidden && hidden.detected) {
    issues.push('检测到隐藏电量线索（' + hidden.primary.label + '），SOH 可能偏差');
  }

  var advice = [
    '推荐采集一次 SOC 约 20%→70% 的完整恒流充电段，避开满电降流与表显跳变。',
    'SOH = 实测充入 Ah ÷ ΔSOC% × 100 ÷ BRM 额定 Ah；结果仅供辅助，非质保或定责依据。',
    '若 BMS 厂家 CAN 有 SOH 信号，以车端标定为准；本工具仅基于 27930 枪线估算。'
  ];
  if (status === 'no_rated') {
    advice.unshift('填写与铭牌/BRM 一致的额定容量（Ah）后再分析。');
  }

  var evidence = [];
  if (primary) {
    evidence.push({
      tag: 'neutral',
      text: '主窗口 SOC ' + primary.soc0 + '%→' + primary.soc1 + '%（Δ' + primary.dSoc + '%），充入约 ' + primary.ah + 'Ah，平均电流 ' + primary.avgI + 'A，时长 ' + primary.spanSec + 's'
    });
    if (ratedAh) {
      evidence.push({
        tag: 'neutral',
        text: '推算容量 ' + primary.estimatedCapacityAh + 'Ah ÷ 额定 ' + round1(ratedAh) + 'Ah ≈ SOH ' + primary.sohPct + '%'
      });
    }
  }
  if (estimates.length > 1 && sohMedian != null) {
    evidence.push({
      tag: 'neutral',
      text: '共 ' + estimates.length + ' 个有效窗口，SOH 中位数 ' + round1(sohMedian) + '%'
    });
  }
  if (series.meta.ratedCapacityAh && opts.manualRatedAh) {
    evidence.push({ tag: 'neutral', text: '已用手动额定容量 ' + round1(ratedAh) + 'Ah（覆盖 BRM）' });
  } else if (series.meta.ratedCapacityAh) {
    evidence.push({ tag: 'neutral', text: 'BRM 额定容量 ' + round1(series.meta.ratedCapacityAh) + 'Ah' });
  }

  return {
    status: status,
    label: grade.label,
    color: grade.color,
    summary: status === 'ok' ? grade.summary : (issues[0] || grade.summary),
    disclaimer: '辅助估算，非官方 SOH；受隐藏 SOC、充电策略与采样精度影响。',
    sohPct: sohMedian,
    estimatedCapacityAh: capMedian,
    ratedCapacityAh: ratedAh || null,
    confidence: confidence,
    primary: primary,
    estimates: estimates.slice(0, 5),
    windows: windows.slice(0, 5),
    numbers: {
      bcsCount: series.bcs.length,
      ccsCount: series.ccs.length,
      ratedCapacityAh: ratedAh || series.meta.ratedCapacityAh || null,
      estimatedCapacityAh: capMedian,
      sohPct: sohMedian,
      socStart: primary ? primary.soc0 : (series.bcs[0] ? round1(series.bcs[0].soc) : null),
      socEnd: primary ? primary.soc1 : (series.bcs.length ? round1(series.bcs[series.bcs.length - 1].soc) : null),
      ahCharged: primary ? primary.ah : null,
      spanSec: primary ? primary.spanSec : (parsed.totalMs ? Math.round(parsed.totalMs / 1000) : null),
      batteryType: series.meta.batteryType || chem.label || null,
      vin: series.meta.vin || null
    },
    issues: issues,
    evidence: evidence,
    advice: advice,
    hiddenSoc: hidden && hidden.detected ? hidden.primary : null
  };
}

function tsFromMs(ms) {
  var sec = Math.floor(ms / 1000);
  var msec = ms % 1000;
  var s = sec % 60;
  var m = Math.floor(sec / 60) % 60;
  var h = Math.floor(sec / 3600);
  return (h < 10 ? '0' : '') + h + ':' +
    (m < 10 ? '0' : '') + m + ':' +
    (s < 10 ? '0' : '') + s + '.' +
    ('00' + msec).slice(-3);
}

function appendBcsTp(lines, ms, voltage, currentA, soc, cellV) {
  var vHex = chargeSpeed.encVoltage(voltage);
  var iHex = chargeSpeed.encCurrent(-Math.abs(currentA));
  var cellRaw = Math.round((cellV || 3.35) * 100);
  var cLo = ('0' + (cellRaw & 0xff).toString(16)).slice(-2).toUpperCase();
  var cHi = ('0' + ((cellRaw >> 8) & 0x0f).toString(16)).slice(-2).toUpperCase();
  var socByte = ('0' + Math.max(0, Math.min(100, Math.round(soc))).toString(16)).slice(-2).toUpperCase();
  var t = tsFromMs(ms);
  lines.push(t + ' 1CEC56F4 10 09 00 02 FF 00 11 00');
  lines.push(t + ' 1CEB56F4 01 ' + vHex + ' ' + iHex + ' ' + cLo + ' ' + cHi + ' ' + socByte);
  lines.push(t + ' 1CEB56F4 02 1E 00 00 00 00 00 00');
}

function appendBrmBam(lines, ms, ratedAh, batteryTypeCode) {
  var capRaw = Math.round(ratedAh * 10);
  var payload = [
    0x01,
    batteryTypeCode || 0x06,
    capRaw & 0xff,
    (capRaw >> 8) & 0xff,
    0x88, 0x13, 0x00, 0x00
  ];
  while (payload.length < 49) payload.push(0x00);
  var packets = Math.ceil(payload.length / 7);
  var t = tsFromMs(ms);
  lines.push(t + ' 1CEC56F4 20 ' +
    ('0' + (payload.length & 0xff).toString(16)).slice(-2) + ' ' +
    ('0' + ((payload.length >> 8) & 0xff).toString(16)).slice(-2) + ' ' +
    ('0' + packets.toString(16)).slice(-2) + ' FF 00 02 00');
  for (var p = 0; p < packets; p++) {
    var chunk = payload.slice(p * 7, p * 7 + 7);
    var hex = [('0' + (p + 1).toString(16)).slice(-2).toUpperCase()];
    for (var i = 0; i < chunk.length; i++) {
      hex.push(('0' + chunk[i].toString(16)).slice(-2).toUpperCase());
    }
    while (hex.length < 8) hex.push('00');
    lines.push(t + ' 1CEB56F4 ' + hex.join(' '));
  }
}

function buildDemoSohLog(opts) {
  opts = opts || {};
  var ratedAh = opts.ratedAh != null ? opts.ratedAh : 100;
  var sohTarget = opts.sohPct != null ? opts.sohPct : 92;
  var soc0 = opts.socStart != null ? opts.socStart : 28;
  var soc1 = opts.socEnd != null ? opts.socEnd : 50;
  var currentA = opts.currentA != null ? opts.currentA : 55;
  var voltage = opts.voltage != null ? opts.voltage : 720;

  var actualCap = ratedAh * sohTarget / 100;
  var dSoc = soc1 - soc0;
  var ah = actualCap * dSoc / 100;
  var durationSec = Math.max(150, Math.round(ah / currentA * 3600));
  var lines = chargeSpeed.buildChargeLoop({
    voltage: voltage,
    cmlA: 160,
    reqA: currentA,
    outA: currentA,
    soc: soc0,
    head: []
  }).split('\n').slice(0, 6);

  appendBrmBam(lines, 200, ratedAh, 0x06);

  var startMs = 1500;
  var endMs = startMs + durationSec * 1000;
  var bcsStep = 5000;
  for (var ms = startMs; ms <= endMs; ms += bcsStep) {
    var ratio = (ms - startMs) / (endMs - startMs);
    var soc = soc0 + dSoc * ratio;
    var cellV = 3.55 + ratio * 0.12;
    appendBcsTp(lines, ms, voltage, currentA, soc, cellV);
  }

  var ccsStart = 1200;
  for (var t = ccsStart; t <= endMs; t += 250) {
    var ts = tsFromMs(t);
    var vHex = chargeSpeed.encVoltage(voltage);
    var iHex = chargeSpeed.encCurrent(-currentA);
    lines.push(ts + ' 1812F456 ' + vHex + ' ' + iHex + ' 00 00 01');
  }

  return lines.join('\n');
}

var DEMO_SCENARIOS = [
  {
    id: 'healthy_95',
    title: '示例：健康 ~95%',
    desc: '100Ah 额定，SOC 30→52% 恒流充电，SOH≈95%',
    log: buildDemoSohLog({ ratedAh: 100, sohPct: 95, socStart: 30, socEnd: 52, currentA: 60 })
  },
  {
    id: 'fair_88',
    title: '示例：良好 ~88%',
    desc: '100Ah 额定，SOC 25→48% 充电，SOH≈88%',
    log: buildDemoSohLog({ ratedAh: 100, sohPct: 88, socStart: 25, socEnd: 48, currentA: 50 })
  },
  {
    id: 'low_72',
    title: '示例：衰减 ~72%',
    desc: '100Ah 额定，SOC 35→55% 充电，SOH≈72%',
    log: buildDemoSohLog({ ratedAh: 100, sohPct: 72, socStart: 35, socEnd: 55, currentA: 45 })
  }
];

var TEST_GUIDE = {
  intro: '通过一次直流充电日志，用安时积分与表显 SOC 变化估算高压电池容量健康度（SOH）。无需拆包，但结果仅供辅助参考。',
  formula: '推算容量 Ah = 充入电量 ÷（SOC 变化% ÷ 100）；SOH % = 推算容量 ÷ 额定容量 × 100',
  steps: [
    {
      title: '准备采集',
      text: 'PanchongCAN 接好枪线，从插枪握手开始采集，确保日志含 BRM（额定容量）、BCS（SOC）、CCS（输出电流）。'
    },
    {
      title: '选择充电区间',
      text: '建议电量约 20%–30% 插枪，充至 75%–85% 即可，不必刻意跑干或充满。优先公共快充恒流段。'
    },
    {
      title: '完成充电或中途停止',
      text: '单次日志中 SOC 变化建议 ≥20%，连续充电 ≥10 分钟。充满也可以，但算法会优先选用中间恒流段，不会只用 95%→100% 尾段。'
    },
    {
      title: '导入日志并分析',
      text: '在下方粘贴日志，或点「用最近采集」。若无 BRM 额定 Ah，请填写铭牌/手册容量后点「开始测试」。'
    },
    {
      title: '查看结果',
      text: '关注 SOH、置信度与「注意」项。磷酸铁锂或出现隐藏电量提示时，建议同条件复测 2–3 次取接近值。'
    }
  ],
  requirements: [
    'BCS：表显 SOC（必需）',
    'CCS：桩输出电流，用于安时积分（强烈推荐；无则用 BCS 电流，精度下降）',
    'BRM：整车额定容量 Ah（无则手动填写）',
    '有效段：连续充电 ≥2 分钟且 SOC 变化 ≥8%（建议 ≥20%）'
  ],
  goodPractice: [
    '插枪 SOC 约 20%–30%，充到 75%–85% 的恒流段最稳',
    '避开极低 SOC（底部保留）与满电涓流（顶部隐藏、降流）',
    '日志从握手/辨识开始，便于读取 BRM',
    '同一台车、相近温度与桩功率下复测，结果更可信'
  ],
  chemistry: [
    {
      type: '磷酸铁锂（LFP）',
      note: '测法相同，但平台区表显 SOC 易偏差，隐藏电量更常见。重点看 25%→70% 中段；置信度偏低或出现隐藏电量提示时请谨慎解读。'
    },
    {
      type: '三元锂',
      note: '中段恒流相对更稳，可用约 20%→80% 窗口。高 SOC 降流段（>85%）不宜单独用于判断。'
    }
  ],
  misbeliefs: [
    '「从 0% 充满最准」— 低端/高端常有隐藏电量与涓流，整段反而易偏',
    '「看 100% 附近就行」— 尾段 ΔSOC 小、电流低，SOH 容易算高或算不出',
    '「等于官方 SOH」— 本工具基于 27930 枪线估算，若车端 BMS 有 SOH，以车端为准'
  ],
  disclaimer: [
    '本功能为基于 GB/T 27930 充电报文的容量健康度辅助估算，不构成官方检测报告、质保判定或定责依据。',
    '结果受表显 SOC 标定、隐藏电量、充电策略、温度、采样完整性及 BRM 额定值准确性影响，可能与车机/诊断仪 SOH 不一致。',
    '禁止仅凭单次估算结果做出退换车、索赔、维修定责等决定；重要事项请结合品牌售后、专业设备或完整充放电测试。',
    '使用本功能即表示您已理解上述局限，并自行承担因误读估算结果而产生的风险。'
  ]
};

function getTestGuide() {
  return TEST_GUIDE;
}

module.exports = {
  analyzeBatterySoh: analyzeBatterySoh,
  buildDemoSohLog: buildDemoSohLog,
  getTestGuide: getTestGuide,
  TEST_GUIDE: TEST_GUIDE,
  DEMO_SCENARIOS: DEMO_SCENARIOS
};
