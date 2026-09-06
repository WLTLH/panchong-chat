/**
 * GB/T 20234.3 直流接口触头布置（示意标定）
 * 坐标系：PE 为原点，锁止方向 +Y，单位 mm；插座为插头的 X 镜像。
 * 结构外形参考图4/图5（端面 φ65、安装 72×72）；产品公差以标准原文为准。
 */

var FACE_OD = 65;
var SHELL_OD = 70;
var MOUNT_SQ = 72;

var CONTACTS_PLUG = [
  { key: 'DC+', no: 1, x: -16.0, y: 14.5, hole: 25.4, pin: 12.0, role: '直流电源正' },
  { key: 'DC-', no: 2, x: 16.0, y: 14.5, hole: 25.4, pin: 12.0, role: '直流电源负' },
  { key: 'PE', no: 3, x: 0.0, y: 0.0, hole: 15.6, pin: 8.0, role: '保护接地' },
  { key: 'S+', no: 4, x: -13.5, y: -15.0, hole: 10.3, pin: 3.6, role: '充电通信 CAN_H' },
  { key: 'S-', no: 5, x: 13.5, y: -15.0, hole: 10.3, pin: 3.6, role: '充电通信 CAN_L' },
  { key: 'CC1', no: 6, x: -20.5, y: -1.0, hole: 10.3, pin: 3.6, role: '充电连接确认' },
  { key: 'CC2', no: 7, x: 20.5, y: -1.0, hole: 10.3, pin: 3.6, role: '充电连接确认' },
  { key: 'A+', no: 8, x: -13.5, y: -28.0, hole: 10.3, pin: 3.6, role: '低压辅助电源正' },
  { key: 'A-', no: 9, x: 13.5, y: -28.0, hole: 10.3, pin: 3.6, role: '低压辅助电源负' }
];

var COUPLE_ORDER = ['PE', 'CC2', 'DC+', 'DC-', 'A+', 'A-', 'S+', 'S-', 'CC1'];

function contactsFor(side) {
  if (side !== 'socket') return CONTACTS_PLUG.slice();
  return CONTACTS_PLUG.map(function (c) {
    return Object.assign({}, c, { x: -c.x });
  });
}

module.exports = {
  FACE_OD: FACE_OD,
  SHELL_OD: SHELL_OD,
  MOUNT_SQ: MOUNT_SQ,
  CONTACTS_PLUG: CONTACTS_PLUG,
  COUPLE_ORDER: COUPLE_ORDER,
  contactsFor: contactsFor,
  standard: 'GB/T 20234.3-2023',
  onlineUrl: 'https://openstd.samr.gov.cn/bzgk/std/showGb?type=online&hcno=5928F89DE3DB6FD3FDDC06E709FCC4A2&request_locale=zh'
};
