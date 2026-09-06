/**
 * 分析结果摘要上报（不含完整 CAN 原文）
 */
var cloudApi = require('./cloud_api.js');
var membership = require('./membership.js');

function appVersion() {
  try {
    var app = getApp();
    return (app && app.globalData && app.globalData.version) || '';
  } catch (e) {
    return '';
  }
}

function buildFaultReport(analysis, capture) {
  var a = analysis || {};
  var c = capture || {};
  var v = a.verdict || {};
  var scores = a.scores || {};
  var stop = a.stopInfo || null;
  var log = a.logSummary || {};
  var free = membership.toFreeVerdict(a);
  return {
    kind: 'fault',
    chargeType: c.chargeType || 'dc',
    verdictKey: v.key || '',
    verdictLabel: v.label || '',
    freeKey: free.key || '',
    freeTitle: free.title || '',
    scoreVehicle: scores.vehicle || 0,
    scorePile: scores.pile || 0,
    scoreConnection: scores.connection || 0,
    stopCode: stop ? stop.code : '',
    stopSide: stop ? stop.side : '',
    frameCount: log.frameCount || 0,
    lineCount: log.lineCount || 0,
    observationCount: (c.observations && c.observations.length) || 0,
    note: c.note ? String(c.note).slice(0, 120) : '',
    appVersion: appVersion(),
    clientAt: Date.now()
  };
}

function buildSpeedReport(speed) {
  var s = speed || {};
  var n = s.numbers || {};
  var free = membership.toFreeSpeed(s);
  return {
    kind: 'speed',
    speedKey: s.key || '',
    speedLabel: s.label || '',
    speedLean: s.lean || '',
    freeKey: free.key || '',
    freeTitle: free.title || '',
    avgReqA: n.avgReqA,
    avgOutA: n.avgOutA,
    gapA: n.gapA,
    pileMaxA: n.pileMaxA,
    soc: n.soc,
    batteryType: n.batteryType || '',
    maxCellV: n.maxCellV,
    cellAlertSoc: n.cellAlertSoc,
    hasCellAlert: !!(s.cellAlert),
    bclCount: n.bclCount || 0,
    ccsCount: n.ccsCount || 0,
    appVersion: appVersion(),
    clientAt: Date.now()
  };
}

function sendReport(report) {
  if (!report || !cloudApi.isEnabled()) return Promise.resolve({ ok: false, skipped: true });
  return cloudApi.reportAnalysis(report).then(function (res) {
    if (!res.ok && !res.offline) {
      console.warn('[cloud_report]', res.message || res.err);
    }
    return res;
  });
}

function reportFault(analysis, capture) {
  return sendReport(buildFaultReport(analysis, capture));
}

function reportSpeed(speed) {
  return sendReport(buildSpeedReport(speed));
}

module.exports = {
  buildFaultReport: buildFaultReport,
  buildSpeedReport: buildSpeedReport,
  reportFault: reportFault,
  reportSpeed: reportSpeed
};
