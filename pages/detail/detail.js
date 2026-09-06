var gbt = require('../../utils/gbt27930.js');

var EXAMPLE = {
  CHM: '1826F456 01 01 00',
  BHM: '182756F4 3C 0A',
  CRM: '1801F456 AA 01 02 03 31 32 33 34',
  BCL: '181056F4 4C 1D B8 0B 02',
  CCS: '1812F456 4C 1D B8 0B 05 00 01',
  BSM: '181356F4 01 78 01 5A 02 00 00',
  BST: '101956F4 01 00 00 00',
  CST: '101AF456 04 00 00 00',
  CEM: '081FF456 14 00 00 00',
  BRO: '100956F4 AA',
  CRO: '100AF456 AA',
  CML: '1808F456 E8 0D 20 03 60 09 60 0D'
};

Page({
  data: { meta: null },

  onLoad(query) {
    var code = (query && query.code) || '';
    var meta = gbt.getMessageMeta(code);
    this.setData({ meta: meta });
    if (meta) {
      wx.setNavigationBarTitle({ title: meta.code + ' 详情' });
    }
  },

  fillDecode() {
    var meta = this.data.meta;
    if (!meta) return;
    var line = EXAMPLE[meta.code] || (meta.exampleId + ' ' + meta.exampleData);
    if (String(line).indexOf('TP') >= 0 || String(line).indexOf('见') >= 0) {
      line = EXAMPLE.CHM;
      wx.showToast({ title: '该报文需多帧，已填 CHM 示例', icon: 'none' });
    }
    try {
      wx.setStorageSync('gbt_decode_fill', line);
    } catch (e) {}
    wx.navigateTo({ url: '/pages/index/index' });
  }
});
