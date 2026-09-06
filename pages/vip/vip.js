var membership = require('../../utils/membership.js');

Page({
  data: { isVip: false },

  onShow: function () {
    this.setData({ isVip: membership.isVip() });
  },

  onUnlock: function () {
    membership.setVip(true);
    this.setData({ isVip: true });
    wx.showToast({ title: '已开通会员', icon: 'success' });
  },

  onLock: function () {
    membership.setVip(false);
    this.setData({ isVip: false });
    wx.showToast({ title: '已切回免费', icon: 'none' });
  }
});
