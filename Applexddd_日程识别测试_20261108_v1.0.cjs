const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname, 'Applexddd_日程识别_20261108_v1.0.js');
const capture = fs.existsSync(modulePath) ? require(modulePath) : null;

function parse(text, reference = '2026-11-08') {
  assert.ok(capture, '尚未实现日程识别');
  return capture.parse(text, reference);
}

test('明确年月日、横线和斜线日期正确提取，草稿只含标题、日期和原文备注', () => {
  for (const source of ['2026年11月9日15:00开会', '2026-11-09 15:00 开会', '2026/11/9 15:00 开会']) {
    const [row] = parse(source);
    assert.deepEqual(row, { title: '开会', date: '2026-11-09', note: '原文：' + source });
  }
});

test('无年份月份按参考年份识别，较早日期不悄悄推到下一年', () => {
  const [row] = parse('1月2日参加活动', '2026-12-31');
  assert.equal(row.date, '2026-01-02');
  assert.equal(row.title, '参加活动');
  assert.match(row.note, /2026年/);
  assert.match(row.note, /1月2日参加活动/);
});

test('今天明天后天按参考日期计算，正确跨年和跨月', () => {
  assert.equal(parse('今天开会', '2026-12-31')[0].date, '2026-12-31');
  assert.equal(parse('明天开会', '2026-12-31')[0].date, '2027-01-01');
  assert.equal(parse('后天开会', '2026-12-31')[0].date, '2027-01-02');
  assert.equal(parse('明天交作业', '2028-02-28')[0].date, '2028-02-29');
});

test('周X指当前周，下周X从周一计算，周日不偏一周', () => {
  const fixtures = [['周一开会','2026-11-02'], ['本周日聚餐','2026-11-08'],
    ['周五复盘','2026-11-06'], ['下周一上课','2026-11-09'], ['下周日活动','2026-11-15']];
  for (const [source, expected] of fixtures) assert.equal(parse(source)[0].date, expected);
  assert.equal(parse('下周一开会', '2026-12-31')[0].date, '2027-01-04');
});

test('无日期、周次和次数不伪造为今天或某个星期', () => {
  for (const source of ['记得买牛奶', '第3周提交报告', '每周一次整理资料', '每周一锻炼']) {
    const [row] = parse(source);
    assert.equal(row.date, '');
    assert.ok(row.title.length > 0);
    assert.ok(row.note.includes(source));
  }
});

test('非法日期留空，不把二月三十自动滚动到三月', () => {
  for (const source of ['2月30日开会', '2026-02-29开会', '2026年13月1日开会', '2026/11/31开会']) {
    const [row] = parse(source);
    assert.equal(row.date, '');
    assert.ok(capture.validateRows([row]).errors.some(message => /日期/.test(message)));
  }
  assert.equal(parse('2028年2月29日开会')[0].date, '2028-02-29');
});

test('钟点从事项标题移除，保留原通知', () => {
  const fixtures = [['明天下午3点开会','开会'], ['明天晚上八点半聚餐','聚餐'],
    ['明天上午十点十五分复盘','复盘'], ['明天中午12点吃饭','吃饭'],
    ['明天凌晨0点发车','发车'], ['明天下午3:05开会','开会'],
    ['明天下午3点至16:00开会','开会']];
  for (const [source, expected] of fixtures) {
    const [row] = parse(source);
    assert.equal(row.title, expected, source);
    assert.ok(row.note.includes(source));
  }
});

test('原文里的钟点无需校验，日期与标题有效即可保存', () => {
  for (const source of ['11月9日25:99开会', '11月9日24:00出发', '11月9日15点65分开会']) {
    const [row] = parse(source);
    const result = capture.validateRows([row]);
    assert.deepEqual(result, { events: [row], errors: [] }, source);
    assert.ok(row.note.includes(source));
  }
});

test('按行通知可提取多个事项，单条备注不会拆成假事件', () => {
  const source = '11月9日15:00部门例会\n地点：A-210\n11月10日09:30提交报告';
  const rows = parse(source);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => [row.title, row.date]),
    [['部门例会','2026-11-09'], ['提交报告','2026-11-10']]);
  assert.match(rows[0].note, /地点：A-210/);
});

test('日期时间单独一行可以与随后事项合并', () => {
  const rows = parse('日期：11月9日\n时间：下午3点\n事项：项目例会\n地点：教室A');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '项目例会');
  assert.equal(rows[0].date, '2026-11-09');
  assert.match(rows[0].note, /时间：下午3点/);
  assert.match(rows[0].note, /地点：教室A/);
});

test('独立无日期事项不被下一条通知的日期误绑定', () => {
  const rows = parse('买牛奶\n11月9日15:00开会');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, '');
  assert.equal(rows[1].date, '2026-11-09');
});

test('OCR字符间空格和全角标点可规范化，原文不变', () => {
  const source = '2 0 2 6 年 1 1 月 9 日 下 午 3 点 开 会';
  const [row] = parse(source);
  assert.equal(row.date, '2026-11-09');
  assert.equal(row.title, '开会');
  assert.ok(row.note.includes(source));
  assert.equal(parse('１１月９日１５：３０开会')[0].title, '开会');
});

test('分号隔开的明确日期事项可以分成多条', () => {
  const rows = parse('11月9日开会；11月10日复盘');
  assert.deepEqual(rows.map(row => [row.title,row.date]), [['开会','2026-11-09'],['复盘','2026-11-10']]);
});

test('纯日期时间不能替代事项标题，空输入不生成草稿', () => {
  assert.deepEqual(parse('  \n\n '), []);
  for (const source of ['11月9日15:00', '11月9日15:00至16:00']) {
    const [row] = parse(source);
    assert.equal(row.title, '');
    assert.ok(capture.validateRows([row]).errors.some(message => /事项|标题/.test(message)));
  }
});

test('纯钟点通知不生成草稿', () => {
  for (const source of ['时间：15:00', '时间：下午3点', '15:00至16:00', '下午三点到五点']) {
    assert.deepEqual(parse(source), [], source);
  }
});

test('兼容带旧时间字段的草稿，保存使用用户备注原文', () => {
  const event = { title: '项目例会', date: '2026-11-09', note: '时间：下午3点\nA-210' };
  for (const time of ['15:00', '25:99']) {
    assert.deepEqual(capture.validateRows([{ ...event, time }]), { events: [event], errors: [] });
  }
});

test('任一行标题或日期无效阻止整批保存', () => {
  const valid = {title:'开会',date:'2026-11-09',note:''};
  for (const changed of [{title:''},{date:''},{date:'2026-02-30'},{date:'2026-2-9'}]) {
    const result = capture.validateRows([valid,{...valid,...changed}]);
    assert.deepEqual(result.events, []);
    assert.ok(result.errors.length > 0);
  }
  assert.ok(capture.validateRows([]).errors.length > 0);
});

test('长文本不静默截断，超限标题或最终备注均明确拒绝', () => {
  const source = '11月9日' + '开会'.repeat(50);
  const [row] = parse(source);
  assert.equal(row.title.length, 100);
  assert.ok(capture.validateRows([row]).errors.some(message => /80/.test(message)));
  const event = { title: '开会', date: '2026-11-09', note: '记'.repeat(300) };
  assert.deepEqual(capture.validateRows([event]), { events: [event], errors: [] });
  const result = capture.validateRows([{ ...event, note: event.note + '记' }]);
  assert.ok(result.errors.some(message => /300/.test(message)));
  assert.deepEqual(result.events, []);
});
