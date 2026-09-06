const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const ALLOWED = {
  kind: true,
  chargeType: true,
  verdictKey: true,
  verdictLabel: true,
  freeKey: true,
  freeTitle: true,
  scoreVehicle: true,
  scorePile: true,
  scoreConnection: true,
  stopCode: true,
  stopSide: true,
  frameCount: true,
  lineCount: true,
  observationCount: true,
  note: true,
  speedKey: true,
  speedLabel: true,
  speedLean: true,
  avgReqA: true,
  avgOutA: true,
  gapA: true,
  pileMaxA: true,
  soc: true,
  batteryType: true,
  maxCellV: true,
  cellAlertSoc: true,
  hasCellAlert: true,
  bclCount: true,
  ccsCount: true,
  appVersion: true,
  clientAt: true
};

function pickReport(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach(function (k) {
    if (ALLOWED[k]) out[k] = raw[k];
  });
  return out;
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, err: 'no_openid' };

  const report = pickReport((event && event.report) || {});
  if (!report.kind) return { ok: false, err: 'missing_kind' };

  await db.collection('analysis_reports').add({
    data: Object.assign({}, report, {
      _openid: openid,
      createdAt: db.serverDate()
    })
  });

  return { ok: true };
};
