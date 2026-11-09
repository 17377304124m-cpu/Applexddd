const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname, 'Applexddd_数据备份_20261109_v1.0.js');
const backup = fs.existsSync(modulePath) ? require(modulePath) : null;
const exportedAt = '2026-11-09T07:08:09.000Z';

function data() {
  return {
    profile: { name: '迁移示例', tagline: '', bio: '保留旧资料' },
    links: [{ title: '乙', url: 'https://example.org/b' }, { title: '甲', url: 'https://example.com/a' }],
    todos: [{ text: '整理课表', done: true }, { text: '买书', done: false }],
    scheduleWeek: 10,
    accounts: [{ site: '示例', user: 'demo', pass: 'test-only', secret: 'JBSW Y3DP EHPK 3PXP' }],
    birthdays: [{ id: 'birthday-1', name: '朋友', month: 10, day: 30, leap: true, note: '农历生日' }],
    personalEvents: [{ id: 'event-1', title: '会议', date: '2028-02-29', note: '时间：16:00\n保留原文' }],
    importedSchedule: { version: 1, courses: [{ name: '课程', teacher: '', day: 7, periods: [1, 3], weeks: [10, 12, 14], room: 'B412', roomWeek10: 'A-306', color: 'teal' }] }
  };
}

function envelope(changes = {}) {
  return { format: 'Applexddd.backup', version: 1, exportedAt, data: data(), ...changes };
}

function api() {
  assert.ok(backup, '尚未实现数据备份模块');
  return backup;
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

test('完整往返保存全部类别、链接顺序、农历生日、课表特例和2FA密钥', () => {
  const source = data();
  const created = api().create(source, exportedAt);
  const actual = api().parse(JSON.stringify(created));
  assert.deepEqual(actual, envelope());
  actual.data.profile.name = '改过的副本';
  created.data.profile.name = '改过的导出内容';
  assert.equal(source.profile.name, '迁移示例');
});

test('空集合和默认课表标记可正常恢复，不追加原记录', () => {
  const empty = data();
  for (const key of ['links', 'todos', 'accounts', 'birthdays', 'personalEvents']) empty[key] = [];
  empty.importedSchedule = null;
  const store = memoryStorage({ links: '[{"title":"旧记录","url":"https://example.com"}]', unrelated: '保留' });
  api().restore(store, api().create(empty, exportedAt));
  for (const key of ['links', 'todos', 'accounts', 'birthdays', 'personalEvents']) assert.deepEqual(JSON.parse(store.getItem(key)), []);
  assert.equal(JSON.parse(store.getItem('importedSchedule')), null);
  assert.equal(store.getItem('unrelated'), '保留');
});

test('普通网址、FTP、邮件及电话链接可以原样往返', () => {
  const source = data();
  source.links = ['https://example.com/中文?q=1', 'http://localhost:3000/', 'ftp://files.example.org/a', 'mailto:friend@example.com', 'tel:+8613800000000'].map((url) => ({ title: '链接', url }));
  assert.deepEqual(api().parse(JSON.stringify(api().create(source, exportedAt))).data.links, source.links);
});

test('执行脚本、未知协议、缺少目标和伪装的恶意链接均拒绝', () => {
  for (const url of ['javascript:alert(1)', ' \nJaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'file:///tmp/a', 'https://', 'mailto:', 'tel:', 'javascript&#58;alert(1)', '%6aavascript:alert(1)', '//example.com']) {
    const source = data(); source.links[0].url = url;
    assert.throws(() => api().parse(JSON.stringify(envelope({ data: source }))), /链接|网址/);
  }
});

test('损坏文件、其他应用文件、不支持版本和缺少数据类别均拒绝', () => {
  assert.throws(() => api().parse('{'), /备份/);
  assert.throws(() => api().parse(JSON.stringify(envelope({ format: 'other' }))), /备份/);
  assert.throws(() => api().parse(JSON.stringify(envelope({ version: 2 }))), /版本/);
  const source = data(); delete source.accounts;
  assert.throws(() => api().parse(JSON.stringify(envelope({ data: source }))), /数据|账号/);
});

test('事件日期检查闰年和真实月日，不能自动滚动到另一天', () => {
  for (const date of ['2026-02-29', '2028-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-01', '0000-01-01']) {
    const source = data(); source.personalEvents[0].date = date;
    assert.throws(() => api().create(source, exportedAt), /事件/);
  }
  assert.equal(api().create(data(), exportedAt).data.personalEvents[0].date, '2028-02-29');
});

test('农历生日范围、布尔值和同类记录ID必须有效', () => {
  for (const change of [{ month: 13 }, { day: 31 }, { month: '10' }, { leap: 'true' }, { id: '' }]) {
    const source = data(); Object.assign(source.birthdays[0], change);
    assert.throws(() => api().create(source, exportedAt), /生日/);
  }
  const source = data(); source.birthdays.push({ ...source.birthdays[0] });
  assert.throws(() => api().create(source, exportedAt), /生日/);
  const events = data(); events.personalEvents.push({ ...events.personalEvents[0] });
  assert.throws(() => api().create(events, exportedAt), /事件/);
});

test('课表星期节次周次及数组顺序无效时拒绝，保留合法离散课次', () => {
  for (const change of [{ day: 8 }, { periods: [0] }, { periods: [13] }, { weeks: [61] }, { weeks: [] }, { periods: [3, 1] }, { weeks: [10, 10] }, { name: '' }]) {
    const source = data(); Object.assign(source.importedSchedule.courses[0], change);
    assert.throws(() => api().create(source, exportedAt), /课表/);
  }
  const source = data(); source.importedSchedule.courses = [];
  assert.throws(() => api().create(source, exportedAt), /课表/);
});

test('数据类型和2FA格式错误不能混入备份，错误不回显敏感内容', () => {
  for (const change of [{ pass: 123 }, { user: null }, { secret: 'sensitive-not-base32!' }]) {
    const source = data(); Object.assign(source.accounts[0], change);
    assert.throws(() => api().create(source, exportedAt), (error) => /账号/.test(error.message) && !error.message.includes('sensitive-not-base32'));
  }
  const source = data(); source.todos[0].done = 'true';
  assert.throws(() => api().create(source, exportedAt), /待办/);
});

test('不会截断当前页面可保存的长文本及原始密码', () => {
  const source = data(); source.todos[0].text = '长内容'.repeat(2000); source.accounts[0].pass = '  任意密码\n文字  ';
  assert.deepEqual(api().parse(JSON.stringify(api().create(source, exportedAt))).data, source);
});

test('密码仅含空格仍按原值保留，不能因修剪而无法迁移', () => {
  const source = data(); source.accounts[0].pass = '   ';
  assert.equal(api().parse(JSON.stringify(api().create(source, exportedAt))).data.accounts[0].pass, '   ');
});

test('备份时间不能是无效日期，验证和预览不会写入存储', () => {
  assert.throws(() => api().create(data(), '2026-02-30T07:08:09.000Z'), /时间/);
  const store = memoryStorage({ links: '旧值' }); const before = store.snapshot();
  api().parse(JSON.stringify(envelope()));
  assert.deepEqual(store.snapshot(), before);
});

test('导入只替换明确的数据键，旧备份类别不与本机记录混合', () => {
  const store = memoryStorage({ accounts: '[{"site":"旧账号"}]', unrelated: '旁边应用的值' });
  api().restore(store, envelope());
  for (const key of Object.keys(data())) assert.deepEqual(JSON.parse(store.getItem(key)), data()[key]);
  assert.equal(store.getItem('unrelated'), '旁边应用的值');
});

test('中途保存失败时回滚已修改键，旧原始字符串及未知键均保持', () => {
  const store = memoryStorage({ profile: ' { "old" : "profile" } ', links: '[ ]', scheduleWeek: ' 14 ', unrelated: '旁边应用的值' });
  const before = store.snapshot(); const originalSet = store.setItem; let writes = 0;
  store.setItem = function (key, value) { if (++writes === 4) throw Error('quota'); originalSet(key, value); };
  assert.throws(() => api().restore(store, envelope()), /失败/);
  assert.deepEqual(store.snapshot(), before);
});

test('存储读取被拒或导入验证失败时不产生部分写入', () => {
  const store = memoryStorage({ profile: '{"old":true}', unrelated: '保留' }); const before = store.snapshot();
  const invalid = envelope({ version: 2 });
  assert.throws(() => api().restore(store, invalid), /版本/);
  assert.deepEqual(store.snapshot(), before);
  store.getItem = function () { throw Error('blocked'); };
  assert.throws(() => api().restore(store, envelope()), /失败|读取/);
  assert.deepEqual(store.snapshot(), before);
});

test('持续存储故障无法回滚时准确报错，不能声称原数据未变', () => {
  const store = memoryStorage({ profile: '{"old":true}' }); const originalSet = store.setItem; let writes = 0;
  store.setItem = function (key, value) { if (++writes >= 2) throw Error('blocked'); originalSet(key, value); };
  store.removeItem = function () { throw Error('blocked'); };
  assert.throws(() => api().restore(store, envelope()), /未能完整恢复|无法完整恢复/);
});
