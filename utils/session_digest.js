/**
 * 把 27930 日志压成连接页/工具页可读的摘要（模拟与真机共用）
 */
var gbt = require('./gbt27930.js');
var dcFlow = require('./dc_flow.js');
var dcSeries = require('./dc_series.js');
var bstCst = require('./bst_cst.js');
var verdictRules = require('./verdict_rules.js');

var KEY_CODES = ['CEM', 'BEM', 'CST', 'BST', 'BSD', 'CSD'];

function lastFrame(frames, code) {
  for (var i = frames.length - 1; i >= 0; i--) {
    if (frames[i].code === code) return frames[i];
  }
  return null;
}

function decodeStopLine(fr) {
  if (!fr || !fr.data) return '';
  try {
    if (fr.code === 'CST') {
      var c = bstCst.decodeCst(fr.data);
      return (c.reasons && c.reasons[0]) || c.summary || '';
    }
    if (fr.code === 'BST') {
      var b = bstCst.decodeBst(fr.data);
      return (b.reasons && b.reasons[0]) || b.summary || '';
    }
    if (fr.code === 'BEM') {
      var be = bstCst.decodeBem(fr.data);
      return (be.reasons && be.reasons[0]) || '';
    }
    if (fr.code === 'CEM') {
      var ce = bstCst.decodeCem(fr.data);
      return (ce.reasons && ce.reasons[0]) || '';
    }
  } catch (e) {}
  return fr.dataHex || '';
}

function topCodeSummary(codeCounts, limit) {
  limit = limit || 10;
  var counts = codeCounts || {};
  var keys = Object.keys(counts).filter(function (c) {
    return c !== 'UNK' && c !== 'TP.CM' && c !== 'TP.DT' && counts[c] > 0;
  });
  keys.sort(function (a, b) { return counts[b] - counts[a]; });
  return keys.slice(0, limit).map(function (c) {
    return c + '×' + counts[c];
  }).join('  ');
}

function buildDigest(logText) {
  logText = String(logText || '').trim();
  if (!logText) {
    return {
      empty: true,
      headline: '还没有报文',
      rows: [],
      alerts: [],
      codeLine: '',
      stageLine: '',
      verdictLine: ''
    };
  }

  var parsed = gbt.decodeLogText(logText);
  var pack = dcFlow.analyzeDcFlow(logText);
  var snap = dcSeries.extractVehicleSnapshot(logText);
  var session = pack.session || {};
  var nodes = session.nodes || [];
  var rows = [];
  var alerts = [];

  rows.push({ label: '总帧', value: String(pack.totalFrames || parsed.totalFrames || 0) });
  var codeLine = topCodeSummary(parsed.codeCounts, 12);
  if (codeLine) rows.push({ label: '报文种类', value: codeLine });

  if (snap.soc != null) {
    rows.push({ label: 'SOC', value: snap.socDisplay + (snap.charging ? ' · 充电中' : '') });
  }
  if (snap.currentText !== '—') {
    rows.push({ label: '电流', value: snap.currentText + ' A · ' + snap.currentSub });
  }
  if (snap.vin && snap.vin !== '待 BRM 辨识') {
    rows.push({ label: 'VIN', value: snap.vinShort || snap.vin });
  }

  var stageLine = '';
  if (session.error) {
    stageLine = '通信错误';
    var errCode = (session.stopEvent && session.stopEvent.code) || 'BEM/CEM';
    rows.push({ label: '阶段', value: stageLine + ' · ' + errCode });
  } else if (session.finished) {
    stageLine = session.stopEvent && session.stopEvent.code
      ? ('已结束 · ' + session.stopEvent.code)
      : '会话结束';
    rows.push({ label: '阶段', value: stageLine });
  } else if (session.chargeStarted) {
    stageLine = '充电中 · 已见 BCL/CCS/BCS';
    rows.push({ label: '阶段', value: stageLine });
  } else {
    var active = nodes[session.stepIndex] || nodes[0];
    if (active) {
      stageLine = active.title || '握手中';
      var seen = (active.seenCodes || []).filter(Boolean);
      rows.push({
        label: '阶段',
        value: stageLine + (seen.length ? (' · ' + seen.join('/')) : '')
      });
    }
  }

  KEY_CODES.forEach(function (code) {
    var fr = lastFrame(parsed.frames || [], code);
    if (!fr) return;
    var detail = decodeStopLine(fr);
    alerts.push({
      code: code,
      time: fr.timeLabel || '',
      data: fr.dataHex || '',
      text: detail || code + ' 出现'
    });
  });

  var verdictLine = '';
  try {
    var analyze = require('./analyze.js');
    var result = analyze.analyze({
      chargeType: 'dc',
      observations: [],
      logText: logText
    });
    var free = verdictRules.resolveFreeVerdict(result);
    verdictLine = free.title || (result.verdict && result.verdict.label) || '';
    if (result.evidence && result.evidence.length) {
      var ev0 = result.evidence[0].text;
      if (ev0) verdictLine += ' · ' + ev0;
    }
  } catch (e2) {}

  var headlineParts = [];
  if (stageLine) headlineParts.push(stageLine);
  if (snap.soc != null) headlineParts.push('SOC ' + snap.socDisplay);
  if (verdictLine) headlineParts.push(verdictLine.split('·')[0].trim());
  if (!headlineParts.length) headlineParts.push(codeLine || '已收到报文');

  return {
    empty: false,
    headline: headlineParts.join(' · '),
    rows: rows,
    alerts: alerts,
    codeLine: codeLine,
    stageLine: stageLine,
    verdictLine: verdictLine,
    stages: nodes.map(function (n) {
      return {
        title: n.title,
        status: n.status,
        seen: (n.seenCodes || []).filter(Boolean).join(' ')
      };
    })
  };
}

module.exports = {
  buildDigest: buildDigest,
  topCodeSummary: topCodeSummary
};
