/**
 * 判定规则库：现场检查表、报文位域打分、裁决阈值、免费结论统一映射
 * 供 analyze / membership / 判定手册页共用
 */

var bstCst = require('./bst_cst.js');

// ─── 现场检查表（桩 / 车 / 连接 各 4 步）────────────────────────────

var FIELD_CHECKLIST = {
  connection: {
    title: '连接（优先排查）',
    color: '#E67E22',
    steps: [
      { n: 1, title: '插枪到位', detail: '听到卡扣声；枪座无歪斜；无「未连接」反复跳变' },
      { n: 2, title: '枪口与锁止', detail: '清洁无异物；电子锁锁止成功（屏显/手感）；无锁止失败告警' },
      { n: 3, title: 'CC1 / CC2', detail: '直流测 CC1 引导电压、CC2 电阻；双低优先怀疑枪线/座端/PE' },
      { n: 4, title: '外观与接地', detail: '枪座烧蚀、进水、线束压伤；PE 连续可靠；重插后再采一段日志' }
    ]
  },
  pile: {
    title: '桩端',
    color: '#07C160',
    steps: [
      { n: 1, title: '换桩对比', detail: '仅本桩失败 → 偏桩；多桩多站均失败 → 偏车；记录桩品牌/功率' },
      { n: 2, title: '桩屏与告警', detail: '记录桩屏代码/文案；是否急停、过温、绝缘、连接器类提示' },
      { n: 3, title: '桩侧报文', detail: '查 CST（桩中止）、BEM（车收不到桩）；对照下方位域表' },
      { n: 4, title: '站级因素', detail: '多枪分流、站功率限额、第三方平台兼容；重启桩或换枪复核' }
    ]
  },
  vehicle: {
    title: '车端',
    color: '#2F6BFF',
    steps: [
      { n: 1, title: '多桩验证', detail: '超充/家充正常、仅部分第三方不行 → 兼查桩兼容；多站都失败 → 偏车' },
      { n: 2, title: '车机 / BMS', detail: '车机告警、绝缘、继电器、电池温度；交流：不插枪也报识别 → 偏车' },
      { n: 3, title: '车侧报文', detail: '查 BST（车中止）、CEM（桩收不到车）、BRO/BCL 是否应答' },
      { n: 4, title: '车内因素', detail: 'SOC 策略、故障降额、高压继电器未合；必要时 OBD 车内 CAN 辅助' }
    ]
  }
};

// ─── 观察项表（与 analyze.js 同步）──────────────────────────────────

var OBSERVATION_TABLE = [
  { id: 'only_this_pile', label: '只有这一把桩失败，其它桩正常', lean: 'pile', weight: 3, scope: '通用' },
  { id: 'many_piles_fail', label: '多把桩/多站都失败', lean: 'vehicle', weight: 3, scope: '通用' },
  { id: 'gun_dirty', label: '枪口脏/异物/没插到位', lean: 'connection', weight: 4, scope: '通用' },
  { id: 'lock_fail', label: '锁止失败', lean: 'connection', weight: 3, scope: '通用' },
  { id: 'pile_screen_err', label: '主要是桩屏报错', lean: 'pile', weight: 2, scope: '通用' },
  { id: 'vehicle_screen_err', label: '主要是车机报错', lean: 'vehicle', weight: 2, scope: '通用' },
  { id: 'retry_ok', label: '重启桩或重插后恢复', lean: 'pile', weight: 2, scope: '通用' },
  { id: 'super_ok_third_fail', label: '超充正常、仅第三方直流不行', lean: 'pile', weight: 3, scope: '直流' },
  { id: 'cc1_low', label: '已知 CC1 偏低', lean: 'connection', weight: 3, scope: '直流' },
  { id: 'cc1_cc2_low', label: 'CC1+CC2 双低', lean: 'connection', weight: 4, scope: '直流' },
  { id: 'no_gun_detect', label: '不插枪也报识别/连接异常', lean: 'vehicle', weight: 4, scope: '交流' }
];

var LEAN_LABEL = { vehicle: '车', pile: '桩', connection: '连接', neutral: '—' };
var LEAN_COLOR = { vehicle: '#2F6BFF', pile: '#07C160', connection: '#E67E22', neutral: '#8A8A8A' };

// ─── 日志存在性规则 ───────────────────────────────────────────────────

var LOG_PRESENCE_RULES = [
  { cond: '有 CST、无 BST', pile: 3, vehicle: 0, connection: 0 },
  { cond: '有 BST、无 CST', pile: 0, vehicle: 3, connection: 0 },
  { cond: 'BST 与 CST 均有', pile: 0, vehicle: 0, connection: 0, note: '改由位域细判加分' },
  { cond: '有 CEM（桩收不到车）', pile: 0, vehicle: 3, connection: 1 },
  { cond: '有 BEM（车收不到桩）', pile: 3, vehicle: 0, connection: 1 },
  { cond: '卡在充电前（未进 BCL/CCS）', pile: 1, vehicle: 0, connection: 1 },
  { cond: 'BSM 绝缘=异常', pile: 0, vehicle: 0, connection: 2 }
];

// ─── BST / CST 位域 → 加分 ───────────────────────────────────────────

var BST_BIT_RULES = [
  { reason: '充电机主动中止', lean: 'pile', weight: 2 },
  { reason: '绝缘故障', lean: 'connection', weight: 2 },
  { reason: '输出连接器过温', lean: 'connection', weight: 1 },
  { reason: 'BMS 元件、输出连接器过温', lean: 'vehicle', weight: 1 },
  { reason: 'BMS 元件、输出连接器过温', lean: 'connection', weight: 1 },
  { reason: '充电连接器故障', lean: 'connection', weight: 2 },
  { reason: '电池组温度过高', lean: 'vehicle', weight: 2 },
  { reason: '高压继电器故障', lean: 'vehicle', weight: 2 },
  { reason: '检测点2电压检测故障', lean: 'connection', weight: 2 },
  { reason: '其他故障', lean: 'vehicle', weight: 1 },
  { reason: '电流过大', lean: 'vehicle', weight: 1 },
  { reason: '电压异常', lean: 'connection', weight: 1 }
];

var CST_BIT_RULES = [
  { reason: '故障中止', lean: 'pile', weight: 1 },
  { reason: 'BMS 主动中止', lean: 'vehicle', weight: 2 },
  { reason: '充电机过温故障', lean: 'pile', weight: 2 },
  { reason: '充电连接器故障', lean: 'connection', weight: 2 },
  { reason: '充电机内部过温', lean: 'pile', weight: 2 },
  { reason: '所需电量不能传送', lean: 'pile', weight: 1 },
  { reason: '充电机急停', lean: 'pile', weight: 2 },
  { reason: '其他故障', lean: 'pile', weight: 1 },
  { reason: '电流不匹配', lean: 'pile', weight: 1 },
  { reason: '电流不匹配', lean: 'connection', weight: 1 },
  { reason: '电压异常', lean: 'connection', weight: 1 }
];

var BEM_REASON_RULE = { lean: 'pile', weight: 1, connectionExtra: 1, cap: 3 };
var CEM_REASON_RULE = { lean: 'vehicle', weight: 1, connectionExtra: 1, cap: 3 };

// ─── 综合裁决阈值（decideVerdict 同款，供手册展示）────────────────────

var VERDICT_THRESHOLDS = [
  { key: 'insufficient', label: '证据不足', rule: '车+桩+连接 总分 = 0' },
  { key: 'connection', label: '倾向连接', rule: '连接分 ≥3，且 ≥ 桩/车；领先 ≥1 或连接分 ≥4' },
  { key: 'vehicle', label: '倾向车端', rule: '车分 ≥ 桩分+2，且 ≥ 连接分' },
  { key: 'pile', label: '倾向桩端', rule: '桩分 ≥ 车分+2，且 ≥ 连接分' },
  { key: 'mixed', label: '混杂', rule: '|车分−桩分| ≤ 1，且 max(车,桩) ≥ 连接分' }
];

// ─── 充电慢规则摘要 ───────────────────────────────────────────────────

var SPEED_RULE_TABLE = [
  { label: '证据不足', lean: '—', rule: 'BCL < 2 或 CCS < 2' },
  { label: '正常降流', lean: '车', rule: 'SOC≥80% 且 需求 < 桩能力×55%' },
  { label: '车端限流', lean: '车', rule: '需求/桩能力 < 45% 且 gap<15A；或需求低、实出跟上' },
  { label: '桩能力不足', lean: '桩', rule: '需求≥能力×85%，实出≥能力×80%，gap 小' },
  { label: '桩未跟需求', lean: '桩', rule: 'gap≥20A 或 gap/需求≥25%' },
  { label: '车桩对齐', lean: '双方', rule: '|gap|<15A，特征不明显' },
  { label: '高压电池提示（三元）', lean: '车', rule: '三元锂 + SOC 60–65% + BCS 最高单体≥4.2V → 建议查高压电池' },
  { label: '高压电池提示（LFP）', lean: '车', rule: '磷酸铁锂 + BCS：单体≥3.65V；或低SOC高压/高SOC低电压' },
  { label: '电池类型推断', lean: '—', rule: '无 BRM 时：BCS 中 SOC25–80% 单体电压平台 ≤3.42V→LFP，≥3.75V 或 SOC40–75%≥4.0V→三元' },
  { label: '隐藏电量线索', lean: '车', rule: 'BCS：98%+仍充电/低SOC高电压/SOC卡住/LFP电压推算偏差/Ah与SOC不匹配（启发式）' },
  { label: '电池容量 SOH', lean: '车', rule: 'BRM额定Ah + BCSΔSOC + CCS安时积分；推荐20%→75%恒流段，详见判定手册「容量」' },
  { label: '疑高阻抗限流（快充）', lean: '车', rule: '三元锂 + SOC<60% + BCS最高单体≥4.18V + 车端BCL限流形态；适用LGM50/48类圆柱三元，不适用LFP' },
  { label: '高阻抗掉功率（行驶）', lean: '车', rule: '厂家CAN：功率预算<15kW、WOT压差>0.5V等；27930枪线无法自动判，见手册「电池」' },
  { label: '单体电压不平衡', lean: '车', rule: 'BSD最低/最高单体压差：三元>0.075V、LFP>0.03V（单次线索）；官方需7天持续监测' }
];

var FREE_VERDICT_RULES = [
  { order: 1, result: '建议换桩', rule: '连接分领先（≥3 且 ≥ 桩/车）或 详细结论=倾向连接' },
  { order: 2, result: '建议换桩', rule: '停因 side=连接(link)，或 |车分−桩分|≤2 且双方均有分' },
  { order: 3, result: '车端问题', rule: '车分 ≥ 桩分+2 且 ≥ 连接分；或停因偏车且分数未明显反对' },
  { order: 4, result: '桩端问题', rule: '桩分 ≥ 车分+2 且 ≥ 连接分；或停因偏桩且分数未明显反对' },
  { order: 5, result: '建议换桩', rule: '混杂 / 证据不足 / 其余兜底' }
];

function addScore(scores, lean, w) {
  if (!lean || lean === 'neutral' || !w) return;
  if (!scores[lean]) scores[lean] = 0;
  scores[lean] += w;
}

function applyReasonRules(reasons, rules, scores, evidence, prefix) {
  if (!reasons || !reasons.length) return;
  var applied = {};
  rules.forEach(function (rule) {
    if (reasons.indexOf(rule.reason) < 0) return;
    var k = rule.reason + '|' + rule.lean;
    if (applied[k]) return;
    applied[k] = true;
    addScore(scores, rule.lean, rule.weight);
    evidence.push({
      tag: rule.lean,
      text: prefix + rule.reason + ' (+' + rule.weight + ')'
    });
  });
}

function applyTimeoutRule(reasons, rule, scores, evidence, prefix) {
  if (!reasons || !reasons.length || !rule) return;
  var n = 0;
  var cap = rule.cap || 99;
  reasons.forEach(function (r) {
    if (n >= cap) return;
    addScore(scores, rule.lean, rule.weight);
    evidence.push({ tag: rule.lean, text: prefix + r + ' (+' + rule.weight + ')' });
    n += 1;
  });
  if (rule.connectionExtra && reasons.length) {
    addScore(scores, 'connection', rule.connectionExtra);
    evidence.push({
      tag: 'connection',
      text: prefix + '通信超时伴随链路疑点 (+' + rule.connectionExtra + ')'
    });
  }
}

/**
 * 对最后一帧 BST/CST/BEM/CEM 做位域加分（可双帧并存）
 */
function scoreStopFrames(framesByCode, scores, evidence) {
  var hasBst = !!framesByCode.BST;
  var hasCst = !!framesByCode.CST;
  var both = hasBst && hasCst;

  if (hasCst && !hasBst) {
    addScore(scores, 'pile', 3);
    evidence.push({ tag: 'pile', text: '出现 CST（桩中止）且未见 BST (+3)' });
  }
  if (hasBst && !hasCst) {
    addScore(scores, 'vehicle', 3);
    evidence.push({ tag: 'vehicle', text: '出现 BST（车中止）且未见 CST (+3)' });
  }
  if (both) {
    evidence.push({ tag: 'neutral', text: 'BST 与 CST 均出现，按位域细判加分' });
  }

  ['BST', 'CST', 'BEM', 'CEM'].forEach(function (code) {
    var fr = framesByCode[code];
    if (!fr) return;
    var raw = fr.metrics && (fr.metrics.stop || fr.metrics.error);
    var decoded = raw;
    if (!decoded && fr.data) {
      if (code === 'BST') decoded = bstCst.decodeBst(fr.data);
      if (code === 'CST') decoded = bstCst.decodeCst(fr.data);
      if (code === 'BEM') decoded = bstCst.decodeBem(fr.data);
      if (code === 'CEM') decoded = bstCst.decodeCem(fr.data);
    }
    if (!decoded) return;

    if (decoded.linkHint) {
      addScore(scores, 'connection', 2);
      evidence.push({ tag: 'connection', text: code + ' 含连接器/绝缘/检测点线索 (+2)' });
    }

    if (code === 'BST') {
      applyReasonRules(decoded.reasons || [], BST_BIT_RULES, scores, evidence, 'BST ');
    } else if (code === 'CST') {
      applyReasonRules(decoded.reasons || [], CST_BIT_RULES, scores, evidence, 'CST ');
    } else if (code === 'BEM') {
      applyTimeoutRule(decoded.reasons || [], BEM_REASON_RULE, scores, evidence, 'BEM ');
      if (!both && !hasCst) {
        if (!decoded.reasons || !decoded.reasons.length) {
          addScore(scores, 'pile', 3);
          addScore(scores, 'connection', 1);
          evidence.push({ tag: 'pile', text: 'BEM 车侧报收桩超时 (+3)' });
        } else {
          addScore(scores, 'pile', 2);
          evidence.push({ tag: 'pile', text: 'BEM 车侧报收桩超时 (+2)' });
        }
      }
    } else if (code === 'CEM') {
      applyTimeoutRule(decoded.reasons || [], CEM_REASON_RULE, scores, evidence, 'CEM ');
      if (!both && !hasBst) {
        if (!decoded.reasons || !decoded.reasons.length) {
          addScore(scores, 'vehicle', 3);
          addScore(scores, 'connection', 1);
          evidence.push({ tag: 'vehicle', text: 'CEM 桩侧报收车超时 (+3)' });
        } else {
          addScore(scores, 'vehicle', 2);
          evidence.push({ tag: 'vehicle', text: 'CEM 桩侧报收车超时 (+2)' });
        }
      }
    }
  });
}

function collectLastStopFrames(parsedFrames) {
  var out = {};
  (parsedFrames || []).forEach(function (f) {
    if (f.code === 'BST' || f.code === 'CST' || f.code === 'BEM' || f.code === 'CEM') {
      out[f.code] = f;
    }
  });
  return out;
}

/**
 * 免费三结论统一映射（分数 + 详细结论 + 停因 一致化）
 */
function resolveFreeVerdict(analysis) {
  var verdict = (analysis && analysis.verdict) || {};
  var scores = (analysis && analysis.scores) || {};
  var stop = analysis && analysis.stopInfo;
  var key = verdict.key || 'insufficient';
  var v = scores.vehicle || 0;
  var p = scores.pile || 0;
  var c = scores.connection || 0;

  if (key === 'connection' || (c >= 3 && c >= v && c >= p)) {
    return packFree('swap', '建议换桩',
      '连接相关证据领先。先查插枪、锁止、CC1/CC2，再换桩对比；详情需会员。');
  }

  if (stop && stop.side === 'link') {
    return packFree('swap', '建议换桩',
      '停因含连接器/绝缘/检测点线索。先排连接，再换桩复核。');
  }

  if (v >= p + 2 && v >= c) {
    return packFree('vehicle', '车端问题',
      '车端相关分领先' + (stop && stop.side === 'vehicle' ? '，停因一致' : '') + '。开通会员查看依据与报文。');
  }
  if (p >= v + 2 && p >= c) {
    return packFree('pile', '桩端问题',
      '桩端相关分领先' + (stop && stop.side === 'pile' ? '，停因一致' : '') + '。开通会员查看依据与报文。');
  }

  if (stop && stop.side === 'vehicle' && (stop.code === 'BST' || stop.code === 'CEM')) {
    return packFree('vehicle', '车端问题',
      '停因偏车（' + stop.code + '）。分数接近时以通信停因为辅；详情需会员。');
  }
  if (stop && stop.side === 'pile' && (stop.code === 'CST' || stop.code === 'BEM')) {
    return packFree('pile', '桩端问题',
      '停因偏桩（' + stop.code + '）。分数接近时以通信停因为辅；详情需会员。');
  }

  if (key === 'vehicle') {
    return packFree('vehicle', '车端问题', '当前倾向车端。开通会员可查看依据、阶段与报文细节。');
  }
  if (key === 'pile') {
    return packFree('pile', '桩端问题', '当前倾向桩端。开通会员可查看依据、阶段与报文细节。');
  }

  if (v > 0 && p > 0 && Math.abs(v - p) <= 2) {
    return packFree('swap', '建议换桩', '车、桩都有可能。先换一把已知正常的桩对比，再决定是否查车。');
  }
  if (key === 'mixed' || key === 'insufficient') {
    return packFree('swap', '建议换桩', '暂不能单边认定。建议先换桩/重插对比；详细分析需开通会员。');
  }

  return packFree('swap', '建议换桩', '证据尚不足以单指车或桩。建议换桩对比；开通会员查看详细依据。');
}

function packFree(key, title, desc) {
  var color = key === 'vehicle' ? '#2F6BFF' : (key === 'pile' ? '#07C160' : '#E67E22');
  return { key: key, title: title, desc: desc, color: color };
}

function getGuideData() {
  return {
    fieldChecklist: FIELD_CHECKLIST,
    observationTable: OBSERVATION_TABLE.map(function (o) {
      return Object.assign({}, o, {
        leanLabel: LEAN_LABEL[o.lean] || o.lean,
        leanColor: LEAN_COLOR[o.lean] || '#888'
      });
    }),
    logPresenceRules: LOG_PRESENCE_RULES,
    bstBitRules: BST_BIT_RULES,
    cstBitRules: CST_BIT_RULES,
    bemRule: BEM_REASON_RULE,
    cemRule: CEM_REASON_RULE,
    verdictThresholds: VERDICT_THRESHOLDS,
    speedRuleTable: SPEED_RULE_TABLE,
    freeVerdictRules: FREE_VERDICT_RULES,
    leanLabel: LEAN_LABEL,
    leanColor: LEAN_COLOR
  };
}

/** 观察项选项（analyze / 首页共用，唯一数据源） */
function getObservationOptions(chargeType) {
  return OBSERVATION_TABLE.filter(function (o) {
    if (o.scope === '通用') return true;
    if (chargeType === 'dc' && o.scope === '直流') return true;
    if (chargeType === 'ac' && o.scope === '交流') return true;
    return false;
  }).map(function (o) {
    return {
      id: o.id,
      label: o.label,
      lean: o.lean,
      weight: o.weight
    };
  });
}

module.exports = {
  FIELD_CHECKLIST: FIELD_CHECKLIST,
  OBSERVATION_TABLE: OBSERVATION_TABLE,
  LOG_PRESENCE_RULES: LOG_PRESENCE_RULES,
  BST_BIT_RULES: BST_BIT_RULES,
  CST_BIT_RULES: CST_BIT_RULES,
  VERDICT_THRESHOLDS: VERDICT_THRESHOLDS,
  SPEED_RULE_TABLE: SPEED_RULE_TABLE,
  FREE_VERDICT_RULES: FREE_VERDICT_RULES,
  scoreStopFrames: scoreStopFrames,
  collectLastStopFrames: collectLastStopFrames,
  resolveFreeVerdict: resolveFreeVerdict,
  getGuideData: getGuideData,
  getObservationOptions: getObservationOptions
};
