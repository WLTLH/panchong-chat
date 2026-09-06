/**
 * 从微信聊天选择文档类文件（.dbc / .log / .txt 等）
 * type 必须用 file，不能用 all/image，否则部分机型只能选图片
 */

function isCancel(err) {
  return err && err.errMsg && err.errMsg.indexOf('cancel') >= 0;
}

/**
 * @param {object} opts
 * @param {number} [opts.count=1]
 * @param {string[]} [opts.extension] 仅 type=file 时有效；不传则不过滤
 * @param {function} done (ok, file|null, err)
 */
function pickChatDocument(opts, done) {
  opts = opts || {};
  var count = opts.count || 1;
  var doneFn = typeof done === 'function' ? done : function () {};

  if (!wx.chooseMessageFile) {
    doneFn(false, null, { errMsg: 'chooseMessageFile:fail unsupported' });
    return;
  }

  var param = {
    count: count,
    type: 'file',
    success: function (res) {
      var f = (res.tempFiles && res.tempFiles[0]) || null;
      if (!f) {
        doneFn(false, null, { errMsg: 'empty' });
        return;
      }
      if (f.type === 'image' || f.type === 'video') {
        doneFn(false, null, {
          errMsg: 'wrong_type',
          tip: '请选择聊天里的「文件」，不要选图片或视频'
        });
        return;
      }
      doneFn(true, f, null);
    },
    fail: function (err) {
      doneFn(false, null, err);
    }
  };

  if (opts.extension && opts.extension.length) {
    param.extension = opts.extension;
  }

  wx.chooseMessageFile(param);
}

/**
 * 本机文件（基础库较新时可用），作为聊天选文件的补充
 */
function pickLocalDocument(opts, done) {
  opts = opts || {};
  var doneFn = typeof done === 'function' ? done : function () {};
  if (!wx.chooseFile) {
    doneFn(false, null, { errMsg: 'chooseFile:fail unsupported' });
    return;
  }
  var param = {
    count: opts.count || 1,
    type: 'file',
    success: function (res) {
      var f = (res.tempFiles && res.tempFiles[0]) || null;
      doneFn(!!f, f, f ? null : { errMsg: 'empty' });
    },
    fail: function (err) {
      doneFn(false, null, err);
    }
  };
  if (opts.extension && opts.extension.length) {
    param.extension = opts.extension;
  }
  wx.chooseFile(param);
}

function showPickSheet(title, handlers) {
  var items = [];
  var keys = [];
  if (handlers.chat) {
    items.push('从微信聊天选文件');
    keys.push('chat');
  }
  if (handlers.local && wx.chooseFile) {
    items.push('从本机选文件');
    keys.push('local');
  }
  if (!items.length) {
    if (handlers.chat) handlers.chat();
    return;
  }
  if (items.length === 1) {
    handlers[keys[0]]();
    return;
  }
  wx.showActionSheet({
    itemList: items,
    success: function (res) {
      var key = keys[res.tapIndex];
      if (key && handlers[key]) handlers[key]();
    }
  });
}

module.exports = {
  isCancel: isCancel,
  pickChatDocument: pickChatDocument,
  pickLocalDocument: pickLocalDocument,
  showPickSheet: showPickSheet
};
