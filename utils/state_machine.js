/**
 * 27930 会话阶段状态机（全序推进，禁止跳帧）
 */

var FLOW_STEP_KEYS = [
  'connect',
  'handshake',
  'identify',
  'param',
  'ready',
  'charge',
  'end'
];

var STEP_DEFS = [
  {
    key: 'connect',
    title: '插枪连接',
    codes: [],
    desc: '物理插枪与低压辅助就位（通信前）。日志开始即视为已进入。'
  },
  {
    key: 'handshake',
    title: '握手',
    codes: ['CHM', 'BHM'],
    desc: 'CHM 桩握手 / BHM 车握手，交换协议版本与车最高允许电压。'
  },
  {
    key: 'identify',
    title: '辨识',
    codes: ['CRM', 'BRM'],
    desc: 'CRM 桩辨识与编号；BRM 多帧车辆辨识（电池类型/VIN）。'
  },
  {
    key: 'param',
    title: '参数',
    codes: ['BCP', 'CML', 'CTS'],
    desc: 'BCP 车参数、CML 桩能力、CTS 时间同步。'
  },
  {
    key: 'ready',
    title: '就绪',
    codes: ['BRO', 'CRO'],
    desc: '双方就绪（0xAA）后才允许大电流。'
  },
  {
    key: 'charge',
    title: '充电中',
    codes: ['BCL', 'CCS', 'BCS', 'BSM', 'BMV', 'BMT', 'BSP'],
    desc: '需求/输出/SOC/电池状态循环。'
  },
  {
    key: 'end',
    title: '结束统计',
    codes: ['BST', 'CST', 'BSD', 'CSD', 'BEM', 'CEM'],
    desc: '中止原因与统计；或通信错误结束。'
  }
];

var CODE_TO_STEP = {};
STEP_DEFS.forEach(function (s, idx) {
  s.codes.forEach(function (c) {
    CODE_TO_STEP[c] = idx;
  });
});

function createSessionMachine() {
  var stepIndex = 0;
  var statuses = FLOW_STEP_KEYS.map(function (_, i) {
    return i === 0 ? 'active' : 'pending';
  });
  var seenCodes = {};
  var firstAt = {};
  var timeline = [];
  var broReady = false;
  var croReady = false;
  var chargeStarted = false;
  var finished = false;
  var error = false;
  var lastCode = '';
  var lastSummary = '';
  var stopEvent = null;

  function markDoneUpTo(idx) {
    for (var i = 0; i < idx; i++) {
      if (statuses[i] !== 'error') statuses[i] = 'done';
    }
  }

  function activate(idx) {
    if (finished && idx < stepIndex) return;
    markDoneUpTo(idx);
    stepIndex = Math.max(stepIndex, idx);
    if (statuses[idx] !== 'error') statuses[idx] = 'active';
    for (var j = idx + 1; j < statuses.length; j++) {
      if (statuses[j] === 'active') statuses[j] = 'pending';
    }
  }

  function feed(frame) {
    if (!frame || !frame.code) return snapshot();
    var code = frame.code;
    if (code === 'TP.CM' || code === 'TP.DT') {
      lastCode = code;
      return snapshot();
    }

    seenCodes[code] = (seenCodes[code] || 0) + 1;
    if (firstAt[code] == null) {
      firstAt[code] = frame.relMs != null ? frame.relMs : frame.tMs;
      timeline.push({
        code: code,
        tMs: firstAt[code],
        stage: frame.stage,
        summary: frame.summary || ''
      });
    }
    lastCode = code;
    lastSummary = frame.summary || '';

    // connect: first frame
    if (statuses[0] === 'active' || statuses[0] === 'pending') {
      statuses[0] = 'done';
      if (stepIndex < 1) activate(1);
    }

    if (code === 'BRO' && frame.metrics && frame.metrics.ready) broReady = true;
    if (code === 'CRO' && frame.metrics && frame.metrics.ready) croReady = true;
    if (code === 'BCL' || code === 'CCS' || code === 'BCS') chargeStarted = true;

    // 中止/错误：先记录卡点，再进入结束步（避免 CODE_TO_STEP 先 activate(6) 冲掉卡点）
    if (code === 'BST' || code === 'CST') {
      finished = true;
      error = false;
      activate(6);
      statuses[6] = 'done';
      if (statuses[5] === 'active') statuses[5] = 'done';
      stopEvent = {
        type: 'stop',
        code: code,
        metrics: frame.metrics,
        summary: frame.summary,
        tMs: frame.relMs != null ? frame.relMs : frame.tMs,
        side: frame.metrics && frame.metrics.stop ? frame.metrics.stop.side : (code === 'BST' ? 'vehicle' : 'pile')
      };
      return snapshot();
    }

    if (code === 'BEM' || code === 'CEM') {
      var errStep = stepIndex;
      if (statuses[errStep] !== 'active' && statuses[errStep] !== 'done') {
        errStep = guessStuckStep();
      }
      finished = true;
      error = true;
      // 仅把已走过的步骤收尾，未到达的保持 pending
      for (var ei = 0; ei < errStep; ei++) {
        if (statuses[ei] !== 'error') statuses[ei] = 'done';
      }
      statuses[errStep] = 'error';
      for (var ej = errStep + 1; ej < 6; ej++) statuses[ej] = 'pending';
      stepIndex = 6;
      statuses[6] = 'error';
      stopEvent = {
        type: 'error',
        code: code,
        metrics: frame.metrics,
        summary: frame.summary,
        tMs: frame.relMs != null ? frame.relMs : frame.tMs,
        side: frame.metrics && frame.metrics.error ? (frame.metrics.error.lean || frame.metrics.error.side) : (code === 'CEM' ? 'vehicle' : 'pile'),
        stuckStep: errStep
      };
      return snapshot();
    }

    var target = CODE_TO_STEP[code];
    if (target != null) {
      if (!finished) {
        if (target >= stepIndex || target === stepIndex) {
          activate(target);
        } else if (target === 6) {
          activate(6);
        }
      } else if (target === 6) {
        activate(6);
      }
    }

    if (code === 'BSD' || code === 'CSD') {
      if (!finished) {
        finished = true;
        activate(6);
        statuses[6] = 'done';
        if (statuses[5] === 'active') statuses[5] = 'done';
      }
    }

    return snapshot();
  }

  function guessStuckStep() {
    // highest step that has been entered
    for (var i = statuses.length - 2; i >= 0; i--) {
      if (statuses[i] === 'active' || statuses[i] === 'done' || statuses[i] === 'error') return i;
    }
    return 1;
  }

  function finalizeIfIncomplete() {
    // 会话卡死：停在当前 active 步
    if (finished) return snapshot();
    var stuck = stepIndex;
    if (statuses[stuck] === 'active') {
      // stay active → UI 可标 failed；不因噪声误判终态
    }
    return snapshot();
  }

  function snapshot() {
    var nodes = STEP_DEFS.map(function (def, i) {
      var seen = [];
      def.codes.forEach(function (c) {
        if (seenCodes[c]) seen.push(c);
      });
      return {
        key: def.key,
        title: def.title,
        desc: def.desc,
        codes: def.codes,
        seenCodes: seen,
        status: statuses[i]
      };
    });
    return {
      stepIndex: stepIndex,
      stepKey: FLOW_STEP_KEYS[stepIndex],
      statuses: statuses.slice(),
      nodes: nodes,
      seenCodes: Object.assign({}, seenCodes),
      firstAt: Object.assign({}, firstAt),
      timeline: timeline.slice(),
      broReady: broReady,
      croReady: croReady,
      chargeStarted: chargeStarted,
      finished: finished,
      error: error,
      lastCode: lastCode,
      lastSummary: lastSummary,
      stopEvent: stopEvent
    };
  }

  return {
    feed: feed,
    snapshot: snapshot,
    finalizeIfIncomplete: finalizeIfIncomplete
  };
}

module.exports = {
  FLOW_STEP_KEYS: FLOW_STEP_KEYS,
  STEP_DEFS: STEP_DEFS,
  createSessionMachine: createSessionMachine
};
