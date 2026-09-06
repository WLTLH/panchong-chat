/**
 * DBC 信号解码：Intel / Motorola，物理值与枚举
 */
var gbt = require('./gbt27930.js');

function toNum(v, fallback) {
  var n = Number(v);
  return isNaN(n) ? (fallback || 0) : n;
}

function extractIntel(data, startBit, length) {
  var val = 0;
  for (var i = 0; i < length; i++) {
    var bitPos = startBit + i;
    var byteIdx = Math.floor(bitPos / 8);
    var bitInByte = bitPos % 8;
    if (byteIdx >= data.length) break;
    if ((data[byteIdx] >> bitInByte) & 1) val |= 1 << i;
  }
  return val;
}

function extractMotorola(data, startBit, length) {
  var val = 0;
  var bit = startBit;
  for (var i = 0; i < length; i++) {
    var byteIdx = Math.floor(bit / 8);
    var bitInByte = bit % 8;
    if (byteIdx < 0 || byteIdx >= data.length) break;
    if ((data[byteIdx] >> bitInByte) & 1) val = (val << 1) | 1;
    else val = val << 1;
    bit--;
    if (bit % 8 === 7) bit += 16;
  }
  return val;
}

function applySign(raw, length, signed) {
  if (!signed || length >= 32) return raw;
  var mask = 1 << (length - 1);
  if (raw & mask) raw -= 1 << length;
  return raw;
}

function extractRaw(data, sig) {
  var raw;
  if (sig.byteOrder === 'Intel') {
    raw = extractIntel(data, sig.startBit, sig.length);
  } else {
    raw = extractMotorola(data, sig.startBit, sig.length);
  }
  return applySign(raw, sig.length, sig.signed);
}

function labelOfValue(sig, raw) {
  var table = sig.valueTable || [];
  for (var i = 0; i < table.length; i++) {
    if (table[i].value === raw) return table[i].label;
  }
  return '';
}

function formatPhys(val) {
  if (val == null || isNaN(val)) return '—';
  var abs = Math.abs(val);
  if (abs >= 1000) return String(Math.round(val * 10) / 10);
  if (abs >= 10) return String(Math.round(val * 100) / 100);
  return String(Math.round(val * 1000) / 1000);
}

function decodeSignal(data, sig) {
  var raw = extractRaw(data, sig);
  var factor = toNum(sig.factor, 1);
  var offset = toNum(sig.offset, 0);
  var phys = raw * factor + offset;
  var enumLabel = labelOfValue(sig, raw);
  var text = enumLabel || formatPhys(phys);
  if (!enumLabel && sig.unit) text += ' ' + sig.unit;
  return {
    name: sig.name,
    raw: raw,
    phys: phys,
    text: text,
    enumLabel: enumLabel,
    unit: sig.unit || '',
    comment: sig.comment || ''
  };
}

function getMuxValue(data, signals) {
  for (var i = 0; i < signals.length; i++) {
    var s = signals[i];
    if (s.isMuxSwitch || s.mux === 'M') {
      return extractRaw(data, s);
    }
  }
  return null;
}

function shouldDecodeSignal(sig, muxVal) {
  if (!sig.mux) return true;
  if (sig.isMuxSwitch || sig.mux === 'M') return true;
  if (muxVal == null) return false;
  var m = String(sig.mux).replace(/^m/i, '');
  return String(muxVal) === m;
}

function decodeMessage(msgDef, data) {
  if (!msgDef || !data || !data.length) return null;
  var muxVal = getMuxValue(data, msgDef.signals || []);
  var signals = [];
  for (var i = 0; i < (msgDef.signals || []).length; i++) {
    var sig = msgDef.signals[i];
    if (!shouldDecodeSignal(sig, muxVal)) continue;
    if (sig.isMuxSwitch || sig.mux === 'M') continue;
    try {
      signals.push(decodeSignal(data, sig));
    } catch (e) {}
  }
  return {
    id: msgDef.id,
    idHex: msgDef.idHex,
    name: msgDef.name,
    sender: msgDef.sender,
    signals: signals,
    summary: buildSummary(signals)
  };
}

function buildSummary(signals, max) {
  max = max || 4;
  var parts = [];
  for (var i = 0; i < signals.length && parts.length < max; i++) {
    parts.push(signals[i].name + '=' + signals[i].text);
  }
  if (signals.length > max) parts.push('…');
  return parts.join(' · ');
}

function buildIdIndex(messages) {
  var byId = {};
  for (var i = 0; i < (messages || []).length; i++) {
    var m = messages[i];
    byId[m.id] = m;
    byId[m.idHex] = m;
  }
  return byId;
}

function decodeFrame(frame, byId) {
  if (!frame || !byId) return null;
  var msgDef = byId[frame.id] || byId[frame.idHex];
  if (!msgDef) return null;
  var decoded = decodeMessage(msgDef, frame.data);
  if (!decoded) return null;
  return Object.assign({}, decoded, {
    dataHex: frame.dataHex,
    timeText: frame.tMs != null ? formatTime(frame.tMs) : '',
    rawLine: frame.rawLine || ''
  });
}

function formatTime(tMs) {
  if (tMs == null) return '';
  var ms = tMs % 1000;
  var totalSec = Math.floor(tMs / 1000);
  var s = totalSec % 60;
  var m = Math.floor(totalSec / 60) % 60;
  var h = Math.floor(totalSec / 3600);
  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }
  return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + '.' + pad(ms, 3);
}

function decodeLogLine(line, lineIndex, byId) {
  var frame = gbt.parseLogLine(line, lineIndex);
  if (!frame) return { ok: false };
  var decoded = decodeFrame(frame, byId);
  if (!decoded) {
    return {
      ok: false,
      unknown: true,
      idHex: frame.idHex,
      dataHex: frame.dataHex,
      timeText: frame.tMs != null ? formatTime(frame.tMs) : ''
    };
  }
  return { ok: true, decoded: decoded };
}

module.exports = {
  decodeMessage: decodeMessage,
  decodeFrame: decodeFrame,
  decodeLogLine: decodeLogLine,
  decodeSignal: decodeSignal,
  shouldDecodeSignal: shouldDecodeSignal,
  buildIdIndex: buildIdIndex,
  buildSummary: buildSummary,
  formatTime: formatTime
};
