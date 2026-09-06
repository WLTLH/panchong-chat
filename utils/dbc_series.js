/**
 * DBC 信号检索与曲线序列
 */
var gbt = require('./gbt27930.js');
var decode = require('./dbc_decode.js');

var CHART_COLORS = [
  '#B87333', '#07C160', '#2F6BFF', '#E64340',
  '#9B59B6', '#E67E22', '#1ABC9C', '#34495E'
];

function sigKey(idHex, sigName) {
  return idHex + '|' + sigName;
}

function buildSignalIndex(messages) {
  var list = [];
  for (var i = 0; i < (messages || []).length; i++) {
    var msg = messages[i];
    for (var j = 0; j < (msg.signals || []).length; j++) {
      var s = msg.signals[j];
      if (s.isMuxSwitch || s.mux === 'M') continue;
      list.push({
        key: sigKey(msg.idHex, s.name),
        idHex: msg.idHex,
        msgName: msg.name,
        sigName: s.name,
        unit: s.unit || '',
        comment: s.comment || '',
        label: msg.name + '.' + s.name
      });
    }
  }
  return list;
}

function searchSignals(index, query, limit) {
  limit = limit || 40;
  var q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  var out = [];
  for (var i = 0; i < index.length; i++) {
    var it = index[i];
    var hay = (
      it.sigName + ' ' + it.msgName + ' ' + it.idHex + ' ' + it.comment + ' ' + it.label
    ).toLowerCase();
    if (hay.indexOf(q) >= 0) out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

function findSignalDef(byId, idHex, sigName) {
  var msg = byId[idHex] || byId[parseInt(idHex, 16)];
  if (!msg) return null;
  for (var i = 0; i < (msg.signals || []).length; i++) {
    if (msg.signals[i].name === sigName) return { msg: msg, sig: msg.signals[i] };
  }
  return null;
}

function buildSignalSeries(logText, byId, key) {
  var parts = String(key || '').split('|');
  if (parts.length < 2) return null;
  var idHex = parts[0];
  var sigName = parts.slice(1).join('|');
  var def = findSignalDef(byId, idHex, sigName);
  if (!def) return null;

  var lines = String(logText || '').split(/\r?\n/);
  var points = [];
  var lineIndex = 0;
  var tCursor = 0;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/\r/g, '');
    var t = line.trim();
    if (!t || t[0] === '#') continue;
    var frame = gbt.parseLogLine(line, lineIndex++);
    if (!frame) continue;
    if (frame.idHex !== idHex && frame.id !== def.msg.id) continue;

    var muxVal = null;
    for (var m = 0; m < (def.msg.signals || []).length; m++) {
      var ms = def.msg.signals[m];
      if (ms.isMuxSwitch || ms.mux === 'M') {
        muxVal = decode.decodeSignal(frame.data, ms).raw;
        break;
      }
    }
    if (!decode.shouldDecodeSignal(def.sig, muxVal)) continue;

    var dec = decode.decodeSignal(frame.data, def.sig);
    var tMs = frame.tMs;
    if (tMs == null) {
      tMs = tCursor;
      tCursor += 20;
    } else {
      tCursor = tMs;
    }
    points.push({
      tMs: tMs,
      phys: dec.phys,
      raw: dec.raw,
      text: dec.text,
      enumLabel: dec.enumLabel || ''
    });
  }

  return {
    key: key,
    label: def.msg.name + '.' + def.sig.name,
    sigName: def.sig.name,
    msgName: def.msg.name,
    idHex: def.msg.idHex,
    unit: def.sig.unit || '',
    isEnum: !!(def.sig.valueTable && def.sig.valueTable.length),
    pointCount: points.length,
    points: points
  };
}

function downsample(points, maxN) {
  maxN = maxN || 800;
  if (!points || points.length <= maxN) return points || [];
  var step = points.length / maxN;
  var out = [];
  for (var i = 0; i < maxN; i++) {
    out.push(points[Math.floor(i * step)]);
  }
  if (out[out.length - 1] !== points[points.length - 1]) {
    out.push(points[points.length - 1]);
  }
  return out;
}

function fmtMs(ms) {
  if (ms == null || isNaN(ms)) return '0:00.000';
  var total = Math.max(0, Math.floor(ms));
  var mm = Math.floor(total / 60000);
  var ss = Math.floor((total % 60000) / 1000);
  var mss = total % 1000;
  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }
  return mm + ':' + pad(ss, 2) + '.' + pad(mss, 3);
}

module.exports = {
  CHART_COLORS: CHART_COLORS,
  sigKey: sigKey,
  buildSignalIndex: buildSignalIndex,
  searchSignals: searchSignals,
  buildSignalSeries: buildSignalSeries,
  downsample: downsample,
  fmtMs: fmtMs
};
