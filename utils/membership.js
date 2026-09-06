/**
 * 会员闸：免费只给「车端 / 桩端 / 建议换桩」三结论
 * 详细依据、曲线解读、阶段报文等需会员
 *
 * 当前用本地开关模拟开通（后续可接支付回调 setVip(true)）
 */

var verdictRules = require('./verdict_rules.js');

var STORAGE_KEY = 'panchong_vip';

function isVip() {
  try {
    if (wx.getStorageSync(STORAGE_KEY)) return true;
  } catch (e) {}
  try {
    var app = getApp();
    if (app && app.globalData && app.globalData.isVip) return true;
  } catch (e2) {}
  return false;
}

function setVip(on, opts) {
  opts = opts || {};
  var v = !!on;
  try {
    wx.setStorageSync(STORAGE_KEY, v ? 1 : 0);
  } catch (e) {}
  try {
    var app = getApp();
    if (app && app.globalData) app.globalData.isVip = v;
  } catch (e2) {}
  if (!opts.skipCloud) {
    try {
      var cloudApi = require('./cloud_api.js');
      if (cloudApi.isEnabled()) cloudApi.updateVip(v);
    } catch (e3) {}
  }
  return v;
}

/**
 * 把完整分析结果压成免费三结论之一
 * @returns {{ key:'vehicle'|'pile'|'swap', title:string, desc:string, color:string }}
 */
function toFreeVerdict(analysis) {
  return verdictRules.resolveFreeVerdict(analysis);
}

/** 充电慢判定 → 免费三结论 */
function toFreeSpeed(speed) {
  if (speed && speed.cellAlert) {
    return freePack('vehicle', '建议检查高压电池', speed.cellAlert.adviceText + ' 开通会员查看完整曲线分析。');
  }
  if (speed && speed.hiddenSoc && speed.hiddenSoc.detected && speed.hiddenSoc.primary) {
    var h = speed.hiddenSoc.primary;
    return freePack('vehicle', h.label || '疑有隐藏电量', h.evidenceText + '。开通会员查看完整曲线分析。');
  }
  if (!speed || speed.key === 'insufficient') {
    return freePack('swap', '建议换桩', '暂无法判断慢在哪边。可换桩对比，或开通会员查看 BCL/CML/CCS 详情。');
  }
  if (speed.lean === 'vehicle' || speed.key === 'vehicle_limit' || speed.key === 'taper') {
    return freePack('vehicle', '车端问题', '充电偏慢更像车端限流/策略。开通会员查看需求与实出曲线说明。');
  }
  if (speed.lean === 'pile' || speed.key === 'pile_cap' || speed.key === 'pile_under') {
    return freePack('pile', '桩端问题', '充电偏慢更像桩端能力或未跟需求。开通会员查看曲线说明。');
  }
  return freePack('swap', '建议换桩', '慢因可能在车也可能在桩。建议换桩对比；详情需会员。');
}

function freePack(key, title, desc) {
  var color = key === 'vehicle' ? '#2F6BFF' : (key === 'pile' ? '#07C160' : '#E67E22');
  return { key: key, title: title, desc: desc, color: color };
}

/** 展示用：会员看完整，免费看三结论 */
function presentVerdict(analysis) {
  if (isVip()) {
    var v = (analysis && analysis.verdict) || {};
    return {
      isVip: true,
      free: false,
      title: v.label || '分析完成',
      desc: v.summary || '',
      color: v.color || '#07C160',
      key: v.key || '',
      locked: false
    };
  }
  var f = toFreeVerdict(analysis);
  return {
    isVip: false,
    free: true,
    title: f.title,
    desc: f.desc,
    color: f.color,
    key: f.key,
    locked: true
  };
}

module.exports = {
  isVip: isVip,
  setVip: setVip,
  toFreeVerdict: toFreeVerdict,
  toFreeSpeed: toFreeSpeed,
  presentVerdict: presentVerdict,
  STORAGE_KEY: STORAGE_KEY
};
