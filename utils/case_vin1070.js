/**
 * 现场案例：vin1070 充不上电（车辆 PCAN）
 * 回放核心：充电链路动画 —— 走到哪一步、在哪断
 */

var CHAIN = [
  { key: 'vcu', name: 'VCU', sub: '整车控制' },
  { key: 'bms', name: 'BMS', sub: '电池管理' },
  { key: 'cc2', name: 'CC2', sub: '连接确认' },
  { key: 'relay', name: '充继电器', sub: '正/负接触器' },
  { key: 'curr', name: '充电电流', sub: '能量通路' }
];

var CASE = {
  id: 'vin1070_no_charge',
  title: 'vin1070 · 充不上电',
  busLabel: '车辆 PCAN（非 27930）',
  durationLabel: '约 0.97s · 1000 帧',
  note:
    '本段为车辆动力 CAN。链路在 CC2 未识别处中断，叠加 BMS 故障/欠压，继电器未闭合，无充电电流。未见桩侧 27930。',
  observations: ['cc1_cc2_low', 'gun_dirty'],
  lean: {
    connection: 4,
    vehicle: 3,
    pile: 0,
    label: '倾向：连接 + 车端',
    summary: 'CC2 未建立且 BMS 二级故障/欠压抑制充电；本段未见桩侧 27930，暂不能定桩责。'
  },
  advice: [
    '检查枪座插接与 CC2 回路',
    '读取 BMS：单体欠压、压差、停止码 3',
    '另采桩侧 27930，核对是否有 CHM 握手'
  ],
  /**
   * focus: 当前高亮节点
   * breakAt: 断点（红叉），null=尚未判定断点
   * nodeState: idle|run|ok|fail|block
   */
  steps: [
    {
      t: 'T+0ms',
      title: '整车上电周期',
      narr: 'VCU / BMS 周期帧出现。SOC 36%，总压 628V。充电链路尚未推进。',
      focus: 'vcu',
      breakAt: null,
      nodes: { vcu: 'run', bms: 'idle', cc2: 'idle', relay: 'idle', curr: 'idle' },
      banner: '待机',
      metrics: [
        { k: 'SOC', v: '36%' },
        { k: '总压', v: '628V' },
        { k: '电流', v: '0A' }
      ]
    },
    {
      t: 'T+3ms',
      title: 'VCU 下发充电能力',
      narr: 'VCU→BMS：模式请求 + 直流充电电压/功率上限。链路从 VCU 推到 BMS，仍未检查连接。',
      focus: 'bms',
      breakAt: null,
      nodes: { vcu: 'ok', bms: 'run', cc2: 'idle', relay: 'idle', curr: 'idle' },
      banner: '请求中',
      flowTo: 'bms',
      metrics: [
        { k: '模式请求', v: '1' },
        { k: '电压限', v: '680V' },
        { k: '功率上限', v: '600' }
      ]
    },
    {
      t: 'T+9ms',
      title: '断点：CC2 未识别',
      narr: 'BMS 回报 CC2=未连接，故障等级 2。充电链路在「连接确认」处被切断——后面继电器不会合。',
      focus: 'cc2',
      breakAt: 'cc2',
      nodes: { vcu: 'ok', bms: 'ok', cc2: 'fail', relay: 'block', curr: 'block' },
      banner: '断在 CC2',
      shock: true,
      metrics: [
        { k: 'CC2', v: '未连' },
        { k: '故障等级', v: '2' },
        { k: 'HVIL', v: '0' }
      ]
    },
    {
      t: 'T+30ms',
      title: 'BMS 再加抑制',
      narr: '单体欠压/压差异常，充电停止码=3。即便想充，车端也会继续抑制。',
      focus: 'bms',
      breakAt: 'cc2',
      nodes: { vcu: 'ok', bms: 'fail', cc2: 'fail', relay: 'block', curr: 'block' },
      banner: '双重抑制',
      metrics: [
        { k: '欠压', v: '置位' },
        { k: '压差', v: '异常' },
        { k: '停止码', v: '3' }
      ]
    },
    {
      t: '结果',
      title: '充不上电',
      narr: '继电器保持断开，充电请求=0，电流=0，VCU 未确认，Ready=否。过程停在连接未建立 + 车端抑制。',
      focus: 'curr',
      breakAt: 'cc2',
      nodes: { vcu: 'ok', bms: 'fail', cc2: 'fail', relay: 'block', curr: 'fail' },
      banner: '未进入充电',
      metrics: [
        { k: '继电器', v: '开' },
        { k: 'VCU确认', v: '0' },
        { k: '电流', v: '0A' }
      ]
    }
  ]
};

function buildChainView(step) {
  var breakAt = step.breakAt;
  var focus = step.focus;
  var nodes = step.nodes || {};
  return CHAIN.map(function (c, i) {
    var st = nodes[c.key] || 'idle';
    var next = CHAIN[i + 1];
    var linkState = 'idle';
    if (next) {
      var ns = nodes[next.key] || 'idle';
      if (st === 'fail' || st === 'block' || breakAt === c.key) linkState = 'cut';
      else if (st === 'ok' && (ns === 'ok' || ns === 'run' || ns === 'fail')) linkState = 'on';
      else if (st === 'run' || st === 'ok') linkState = 'pulse';
    }
    return {
      key: c.key,
      name: c.name,
      sub: c.sub,
      state: st,
      focused: focus === c.key,
      isBreak: breakAt === c.key,
      linkState: linkState,
      showLink: i < CHAIN.length - 1
    };
  });
}

function buildFaceMarkers(step) {
  // vin1070：全程无充电；CC2 从断点步起标红，其余孔位保持灰
  var cc2Fail = !!step.breakAt;
  var pins = [
    { key: 'DC+', file: 'dcp' },
    { key: 'DC-', file: 'dcm' },
    { key: 'CC1', file: 'cc1' },
    { key: 'PE', file: 'pe' },
    { key: 'CC2', file: 'cc2' },
    { key: 'S+', file: 'sp' },
    { key: 'S-', file: 'sm' }
  ];
  return pins.map(function (m) {
    var lit = m.key === 'CC2' && cc2Fail;
    return {
      key: m.key,
      tone: lit ? 'fail' : 'grey',
      lit: lit,
      greySrc: '/assets/connect/mark_' + m.file + '_grey.png',
      litSrc: '/assets/connect/mark_' + m.file + '_fail.png'
    };
  });
}

function buildPlayState(stepIndex) {
  var steps = CASE.steps;
  var idx = Math.max(0, Math.min(steps.length - 1, stepIndex | 0));
  var step = steps[idx];
  var chain = buildChainView(step);
  return {
    caseId: CASE.id,
    title: CASE.title,
    busLabel: CASE.busLabel,
    durationLabel: CASE.durationLabel,
    note: CASE.note,
    lean: CASE.lean,
    advice: CASE.advice,
    stepIndex: idx,
    stepCount: steps.length,
    step: step,
    chain: chain,
    faceMarkers: buildFaceMarkers(step),
    banner: step.banner || '',
    shock: !!step.shock,
    progressPct: Math.round(((idx + 1) / steps.length) * 100),
    metrics: step.metrics || [],
    steps: steps.map(function (s, i) {
      return {
        t: s.t,
        title: s.title,
        status: i < idx ? 'done' : (i === idx ? 'active' : 'pending'),
        broken: !!s.breakAt && i <= idx
      };
    })
  };
}

module.exports = {
  CASE: CASE,
  CHAIN: CHAIN,
  buildPlayState: buildPlayState,
  id: CASE.id,
  title: CASE.title,
  note: CASE.note,
  observations: CASE.observations,
  timeline: CASE.steps.map(function (s) { return s.t + ' ' + s.title; }),
  leanHint: 'connection+vehicle'
};
