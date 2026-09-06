/**
 * 采集观察项 + 三维倾向评分（辅助，不定责）
 */

var gbt = require('./gbt27930.js');
var bstCst = require('./bst_cst.js');
var stateMachine = require('./state_machine.js');
var verdictRules = require('./verdict_rules.js');

function getObservationOptions(chargeType) {
  return verdictRules.getObservationOptions(chargeType || 'dc');
}

function emptyScores() {
  return { vehicle: 0, pile: 0, connection: 0 };
}

function addScore(scores, lean, w) {
  if (!scores[lean]) scores[lean] = 0;
  scores[lean] += w;
}

function decideVerdict(scores) {
  var v = scores.vehicle || 0;
  var p = scores.pile || 0;
  var c = scores.connection || 0;
  var max = Math.max(v, p, c);
  var sum = v + p + c;

  if (sum === 0) {
    return {
      key: 'insufficient',
      label: '证据不足',
      color: '#8A8A8A',
      summary: '现象与通信证据不足，暂无法给出可靠倾向。建议补充观察项或完整 27930 日志后复判。'
    };
  }

  if (c >= p && c >= v && c >= 3 && (c - Math.max(p, v) >= 1 || c === max)) {
    if (c > Math.max(p, v) || (c === max && c >= 4)) {
      return {
        key: 'connection',
        label: '倾向连接问题',
        color: '#E67E22',
        summary: '连接相关观察/证据领先。建议优先检查插枪到位、锁止、枪口清洁与 CC 电阻，再决定是否换桩复核。'
      };
    }
  }

  if (v >= p + 2 && v >= c) {
    return {
      key: 'vehicle',
      label: '倾向车端',
      color: '#2F6BFF',
      summary: '车端相关分领先。建议保留日志，换已知正常桩复核；仍失败再查车。此为倾向，不定责。'
    };
  }

  if (p >= v + 2 && p >= c) {
    return {
      key: 'pile',
      label: '倾向桩端',
      color: '#07C160',
      summary: '桩端相关分领先。建议换桩/换枪复核；若他桩正常，继续排查本桩兼容与通信。此为倾向，不定责。'
    };
  }

  if (Math.abs(v - p) <= 1 && Math.max(v, p) >= c) {
    return {
      key: 'mixed',
      label: '混杂/略偏' + (v > p ? '车' : (p > v ? '桩' : '双方')),
      color: '#8A8A8A',
      summary: '桩/车证据接近，暂不宜单边定论。建议先排除连接，再交叉换桩复核。'
    };
  }

  if (c === max) {
    return {
      key: 'connection',
      label: '略偏连接',
      color: '#E67E22',
      summary: '连接线索相对突出，但证据有限。建议先复核插接与锁止。'
    };
  }

  if (v === max) {
    return {
      key: 'vehicle',
      label: '略偏车端',
      color: '#2F6BFF',
      summary: '车端线索相对突出，建议换桩复核后再判断。'
    };
  }

  return {
    key: 'pile',
    label: '略偏桩端',
    color: '#07C160',
    summary: '桩端线索相对突出，建议换桩/换枪复核。'
  };
}

function analyzeLogSignals(logText, scores, evidence) {
  if (!logText || !String(logText).trim()) return null;
  var parsed = gbt.decodeLogText(logText);
  var machine = stateMachine.createSessionMachine();
  parsed.frames.forEach(function (f) { machine.feed(f); });
  var snap = machine.finalizeIfIncomplete();

  verdictRules.scoreStopFrames(
    verdictRules.collectLastStopFrames(parsed.frames),
    scores,
    evidence
  );

  // stuck before charge
  if (!snap.finished && !snap.chargeStarted && snap.stepIndex <= 4) {
    addScore(scores, 'connection', 1);
    addScore(scores, 'pile', 1);
    evidence.push({
      tag: 'neutral',
      text: '会话卡在「' + (snap.nodes[snap.stepIndex] && snap.nodes[snap.stepIndex].title) + '」，未见稳定充电循环'
    });
  }

  // insulation abnormal in BSM
  parsed.frames.forEach(function (f) {
    if (f.code === 'BSM' && f.metrics && f.metrics.insulation && f.metrics.insulation.state === 'abnormal') {
      addScore(scores, 'connection', 2);
      evidence.push({ tag: 'connection', text: 'BSM 绝缘状态=异常（仅为状态位，无 kΩ）' });
    }
  });

  // extract stop detail
  var stopInfo = null;
  for (var i = parsed.frames.length - 1; i >= 0; i--) {
    var fr = parsed.frames[i];
    if (fr.code === 'BST' || fr.code === 'CST' || fr.code === 'BEM' || fr.code === 'CEM') {
      var side = bstCst.sideHintFromStop(fr.code, (fr.metrics && (fr.metrics.stop || fr.metrics.error)) || null);
      stopInfo = {
        code: fr.code,
        summary: fr.summary,
        side: side
      };
      break;
    }
  }

  return {
    parsed: parsed,
    session: snap,
    stopInfo: stopInfo,
    codeCounts: parsed.codeCounts,
    frameCount: parsed.frameCount,
    lineCount: parsed.lineCount,
    totalMs: parsed.totalMs
  };
}

function analyze(input) {
  var chargeType = input.chargeType || 'dc';
  var observations = input.observations || [];
  var logText = input.logText || '';
  var note = input.note || '';

  var scores = emptyScores();
  var evidence = [];
  var advice = [];
  var options = getObservationOptions(chargeType);
  var optMap = {};
  options.forEach(function (o) { optMap[o.id] = o; });

  observations.forEach(function (id) {
    var o = optMap[id];
    if (!o) return;
    addScore(scores, o.lean, o.weight);
    evidence.push({ tag: o.lean, text: o.label });
  });

  var sessionPack = null;
  if (chargeType === 'dc' && logText && String(logText).trim()) {
    sessionPack = analyzeLogSignals(logText, scores, evidence);
  } else if (chargeType === 'ac') {
    advice.push('交流慢充通常无 27930 CAN 日志，请以现场现象与车机/桩屏报文为主。');
  } else if (!logText || !String(logText).trim()) {
    advice.push('直流场景建议粘贴完整 27930 日志，以便流程回放与曲线分析。');
  }

  var verdict = decideVerdict(scores);

  // advice by verdict
  if (verdict.key === 'connection') {
    advice.push('检查枪口清洁、插接到位与电子锁；测量 CC1（及 CC2）是否异常。');
    advice.push('排除连接后再换桩复核，避免误判车或桩。');
  } else if (verdict.key === 'pile') {
    advice.push('建议换已知正常直流桩/枪复核。');
    advice.push('若仅本桩失败，收集桩屏报错与完整 CAN 日志。');
  } else if (verdict.key === 'vehicle') {
    advice.push('建议换桩复核；多站仍失败再查车端 BMS/CC 电路。');
    advice.push('保留完整日志中的 BST/BEM/BRM 以便进一步解读。');
  } else {
    advice.push('补充观察项或完整通信日志后复判。');
    advice.push('现场优先确认插枪与锁止可靠。');
  }
  advice.push('本工具为辅助倾向判断，不替代官方诊断与定责。');

  if (note && String(note).trim()) {
    evidence.push({ tag: 'neutral', text: '备注：' + String(note).trim() });
  }

  var logSummary = null;
  if (sessionPack) {
    logSummary = {
      lineCount: sessionPack.lineCount,
      frameCount: sessionPack.frameCount,
      codeCounts: sessionPack.codeCounts,
      totalMs: sessionPack.totalMs
    };
  }

  return {
    chargeType: chargeType,
    verdict: verdict,
    scores: scores,
    evidence: evidence,
    advice: advice,
    session: sessionPack ? sessionPack.session : null,
    stopInfo: sessionPack ? sessionPack.stopInfo : null,
    logSummary: logSummary,
    at: Date.now()
  };
}

function routeAfterAnalyze(result, capture) {
  var hasLog = capture && capture.logText && String(capture.logText).trim();
  if (capture && capture.chargeType === 'dc' && hasLog) {
    return { type: 'dcflow', autoPlay: true };
  }
  return { type: 'result' };
}

module.exports = {
  getObservationOptions: getObservationOptions,
  analyze: analyze,
  routeAfterAnalyze: routeAfterAnalyze
};
