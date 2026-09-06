/**
 * 蓝牙日志增量实时 DBC 解码
 */
var decode = require('./dbc_decode.js');
var gbt = require('./gbt27930.js');

var MAX_FEED = 200;

function createSession(byId) {
  return {
    byId: byId || {},
    lineIndex: 0,
    feed: [],
    matched: 0,
    unknown: 0,
    skipped: 0,
    sourceText: ''
  };
}

function resetSession(session) {
  session.lineIndex = 0;
  session.feed = [];
  session.matched = 0;
  session.unknown = 0;
  session.skipped = 0;
  session.sourceText = '';
}

/** 全量替换日志并解码（本地文件） */
function loadLogText(session, logText) {
  if (!session) return { feed: [], matched: 0, unknown: 0, newCount: 0 };
  resetSession(session);
  session.sourceText = String(logText || '');
  return processLogText(session, session.sourceText, true);
}

function processLogText(session, logText, forceFull) {
  if (!session) return { feed: [], matched: 0, unknown: 0, newCount: 0 };
  var text = forceFull ? String(logText || '') : String(logText || '');
  if (forceFull) {
    session.lineIndex = 0;
    session.feed = [];
    session.matched = 0;
    session.unknown = 0;
    session.skipped = 0;
    session.sourceText = text;
  }
  var lines = String(logText || '').split(/\n/);
  var newItems = [];
  var start = session.lineIndex;
  if (lines.length < start) {
    resetSession(session);
    start = 0;
  }
  for (var i = start; i < lines.length; i++) {
    var line = lines[i].replace(/\r/g, '');
    var t = line.trim();
    if (!t || t.charAt(0) === '#') {
      session.skipped++;
      continue;
    }
    var frame = gbt.parseLogLine(line, i);
    if (!frame) {
      session.skipped++;
      continue;
    }
    var decoded = decode.decodeFrame(frame, session.byId);
    var item;
    if (decoded) {
      session.matched++;
      item = {
        key: 'm' + i,
        matched: true,
        idHex: decoded.idHex,
        name: decoded.name,
        timeText: decoded.timeText,
        dataHex: decoded.dataHex,
        summary: decoded.summary,
        signals: decoded.signals
      };
    } else {
      session.unknown++;
      item = {
        key: 'u' + i,
        matched: false,
        idHex: frame.idHex,
        name: '未在矩阵中',
        timeText: frame.tMs != null ? decode.formatTime(frame.tMs) : '',
        dataHex: frame.dataHex,
        summary: frame.dataHex
      };
    }
    newItems.push(item);
  }
  session.lineIndex = lines.length;
  if (newItems.length) {
    session.feed = session.feed.concat(newItems);
    if (session.feed.length > MAX_FEED) {
      session.feed = session.feed.slice(-MAX_FEED);
    }
  }
  return {
    feed: session.feed,
    matched: session.matched,
    unknown: session.unknown,
    skipped: session.skipped,
    newCount: newItems.length
  };
}

module.exports = {
  MAX_FEED: MAX_FEED,
  createSession: createSession,
  resetSession: resetSession,
  loadLogText: loadLogText,
  processLogText: processLogText
};
