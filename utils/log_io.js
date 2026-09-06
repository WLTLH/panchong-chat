/**
 * CAN 报文日志读取、格式识别与归一化
 */
var formats = require('./log_formats.js');

function decodeLogBytes(buffer) {
  var u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof TextDecoder !== 'undefined') {
    var tried = ['utf-8', 'gb18030', 'gbk'];
    var best = null;
    for (var i = 0; i < tried.length; i++) {
      try {
        var fatal = tried[i] === 'utf-8';
        var text = new TextDecoder(tried[i], { fatal: fatal }).decode(u8);
        var bad = (text.match(/\uFFFD/g) || []).length;
        if (!best || bad < best.bad) best = { text: text, encoding: tried[i], bad: bad };
        if (bad === 0) break;
      } catch (e) {}
    }
    if (best) return best;
  }
  var latin = '';
  for (var j = 0; j < u8.length; j++) latin += String.fromCharCode(u8[j]);
  return { text: latin, encoding: 'latin1', bad: -1 };
}

function isLikelyPlainCanLog(text) {
  var sample = String(text || '').slice(0, 20000);
  if (!sample.trim()) return false;
  var lines = sample.split(/\r?\n/);
  var hit = 0;
  var checked = 0;
  var re = /(?:^|\s)(?:0x)?([0-9A-Fa-f]{3,8})\b(?:\s+(?:[0-9A-Fa-f]{2}\s*){1,8}|\s+(?:DLC|dx|d)\s*[:=]?\s*\d)/i;
  var re2 = /(?:^|\s)(?:0x)?([0-9A-Fa-f]{3,8})\b\s+([0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2})*)/i;
  for (var i = 0; i < lines.length && checked < 80; i++) {
    var t = lines[i].trim();
    if (!t || t[0] === '#' || t[0] === ';') continue;
    checked++;
    if (re.test(t) || re2.test(t)) hit++;
  }
  return checked > 0 && hit >= Math.min(2, checked);
}

function isLikelyCanLog(text, fileName) {
  var fmt = formats.detectFormat(text, fileName || '');
  if (fmt === 'asc' || fmt === 'trc') {
    var converted = formats.convertTrace(text, fmt);
    if (converted.length > 0) return true;
  }
  if (formats.isAscHeader(text) || formats.isTrcHeader(text)) return true;
  return isLikelyPlainCanLog(text);
}

function normalizeCanLog(text, fileName) {
  var fmt = formats.detectFormat(text, fileName || '');
  if (fmt === 'plain') {
    var okPlain = isLikelyPlainCanLog(text);
    return {
      ok: okPlain,
      text: String(text || ''),
      format: 'plain',
      frameCount: okPlain ? lineCount(text) : 0
    };
  }
  var converted = formats.convertTrace(text, fmt);
  if (converted.length > 0) {
    return {
      ok: true,
      text: converted.join('\n'),
      format: fmt,
      frameCount: converted.length
    };
  }
  if (isLikelyPlainCanLog(text)) {
    return {
      ok: true,
      text: String(text || ''),
      format: 'plain',
      frameCount: lineCount(text)
    };
  }
  return {
    ok: false,
    text: '',
    format: fmt,
    frameCount: 0
  };
}

function lineCount(text) {
  return String(text || '').split(/\r?\n/).filter(function (l) {
    var t = l.trim();
    return t && t[0] !== '#';
  }).length;
}

function formatLabel(fmt) {
  if (fmt === 'asc') return 'ASC';
  if (fmt === 'trc') return 'TRC';
  return '文本';
}

module.exports = {
  decodeLogBytes: decodeLogBytes,
  isLikelyCanLog: isLikelyCanLog,
  normalizeCanLog: normalizeCanLog,
  lineCount: lineCount,
  formatLabel: formatLabel
};
