/**
 * 车内 CAN 矩阵自动匹配（不向 UI 暴露具体车型名）
 *
 * 流程：采一批 ID → 指纹打分 → 锁定一套 profile → 只用该套解码
 * 歧义时：不解冲突位域，只显示原始帧 +「信号已采集」
 */

var catalog = require('./dc_id_catalog.js');

/** 对外只暴露代号，不出现厂家/车型字样 */
var PROFILES = [
  {
    key: 'matrix_x1',
    /* 内部：江山科列系 PCAN */
    manufacturer: '江山',
    fingerprint: ['0x18ff23b3', '0x18ff24b4', '0x18ff26d1'],
    core: ['0x18ff01a1', '0x18ff21b1', '0x18ff27b7']
  },
  {
    key: 'matrix_x2',
    /* 内部：齐星（与 x1 共用核心 ID，无独有指纹时易歧义） */
    manufacturer: '齐星',
    fingerprint: [],
    core: ['0x18ff01a1', '0x18ff21b1', '0x18ff27b7']
  },
  {
    key: 'matrix_y1',
    /* 内部：奇瑞轻卡 */
    manufacturer: '奇瑞轻卡',
    fingerprint: ['0x18ff1512', '0x18ff1812', '0x18ff8062', '0x0cfffc27'],
    core: ['0x18ff1512', '0x18ff1812']
  },
  {
    key: 'matrix_z1',
    /* 内部：天鑫 Q22 */
    manufacturer: '天鑫Q22',
    fingerprint: ['0x564', '0x46b'],
    core: ['0x46f', '0x471']
  },
  {
    key: 'matrix_z2',
    /* 内部：奇瑞 5021/6460（矩阵相同，合并） */
    manufacturer: '奇瑞5021',
    also: ['奇瑞6460'],
    fingerprint: ['0x55a', '0x46c'],
    core: ['0x46f', '0x471']
  }
];

var DISPLAY = {
  matched: '已自动匹配车内矩阵',
  ambiguous: '矩阵候选不唯一，暂按原始帧显示',
  unknown: '未匹配已知矩阵，仅显示原始报文',
  warming: '正在识别矩阵…'
};

function normId(id) {
  var s = String(id == null ? '' : id).trim().toLowerCase();
  if (!s) return '';
  if (s.indexOf('0x') === 0) return s;
  // allow decimal or bare hex
  if (/^\d+$/.test(s)) return '0x' + (Number(s) >>> 0).toString(16);
  return '0x' + s.replace(/^0x/i, '');
}

function profileIdSet(p) {
  var set = {};
  var list = catalog.listByManufacturer ? catalog.listByManufacturer(p.manufacturer) : [];
  if ((!list || !list.length) && catalog.VEHICLE_DC_LIST) {
    list = catalog.VEHICLE_DC_LIST.filter(function (e) {
      if (e.manufacturer === p.manufacturer) return true;
      if (p.also && p.also.indexOf(e.manufacturer) >= 0) return true;
      return false;
    });
  }
  (list || []).forEach(function (e) {
    set[normId(e.idHex)] = true;
  });
  (p.fingerprint || []).forEach(function (id) { set[normId(id)] = true; });
  (p.core || []).forEach(function (id) { set[normId(id)] = true; });
  return set;
}

function scoreProfile(p, seenSet) {
  var ids = profileIdSet(p);
  var idList = Object.keys(ids);
  var hits = 0;
  var hitIds = [];
  idList.forEach(function (id) {
    if (seenSet[id]) {
      hits += 1;
      hitIds.push(id);
    }
  });
  var fpHits = 0;
  (p.fingerprint || []).forEach(function (id) {
    if (seenSet[normId(id)]) fpHits += 1;
  });
  var coreHits = 0;
  (p.core || []).forEach(function (id) {
    if (seenSet[normId(id)]) coreHits += 1;
  });
  // 指纹命中权重高；核心帧次之；覆盖率防止大矩阵虚高
  var cover = idList.length ? hits / idList.length : 0;
  var score = fpHits * 5 + coreHits * 2 + hits * 1 + cover * 2;
  return {
    key: p.key,
    score: score,
    hits: hits,
    fpHits: fpHits,
    coreHits: coreHits,
    cover: cover,
    hitIds: hitIds,
    idCount: idList.length
  };
}

/**
 * @param {string[]|number[]} seenIds 已采集到的 CAN ID
 * @param {{minScore?:number, minHits?:number}} [opt]
 * @returns {{
 *   status: 'matched'|'ambiguous'|'unknown'|'warming',
 *   displayLabel: string,
 *   profileKey: string|null,
 *   confidence: number,
 *   canDecode: boolean,
 *   candidates: Array,
 *   _debug?: object
 * }}
 */
function matchMatrix(seenIds, opt) {
  opt = opt || {};
  var minScore = opt.minScore != null ? opt.minScore : 4;
  var minHits = opt.minHits != null ? opt.minHits : 2;

  var seenSet = {};
  var n = 0;
  (seenIds || []).forEach(function (id) {
    var h = normId(id);
    if (!h || h === '0x') return;
    if (!seenSet[h]) {
      seenSet[h] = true;
      n += 1;
    }
  });

  if (n < 1) {
    return {
      status: 'warming',
      displayLabel: DISPLAY.warming,
      profileKey: null,
      confidence: 0,
      canDecode: false,
      candidates: []
    };
  }

  var ranked = PROFILES.map(function (p) {
    return scoreProfile(p, seenSet);
  }).sort(function (a, b) {
    return b.score - a.score || b.fpHits - a.fpHits || b.hits - a.hits;
  });

  var top = ranked[0];
  var second = ranked[1];
  var ok = top && top.score >= minScore && top.hits >= minHits;

  // 顶尖接近且都过线 → 歧义（典型：江山/齐星只见到共用 ID）
  var close =
    ok &&
    second &&
    second.score >= minScore &&
    second.hits >= minHits &&
    top.score - second.score < 3 &&
    top.fpHits === 0 &&
    second.fpHits === 0;

  if (close) {
    return {
      status: 'ambiguous',
      displayLabel: DISPLAY.ambiguous,
      profileKey: null,
      confidence: Math.min(0.55, top.cover),
      canDecode: false,
      candidates: ranked.slice(0, 3).map(publicCand)
    };
  }

  if (!ok) {
    return {
      status: 'unknown',
      displayLabel: DISPLAY.unknown,
      profileKey: null,
      confidence: top ? Math.min(0.4, top.cover) : 0,
      canDecode: false,
      candidates: ranked.slice(0, 3).map(publicCand)
    };
  }

  var conf = Math.min(0.98, 0.45 + top.fpHits * 0.15 + top.cover * 0.35 + (top.coreHits >= 2 ? 0.1 : 0));
  return {
    status: 'matched',
    displayLabel: DISPLAY.matched,
    profileKey: top.key,
    confidence: conf,
    canDecode: true,
    candidates: ranked.slice(0, 3).map(publicCand)
  };
}

function publicCand(c) {
  return {
    profileKey: c.key,
    score: Math.round(c.score * 10) / 10,
    hits: c.hits,
    fpHits: c.fpHits
  };
}

/** 由 profileKey 取内部厂家（仅解码器用，勿直接展示给用户） */
function manufacturerForProfile(profileKey) {
  for (var i = 0; i < PROFILES.length; i++) {
    if (PROFILES[i].key === profileKey) return PROFILES[i].manufacturer;
  }
  return null;
}

function displayLabelForStatus(status) {
  return DISPLAY[status] || DISPLAY.unknown;
}

module.exports = {
  PROFILES: PROFILES,
  DISPLAY: DISPLAY,
  matchMatrix: matchMatrix,
  manufacturerForProfile: manufacturerForProfile,
  displayLabelForStatus: displayLabelForStatus,
  normId: normId
};
