/**
 * 车内 CAN（OBD 6/14）直流充电相关 — 跨车型「通用」摘录
 *
 * 说明：
 * - 不是 27930（枪口 S+/S-）。
 * - 「通用」分两层：① 同矩阵共用 ID（江山/齐星）；② 语义清单（各家都有、ID 可能不同）。
 * - 科列上位机能通 ≠ 整车矩阵相同；科列通的是 BMS 私有 PID，本文件是整车 CAN 上能对上的公共部分。
 */

/** A. 江山 + 齐星 共用扩展帧（科列系 PCAN 矩阵同源） */
var KELIE_PCAN_SHARED_IDS = [
  {
    idHex: '0x18FF01A1',
    role: 'VCU→BMS 充电能力/模式请求',
    manufacturers: ['江山', '齐星'],
    signals: [
      'VCU1_BMSStModeReq',
      'VCU1_BMS_MaxDCChargeVoltageLim',
      'VCU1_BMS_DCChargeCurr',
      'VCU1_BMS_DCChargePower',
      'VCU1_BMS_ThermalPowerAllow',
      'VCU1_SysUsefulPower'
    ]
  },
  {
    idHex: '0x18FF21B1',
    role: 'BMS 模式/连接/充电继电器',
    manufacturers: ['江山', '齐星'],
    signals: [
      'BMS1_stMode',
      'BMS1_FaultLevel',
      'BMS1_stCC2',
      'BMS1_HVIL_Sts',
      'BMS1_DCChrgPosRlySts_A',
      'BMS1_DCChrgNegRlySts_A',
      'BMS1_InsulationIntrErr',
      'BMS1_InsulationHVLoadErr',
      'BMS1_BattVoltage',
      'BMS1_BattCurrent'
    ]
  },
  {
    idHex: '0x18FF27B7',
    role: 'BMS 故障位',
    manufacturers: ['江山', '齐星'],
    signals: [
      'BMS9_Cell_OverVolt',
      'BMS9_Cell_UnderVolt',
      'BMS9_TotalVolt_Over',
      'BMS9_TotalVolt_Under',
      'BMS9_CC2_Err',
      'BMS9_HVIL_Sig_Err'
    ]
  }
];

/** 江山常见、齐星未必同名的扩展（同家族，优先采） */
var KELIE_PCAN_JIANGSHAN_EXTRA = [
  {
    idHex: '0x18FF23B3',
    role: 'BMS 直流需求 + SOC',
    signals: ['BMS3_DCChrgCurr_Req', 'BMS3_DCChrgVolt_Req', 'BMS3_SOC', 'BMS3_ChrgTim_Remain']
  },
  {
    idHex: '0x18FF24B4',
    role: '绝缘电阻 / SOC 边界',
    signals: ['BMS4_Isolation_Resistance', 'BMS4_MaxSOC', 'BMS4_MinSOC']
  }
];

/**
 * B. 语义通用清单（OBD 上看直流充，先盯这些含义；ID 随车型变）
 * 现场判读顺序建议：连接 → 允许/需求 → 继电器 → SOC/绝缘 → 故障
 */
var SEMANTIC_COMMON = [
  { key: 'cc2', label: 'CC2 连接确认', why: '未识别则高压充不起来', examples: ['BMS1_stCC2', 'BMS4_ChrOFFCC2', 'BMS9_CC2_Err'] },
  { key: 'hvil', label: '高压互锁 HVIL', why: '互锁断则禁止充', examples: ['BMS1_HVIL_Sts', 'VEHILCLE_CHGHVINTERLOCK_FAULT'] },
  { key: 'mode', label: 'BMS/VCU 工作模式', why: '是否进入充电模式', examples: ['BMS1_stMode', 'VCU1_BMSStModeReq', 'BMS4_CharState'] },
  { key: 'v_lim', label: '直流电压上限/需求', why: 'VCU 允许或 BMS 请求电压', examples: ['VCU1_BMS_MaxDCChargeVoltageLim', 'BMS3_DCChrgVolt_Req'] },
  { key: 'i_req', label: '直流电流/功率需求', why: '有需求才像在要电', examples: ['BMS3_DCChrgCurr_Req', 'VCU1_BMS_DCChargeCurr', 'VCU1_BMS_DCChargePower'] },
  { key: 'dc_rly', label: '快充正负继电器', why: '请求有、继电器不开=卡在车端', examples: ['BMS1_DCChrgPosRlySts_A', 'BMS1_DCChrgNegRlySts_A'] },
  { key: 'main_rly', label: '主正/主负继电器', why: '主回路未合无电流', examples: ['BMS1_NegRlySts', 'BMS4_PosRlyState', 'MainPositiveRelay_adhesion'] },
  { key: 'soc', label: 'SOC', why: '状态观察', examples: ['BMS3_SOC', 'Vehicle_SOC'] },
  { key: 'iso', label: '绝缘', why: '绝缘差会禁充', examples: ['BMS4_Isolation_Resistance', 'BMS_IsoRVal', 'BMS38_IsoRVal'] },
  { key: 'fault', label: '故障等级/停止', why: '故障等级高直接抑制充电', examples: ['BMS1_FaultLevel', 'BMS9_*', 'BMS7_*'] }
];

/** C. 奇瑞/天鑫 标准帧共用（另一套 ID 空间，非 18FFxxxx） */
var CHERY_STD_SHARED_IDS = [
  { idHex: '0x46F', role: 'BMS 故障汇总', manufacturers: ['天鑫Q22', '奇瑞5021', '奇瑞6460'] },
  { idHex: '0x471', role: 'OBC/CM 交流侧故障', manufacturers: ['天鑫Q22', '奇瑞5021', '奇瑞6460'] },
  { idHex: '0x55A', role: 'BMS 告警位', manufacturers: ['奇瑞5021', '奇瑞6460'] },
  { idHex: '0x46C', role: '绝缘/单体极值', manufacturers: ['奇瑞5021', '奇瑞6460'] },
  { idHex: '0x564', role: '绝缘电阻值', manufacturers: ['天鑫Q22'] },
  { idHex: '0x46B', role: '总压总电流/SOH', manufacturers: ['天鑫Q22'] }
];

/** 识别时优先匹配的 ID 集合（OBD 6/14 先认这些） */
function commonWatchIds() {
  var ids = {};
  KELIE_PCAN_SHARED_IDS.forEach(function (e) { ids[e.idHex.toLowerCase()] = e; });
  KELIE_PCAN_JIANGSHAN_EXTRA.forEach(function (e) { ids[e.idHex.toLowerCase()] = e; });
  CHERY_STD_SHARED_IDS.forEach(function (e) { ids[e.idHex.toLowerCase()] = e; });
  return ids;
}

function familyOfId(idHex) {
  var h = String(idHex || '').toLowerCase();
  if (!h.startsWith('0x')) h = '0x' + h;
  var kelie = KELIE_PCAN_SHARED_IDS.concat(KELIE_PCAN_JIANGSHAN_EXTRA);
  for (var i = 0; i < kelie.length; i++) {
    if (kelie[i].idHex.toLowerCase() === h) return 'kelie_pcan';
  }
  for (var j = 0; j < CHERY_STD_SHARED_IDS.length; j++) {
    if (CHERY_STD_SHARED_IDS[j].idHex.toLowerCase() === h) return 'chery_std';
  }
  return null;
}

module.exports = {
  KELIE_PCAN_SHARED_IDS: KELIE_PCAN_SHARED_IDS,
  KELIE_PCAN_JIANGSHAN_EXTRA: KELIE_PCAN_JIANGSHAN_EXTRA,
  SEMANTIC_COMMON: SEMANTIC_COMMON,
  CHERY_STD_SHARED_IDS: CHERY_STD_SHARED_IDS,
  commonWatchIds: commonWatchIds,
  familyOfId: familyOfId
};
