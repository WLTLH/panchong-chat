/**
 * DBC 分析结果：标签、检索、摘要
 */
var parse = require('./dbc_parse.js');

var TAG_DEFS = [
  {
    id: 'charge',
    label: '充电',
    re: /charg|chrg|充|枪|pile|obc|dc.?dc|快充|慢充|ac.?charg|dc.?charg/i
  },
  {
    id: 'battery',
    label: '电池',
    re: /bms|batt|cell|soc|soh|电池|单体|模组|pack|hv.?batt/i
  },
  {
    id: 'cc',
    label: 'CC/CP',
    re: /\bcc[12]?\b|\bcp\b|cc2|cc1|控制导|连接确认/i
  },
  {
    id: 'fault',
    label: '故障',
    re: /fault|err|error|fail|alarm|warn|故障|告警|异常|protect|保护/i
  },
  {
    id: 'insul',
    label: '绝缘',
    re: /insul|绝缘|leak|iso/i
  },
  {
    id: 'relay',
    label: '继电器',
    re: /relay|realy|rly|接触器|继电器|contactor/i
  },
  {
    id: 'temp',
    label: '温度',
    re: /temp|ntc|温度|热管|tms|cool|heat/i
  },
  {
    id: 'volt',
    label: '电压电流',
    re: /volt|curr|amp|电压|电流|u_|i_/i
  }
];

function blobOfMsg(msg) {
  var parts = [msg.name, msg.sender, msg.comment, msg.idHex];
  for (var i = 0; i < msg.signals.length; i++) {
    var s = msg.signals[i];
    parts.push(s.name, s.comment, s.unit);
    for (var j = 0; j < (s.valueTable || []).length; j++) {
      parts.push(s.valueTable[j].label);
    }
  }
  return parts.join(' ');
}

function tagMessage(msg) {
  var blob = blobOfMsg(msg);
  var tags = [];
  for (var i = 0; i < TAG_DEFS.length; i++) {
    if (TAG_DEFS[i].re.test(blob)) tags.push(TAG_DEFS[i].id);
  }
  return tags;
}

function analyzeDbcText(text, meta) {
  var db = parse.parseDbcText(text);
  var tagCounts = {};
  var i;
  for (i = 0; i < TAG_DEFS.length; i++) tagCounts[TAG_DEFS[i].id] = 0;

  var list = [];
  for (i = 0; i < db.messages.length; i++) {
    var msg = db.messages[i];
    var tags = tagMessage(msg);
    for (var t = 0; t < tags.length; t++) {
      tagCounts[tags[t]] = (tagCounts[tags[t]] || 0) + 1;
    }
    list.push({
      id: msg.id,
      idHex: msg.idHex,
      name: msg.name,
      dlc: msg.dlc,
      sender: msg.sender,
      cycleMs: msg.cycleMs,
      comment: msg.comment,
      signalCount: msg.signals.length,
      isExtended: msg.isExtended,
      tags: tags,
      signals: msg.signals
    });
  }

  var tagList = TAG_DEFS.map(function (d) {
    return { id: d.id, label: d.label, count: tagCounts[d.id] || 0 };
  }).filter(function (x) {
    return x.count > 0;
  });

  return {
    meta: meta || {},
    version: db.version,
    baud: db.baud,
    nodes: db.nodes,
    nodeCount: db.nodeCount,
    messageCount: db.messageCount,
    signalCount: db.signalCount,
    warnings: db.warnings || [],
    tagList: tagList,
    messages: list
  };
}

function filterMessages(messages, opts) {
  opts = opts || {};
  var q = String(opts.q || '').trim().toLowerCase();
  var tag = opts.tag || '';
  return (messages || []).filter(function (m) {
    if (tag && (m.tags || []).indexOf(tag) < 0) return false;
    if (!q) return true;
    var hay = (
      m.idHex +
      ' ' +
      m.name +
      ' ' +
      (m.sender || '') +
      ' ' +
      (m.comment || '')
    ).toLowerCase();
    if (hay.indexOf(q) >= 0) return true;
    for (var i = 0; i < (m.signals || []).length; i++) {
      var s = m.signals[i];
      if (
        (s.name && s.name.toLowerCase().indexOf(q) >= 0) ||
        (s.comment && s.comment.toLowerCase().indexOf(q) >= 0)
      ) {
        return true;
      }
    }
    return false;
  });
}

function getDemoDbc() {
  return (
    'VERSION "矩览演示"\n\n' +
    'BS_:\n\n' +
    'BU_: BMS VCU OBC\n\n' +
    'BO_ 419366144 BMS1_Status: 8 BMS\n' +
    ' SG_ BMS1_stCC2 : 0|2@1+ (1,0) [0|3] "" VCU\n' +
    ' SG_ BMS1_SOC : 8|8@1+ (0.4,0) [0|100] "%" VCU\n' +
    ' SG_ BMS1_PackVolt : 16|16@1+ (0.1,0) [0|1000] "V" VCU\n' +
    ' SG_ BMS1_PackCurr : 32|16@1+ (0.1,-1000) [-1000|1000] "A" VCU\n\n' +
    'BO_ 419366400 BMS9_Fault: 8 BMS\n' +
    ' SG_ BMS9_CC2_Err : 0|1@1+ (1,0) [0|1] "" VCU\n' +
    ' SG_ BMS9_Chrg_inslution : 1|2@1+ (1,0) [0|3] "" VCU\n' +
    ' SG_ BMS9_Chg_CAN_Fault : 3|1@1+ (1,0) [0|1] "" VCU\n' +
    ' SG_ BMS9_NegRealy_Cant_Close : 4|1@1+ (1,0) [0|1] "" VCU\n\n' +
    'BO_ 419367168 OBC_ChargeSts: 8 OBC\n' +
    ' SG_ OBC_ChrgSts : 0|2@1+ (1,0) [0|3] "" BMS,VCU\n' +
    ' SG_ OBC_OutVolt : 8|16@1+ (0.1,0) [0|500] "V" BMS\n' +
    ' SG_ OBC_OutCurr : 24|16@1+ (0.1,0) [0|100] "A" BMS\n\n' +
    'VAL_ 419366144 BMS1_stCC2 0 "NotConnected" 1 "Connected" 2 "Error" 3 "Invalid" ;\n' +
    'VAL_ 419366400 BMS9_CC2_Err 0 "No Error" 1 "Error" ;\n' +
    'VAL_ 419366400 BMS9_Chrg_inslution 0 "No Error" 1 "Simple" 2 "Minor" 3 "Series" ;\n' +
    'VAL_ 419367168 OBC_ChrgSts 0 "Idle" 1 "Charging" 2 "Done" 3 "Fault" ;\n' +
    'CM_ BO_ 419366144 "BMS 状态（演示）";\n' +
    'CM_ SG_ 419366144 BMS1_stCC2 "CC2 连接状态";\n' +
    'CM_ BO_ 419366400 "BMS 故障字（演示）";\n' +
    'BA_ "GenMsgCycleTime" BO_ 419366144 100;\n' +
    'BA_ "GenMsgCycleTime" BO_ 419366400 100;\n' +
    'BA_ "GenMsgCycleTime" BO_ 419367168 50;\n'
  );
}

module.exports = {
  TAG_DEFS: TAG_DEFS,
  analyzeDbcText: analyzeDbcText,
  filterMessages: filterMessages,
  getDemoDbc: getDemoDbc,
  parseDbcText: parse.parseDbcText,
  decodeDbcBytes: parse.decodeDbcBytes,
  isLikelyDbc: parse.isLikelyDbc
};
