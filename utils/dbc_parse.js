/**
 * DBC 文本解析（Vector / CANdb++ 常见子集）
 * 支持：BU_ / BO_ / SG_（含复用）/ VAL_ / CM_ / GenMsgCycleTime
 */
function parseDbcText(text) {
  var lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  var nodes = [];
  var messages = [];
  var byId = {};
  var vals = {};
  var commentsMsg = {};
  var commentsSig = {};
  var cycles = {};
  var version = '';
  var baud = '';
  var cur = null;
  var warnings = [];
  var i;

  for (i = 0; i < lines.length; i++) {
    var line = lines[i];
    var t = line.trim();
    if (!t || t[0] === ';') continue;

    var vm = t.match(/^VERSION\s+"([^"]*)"/i);
    if (vm) {
      version = vm[1] || '';
      continue;
    }

    var bs = t.match(/^BS_\s*:\s*(\d*)/);
    if (bs) {
      if (bs[1]) baud = bs[1];
      continue;
    }

    var bu = t.match(/^BU_\s*:\s*(.*)$/);
    if (bu) {
      nodes = (bu[1] || '')
        .split(/\s+/)
        .map(function (x) { return x.trim(); })
        .filter(Boolean);
      continue;
    }

    var bo = t.match(/^BO_\s+(\d+)\s+(\S+)\s*:\s*(\d+)\s+(\S+)/);
    if (bo) {
      var idRaw = parseInt(bo[1], 10);
      var id = idRaw & 0x1fffffff;
      var isExt = id > 0x7ff || (idRaw & 0x80000000) !== 0;
      cur = {
        id: id,
        idRaw: idRaw,
        idHex: formatIdHex(id),
        name: bo[2],
        dlc: parseInt(bo[3], 10),
        sender: bo[4],
        isExtended: isExt,
        isVectorIndependent: bo[2] === 'VECTOR__INDEPENDENT_SIG_MSG',
        cycleMs: '',
        comment: '',
        signals: []
      };
      if (!cur.isVectorIndependent) {
        messages.push(cur);
        byId[id] = cur;
      } else {
        cur = { signals: [], _skip: true };
      }
      continue;
    }

    if (cur && !cur._skip) {
      var sg = t.match(
        /^SG_\s+(\S+)\s+(?:(M|m\d+)\s+)?:\s*(\d+)\|(\d+)@([01])([+-])\s*\(([^,]+),([^)]+)\)\s*\[([^|]*)\|([^\]]*)\]\s*"([^"]*)"\s*(.*)$/
      );
      if (sg) {
        var mux = sg[2] || '';
        var receivers = (sg[12] || '')
          .trim()
          .split(/\s*,\s*|\s+/)
          .filter(Boolean);
        cur.signals.push({
          name: sg[1],
          mux: mux,
          isMuxSwitch: mux === 'M',
          startBit: parseInt(sg[3], 10),
          length: parseInt(sg[4], 10),
          byteOrder: sg[5] === '1' ? 'Intel' : 'Motorola',
          signed: sg[6] === '-',
          factor: numOrStr(sg[7]),
          offset: numOrStr(sg[8]),
          min: numOrStr(sg[9]),
          max: numOrStr(sg[10]),
          unit: sg[11] || '',
          receivers: receivers,
          comment: '',
          valueTable: []
        });
        continue;
      }
    }

    var val = t.match(/^VAL_\s+(\d+)\s+(\S+)\s+(.+);?\s*$/);
    if (val) {
      var vid = parseInt(val[1], 10) & 0x1fffffff;
      var pairs = [];
      var re = /(\d+)\s+"([^"]*)"/g;
      var m;
      while ((m = re.exec(val[3]))) {
        pairs.push({ value: parseInt(m[1], 10), label: m[2] });
      }
      vals[vid + '\0' + val[2]] = pairs;
      continue;
    }

    var cmBo = t.match(/^CM_\s+BO_\s+(\d+)\s+"([^"]*)"\s*;?/);
    if (cmBo) {
      commentsMsg[parseInt(cmBo[1], 10) & 0x1fffffff] = cmBo[2];
      continue;
    }

    var cmSg = t.match(/^CM_\s+SG_\s+(\d+)\s+(\S+)\s+"([^"]*)"\s*;?/);
    if (cmSg) {
      commentsSig[(parseInt(cmSg[1], 10) & 0x1fffffff) + '\0' + cmSg[2]] = cmSg[3];
      continue;
    }

    // 多行注释简化：CM_ ... " 跨行时忽略，常见单行足够
    var baCycle = t.match(/^BA_\s+"GenMsgCycleTime"\s+BO_\s+(\d+)\s+(\d+)\s*;/);
    if (baCycle) {
      cycles[parseInt(baCycle[1], 10) & 0x1fffffff] = baCycle[2];
      continue;
    }
  }

  var signalCount = 0;
  for (i = 0; i < messages.length; i++) {
    var msg = messages[i];
    msg.cycleMs = cycles[msg.id] || '';
    msg.comment = commentsMsg[msg.id] || '';
    for (var s = 0; s < msg.signals.length; s++) {
      var sig = msg.signals[s];
      sig.comment = commentsSig[msg.id + '\0' + sig.name] || '';
      sig.valueTable = vals[msg.id + '\0' + sig.name] || [];
      signalCount++;
    }
  }

  messages.sort(function (a, b) {
    return a.id - b.id;
  });

  if (!messages.length) {
    warnings.push('未解析到报文（BO_）。请确认文件是 DBC 文本。');
  }

  return {
    version: version,
    baud: baud,
    nodes: nodes,
    messages: messages,
    messageCount: messages.length,
    signalCount: signalCount,
    nodeCount: nodes.length,
    warnings: warnings
  };
}

function formatIdHex(id) {
  if (id > 0x7ff) {
    return ('00000000' + id.toString(16).toUpperCase()).slice(-8);
  }
  return id.toString(16).toUpperCase();
}

function numOrStr(s) {
  var t = String(s || '').trim();
  if (t === '') return '';
  var n = Number(t);
  return isNaN(n) ? t : n;
}

/**
 * 将文件二进制解成文本。优先 TextDecoder；ASCII 结构在 latin1 下仍可解析。
 */
function decodeDbcBytes(buffer) {
  var u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof TextDecoder !== 'undefined') {
    var tried = ['utf-8', 'gb18030', 'gbk', 'gb2312'];
    var best = null;
    for (var i = 0; i < tried.length; i++) {
      try {
        var fatal = tried[i] === 'utf-8';
        var text = new TextDecoder(tried[i], { fatal: fatal }).decode(u8);
        var bad = (text.match(/\uFFFD/g) || []).length;
        if (!best || bad < best.bad) {
          best = { text: text, encoding: tried[i], bad: bad };
        }
        if (bad === 0) break;
      } catch (e) {}
    }
    if (best && (best.bad < 50 || best.encoding !== 'utf-8')) {
      return best;
    }
  }
  var latin = '';
  for (var j = 0; j < u8.length; j++) latin += String.fromCharCode(u8[j]);
  return { text: latin, encoding: 'latin1', bad: -1 };
}

function isLikelyDbc(text) {
  var sample = String(text || '').slice(0, 12000);
  return /\bBO_\s+\d+\s+\S+/m.test(sample) || /\bSG_\s+\S+\s*:/m.test(sample);
}

module.exports = {
  parseDbcText: parseDbcText,
  decodeDbcBytes: decodeDbcBytes,
  formatIdHex: formatIdHex,
  isLikelyDbc: isLikelyDbc
};
