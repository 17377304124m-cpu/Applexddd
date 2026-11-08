const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, 'Applexddd_日历_20261108_v1.0.js');
const calendar = fs.existsSync(file) ? require(file) : null;

test('春节与除夕按农历日期标记，不按假期起点标记', () => {
  assert.ok(calendar, '尚未实现日历');
  assert.ok(calendar.getDayInfo(2026, 2, 17).events.includes('春节'));
  assert.ok(calendar.getDayInfo(2026, 2, 16).events.includes('除夕'));
  assert.ok(!calendar.getDayInfo(2026, 2, 15).events.includes('除夕'));
  assert.ok(calendar.getDayInfo(2027, 2, 5).events.includes('除夕'));
  assert.ok(calendar.getDayInfo(2027, 2, 6).events.includes('春节'));
});

test('农历节日每年变化，闰月不重复标记', () => {
  assert.ok(calendar, '尚未实现日历');
  assert.ok(calendar.getDayInfo(2026, 9, 25).events.includes('中秋节'));
  assert.ok(calendar.getDayInfo(2027, 9, 15).events.includes('中秋节'));
  assert.ok(!calendar.getDayInfo(2028, 6, 27).events.includes('端午节'));
  assert.ok(calendar.getDayInfo(2025, 8, 29).events.includes('七夕'));
  assert.ok(!calendar.getDayInfo(2025, 7, 31).events.includes('七夕'));
});

test('放假、补班与普通周末分别处理', () => {
  assert.ok(calendar, '尚未实现日历');
  assert.equal(calendar.getDayInfo(2026, 2, 15).holiday, '春节');
  assert.equal(calendar.getDayInfo(2026, 2, 14).workday, true);
  assert.equal(calendar.getDayInfo(2026, 11, 8).holiday, '');
  assert.equal(calendar.getDayInfo(2027, 2, 13).holiday, '春节');
  assert.equal(calendar.getDayInfo(2027, 2, 14).workday, true);
  assert.equal(calendar.getDayInfo(2027, 6, 9).holiday, '端午节');
  assert.equal(calendar.getDayInfo(2027, 6, 10).holiday, '');
});

test('未知年份不沿用已知年份的假期', () => {
  assert.ok(calendar, '尚未实现日历');
  assert.equal(calendar.hasHolidayData(2028), false);
  assert.equal(calendar.getDayInfo(2028, 10, 2).holiday, '');
  assert.ok(calendar.getDayInfo(2028, 10, 1).events.includes('国庆节'));
});

test('月份网格正确处理闰年、星期起点与跨年', () => {
  assert.ok(calendar, '尚未实现日历');
  const leap = calendar.getMonthDays(2028, 2);
  assert.equal(leap.filter(Boolean).length, 29);
  assert.equal(leap[1].key, '2028-02-01');
  assert.equal(calendar.getMonthDays(2026, 2).filter(Boolean).length, 28);
  assert.equal(calendar.getMonthDays(2027, 1)[4].key, '2027-01-01');
  assert.equal(calendar.getMonthDays(2026, 11)[6].key, '2026-11-01');
});

test('特色日期与清明节可查看', () => {
  assert.ok(calendar, '尚未实现日历');
  assert.ok(calendar.getDayInfo(2026, 4, 5).events.includes('清明节'));
  assert.ok(calendar.getDayInfo(2027, 4, 5).events.includes('清明节'));
  assert.ok(calendar.getDayInfo(2026, 5, 10).events.includes('母亲节'));
  assert.ok(calendar.getDayInfo(2026, 6, 21).events.includes('父亲节'));
  assert.ok(calendar.getDayInfo(2026, 11, 8).events.includes('记者节'));
});

test('生日按农历逐年换算，腊月可落在次年公历', () => {
  assert.equal(typeof calendar.birthdayInLunarYear, 'function', '尚未实现农历生日');
  assert.equal(calendar.birthdayInLunarYear({month:1, day:1, leap:false}, 2027).key, '2027-02-06');
  assert.equal(calendar.birthdayInLunarYear({month:12, day:8, leap:false}, 2026).key, '2027-01-15');
  assert.equal(calendar.nextBirthday({month:12, day:8, leap:false}, '2026-11-08').key, '2027-01-15');
});

test('闰月生日有对应闰月用闰月，没有则用普通月', () => {
  assert.equal(typeof calendar.birthdayInLunarYear, 'function', '尚未实现农历生日');
  assert.equal(calendar.birthdayInLunarYear({month:6, day:7, leap:true}, 2025).key, '2025-07-31');
  assert.equal(calendar.birthdayInLunarYear({month:6, day:7, leap:true}, 2026).key, '2026-07-20');
  assert.equal(calendar.birthdayInLunarYear({month:6, day:7, leap:false}, 2025).key, '2025-07-01');
});

test('三十遇小月回退到廿九，当前生日不跳过', () => {
  assert.equal(typeof calendar.birthdayInLunarYear, 'function', '尚未实现农历生日');
  const birthday = {month:12,day:30,leap:false};
  const occurrence = calendar.birthdayInLunarYear(birthday,2026);
  assert.equal(occurrence.key,'2027-02-05');
  assert.match(occurrence.adjustment,/廿九/);
  assert.equal(calendar.nextBirthday(birthday,'2027-02-05').key,'2027-02-05');
  assert.equal(calendar.nextBirthday(birthday,'2027-02-06').key,'2028-01-25');
});

test('同日生日和事件均保留，生日每年只出现一次', () => {
  assert.equal(typeof calendar.getPersonalEntries, 'function', '尚未实现个人事件');
  const birthdays=[{id:'a',name:'朋友甲',month:1,day:1,leap:false,note:'备注甲'},
    {id:'b',name:'朋友乙',month:1,day:1,leap:false,note:''}];
  const events=[{id:'c',title:'聚会',date:'2027-02-06',note:'备注丙'}];
  assert.deepEqual(calendar.getPersonalEntries('2027-02-06',birthdays,events).map(x=>x.title),['朋友甲的生日','朋友乙的生日','聚会']);
  assert.equal(calendar.getPersonalEntries('2027-02-07',birthdays,events).length,0);
  assert.equal(calendar.getPersonalEntries('2028-01-26',birthdays,events).length,2);
});
