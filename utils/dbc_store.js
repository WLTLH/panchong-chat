/**
 * 当前激活的 DBC（跨页面共享，供实时解码）
 */
var decode = require('./dbc_decode.js');

var STORAGE_TEXT = 'dbc_active_text';
var STORAGE_META = 'dbc_active_meta';
var MAX_STORE = 600000;

function appRef() {
  return getApp();
}

function setActive(analyzeResult, fileName, dbcText) {
  var messages = (analyzeResult && analyzeResult.messages) || [];
  var active = {
    fileName: fileName || 'matrix.dbc',
    messageCount: analyzeResult.messageCount || messages.length,
    signalCount: analyzeResult.signalCount || 0,
    nodeCount: analyzeResult.nodeCount || 0,
    nodes: analyzeResult.nodes || [],
    tagList: analyzeResult.tagList || [],
    warnings: analyzeResult.warnings || [],
    messages: messages,
    byId: decode.buildIdIndex(messages),
    loadedAt: Date.now()
  };
  appRef().globalData.dbcActive = active;
  try {
    wx.setStorageSync(STORAGE_META, {
      fileName: active.fileName,
      messageCount: active.messageCount,
      signalCount: active.signalCount,
      loadedAt: active.loadedAt
    });
    if (dbcText && dbcText.length <= MAX_STORE) {
      wx.setStorageSync(STORAGE_TEXT, dbcText);
    }
  } catch (e) {}
  return active;
}

function getActive() {
  var g = appRef().globalData.dbcActive;
  if (g && g.byId) return g;
  return null;
}

function clearActive() {
  appRef().globalData.dbcActive = null;
  try {
    wx.removeStorageSync(STORAGE_META);
    wx.removeStorageSync(STORAGE_TEXT);
  } catch (e) {}
}

function hasActive() {
  return !!getActive();
}

module.exports = {
  setActive: setActive,
  getActive: getActive,
  clearActive: clearActive,
  hasActive: hasActive,
  STORAGE_TEXT: STORAGE_TEXT,
  STORAGE_META: STORAGE_META
};
