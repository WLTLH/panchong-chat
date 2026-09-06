/**
 * BST / CST / BEM / CEM 位域解读（GB/T 27930-2015 语义）
 * 不确定位标「未解析」，不硬猜。
 */

function bit(byte, n) {
  return (byte >> n) & 1;
}

function bits2(byte, start) {
  return (byte >> start) & 0x03;
}

function pushReason(list, fields, on, label, note) {
  fields.push({ name: label, value: on ? '是' : '否', unit: '', note: note || '' });
  if (on) list.push(label);
}

function decodeBst(data) {
  var d = data || [];
  var fields = [];
  var reasons = [];
  var b0 = d[0] || 0;
  var b1 = d[1] || 0;
  var b2 = d[2] || 0;
  var b3 = d[3] || 0;

  // Byte1: 中止原因
  pushReason(reasons, fields, bit(b0, 0), '达到所需SOC目标值', 'BST byte1 bit0');
  pushReason(reasons, fields, bit(b0, 1), '达到总电压设定值', 'BST byte1 bit1');
  pushReason(reasons, fields, bit(b0, 2), '达到单体电压设定值', 'BST byte1 bit2');
  pushReason(reasons, fields, bit(b0, 3), '充电机主动中止', 'BST byte1 bit3');

  // Byte2: 故障原因
  pushReason(reasons, fields, bit(b1, 0), '绝缘故障', 'BST byte2 bit0');
  pushReason(reasons, fields, bit(b1, 1), '输出连接器过温', 'BST byte2 bit1');
  pushReason(reasons, fields, bit(b1, 2), 'BMS 元件、输出连接器过温', 'BST byte2 bit2');
  pushReason(reasons, fields, bit(b1, 3), '充电连接器故障', 'BST byte2 bit3');
  pushReason(reasons, fields, bit(b1, 4), '电池组温度过高', 'BST byte2 bit4');
  pushReason(reasons, fields, bit(b1, 5), '高压继电器故障', 'BST byte2 bit5');
  pushReason(reasons, fields, bit(b1, 6), '检测点2电压检测故障', 'BST byte2 bit6');
  pushReason(reasons, fields, bit(b1, 7), '其他故障', 'BST byte2 bit7');

  // Byte3: 错误原因
  pushReason(reasons, fields, bit(b2, 0), '电流过大', 'BST byte3 bit0');
  pushReason(reasons, fields, bit(b2, 1), '电压异常', 'BST byte3 bit1');

  fields.push({ name: '原始', value: [b0, b1, b2, b3].map(function (x) {
    return ('0' + x.toString(16).toUpperCase()).slice(-2);
  }).join(' '), unit: '', note: '' });

  var side = 'vehicle';
  if (bit(b0, 3) && reasons.length === 1) side = 'pile';
  if (bit(b1, 0) || bit(b1, 3)) side = side; // insulation / connector → may lean link; keep vehicle as sender, hint in note
  var linkHint = bit(b1, 0) || bit(b1, 3) || bit(b1, 6);

  return {
    code: 'BST',
    reasons: reasons,
    fields: fields,
    summary: reasons.length ? ('车辆中止：' + reasons.slice(0, 3).join('；')) : '车辆中止（无明确置位）',
    side: side,
    linkHint: !!linkHint,
    raw: [b0, b1, b2, b3]
  };
}

function decodeCst(data) {
  var d = data || [];
  var fields = [];
  var reasons = [];
  var b0 = d[0] || 0;
  var b1 = d[1] || 0;
  var b2 = d[2] || 0;
  var b3 = d[3] || 0;

  // Byte1
  pushReason(reasons, fields, bit(b0, 0), '达到充电机设定条件中止', 'CST byte1 bit0');
  pushReason(reasons, fields, bit(b0, 1), '人工中止', 'CST byte1 bit1');
  pushReason(reasons, fields, bit(b0, 2), '故障中止', 'CST byte1 bit2');
  pushReason(reasons, fields, bit(b0, 3), 'BMS 主动中止', 'CST byte1 bit3');

  // Byte2 故障
  pushReason(reasons, fields, bit(b1, 0), '充电机过温故障', 'CST byte2 bit0');
  pushReason(reasons, fields, bit(b1, 1), '充电连接器故障', 'CST byte2 bit1');
  pushReason(reasons, fields, bit(b1, 2), '充电机内部过温', 'CST byte2 bit2');
  pushReason(reasons, fields, bit(b1, 3), '所需电量不能传送', 'CST byte2 bit3');
  pushReason(reasons, fields, bit(b1, 4), '充电机急停', 'CST byte2 bit4');
  pushReason(reasons, fields, bit(b1, 5), '其他故障', 'CST byte2 bit5');

  // Byte3 错误
  pushReason(reasons, fields, bit(b2, 0), '电流不匹配', 'CST byte3 bit0');
  pushReason(reasons, fields, bit(b2, 1), '电压异常', 'CST byte3 bit1');

  fields.push({ name: '原始', value: [b0, b1, b2, b3].map(function (x) {
    return ('0' + x.toString(16).toUpperCase()).slice(-2);
  }).join(' '), unit: '', note: '' });

  var side = 'pile';
  if (bit(b0, 3) && reasons.length === 1) side = 'vehicle';
  var linkHint = bit(b1, 1);

  return {
    code: 'CST',
    reasons: reasons,
    fields: fields,
    summary: reasons.length ? ('充电机中止：' + reasons.slice(0, 3).join('；')) : '充电机中止（无明确置位）',
    side: side,
    linkHint: !!linkHint,
    raw: [b0, b1, b2, b3]
  };
}

function decodeBem(data) {
  var d = data || [];
  var fields = [];
  var reasons = [];
  var b0 = d[0] || 0;
  var b1 = d[1] || 0;
  var b2 = d[2] || 0;
  var b3 = d[3] || 0;

  // 00=正常 01=超时 10=不可信 —— 用 2bit
  function to2(v, label) {
    var s = bits2(v, 0);
    // for multi fields we read dedicated bits from bytes - simplified per SPN groups
    fields.push({ name: label, value: s === 1 ? '超时' : (s === 0 ? '正常' : '未解析/不可信'), unit: '', note: '' });
    if (s === 1) reasons.push(label + '超时');
  }

  // BEM: reception timeout of CRM/CML/CRO/CTS/CCS/CST/CSD etc.
  if (bits2(b0, 0) === 1) { reasons.push('接收 CRM 超时'); fields.push({ name: 'CRM', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'CRM', value: bits2(b0, 0) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b0, 2) === 1) { reasons.push('接收 CML 超时'); fields.push({ name: 'CML', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'CML', value: bits2(b0, 2) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b0, 4) === 1) { reasons.push('接收 CRO 超时'); fields.push({ name: 'CRO', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'CRO', value: bits2(b0, 4) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b0, 6) === 1) { reasons.push('接收 CTS 超时'); fields.push({ name: 'CTS', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'CTS', value: bits2(b0, 6) === 0 ? '正常' : '未解析', unit: '', note: '' });

  if (bits2(b1, 0) === 1) { reasons.push('接收 CCS 超时'); fields.push({ name: 'CCS', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'CCS', value: bits2(b1, 0) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b1, 2) === 1) { reasons.push('接收 CST 超时'); fields.push({ name: 'CST', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'CST', value: bits2(b1, 2) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b1, 4) === 1) { reasons.push('接收 CSD 超时'); fields.push({ name: 'CSD', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'CSD', value: bits2(b1, 4) === 0 ? '正常' : '未解析', unit: '', note: '' });

  fields.push({ name: '原始', value: [b0, b1, b2, b3].map(function (x) {
    return ('0' + x.toString(16).toUpperCase()).slice(-2);
  }).join(' '), unit: '', note: '' });

  return {
    code: 'BEM',
    reasons: reasons,
    fields: fields,
    summary: reasons.length ? ('车辆错误：' + reasons.slice(0, 3).join('；')) : '车辆错误报文',
    side: 'vehicle',
    // BEM = vehicle reports not receiving charger msgs → lean pile/link
    lean: 'pile',
    raw: [b0, b1, b2, b3]
  };
}

function decodeCem(data) {
  var d = data || [];
  var fields = [];
  var reasons = [];
  var b0 = d[0] || 0;
  var b1 = d[1] || 0;
  var b2 = d[2] || 0;
  var b3 = d[3] || 0;

  if (bits2(b0, 0) === 1) { reasons.push('接收 BRM 超时'); fields.push({ name: 'BRM', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'BRM', value: bits2(b0, 0) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b0, 2) === 1) { reasons.push('接收 BCP 超时'); fields.push({ name: 'BCP', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'BCP', value: bits2(b0, 2) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b0, 4) === 1) { reasons.push('接收 BRO 超时'); fields.push({ name: 'BRO', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'BRO', value: bits2(b0, 4) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b0, 6) === 1) { reasons.push('接收 BCS 超时'); fields.push({ name: 'BCS', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'BCS', value: bits2(b0, 6) === 0 ? '正常' : '未解析', unit: '', note: '' });

  if (bits2(b1, 0) === 1) { reasons.push('接收 BCL 超时'); fields.push({ name: 'BCL', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'BCL', value: bits2(b1, 0) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b1, 2) === 1) { reasons.push('接收 BST 超时'); fields.push({ name: 'BST', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'BST', value: bits2(b1, 2) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b1, 4) === 1) { reasons.push('接收 BSD 超时'); fields.push({ name: 'BSD', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'BSD', value: bits2(b1, 4) === 0 ? '正常' : '未解析', unit: '', note: '' });
  if (bits2(b1, 6) === 1) { reasons.push('接收 BSM 超时'); fields.push({ name: 'BSM', value: '超时', unit: '', note: '' }); }
  else fields.push({ name: 'BSM', value: bits2(b1, 6) === 0 ? '正常' : '未解析', unit: '', note: '' });

  fields.push({ name: '原始', value: [b0, b1, b2, b3].map(function (x) {
    return ('0' + x.toString(16).toUpperCase()).slice(-2);
  }).join(' '), unit: '', note: '' });

  return {
    code: 'CEM',
    reasons: reasons,
    fields: fields,
    summary: reasons.length ? ('充电机错误：' + reasons.slice(0, 3).join('；')) : '充电机错误报文',
    side: 'pile',
    // CEM = charger not receiving vehicle msgs → lean vehicle/link
    lean: 'vehicle',
    raw: [b0, b1, b2, b3]
  };
}

function sideHintFromStop(code, decoded) {
  if (!decoded) return 'unknown';
  if (decoded.linkHint) return 'link';
  if (code === 'BST') return decoded.side || 'vehicle';
  if (code === 'CST') return decoded.side || 'pile';
  if (code === 'BEM') return decoded.lean || 'pile';
  if (code === 'CEM') return decoded.lean || 'vehicle';
  return 'unknown';
}

module.exports = {
  decodeBst: decodeBst,
  decodeCst: decodeCst,
  decodeBem: decodeBem,
  decodeCem: decodeCem,
  sideHintFromStop: sideHintFromStop
};
