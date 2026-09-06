/**
 * 电芯鉴康 — 高压电池健康一站式分析
 * 整合：SOH 容量 · 高阻抗限流 · 单体不平衡 · 高压告警 · 隐藏电量
 */

var gbt = require('./gbt27930.js');
var batterySoh = require('./battery_soh.js');
var chargeSpeed = require('./charge_speed.js');
var batteryImbalance = require('./battery_imbalance.js');
var batteryChem = require('./battery_chemistry.js');
var hiddenSoc = require('./hidden_soc.js');

var TOOL_NAME = '电芯鉴康';
var TOOL_TAGLINE = '容量 · 阻抗 · 平衡，一项看清';

function round1(n) {
  return Math.round(n * 10) / 10;
}

function pickPrimary(findings) {
  var order = {
    hv_impedance_charge: 1,
    hv_cell_imbalance: 2,
    hv_battery_check: 3,
    soh_low: 4,
    soh_ok: 5,
    hidden_soc: 6,
    charge_slow: 7,
    none: 9
  };
  if (!findings.length) {
    return {
      key: 'none',
      title: '未见明显异常',
      label: '未见明显异常',
      color: '#07C160',
      text: '当前日志未发现突出的电池健康风险线索；建议保留完整充电段复测。',
      summary: '当前日志未发现突出的电池健康风险线索；建议保留完整充电段复测。'
    };
  }
  findings.sort(function (a, b) {
    return (order[a.key] || 8) - (order[b.key] || 8);
  });
  return findings[0];
}

function pushFinding(list, item) {
  if (item) list.push(item);
}

/**
 * @param {string} logText
 * @param {{ manualRatedAh?: number }} opts
 */
function analyzeBatteryHealth(logText, opts) {
  opts = opts || {};
  var parsed = gbt.decodeLogText(logText || '');
  var frames = parsed.frames || [];
  var chem = batteryChem.resolveChemistry(frames);
  var soh = batterySoh.analyzeBatterySoh(logText, opts);
  var speed = chargeSpeed.analyzeChargeSpeed(logText);
  var imbalance = batteryImbalance.detectCellImbalance(frames);
  var cellAlert = chargeSpeed.detectCellAlert(frames);
  var hidden = hiddenSoc.detectHiddenSocHints(frames);

  var findings = [];
  var evidence = [];
  var advice = [
    '本工具为 27930 枪线辅助体检，非官方诊断；重要事项请走品牌售后与专业设备。'
  ];

  if (speed.impedanceHint) {
    var imp = speed.impedanceHint;
    pushFinding(findings, {
      key: imp.key,
      icon: '阻',
      title: imp.label,
      confidence: imp.confidence,
      color: '#E67E22',
      text: imp.summary,
      detail: imp.evidenceText
    });
    evidence.push({ tag: 'vehicle', text: imp.evidenceText });
    advice.unshift(imp.adviceText);
  }

  if (imbalance) {
    pushFinding(findings, {
      key: imbalance.key,
      icon: '衡',
      title: imbalance.label,
      confidence: imbalance.confidence,
      color: '#C0392B',
      text: imbalance.summary,
      detail: imbalance.evidenceText
    });
    evidence.push({ tag: 'vehicle', text: imbalance.evidenceText });
    advice.unshift(imbalance.adviceText);
  }

  if (cellAlert) {
    pushFinding(findings, {
      key: 'hv_battery_check',
      icon: '压',
      title: cellAlert.label || '建议检查高压电池',
      confidence: cellAlert.chemistryConfidence || '中',
      color: '#E74C3C',
      text: cellAlert.summary,
      detail: cellAlert.evidenceText
    });
    evidence.push({ tag: 'vehicle', text: cellAlert.evidenceText });
    advice.unshift(cellAlert.adviceText);
  }

  if (soh.status === 'ok' && soh.sohPct != null) {
    var sohColor = soh.sohPct >= 85 ? '#2F6BFF' : (soh.sohPct >= 70 ? '#E67E22' : '#E74C3C');
    pushFinding(findings, {
      key: soh.sohPct >= 70 ? 'soh_ok' : 'soh_low',
      icon: '容',
      title: '容量健康 SOH ' + round1(soh.sohPct) + '%',
      confidence: soh.confidence ? soh.confidence.label : '—',
      color: sohColor,
      text: soh.summary,
      detail: soh.primary ? ('推算 ' + soh.primary.estimatedCapacityAh + 'Ah / 额定 ' + soh.ratedCapacityAh + 'Ah') : ''
    });
    soh.evidence.forEach(function (e) { evidence.push({ tag: 'neutral', text: e.text }); });
    soh.advice.forEach(function (a) { advice.push(a); });
  } else if (soh.status !== 'ok' && soh.issues.length) {
    pushFinding(findings, {
      key: 'soh_pending',
      icon: '容',
      title: '容量 SOH 待补数据',
      confidence: '—',
      color: '#8A8A8A',
      text: soh.issues[0],
      detail: '填写额定 Ah 或采集更长充电段后可估算 SOH'
    });
  }

  if (hidden && hidden.detected && hidden.primary) {
    pushFinding(findings, {
      key: 'hidden_soc',
      icon: '藏',
      title: hidden.primary.label,
      confidence: hidden.primary.confidence || '中',
      color: '#8E6BB0',
      text: hidden.summary,
      detail: hidden.primary.evidenceText
    });
    evidence.push({ tag: 'vehicle', text: '[隐藏电量] ' + hidden.primary.evidenceText });
    advice.push(hidden.primary.adviceText);
  }

  if (speed.key === 'vehicle_limit' && !speed.impedanceHint) {
    pushFinding(findings, {
      key: 'charge_slow',
      icon: '慢',
      title: '充电偏慢 · 车端限流',
      confidence: '—',
      color: '#2F6BFF',
      text: speed.summary,
      detail: '未必是电池病；也可能是温度、策略或桩能力'
    });
  }

  var primary = pickPrimary(findings);
  var chemLabel = chem.label || (chem.chemistry === 'unknown' ? '未识别' : chem.chemistry);

  return {
    toolName: TOOL_NAME,
    tagline: TOOL_TAGLINE,
    label: primary.title || primary.label,
    color: primary.color,
    summary: primary.text || primary.summary,
    disclaimer: '辅助体检，非质保/定责依据；行驶掉功率与 7 天压差趋势需厂家 CAN。',
    findings: findings,
    evidence: evidence,
    advice: advice,
    soh: soh,
    speed: speed,
    imbalance: imbalance,
    cellAlert: cellAlert,
    hiddenSoc: hidden,
    chemistry: chem,
    numbers: {
      sohPct: soh.sohPct,
      estimatedCapacityAh: soh.estimatedCapacityAh,
      ratedCapacityAh: soh.ratedCapacityAh,
      batteryType: soh.numbers && soh.numbers.batteryType || chemLabel,
      maxCellV: cellAlert ? cellAlert.maxCellV : (speed.impedanceHint ? speed.impedanceHint.maxCellV : null),
      cellSpreadV: imbalance ? imbalance.spreadV : null,
      soc: soh.numbers && soh.numbers.socEnd,
      bcsCount: soh.numbers && soh.numbers.bcsCount,
      ccsCount: soh.numbers && soh.numbers.ccsCount
    },
    frameCount: parsed.totalFrames || frames.length
  };
}

var DEMO_SCENARIOS = [
  {
    id: 'impedance',
    title: '示例：高阻抗限流',
    desc: '三元 · SOC 48% · 单体 4.19V · 车端限流',
    log: chargeSpeed.buildImpedanceDemoLog()
  },
  {
    id: 'soh_88',
    title: '示例：容量良好 88%',
    desc: '100Ah 额定 · SOC 25→48% 充电',
    log: batterySoh.buildDemoSohLog({ ratedAh: 100, sohPct: 88, socStart: 25, socEnd: 48, currentA: 50 })
  },
  {
    id: 'imbalance',
    title: '示例：单体不平衡',
    desc: 'BSD 压差 0.13V（超三元阈值）',
    log: '00:00:00.300 1801F456 AA 01 02 03 31 32 33 34\n' +
      '00:00:00.220 1CEC56F4 20 31 00 07 FF 00 02 00\n' +
      '00:00:00.220 1CEB56F4 01 01 06 E8 03 88 13\n' +
      '00:00:00.220 1CEB56F4 02 00 00 00 00 00 00\n' +
      '00:00:00.220 1CEB56F4 03 00 00 00 00 00 00\n' +
      '00:00:00.220 1CEB56F4 04 00 00 00 00 00 00\n' +
      '00:00:00.220 1CEB56F4 05 00 00 00 00 00 00\n' +
      '00:00:00.220 1CEB56F4 06 00 00 00 00 00 00\n' +
      '00:00:00.220 1CEB56F4 07 00 00 00 00 00 00\n' +
      '00:00:10.000 181C56F4 32 42 01 4F 01 55 56'
  }
];

function getToolMeta() {
  return {
    name: TOOL_NAME,
    tagline: TOOL_TAGLINE,
    desc: 'SOH 容量、高阻抗、单体不平衡、高压告警与隐藏电量，一项看清'
  };
}

module.exports = {
  analyzeBatteryHealth: analyzeBatteryHealth,
  getToolMeta: getToolMeta,
  DEMO_SCENARIOS: DEMO_SCENARIOS,
  TOOL_NAME: TOOL_NAME
};
