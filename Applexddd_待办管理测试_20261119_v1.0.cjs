const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const modulePath = path.join(__dirname, 'Applexddd_待办管理_20261119_v1.0.js');
const todos = fs.existsSync(modulePath) ? require(modulePath) : null;
const now = '2026-11-19T12:00:00.000Z';

test('整理时未完成排在前且两个分组各自保留顺序', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = [
    { text: '完成甲', done: true, completedAt: '2026-11-18T12:00:00.000Z' },
    { text: '未完成甲', done: false },
    { text: '完成乙', done: true, completedAt: '2026-11-17T12:00:00.000Z' },
    { text: '未完成乙', done: false }
  ];
  const output = todos.normalize(input, now);
  assert.deepEqual(output.map(todo => todo.text), ['未完成甲', '未完成乙', '完成甲', '完成乙']);
  assert.notStrictEqual(output, input);
  assert.deepEqual(input.map(todo => todo.text), ['完成甲', '未完成甲', '完成乙', '未完成乙']);
});

test('旧完成记录从本次整理时间开始计时且重复整理不重计', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = [{ text: '旧任务', done: true, note: '保留信息', extra: { value: 1 } }];
  const output = todos.normalize(input, now);
  assert.deepEqual(output, [{ text: '旧任务', done: true, note: '保留信息', extra: { value: 1 }, completedAt: now }]);
  assert.equal(input[0].completedAt, undefined);
  assert.deepEqual(todos.normalize(output, '2026-11-20T12:00:00.000Z'), output);
});

test('整理时修复非法完成时间并接受有效UTC时间', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const invalid = [undefined, null, 123, '', 'not-a-date', '2026-02-30T12:00:00.000Z',
    '2026-11-18T24:00:00.000Z', '2026-11-18', '2026-11-18T12:00:00+00:00'];
  const input = invalid.map(completedAt => ({ text: '修复时间', done: true, completedAt }));
  input.push({ text: '有效时间', done: true, completedAt: '2026-11-18T12:00:00Z' });
  input.push({ text: '毫秒时间', done: true, completedAt: '2026-11-18T12:00:00.123Z' });
  const output = todos.normalize(input, now);
  assert.deepEqual(output.slice(0, invalid.length).map(todo => todo.completedAt), Array(invalid.length).fill(now));
  assert.equal(output[invalid.length].completedAt, '2026-11-18T12:00:00Z');
  assert.equal(output[invalid.length + 1].completedAt, '2026-11-18T12:00:00.123Z');
  assert.equal(input[0].completedAt, undefined);
});

test('整理未完成记录时移除遗留完成时间并保留其他字段', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = [{ text: '继续处理', done: false, completedAt: '2026-11-10T12:00:00.000Z', note: '备注' }];
  assert.deepEqual(todos.normalize(input, now), [{ text: '继续处理', done: false, note: '备注' }]);
  assert.equal(input[0].completedAt, '2026-11-10T12:00:00.000Z');
});

test('完成指定任务后移到整个列表末尾并记录完成时间', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = Object.freeze([
    Object.freeze({ text: '甲', done: false, note: '保留备注' }),
    Object.freeze({ text: '乙', done: false }),
    Object.freeze({ text: '丙', done: true, completedAt: '2026-11-18T12:00:00.000Z' })
  ]);
  const output = todos.toggle(input, 0, now);
  assert.deepEqual(output, [input[1], input[2], { text: '甲', done: true, note: '保留备注', completedAt: now }]);
  assert.notStrictEqual(output, input);
  assert.strictEqual(output[0], input[1]);
  assert.strictEqual(output[1], input[2]);
  assert.deepEqual(input[0], { text: '甲', done: false, note: '保留备注' });
});

test('取消完成后移到未完成列表第一并清除完成时间', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = Object.freeze([
    Object.freeze({ text: '甲', done: false }),
    Object.freeze({ text: '乙', done: true, completedAt: '2026-11-10T12:00:00.000Z', note: '保留备注' }),
    Object.freeze({ text: '丙', done: true, completedAt: '2026-11-18T12:00:00.000Z' })
  ]);
  assert.deepEqual(todos.toggle(input, 1, now), [
    { text: '乙', done: false, note: '保留备注' }, input[0], input[2]
  ]);
  assert.equal(input[1].done, true);
  assert.equal(input[1].completedAt, '2026-11-10T12:00:00.000Z');
});

test('撤销后再次完成按新的完成时间重新计算七天', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = [{ text: '再次完成', done: true, completedAt: '2026-11-01T12:00:00.000Z' }];
  const reopened = todos.toggle(input, 0, now);
  const output = todos.toggle(reopened, 0, '2026-11-20T12:00:00.000Z');
  assert.equal(output[0].completedAt, '2026-11-20T12:00:00.000Z');
  assert.equal(todos.partition(output, '2026-11-26T12:00:00.000Z').archived.length, 0);
  assert.equal(input[0].completedAt, '2026-11-01T12:00:00.000Z');
});

test('相同文本任务按原对象索引只切换目标记录', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const first = { text: '买书', done: false };
  const second = { text: '买书', done: true, completedAt: '2026-11-10T12:00:00.000Z' };
  const third = { text: '买书', done: true, completedAt: '2026-11-09T12:00:00.000Z' };
  const input = [first, second, third];
  const archived = todos.partition(input, now).archived;
  const output = todos.toggle(input, input.indexOf(archived[1]), now);
  assert.deepEqual(output, [{ text: '买书', done: false }, first, second]);
  assert.strictEqual(output[1], first);
  assert.strictEqual(output[2], second);
  assert.equal(third.done, true);
});

test('完成满七个24小时才进入归档包括精确边界', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = [
    { text: '差1毫秒', done: true, completedAt: '2026-11-12T12:00:00.001Z' },
    { text: '恰好七天', done: true, completedAt: '2026-11-12T12:00:00.000Z' },
    { text: '超过七天', done: true, completedAt: '2026-11-12T11:59:59.999Z' }
  ];
  assert.deepEqual(todos.partition(input, now), { active: [input[0]], archived: [input[1], input[2]] });
});

test('分组保留原对象引用和顺序且不修改原数组', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = Object.freeze([
    Object.freeze({ text: '旧完成甲', done: true, completedAt: '2026-11-01T12:00:00.000Z' }),
    Object.freeze({ text: '未完成', done: false }),
    Object.freeze({ text: '旧完成乙', done: true, completedAt: '2026-11-02T12:00:00.000Z' }),
    Object.freeze({ text: '近期完成', done: true, completedAt: '2026-11-18T12:00:00.000Z' })
  ]);
  const result = todos.partition(input, now);
  assert.strictEqual(result.active[0], input[1]);
  assert.strictEqual(result.active[1], input[3]);
  assert.strictEqual(result.archived[0], input[0]);
  assert.strictEqual(result.archived[1], input[2]);
  assert.equal(input.length, 4);
});

test('未完成及缺失非法或未来完成时间均保留在当前列表', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = [
    { text: '未完成有旧时间', done: false, completedAt: '2026-11-01T12:00:00.000Z' },
    { text: '旧记录', done: true },
    { text: '非法时间', done: true, completedAt: '2026-02-30T12:00:00.000Z' },
    { text: '未来时间', done: true, completedAt: '2026-11-20T12:00:00.000Z' },
    { text: '非UTC时间', done: true, completedAt: '2026-11-01T12:00:00+00:00' }
  ];
  assert.deepEqual(todos.partition(input, now), { active: input, archived: [] });
  assert.equal(todos.normalize(input, now).find(todo => todo.text === '未来时间').completedAt, '2026-11-20T12:00:00.000Z');
});

test('空列表整理和归档都返回新的空数组', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const input = [];
  const normalized = todos.normalize(input, now);
  const result = todos.partition(input, now);
  assert.deepEqual(normalized, []);
  assert.deepEqual(result, { active: [], archived: [] });
  assert.notStrictEqual(normalized, input);
  assert.notStrictEqual(result.active, input);
  assert.notStrictEqual(result.active, result.archived);
});

test('浏览器脚本以TodoManager公开同样的操作', () => {
  assert.ok(todos, '尚未实现待办管理模块');
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context);
  assert.equal(typeof context.window.TodoManager.normalize, 'function');
  const output = context.window.TodoManager.toggle([{ text: '浏览器任务', done: false }], 0, now);
  assert.equal(output[0].done, true);
  assert.equal(output[0].completedAt, now);
  assert.equal(context.window.TodoManager.partition(output, '2026-11-26T12:00:00.000Z').archived.length, 1);
});
