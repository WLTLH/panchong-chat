/**
 * 报文曲线序列：SOC / 电流幅值|I| / 绝缘状态阶跃
 * 另带 pileMaxAbs（CML）供「充电慢」对比曲线
 * 解析全量；仅展示层允许 maxPoints 降采样
 */

var gbt = require('./gbt27930.js');
var chargeSpeed = require('./charge_speed.js');

function buildSeries(logText, opts) {
  opts = opts || {};
  var parsed = gbt.decodeLogText(logText || '');
  var series = [];
  var last = {
    soc: null,
    iOutAbs: null,
    iReqAbs: null,
    pileMaxAbs: null,
    insulState: null,
    insulHeight: null,
    insulLabel: null
  };
  var readable = {
    vin: '待识别(需完整 BRM)',
    batteryType: '待识别(需完整 BRM)',
    soc: '—',
    pileId: '待识别',
    note: '绝缘仅状态位，无 kΩ；国标常用门槛 R≥100Ω/V×Umax 为科普，非本会话测得。'
  };

  parsed.frames.forEach(function (f) {
    if (f.reassembled === false && (f.code === 'TP.CM' || f.code === 'TP.DT')) {
      // still allow metrics from reassembled siblings; skip pure TP for series points unless needed
    }
    var met = f.metrics || {};
    var changed = false;

    if (met.vin) readable.vin = met.vin;
    if (met.batteryType) readable.batteryType = met.batteryType;
    if (met.pileId != null) readable.pileId = String(met.pileId);
    if (met.soc != null) {
      last.soc = Number(met.soc);
      readable.soc = String(Math.round(last.soc)) + '%';
      changed = true;
    }
    if (met.outCurrent != null) {
      last.iOutAbs = gbt.formatCurrentUi(met.outCurrent);
      changed = true;
    }
    if (met.reqCurrent != null) {
      last.iReqAbs = gbt.formatCurrentUi(met.reqCurrent);
      changed = true;
    }
    if (f.code === 'CML' && met.pileMaxCurrent != null) {
      last.pileMaxAbs = gbt.formatCurrentUi(met.pileMaxCurrent);
      changed = true;
    }
    if (met.insulation) {
      last.insulState = met.insulation.state;
      last.insulHeight = met.insulation.height;
      last.insulLabel = met.insulation.label;
      changed = true;
    }

    // sample on charging-related frames or when values change
    var interesting = ['BCL', 'CCS', 'BCS', 'BSM', 'BCP', 'BSD', 'CML'].indexOf(f.code) >= 0 || f.reassembled;
    if (interesting || changed) {
      var t = f.relMs != null ? f.relMs : 0;
      series.push({
        tMs: t,
        soc: last.soc,
        iOutAbs: last.iOutAbs,
        iReqAbs: last.iReqAbs,
        pileMaxAbs: last.pileMaxAbs,
        insulState: last.insulState,
        insulHeight: last.insulHeight,
        insulLabel: last.insulLabel,
        code: f.code
      });
    }
  });

  // ensure at least endpoints
  if (!series.length && parsed.frames.length) {
    series.push({
      tMs: 0,
      soc: null,
      iOutAbs: null,
      iReqAbs: null,
      pileMaxAbs: null,
      insulState: null,
      insulHeight: null,
      insulLabel: null,
      code: ''
    });
  }

  var meta = {
    frameCount: parsed.frameCount,
    totalFrames: parsed.totalFrames,
    pointCount: series.length,
    totalMs: parsed.totalMs,
    codeCounts: parsed.codeCounts
  };

  if (opts.maxPoints && series.length > opts.maxPoints) {
    series = downsample(series, opts.maxPoints);
  }

  var speed = chargeSpeed.analyzeChargeSpeed(logText || '');

  return {
    series: series,
    meta: meta,
    readable: readable,
    totalMs: parsed.totalMs,
    speed: speed
  };
}

function downsample(series, maxPoints) {
  if (!series || series.length <= maxPoints) return series.slice();
  var out = [];
  var n = series.length;
  var step = (n - 1) / (maxPoints - 1);
  for (var i = 0; i < maxPoints; i++) {
    var idx = Math.round(i * step);
    out.push(series[idx]);
  }
  return out;
}

function sliceUntil(series, simMs) {
  if (!series || !series.length) return [];
  var out = [];
  for (var i = 0; i < series.length; i++) {
    if (series[i].tMs <= simMs) out.push(series[i]);
    else break;
  }
  if (!out.length) out.push(series[0]);
  return out;
}

/**
 * 从 27930 日志提取车辆基础信息（连接页实时展示）
 */
function extractVehicleSnapshot(logText) {
  var parsed = gbt.decodeLogText(logText || '');
  var vin = '';
  var soc = null;
  var reqI = null;
  var outI = null;
  var charging = false;

  parsed.frames.forEach(function (f) {
    var m = f.metrics || {};
    if (m.vin) vin = m.vin;
    if (m.soc != null && isFinite(Number(m.soc))) soc = Number(m.soc);
    if (m.reqCurrent != null) reqI = gbt.formatCurrentUi(m.reqCurrent);
    if (m.outCurrent != null) outI = gbt.formatCurrentUi(m.outCurrent);
    if (f.code === 'BCL' || f.code === 'CCS' || f.code === 'BCS') charging = true;
  });

  var hasData = !!(vin || soc != null || reqI != null || outI != null);
  var socPct = soc != null ? Math.max(0, Math.min(100, Math.round(soc))) : 0;
  var socText = soc != null ? String(socPct) : '—';
  var socDisplay = soc != null ? socPct + '%' : '—';

  var currentText = '—';
  var currentSub = '等待 BCL / CCS';
  if (reqI != null && outI != null) {
    currentText = outI.toFixed(1);
    currentSub = '实出 ' + outI.toFixed(1) + ' A · 需求 ' + reqI.toFixed(1) + ' A';
  } else if (outI != null) {
    currentText = outI.toFixed(1);
    currentSub = '桩实出 CCS';
  } else if (reqI != null) {
    currentText = reqI.toFixed(1);
    currentSub = '车需求 BCL';
  }

  var ringDeg = soc != null ? socPct * 3.6 : 0;
  var ringColor = socPct >= 80 ? '#5dde9a' : (socPct >= 30 ? '#7eb6ff' : '#f0c14a');

  return {
    hasData: hasData,
    vin: vin,
    vinText: vin || '待 BRM 辨识',
    vinShort: vin && vin.length > 8 ? (vin.slice(0, 4) + '…' + vin.slice(-4)) : (vin || '—'),
    soc: soc,
    socPct: socPct,
    socText: socText,
    socDisplay: socDisplay,
    reqCurrent: reqI,
    outCurrent: outI,
    currentText: currentText,
    currentSub: currentSub,
    currentUnit: currentText !== '—' ? 'A' : '',
    charging: charging,
    ringStyle: 'background: conic-gradient(' + ringColor + ' ' + ringDeg + 'deg, rgba(255,255,255,0.1) 0deg);',
    ringColor: ringColor
  };
}

module.exports = {
  buildSeries: buildSeries,
  downsample: downsample,
  sliceUntil: sliceUntil,
  extractVehicleSnapshot: extractVehicleSnapshot
};
