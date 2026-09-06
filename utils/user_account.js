/**
 * 用户资料：优先云开发 openid，无云环境时降级为本地 wx.login + 存储
 */
var cloudApi = require('./cloud_api.js');
var membership = require('./membership.js');

var STORAGE_KEY = 'panchong_user_profile';

function defaultProfile() {
  return {
    userId: '',
    openid: '',
    nickName: '',
    avatarUrl: '',
    registeredAt: 0,
    loginAt: 0,
    loggedIn: false,
    wxSession: ''
  };
}

function getProfile() {
  try {
    var p = wx.getStorageSync(STORAGE_KEY);
    if (p && typeof p === 'object') return Object.assign(defaultProfile(), p);
  } catch (e) {}
  return defaultProfile();
}

function saveProfile(patch) {
  var p = Object.assign(getProfile(), patch || {});
  try {
    wx.setStorageSync(STORAGE_KEY, p);
  } catch (e) {}
  return p;
}

function isRegistered() {
  var p = getProfile();
  if (p.registeredAt && p.userId) return true;
  if (p.userId && p.loginAt > 0) {
    saveProfile({ registeredAt: p.loginAt });
    return true;
  }
  return false;
}

function ensureUserId() {
  var p = getProfile();
  if (!p.userId) {
    p.userId = 'PC' + Date.now().toString(36).toUpperCase().slice(-8);
    saveProfile(p);
  }
  return getProfile();
}

function formatLoginTime(ts) {
  if (!ts) return '—';
  var d = new Date(ts);
  var y = d.getFullYear();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  var hh = ('0' + d.getHours()).slice(-2);
  var mm = ('0' + d.getMinutes()).slice(-2);
  return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
}

function maskUserId(userId) {
  if (!userId || userId.length < 4) return userId || '—';
  return userId.slice(0, 2) + '****' + userId.slice(-2);
}

function wxAuthSession(done) {
  wx.login({
    success: function (res) {
      if (!res.code) {
        if (typeof done === 'function') done(false, 'no_code');
        return;
      }
      if (typeof done === 'function') done(true, res.code);
    },
    fail: function () {
      if (typeof done === 'function') done(false, 'wx_fail');
    }
  });
}

function mergeCloudUser(res, localPatch) {
  var patch = Object.assign({}, localPatch || {});
  if (res.userId) patch.userId = res.userId;
  if (res.nickName != null && res.nickName !== '') patch.nickName = res.nickName;
  if (res.avatarUrl != null && res.avatarUrl !== '') patch.avatarUrl = res.avatarUrl;
  if (res.registeredAt) patch.registeredAt = res.registeredAt;
  patch.loggedIn = true;
  patch.loginAt = res.lastLoginAt || Date.now();
  patch.wxSession = 'ok';
  if (res.openid) patch.openid = res.openid;
  var p = saveProfile(patch);
  if (res.isVip != null) membership.setVip(!!res.isVip, { skipCloud: true });
  return p;
}

function registerLocal(done) {
  var now = Date.now();
  var p = ensureUserId();
  p.registeredAt = now;
  p.loggedIn = true;
  p.loginAt = now;
  p.wxSession = 'ok';
  saveProfile(p);
  if (typeof done === 'function') done(true, 'ok', getProfile());
}

function loginLocal(done) {
  var p = getProfile();
  p.loggedIn = true;
  p.loginAt = Date.now();
  p.wxSession = 'ok';
  saveProfile(p);
  if (typeof done === 'function') done(true, 'ok', getProfile());
}

function register(done) {
  if (isRegistered()) {
    if (typeof done === 'function') done(false, 'already_registered', getProfile());
    return;
  }
  wxAuthSession(function (ok) {
    if (!ok) {
      if (typeof done === 'function') done(false, 'wx_fail', getProfile());
      return;
    }
    if (!cloudApi.isEnabled()) {
      registerLocal(done);
      return;
    }
    var profile = getProfile();
    cloudApi.login('register', {
      nickName: profile.nickName,
      avatarUrl: profile.avatarUrl
    }).then(function (res) {
      if (res.ok) {
        mergeCloudUser(res, { registeredAt: res.registeredAt || Date.now() });
        if (typeof done === 'function') done(true, 'ok', getProfile());
        return;
      }
      registerLocal(done);
    });
  });
}

function login(done) {
  if (!isRegistered()) {
    if (typeof done === 'function') done(false, 'not_registered', getProfile());
    return;
  }
  wxAuthSession(function (ok) {
    if (!ok) {
      if (typeof done === 'function') done(false, 'wx_fail', getProfile());
      return;
    }
    if (!cloudApi.isEnabled()) {
      loginLocal(done);
      return;
    }
    var profile = getProfile();
    cloudApi.login('login', {
      nickName: profile.nickName,
      avatarUrl: profile.avatarUrl
    }).then(function (res) {
      if (res.ok) {
        mergeCloudUser(res, {});
        if (typeof done === 'function') done(true, 'ok', getProfile());
        return;
      }
      if (res.err === 'not_registered') {
        if (typeof done === 'function') done(false, 'not_registered', getProfile());
        return;
      }
      loginLocal(done);
    });
  });
}

function syncFromCloud(done) {
  if (!cloudApi.isEnabled() || !isRegistered() || !getProfile().loggedIn) {
    if (typeof done === 'function') done(false);
    return;
  }
  cloudApi.syncSession().then(function (res) {
    if (res.ok) mergeCloudUser(res, {});
    if (typeof done === 'function') done(!!res.ok);
  });
}

function logout() {
  var p = getProfile();
  saveProfile({
    userId: p.userId,
    openid: p.openid,
    registeredAt: p.registeredAt,
    nickName: p.nickName,
    avatarUrl: p.avatarUrl,
    loginAt: 0,
    loggedIn: false,
    wxSession: ''
  });
  return getProfile();
}

function pushProfileToCloud(patch) {
  if (!cloudApi.isEnabled() || !getProfile().loggedIn) return;
  cloudApi.updateProfile(patch || {});
}

function updateNickName(nickName) {
  if (!getProfile().loggedIn) return getProfile();
  var p = saveProfile({ nickName: nickName || '' });
  pushProfileToCloud({ nickName: p.nickName });
  return p;
}

function updateAvatar(avatarUrl) {
  if (!getProfile().loggedIn) return getProfile();
  var p = saveProfile({ avatarUrl: avatarUrl || '' });
  pushProfileToCloud({ avatarUrl: p.avatarUrl });
  return p;
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  getProfile: getProfile,
  saveProfile: saveProfile,
  isRegistered: isRegistered,
  ensureUserId: ensureUserId,
  formatLoginTime: formatLoginTime,
  maskUserId: maskUserId,
  register: register,
  login: login,
  logout: logout,
  syncFromCloud: syncFromCloud,
  updateNickName: updateNickName,
  updateAvatar: updateAvatar
};
