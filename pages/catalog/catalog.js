var gbt = require('../../utils/gbt27930.js');

Page({
  data: {
    q: '',
    stage: '全部',
    manufacturer: '全部',
    stages: ['全部', '握手', '辨识', '参数', '就绪', '充电', '中止', '统计', '错误', '传输', '车内直流相关'],
    manufacturers: ['全部', '国标GB/T27930', '江山', '齐星', '奇瑞轻卡', '天鑫Q22', '奇瑞5021', '奇瑞6460'],
    list: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    var list = gbt.getCatalog({
      stage: this.data.stage,
      q: this.data.q,
      manufacturer: this.data.manufacturer
    }).map(function (item, idx) {
      return Object.assign({}, item, {
        key: (item.manufacturer || '') + '_' + (item.code || '') + '_' + (item.pgn || '') + '_' + idx
      });
    });
    this.setData({ list: list });
  },

  onSearch(e) {
    this.setData({ q: e.detail.value || '' });
    this.refresh();
  },

  onStage(e) {
    this.setData({ stage: e.currentTarget.dataset.stage });
    this.refresh();
  },

  onMfr(e) {
    this.setData({ manufacturer: e.currentTarget.dataset.mfr });
    this.refresh();
  },

  onOpen(e) {
    var code = e.currentTarget.dataset.code;
    wx.navigateTo({ url: '/pages/detail/detail?code=' + encodeURIComponent(code) });
  }
});
