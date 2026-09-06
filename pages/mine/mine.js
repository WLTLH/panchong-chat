var membership = require('../../utils/membership.js');
var userAccount = require('../../utils/user_account.js');
var ble = require('../../utils/ble_session.js');

Page({
  data: {
    appName: '判充',
    version: '1.0.0',
    authTab: 'register',
    nickName: '',
    avatarUrl: '',
    userId: '',
    maskedUserId: '',
    loginAtText: '—',
    loggedIn: false,
    isRegistered: false,
    isVip: false,
    vipLabel: '免费版',
    bleConnected: false,
  },

  onShow() {
    var app = getApp();
    var that = this;
    userAccount.syncFromCloud(function () {
      that.refresh();
    });
    this.refresh();
    this.setData({
      appName: app.globalData.appName,
      version: app.globalData.version
    });
  },

  refresh() {
    var p = userAccount.getProfile();
    var registered = userAccount.isRegistered();
    var vip = membership.isVip();
    var s = ble.state();
    var authTab = this.data.authTab;
    if (registered && !p.loggedIn && authTab === 'register') {
      authTab = 'login';
    }
    this.setData({
      authTab: authTab,
      nickName: p.nickName || '',
      avatarUrl: p.avatarUrl || '',
      userId: p.userId || '—',
      maskedUserId: userAccount.maskUserId(p.userId),
      loginAtText: p.loggedIn ? userAccount.formatLoginTime(p.loginAt) : '未登录',
      loggedIn: !!p.loggedIn,
      isRegistered: registered,
      isVip: vip,
      vipLabel: vip ? '会员' : '免费版',
      bleConnected: !!s.connected
    });
  },

  onAuthTab(e) {
    var tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.authTab) return;
    this.setData({ authTab: tab });
  },

  onWeChatAuth() {
    var that = this;
    var isRegister = this.data.authTab === 'register';
    wx.showLoading({ title: isRegister ? '注册中' : '登录中' });

    var handler = isRegister ? userAccount.register : userAccount.login;
    handler(function (ok, reason) {
      wx.hideLoading();
      if (ok) {
        that.refresh();
        wx.showToast({
          title: isRegister ? '注册成功' : '登录成功',
          icon: 'success'
        });
        return;
      }
      if (reason === 'already_registered') {
        that.setData({ authTab: 'login' });
        wx.showToast({ title: '已注册，请登录', icon: 'none' });
        return;
      }
      if (reason === 'not_registered') {
        that.setData({ authTab: 'register' });
        wx.showToast({ title: '请先注册', icon: 'none' });
        return;
      }
      wx.showToast({
        title: isRegister ? '注册失败' : '登录失败',
        icon: 'none'
      });
    });
  },

  onLogout() {
    var that = this;
    wx.showModal({
      title: '退出登录？',
      content: '退出后需重新微信登录，账号与会员状态仍保留在本机。',
      success: function (res) {
        if (!res.confirm) return;
        userAccount.logout();
        that.refresh();
        wx.showToast({ title: '已退出', icon: 'none' });
      }
    });
  },

  onChooseAvatar(e) {
    var url = e.detail && e.detail.avatarUrl;
    if (!url) return;
    userAccount.updateAvatar(url);
    this.refresh();
  },

  onNickInput(e) {
    var v = e.detail.value || '';
    userAccount.updateNickName(v);
    this.setData({ nickName: v });
  },

  onGoVip() {
    wx.navigateTo({ url: '/pages/vip/vip' });
  },

  onGoHome() {
    wx.navigateTo({ url: '/pages/home/home' });
  },

  onGoBle() {
    wx.switchTab({ url: '/pages/dcflow/dcflow' });
  }
});
