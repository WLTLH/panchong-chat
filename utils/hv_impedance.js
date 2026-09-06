/**
 * 高压电池高阻抗（High Brick Impedance）
 *
 * 来源：车企服务文档共性（三元圆柱包：内阻升高 → 电压提前顶限 → 快充限流/加速掉功率）。
 * 判充在 27930 枪线上仅能启发式识别「充电侧」部分特征；行驶掉功率需厂家 CAN。
 */

var batteryChem = require('./battery_chemistry.js');

var CELL_V_CHARGE_LIMIT = 4.18;
var CELL_V_CHARGE_WARN = 4.10;
var SOC_CHARGE_LIMIT = 60;
var TEMP_MIN_CHARGE_C = 30;
var TEMP_MIN_DRIVE_C = 20;
var CELL_SPREAD_V = 0.5;
var CELL_FULL_V = 4.2;
var CAC_DEVIATION_AH = 12;
var POWER_BUDGET_KW = 15;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function collectImpedanceSeries(frames) {
  var bcs = [];
  var temps = [];

  (frames || []).forEach(function (f) {
    var m = f.metrics || {};
    if (f.code === 'BCS') {
      if (m.soc == null && m.maxCellVoltage == null) return;
      bcs.push({
        t: f.relMs != null ? f.relMs : (f.tMs || 0),
        soc: m.soc != null ? Number(m.soc) : null,
        cellV: m.maxCellVoltage != null ? Number(m.maxCellVoltage) : null,
        packV: m.measVoltage != null ? Number(m.measVoltage) : null,
        i: m.measCurrent != null ? Math.abs(m.measCurrent) : null
      });
    }
    if (f.code === 'BSM') {
      var tmax = m.maxTemp != null ? Number(m.maxTemp) : (f.data && f.data.length >= 2 ? f.data[1] - 50 : null);
      var tmin = m.minTemp != null ? Number(m.minTemp) : (f.data && f.data.length >= 4 ? f.data[3] - 50 : null);
      if (tmax != null && isFinite(tmax)) temps.push(tmax);
      if (tmin != null && isFinite(tmin)) temps.push(tmin);
    }
  });

  bcs.sort(function (a, b) { return a.t - b.t; });
  var minTemp = temps.length ? Math.min.apply(null, temps) : null;
  var maxTemp = temps.length ? Math.max.apply(null, temps) : null;
  return { bcs: bcs, minTemp: minTemp, maxTemp: maxTemp };
}

/**
 * 充电慢：疑三元高阻抗 → 单体电压调节限流
 * @param {Array} frames
 * @param {{ soc?: number, avgReq?: number, pileMaxI?: number, gap?: number, vsCmlReq?: number }} chargeCtx
 */
function detectChargeImpedance(frames, chargeCtx) {
  chargeCtx = chargeCtx || {};
  var chem = batteryChem.resolveChemistry(frames);
  if (!batteryChem.isTernaryChemistry(chem)) return null;

  var series = collectImpedanceSeries(frames);
  var bcs = series.bcs;
  if (!bcs.length) return null;

  var soc = chargeCtx.soc;
  var avgReq = chargeCtx.avgReq;
  var pileMaxI = chargeCtx.pileMaxI;
  var gap = chargeCtx.gap;
  var vsCmlReq = chargeCtx.vsCmlReq;

  var vehicleLimiting = false;
  if (vsCmlReq != null && vsCmlReq < 0.55 && gap != null && gap < 15) vehicleLimiting = true;
  else if (pileMaxI != null && avgReq != null && avgReq < pileMaxI * 0.55 && gap != null && gap < 15) {
    vehicleLimiting = true;
  } else if (avgReq != null && avgReq < 50 && gap != null && gap < 12) {
    vehicleLimiting = true;
  }

  var cellHits = [];
  bcs.forEach(function (p) {
    if (p.soc == null || p.cellV == null) return;
    if (p.soc >= SOC_CHARGE_LIMIT) return;
    if (p.cellV >= CELL_V_CHARGE_LIMIT - 0.005) {
      cellHits.push(p);
    }
  });

  if (!cellHits.length) return null;

  var best = cellHits[cellHits.length - 1];
  var tempOk = series.minTemp == null || series.minTemp > TEMP_MIN_CHARGE_C;
  var confidence = '中';

  if (vehicleLimiting && best.cellV >= CELL_V_CHARGE_LIMIT - 0.005 && tempOk) confidence = '较高';
  else if (!vehicleLimiting) confidence = '低';

  if (best.cellV < CELL_V_CHARGE_WARN) return null;

  var evidenceText = '三元锂 · SOC ' + round1(best.soc) + '%（<' + SOC_CHARGE_LIMIT + '%）时最高单体已达 ' +
    round2(best.cellV) + 'V（≥' + CELL_V_CHARGE_LIMIT + 'V）';
  if (vehicleLimiting && avgReq != null) {
    evidenceText += '，车端 BCL 需求仅约 ' + round1(avgReq) + 'A（疑单体电压调节限流）';
  }
  if (series.minTemp != null) {
    evidenceText += '，电池温度约 ' + round1(series.minTemp) + '–' + round1(series.maxTemp) + '℃';
  }

  return {
    key: 'hv_impedance_charge',
    scenario: 'charge_slow',
    label: '疑高阻抗导致快充限流',
    chemistry: 'ternary',
    confidence: confidence,
    soc: round1(best.soc),
    maxCellV: round2(best.cellV),
    hitCount: cellHits.length,
    vehicleLimiting: vehicleLimiting,
    minTemp: series.minTemp != null ? round1(series.minTemp) : null,
    evidenceText: evidenceText,
    adviceText: '中 SOC 单体电压已顶到三元上限附近，BMS 可能因电芯内阻偏高进入单体电压调节限流，快充变慢。建议查弱单体/模组一致性、SOH；换桩通常无法明显改善。仅适用于三元锂，不适用于 LFP。',
    summary: 'SOC ' + round1(best.soc) + '% 时单体 ' + round2(best.cellV) + 'V，疑高阻抗致电压调节限流，快充偏慢。'
  };
}

/**
 * 将高阻抗线索合并进充电慢结果
 */
function mergeImpedanceHint(result, hint) {
  if (!hint || !result) return result;
  result.impedanceHint = hint;
  result.evidence = result.evidence || [];
  result.advice = result.advice || [];
  result.evidence.push({ tag: 'vehicle', text: hint.evidenceText });
  result.advice.unshift(hint.adviceText);

  if (result.key === 'vehicle_limit' || result.key === 'taper' || result.key === 'aligned') {
    result.label = hint.label;
    result.summary = hint.summary + '；' + (result.summary || '');
  } else if (result.key !== 'insufficient') {
    result.summary = hint.summary + '；' + result.summary;
  }

  if (result.numbers) {
    result.numbers.impedanceScenario = hint.scenario;
    result.numbers.impedanceConfidence = hint.confidence;
    result.numbers.maxCellV = hint.maxCellV;
  }
  return result;
}

var HV_IMPEDANCE_GUIDE = {
  intro: '电芯内阻（阻抗）升高后，充放电时更容易出现单体电压提前顶限或负载下压差拉大，表现为快充变慢或加速无力。' +
    '以下整理自车企服务文档共性；判充在 27930 枪线上仅能做充电侧启发式识别，行驶掉功率需厂家 CAN。',
  batteryScope: '主要适用于三元锂（NMC/NCA）圆柱/方壳包，如文档中的 LGM50、LGM48 等。' +
    '磷酸铁锂单体满充电压约 3.65V，不适用 4.18V/4.2V 单体电压调节逻辑。',
  scenarios: [
    {
      id: 'charge_slow',
      title: '快充变慢：单体电压调节限流',
      appliesTo: '三元锂（LGM50/LGM48 等圆柱三元包）',
      symptom: 'DC 快充明显偏慢，换大功率桩改善有限；客户感觉「桩不够快」，实为车在限流。',
      mechanism: '电芯内阻偏高 → 充电电流稍大时弱单体电压迅速升高 → BMS 进入单体电压调节限流（CHG_LIMIT_BRICK_VOLTAGE_REG）→ 车端降低 BCL 需求。',
      oemSignals: [
        'BMS_brickVoltageMax > 4.18 V',
        'BMS_socMax < 60%',
        'BMS_chargeCurrentLimitMode = CHG_LIMIT_BRICK_VOLTAGE_REG',
        'BMS_packPower < 桩最大功率',
        'BMS_minModeledPackTemp > 30℃（排除低温限流）'
      ],
      gbt27930: [
        'BCS 最高单体电压 ≥ 4.18V',
        'BCS SOC < 60%',
        'BCL 需求明显低于 CML 桩能力，CCS 跟上 BCL（车端限流形态）',
        'BSM 最低温度 > 30℃（有则提高置信度）'
      ],
      detectNote: '判充「充电慢」命中车端限流且满足上述 BCS 条件时，提示「疑高阻抗导致快充限流」。',
      fixNote: '服务侧可进一步查 CAC 偏差（cacMax−cacMin > 12Ah）、Autodiag；严重一致性/衰减问题可能需更换 HV 电池。'
    },
    {
      id: 'drive_power_loss',
      title: '加速无力：高阻抗掉功率（行驶）',
      appliesTo: '三元锂高压包（厂家 CAN 诊断）',
      symptom: '加速明显变肉，可能无故障灯；Autodiag 不一定直接报出。',
      mechanism: '放电大电流时弱电芯内阻压降大 → 包端/母线电压被拉低 → BMS 收紧功率预算与电流限制。',
      oemSignals: [
        'BMS_totalHvPowerBudget < 15 kW',
        'BMS_state = Drive',
        'BMS_minModeledPackTemp > 20℃',
        'UI_uSoc > 5%'
      ],
      testProcedure: [
        '放电至 SOC ≥ 30%',
        '执行 3 次 0–100km/h 全油门（WOT）',
        '拉取日志并重跑 High Brick Impedance Autodiag'
      ],
      gbt27930: [
        '27930 充电枪线无行驶功率预算信号，本场景无法在枪线日志中判定',
        '需接入车端厂家 CAN 或售后诊断仪'
      ],
      detectNote: '判充暂不自动判定；仅作手册参考。'
    },
    {
      id: 'drive_spread',
      title: '大负载压差异常（Scenario 2）',
      appliesTo: '三元锂（厂家 CAN 诊断）',
      symptom: '急加速时动力不足，伴随包压下降、电流限制同时收紧。',
      mechanism: '高阻抗弱单体在负载下电压掉得多，与强单体压差拉大，触发保护性限流。',
      oemSignals: [
        '加速时 BMS_minBusVoltage 接近电机侧 vBatt / BMS_packVoltage',
        '连续两帧：(BMS_brickVoltageMax − BMS_brickVoltageMin) > 0.5 V',
        '且 (max − min) > (4.2 − BMS_brickVoltageMax)',
        'DIR/DIF_currentLimit 与 BMS_packVoltage 同时下降'
      ],
      gbt27930: [
        '27930 BCS 仅上报最高单体，无最单体/母线压差，无法完整复现 Scenario 2',
        '若后续解析 BMV 单体矩阵，可补充压差规则'
      ],
      detectNote: '判充暂不自动判定；仅作手册参考。'
    }
  ],
  thresholds: [
    { name: '单体电压（充电限流）', value: '≥ 4.18 V', scope: '三元 · SOC < 60%' },
    { name: '单体压差（行驶）', value: '> 0.5 V', scope: '三元 · 厂家 CAN' },
    { name: '功率预算（行驶）', value: '< 15 kW', scope: '厂家 CAN' },
    { name: '充电温度排除', value: '> 30℃', scope: 'BSM 有则采用' },
    { name: '行驶温度排除', value: '> 20℃', scope: '厂家 CAN' },
    { name: 'CAC 偏差（换包参考）', value: '> 12 Ah', scope: '厂家 CAN · cacMax−cacMin' }
  ],
  disclaimer: [
    '高阻抗判定来源于车企服务文档的技术归纳，判充实现为 27930 可观测信号的辅助启发式，非官方诊断结论。',
    '4.18V/4.2V 阈值仅适用于三元锂；LFP 请使用 LFP 专用单体规则（约 3.65V 上限）。',
    '行驶掉功率、CAC 偏差、Autodiag 等需厂家 CAN，枪线日志不能替代售后诊断。',
    '是否更换高压电池须由品牌售后按官方流程判定，本工具不定责、不建议用户自行换包。'
  ]
};

function getImpedanceGuide() {
  return HV_IMPEDANCE_GUIDE;
}

module.exports = {
  detectChargeImpedance: detectChargeImpedance,
  mergeImpedanceHint: mergeImpedanceHint,
  getImpedanceGuide: getImpedanceGuide,
  HV_IMPEDANCE_GUIDE: HV_IMPEDANCE_GUIDE,
  CELL_V_CHARGE_LIMIT: CELL_V_CHARGE_LIMIT,
  SOC_CHARGE_LIMIT: SOC_CHARGE_LIMIT
};
