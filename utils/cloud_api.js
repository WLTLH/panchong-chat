/**
 * 云开发客户端封装（登录 / 上报 / 会员同步）
 */
var cloudConfig = require('./cloud_config.js');

var _inited = false;

function isEnabled() {
  if (cloudConfig.enabled === false) return false;
  if (!wx.cloud) return false;
  var env = getEnvId();
  return !!env;
}

function getEnvId() {
  try {
    var app = getApp();
    if (app && app.globalData && app.globalData.cloudEnvId) {
      return app.globalData.cloudEnvId;
    }
  } catch (e) {}
  return cloudConfig.envId || '';
}

function init() {
  if (_inited) return isEnabled();
  if (!wx.cloud) return false;
  var env = getEnvId();
  if (!env) return false;
  try {
    wx.cloud.init({ traceUser: true, env: env });
    _inited = true;
    return true;
  } catch (e) {
    return false;
  }
}

function callFunction(name, data) {
  return new Promise(function (resolve) {
    if (!init()) {
      resolve({ ok: false, offline: true, reason: 'no_cloud_env' });
      return;
    }
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      success: function (res) {
        resolve((res && res.result) || { ok: false });
      },
      fail: function (err) {
        resolve({ ok: false, err: err, message: (err && err.errMsg) || 'cloud_fail' });
      }
    });
  });
}

function login(action, profile) {
  profile = profile || {};
  return callFunction('login', {
    action: action || 'login',
    nickName: profile.nickName || '',
    avatarUrl: profile.avatarUrl || ''
  });
}

function updateProfile(patch) {
  return callFunction('login', {
    action: 'profile',
    nickName: (patch && patch.nickName) || '',
    avatarUrl: (patch && patch.avatarUrl) || ''
  });
}

function reportAnalysis(report) {
  return callFunction('reportAnalysis', { report: report || {} });
}

function updateVip(enable) {
  return callFunction('updateVip', { enable: !!enable });
}

function syncSession() {
  return callFunction('login', { action: 'sync' });
}

module.exports = {
  isEnabled: isEnabled,
  init: init,
  getEnvId: getEnvId,
  login: login,
  updateProfile: updateProfile,
  reportAnalysis: reportAnalysis,
  updateVip: updateVip,
  syncSession: syncSession
};
