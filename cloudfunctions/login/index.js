const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function makeUserId() {
  return 'PC' + Date.now().toString(36).toUpperCase().slice(-8);
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { ok: false, err: 'no_openid' };
  }

  const action = (event && event.action) || 'login';
  const users = db.collection('users');
  const now = Date.now();

  const found = await users.where({ _openid: openid }).limit(1).get();
  let doc = found.data && found.data[0];

  if (action === 'register' && !doc) {
    const userId = makeUserId();
    await users.add({
      data: {
        _openid: openid,
        userId: userId,
        nickName: (event.nickName || '').slice(0, 64),
        avatarUrl: (event.avatarUrl || '').slice(0, 512),
        isVip: false,
        registeredAt: now,
        lastLoginAt: now,
        loginCount: 1,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    doc = {
      userId: userId,
      nickName: event.nickName || '',
      avatarUrl: event.avatarUrl || '',
      isVip: false,
      registeredAt: now,
      lastLoginAt: now
    };
  } else if (!doc) {
    if (action === 'login') {
      return { ok: false, err: 'not_registered' };
    }
    const userId = makeUserId();
    await users.add({
      data: {
        _openid: openid,
        userId: userId,
        nickName: '',
        avatarUrl: '',
        isVip: false,
        registeredAt: now,
        lastLoginAt: now,
        loginCount: 1,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    doc = { userId: userId, isVip: false, registeredAt: now, lastLoginAt: now };
  } else {
    const patch = {
      lastLoginAt: now,
      updatedAt: db.serverDate(),
      loginCount: db.command.inc(1)
    };
    if (action === 'profile' || event.nickName || event.avatarUrl) {
      if (event.nickName != null) patch.nickName = String(event.nickName).slice(0, 64);
      if (event.avatarUrl != null) patch.avatarUrl = String(event.avatarUrl).slice(0, 512);
    }
    if (action === 'login' || action === 'sync' || action === 'register') {
      // login touch only
    }
    await users.doc(doc._id).update({ data: patch });
    if (event.nickName != null) doc.nickName = patch.nickName;
    if (event.avatarUrl != null) doc.avatarUrl = patch.avatarUrl;
    doc.lastLoginAt = now;
  }

  return {
    ok: true,
    openid: openid,
    userId: doc.userId,
    nickName: doc.nickName || '',
    avatarUrl: doc.avatarUrl || '',
    isVip: !!doc.isVip,
    registeredAt: doc.registeredAt || now,
    lastLoginAt: doc.lastLoginAt || now
  };
};
