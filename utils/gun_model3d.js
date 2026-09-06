/**
 * 充电枪/口三维 — 客户展示用半剖透明对接
 * 上下文：dcflow 暗场产品片舞台；由 connect_anim 驱动触头绿/蓝/红与插入进度
 * 几何：GB/T 20234.3 图9 空间尺寸 + 图1 触头
 */

var faceDims = require('./gbt20234_face.js');

var DIM = {
  up: 48,
  down: 43,
  width: 78,
  topW: 36,
  shoulderY: 36.5,
  rBottom: 44,
  noseStepH: 1,
  noseStepL: 8,
  headLen: 56,
  noseLen: 24,
  faceOd: faceDims.FACE_OD,
  shellOd: Math.min(faceDims.SHELL_OD, 70),
  handleAng: 75,
  handleLen: 90,
  handleW: 32,
  handleT: 26
};

var CONTACTS = faceDims.CONTACTS_PLUG;

var COL = {
  shell: [0.42, 0.50, 0.52],
  shellHi: [0.55, 0.62, 0.64],
  face: [0.68, 0.74, 0.66],
  pocket: [0.10, 0.11, 0.12],
  pin: [0.72, 0.66, 0.52],
  pinOk: [0.10, 0.82, 0.45],
  pinFail: [0.95, 0.28, 0.28],
  pinPend: [0.28, 0.55, 1.0],
  flange: [0.38, 0.40, 0.42],
  lock: [0.82, 0.78, 0.62]
};

function createRenderer(opts) {
  opts = opts || {};
  var mode = opts.mode || 'demo'; // demo=半剖对接 | single=单枪

  var canvas = null;
  var gl = null;
  var program = null;
  var meshes = [];
  var pinParts = [];
  var gunRoot = null;
  var W = 320;
  var H = 280;
  var raf = null;
  var lastAnim = null;
  var t0 = Date.now();
  var ready = false;
  var dragYaw = mode === 'demo' ? 0.42 : 0.35;
  var dragPitch = mode === 'demo' ? 0.16 : 0.22;
  var gunGap = 70;

  function deg(d) { return (d * Math.PI) / 180; }

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function initProgram() {
    var vs =
      'attribute vec3 aPos;attribute vec3 aNrm;' +
      'uniform mat4 uMVP;uniform mat4 uModel;uniform mat3 uNrmMat;' +
      'varying vec3 vN;varying vec3 vW;' +
      'void main(){vec4 w=uModel*vec4(aPos,1.0);vW=w.xyz;vN=normalize(uNrmMat*aNrm);gl_Position=uMVP*vec4(aPos,1.0);}';
    var fs =
      'precision mediump float;uniform vec3 uColor;uniform float uEm;uniform float uOp;' +
      'uniform vec3 uLight;uniform vec3 uEye;varying vec3 vN;varying vec3 vW;' +
      'void main(){vec3 n=normalize(vN);vec3 l=normalize(uLight-vW);vec3 e=normalize(uEye-vW);' +
      'float nd=max(dot(n,l),0.0);float sp=pow(max(dot(reflect(-l,n),e),0.0),36.0);' +
      'vec3 c=uColor*(0.30+0.55*nd)+vec3(sp*0.18)+uColor*uEm;' +
      'gl_FragColor=vec4(c,uOp);}';
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function boxMesh(sx, sy, sz) {
    var hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
    var F = [
      [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [0, 0, 1]],
      [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [0, 0, -1]],
      [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz], [0, 1, 0]],
      [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], [0, -1, 0]],
      [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [1, 0, 0]],
      [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-1, 0, 0]]
    ];
    var pos = [], nrm = [], idx = [], b = 0, f, i;
    for (f = 0; f < 6; f++) {
      var n = F[f][4];
      for (i = 0; i < 4; i++) {
        pos.push(F[f][i][0], F[f][i][1], F[f][i][2]);
        nrm.push(n[0], n[1], n[2]);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      b += 4;
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }

  /** 圆柱沿 Y；halfZ: null | 'pos' 只保留 z>=0 半剖 */
  function cylMesh(r, h, seg, halfZ) {
    seg = seg || 28;
    var pos = [], nrm = [], idx = [];
    var y0 = -h * 0.5, y1 = h * 0.5, i;
    function ok(amid) {
      if (!halfZ) return true;
      return Math.sin(amid) * r >= -1e-4; // z = r*sin for our later alongX... wait
    }
    // cylinder in Y; after alongX, Y→X, local z stays. half on local Z: use cos for z in standard cyl (x=r*cos, z=r*sin)
    for (i = 0; i < seg; i++) {
      var a0 = (i / seg) * Math.PI * 2;
      var a1 = ((i + 1) / seg) * Math.PI * 2;
      var amid = (a0 + a1) * 0.5;
      if (halfZ === 'pos' && Math.sin(amid) < -0.02) continue;
      if (halfZ === 'neg' && Math.sin(amid) > 0.02) continue;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var p = pos.length / 3;
      pos.push(c0 * r, y0, s0 * r, c0 * r, y1, s0 * r, c1 * r, y1, s1 * r, c1 * r, y0, s1 * r);
      nrm.push(c0, 0, s0, c0, 0, s0, c1, 0, s1, c1, 0, s1);
      idx.push(p, p + 1, p + 2, p, p + 2, p + 3);
      p = pos.length / 3;
      pos.push(0, y1, 0, c0 * r, y1, s0 * r, c1 * r, y1, s1 * r);
      nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      idx.push(p, p + 1, p + 2);
      p = pos.length / 3;
      pos.push(0, y0, 0, c1 * r, y0, s1 * r, c0 * r, y0, s0 * r);
      nrm.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
      idx.push(p, p + 1, p + 2);
    }
    if (!pos.length) return cylMesh(r, h, seg, null);
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }

  function ringMesh(ro, ri, h, seg, halfZ) {
    seg = seg || 20;
    var pos = [], nrm = [], idx = [], y0 = -h * 0.5, y1 = h * 0.5, i;
    for (i = 0; i < seg; i++) {
      var a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      var amid = (a0 + a1) * 0.5;
      if (halfZ === 'pos' && Math.sin(amid) < -0.02) continue;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var p = pos.length / 3;
      pos.push(c0 * ro, y0, s0 * ro, c0 * ro, y1, s0 * ro, c1 * ro, y1, s1 * ro, c1 * ro, y0, s1 * ro);
      nrm.push(c0, 0, s0, c0, 0, s0, c1, 0, s1, c1, 0, s1);
      idx.push(p, p + 1, p + 2, p, p + 2, p + 3);
      p = pos.length / 3;
      pos.push(c1 * ri, y0, s1 * ri, c1 * ri, y1, s1 * ri, c0 * ri, y1, s0 * ri, c0 * ri, y0, s0 * ri);
      nrm.push(-c1, 0, -s1, -c1, 0, -s1, -c0, 0, -s0, -c0, 0, -s0);
      idx.push(p, p + 1, p + 2, p, p + 2, p + 3);
    }
    if (!pos.length) return ringMesh(ro, ri, h, seg, null);
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }

  function upload(geom) {
    var n = geom.pos.length / 3, packed = new Float32Array(n * 6), i;
    for (i = 0; i < n; i++) {
      packed[i * 6] = geom.pos[i * 3];
      packed[i * 6 + 1] = geom.pos[i * 3 + 1];
      packed[i * 6 + 2] = geom.pos[i * 3 + 2];
      packed[i * 6 + 3] = geom.nrm[i * 3];
      packed[i * 6 + 4] = geom.nrm[i * 3 + 1];
      packed[i * 6 + 5] = geom.nrm[i * 3 + 2];
    }
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
    var ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.idx, gl.STATIC_DRAW);
    return { vbo: vbo, ibo: ibo, count: geom.idx.length };
  }

  function mat4() { return new Float32Array(16); }
  function ident(o) {
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  }
  function mul(o, a, b) {
    var r = mat4(), i, j;
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) {
        r[j * 4 + i] =
          a[i] * b[j * 4] + a[i + 4] * b[j * 4 + 1] + a[i + 8] * b[j * 4 + 2] + a[i + 12] * b[j * 4 + 3];
      }
    }
    for (i = 0; i < 16; i++) o[i] = r[i];
    return o;
  }
  function T(o, x, y, z) {
    var t = ident(mat4());
    t[12] = x; t[13] = y; t[14] = z;
    return mul(o, o, t);
  }
  function RY(o, rad) {
    var c = Math.cos(rad), s = Math.sin(rad), r = ident(mat4());
    r[0] = c; r[2] = -s; r[8] = s; r[10] = c;
    return mul(o, o, r);
  }
  function RZ(o, rad) {
    var c = Math.cos(rad), s = Math.sin(rad), r = ident(mat4());
    r[0] = c; r[1] = s; r[4] = -s; r[5] = c;
    return mul(o, o, r);
  }
  function persp(o, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    ident(o);
    o[0] = f / aspect; o[5] = f;
    o[10] = (far + near) / (near - far); o[11] = -1;
    o[14] = (2 * far * near) / (near - far); o[15] = 0;
    return o;
  }
  function lookAt(o, ex, ey, ez, cx, cy, cz) {
    var zx = ex - cx, zy = ey - cy, zz = ez - cz;
    var len = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
    zx /= len; zy /= len; zz /= len;
    var xx = 1 * zz - 0 * zy; // up(0,1,0) × z — wait
    var ux = 0, uy = 1, uz = 0;
    xx = uy * zz - uz * zy;
    var xy = uz * zx - ux * zz;
    var xz = ux * zy - uy * zx;
    len = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1;
    xx /= len; xy /= len; xz /= len;
    var yx = zy * xz - zz * xy;
    var yy = zz * xx - zx * xz;
    var yz = zx * xy - zy * xx;
    ident(o);
    o[0] = xx; o[1] = yx; o[2] = zx;
    o[4] = xy; o[5] = yy; o[6] = zy;
    o[8] = xz; o[9] = yz; o[10] = zz;
    o[12] = -(xx * ex + xy * ey + xz * ez);
    o[13] = -(yx * ex + yy * ey + yz * ez);
    o[14] = -(zx * ex + zy * ey + zz * ez);
    return o;
  }
  function nmat(out, m) {
    out[0] = m[0]; out[1] = m[1]; out[2] = m[2];
    out[3] = m[4]; out[4] = m[5]; out[5] = m[6];
    out[6] = m[8]; out[7] = m[9]; out[8] = m[10];
    return out;
  }
  function alongX(L) { RZ(L, Math.PI / 2); }

  function add(geom, color, fn, meta) {
    meta = meta || {};
    var m = {
      gpu: upload(geom),
      color: color.slice(),
      em: 0,
      op: meta.op != null ? meta.op : 1,
      local: ident(mat4()),
      model: ident(mat4()),
      parent: meta.parent || null,
      role: meta.role || '',
      key: meta.key || '',
      transparent: !!(meta.op != null && meta.op < 0.99)
    };
    ident(m.local);
    if (fn) fn(m.local);
    meshes.push(m);
    return m;
  }

  function setLocal(m, fn) {
    ident(m.local);
    fn(m.local);
  }

  function pinColor(st) {
    if (st === 'ok') return COL.pinOk.slice();
    if (st === 'pending') return COL.pinPend.slice();
    if (st === 'fail') return COL.pinFail.slice();
    return COL.pin.slice();
  }

  /** 图9 正视屋形轮廓 → 挤出枪头（完整，不切触头） */
  function frontProfile(nArc) {
    nArc = nArc || 16;
    var hw = DIM.width * 0.5;
    var tw = DIM.topW * 0.5;
    var yJoin = -Math.sqrt(Math.max(0, DIM.rBottom * DIM.rBottom - hw * hw));
    var pts = [
      { y: yJoin, z: hw },
      { y: DIM.shoulderY, z: hw },
      { y: DIM.up, z: tw },
      { y: DIM.up, z: -tw },
      { y: DIM.shoulderY, z: -hw },
      { y: yJoin, z: -hw }
    ];
    var a0 = Math.atan2(yJoin, -hw);
    var a1 = Math.atan2(yJoin, hw);
    var span = Math.PI * 2 - (a1 - a0);
    var i, t, ang;
    for (i = 1; i < nArc; i++) {
      t = i / nArc;
      ang = a0 - t * span;
      pts.push({ y: DIM.rBottom * Math.sin(ang), z: DIM.rBottom * Math.cos(ang) });
    }
    return pts;
  }

  function extrudeProfile(profile, x0, x1, color, parentTag, op, halfZ) {
    var n = profile.length;
    var i, a, b, dy, dz, len, ny, nz, midY, midZ, p;
    var pos = [], nrm = [], idx = [];
    for (i = 0; i < n; i++) {
      a = profile[i];
      b = profile[(i + 1) % n];
      // 半剖只砍壳体侧壁：z 整体偏负的边可跳过，触头另画
      if (halfZ === 'pos' && a.z < -2 && b.z < -2) continue;
      dy = b.y - a.y;
      dz = b.z - a.z;
      len = Math.sqrt(dy * dy + dz * dz) || 1;
      ny = dz / len;
      nz = -dy / len;
      midY = (a.y + b.y) * 0.5;
      midZ = (a.z + b.z) * 0.5;
      if (ny * midY + nz * midZ < 0) {
        ny = -ny;
        nz = -nz;
      }
      p = pos.length / 3;
      pos.push(x0, a.y, a.z, x1, a.y, a.z, x1, b.y, b.z, x0, b.y, b.z);
      nrm.push(0, ny, nz, 0, ny, nz, 0, ny, nz, 0, ny, nz);
      idx.push(p, p + 1, p + 2, p, p + 2, p + 3);
    }
    if (!pos.length) return;
    var geom = {
      pos: new Float32Array(pos),
      nrm: new Float32Array(nrm),
      idx: new Uint16Array(idx)
    };
    add(geom, color, null, { parent: parentTag, op: op });
  }

  function addContacts(side, parentTag) {
    // 9 触头齐全：枪=插套凹孔；口=凸针（X 镜像）
    // 耦合长度：PE 最长 → CC2 → DC± → A± → S± → CC1
    var tipLenMap = {
      PE: 18,
      CC2: 15,
      'DC+': 14,
      'DC-': 14,
      'A+': 12,
      'A-': 12,
      'S+': 11,
      'S-': 11,
      CC1: 10
    };
    CONTACTS.forEach(function (c) {
      var fy = c.y;
      // 插座相对插头镜像 X（图2）
      var fz = side === 'inlet' ? -c.x : c.x;
      var part = {
        key: c.key,
        side: side,
        pinMesh: null,
        sleeveMesh: null,
        glowMesh: null,
        labelRing: null
      };
      var hr = c.hole * 0.5;
      var pr = c.pin * 0.5;

      if (side === 'gun') {
        // 沉孔井壁 + 底
        add(cylMesh(hr, 14, 18, null), COL.pocket, function (L) {
          alongX(L);
          T(L, 7, fy, fz);
        }, { parent: parentTag, op: 1 });
        // 口沿环（完整）
        add(ringMesh(hr + 0.8, Math.max(1.0, hr - 1.0), 2.2, 18, null), [0.88, 0.9, 0.86], function (L) {
          alongX(L);
          T(L, 1.6, fy, fz);
        }, { parent: parentTag, op: 1 });
        // 金属套筒（状态色）
        part.pinMesh = add(cylMesh(pr + 0.7, 7, 16, null), COL.pin, function (L) {
          alongX(L);
          T(L, 4.5, fy, fz);
        }, { role: 'pin', key: c.key, parent: parentTag, op: 1 });
        // 套筒内孔示意
        part.sleeveMesh = add(cylMesh(Math.max(0.8, pr * 0.45), 6, 12, null), COL.pocket, function (L) {
          alongX(L);
          T(L, 4.2, fy, fz);
        }, { parent: parentTag, op: 1 });
        part.glowMesh = add(cylMesh(hr + 1.6, 2.0, 14, null), COL.pin, function (L) {
          alongX(L);
          T(L, 1.2, fy, fz);
        }, { role: 'glow', key: c.key, parent: parentTag, op: 0.3 });
      } else {
        var tipLen = tipLenMap[c.key] || 12;
        // 座面孔圈
        add(ringMesh(hr + 0.6, Math.max(1.0, hr - 0.8), 2.0, 18, null), [0.88, 0.9, 0.86], function (L) {
          alongX(L);
          T(L, 5.2, fy, fz);
        }, { parent: parentTag, op: 1 });
        // 针根台肩
        add(cylMesh(pr + 1.2, 3, 14, null), COL.pin, function (L) {
          alongX(L);
          T(L, 6.5, fy, fz);
        }, { parent: parentTag, op: 1 });
        // 凸针本体（分级长度）
        part.pinMesh = add(cylMesh(pr, tipLen, 16, null), COL.pin, function (L) {
          alongX(L);
          T(L, 6 + tipLen * 0.5, fy, fz);
        }, { role: 'pin', key: c.key, parent: parentTag, op: 1 });
        // 针尖帽
        add(cylMesh(pr * 0.92, 2.2, 12, null), [0.85, 0.8, 0.65], function (L) {
          alongX(L);
          T(L, 6 + tipLen + 0.6, fy, fz);
        }, { parent: parentTag, op: 1 });
        part.glowMesh = add(cylMesh(pr + 1.8, tipLen * 0.75, 12, null), COL.pin, function (L) {
          alongX(L);
          T(L, 6 + tipLen * 0.4, fy, fz);
        }, { role: 'glow', key: c.key, parent: parentTag, op: 0.22 });
      }
      pinParts.push(part);
    });
  }

  function addCutFace(parentTag, x0, x1, y0, y1) {
    // 半剖切面（薄片），让客户一眼读出「剖开」
    add(boxMesh(Math.max(2, x1 - x0), y1 - y0, 0.6), [0.55, 0.72, 0.68], function (L) {
      T(L, (x0 + x1) * 0.5, (y0 + y1) * 0.5, 0);
    }, { parent: parentTag, op: 0.22 });
  }

  function buildGunBody(parentTag) {
    // demo：壳体半剖（z≥0 保留）+ 半透；9 触头始终完整、不剖
    var shellOp = mode === 'demo' ? 0.22 : 0.95;
    var halfShell = mode === 'demo' ? 'pos' : null;

    add(cylMesh(DIM.shellOd * 0.5, DIM.noseLen, 40, halfShell), COL.shellHi, function (L) {
      alongX(L);
      T(L, DIM.noseLen * 0.5, 0, 0);
    }, { parent: parentTag, op: shellOp });
    add(ringMesh(DIM.shellOd * 0.5 + 0.5, DIM.faceOd * 0.5 - 0.3, 3.2, 36, halfShell), COL.shell, function (L) {
      alongX(L);
      T(L, 1.4, 0, 0);
    }, { parent: parentTag, op: shellOp + 0.08 });
    // 端面绝缘环（不封孔，触头井另画）
    add(ringMesh(DIM.faceOd * 0.5, 9, 2.4, 36, halfShell), COL.face, function (L) {
      alongX(L);
      T(L, 0.9, 0, 0);
    }, { parent: parentTag, op: 0.5 });

    var prof = frontProfile(18);
    extrudeProfile(
      prof,
      DIM.noseLen * 0.35,
      DIM.noseLen + DIM.headLen,
      COL.shell,
      parentTag,
      shellOp,
      halfShell
    );
    // 枪头后盖 / 线缆根 — 模型更完整
    add(cylMesh(DIM.shellOd * 0.42, 22, 28, halfShell), COL.shell, function (L) {
      alongX(L);
      T(L, DIM.noseLen + DIM.headLen + 6, -6, 0);
    }, { parent: parentTag, op: shellOp + 0.06 });
    add(cylMesh(10, 36, 16, null), [0.2, 0.22, 0.24], function (L) {
      alongX(L);
      T(L, DIM.noseLen + DIM.headLen + 28, -18, 0);
      RZ(L, -0.55);
    }, { parent: parentTag, op: 0.9 });

    add(boxMesh(DIM.noseStepL, DIM.noseStepH + 0.8, DIM.topW + 4), COL.shellHi, function (L) {
      T(L, DIM.noseStepL * 0.5, DIM.up - 0.5, 0);
    }, { parent: parentTag, op: shellOp + 0.1 });

    var ang = deg(DIM.handleAng);
    var hx = DIM.noseLen + DIM.headLen - 8;
    add(boxMesh(DIM.handleT, DIM.handleLen, DIM.handleW), COL.shellHi, function (L) {
      T(L, hx, -8, 0);
      RZ(L, -(Math.PI / 2 - ang));
      T(L, 0, -DIM.handleLen * 0.42, 0);
    }, { parent: parentTag, op: shellOp + 0.05 });
    add(boxMesh(26, 18, DIM.handleW + 4), COL.shell, function (L) {
      T(L, hx - 2, -4, 0);
      RZ(L, -(Math.PI / 2 - ang) * 0.5);
    }, { parent: parentTag, op: shellOp });

    add(boxMesh(12, 6, 9), COL.lock, function (L) {
      T(L, 5, DIM.faceOd * 0.5 + 2.5, 0);
    }, { parent: parentTag, op: 1 });

    if (mode === 'demo') {
      addCutFace(parentTag, 0, DIM.noseLen + DIM.headLen, -DIM.rBottom, DIM.up);
    }

    addContacts('gun', parentTag);
  }

  function buildInletBody(parentTag) {
    var shellOp = 0.22;
    var halfShell = mode === 'demo' ? 'pos' : null;
    // 完整法兰 + 4 安装孔
    add(boxMesh(8, 96, 96), COL.flange, function (L) {
      T(L, -18, 0, 0);
    }, { parent: parentTag, op: 0.72 });
    var ms = 36;
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (s) {
      add(cylMesh(3.5, 10, 12, null), COL.pocket, function (L) {
        alongX(L);
        T(L, -18, s[0] * ms, s[1] * ms);
      }, { parent: parentTag, op: 1 });
    });
    add(cylMesh(DIM.shellOd * 0.5 + 1.5, 28, 40, halfShell), COL.shell, function (L) {
      alongX(L);
      T(L, -4, 0, 0);
    }, { parent: parentTag, op: shellOp });
    add(ringMesh(DIM.shellOd * 0.5 + 1.8, DIM.faceOd * 0.5 - 0.2, 3, 36, halfShell), COL.shellHi, function (L) {
      alongX(L);
      T(L, 5, 0, 0);
    }, { parent: parentTag, op: shellOp + 0.1 });
    add(ringMesh(DIM.faceOd * 0.5, 7, 2.2, 36, halfShell), COL.face, function (L) {
      alongX(L);
      T(L, 6.2, 0, 0);
    }, { parent: parentTag, op: 0.48 });
    add(boxMesh(6, 5, 12), COL.pocket, function (L) {
      T(L, 6, DIM.faceOd * 0.5 + 1.5, 0);
    }, { parent: parentTag, op: 1 });
    if (mode === 'demo') {
      addCutFace(parentTag, -16, 8, -40, 40);
    }

    addContacts('inlet', parentTag);
  }

  function buildScene() {
    meshes = [];
    pinParts = [];
    gunRoot = { local: ident(mat4()) };

    if (mode === 'demo') {
      buildInletBody('inlet');
      buildGunBody('gun');
    } else {
      buildGunBody('gun');
    }
  }

  function worldOf(m) {
    var out = ident(mat4());
    if (m.parent === 'gun') {
      // gun face at x = gunGap, rotated 180 so face looks -X
      var g = ident(mat4());
      RY(g, Math.PI);
      T(g, gunGap, 0, 0);
      mul(out, g, m.local);
    } else if (m.parent === 'inlet') {
      var inn = ident(mat4());
      T(inn, -8, 0, 0);
      mul(out, inn, m.local);
    } else {
      for (var k = 0; k < 16; k++) out[k] = m.local[k];
    }
    return out;
  }

  function applyAnim(anim) {
    lastAnim = anim || lastAnim;
    if (!lastAnim) return;
    var map = {};
    function absorb(list) {
      (list || []).forEach(function (p) {
        if (p && p.key) map[p.key] = p;
      });
    }
    absorb(lastAnim.pins);
    absorb(lastAnim.sectionPins);
    absorb(lastAnim.cutawayPins);
    absorb(lastAnim.facePins);
    // 保证 9 路都有状态（缺省 off）
    CONTACTS.forEach(function (c) {
      if (!map[c.key]) map[c.key] = { key: c.key, state: 'off' };
    });
    pinParts.forEach(function (part) {
      var st = (map[part.key] && map[part.key].state) || 'off';
      var col = pinColor(st);
      if (part.pinMesh) {
        part.pinMesh.color = col;
        part.pinMesh.em = st === 'ok' ? 0.55 : (st === 'pending' ? 0.42 : (st === 'fail' ? 0.55 : 0.04));
      }
      if (part.glowMesh) {
        part.glowMesh.color = col;
        part.glowMesh.em = st === 'off' ? 0 : 0.7;
        part.glowMesh.op = st === 'off' ? 0.03 : (st === 'fail' ? 0.5 : 0.32);
        part.glowMesh.transparent = true;
      }
    });
    var g = lastAnim.gunProgress != null ? lastAnim.gunProgress : 0;
    // 插入：远→近，贴合时仍留缝可读触头
    gunGap = 18 + (1 - g) * 85;
  }

  function draw() {
    if (!gl || !program || !ready) return;
    var t = (Date.now() - t0) / 1000;
    var breath = Math.sin(t * 0.25) * 0.03;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.07, 0.08, 0.09, 1); // #121418 暗场
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var yaw = dragYaw + breath;
    var pitch = dragPitch;
    // 机位偏正面一点，9 触头圆周都能入画
    var dist = mode === 'demo' ? 175 : 210;
    var cx = mode === 'demo' ? gunGap * 0.42 : 40;
    var cy = mode === 'demo' ? -2 : -10;
    var cz = mode === 'demo' ? 8 : 0;
    var ex = cx + dist * Math.cos(pitch) * Math.sin(yaw);
    var ey = cy + dist * Math.sin(pitch) + 20;
    var ez = cz + dist * Math.cos(pitch) * Math.cos(yaw);

    var view = mat4(), proj = mat4(), vp = mat4();
    lookAt(view, ex, ey, ez, cx, cy, cz);
    persp(proj, Math.PI / 4.0, W / Math.max(H, 1), 2, 900);
    mul(vp, proj, view);

    gl.useProgram(program);
    var aPos = gl.getAttribLocation(program, 'aPos');
    var aNrm = gl.getAttribLocation(program, 'aNrm');
    var uMVP = gl.getUniformLocation(program, 'uMVP');
    var uModel = gl.getUniformLocation(program, 'uModel');
    var uNrm = gl.getUniformLocation(program, 'uNrmMat');
    var uColor = gl.getUniformLocation(program, 'uColor');
    var uEm = gl.getUniformLocation(program, 'uEm');
    var uOp = gl.getUniformLocation(program, 'uOp');
    var uLight = gl.getUniformLocation(program, 'uLight');
    var uEye = gl.getUniformLocation(program, 'uEye');
    gl.uniform3fv(uLight, [ex + 20, ey + 90, ez + 40]);
    gl.uniform3fv(uEye, [ex, ey, ez]);

    function drawMesh(m) {
      var model = worldOf(m);
      var mvp = mat4(), n9 = new Float32Array(9);
      mul(mvp, vp, model);
      nmat(n9, model);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.gpu.vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.gpu.ibo);
      gl.enableVertexAttribArray(aPos);
      gl.enableVertexAttribArray(aNrm);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(aNrm, 3, gl.FLOAT, false, 24, 12);
      gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.uniformMatrix4fv(uModel, false, model);
      gl.uniformMatrix3fv(uNrm, false, n9);
      gl.uniform3fv(uColor, m.color);
      gl.uniform1f(uEm, m.em || 0);
      gl.uniform1f(uOp, m.op != null ? m.op : 1);
      gl.drawElements(gl.TRIANGLES, m.gpu.count, gl.UNSIGNED_SHORT, 0);
    }

    // 先不透明（触头），再半透壳体 — 半剖可读
    var i;
    gl.depthMask(true);
    for (i = 0; i < meshes.length; i++) {
      if (!meshes[i].transparent) drawMesh(meshes[i]);
    }
    gl.depthMask(false);
    for (i = 0; i < meshes.length; i++) {
      if (meshes[i].transparent) drawMesh(meshes[i]);
    }
    gl.depthMask(true);
  }

  function loop() {
    draw();
    raf = canvas.requestAnimationFrame ? canvas.requestAnimationFrame(loop) : setTimeout(loop, 33);
  }

  function mount(canvasNode, cssW, cssH, pixelRatio) {
    canvas = canvasNode;
    W = Math.max(cssW || 320, 100);
    H = Math.max(cssH || 280, 100);
    var dpr = pixelRatio || 1;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!gl) { ready = false; return false; }
    program = initProgram();
    if (!program) { ready = false; return false; }
    buildScene();
    ready = true;
    applyAnim(lastAnim);
    if (raf) {
      try {
        if (canvas.cancelAnimationFrame) canvas.cancelAnimationFrame(raf);
        else clearTimeout(raf);
      } catch (e) {}
    }
    loop();
    return true;
  }

  function update(anim) { applyAnim(anim); }
  function setView(yaw, pitch) {
    if (yaw != null) dragYaw = yaw;
    if (pitch != null) dragPitch = pitch;
  }
  function destroy() {
    ready = false;
    if (raf) {
      try {
        if (canvas && canvas.cancelAnimationFrame) canvas.cancelAnimationFrame(raf);
        else clearTimeout(raf);
      } catch (e) {}
      raf = null;
    }
    gl = null; canvas = null; meshes = []; pinParts = [];
  }

  return {
    mount: mount,
    update: update,
    setView: setView,
    destroy: destroy,
    isReady: function () { return ready; },
    version: 'cutaway-demo-v2-full9',
    mode: mode,
    DIM: DIM
  };
}

module.exports = {
  createRenderer: createRenderer,
  DIM: DIM,
  CONTACTS: CONTACTS
};
