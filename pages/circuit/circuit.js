Page({
  data: {
    tab: 'wire', // wire | dual | single
    confirmNote: '请对照现场核对：供电是否走 OBD-16、充电 CAN 是否接枪 S+/S-、整车 CAN 是否接 OBD 6/14。'
  },

  onTab(e) {
    var t = e.currentTarget.dataset.tab;
    if (t) this.setData({ tab: t });
  },

  preview(e) {
    var src = e.currentTarget.dataset.src;
    if (!src) return;
    wx.previewImage({
      current: src,
      urls: [
        '/assets/circuit/dual_overview.png',
        '/assets/circuit/single_overview.png'
      ]
    });
  }
});
