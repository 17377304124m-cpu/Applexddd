const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const modulePath = path.join(__dirname, 'Applexddd_课表日期_20261119_v1.0.js');
const scheduleDate = fs.existsSync(modulePath) ? require(modulePath) : null;

test('2026年11月19日定位第11周周四', () => {
  assert.ok(scheduleDate, '尚未实现课表日期模块');
  assert.deepEqual(scheduleDate.getCurrent(new Date(2026, 10, 19, 18, 30)), { week: 11, day: 4 });
});

test('周日保留当前教学周并使用星期7', () => {
  assert.ok(scheduleDate, '尚未实现课表日期模块');
  assert.deepEqual(scheduleDate.getCurrent(new Date(2026, 10, 22, 23, 59)), { week: 11, day: 7 });
});

test('下周一从午夜起进入第12周', () => {
  assert.ok(scheduleDate, '尚未实现课表日期模块');
  assert.deepEqual(scheduleDate.getCurrent(new Date(2026, 10, 23)), { week: 12, day: 1 });
});

test('学期起始日为2026年9月7日第1周周一', () => {
  assert.ok(scheduleDate, '尚未实现课表日期模块');
  assert.deepEqual(scheduleDate.getCurrent(new Date(2026, 8, 7)), { week: 1, day: 1 });
});

test('学期开始前一天返回第0周而不钳制到有课周', () => {
  assert.ok(scheduleDate, '尚未实现课表日期模块');
  assert.deepEqual(scheduleDate.getCurrent(new Date(2026, 8, 6, 23, 59)), { week: 0, day: 7 });
});

test('跨年沿用同一学期周次', () => {
  assert.ok(scheduleDate, '尚未实现课表日期模块');
  assert.deepEqual(scheduleDate.getCurrent(new Date(2027, 0, 1)), { week: 17, day: 5 });
  assert.deepEqual(scheduleDate.getCurrent(new Date(2027, 0, 4)), { week: 18, day: 1 });
});

test('夏令时回拨地区按当地日历日期计算教学周', () => {
  assert.ok(scheduleDate, '尚未实现课表日期模块');
  const output = execFileSync(process.execPath, ['-e',
    "const scheduleDate = require(process.argv[1]); process.stdout.write(JSON.stringify([scheduleDate.getCurrent(new Date(2026, 10, 1, 23, 30)), scheduleDate.getCurrent(new Date(2026, 10, 2, 0, 15)), scheduleDate.getCurrent(new Date('2026-11-02T02:30:00Z'))]));",
    modulePath
  ], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(output), [
    { week: 8, day: 7 },
    { week: 9, day: 1 },
    { week: 8, day: 7 }
  ]);
});
