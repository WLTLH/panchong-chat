const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, err: 'no_openid' };

  const enable = !!(event && event.enable);
  const users = db.collection('users');
  const found = await users.where({ _openid: openid }).limit(1).get();
  if (!found.data || !found.data.length) {
    return { ok: false, err: 'not_registered' };
  }

  const doc = found.data[0];
  await users.doc(doc._id).update({
    data: {
      isVip: enable,
      vipUpdatedAt: Date.now(),
      updatedAt: db.serverDate()
    }
  });

  return { ok: true, isVip: enable };
};
