/**
 * 直流枪/口连接状态
 * 以充电枪与车端充电口为原型：对应信号出现后点亮触点连接
 */

var PHASES = [
  { key: 'idle', title: '准备插枪', hint: '枪与座分离', episode: '01',
    narration: '充电开始前，车还在等待一根枪的到来。', car: '车辆待机，充电口待命' },
  { key: 'press', title: '按压锁止机构', hint: '按下枪头按钮', episode: '02',
    narration: '先按下枪上的锁止键，才能顺利插入。', car: '充电口尚未受力' },
  { key: 'insert', title: '插入充电枪', hint: '枪头进入充电口', episode: '03',
    narration: '枪头推进充电口，金属触点开始靠近。', car: '机械连接正在建立' },
  { key: 'seated', title: '机械到位', hint: '插接到位', episode: '04',
    narration: '插接到位了——车和桩，物理上连在一起。', car: 'PE 等触点开始接触' },
  { key: 'lock', title: '电子锁锁止', hint: '锁定枪头防拔出', episode: '05',
    narration: '电子锁落下，防止充电中意外拔枪。', car: '枪被锁住，连接更可靠' },
  { key: 'cc1', title: 'CC1 识别', hint: '车端连接确认', episode: '06',
    narration: '车端通过 CC1 确认：有枪插好了。', car: 'BMS/整车感知连接状态' },
  { key: 'cc2', title: 'CC2 识别', hint: '桩端连接确认', episode: '07',
    narration: '桩端通过 CC2 确认连接完整。', car: '车桩双方都认可「已插好」' },
  { key: 'aux', title: 'S+/S- 辅助电源', hint: '低压辅助接通', episode: '08',
    narration: '低压辅助电源 S+/S- 接通，给车端控制器供电。', car: '低压唤醒，准备通信' },
  { key: 'handshake', title: '握手交换数据', hint: 'CHM/BHM', episode: '09',
    narration: '车和桩开始握手：交换协议版本与能力边界。', car: 'BMS 与充电机互相确认身份' },
  { key: 'identify', title: '辨识与参数', hint: 'CRM/BRM/BCP/CML', episode: '10',
    narration: '接着交换电池参数与桩的输出能力，看是否匹配。', car: '告诉桩「我能充多高、多快」' },
  { key: 'relay', title: '继电器闭合', hint: 'BRO/CRO 就绪', episode: '11',
    narration: '双方就绪后，高压继电器闭合——准备上电。', car: '高压回路即将导通' },
  { key: 'charge', title: '上高压充电', hint: 'BCL/CCS 大电流', episode: '12',
    narration: '电流真正进入电池：车在「吃电」，桩在「送电」。', car: '按需求电压/电流持续充电' },
  { key: 'end', title: '充电结束', hint: '中止与统计', episode: '13',
    narration: '充电结束，断开高压，本轮补能完成。', car: '统计电量，准备拔枪' }
];

var PHASE_INDEX = {};
PHASES.forEach(function (p, i) { PHASE_INDEX[p.key] = i; });

/** 国标直流 9 触头（GB/T 20234.3） */
var FACE_LAYOUT = [
  { key: 'DC+', cls: 'p-dcp', title: 'DC+', role: '直流正极' },
  { key: 'DC-', cls: 'p-dcm', title: 'DC-', role: '直流负极' },
  { key: 'PE', cls: 'p-pe', title: 'PE', role: '保护地' },
  { key: 'CC1', cls: 'p-cc1', title: 'CC1', role: '车端确认' },
  { key: 'CC2', cls: 'p-cc2', title: 'CC2', role: '桩端确认' },
  { key: 'S+', cls: 'p-sp', title: 'S+', role: 'CAN_H' },
  { key: 'S-', cls: 'p-sm', title: 'S-', role: 'CAN_L' },
  { key: 'A+', cls: 'p-ap', title: 'A+', role: '低压辅助+' },
  { key: 'A-', cls: 'p-am', title: 'A-', role: '低压辅助-' }
];

function pinState(ok, fail, pending) {
  if (fail) return 'fail';
  if (ok) return 'ok';
  if (pending) return 'pending';
  return 'off';
}

function pinLabel(state) {
  if (state === 'fail') return '异常';
  if (state === 'ok') return '已连接';
  if (state === 'pending') return '接通中';
  return '未连接';
}

function firstSeen(seen, codes) {
  for (var i = 0; i < codes.length; i++) {
    if (seen[codes[i]]) return codes[i];
  }
  return '';
}

function buildConnectAnim(opts) {
  opts = opts || {};
  var session = opts.session || {};
  var simMs = opts.simMs || 0;
  var totalMs = Math.max(opts.totalMs || 1, 1);
  var observations = opts.observations || [];
  var stop = opts.stop;
  var stepIndex = session.stepIndex != null ? session.stepIndex : 0;
  var seen = session.seenCodes || {};
  var finished = !!session.finished;
  var error = !!session.error;
  var chargeStarted = !!session.chargeStarted;
  var showcase = !!opts.showcaseMode;
  var hasLog = !!opts.hasLog;

  var hasObs = function (id) { return observations.indexOf(id) >= 0; };
  var cc1Fail = hasObs('cc1_low') || hasObs('cc1_cc2_low');
  var cc2Fail = hasObs('cc1_cc2_low');
  var lockFail = hasObs('lock_fail');
  var linkDirty = hasObs('gun_dirty');

  var introMs = showcase
    ? Math.max(5600, Math.min(8000, totalMs * 0.55 || 5600))
    : Math.max(1200, Math.min(2400, totalMs * 0.2 || 1200));
  var introRatio = Math.min(1, simMs / introMs);
  var phaseKey = 'idle';
  var inIntro = showcase && simMs < introMs && !finished && !error;

  if (!hasLog) {
    phaseKey = 'idle';
  } else if (inIntro) {
    if (introRatio < 0.08) phaseKey = 'idle';
    else if (introRatio < 0.18) phaseKey = 'press';
    else if (introRatio < 0.36) phaseKey = 'insert';
    else if (introRatio < 0.46) phaseKey = 'seated';
    else if (introRatio < 0.56) phaseKey = 'lock';
    else if (introRatio < 0.68) phaseKey = 'cc1';
    else if (introRatio < 0.80) phaseKey = 'cc2';
    else phaseKey = 'aux';
  } else if (finished || error || (stop && !stop.stuck)) {
    phaseKey = 'end';
  } else if (chargeStarted || stepIndex >= 5) {
    phaseKey = 'charge';
  } else if ((session.broReady && session.croReady) || (seen.BRO && seen.CRO && stepIndex >= 4)) {
    phaseKey = 'relay';
  } else if (seen.BCP || seen.CML || seen.CRM || seen.BRM || stepIndex >= 2) {
    phaseKey = 'identify';
  } else if (seen.CHM || seen.BHM || stepIndex >= 1) {
    phaseKey = 'handshake';
  } else if (stepIndex === 0) {
    if (introRatio < 0.08) phaseKey = 'idle';
    else if (introRatio < 0.18) phaseKey = 'press';
    else if (introRatio < 0.36) phaseKey = 'insert';
    else if (introRatio < 0.46) phaseKey = 'seated';
    else if (introRatio < 0.56) phaseKey = 'lock';
    else if (introRatio < 0.68) phaseKey = 'cc1';
    else if (introRatio < 0.80) phaseKey = 'cc2';
    else phaseKey = 'aux';
  } else {
    phaseKey = 'handshake';
  }

  if (lockFail && PHASE_INDEX[phaseKey] >= PHASE_INDEX.lock && phaseKey !== 'end') phaseKey = 'lock';
  if (cc1Fail && PHASE_INDEX[phaseKey] >= PHASE_INDEX.cc1 && phaseKey !== 'end') phaseKey = 'cc1';
  if (cc2Fail && PHASE_INDEX[phaseKey] >= PHASE_INDEX.cc2 && phaseKey !== 'end') phaseKey = 'cc2';

  var pi = PHASE_INDEX[phaseKey] || 0;
  var phase = PHASES[pi];

  // —— 枪插入进度（示意）——
  var gunProgress = 0;
  if (pi <= 0) gunProgress = 0;
  else if (phaseKey === 'press') gunProgress = 0.1;
  else if (phaseKey === 'insert') gunProgress = 0.25 + Math.min(1, Math.max(0, (introRatio - 0.18) / 0.18)) * 0.45;
  else if (phaseKey === 'seated') gunProgress = 0.78;
  else if (pi >= PHASE_INDEX.lock && phaseKey !== 'end') gunProgress = 0.94;
  else if (phaseKey === 'end') gunProgress = finished && !error ? 0.5 : 0.2;
  // 已有通信报文：默认视为已插接到位
  if (!inIntro && (seen.CHM || seen.BHM || stepIndex >= 1)) gunProgress = Math.max(gunProgress, 0.94);
  gunProgress = Math.max(0, Math.min(1, gunProgress));
  // 45° 插入轴：远离时右下，到位后贴合刨面
  var gunOffset = Math.round((1 - gunProgress) * 72);
  var gunIsoX = Math.round((1 - gunProgress) * 100);
  var gunIsoY = Math.round((1 - gunProgress) * 56);

  var lockPressed = pi >= PHASE_INDEX.press && phaseKey !== 'idle';
  var locked = pi >= PHASE_INDEX.lock && !lockFail && phaseKey !== 'end';
  if (lockFail && pi >= PHASE_INDEX.lock) locked = false;
  // 通信已开始也视为锁销已落（物理锁止在插枪后）
  if (!inIntro && (seen.CHM || seen.BHM || stepIndex >= 1) && !lockFail) {
    lockPressed = true;
    locked = phaseKey !== 'end' ? true : locked;
  }

  var btnState = 'off';
  if (lockFail) btnState = 'fail';
  else if (phaseKey === 'press') btnState = 'pending';
  else if (lockPressed) btnState = 'ok';

  var pinLockState = 'off';
  if (lockFail) pinLockState = 'fail';
  else if (phaseKey === 'lock') pinLockState = 'pending';
  else if (locked) pinLockState = 'ok';

  var lockParts = [
    {
      key: 'BTN',
      title: '按压锁止键',
      hint: '按下后才能插拔/解锁',
      state: btnState,
      stateLabel: btnState === 'ok' ? '已按下' : (btnState === 'pending' ? '按压中' : (btnState === 'fail' ? '异常' : '未按压')),
      active: lockPressed && !lockFail
    },
    {
      key: 'LATCH',
      title: '锁销',
      hint: '电子锁/机械锁销落锁',
      state: pinLockState,
      stateLabel: pinLockState === 'ok' ? '已锁止' : (pinLockState === 'pending' ? '锁止中' : (pinLockState === 'fail' ? '锁止失败' : '未锁止')),
      active: locked
    }
  ];

  // —— 信号驱动：收到对应证据才点亮连接 ——
  var mechOk = gunProgress >= 0.75 || pi >= PHASE_INDEX.seated || !!seen.CHM || !!seen.BHM;
  var peOk = mechOk && !linkDirty;
  var pePending = phaseKey === 'seated' || phaseKey === 'insert';

  var cc1Sig = !!(seen.CHM || seen.BHM || seen.CRM || seen.BRM || seen.BCP || chargeStarted);
  var cc2Sig = !!(seen.CHM || seen.BHM || seen.CRM || seen.CRO || seen.CML || chargeStarted);
  var auxSig = !!(seen.CHM || seen.BHM || seen.CRM || seen.BRM || chargeStarted);
  var commSig = !!(seen.CHM || seen.BHM || seen.CRM || seen.BRM || seen.BCP || seen.CML || seen.BRO || seen.CRO || chargeStarted);
  var relaySig = !!(session.broReady && session.croReady) || !!(seen.BRO && seen.CRO);
  var dcSig = !!(chargeStarted || seen.BCL || seen.CCS || seen.BCS);

  // 展示分镜阶段也可提前点亮（无报文时的科普）
  if (inIntro || (!commSig && stepIndex === 0)) {
    if (pi >= PHASE_INDEX.cc1) cc1Sig = true;
    if (pi >= PHASE_INDEX.cc2) cc2Sig = true;
    if (pi >= PHASE_INDEX.aux) auxSig = true;
  }
  if (phaseKey === 'relay') relaySig = true;
  if (phaseKey === 'charge') { relaySig = true; dcSig = true; }

  var cc1Ok = !cc1Fail && (cc1Sig || (pi >= PHASE_INDEX.cc1 && mechOk));
  var cc2Ok = !cc2Fail && (cc2Sig || (pi >= PHASE_INDEX.cc2 && mechOk));
  var auxOk = auxSig || (pi >= PHASE_INDEX.aux && mechOk);
  var dcActive = dcSig || phaseKey === 'charge';
  var relayClosed = relaySig || phaseKey === 'relay' || dcActive;

  // 结束时高压可熄灭，低压/确认可保留
  if (phaseKey === 'end' && finished && !error) {
    dcActive = false;
  }

  var peTrigger = peOk ? (mechOk ? '机械到位' : '') : '';
  var cc1Trigger = cc1Ok ? (firstSeen(seen, ['CHM', 'BHM', 'CRM', 'BRM']) || (inIntro ? '连接确认' : 'CC1')) : '';
  var cc2Trigger = cc2Ok ? (firstSeen(seen, ['CHM', 'BHM', 'CRM', 'CRO', 'CML']) || (inIntro ? '连接确认' : 'CC2')) : '';
  var auxTrigger = auxOk ? (firstSeen(seen, ['CHM', 'BHM']) || '辅助电源') : '';
  var dcTrigger = dcActive
    ? (firstSeen(seen, ['BCL', 'CCS', 'BCS']) || '充电中')
    : (relayClosed ? (firstSeen(seen, ['BRO', 'CRO']) || '继电器就绪') : '');

  function makePin(key, title, desc, ok, fail, pending, trigger) {
    var st = pinState(ok, fail, pending);
    return {
      key: key,
      title: title,
      desc: desc,
      state: st,
      stateLabel: pinLabel(st),
      note: trigger || (ok ? '已连接' : (pending ? '接通中' : '等待信号')),
      trigger: trigger || '',
      connected: st === 'ok'
    };
  }

  var pinMap = {
    'DC+': makePin('DC+', 'DC+', '直流正极', dcActive, false, relayClosed && !dcActive, dcTrigger),
    'DC-': makePin('DC-', 'DC-', '直流负极', dcActive, false, relayClosed && !dcActive, dcTrigger),
    'PE': makePin('PE', 'PE', '保护地', peOk, !!linkDirty, pePending && !peOk, peTrigger),
    'CC1': makePin('CC1', 'CC1', '车端连接确认', cc1Ok, cc1Fail, phaseKey === 'cc1' && !cc1Ok, cc1Trigger),
    'CC2': makePin('CC2', 'CC2', '桩端连接确认', cc2Ok, cc2Fail, phaseKey === 'cc2' && !cc2Ok, cc2Trigger),
    'S+': makePin('S+', 'S+', '充电通信 CAN_H', auxOk, false, phaseKey === 'aux' && !auxOk, auxTrigger),
    'S-': makePin('S-', 'S-', '充电通信 CAN_L', auxOk, false, phaseKey === 'aux' && !auxOk, auxTrigger),
    'A+': makePin('A+', 'A+', '低压辅助+', auxOk, false, phaseKey === 'aux' && !auxOk, auxTrigger),
    'A-': makePin('A-', 'A-', '低压辅助-', auxOk, false, phaseKey === 'aux' && !auxOk, auxTrigger)
  };

  // 9 触头全列（耦合/诊断顺序）
  var SECTION_ORDER = ['DC+', 'DC-', 'PE', 'CC2', 'A+', 'A-', 'S+', 'S-', 'CC1'];
  var sectionPins = SECTION_ORDER.map(function (key, idx) {
    var p = pinMap[key];
    var layout = FACE_LAYOUT.filter(function (f) { return f.key === key; })[0] || {};
    return {
      key: key,
      cls: layout.cls || ('p-' + key.toLowerCase().replace('+', 'p').replace('-', 'm')),
      title: p.title,
      role: layout.role || p.desc,
      state: p.state,
      stateLabel: p.stateLabel,
      trigger: p.trigger,
      connected: p.connected,
      thick: key === 'DC+' || key === 'DC-' || key === 'PE',
      row: idx
    };
  });

  // 全幅透明 PNG：7 孔位与 CAD 同像素网格（DC± / CC1 / PE / CC2 / S±）
  var FACE_MARKERS = [
    { key: 'DC+', file: 'dcp' },
    { key: 'DC-', file: 'dcm' },
    { key: 'CC1', file: 'cc1' },
    { key: 'PE', file: 'pe' },
    { key: 'CC2', file: 'cc2' },
    { key: 'S+', file: 'sp' },
    { key: 'S-', file: 'sm' }
  ];
  var faceMarkers = FACE_MARKERS.map(function (m) {
    var p = pinMap[m.key];
    var tone = 'grey';
    if (p.state === 'fail') tone = 'fail';
    else if (p.state === 'ok' || p.state === 'pending') tone = 'green';
    var lit = tone !== 'grey';
    return {
      key: m.key,
      tone: tone,
      lit: lit,
      pending: p.state === 'pending',
      greySrc: '/assets/connect/mark_' + m.file + '_grey.png',
      litSrc: '/assets/connect/mark_' + m.file + '_' + (tone === 'fail' ? 'fail' : 'green') + '.png'
    };
  });

  var facePins = FACE_LAYOUT.map(function (layout) {
    var p = pinMap[layout.key];
    return {
      key: layout.key,
      cls: layout.cls,
      title: layout.title,
      role: layout.role,
      state: p.state,
      stateLabel: p.stateLabel,
      trigger: p.trigger,
      connected: p.connected
    };
  });

  var pins = FACE_LAYOUT.map(function (layout) { return pinMap[layout.key]; });

  // 半剖透明对接：触头桥接条（坐标相对 960×640 底图，用 % 定位）
  var CUTAWAY_LAYOUT = [
    { key: 'DC+', top: 21.9, left: 47.7, width: 4.6, height: 2.2 },
    { key: 'DC-', top: 31.9, left: 47.7, width: 4.6, height: 2.2 },
    { key: 'PE', top: 43.1, left: 47.7, width: 4.6, height: 2.2 },
    { key: 'CC2', top: 53.1, left: 47.7, width: 4.6, height: 2.0 },
    { key: 'A+', top: 61.2, left: 47.7, width: 4.6, height: 1.8 },
    { key: 'A-', top: 67.2, left: 47.7, width: 4.6, height: 1.8 },
    { key: 'S+', top: 75.0, left: 47.7, width: 4.6, height: 1.8 },
    { key: 'S-', top: 81.2, left: 47.7, width: 4.6, height: 1.8 },
    { key: 'CC1', top: 89.1, left: 47.7, width: 4.6, height: 1.8 }
  ];
  var cutawayPins = CUTAWAY_LAYOUT.map(function (c) {
    var p = pinMap[c.key];
    return {
      key: c.key,
      title: p.title,
      role: p.desc,
      state: p.state,
      stateLabel: p.stateLabel,
      top: c.top,
      left: c.left,
      width: c.width,
      height: c.height,
      lit: p.state === 'ok' || p.state === 'pending' || p.state === 'fail'
    };
  });
  var cutawaySrc = gunProgress >= 0.72
    ? '/assets/connect/cutaway_base_near.jpg'
    : '/assets/connect/cutaway_base_far.jpg';
  var failPin = cutawayPins.filter(function (p) { return p.state === 'fail'; })[0];
  var diagnosisTip = '';
  if (failPin) {
    diagnosisTip = '断点：' + failPin.title + ' 异常 · 后续步骤不再推进';
  } else if (phaseKey === 'charge' && dcActive) {
    diagnosisTip = '高压通路建立 · DC± / PE 导通充电中';
  } else if (gunProgress < 0.5) {
    diagnosisTip = '外壳半透 · 可见触头 · 正在插接';
  } else {
    diagnosisTip = '逐路确认中 · 绿=已通 蓝=接通中 红=故障';
  }

  var links = sectionPins.map(function (p, idx) {
    return {
      key: p.key,
      title: p.title,
      state: p.state,
      stateLabel: p.stateLabel,
      trigger: p.trigger,
      connected: p.connected,
      topPct: Math.round(8 + idx * 12),
      thick: p.thick
    };
  });

  // 标注列表前面加上锁止键 / 锁销
  links = lockParts.map(function (p) {
    return {
      key: p.key,
      title: p.title,
      state: p.state,
      stateLabel: p.stateLabel,
      trigger: p.hint,
      connected: p.state === 'ok',
      thick: false
    };
  }).concat(links);

  var connectedCount = links.filter(function (l) { return l.connected; }).length;

  // 产品片表达：素描场景 → 半实体 → 实体点亮（对齐宣传动画语言）
  var solidPct = Math.round(
    Math.min(100, gunProgress * 55 + (connectedCount / Math.max(links.length, 1)) * 45)
  );
  var stageMode = 'sketch';
  if (solidPct >= 72 || dcActive) stageMode = 'solid';
  else if (solidPct >= 28 || connectedCount > 0) stageMode = 'hybrid';

  var stageCaption = '半剖透明 · 枪口尚未贴合';
  if (stageMode === 'hybrid') stageCaption = '半剖透明 · 触头随信号点亮';
  if (stageMode === 'solid') stageCaption = '半剖透明 · 连接通路可读';
  if (phaseKey === 'charge') stageCaption = '半剖透明 · 高压能量传输中';
  if (phaseKey === 'end') stageCaption = '半剖透明 · 连接解除中';
  if (failPin) stageCaption = '半剖透明 · 已定位断点 ' + failPin.title;

  // 插入推进：未到位时枪口略远/略小，到位后贴合；素描→实体亮度变化
  var cadScale = +(0.88 + gunProgress * 0.12).toFixed(3);
  var cadTx = +((1 - gunProgress) * 7).toFixed(2);
  var cadTy = +((1 - gunProgress) * 5).toFixed(2);
  var cadDim = stageMode === 'sketch' ? 0.72 : (stageMode === 'hybrid' ? 0.88 : 1);

  var actions = PHASES.map(function (p, idx) {
    var status = 'pending';
    if (idx < pi) status = 'done';
    else if (idx === pi) {
      status = (lockFail && p.key === 'lock') || (cc1Fail && p.key === 'cc1') || (cc2Fail && p.key === 'cc2') || (error && p.key === phaseKey)
        ? 'error' : 'active';
    }
    return { key: p.key, title: p.title, hint: p.hint, episode: p.episode, status: status };
  });

  var story = {
    episode: phase.episode,
    title: phase.title,
    narration: phase.narration,
    car: phase.car,
    headline: '当你给车充电时，你的车经历了什么？'
  };

  var lastCode = session.lastCode || '';
  var signalTip = '';
  if (lastCode) {
    signalTip = '最近报文 ' + lastCode + ' → 对应触点已刷新';
  } else if (connectedCount) {
    signalTip = '已连接 ' + connectedCount + '/' + links.length + ' 路触点';
  } else {
    signalTip = '等待插接与通信信号';
  }

  return {
    phaseKey: phaseKey,
    phaseTitle: phase.title,
    phaseHint: phase.hint + (linkDirty ? '；观察项提示枪口脏污/异物' : ''),
    gunProgress: gunProgress,
    gunOffset: gunOffset,
    gunIsoX: gunIsoX,
    gunIsoY: gunIsoY,
    gunProgressPct: Math.round(gunProgress * 100),
    cadScale: cadScale,
    cadTx: cadTx,
    cadTy: cadTy,
    cadDim: cadDim,
    sectionPins: sectionPins,
    faceMarkers: faceMarkers,
    cutawayPins: cutawayPins,
    cutawaySrc: cutawaySrc,
    diagnosisTip: diagnosisTip,
    diagnosisFail: !!failPin,
    lockParts: lockParts,
    lockPressed: lockPressed,
    locked: locked,
    lockFail: lockFail,
    pins: pins,
    facePins: facePins,
    links: links,
    connectedCount: connectedCount,
    signalTip: signalTip,
    stageMode: stageMode,
    solidPct: solidPct,
    stageCaption: stageCaption,
    stageClass: 'stage-' + stageMode + (dcActive ? ' stage-power' : '') + (error ? ' stage-fault' : ''),
    commOk: commSig,
    powerPins: [pinMap['DC+'], pinMap['DC-'], pinMap.PE],
    signalPins: [pinMap.CC1, pinMap.CC2, pinMap['S+'], pinMap['S-']],
    actions: actions,
    sceneClass: 'scene-' + phaseKey + (error ? ' scene-fault' : ''),
    spark: dcActive,
    relayClosed: relayClosed,
    story: story,
    showcaseMode: showcase,
    introMs: introMs,
    disclaimer: '半剖透明示意：外壳半透便于看触头；绿/蓝/红表示连接证据状态，非实测电压波形。'
  };
}

module.exports = {
  PHASES: PHASES,
  FACE_LAYOUT: FACE_LAYOUT,
  buildConnectAnim: buildConnectAnim
};
