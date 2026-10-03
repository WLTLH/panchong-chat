/**
 * S1 固件行格式必须能被小程序 parseLogLine 吃进去。
 */
var gbt = require('../utils/gbt27930.js');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
}

var line = '12.345 1826F456 01 01 00';
var f = gbt.parseLogLine(line, 0);
assert(f, 'parse ' + line);
assert(f.idHex && /1826F456/i.test(f.idHex), 'id ' + (f && f.idHex));
assert(f.data && f.data.length === 3, 'dlc');
assert(f.tMs != null, 'timestamp');
assert(f.code, 'code ' + (f && f.code));

var ext = '0.050 18FF50E5 AA BB CC DD EE FF 00 11';
var f2 = gbt.parseLogLine(ext, 1);
assert(f2 && f2.data && f2.data.length === 8, '8-byte frame');

console.log('ok', f.code, f.idHex, f.dataHex);
