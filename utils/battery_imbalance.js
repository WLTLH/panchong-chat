/**
 * 高压电池单体/Brick 电压与 SOC 不平衡（Capacity Limitation）
 *
 * 来源：车企服务文档——最高/最低 brick 压差或 SOC 不平衡持续存在 → 容量受限/异常电芯。
 * 27930 仅在 BSD（充电结束统计）等帧可见最低/最高单体；无法做 7 天持续性判定。
 */

var batteryChem = require('./battery_chemistry.js');

var SPREAD_THRESHOLD_TERNARY = 0.075;
var SPREAD_THRESHOLD_LFP = 0.03;
var SPREAD_SEVERE_TERNARY = 0.15;
var SPREAD_SEVERE_LFP = 0.06;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function spreadThreshold(chem) {
  if (batteryChem.isLfpChemistry(chem)) return SPREAD_THRESHOLD_LFP;
  if (batteryChem.isTernaryChemistry(chem)) return SPREAD_THRESHOLD_TERNARY;
  return SPREAD_THRESHOLD_TERNARY;
}

function collectSpreadSamples(frames) {
  var samples = [];
  (frames || []).forEach(function (f) {
    var m = f.metrics || {};
    if (f.code === 'BSD') {
      var minV = m.minCellVoltage != null ? Number(m.minCellVoltage) : null;
      var maxV = m.maxCellVoltage != null ? Number(m.maxCellVoltage) : null;
      if (minV == null && f.data && f.data.length >= 3) minV = (f.data[1] | (f.data[2] << 8)) * 0.01;
      if (maxV == null && f.data && f.data.length >= 5) maxV = (f.data[3] | (f.data[4] << 8)) * 0.01;
      if (minV != null && maxV != null && isFinite(minV) && isFinite(maxV)) {
        samples.push({
          source: 'BSD',
          soc: m.soc != null ? Number(m.soc) : null,
          minV: minV,
          maxV: maxV,
          spread: maxV - minV
        });
      }
    }
  });
  return samples;
}

/**
 * @param {Array} frames
 * @returns {object|null}
 */
function detectCellImbalance(frames) {
  var samples = collectSpreadSamples(frames);
  if (!samples.length) return null;

  var chem = batteryChem.resolveChemistry(frames);
  var thresh = spreadThreshold(chem);
  var severe = batteryChem.isLfpChemistry(chem) ? SPREAD_SEVERE_LFP : SPREAD_SEVERE_TERNARY;
  var chemLabel = chem.label || (batteryChem.isLfpChemistry(chem) ? '磷酸铁锂' : '三元锂');

  var worst = null;
  samples.forEach(function (s) {
    if (s.spread < thresh - 0.0001) return;
    if (!worst || s.spread > worst.spread) worst = s;
  });
  if (!worst) return null;

  var confidence = worst.spread >= severe ? '中' : '低';
  if (samples.length >= 2) confidence = worst.spread >= severe ? '较高' : '中';

  return {
    key: 'hv_cell_imbalance',
    scenario: 'capacity_limitation',
    label: '疑单体电压不平衡',
    chemistry: chem.chemistry,
    confidence: confidence,
    minCellV: round2(worst.minV),
    maxCellV: round2(worst.maxV),
    spreadV: round2(worst.spread),
    thresholdV: thresh,
    source: worst.source,
    soc: worst.soc != null ? round2(worst.soc) : null,
    evidenceText: chemLabel + ' · ' + worst.source + ' 最低单体 ' + round2(worst.minV) + 'V，最高 ' +
      round2(worst.maxV) + 'V，压差 ' + round2(worst.spread) + 'V（阈值 ' + thresh + 'V）',
    adviceText: '最高/最低单体压差超过服务文档阈值，疑电芯/模组不一致或异常内阻，可能导致容量受限、快充变慢或加速掉功率。' +
      '官方流程需连续 7 天监测压差是否持续/扩大，并排除低温误报；单次 BSD 仅作线索。',
    summary: '单体压差 ' + round2(worst.spread) + 'V（≥' + thresh + 'V），疑高压电池不平衡/容量受限。'
  };
}

function mergeImbalanceHint(result, hint) {
  if (!hint || !result) return result;
  result.imbalanceHint = hint;
  result.evidence = result.evidence || [];
  result.advice = result.advice || [];
  result.evidence.push({ tag: 'vehicle', text: hint.evidenceText });
  result.advice.push(hint.adviceText);
  if (result.numbers) {
    result.numbers.cellSpreadV = hint.spreadV;
    result.numbers.minCellV = hint.minCellV;
    result.numbers.imbalanceConfidence = hint.confidence;
  }
  return result;
}

var CELL_IMBALANCE_GUIDE = {
  intro: '当最高与最低 brick/单体电压（或 SOC）长期不平衡且压差持续或扩大时，BMS 可能限制充放电功率与可用容量（Capacity Limitation）。' +
    '这是独立于「高阻抗」的另一类高压电池健康问题，二者可同时存在。',
  scenarios: [
    {
      id: 'capacity_limitation',
      title: '容量受限：单体/SOC 不平衡',
      appliesTo: '三元锂与磷酸铁锂（阈值不同）',
      symptom: '快充变慢、可用续航下降、可能伴随不平衡告警；压差长期存在而非短暂波动。',
      mechanism: '弱单体与强单体电压或 SOC 偏差过大 → BMS 限制充放电.acceptance → 表现为功率/容量受限。',
      oemSignals: [
        '连续 7 天监测 BMS_brickVoltageMax、BMS_brickVoltageMin',
        '压差稳定且不减小（非短暂波动）',
        '告警示例：BMS_a062_SW_BrickV_Imbalance、BMS_a070_BrickV_Imbalance_Limiting、BMS_a064_SW_SOC_Imbalance',
        '排除极低温误报；确认告警未自行清除'
      ],
      testProcedure: [
        '运行 Diagnose HV Battery / Distribution Autodiag',
        '拉取 7 天日志查看 max/min brick 压差趋势',
        '非 LFP：压差 > 0.075 V；LFP：压差 > 0.03 V',
        '结合 SOC 不平衡告警与换包/维修流程'
      ],
      gbt27930: [
        'BSD（充电结束统计）含单体最低/最高电压 → 可算单次压差',
        '充电中 BCS 仅最高单体，无法单独算压差',
        '单次日志不能代替 7 天持续性判定'
      ],
      detectNote: '判充在日志含 BSD 且压差超阈值时提示「疑单体电压不平衡」（LFP 0.03V / 三元 0.075V）。',
      fixNote: '是否维修/换包须走品牌售后官方流程；勿仅凭单次枪线日志定责。'
    }
  ],
  thresholds: [
    { name: '单体压差（非 LFP）', value: '> 0.075 V', scope: '7 天持续 · 厂家 CAN' },
    { name: '单体压差（LFP）', value: '> 0.03 V', scope: '7 天持续 · 厂家 CAN' },
    { name: 'BSD 单次线索（三元）', value: '≥ 0.075 V', scope: '27930 枪线 · 低置信' },
    { name: 'BSD 单次线索（LFP）', value: '≥ 0.03 V', scope: '27930 枪线 · 低置信' },
    { name: 'SOC 不平衡', value: '告警位', scope: '厂家 CAN · BMS_a064 等' }
  ],
  relationToImpedance: '高阻抗：单体易提前顶压限流；不平衡：强弱单体压差/SOC 差过大限容量。症状可能重叠，需结合压差趋势与内阻/快充曲线综合看。',
  disclaimer: [
    '不平衡判定来自车企服务文档归纳；判充仅用 BSD 等有限报文做单次压差线索，不能替代 7 天监测与 Autodiag。',
    'LFP 与三元阈值不同，须先识别电池类型再比对阈值。',
    '低温、单次充电结束瞬间、通信抖动可能导致压差瞬时偏大，须结合温度与多次复测。',
    '本工具不定责、不建议用户自行换包或索赔。'
  ]
};

function getImbalanceGuide() {
  return CELL_IMBALANCE_GUIDE;
}

module.exports = {
  detectCellImbalance: detectCellImbalance,
  mergeImbalanceHint: mergeImbalanceHint,
  getImbalanceGuide: getImbalanceGuide,
  CELL_IMBALANCE_GUIDE: CELL_IMBALANCE_GUIDE,
  SPREAD_THRESHOLD_TERNARY: SPREAD_THRESHOLD_TERNARY,
  SPREAD_THRESHOLD_LFP: SPREAD_THRESHOLD_LFP
};
