/**
 * GB/T 27930 (2015 为主) CAN 帧解析 / TP 重组 / 报文库
 * 电流：0.1A 分辨率，偏移 -400A；UI 展示用幅值 |I|
 * 绝缘：仅 BSM 状态位，不编造 kΩ
 */

var bstCst = require('./bst_cst.js');
var dcIdCatalog = require('./dc_id_catalog.js');

var SA_CHARGER = 0x56;
var SA_VEHICLE = { 0xF4: true, 0xF5: true };

var BATTERY_TYPES = {
  0x01: '铅酸电池',
  0x02: '镍氢电池',
  0x03: '磷酸铁锂电池',
  0x04: '锰酸锂电池',
  0x05: '钴酸锂电池',
  0x06: '三元材料电池',
  0x07: '聚合物锂电池',
  0x08: '钛酸锂电池',
  0xFF: '其他电池'
};

var PF_MAP = {
  0x26: 'CHM',
  0x27: 'BHM',
  0x01: 'CRM',
  0x02: 'BRM',
  0x06: 'BCP',
  0x07: 'CTS',
  0x08: 'CML',
  0x09: 'BRO',
  0x0A: 'CRO',
  0x10: 'BCL',
  0x11: 'BCS',
  0x12: 'CCS',
  0x13: 'BSM',
  0x15: 'BMV',
  0x16: 'BMT',
  0x17: 'BSP',
  0x19: 'BST',
  0x1A: 'CST',
  0x1C: 'BSD',
  0x1D: 'CSD',
  0x1E: 'BEM',
  0x1F: 'CEM',
  0xEB: 'TP.DT',
  0xEC: 'TP.CM'
};

var STAGE_OF = {
  CHM: '握手', BHM: '握手',
  CRM: '辨识', BRM: '辨识',
  BCP: '参数', CML: '参数', CTS: '参数',
  BRO: '就绪', CRO: '就绪',
  BCL: '充电', BCS: '充电', CCS: '充电', BSM: '充电', BMV: '充电', BMT: '充电', BSP: '充电',
  BST: '中止', CST: '中止',
  BSD: '统计', CSD: '统计',
  BEM: '错误', CEM: '错误',
  'TP.CM': '传输', 'TP.DT': '传输'
};

var CATALOG = [
  { code: 'CHM', name: '充电机握手', stage: '握手', pgn: '0x2600', dlc: 3, period: '250ms', direction: '桩→车',
    desc: '充电机发送通信协议版本号，启动握手。',
    fields: [
      { name: '协议版本', bytes: '1-3', note: '如 01 01 00 表示 V1.1' }
    ],
    exampleId: '1826F456', exampleData: '01 01 00' },
  { code: 'BHM', name: '车辆握手', stage: '握手', pgn: '0x2700', dlc: 2, period: '250ms', direction: '车→桩',
    desc: 'BMS 发送车辆最高允许充电总电压。',
    fields: [
      { name: '最高允许充电总电压', bytes: '1-2', note: '0.1V/bit，0~1000V' }
    ],
    exampleId: '182756F4', exampleData: '3C 0A' },
  { code: 'CRM', name: '充电机辨识', stage: '辨识', pgn: '0x0100', dlc: 8, period: '250ms', direction: '桩→车',
    desc: '充电机辨识结果与充电机编号。',
    fields: [
      { name: '辨识结果', bytes: '1', note: '0x00 不能辨识；0xAA 能辨识' },
      { name: '充电机编号', bytes: '2-4', note: '充电机唯一编号' },
      { name: '区域编码', bytes: '5-8', note: '地区代码等' }
    ],
    exampleId: '1801F456', exampleData: 'AA 01 02 03 31 32 33 34' },
  { code: 'BRM', name: '车辆辨识', stage: '辨识', pgn: '0x0200', dlc: 49, period: '250ms', direction: '车→桩',
    desc: '多帧：电池类型、容量、制造商、VIN 等。需 TP 重组。',
    fields: [
      { name: 'BMS 协议版本', bytes: '1', note: '' },
      { name: '电池类型', bytes: '2', note: '见国标枚举' },
      { name: '整车动力蓄电池系统额定容量', bytes: '3-4', note: '0.1Ah/bit' },
      { name: '整车动力蓄电池系统额定总电压', bytes: '5-6', note: '0.1V/bit' },
      { name: '电池生产厂商名', bytes: '7-10', note: 'ASCII' },
      { name: 'VIN', bytes: '25-41', note: '17 字节' }
    ],
    exampleId: '1CEC56F4', exampleData: '（见 TP 示例）' },
  { code: 'BCP', name: '动力蓄电池充电参数', stage: '参数', pgn: '0x0600', dlc: 13, period: '500ms', direction: '车→桩',
    desc: '多帧：车辆充电参数（最高允许单体电压、电流、SOC 等）。',
    fields: [
      { name: '单体动力蓄电池最高允许充电电压', bytes: '1-2', note: '0.01V/bit' },
      { name: '最高允许充电电流', bytes: '3-4', note: '0.1A/bit，偏移 -400A' },
      { name: '动力蓄电池标称总能量', bytes: '5-6', note: '0.1kWh/bit' },
      { name: '最高允许充电总电压', bytes: '7-8', note: '0.1V/bit' },
      { name: '最高允许温度', bytes: '9', note: '1℃/bit，偏移 -50℃' },
      { name: '整车动力蓄电池荷电状态', bytes: '10-11', note: '0.1%/bit' },
      { name: '整车动力蓄电池当前电池电压', bytes: '12-13', note: '0.1V/bit' }
    ],
    exampleId: '1CEC56F4', exampleData: '（TP）' },
  { code: 'CTS', name: '充电机发送时间同步', stage: '参数', pgn: '0x0700', dlc: 7, period: '500ms', direction: '桩→车',
    desc: '充电机时间同步信息。',
    fields: [
      { name: '年月日时分秒', bytes: '1-7', note: '压缩 BCD / 国标约定' }
    ],
    exampleId: '1807F456', exampleData: '25 07 01 12 00 00 00' },
  { code: 'CML', name: '充电机最大输出能力', stage: '参数', pgn: '0x0800', dlc: 8, period: '250ms', direction: '桩→车',
    desc: '充电机最大/最小输出电压与电流能力。',
    fields: [
      { name: '最大输出电压', bytes: '1-2', note: '0.1V/bit' },
      { name: '最小输出电压', bytes: '3-4', note: '0.1V/bit' },
      { name: '最大输出电流', bytes: '5-6', note: '0.1A/bit，偏移 -400A' },
      { name: '最小输出电流', bytes: '7-8', note: '0.1A/bit，偏移 -400A' }
    ],
    exampleId: '1808F456', exampleData: 'E8 0D 20 03 60 09 60 0D' },
  { code: 'BRO', name: '车辆就绪', stage: '就绪', pgn: '0x0900', dlc: 1, period: '250ms', direction: '车→桩',
    desc: 'BMS 是否充电准备就绪。',
    fields: [
      { name: '就绪标志', bytes: '1', note: '0x00 未就绪；0xAA 就绪' }
    ],
    exampleId: '100956F4', exampleData: 'AA' },
  { code: 'CRO', name: '充电机就绪', stage: '就绪', pgn: '0x0A00', dlc: 1, period: '250ms', direction: '桩→车',
    desc: '充电机是否充电准备就绪。双方就绪后才允许大电流。',
    fields: [
      { name: '就绪标志', bytes: '1', note: '0x00 未就绪；0xAA 就绪' }
    ],
    exampleId: '100AF456', exampleData: 'AA' },
  { code: 'BCL', name: '电池充电需求', stage: '充电', pgn: '0x1000', dlc: 5, period: '50ms', direction: '车→桩',
    desc: 'BMS 电压/电流需求与充电模式。',
    fields: [
      { name: '电压需求', bytes: '1-2', note: '0.1V/bit' },
      { name: '电流需求', bytes: '3-4', note: '0.1A/bit，偏移 -400A；充电多为负值' },
      { name: '充电模式', bytes: '5', note: '0x01 恒压；0x02 恒流' }
    ],
    exampleId: '181056F4', exampleData: '4C 1D B8 0B 02' },
  { code: 'BCS', name: '电池充电总状态', stage: '充电', pgn: '0x1100', dlc: 9, period: '250ms', direction: '车→桩',
    desc: '多帧：测量电压电流、最高单体、SOC、剩余时间。',
    fields: [
      { name: '充电电压测量值', bytes: '1-2', note: '0.1V/bit' },
      { name: '充电电流测量值', bytes: '3-4', note: '0.1A/bit，偏移 -400A' },
      { name: '最高单体动力蓄电池电压及组号', bytes: '5-6', note: '' },
      { name: 'SOC', bytes: '7', note: '1%/bit，0~100' },
      { name: '估算剩余充电时间', bytes: '8-9', note: '1min/bit' }
    ],
    exampleId: '1CEC56F4', exampleData: '（TP）' },
  { code: 'CCS', name: '充电机充电状态', stage: '充电', pgn: '0x1200', dlc: 7, period: '50ms', direction: '桩→车',
    desc: '充电机实际输出电压/电流、累计时间、充电允许。',
    fields: [
      { name: '电压输出值', bytes: '1-2', note: '0.1V/bit' },
      { name: '电流输出值', bytes: '3-4', note: '0.1A/bit，偏移 -400A' },
      { name: '累计充电时间', bytes: '5-6', note: '1min/bit' },
      { name: '充电允许', bytes: '7', note: 'bit0：0 暂停；1 允许' }
    ],
    exampleId: '1812F456', exampleData: '4C 1D B8 0B 05 00 01' },
  { code: 'BSM', name: '动力蓄电池状态信息', stage: '充电', pgn: '0x1300', dlc: 7, period: '250ms', direction: '车→桩',
    desc: '含绝缘状态等位域。报文通常只有状态，无 kΩ 数值。',
    fields: [
      { name: '最高单体动力蓄电池电压所在编号', bytes: '1', note: '' },
      { name: '最高动力蓄电池温度', bytes: '2', note: '1℃/bit，偏移 -50℃' },
      { name: '最高温度检测点编号', bytes: '3', note: '' },
      { name: '最低动力蓄电池温度', bytes: '4', note: '1℃/bit，偏移 -50℃' },
      { name: '最低温度检测点编号', bytes: '5', note: '' },
      { name: '状态位域', bytes: '6-7', note: '含绝缘正常/异常等' }
    ],
    exampleId: '181356F4', exampleData: '01 78 01 5A 02 00 00' },
  { code: 'BST', name: '车辆中止充电', stage: '中止', pgn: '0x1900', dlc: 4, period: '10ms', direction: '车→桩',
    desc: 'BMS 中止充电原因位域。',
    fields: [
      { name: '中止原因字节', bytes: '1-4', note: '见 BST 位域表' }
    ],
    exampleId: '101956F4', exampleData: '01 00 00 00' },
  { code: 'CST', name: '充电机中止充电', stage: '中止', pgn: '0x1A00', dlc: 4, period: '10ms', direction: '桩→车',
    desc: '充电机中止充电原因位域。',
    fields: [
      { name: '中止原因字节', bytes: '1-4', note: '见 CST 位域表' }
    ],
    exampleId: '101AF456', exampleData: '04 00 00 00' },
  { code: 'BSD', name: '车辆统计数据', stage: '统计', pgn: '0x1C00', dlc: 7, period: '250ms', direction: '车→桩',
    desc: '中止时 SOC、电池最低/最高电压与温度等。',
    fields: [
      { name: '中止荷电状态 SOC', bytes: '1', note: '1%/bit' },
      { name: '动力蓄电池单体最低电压', bytes: '2-3', note: '0.01V/bit' },
      { name: '动力蓄电池单体最高电压', bytes: '4-5', note: '0.01V/bit' },
      { name: '动力蓄电池最低温度', bytes: '6', note: '1℃/bit，偏移 -50℃' },
      { name: '动力蓄电池最高温度', bytes: '7', note: '1℃/bit，偏移 -50℃' }
    ],
    exampleId: '181C56F4', exampleData: '50 DC 00 E8 00 5A 78' },
  { code: 'CSD', name: '充电机统计数据', stage: '统计', pgn: '0x1D00', dlc: 8, period: '250ms', direction: '桩→车',
    desc: '累计充电时间、输出能量、充电机编号。',
    fields: [
      { name: '累计充电时间', bytes: '1-2', note: '1min/bit' },
      { name: '输出能量', bytes: '3-4', note: '0.1kWh/bit' },
      { name: '充电机编号', bytes: '5-8', note: '' }
    ],
    exampleId: '181DF456', exampleData: '0A 00 1E 00 01 02 03 04' },
  { code: 'BEM', name: '车辆错误报文', stage: '错误', pgn: '0x1E00', dlc: 4, period: '250ms', direction: '车→桩',
    desc: 'BMS 通信超时等错误位域。',
    fields: [
      { name: '错误位域', bytes: '1-4', note: '接收超时等' }
    ],
    exampleId: '081E56F4', exampleData: '01 00 00 00' },
  { code: 'CEM', name: '充电机错误报文', stage: '错误', pgn: '0x1F00', dlc: 4, period: '250ms', direction: '桩→车',
    desc: '充电机通信超时等错误位域。',
    fields: [
      { name: '错误位域', bytes: '1-4', note: '接收超时等' }
    ],
    exampleId: '081FF456', exampleData: '01 00 00 00' },
  { code: 'TP.CM', name: '连接管理', stage: '传输', pgn: '0xEC00', dlc: 8, period: '—', direction: '双方',
    desc: 'J1939 传输协议连接管理（RTS/CTS/EndOfMsg/Abort）。',
    fields: [
      { name: '控制字节', bytes: '1', note: '16=RTS, 17=CTS, 19=End, 255=Abort' },
      { name: '总字节数/包数', bytes: '2-5', note: '' },
      { name: '保留/下一包号', bytes: '6', note: '' },
      { name: 'PGN', bytes: '6-8 或 7-8', note: '小端 PGN' }
    ],
    exampleId: '1CEC56F4', exampleData: '10 31 00 07 FF 00 00 02' },
  { code: 'TP.DT', name: '数据传输', stage: '传输', pgn: '0xEB00', dlc: 8, period: '—', direction: '双方',
    desc: '多帧数据载荷，需与 TP.CM 重组为应用层报文。',
    fields: [
      { name: '序号', bytes: '1', note: '1 起' },
      { name: '数据', bytes: '2-8', note: '每包最多 7 字节' }
    ],
    exampleId: '1CEB56F4', exampleData: '01 ...' }
];

function u16le(b, i) {
  return (b[i] | (b[i + 1] << 8)) & 0xffff;
}

function currentPhysical(rawU16) {
  return rawU16 * 0.1 - 400;
}

function formatCurrentUi(rawOrPhysical) {
  var physical = typeof rawOrPhysical === 'number' ? rawOrPhysical : 0;
  return Math.abs(physical);
}

function voltage01(rawU16) {
  return rawU16 * 0.1;
}

function parseCanId(id) {
  var n = typeof id === 'number' ? id : parseInt(String(id).replace(/^0x/i, ''), 16);
  if (!isFinite(n)) return null;
  var sa = n & 0xff;
  var ps = (n >> 8) & 0xff;
  var pf = (n >> 16) & 0xff;
  var dp = (n >> 24) & 0x01;
  var r = (n >> 25) & 0x01;
  var priority = (n >> 26) & 0x07;
  var pgn;
  if (pf < 240) {
    pgn = (dp << 16) | (pf << 8);
  } else {
    pgn = (dp << 16) | (pf << 8) | ps;
  }
  var side = 'unknown';
  if (sa === SA_CHARGER) side = 'pile';
  else if (SA_VEHICLE[sa]) side = 'vehicle';
  return {
    id: n,
    idHex: ('00000000' + n.toString(16).toUpperCase()).slice(-8),
    priority: priority,
    r: r,
    dp: dp,
    pf: pf,
    ps: ps,
    da: pf < 240 ? ps : null,
    sa: sa,
    pgn: pgn,
    pgnHex: ('0000' + pgn.toString(16).toUpperCase()).slice(-4),
    side: side
  };
}

function classifyPgn(idOrInfo) {
  var info = typeof idOrInfo === 'object' ? idOrInfo : parseCanId(idOrInfo);
  if (!info) return { code: 'UNK', stage: '未知', manufacturer: '未识别厂家' };
  var code = PF_MAP[info.pf] || 'UNK';
  var identified = dcIdCatalog.identifyFrame(info.id, info.pf, code !== 'UNK' ? code : '');
  // 车内直流 ID 优先用目录代号（若非国标 PF）
  if (code === 'UNK' && identified.entries && identified.entries.length) {
    var veh = identified.entries.filter(function (e) { return e.kind === 'vehicle_dc'; })[0];
    if (veh) code = veh.code || code;
  }
  return {
    code: code !== 'UNK' ? code : (identified.code || 'UNK'),
    stage: STAGE_OF[code] || (identified.isGbt27930 ? '国标充电' : (identified.entries[0] && identified.entries[0].stage) || '未知'),
    pf: info.pf,
    manufacturers: identified.manufacturers,
    manufacturerText: identified.manufacturerText,
    manufacturerLabels: identified.labels,
    labelText: identified.labelText,
    isGbt27930: identified.isGbt27930,
    catalogEntries: identified.entries
  };
}

function bytesToHex(bytes) {
  return bytes.map(function (b) {
    return ('0' + (b & 0xff).toString(16).toUpperCase()).slice(-2);
  }).join(' ');
}

function parseHexBytes(parts) {
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{1,2}$/.test(p)) continue;
    out.push(parseInt(p, 16));
  }
  return out;
}

/**
 * 解析一行 CAN 日志，兼容:
 * 1826F456 01 01 00
 * 0x181056F4 4C 1D B8 0B 02
 * 12:34:56.789 1826F456 01 01 00
 * PCAN/CANoe 风格（尽力）
 */
function parseLogLine(line, lineIndex) {
  if (!line) return null;
  var raw = String(line).replace(/^\uFEFF/, '').trim();
  if (!raw || raw[0] === '#' || raw[0] === ';') return null;

  var tMs = null;
  var timeMatch = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\s+/);
  if (timeMatch) {
    var hh = parseInt(timeMatch[1], 10);
    var mm = parseInt(timeMatch[2], 10);
    var ss = parseInt(timeMatch[3], 10);
    var ms = timeMatch[4] ? parseInt((timeMatch[4] + '000').slice(0, 3), 10) : 0;
    tMs = ((hh * 3600 + mm * 60 + ss) * 1000) + ms;
    raw = raw.slice(timeMatch[0].length).trim();
  } else {
    var absMatch = raw.match(/^(\d{4}-\d{2}-\d{2}[ T])?(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\s+/);
    if (absMatch) {
      var hh2 = parseInt(absMatch[2], 10);
      var mm2 = parseInt(absMatch[3], 10);
      var ss2 = parseInt(absMatch[4], 10);
      var ms2 = absMatch[5] ? parseInt((absMatch[5] + '000').slice(0, 3), 10) : 0;
      tMs = ((hh2 * 3600 + mm2 * 60 + ss2) * 1000) + ms2;
      raw = raw.slice(absMatch[0].length).trim();
    } else {
      var floatTs = raw.match(/^(\d+\.\d+)\s+/);
      if (floatTs) {
        tMs = Math.round(parseFloat(floatTs[1]) * 1000);
        raw = raw.slice(floatTs[0].length).trim();
      } else {
      var numTs = raw.match(/^(\d+(?:\.\d+)?)\s+/);
      if (numTs && !/^[0-9A-Fa-fx]+$/i.test(numTs[1]) === false) {
        // keep generic numeric prefix as relative ms if looks like timestamp
      }
      var rel = raw.match(/^(\d{4,})(?:\.(\d+))?\s+(?:0x)?([0-9A-Fa-f]{3,8})\b/);
      if (rel) {
        tMs = parseInt(rel[1], 10);
        if (rel[2]) tMs += parseInt((rel[2] + '000').slice(0, 3), 10) / 1000 < 1 ? 0 : 0;
      }
      }
    }
  }

  // 显式 DLC 标记（避免把数据字节 01 误当成 DLC）
  var dlcMarked = raw.match(/^(?:ID\s*[:=]?\s*)?(?:0x)?([0-9A-Fa-f]{3,8})\b\s*(?:(?:DLC|dx|d)\s*[:=]?\s*(\d{1,2}))\s*(?:(?:Data|data)\s*[:=]?)?\s*(.*)$/i);
  var idStr;
  var rest;
  if (dlcMarked) {
    idStr = dlcMarked[1];
    rest = (dlcMarked[3] || '').trim();
  } else {
    // 常见：ID + hex bytes；或 ID: ... Data: ...
    var simple = raw.match(/^(?:ID\s*[:=]?\s*)?(?:0x)?([0-9A-Fa-f]{3,8})\b(?:\s*(?:Data|data)\s*[:=]\s*)?(.*)$/i);
    if (!simple) return null;
    idStr = simple[1];
    rest = (simple[2] || '').trim();
    // CANoe 风格：ID 后单独十进制 DLC（1位或不带前导0的2位），其后为数据
    // 例: "1826F456 3 01 01 00" — 不匹配 "01" 这类数据字节
    var dlcGuess = rest.match(/^([1-8])\s+([0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2})*)$/i);
    if (dlcGuess) rest = dlcGuess[2];
  }
  var dataParts = rest.split(/[\s,]+/).filter(Boolean);
  var data = parseHexBytes(dataParts);
  var idInfo = parseCanId(idStr);
  if (!idInfo) return null;
  var cls = classifyPgn(idInfo);
  return {
    lineIndex: lineIndex,
    rawLine: line,
    tMs: tMs,
    id: idInfo.id,
    idHex: idInfo.idHex,
    idInfo: idInfo,
    data: data,
    dataHex: bytesToHex(data),
    dlc: data.length,
    code: cls.code,
    stage: cls.stage,
    side: idInfo.side,
    isTp: cls.code === 'TP.CM' || cls.code === 'TP.DT',
    reassembled: false
  };
}

function decodeInsulation(statusByte) {
  // BSM byte7 bit0-1: 00 normal, 01 abnormal, 10 untrustworthy
  var v = statusByte & 0x03;
  if (v === 0) return { state: 'normal', label: '正常', height: 1 };
  if (v === 1) return { state: 'abnormal', label: '异常', height: 0 };
  if (v === 2) return { state: 'untrusted', label: '不可信', height: 0.5 };
  return { state: 'unknown', label: '未解析', height: 0.5 };
}

function field(name, value, unit, note) {
  return { name: name, value: value, unit: unit || '', note: note || '' };
}

function decodePayload(code, data, meta) {
  var fields = [];
  var summary = '';
  var metrics = {};
  var d = data || [];

  try {
    switch (code) {
      case 'CHM':
        if (d.length >= 3) {
          var ver = d[0] + '.' + d[1] + '.' + d[2];
          fields.push(field('协议版本', ver));
          summary = '协议版本 V' + ver;
          metrics.protocolVersion = ver;
        }
        break;
      case 'BHM':
        if (d.length >= 2) {
          var vmax = voltage01(u16le(d, 0));
          fields.push(field('车辆最高允许充电总电压', vmax.toFixed(1), 'V'));
          summary = '车上限 ' + vmax.toFixed(1) + 'V';
          metrics.vehicleMaxVoltage = vmax;
        }
        break;
      case 'CRM': {
        if (d.length >= 1) {
          var rec = d[0];
          var recLabel = rec === 0xAA ? '能辨识' : (rec === 0x00 ? '不能辨识' : '未解析(0x' + rec.toString(16) + ')');
          fields.push(field('辨识结果', recLabel));
          metrics.crmResult = rec;
        }
        if (d.length >= 4) {
          var pileNo = d[1] | (d[2] << 8) | (d[3] << 16);
          fields.push(field('充电机编号', String(pileNo)));
          metrics.pileId = String(pileNo);
          summary = '桩ID ' + pileNo + (d[0] === 0xAA ? '（已辨识）' : '');
        }
        if (d.length >= 8) {
          var region = String.fromCharCode(d[4], d[5], d[6], d[7]).replace(/\0/g, '');
          fields.push(field('区域编码', region || bytesToHex(d.slice(4, 8))));
        }
        break;
      }
      case 'BRM': {
        if (d.length >= 1) fields.push(field('BMS协议版本', String(d[0])));
        if (d.length >= 2) {
          var bt = BATTERY_TYPES[d[1]] || ('未解析(0x' + d[1].toString(16) + ')');
          fields.push(field('电池类型', bt));
          metrics.batteryType = bt;
          metrics.batteryTypeCode = d[1];
          summary = bt;
        }
        if (d.length >= 4) {
          var cap = u16le(d, 2) * 0.1;
          fields.push(field('额定容量', cap.toFixed(1), 'Ah'));
          metrics.ratedCapacityAh = cap;
        }
        if (d.length >= 6) {
          var rv = voltage01(u16le(d, 4));
          fields.push(field('额定总电压', rv.toFixed(1), 'V'));
          metrics.ratedVoltage = rv;
        }
        if (d.length >= 10) {
          var mfr = '';
          for (var mi = 6; mi < 10; mi++) mfr += (d[mi] >= 32 && d[mi] < 127) ? String.fromCharCode(d[mi]) : '.';
          fields.push(field('制造商', mfr.trim()));
          metrics.manufacturer = mfr.trim();
        }
        if (d.length >= 41) {
          var vin = '';
          for (var vi = 24; vi < 41; vi++) {
            var ch = d[vi];
            if (ch >= 32 && ch < 127) vin += String.fromCharCode(ch);
          }
          vin = vin.replace(/\./g, '').trim();
          if (vin) {
            fields.push(field('VIN', vin));
            metrics.vin = vin;
            summary = (summary ? summary + ' / ' : '') + 'VIN ' + vin;
          }
        } else if (d.length > 0 && d.length < 41) {
          fields.push(field('VIN', '待识别(需完整 BRM)', '', '当前重组长度 ' + d.length + ' < 41'));
        }
        break;
      }
      case 'BCP': {
        if (d.length >= 2) fields.push(field('最高允许单体电压', (u16le(d, 0) * 0.01).toFixed(2), 'V'));
        if (d.length >= 4) {
          var bcpI = currentPhysical(u16le(d, 2));
          fields.push(field('最高允许充电电流', bcpI.toFixed(1), 'A'));
          fields.push(field('电流幅值|I|', formatCurrentUi(bcpI).toFixed(1), 'A', 'UI展示用'));
          metrics.maxChargeCurrent = bcpI;
        }
        if (d.length >= 6) fields.push(field('标称总能量', (u16le(d, 4) * 0.1).toFixed(1), 'kWh'));
        if (d.length >= 8) {
          var bcpV = voltage01(u16le(d, 6));
          fields.push(field('最高允许充电总电压', bcpV.toFixed(1), 'V'));
          metrics.vehicleMaxVoltage = bcpV;
        }
        if (d.length >= 9) fields.push(field('最高允许温度', (d[8] - 50) + '', '℃'));
        if (d.length >= 11) {
          var soc01 = u16le(d, 9) * 0.1;
          fields.push(field('SOC', soc01.toFixed(1), '%'));
          metrics.soc = soc01;
        }
        if (d.length >= 13) fields.push(field('当前电池总电压', voltage01(u16le(d, 11)).toFixed(1), 'V'));
        summary = metrics.soc != null ? ('SOC ' + metrics.soc.toFixed(1) + '%') : 'BCP 参数';
        break;
      }
      case 'CML': {
        if (d.length >= 2) {
          metrics.pileMaxVoltage = voltage01(u16le(d, 0));
          fields.push(field('最大输出电压', metrics.pileMaxVoltage.toFixed(1), 'V'));
        }
        if (d.length >= 4) fields.push(field('最小输出电压', voltage01(u16le(d, 2)).toFixed(1), 'V'));
        if (d.length >= 6) {
          var cmlI = currentPhysical(u16le(d, 4));
          metrics.pileMaxCurrent = cmlI;
          fields.push(field('最大输出电流', cmlI.toFixed(1), 'A'));
          fields.push(field('电流幅值|I|', formatCurrentUi(cmlI).toFixed(1), 'A'));
        }
        if (d.length >= 8) {
          var cmlMinI = currentPhysical(u16le(d, 6));
          fields.push(field('最小输出电流', cmlMinI.toFixed(1), 'A'));
        }
        summary = '桩能力 ' + (metrics.pileMaxVoltage != null ? metrics.pileMaxVoltage.toFixed(0) + 'V' : '') +
          (metrics.pileMaxCurrent != null ? (' / |I| ' + formatCurrentUi(metrics.pileMaxCurrent).toFixed(0) + 'A') : '');
        break;
      }
      case 'CTS':
        if (d.length >= 6) {
          fields.push(field('时间同步原始', bytesToHex(d.slice(0, Math.min(7, d.length))), '', '按国标压缩BCD解释，不确定则保留raw'));
          summary = 'CTS 时间同步';
        }
        break;
      case 'BRO':
      case 'CRO': {
        var ready = d.length >= 1 ? d[0] : null;
        var readyLabel = ready === 0xAA ? '就绪' : (ready === 0x00 ? '未就绪' : '未解析');
        fields.push(field('就绪状态', readyLabel, '', '0x' + (ready != null ? ready.toString(16) : '--')));
        metrics.ready = ready === 0xAA;
        summary = code + ' ' + readyLabel;
        break;
      }
      case 'BCL': {
        if (d.length >= 2) {
          metrics.reqVoltage = voltage01(u16le(d, 0));
          fields.push(field('电压需求', metrics.reqVoltage.toFixed(1), 'V'));
        }
        if (d.length >= 4) {
          metrics.reqCurrent = currentPhysical(u16le(d, 2));
          fields.push(field('电流需求', metrics.reqCurrent.toFixed(1), 'A'));
          fields.push(field('电流幅值|I|', formatCurrentUi(metrics.reqCurrent).toFixed(1), 'A', 'UI曲线用幅值'));
        }
        if (d.length >= 5) {
          var mode = d[4] === 0x01 ? '恒压' : (d[4] === 0x02 ? '恒流' : '未解析');
          fields.push(field('充电模式', mode));
          metrics.chargeMode = mode;
        }
        summary = '需求 ' + (metrics.reqVoltage != null ? metrics.reqVoltage.toFixed(1) + 'V' : '') +
          ' / |I| ' + (metrics.reqCurrent != null ? formatCurrentUi(metrics.reqCurrent).toFixed(1) + 'A' : '');
        break;
      }
      case 'BCS': {
        if (d.length >= 2) fields.push(field('充电电压测量值', voltage01(u16le(d, 0)).toFixed(1), 'V'));
        if (d.length >= 4) {
          metrics.measCurrent = currentPhysical(u16le(d, 2));
          fields.push(field('充电电流测量值', metrics.measCurrent.toFixed(1), 'A'));
          fields.push(field('电流幅值|I|', formatCurrentUi(metrics.measCurrent).toFixed(1), 'A'));
        }
        if (d.length >= 6) {
          var cellRaw = u16le(d, 4);
          var cellV = (cellRaw & 0x0fff) * 0.01;
          var cellGrp = (cellRaw >> 12) & 0x0f;
          metrics.maxCellVoltage = cellV;
          metrics.maxCellGroup = cellGrp;
          fields.push(field('最高单体电压', cellV.toFixed(2), 'V', '组号 ' + cellGrp));
        }
        if (d.length >= 7) {
          metrics.soc = d[6];
          fields.push(field('SOC', String(d[6]), '%'));
        }
        if (d.length >= 9) fields.push(field('剩余充电时间', String(u16le(d, 7)), 'min'));
        summary = metrics.soc != null ? ('SOC ' + metrics.soc + '%') : 'BCS';
        break;
      }
      case 'CCS': {
        if (d.length >= 2) {
          metrics.outVoltage = voltage01(u16le(d, 0));
          fields.push(field('电压输出值', metrics.outVoltage.toFixed(1), 'V'));
        }
        if (d.length >= 4) {
          metrics.outCurrent = currentPhysical(u16le(d, 2));
          fields.push(field('电流输出值', metrics.outCurrent.toFixed(1), 'A'));
          fields.push(field('电流幅值|I|', formatCurrentUi(metrics.outCurrent).toFixed(1), 'A'));
        }
        if (d.length >= 6) fields.push(field('累计充电时间', String(u16le(d, 4)), 'min'));
        if (d.length >= 7) {
          var allow = (d[6] & 0x01) ? '允许' : '暂停';
          fields.push(field('充电允许', allow));
        }
        summary = '输出 ' + (metrics.outVoltage != null ? metrics.outVoltage.toFixed(1) + 'V' : '') +
          ' / |I| ' + (metrics.outCurrent != null ? formatCurrentUi(metrics.outCurrent).toFixed(1) + 'A' : '');
        break;
      }
      case 'BSM': {
        if (d.length >= 1) fields.push(field('最高单体电压编号', String(d[0])));
        if (d.length >= 2) {
          metrics.maxTemp = d[1] - 50;
          fields.push(field('最高温度', String(metrics.maxTemp), '℃'));
        }
        if (d.length >= 3) fields.push(field('最高温度点编号', String(d[2])));
        if (d.length >= 4) {
          metrics.minTemp = d[3] - 50;
          fields.push(field('最低温度', String(metrics.minTemp), '℃'));
        }
        if (d.length >= 5) fields.push(field('最低温度点编号', String(d[4])));
        if (d.length >= 6) {
          fields.push(field('状态字节6', '0x' + d[5].toString(16), '', '单体/SOC/过流/温度等'));
        }
        if (d.length >= 7) {
          var ins = decodeInsulation(d[6]);
          fields.push(field('绝缘状态', ins.label, '', '仅状态位，无 kΩ 数值；国标常用门槛 R≥100Ω/V×Umax 为科普，非本会话测得'));
          fields.push(field('连接器状态', ((d[6] >> 2) & 0x03) === 0 ? '正常' : '异常/未解析'));
          fields.push(field('充电允许位', ((d[6] >> 4) & 0x03) === 0 ? '禁止' : (((d[6] >> 4) & 0x03) === 1 ? '允许' : '未解析')));
          metrics.insulation = ins;
          summary = '绝缘' + ins.label;
        }
        break;
      }
      case 'BST': {
        var bst = bstCst.decodeBst(d);
        fields = fields.concat(bst.fields);
        metrics.stop = bst;
        summary = bst.summary || '车辆中止';
        break;
      }
      case 'CST': {
        var cst = bstCst.decodeCst(d);
        fields = fields.concat(cst.fields);
        metrics.stop = cst;
        summary = cst.summary || '充电机中止';
        break;
      }
      case 'BSD': {
        if (d.length >= 1) {
          metrics.soc = d[0];
          fields.push(field('中止SOC', String(d[0]), '%'));
        }
        if (d.length >= 3) {
          metrics.minCellVoltage = u16le(d, 1) * 0.01;
          fields.push(field('单体最低电压', metrics.minCellVoltage.toFixed(2), 'V'));
        }
        if (d.length >= 5) {
          metrics.maxCellVoltage = u16le(d, 3) * 0.01;
          fields.push(field('单体最高电压', metrics.maxCellVoltage.toFixed(2), 'V'));
        }
        if (d.length >= 6) fields.push(field('最低温度', String(d[5] - 50), '℃'));
        if (d.length >= 7) fields.push(field('最高温度', String(d[6] - 50), '℃'));
        summary = metrics.soc != null ? ('结束 SOC ' + metrics.soc + '%') : 'BSD';
        break;
      }
      case 'CSD': {
        if (d.length >= 2) fields.push(field('累计充电时间', String(u16le(d, 0)), 'min'));
        if (d.length >= 4) fields.push(field('输出能量', (u16le(d, 2) * 0.1).toFixed(1), 'kWh'));
        if (d.length >= 8) {
          var cid = d[4] | (d[5] << 8) | (d[6] << 16) | (d[7] << 24);
          fields.push(field('充电机编号', String(cid >>> 0)));
          metrics.pileId = String(cid >>> 0);
        }
        summary = 'CSD 统计';
        break;
      }
      case 'BEM': {
        var bem = bstCst.decodeBem(d);
        fields = fields.concat(bem.fields);
        metrics.error = bem;
        summary = bem.summary || '车辆通信错误';
        break;
      }
      case 'CEM': {
        var cem = bstCst.decodeCem(d);
        fields = fields.concat(cem.fields);
        metrics.error = cem;
        summary = cem.summary || '充电机通信错误';
        break;
      }
      case 'TP.CM': {
        if (d.length >= 1) {
          var ctrl = d[0];
          var ctrlName = ({ 16: 'RTS', 17: 'CTS', 19: 'EndOfMsgAck', 32: 'BAM', 255: 'Abort' })[ctrl] || ('未解析(' + ctrl + ')');
          fields.push(field('控制', ctrlName));
          metrics.tpControl = ctrlName;
        }
        if (d.length >= 3) fields.push(field('总字节数', String(u16le(d, 1))));
        if (d.length >= 4) fields.push(field('总包数', String(d[3])));
        if (d.length >= 8) {
          var pgn = d[5] | (d[6] << 8) | (d[7] << 16);
          fields.push(field('PGN', '0x' + pgn.toString(16).toUpperCase()));
          metrics.tpPgn = pgn;
        }
        summary = 'TP.CM';
        break;
      }
      case 'TP.DT':
        if (d.length >= 1) fields.push(field('序号', String(d[0])));
        if (d.length >= 2) fields.push(field('载荷', bytesToHex(d.slice(1))));
        summary = 'TP.DT #' + (d[0] || '?');
        break;
      default:
        fields.push(field('原始数据', bytesToHex(d), '', '未解析'));
        summary = '未解析';
    }
  } catch (e) {
    fields.push(field('解析异常', String(e && e.message || e), '', '保留 raw'));
    summary = '解析异常';
  }

  if (!fields.length) {
    fields.push(field('原始数据', bytesToHex(d) || '(空)', '', '未解析'));
  }

  return { fields: fields, summary: summary, metrics: metrics };
}

function decodeFrame(input) {
  var frame;
  if (typeof input === 'string') {
    frame = parseLogLine(input, 0);
  } else if (input && input.id != null) {
    var idInfo = parseCanId(input.id);
    var cls = classifyPgn(idInfo);
    var data = input.data || [];
    if (typeof data === 'string') data = parseHexBytes(data.split(/[\s,]+/));
    frame = {
      id: idInfo.id,
      idHex: idInfo.idHex,
      idInfo: idInfo,
      data: data,
      dataHex: bytesToHex(data),
      dlc: data.length,
      code: cls.code,
      stage: cls.stage,
      side: idInfo.side,
      tMs: input.tMs != null ? input.tMs : null
    };
  } else {
    frame = input;
  }
  if (!frame) {
    return { ok: false, error: '无法解析输入', fields: [], summary: '', rawHex: '' };
  }
  var pf = frame.idInfo ? frame.idInfo.pf : null;
  var identified = dcIdCatalog.identifyFrame(frame.id, pf, frame.code);
  var decoded = decodePayload(frame.code, frame.data, frame);
  var fields = decoded.fields.slice();
  // 厂家必须展示，禁止无标注
  fields.unshift({
    name: '厂家/来源',
    value: identified.manufacturerText || '未识别厂家',
    unit: '',
    note: identified.labelText || ''
  });
  fields.unshift({
    name: '识别标注',
    value: identified.labelText || '[未识别厂家] 未在直流充电目录中',
    unit: '',
    note: identified.isGbt27930 ? '充电CAN·GB/T27930' : '目录匹配'
  });
  return {
    ok: true,
    code: frame.code,
    stage: frame.stage,
    side: frame.side,
    idHex: frame.idHex,
    pgnHex: frame.idInfo ? frame.idInfo.pgnHex : '',
    sa: frame.idInfo ? frame.idInfo.sa : null,
    da: frame.idInfo ? frame.idInfo.da : null,
    dlc: frame.dlc,
    dataHex: frame.dataHex,
    rawHex: frame.dataHex,
    tMs: frame.tMs,
    fields: fields,
    summary: decoded.summary,
    metrics: decoded.metrics,
    manufacturers: identified.manufacturers,
    manufacturerText: identified.manufacturerText,
    manufacturerLabels: identified.labels,
    labelText: identified.labelText,
    isGbt27930: identified.isGbt27930,
    catalogEntries: identified.entries,
    frame: frame
  };
}

function pgnToCode(pgn) {
  var pf = (pgn >> 8) & 0xff;
  return PF_MAP[pf] || 'UNK';
}

/**
 * J1939 TP 重组：RTS/CTS + TP.DT → 应用层事实帧
 */
function reassembleTpFrames(frames) {
  var sessions = {}; // key: sa->da
  var out = [];
  var fakeIdCounter = 0;

  function keyOf(sa, da) {
    return sa + '>' + da;
  }

  function makeAppFrame(sess, payload, tMs, lineIndex) {
    var pf = (sess.pgn >> 8) & 0xff;
    var code = PF_MAP[pf] || 'UNK';
    var id = ((6 & 0x7) << 26) | (pf << 16) | ((sess.da & 0xff) << 8) | (sess.sa & 0xff);
    // For PDU1, DA is in PS; constructed above
    var idInfo = parseCanId(id);
    var cls = classifyPgn(idInfo);
    return {
      lineIndex: lineIndex,
      tMs: tMs,
      id: id,
      idHex: idInfo.idHex,
      idInfo: idInfo,
      data: payload.slice(),
      dataHex: bytesToHex(payload),
      dlc: payload.length,
      code: cls.code || code,
      stage: STAGE_OF[code] || cls.stage,
      side: idInfo.side,
      isTp: false,
      reassembled: true,
      fromTp: true,
      tpPgn: sess.pgn
    };
  }

  for (var i = 0; i < frames.length; i++) {
    var f = frames[i];
    out.push(f);
    if (f.code === 'TP.CM' && f.data && f.data.length >= 5) {
      var ctrl = f.data[0];
      var sa = f.idInfo.sa;
      var da = f.idInfo.da != null ? f.idInfo.da : f.idInfo.ps;
      var k = keyOf(sa, da);
      if (ctrl === 16 || ctrl === 32) { // RTS or BAM
        var totalSize = u16le(f.data, 1);
        var totalPackets = f.data[3];
        var pgn = f.data.length >= 8 ? (f.data[5] | (f.data[6] << 8) | (f.data[7] << 16)) : 0;
        sessions[k] = {
          sa: sa,
          da: da,
          pgn: pgn,
          totalSize: totalSize,
          totalPackets: totalPackets,
          packets: {},
          received: 0,
          tMs: f.tMs,
          lineIndex: f.lineIndex
        };
      } else if (ctrl === 255) {
        delete sessions[k];
      } else if (ctrl === 19) {
        // End of msg ack from receiver — ignore
      }
    } else if (f.code === 'TP.DT' && f.data && f.data.length >= 2) {
      var sa2 = f.idInfo.sa;
      var da2 = f.idInfo.da != null ? f.idInfo.da : f.idInfo.ps;
      var k2 = keyOf(sa2, da2);
      var sess = sessions[k2];
      if (!sess) continue;
      var seq = f.data[0];
      sess.packets[seq] = f.data.slice(1);
      sess.received++;
      sess.tMs = f.tMs != null ? f.tMs : sess.tMs;
      // check complete
      var complete = true;
      var payload = [];
      for (var s = 1; s <= sess.totalPackets; s++) {
        if (!sess.packets[s]) {
          complete = false;
          break;
        }
        payload = payload.concat(sess.packets[s]);
      }
      if (complete) {
        payload = payload.slice(0, sess.totalSize);
        var app = makeAppFrame(sess, payload, sess.tMs, f.lineIndex);
        fakeIdCounter++;
        app._tpSeq = fakeIdCounter;
        out.push(app);
        delete sessions[k2];
      }
    }
  }
  return out;
}

function assignTimestamps(frames) {
  var base = 0;
  var last = null;
  var defaultDt = 20;
  for (var i = 0; i < frames.length; i++) {
    var f = frames[i];
    if (f.tMs == null) {
      if (last == null) f.tMs = base;
      else f.tMs = last + defaultDt;
    }
    // normalize relative if clock wrapped
    last = f.tMs;
  }
  // If absolute clock-of-day, convert to relative from first
  if (frames.length) {
    var t0 = frames[0].tMs;
    var max = frames[0].tMs;
    for (var j = 0; j < frames.length; j++) {
      if (frames[j].tMs < t0) {
        // wrap overnight — add 24h
        frames[j].tMs += 24 * 3600 * 1000;
      }
      if (frames[j].tMs > max) max = frames[j].tMs;
    }
    for (var k = 0; k < frames.length; k++) {
      frames[k].relMs = frames[k].tMs - t0;
    }
  }
  return frames;
}

function decodeLogText(text) {
  var lines = String(text || '').split(/\r?\n/);
  var frames = [];
  var skipped = 0;
  for (var i = 0; i < lines.length; i++) {
    var f = parseLogLine(lines[i], i);
    if (f) frames.push(f);
    else if (lines[i] && String(lines[i]).trim()) skipped++;
  }
  frames = assignTimestamps(frames);
  var withTp = reassembleTpFrames(frames);
  // decode each for metrics convenience
  var codeCounts = {};
  var decoded = [];
  for (var n = 0; n < withTp.length; n++) {
    var fr = withTp[n];
    var dec = decodePayload(fr.code, fr.data, fr);
    fr.summary = dec.summary;
    fr.metrics = dec.metrics;
    fr.fields = dec.fields;
    var idn = dcIdCatalog.identifyFrame(fr.id, fr.idInfo && fr.idInfo.pf, fr.code);
    fr.manufacturers = idn.manufacturers;
    fr.manufacturerText = idn.manufacturerText;
    fr.labelText = idn.labelText;
    fr.isGbt27930 = idn.isGbt27930;
    codeCounts[fr.code] = (codeCounts[fr.code] || 0) + 1;
    decoded.push(fr);
  }
  var totalMs = 0;
  if (decoded.length) {
    totalMs = (decoded[decoded.length - 1].relMs != null
      ? decoded[decoded.length - 1].relMs
      : (decoded[decoded.length - 1].tMs - decoded[0].tMs)) || 0;
  }
  return {
    frames: decoded,
    lineCount: lines.length,
    frameCount: frames.filter(function (x) { return !x.reassembled; }).length,
    totalFrames: decoded.length,
    reassembledCount: decoded.filter(function (x) { return x.reassembled; }).length,
    skipped: skipped,
    codeCounts: codeCounts,
    totalMs: totalMs
  };
}

function getCatalog(filter) {
  var list = CATALOG.map(function (item) {
    var meta = dcIdCatalog.GBT_CODE_META[item.code];
    return Object.assign({}, item, {
      manufacturer: (meta && meta.manufacturer) || '国标GB/T27930',
      bus: (meta && meta.bus) || '充电CAN(27930)'
    });
  });
  // 附加车内直流相关 ID（带厂家）
  dcIdCatalog.VEHICLE_DC_LIST.forEach(function (e) {
    list.push({
      code: e.code,
      name: e.name,
      stage: e.stage || '车内直流相关',
      pgn: e.idHex,
      dlc: e.dlc,
      period: e.cycleMs != null ? (e.cycleMs + 'ms') : '—',
      direction: e.direction || '车内',
      desc: '[' + e.manufacturer + '] ' + (e.bus || '车内CAN'),
      fields: (e.signalsHint || []).map(function (s) {
        return { name: s, bytes: '—', note: '' };
      }),
      exampleId: (e.idHex || '').replace(/^0x/i, ''),
      exampleData: '',
      manufacturer: e.manufacturer,
      bus: e.bus,
      kind: 'vehicle_dc'
    });
  });
  if (!filter) return list;
  var stage = filter.stage;
  var q = (filter.q || '').toLowerCase();
  var mfr = filter.manufacturer;
  return list.filter(function (item) {
    if (stage && stage !== '全部' && item.stage !== stage) return false;
    if (mfr && mfr !== '全部' && item.manufacturer !== mfr) return false;
    if (!q) return true;
    return (item.code + item.name + item.desc + item.stage + (item.manufacturer || ''))
      .toLowerCase()
      .indexOf(q) >= 0;
  });
}

function getMessageMeta(code) {
  for (var i = 0; i < CATALOG.length; i++) {
    if (CATALOG[i].code === code) {
      var meta = dcIdCatalog.GBT_CODE_META[code];
      return Object.assign({}, CATALOG[i], {
        manufacturer: (meta && meta.manufacturer) || '国标GB/T27930',
        bus: (meta && meta.bus) || '充电CAN(27930)'
      });
    }
  }
  var veh = null;
  dcIdCatalog.VEHICLE_DC_LIST.forEach(function (e) {
    if (e.code === code || e.name === code) veh = e;
  });
  if (veh) {
    return {
      code: veh.code,
      name: veh.name,
      stage: veh.stage,
      pgn: veh.idHex,
      dlc: veh.dlc,
      period: veh.cycleMs != null ? (veh.cycleMs + 'ms') : '—',
      direction: '车内',
      desc: '[' + veh.manufacturer + '] 车内直流相关报文',
      fields: [],
      exampleId: (veh.idHex || '').replace(/^0x/i, ''),
      exampleData: '',
      manufacturer: veh.manufacturer,
      bus: veh.bus
    };
  }
  return null;
}

module.exports = {
  SA_CHARGER: SA_CHARGER,
  BATTERY_TYPES: BATTERY_TYPES,
  parseCanId: parseCanId,
  classifyPgn: classifyPgn,
  decodeFrame: decodeFrame,
  decodeLogText: decodeLogText,
  reassembleTpFrames: reassembleTpFrames,
  parseLogLine: parseLogLine,
  getCatalog: getCatalog,
  getMessageMeta: getMessageMeta,
  formatCurrentUi: formatCurrentUi,
  currentPhysical: currentPhysical,
  decodeInsulation: decodeInsulation,
  STAGE_OF: STAGE_OF,
  PF_MAP: PF_MAP,
  identifyFrame: dcIdCatalog.identifyFrame,
  dcIdCatalog: dcIdCatalog
};
