/**
 * 电池化学体系：BRM 优先，无 BRM 时用 BCS 中 SOC+单体电压平台推断
 */
var lfpRules = require('./lfp_battery_rules.js');

var TERNARY_BATTERY_CODES = { 0x06: true };

function isTernaryByBrm(typeName, typeCode) {
  if (typeCode != null && TERNARY_BATTERY_CODES[typeCode]) return true;
  if (typeName && String(typeName).indexOf('三元') >= 0) return true;
  return false;
}

function isLfpByBrm(typeName, typeCode) {
  return lfpRules.isLfpBattery(typeName, typeCode);
}

function collectMidPlateauSamples(frames) {
  var samples = [];
  (frames || []).forEach(function (f) {
    if (f.code !== 'BCS') return;
    var m = f.metrics || {};
    var soc = m.soc != null ? Number(m.soc) : null;
    var cellV = m.maxCellVoltage != null ? Number(m.maxCellVoltage) : null;
    if (soc == null || cellV == null || !isFinite(soc) || !isFinite(cellV)) return;
    if (soc < 25 || soc > 80) return;
    samples.push({ soc: soc, cellV: cellV });
  });
  return samples;
}

function medianCellV(samples) {
  if (!samples.length) return null;
  var arr = samples.map(function (s) { return s.cellV; }).sort(function (a, b) { return a - b; });
  var m = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
}

/**
 * @returns {{ chemistry: 'lfp'|'ternary'|'unknown', label: string, source: 'brm'|'bcs_inferred'|'none', confidence: string }}
 */
function resolveChemistry(frames) {
  var typeName = '';
  var typeCode = null;

  (frames || []).forEach(function (f) {
    if (f.code !== 'BRM') return;
    var m = f.metrics || {};
    if (m.batteryType) typeName = m.batteryType;
    if (m.batteryTypeCode != null) typeCode = m.batteryTypeCode;
  });

  if (isLfpByBrm(typeName, typeCode)) {
    return {
      chemistry: 'lfp',
      label: typeName || '磷酸铁锂电池',
      source: 'brm',
      confidence: 'high'
    };
  }
  if (isTernaryByBrm(typeName, typeCode)) {
    return {
      chemistry: 'ternary',
      label: typeName || '三元材料电池',
      source: 'brm',
      confidence: 'high'
    };
  }

  var samples = collectMidPlateauSamples(frames);
  if (samples.length < 2) {
    return { chemistry: 'unknown', label: '', source: 'none', confidence: 'none' };
  }

  var hasHighTernary = false;
  samples.forEach(function (s) {
    if (s.soc >= 40 && s.soc <= 75 && s.cellV >= 4.0) hasHighTernary = true;
  });
  if (hasHighTernary) {
    return {
      chemistry: 'ternary',
      label: '三元锂(电压推断)',
      source: 'bcs_inferred',
      confidence: 'medium'
    };
  }

  var med = medianCellV(samples);
  if (med != null && med <= 3.42) {
    return {
      chemistry: 'lfp',
      label: '磷酸铁锂(电压推断)',
      source: 'bcs_inferred',
      confidence: 'medium'
    };
  }
  if (med != null && med >= 3.75) {
    return {
      chemistry: 'ternary',
      label: '三元锂(电压推断)',
      source: 'bcs_inferred',
      confidence: 'medium'
    };
  }

  return { chemistry: 'unknown', label: '', source: 'none', confidence: 'low' };
}

function isLfpChemistry(chem) {
  return chem && chem.chemistry === 'lfp';
}

function isTernaryChemistry(chem) {
  return chem && chem.chemistry === 'ternary';
}

module.exports = {
  resolveChemistry: resolveChemistry,
  isLfpChemistry: isLfpChemistry,
  isTernaryChemistry: isTernaryChemistry,
  isLfpByBrm: isLfpByBrm,
  isTernaryByBrm: isTernaryByBrm
};
