var stateMachine = require('../../utils/state_machine.js');

Page({
  data: {
    stages: stateMachine.STEP_DEFS.map(function (s) {
      return {
        title: s.title,
        codes: s.codes.length ? s.codes.join(' / ') : '（物理连接，无强制报文）',
        desc: s.desc
      };
    })
  }
});
