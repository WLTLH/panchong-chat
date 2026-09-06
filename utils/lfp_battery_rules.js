/**
 * 磷酸铁锂（LFP）通用判定条件
 *
 * 来源：LFP-302Ah 级电芯控制策略共性（联动天翼/CATL 类规格书），
 * 仅摘可在 27930 BRM+BCS 上判定的项；包级温感/继电器等需 BSM/厂家 CAN 的暂不纳入。
 *
 * 若将「LFP-302Ah电芯控制策略-2021联动天翼.xlsx」放入 chat/refs/ 可再细化阈值。
 */

var LFP_BATTERY_CODES = { 0x03: true };

/** 通用阈值（302Ah LFP 规格书常见值，非某一包独有） */
var LFP_THRESH = {
  cellAbsMaxV: 3.65,
  cellWarnHighV: 3.58,
  cellSevereHighV: 3.52,
  cellLowAtFullV: 3.35,
  socEarlyHighMax: 75,
  socSevereEarlyMax: 55,
  socFullLowMin: 90
};

var LFP_RULES = [
  {
    id: 'lfp_cell_abs_max',
    priority: 1,
    label: 'LFP 单体达绝对上限',
    rule: '磷酸铁锂 + BCS 最高单体 ≥ 3.65V',
    check: function (soc, cellV) {
      return cellV >= LFP_THRESH.cellAbsMaxV - 0.005;
    },
    evidence: function (soc, cellV) {
      return '磷酸铁锂 · 最高单体 ' + fmt(cellV) + 'V（≥' + LFP_THRESH.cellAbsMaxV + 'V 绝对上限）';
    },
    advice: '单体已达 LFP 绝对充电上限，BMS 应申请停充。建议查过充保护、均衡与采样。'
  },
  {
    id: 'lfp_early_high_severe',
    priority: 2,
    label: 'LFP 低 SOC 单体偏高',
    rule: '磷酸铁锂 + SOC ≤ 55% + 最高单体 ≥ 3.52V',
    check: function (soc, cellV) {
      return soc <= LFP_THRESH.socSevereEarlyMax && cellV >= LFP_THRESH.cellSevereHighV;
    },
    evidence: function (soc, cellV) {
      return '磷酸铁锂 · SOC ' + fmt(soc) + '% 时最高单体 ' + fmt(cellV) + 'V（≥' + LFP_THRESH.cellSevereHighV + 'V）';
    },
    advice: 'LFP 平台期低 SOC 不应接近满充电压，一致性偏差大，建议重点查模组压差/采样/均衡。'
  },
  {
    id: 'lfp_early_high',
    priority: 3,
    label: 'LFP 平台期单体偏高',
    rule: '磷酸铁锂 + SOC ≤ 75% + 最高单体 ≥ 3.58V',
    check: function (soc, cellV) {
      return soc <= LFP_THRESH.socEarlyHighMax && cellV >= LFP_THRESH.cellWarnHighV;
    },
    evidence: function (soc, cellV) {
      return '磷酸铁锂 · SOC ' + fmt(soc) + '% 时最高单体 ' + fmt(cellV) + 'V（≥' + LFP_THRESH.cellWarnHighV + 'V）';
    },
    advice: '未到满充段单体已偏高，可能存在压差或 SOC 估算偏差，建议查高压电池一致性。'
  },
  {
    id: 'lfp_full_low_voltage',
    priority: 4,
    label: 'LFP 高 SOC 单体偏低',
    rule: '磷酸铁锂 + SOC ≥ 90% + 最高单体 < 3.35V',
    check: function (soc, cellV) {
      return soc >= LFP_THRESH.socFullLowMin && cellV < LFP_THRESH.cellLowAtFullV;
    },
    evidence: function (soc, cellV) {
      return '磷酸铁锂 · SOC ' + fmt(soc) + '% 但最高单体仅 ' + fmt(cellV) + 'V（<' + LFP_THRESH.cellLowAtFullV + 'V）';
    },
    advice: '高 SOC 但单体电压偏低，疑弱单体或 SOC 标定不准，建议查电芯与 BMS 容量学习。'
  }
];

function fmt(n) {
  if (n == null || !isFinite(n)) return '—';
  return Math.round(n * 100) / 100;
}

function isLfpBattery(typeName, typeCode) {
  if (typeCode != null && LFP_BATTERY_CODES[typeCode]) return true;
  if (typeName && String(typeName).indexOf('磷酸铁锂') >= 0) return true;
  if (typeName && /\bLFP\b/i.test(typeName)) return true;
  return false;
}

/**
 * @param {Array} frames gbt decode frames
 * @returns {object|null} cellAlert 结构，与三元 detectTernaryCellAlert 兼容
 */
function detectLfpCellAlert(frames) {
  var batteryChem = require('./battery_chemistry.js');
  var chem = batteryChem.resolveChemistry(frames);
  if (!batteryChem.isLfpChemistry(chem)) return null;

  var batteryType = chem.label || '磷酸铁锂电池';
  var hits = [];

  (frames || []).forEach(function (f) {
    var m = f.metrics || {};
    if (f.code !== 'BCS') return;

    var soc = m.soc != null ? Number(m.soc) : null;
    var cellV = m.maxCellVoltage != null ? Number(m.maxCellVoltage) : null;
    if (soc == null || cellV == null || !isFinite(soc) || !isFinite(cellV)) return;

    for (var i = 0; i < LFP_RULES.length; i++) {
      var rule = LFP_RULES[i];
      if (!rule.check(soc, cellV)) continue;
      hits.push({
        ruleId: rule.id,
        priority: rule.priority,
        label: rule.label,
        soc: soc,
        cellV: cellV,
        group: m.maxCellGroup,
        evidenceText: rule.evidence(soc, cellV),
        adviceText: rule.advice
      });
      break;
    }
  });

  if (!hits.length) return null;

  hits.sort(function (a, b) {
    return a.priority - b.priority;
  });
  var best = hits[0];
  var matchedRule = null;
  for (var j = 0; j < LFP_RULES.length; j++) {
    if (LFP_RULES[j].id === best.ruleId) {
      matchedRule = LFP_RULES[j];
      break;
    }
  }

  return {
    key: 'hv_battery_check',
    label: '建议检查高压电池',
    batteryType: batteryType || '磷酸铁锂电池',
    chemistry: 'lfp',
    chemistrySource: chem.source,
    chemistryConfidence: chem.confidence,
    ruleId: best.ruleId,
    ruleLabel: matchedRule ? matchedRule.label : best.label,
    soc: fmt(best.soc),
    maxCellV: fmt(best.cellV),
    hitCount: hits.length,
    evidenceText: best.evidenceText,
    adviceText: best.adviceText,
    summary: (batteryType || '磷酸铁锂') + '：' + best.evidenceText + '，建议检查高压电池。'
  };
}

module.exports = {
  LFP_THRESH: LFP_THRESH,
  LFP_RULES: LFP_RULES,
  isLfpBattery: isLfpBattery,
  detectLfpCellAlert: detectLfpCellAlert
};
