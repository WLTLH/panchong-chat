/**
 * ASC / TRC 等 CAN 轨迹格式 → 通用 ID+数据 行
 */

function padIdHex(idStr) {
  var s = String(idStr || '').replace(/^0x/i, '').replace(/x$/i, '');
  if (!/^[0-9A-Fa-f]+$/.test(s)) return null;
  var n = parseInt(s, 16);
  if (!isFinite(n)) return null;
  if (n > 0x7ff) return ('00000000' + n.toString(16).toUpperCase()).slice(-8);
  return n.toString(16).toUpperCase();
}

function trimDataBytes(dataStr, dlc) {
  var bytes = String(dataStr || '').trim().split(/\s+/).filter(function (b) {
    return /^[0-9A-Fa-f]{1,2}$/i.test(b);
  });
  if (dlc && bytes.length > dlc) bytes = bytes.slice(0, dlc);
  return bytes.join(' ');
}

function joinLine(ts, idHex, dataStr, dlc) {
  var data = trimDataBytes(dataStr, dlc);
  if (!idHex || !data) return null;
  return (ts ? String(ts) + ' ' : '') + idHex + ' ' + data;
}

function isAscHeader(text) {
  var head = String(text || '').slice(0, 6000);
  return /^\s*date\s+/mi.test(head) || /^\s*base\s+(hex|dec)/mi.test(head) || /internal events logged/i.test(head);
}

function isTrcHeader(text) {
  var head = String(text || '').slice(0, 6000);
  return /;\$FILEVERSION/i.test(head) || /;\$STARTTIME/i.test(head) || /;\s*MESSAGE/i.test(head);
}

function detectFormat(text, fileName) {
  var ext = '';
  var n = String(fileName || '').toLowerCase();
  var dot = n.lastIndexOf('.');
  if (dot >= 0) ext = n.slice(dot + 1);
  if (ext === 'asc') return 'asc';
  if (ext === 'trc') return 'trc';
  if (isAscHeader(text)) return 'asc';
  if (isTrcHeader(text)) return 'trc';
  return 'plain';
}

function parseAscLine(line) {
  var t = String(line || '').trim();
  if (!t || t[0] === ';' || /^\/\//.test(t)) return null;
  if (/^(date|base|internal|Begin|End|Start|Stop|Trigger|no|Error|Statistic)/i.test(t)) return null;

  // CAN FD: 0.123 CANFD 1 Rx 18FF0500 ... d 8 AA BB
  var fd = t.match(
    /^\s*([\d.]+)\s+CANFD\s+\d+\s+(?:Rx|Tx)\s+(?:0x)?([0-9A-Fa-f]+)x?\s+.*?[dD]\s+(\d+)\s+((?:[0-9A-Fa-f]{2}\s*)+)$/i
  );
  if (fd) {
    var id1 = padIdHex(fd[2]);
    return id1 ? joinLine(fd[1], id1, fd[4], parseInt(fd[3], 10)) : null;
  }

  // Vector: 0.123 1 18FF0500x Rx d 8 AA BB
  var std = t.match(
    /^\s*([\d.]+)\s+(?:\d+\s+)?(?:0x)?([0-9A-Fa-f]+)x?\s+(?:Rx|Tx)?\s*(?:\d+\s+)?[dD]\s+(\d+)\s+((?:[0-9A-Fa-f]{2}\s*)+)$/i
  );
  if (std) {
    var id2 = padIdHex(std[2]);
    return id2 ? joinLine(std[1], id2, std[4], parseInt(std[3], 10)) : null;
  }

  // PEAK 等：0.123 1 18FF0500 Rx 8 AA BB（无 d）
  var peak = t.match(
    /^\s*([\d.]+)\s+(?:\d+\s+)?(?:0x)?([0-9A-Fa-f]+)x?\s+(?:Rx|Tx)?\s+(\d+)\s+((?:[0-9A-Fa-f]{2}\s*)+)$/i
  );
  if (peak) {
    var id3 = padIdHex(peak[2]);
    return id3 ? joinLine(peak[1], id3, peak[4], parseInt(peak[3], 10)) : null;
  }

  return null;
}

function parseTrcLine(line) {
  var raw = String(line || '');
  var t = raw.trim();
  if (!t) return null;

  // 分号开头的数据行：; 0.000 1 18FF0500 Rx 8 ...
  if (t[0] === ';') {
    t = t.slice(1).trim();
    if (!t || /^\$/.test(t) || /^FILEVERSION/i.test(t)) return null;
  }

  // TRC 2.0：1 0.000 PT CAN 1 Rx 18FF0500 8 01 02 ...
  var v2 = t.match(
    /^\s*\d+\s+([\d.]+)\s+(?:\S+\s+)*(\d+)\s+(?:Rx|Tx)\s+(?:0x)?([0-9A-Fa-f]+)x?\s+(\d+)\s+((?:[0-9A-Fa-f]{2}\s*)+)$/i
  );
  if (v2) {
    var idv2 = padIdHex(v2[3]);
    return idv2 ? joinLine(v2[1], idv2, v2[5], parseInt(v2[4], 10)) : null;
  }

  // TRC 1.x / 注释体：0.000 18FF0500 Rx 8 01 02 ...
  var v1 = t.match(
    /^\s*([\d.]+)\s+(?:\d+\s+)?(?:0x)?([0-9A-Fa-f]+)x?\s+(?:Rx|Tx)?\s+(\d+)\s+((?:[0-9A-Fa-f]{2}\s*)+)$/i
  );
  if (v1) {
    var idv1 = padIdHex(v1[2]);
    return idv1 ? joinLine(v1[1], idv1, v1[4], parseInt(v1[3], 10)) : null;
  }

  // CSV 风格（部分 PCAN 导出）
  if (t.indexOf(',') >= 0 && !/^\d+\.\d+,/.test(t)) {
    var parts = t.split(',');
    if (parts.length >= 7) {
      var timeC = parts[1] && parts[1].trim();
      var idC = parts[3] || parts[4];
      var dlcC = parseInt(parts[5] || parts[6], 10);
      var dataC = parts.slice(6).join(' ').replace(/,/g, ' ');
      var idHexC = padIdHex(idC);
      if (idHexC && timeC) return joinLine(timeC, idHexC, dataC, dlcC);
    }
  }

  return null;
}

function convertTrace(text, format) {
  var lines = String(text || '').split(/\r?\n/);
  var out = [];
  var parser = format === 'asc' ? parseAscLine : parseTrcLine;
  for (var i = 0; i < lines.length; i++) {
    var n = parser(lines[i]);
    if (n) out.push(n);
  }
  return out;
}

module.exports = {
  detectFormat: detectFormat,
  parseAscLine: parseAscLine,
  parseTrcLine: parseTrcLine,
  convertTrace: convertTrace,
  isAscHeader: isAscHeader,
  isTrcHeader: isTrcHeader
};
