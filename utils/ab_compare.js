/**
 * 两段采集对比：异常(A) vs 正常(B)
 * 按 CAN ID 统计出现次数、数据变体、相对频率，找出差异嫌疑
 */
var gbt = require('./gbt27930.js');

var RATE_RATIO_MIN = 1.8; // 频率差阈值（较大/较小）
var MIN_COUNT_FOR_ONLY = 1; // 独有 ID 出现即标重点（偶发故障常见仅 1～几次）

function emptyBucket(idHex, sample) {
  return {
    idHex: idHex,
    count: 0,
    uniqueData: {},
    uniqueCount: 0,
    topData: '',
    topCount: 0,
    code: (sample && sample.code) || '',
    stage: (sample && sample.stage) || '',
    side: (sample && sample.side) || '',
    labelText: (sample && sample.labelText) || '',
    manufacturerText: (sample && sample.manufacturerText) || ''
  };
}

function buildIdStats(parsed) {
  var map = {};
  var frames = (parsed && parsed.frames) || [];
  for (var i = 0; i < frames.length; i++) {
    var f = frames[i];
    if (f.reassembled) continue;
    var idHex = f.idHex || '';
    if (!idHex) continue;
    if (!map[idHex]) map[idHex] = emptyBucket(idHex, f);
    var b = map[idHex];
    b.count++;
    var dh = f.dataHex || '';
    if (dh) {
      b.uniqueData[dh] = (b.uniqueData[dh] || 0) + 1;
      if (b.uniqueData[dh] > b.topCount) {
        b.topCount = b.uniqueData[dh];
        b.topData = dh;
      }
    }
    if (!b.code && f.code) b.code = f.code;
    if (!b.labelText && f.labelText) b.labelText = f.labelText;
    if (!b.manufacturerText && f.manufacturerText) b.manufacturerText = f.manufacturerText;
    if (!b.stage && f.stage) b.stage = f.stage;
    if (!b.side && f.side) b.side = f.side;
  }
  var ids = Object.keys(map);
  for (var j = 0; j < ids.length; j++) {
    map[ids[j]].uniqueCount = Object.keys(map[ids[j]].uniqueData).length;
  }
  return map;
}

function buildCodeStats(parsed) {
  var map = {};
  var frames = (parsed && parsed.frames) || [];
  for (var i = 0; i < frames.length; i++) {
    var f = frames[i];
    var code = f.code || '';
    if (!code || code === 'UNK' || code === 'TP.CM' || code === 'TP.DT') continue;
    if (!map[code]) {
      map[code] = { code: code, count: 0, stage: f.stage || '', name: '' };
    }
    map[code].count++;
  }
  return map;
}

function summarize(text) {
  var parsed = gbt.decodeLogText(text || '');
  var idStats = buildIdStats(parsed);
  var codeStats = buildCodeStats(parsed);
  var durationMs = parsed.totalMs || 0;
  var durationSec = durationMs > 0 ? durationMs / 1000 : 0;
  var idList = Object.keys(idStats);
  return {
    frameCount: parsed.frameCount || 0,
    totalFrames: parsed.totalFrames || 0,
    durationMs: durationMs,
    durationSec: durationSec,
    idCount: idList.length,
    idStats: idStats,
    codeStats: codeStats,
    skipped: parsed.skipped || 0
  };
}

function rateOf(bucket, durationSec) {
  if (!bucket || !bucket.count) return 0;
  if (durationSec > 0.5) return bucket.count / durationSec;
  return bucket.count;
}

function jaccard(setA, setB) {
  var keysA = Object.keys(setA || {});
  var keysB = Object.keys(setB || {});
  if (!keysA.length && !keysB.length) return 1;
  var inter = 0;
  var union = {};
  var i;
  for (i = 0; i < keysA.length; i++) {
    union[keysA[i]] = true;
    if (setB[keysA[i]]) inter++;
  }
  for (i = 0; i < keysB.length; i++) union[keysB[i]] = true;
  var u = Object.keys(union).length;
  return u ? inter / u : 0;
}

function dataDiffHint(a, b) {
  if (!a || !b) return '';
  if (a.topData === b.topData) {
    if (jaccard(a.uniqueData, b.uniqueData) >= 0.85) return '';
    return '数据变体集合不同（主数据相同）';
  }
  return '主数据不同：A=' + (a.topData || '—') + ' / B=' + (b.topData || '—');
}

function labelOf(bucket) {
  if (!bucket) return '';
  if (bucket.labelText) return bucket.labelText;
  if (bucket.code && bucket.code !== 'UNK') return bucket.code;
  return '';
}

function compareSummaries(sumA, sumB) {
  var onlyA = [];
  var onlyB = [];
  var payloadChanged = [];
  var rateChanged = [];
  var codeOnlyA = [];
  var codeOnlyB = [];
  var codeRate = [];

  var idsA = Object.keys(sumA.idStats);
  var idsB = Object.keys(sumB.idStats);
  var seen = {};
  var i;
  var id;
  var a;
  var b;
  var ra;
  var rb;
  var ratio;
  var hint;

  for (i = 0; i < idsA.length; i++) {
    id = idsA[i];
    seen[id] = true;
    a = sumA.idStats[id];
    b = sumB.idStats[id];
    if (!b) {
      onlyA.push({
        kind: 'only_a',
        idHex: id,
        label: labelOf(a),
        code: a.code || '',
        stage: a.stage || '',
        countA: a.count,
        countB: 0,
        rateA: round2(rateOf(a, sumA.durationSec)),
        rateB: 0,
        topDataA: a.topData,
        topDataB: '',
        score: scoreOnly(a.count, true),
        hint: '仅在「异常」段出现'
      });
      continue;
    }
    hint = dataDiffHint(a, b);
    if (hint) {
      payloadChanged.push({
        kind: 'payload',
        idHex: id,
        label: labelOf(a) || labelOf(b),
        code: a.code || b.code || '',
        stage: a.stage || b.stage || '',
        countA: a.count,
        countB: b.count,
        rateA: round2(rateOf(a, sumA.durationSec)),
        rateB: round2(rateOf(b, sumB.durationSec)),
        topDataA: a.topData,
        topDataB: b.topData,
        uniqueA: a.uniqueCount,
        uniqueB: b.uniqueCount,
        jaccard: round2(jaccard(a.uniqueData, b.uniqueData)),
        score: scorePayload(a, b, hint),
        hint: hint
      });
    }
    ra = rateOf(a, sumA.durationSec);
    rb = rateOf(b, sumB.durationSec);
    if (ra > 0.01 && rb > 0.01) {
      ratio = Math.max(ra, rb) / Math.min(ra, rb);
      if (ratio >= RATE_RATIO_MIN && (a.count + b.count) >= 6) {
        rateChanged.push({
          kind: 'rate',
          idHex: id,
          label: labelOf(a) || labelOf(b),
          code: a.code || b.code || '',
          stage: a.stage || b.stage || '',
          countA: a.count,
          countB: b.count,
          rateA: round2(ra),
          rateB: round2(rb),
          ratio: round2(ratio),
          topDataA: a.topData,
          topDataB: b.topData,
          score: scoreRate(ratio, a.count + b.count),
          hint: ra > rb
            ? '异常时更频繁（约 ' + round2(ratio) + 'x）'
            : '正常时更频繁（约 ' + round2(ratio) + 'x）'
        });
      }
    }
  }

  for (i = 0; i < idsB.length; i++) {
    id = idsB[i];
    if (seen[id]) continue;
    b = sumB.idStats[id];
    onlyB.push({
      kind: 'only_b',
      idHex: id,
      label: labelOf(b),
      code: b.code || '',
      stage: b.stage || '',
      countA: 0,
      countB: b.count,
      rateA: 0,
      rateB: round2(rateOf(b, sumB.durationSec)),
      topDataA: '',
      topDataB: b.topData,
      score: scoreOnly(b.count, false),
      hint: '仅在「正常」段出现（异常时缺失）'
    });
  }

  var codesA = Object.keys(sumA.codeStats);
  var codesB = Object.keys(sumB.codeStats);
  var codeSeen = {};
  for (i = 0; i < codesA.length; i++) {
    var c = codesA[i];
    codeSeen[c] = true;
    if (!sumB.codeStats[c]) {
      codeOnlyA.push({
        kind: 'code_only_a',
        code: c,
        stage: sumA.codeStats[c].stage || '',
        countA: sumA.codeStats[c].count,
        countB: 0,
        score: 40 + Math.min(30, sumA.codeStats[c].count),
        hint: '国标报文仅在异常段出现'
      });
    } else {
      var ca = sumA.codeStats[c].count;
      var cb = sumB.codeStats[c].count;
      var r1 = sumA.durationSec > 0.5 ? ca / sumA.durationSec : ca;
      var r2 = sumB.durationSec > 0.5 ? cb / sumB.durationSec : cb;
      if (r1 > 0.01 && r2 > 0.01) {
        var cr = Math.max(r1, r2) / Math.min(r1, r2);
        if (cr >= RATE_RATIO_MIN && ca + cb >= 4) {
          codeRate.push({
            kind: 'code_rate',
            code: c,
            stage: sumA.codeStats[c].stage || sumB.codeStats[c].stage || '',
            countA: ca,
            countB: cb,
            rateA: round2(r1),
            rateB: round2(r2),
            ratio: round2(cr),
            score: 25 + Math.min(25, cr * 5),
            hint: r1 > r2 ? '异常时该报文更频繁' : '正常时该报文更频繁'
          });
        }
      }
    }
  }
  for (i = 0; i < codesB.length; i++) {
    c = codesB[i];
    if (codeSeen[c]) continue;
    codeOnlyB.push({
      kind: 'code_only_b',
      code: c,
      stage: sumB.codeStats[c].stage || '',
      countA: 0,
      countB: sumB.codeStats[c].count,
      score: 45 + Math.min(30, sumB.codeStats[c].count),
      hint: '国标报文仅在正常段出现（异常时缺失）'
    });
  }

  function byScore(x, y) {
    return (y.score || 0) - (x.score || 0);
  }
  onlyA.sort(byScore);
  onlyB.sort(byScore);
  payloadChanged.sort(byScore);
  rateChanged.sort(byScore);
  codeOnlyA.sort(byScore);
  codeOnlyB.sort(byScore);
  codeRate.sort(byScore);

  var highlights = []
    .concat(onlyA.filter(function (x) { return x.countA >= MIN_COUNT_FOR_ONLY; }))
    .concat(onlyB.filter(function (x) { return x.countB >= MIN_COUNT_FOR_ONLY; }))
    .concat(payloadChanged)
    .concat(rateChanged.slice(0, 20))
    .concat(codeOnlyA)
    .concat(codeOnlyB)
    .concat(codeRate.slice(0, 10));
  highlights.sort(byScore);
  highlights = highlights.slice(0, 30);

  return {
    onlyA: onlyA,
    onlyB: onlyB,
    payloadChanged: payloadChanged,
    rateChanged: rateChanged,
    codeOnlyA: codeOnlyA,
    codeOnlyB: codeOnlyB,
    codeRate: codeRate,
    highlights: highlights,
    meta: {
      frameA: sumA.frameCount,
      frameB: sumB.frameCount,
      idA: sumA.idCount,
      idB: sumB.idCount,
      durationA: round2(sumA.durationSec),
      durationB: round2(sumB.durationSec),
      onlyACount: onlyA.length,
      onlyBCount: onlyB.length,
      payloadCount: payloadChanged.length,
      rateCount: rateChanged.length
    }
  };
}

function scoreOnly(count, isFail) {
  var base = isFail ? 55 : 60;
  return base + Math.min(35, count * 2);
}

function scorePayload(a, b, hint) {
  var j = jaccard(a.uniqueData, b.uniqueData);
  var base = hint.indexOf('主数据不同') >= 0 ? 70 : 50;
  return base + Math.round((1 - j) * 25) + Math.min(10, (a.count + b.count) / 10);
}

function scoreRate(ratio, total) {
  return 30 + Math.min(25, (ratio - 1) * 8) + Math.min(10, total / 20);
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

function compareLogs(textA, textB) {
  var sumA = summarize(textA);
  var sumB = summarize(textB);
  var diff = compareSummaries(sumA, sumB);
  return {
    sumA: {
      frameCount: sumA.frameCount,
      durationSec: round2(sumA.durationSec),
      idCount: sumA.idCount,
      skipped: sumA.skipped
    },
    sumB: {
      frameCount: sumB.frameCount,
      durationSec: round2(sumB.durationSec),
      idCount: sumB.idCount,
      skipped: sumB.skipped
    },
    diff: diff
  };
}

/** 演示：同一流程，故意改一帧 ID / 数据 */
function getDemoPair() {
  var common =
    '00:00:00.000 1826F456 01 01 00\n' +
    '00:00:00.250 182756F4 3C 0A\n' +
    '00:00:00.500 1801F456 AA 01 02 03 04 05 06\n' +
    '00:00:01.000 181056F4 64 19 01 00 00 00 00 00\n' +
    '00:00:01.050 1812F456 E8 03 64 00 AA 00 00 00\n' +
    '00:00:01.100 181356F4 00 00 00 00 00 00 00 00\n';
  var failExtra =
    '00:00:01.200 18FF50E5 01 00 00 00 00 00 00 00\n' + // 独有可疑 ID
    '00:00:01.250 181356F4 01 00 00 00 00 00 00 00\n'; // BSM 绝缘异常类数据
  var okExtra =
    '00:00:01.200 181356F4 00 00 00 00 00 00 00 00\n' +
    '00:00:01.300 181C56F4 00 00 00 00 00 00 00 00\n'; // 正常段才有的 BSD
  return {
    a: common + failExtra +
      '00:00:01.400 181056F4 64 19 01 00 00 00 00 00\n' +
      '00:00:01.450 1812F456 E8 03 64 00 AA 00 00 00\n',
    b: common + okExtra +
      '00:00:01.400 181056F4 64 19 01 00 00 00 00 00\n' +
      '00:00:01.450 1812F456 E8 03 64 00 AA 00 00 00\n' +
      '00:00:01.500 181056F4 64 19 01 00 00 00 00 00\n'
  };
}

module.exports = {
  summarize: summarize,
  compareLogs: compareLogs,
  compareSummaries: compareSummaries,
  getDemoPair: getDemoPair
};
