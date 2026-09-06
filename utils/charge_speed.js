/**
 * 充电慢：车端限流 vs 桩端限流（基于 BCL / CML / CCS）
 * 辅助倾向，非责任认定。需要 27930 枪线日志。
 */

var gbt = require('./gbt27930.js');
var lfpRules = require('./lfp_battery_rules.js');
var hiddenSocUtil = require('./hidden_soc.js');
var batteryChem = require('./battery_chemistry.js');

function absI(v) {
  if (v == null || !isFinite(v)) return null;
  return Math.abs(v);
}

function mean(arr) {
  if (!arr.length) return null;
  var s = 0;
  for (var i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function median(arr) {
  if (!arr.length) return null;
  var a = arr.slice().sort(function (x, y) { return x - y; });
  var m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function encCurrent(physicalA) {
  var raw = Math.round((physicalA + 400) / 0.1);
  if (raw < 0) raw = 0;
  if (raw > 0xffff) raw = 0xffff;
  return ('0' + (raw & 0xff).toString(16)).slice(-2).toUpperCase() + ' ' +
    ('0' + ((raw >> 8) & 0xff).toString(16)).slice(-2).toUpperCase();
}

function encVoltage(v) {
  var raw = Math.round(v * 10);
  return ('0' + (raw & 0xff).toString(16)).slice(-2).toUpperCase() + ' ' +
    ('0' + ((raw >> 8) & 0xff).toString(16)).slice(-2).toUpperCase();
}

var TERNARY_BATTERY_CODES = { 0x06: true };
var CELL_FULL_V = 4.2;
var CELL_SOC_LOW = 60;
var CELL_SOC_HIGH = 65;

function detectCellAlert(frames) {
  var chem = batteryChem.resolveChemistry(frames);
  if (batteryChem.isLfpChemistry(chem)) {
    var lfp = lfpRules.detectLfpCellAlert(frames);
    if (lfp) return lfp;
  }
  if (batteryChem.isTernaryChemistry(chem)) {
    return detectTernaryCellAlert(frames, chem);
  }
  return null;
}

function detectTernaryCellAlert(frames, chem) {
  chem = chem || batteryChem.resolveChemistry(frames);
  if (!batteryChem.isTernaryChemistry(chem)) return null;

  var batteryType = chem.label || '三元材料电池';
  var hits = [];

  (frames || []).forEach(function (f) {
    var m = f.metrics || {};
    if (f.code !== 'BCS') return;
    var soc = m.soc != null ? Number(m.soc) : null;
    var cellV = m.maxCellVoltage != null ? Number(m.maxCellVoltage) : null;
    if (soc == null || cellV == null || !isFinite(soc) || !isFinite(cellV)) return;
    if (soc >= CELL_SOC_LOW && soc <= CELL_SOC_HIGH && cellV >= CELL_FULL_V - 0.01) {
      hits.push({ soc: soc, cellV: cellV, group: m.maxCellGroup });
    }
  });

  if (!hits.length) return null;
  var best = hits[hits.length - 1];
  return {
    key: 'hv_battery_check',
    label: '建议检查高压电池',
    batteryType: batteryType,
    chemistry: 'ternary',
    chemistrySource: chem.source,
    chemistryConfidence: chem.confidence,
    soc: round1(best.soc),
    maxCellV: round1(best.cellV),
    hitCount: hits.length,
    evidenceText: '三元锂 · SOC ' + round1(best.soc) + '% 时最高单体已达 ' + round1(best.cellV) + 'V（≥' + CELL_FULL_V + 'V）',
    adviceText: 'SOC 仅 ' + CELL_SOC_LOW + '–' + CELL_SOC_HIGH + '% 但单体已到 ' + CELL_FULL_V + 'V，一致性偏差大，建议检查高压电池（压差/模组/采样）。',
    summary: '三元锂电池在 SOC ' + round1(best.soc) + '% 时单体已达 ' + round1(best.cellV) + 'V，建议检查高压电池。'
  };
}

function mergeCellAlert(result, alert) {
  if (!alert || !result) return result;
  result.cellAlert = alert;
  result.evidence = result.evidence || [];
  result.advice = result.advice || [];
  result.evidence.push({ tag: 'vehicle', text: alert.evidenceText });
  result.advice.unshift(alert.adviceText);
  if (result.key === 'insufficient') {
    result.label = alert.label;
    result.color = '#E67E22';
    result.lean = 'vehicle';
    result.summary = alert.summary;
  } else {
    result.summary = alert.summary + '；' + result.summary;
  }
  if (result.numbers) {
    result.numbers.batteryType = alert.batteryType;
    result.numbers.maxCellV = alert.maxCellV;
    result.numbers.cellAlertSoc = alert.soc;
  }
  return result;
}

function mergeExtras(result, cellAlert, hiddenSoc) {
  result = mergeCellAlert(result, cellAlert);
  if (!result || !hiddenSoc || !hiddenSoc.detected) return result;
  result.hiddenSoc = hiddenSoc;
  result.evidence = result.evidence || [];
  result.advice = result.advice || [];
  hiddenSoc.hints.forEach(function (h) {
    result.evidence.push({ tag: 'vehicle', text: '[隐藏电量] ' + h.evidenceText });
  });
  if (hiddenSoc.primary) {
    result.advice.push(hiddenSoc.primary.adviceText);
  }
  if (result.numbers && hiddenSoc.primary && hiddenSoc.primary.gapPct != null) {
    result.numbers.hiddenSocGap = hiddenSoc.primary.gapPct;
  }
  return result;
}

function finalizeSpeedResult(result, frames, cellAlert, hiddenSoc, chargeCtx) {
  result = mergeExtras(result, cellAlert, hiddenSoc);
  var hvImpedance = require('./hv_impedance.js');
  var batteryImbalance = require('./battery_imbalance.js');
  var imp = hvImpedance.detectChargeImpedance(frames, chargeCtx);
  if (imp) result = hvImpedance.mergeImpedanceHint(result, imp);
  var imb = batteryImbalance.detectCellImbalance(frames);
  if (imb) result = batteryImbalance.mergeImbalanceHint(result, imb);
  return result;
}

/**
 * @param {string} logText
 * @returns {object}
 */
function analyzeChargeSpeed(logText) {
  var parsed = gbt.decodeLogText(logText || '');
  var frames = parsed.frames || [];

  var reqSamples = [];
  var outSamples = [];
  var allowSamples = [];
  var socSamples = [];
  var pileMaxI = null;
  var pileMaxV = null;
  var vehMaxI = null;
  var lastReq = null;
  var lastOut = null;
  var bclCount = 0;
  var ccsCount = 0;
  var batteryType = '';
  var batteryTypeCode = null;

  frames.forEach(function (f) {
    var m = f.metrics || {};
    if (f.code === 'BRM') {
      if (m.batteryType) batteryType = m.batteryType;
      if (m.batteryTypeCode != null) batteryTypeCode = m.batteryTypeCode;
    }
    if (f.code === 'CML') {
      if (m.pileMaxCurrent != null) pileMaxI = absI(m.pileMaxCurrent);
      if (m.pileMaxVoltage != null) pileMaxV = m.pileMaxVoltage;
    }
    if (f.code === 'BCP' && m.maxChargeCurrent != null) {
      vehMaxI = absI(m.maxChargeCurrent);
    }
    // BCP may store as different key — check fields path via metrics if present
    if (f.code === 'BCL' && m.reqCurrent != null) {
      bclCount += 1;
      lastReq = absI(m.reqCurrent);
      reqSamples.push(lastReq);
    }
    if (f.code === 'CCS' && m.outCurrent != null) {
      ccsCount += 1;
      lastOut = absI(m.outCurrent);
      outSamples.push(lastOut);
      if (m.chargeAllow != null) allowSamples.push(m.chargeAllow);
      else if (f.data && f.data.length >= 7) allowSamples.push((f.data[6] & 0x01) ? 1 : 0);
    }
    if (m.soc != null) socSamples.push(Number(m.soc));
  });

  // BCP max current: gbt may put in metrics differently — scan fields
  frames.forEach(function (f) {
    if (f.code !== 'BCP' || !f.fields) return;
    f.fields.forEach(function (fd) {
      if (fd.name && fd.name.indexOf('最高允许充电电流') >= 0 && fd.value != null) {
        var n = parseFloat(fd.value);
        if (isFinite(n)) vehMaxI = absI(n);
      }
    });
  });

  var avgReq = mean(reqSamples);
  var avgOut = mean(outSamples);
  var medReq = median(reqSamples);
  var medOut = median(outSamples);
  var soc = socSamples.length ? socSamples[socSamples.length - 1] : null;
  var chemResolved = batteryChem.resolveChemistry(frames);
  if (!batteryType && chemResolved.label) {
    batteryType = chemResolved.label;
  }

  var numbers = {
    bclCount: bclCount,
    ccsCount: ccsCount,
    avgReqA: avgReq != null ? round1(avgReq) : null,
    avgOutA: avgOut != null ? round1(avgOut) : null,
    medReqA: medReq != null ? round1(medReq) : null,
    medOutA: medOut != null ? round1(medOut) : null,
    lastReqA: lastReq != null ? round1(lastReq) : null,
    lastOutA: lastOut != null ? round1(lastOut) : null,
    pileMaxA: pileMaxI != null ? round1(pileMaxI) : null,
    pileMaxV: pileMaxV != null ? round1(pileMaxV) : null,
    vehicleMaxA: vehMaxI != null ? round1(vehMaxI) : null,
    soc: soc != null ? round1(soc) : null,
    gapA: (avgReq != null && avgOut != null) ? round1(avgReq - avgOut) : null,
    batteryType: batteryType || null,
    batteryChemistry: chemResolved.chemistry !== 'unknown' ? chemResolved.chemistry : null,
    batteryChemistrySource: chemResolved.source !== 'none' ? chemResolved.source : null,
    maxCellV: null,
    cellAlertSoc: null
  };

  var cellAlert = detectCellAlert(frames);
  var hiddenSoc = hiddenSocUtil.detectHiddenSocHints(frames);

  var evidence = [];
  var advice = [];

  if (bclCount < 2 || ccsCount < 2) {
    return finalizeSpeedResult({
      key: 'insufficient',
      label: '证据不足',
      color: '#8A8A8A',
      lean: 'unknown',
      summary: '未见稳定的 BCL/CCS 充电循环，无法判断「慢」在车还是桩。请确认采的是枪线 S+/S-，且已进入充电。',
      numbers: numbers,
      evidence: [{ tag: 'neutral', text: 'BCL×' + bclCount + ' / CCS×' + ccsCount }],
      advice: ['先采集进入充电后的 27930 日志（至少数秒 BCL+CCS）', '仅 OBD 6/14 无法完成本项对比'],
      frameCount: frames.length
    }, frames, cellAlert, hiddenSoc, { soc: soc, avgReq: avgReq, avgOut: avgOut, pileMaxI: pileMaxI, gap: null, vsCmlReq: null });
  }

  if (avgReq != null) evidence.push({ tag: 'vehicle', text: '车需求电流 |BCL| 均值 ≈ ' + round1(avgReq) + ' A（' + bclCount + ' 帧）' });
  if (avgOut != null) evidence.push({ tag: 'pile', text: '桩实出电流 |CCS| 均值 ≈ ' + round1(avgOut) + ' A（' + ccsCount + ' 帧）' });
  if (pileMaxI != null) evidence.push({ tag: 'pile', text: '桩最大能力 |CML| ≈ ' + round1(pileMaxI) + ' A' });
  if (vehMaxI != null) evidence.push({ tag: 'vehicle', text: '车最高允许电流 |BCP| ≈ ' + round1(vehMaxI) + ' A' });
  if (soc != null) evidence.push({ tag: 'neutral', text: 'SOC ≈ ' + round1(soc) + ' %' });

  var gap = avgReq - avgOut;
  var gapRatio = avgReq > 1 ? gap / avgReq : 0;
  var vsCmlReq = pileMaxI != null && pileMaxI > 1 ? avgReq / pileMaxI : null;
  var vsCmlOut = pileMaxI != null && pileMaxI > 1 ? avgOut / pileMaxI : null;
  var chargeCtx = {
    soc: soc,
    avgReq: avgReq,
    avgOut: avgOut,
    pileMaxI: pileMaxI,
    gap: avgReq != null && avgOut != null ? avgReq - avgOut : null,
    vsCmlReq: vsCmlReq
  };

  // 接近满电正常降流
  if (soc != null && soc >= 80 && avgReq != null && (pileMaxI == null || avgReq < pileMaxI * 0.55)) {
    advice.push('SOC 已较高，降流多为车端正常策略，不一定是故障');
    return finalizeSpeedResult(pack('taper', '倾向正常降流（车端策略）', '#2F6BFF', 'vehicle',
      'SOC 较高且车需求电流偏低，更像接近满电的正常限流，不宜直接判桩慢。',
      numbers, evidence, advice.concat(['若在低 SOC 仍同样慢，再采一段对比'])), frames, cellAlert, hiddenSoc, chargeCtx);
  }

  // 车要得少
  if (vsCmlReq != null && vsCmlReq < 0.45 && gap < 15) {
    advice.push('车只要这么多，换更大功率桩通常也快不了多少');
    advice.push('可查：电池温度、故障降额、VCU 功率限制、SOC 策略');
    return finalizeSpeedResult(pack('vehicle_limit', '倾向车端限流', '#2F6BFF', 'vehicle',
      '车端 BCL 需求明显低于桩能力，且桩基本跟得上需求 → 慢主要在车。',
      numbers, evidence, advice), frames, cellAlert, hiddenSoc, chargeCtx);
  }

  if (pileMaxI == null && avgReq != null && avgReq < 40 && gap < 10) {
    advice.push('未见 CML：仍按「需求低且实出接近需求」偏车');
    return finalizeSpeedResult(pack('vehicle_limit', '倾向车端限流', '#2F6BFF', 'vehicle',
      '车需求电流偏低，桩实出接近需求 → 更像车在限流（缺 CML 时置信略低）。',
      numbers, evidence, advice), frames, cellAlert, hiddenSoc, chargeCtx);
  }

  // 桩能力就低：车要满能力、实出≈能力
  if (vsCmlReq != null && vsCmlReq >= 0.85 && vsCmlOut != null && vsCmlOut >= 0.8 && gap < Math.max(12, avgReq * 0.12)) {
    advice.push('车已按桩上限在要电，瓶颈在桩最大输出能力（或站级限功率）');
    advice.push('可换更大功率桩对比验证');
    return finalizeSpeedResult(pack('pile_cap', '倾向桩端能力不足', '#07C160', 'pile',
      '车需求已贴近桩 CML 上限，实出也接近上限 → 慢主要受桩能力限制。',
      numbers, evidence, advice), frames, cellAlert, hiddenSoc, chargeCtx);
  }

  // 车要得多，桩给不出
  if (gap >= 20 || gapRatio >= 0.25) {
    if (vsCmlReq != null && vsCmlReq >= 0.55) {
      advice.push('车需求明显高于实出，优先查桩输出、多枪分流、急停/降额');
      advice.push('换已知正常桩对比：若变快 → 印证偏桩');
      return finalizeSpeedResult(pack('pile_under', '倾向桩端未跟需求', '#07C160', 'pile',
        '车 BCL 需求高，但 CCS 实出明显偏低 → 慢更像桩没有按需求给够。',
        numbers, evidence, advice), frames, cellAlert, hiddenSoc, chargeCtx);
    }
    // 需求也不高但实出更低
    advice.push('实出低于需求，仍偏桩侧跟不上；同时关注车需求是否也被限');
    return finalizeSpeedResult(pack('pile_under', '倾向桩端未跟需求', '#07C160', 'pile',
      'CCS 实出持续低于 BCL 需求 → 优先怀疑桩端限流或异常降额。',
      numbers, evidence, advice), frames, cellAlert, hiddenSoc, chargeCtx);
  }

  // 两边接近
  if (Math.abs(gap) < 15) {
    if (vsCmlReq != null && vsCmlReq < 0.6) {
      advice.push('实出≈需求且需求相对桩能力不高 → 仍偏车端设定/策略');
      return finalizeSpeedResult(pack('vehicle_limit', '倾向车端限流', '#2F6BFF', 'vehicle',
        '桩基本满足车的需求，但需求本身不高 → 慢主要在车端要电少。',
        numbers, evidence, advice), frames, cellAlert, hiddenSoc, chargeCtx);
    }
    advice.push('需求与实出接近；若体感仍慢，用换桩对比或看站功率分享');
    return finalizeSpeedResult(pack('aligned', '车桩基本对齐（未明显偏一边）', '#8A8A8A', 'mixed',
      'BCL 与 CCS 接近，没有明显「车要得多桩给不出」或「车只要一点」。体感慢需结合桩额定功率与换桩对比。',
      numbers, evidence, advice), frames, cellAlert, hiddenSoc, chargeCtx);
  }

  advice.push('建议补充更长充电段日志，并做换桩对比');
  return finalizeSpeedResult(pack('mixed', '暂不宜单边定论', '#8A8A8A', 'mixed',
    '需求与实出有差距但特征不够典型。建议换桩对比后再判。',
    numbers, evidence, advice), frames, cellAlert, hiddenSoc, chargeCtx);
}

function pack(key, label, color, lean, summary, numbers, evidence, advice) {
  return {
    key: key,
    label: label,
    color: color,
    lean: lean,
    summary: summary,
    numbers: numbers,
    evidence: evidence || [],
    advice: advice || [],
    disclaimer: '辅助倾向，非责任认定'
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function buildChargeLoop(opts) {
  opts = opts || {};
  var v = opts.voltage != null ? opts.voltage : 750;
  var req = opts.reqA != null ? opts.reqA : 100; // display positive, encode negative
  var out = opts.outA != null ? opts.outA : req;
  var cml = opts.cmlA != null ? opts.cmlA : 160;
  var soc = opts.soc != null ? opts.soc : 40;
  var lines = opts.head || [];
  var vHex = encVoltage(v);
  var cmlI = encCurrent(-cml);
  var cmlMin = encCurrent(-10);
  var cmlVmax = encVoltage(Math.max(v + 50, 800));
  var cmlVmin = encVoltage(200);

  lines = lines.concat([
    '00:00:00.000 1826F456 01 01 00',
    '00:00:00.050 182756F4 3C 0A',
    '00:00:00.300 1801F456 AA 01 02 03 31 32 33 34',
    '00:00:00.600 1808F456 ' + cmlVmax + ' ' + cmlVmin + ' ' + cmlI + ' ' + cmlMin,
    '00:00:01.000 100956F4 AA',
    '00:00:01.050 100AF456 AA'
  ]);

  var t = 1200;
  for (var i = 0; i < 8; i++) {
    var r = encCurrent(-req);
    var o = encCurrent(-out);
    var sec = Math.floor(t / 1000);
    var ms = t % 1000;
    var ts = '00:00:' + (sec < 10 ? '0' : '') + sec + '.' + ('00' + ms).slice(-3);
    lines.push(ts + ' 181056F4 ' + vHex + ' ' + r + ' 02');
    t += 50;
    sec = Math.floor(t / 1000);
    ms = t % 1000;
    ts = '00:00:' + (sec < 10 ? '0' : '') + sec + '.' + ('00' + ms).slice(-3);
    lines.push(ts + ' 1812F456 ' + vHex + ' ' + o + ' 00 00 01');
    t += 200;
  }

  // one BCS with SOC (9B TP) — simplified single-shot optional skip; put SOC in note via BSM-less
  // Use a compact BCS TP for soc display
  var socByte = Math.max(0, Math.min(100, Math.round(soc)));
  lines.push('00:00:03.500 1CEC56F4 10 09 00 02 FF 00 11 00');
  lines.push('00:00:03.520 1CEB56F4 01 ' + vHex + ' ' + encCurrent(-out) + ' 10 0A ' +
    ('0' + socByte.toString(16)).slice(-2).toUpperCase());
  lines.push('00:00:03.540 1CEB56F4 02 1E 00 00 00 00 00 00');

  return lines.join('\n');
}

function buildImpedanceDemoLog() {
  var lines = buildChargeLoop({
    cmlA: 160,
    reqA: 32,
    outA: 31,
    soc: 48,
    voltage: 740
  }).split('\n');
  var vHex = encVoltage(740);
  var iHex = encCurrent(-32);
  lines.push('00:00:00.220 1CEC56F4 20 31 00 07 FF 00 02 00');
  lines.push('00:00:00.220 1CEB56F4 01 01 06 E8 03 88 13');
  lines.push('00:00:00.220 1CEB56F4 02 00 00 00 00 00 00');
  lines.push('00:00:00.220 1CEB56F4 03 00 00 00 00 00 00');
  lines.push('00:00:00.220 1CEB56F4 04 00 00 00 00 00 00');
  lines.push('00:00:00.220 1CEB56F4 05 00 00 00 00 00 00');
  lines.push('00:00:00.220 1CEB56F4 06 00 00 00 00 00 00');
  lines.push('00:00:00.220 1CEB56F4 07 00 00 00 00 00 00');
  lines.push('00:00:04.000 1CEC56F4 10 09 00 02 FF 00 11 00');
  lines.push('00:00:04.020 1CEB56F4 01 ' + vHex + ' ' + iHex + ' A3 01 30');
  lines.push('00:00:04.040 1CEB56F4 02 1E 00 00 00 00 00 00');
  lines.push('00:00:04.060 188356F4 01 55 01 53 01 00 30');
  return lines.join('\n');
}

var DEMO_SCENARIOS = [
  {
    id: 'vehicle_limit',
    title: '示例：车端限流',
    desc: '桩能 160A，车只要 35A，实出≈35A',
    log: buildChargeLoop({ cmlA: 160, reqA: 35, outA: 34, soc: 55 })
  },
  {
    id: 'pile_cap',
    title: '示例：桩能力不足',
    desc: '桩最大 40A，车要满 40A，实出≈39A',
    log: buildChargeLoop({ cmlA: 40, reqA: 40, outA: 39, soc: 40 })
  },
  {
    id: 'pile_under',
    title: '示例：桩未跟需求',
    desc: '桩称 160A，车要 120A，实出只有 45A',
    log: buildChargeLoop({ cmlA: 160, reqA: 120, outA: 45, soc: 35 })
  },
  {
    id: 'taper',
    title: '示例：满电降流',
    desc: 'SOC 88%，车需求降到 25A，实出跟随',
    log: buildChargeLoop({ cmlA: 160, reqA: 25, outA: 24, soc: 88 })
  },
  {
    id: 'hv_impedance',
    title: '示例：疑高阻抗限流',
    desc: '三元 · SOC 48% · 单体 4.19V · 车只要 32A',
    log: buildImpedanceDemoLog()
  }
];

module.exports = {
  analyzeChargeSpeed: analyzeChargeSpeed,
  detectTernaryCellAlert: detectTernaryCellAlert,
  detectCellAlert: detectCellAlert,
  detectLfpCellAlert: lfpRules.detectLfpCellAlert,
  DEMO_SCENARIOS: DEMO_SCENARIOS,
  buildChargeLoop: buildChargeLoop,
  buildImpedanceDemoLog: buildImpedanceDemoLog,
  encCurrent: encCurrent,
  encVoltage: encVoltage
};
