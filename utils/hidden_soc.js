/**
 * 隐藏电量 / 表显 SOC 与真实状态偏差 — 启发式识别
 * 数据：27930 BRM + BCS（+ CCS 充电段），辅助倾向，非精确 SOC 标定
 */
var lfpRules = require('./lfp_battery_rules.js');
var batteryChem = require('./battery_chemistry.js');

/** LFP 充电 OCV 参考（25℃，来自 302Ah 类规格趋势，用于推算） */
var LFP_OCV_CHARGE = [
  [5, 3.18], [10, 3.22], [20, 3.27], [30, 3.29], [40, 3.30],
  [50, 3.32], [60, 3.34], [70, 3.36], [80, 3.40], [90, 3.48], [95, 3.55]
];

function round1(n) {
  return Math.round(n * 10) / 10;
}

function estimateLfpSocFromCellV(cellV) {
  if (cellV == null || !isFinite(cellV)) return null;
  if (cellV <= LFP_OCV_CHARGE[0][1]) return LFP_OCV_CHARGE[0][0];
  var last = LFP_OCV_CHARGE[LFP_OCV_CHARGE.length - 1];
  if (cellV >= last[1]) return last[0];
  for (var i = 1; i < LFP_OCV_CHARGE.length; i++) {
    var lo = LFP_OCV_CHARGE[i - 1];
    var hi = LFP_OCV_CHARGE[i];
    if (cellV <= hi[1]) {
      var t = (cellV - lo[1]) / (hi[1] - lo[1]);
      return lo[0] + t * (hi[0] - lo[0]);
    }
  }
  return null;
}

function collectSeries(frames) {
  var meta = {
    batteryType: '',
    batteryTypeCode: null,
    ratedCapacityAh: null
  };
  var bcs = [];
  var ccs = [];

  (frames || []).forEach(function (f) {
    var m = f.metrics || {};
    if (f.code === 'BRM') {
      if (m.batteryType) meta.batteryType = m.batteryType;
      if (m.batteryTypeCode != null) meta.batteryTypeCode = m.batteryTypeCode;
      if (m.ratedCapacityAh != null) meta.ratedCapacityAh = m.ratedCapacityAh;
    }
    if (f.code === 'BCS') {
      if (m.soc == null) return;
      bcs.push({
        t: f.relMs != null ? f.relMs : (f.tMs || 0),
        soc: Number(m.soc),
        cellV: m.maxCellVoltage != null ? Number(m.maxCellVoltage) : null,
        packV: m.measVoltage != null ? Number(m.measVoltage) : null,
        i: m.measCurrent != null ? Math.abs(m.measCurrent) : null
      });
    }
    if (f.code === 'CCS' && m.outCurrent != null) {
      ccs.push({
        t: f.relMs != null ? f.relMs : (f.tMs || 0),
        i: Math.abs(m.outCurrent)
      });
    }
  });

  return { meta: meta, bcs: bcs, ccs: ccs };
}

function hint(id, label, confidence, evidenceText, adviceText, extra) {
  return Object.assign({
    id: id,
    label: label,
    confidence: confidence,
    evidenceText: evidenceText,
    adviceText: adviceText
  }, extra || {});
}

/**
 * @param {Array} frames
 * @returns {{ detected: boolean, hints: Array, primary: object|null, summary: string }}
 */
function detectHiddenSocHints(frames) {
  var series = collectSeries(frames);
  var bcs = series.bcs;
  var hints = [];

  if (bcs.length < 4) {
    return { detected: false, hints: [], primary: null, summary: '' };
  }

  var meta = series.meta;
  var chem = batteryChem.resolveChemistry(frames);
  var lfp = batteryChem.isLfpChemistry(chem);

  // 1) 表显已满仍在补电（顶部隐藏区间）
  var topHits = 0;
  bcs.forEach(function (p) {
    if (p.soc >= 98 && p.i != null && p.i >= 3) topHits += 1;
  });
  if (topHits >= 3) {
    hints.push(hint(
      'top_buffer',
      '疑顶部隐藏电量',
      '中',
      'SOC≥98% 时仍有 ≥3A 充电电流（' + topHits + ' 帧）',
      '表显接近满电仍在补电，常见为顶部保留容量未计入表显 SOC。',
      { zone: 'top' }
    ));
  }

  // 2) 表显极低但电压正常（底部保留）
  if (lfp) {
    var bottomHits = 0;
    bcs.forEach(function (p) {
      if (p.soc <= 5 && p.cellV != null && p.cellV >= 2.95) bottomHits += 1;
    });
    if (bottomHits >= 2) {
      hints.push(hint(
        'bottom_reserve',
        '疑底部隐藏电量',
        '中',
        'SOC≤5% 但最高单体仍 ≥2.95V（' + bottomHits + ' 帧）',
        '表显电量很低但电压仍在 LFP 可用区，可能存在底部未显示的保留 SOC。',
        { zone: 'bottom' }
      ));
    }
  }

  // 3) 充电中 SOC 长时间不动但电流不小
  var stuckBest = null;
  for (var i = 1; i < bcs.length; i++) {
    var a = bcs[i - 1];
    var b = bcs[i];
    var dt = (b.t - a.t) / 1000;
    if (dt < 8 || dt > 120) continue;
    if (Math.abs(b.soc - a.soc) > 0.5) continue;
    var avgI = ((a.i || 0) + (b.i || 0)) / 2;
    if (avgI < 8) continue;
    if (!stuckBest || dt > stuckBest.dt) stuckBest = { dt: dt, soc: b.soc, i: avgI };
  }
  if (stuckBest && stuckBest.dt >= 25) {
    hints.push(hint(
      'soc_stuck_charging',
      '疑表显 SOC 卡住',
      '中',
      'SOC 维持 ' + round1(stuckBest.soc) + '% 约 ' + Math.round(stuckBest.dt) + 's，电流仍约 ' + round1(stuckBest.i) + 'A',
      '充电进行中表显 SOC 不动，可能在充隐藏区间或 BMS 延迟刷新表显。',
      { zone: 'mid' }
    ));
  }

  // 4) LFP：电压推算 SOC 与表显偏差
  if (lfp) {
    var gaps = [];
    bcs.forEach(function (p) {
      if (p.cellV == null || p.soc == null) return;
      if (p.soc < 15 || p.soc > 92) return;
      var est = estimateLfpSocFromCellV(p.cellV);
      if (est == null) return;
      gaps.push({ soc: p.soc, est: est, gap: est - p.soc, cellV: p.cellV });
    });
    if (gaps.length >= 3) {
      gaps.sort(function (x, y) { return Math.abs(y.gap) - Math.abs(x.gap); });
      var g = gaps[0];
      if (Math.abs(g.gap) >= 12) {
        var dir = g.gap > 0 ? '高于' : '低于';
        hints.push(hint(
          'lfp_voltage_soc_gap',
          '疑表显 SOC 偏差',
          '低',
          'SOC ' + round1(g.soc) + '% 时单体 ' + round1(g.cellV) + 'V，按 LFP 曲线推算约 ' + round1(g.est) + '%（表显' + dir + '推算 ' + round1(Math.abs(g.gap)) + '%）',
          '磷酸铁锂平台区电压与表显 SOC 不一致，可能有隐藏电量或 SOC 标定偏移；仅作线索，需结合温度与完整充电曲线。',
          { zone: g.gap > 0 ? 'under_reported' : 'over_reported', gapPct: round1(g.gap) }
        ));
      }
    }
  }

  // 5) 安时积分 vs SOC 变化（需 BRM 额定容量 + 足够时长）
  if (meta.ratedCapacityAh && meta.ratedCapacityAh > 10 && bcs.length >= 6) {
    var t0 = bcs[0];
    var t1 = bcs[bcs.length - 1];
    var spanSec = (t1.t - t0.t) / 1000;
    if (spanSec >= 90) {
      var ah = 0;
      for (var j = 1; j < bcs.length; j++) {
        var dt2 = (bcs[j].t - bcs[j - 1].t) / 1000;
        if (dt2 <= 0 || dt2 > 30) continue;
        var i2 = bcs[j].i != null ? bcs[j].i : 0;
        ah += i2 * dt2 / 3600;
      }
      var dSoc = t1.soc - t0.soc;
      var expectedAh = (dSoc / 100) * meta.ratedCapacityAh;
      if (ah >= meta.ratedCapacityAh * 0.04 && Math.abs(dSoc) < 2 && ah > expectedAh * 2.5) {
        hints.push(hint(
          'ah_soc_mismatch',
          '疑隐藏区间充电',
          '低',
          '约 ' + Math.round(spanSec) + 's 充入 ~' + round1(ah) + 'Ah，表显 SOC 仅变化 ' + round1(dSoc) + '%（额定 ' + round1(meta.ratedCapacityAh) + 'Ah）',
          '充入安时与表显 SOC 变化不匹配，可能在充未显示的隐藏容量。',
          { ah: round1(ah), dSoc: round1(dSoc) }
        ));
      }
    }
  }

  if (!hints.length) {
    return { detected: false, hints: [], primary: null, summary: '' };
  }

  var order = { high: 0, '中': 1, 低: 2 };
  hints.sort(function (a, b) {
    return (order[a.confidence] || 9) - (order[b.confidence] || 9);
  });

  var primary = hints[0];
  return {
    detected: true,
    hints: hints,
    primary: primary,
    summary: primary.label + '：' + primary.evidenceText
  };
}

module.exports = {
  detectHiddenSocHints: detectHiddenSocHints,
  estimateLfpSocFromCellV: estimateLfpSocFromCellV
};
