(function (root) {
  'use strict';

  var keys = ['profile', 'links', 'todos', 'scheduleWeek', 'accounts', 'birthdays', 'personalEvents', 'importedSchedule'];

  function check(condition, label) {
    if (!condition) throw new Error(label + '格式不正确，请选择完整的生活助理备份文件。');
  }

  function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function text(value, required) {
    return typeof value === 'string' && (!required || value.trim().length > 0);
  }

  function integer(value, min, max) {
    return Number.isInteger(value) && value >= min && value <= max;
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var parts = value.split('-').map(Number);
    var year = parts[0], month = parts[1], day = parts[2];
    if (!integer(year, 1, 9999) || !integer(month, 1, 12)) return false;
    var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return integer(day, 1, days[month - 1]);
  }

  function validTimestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !validDate(value.slice(0, 10))) return false;
    var date = new Date(value);
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 19) === value.slice(0, 19);
  }

  function validUrl(value) {
    if (!text(value, true)) return false;
    try {
      var url = new URL(value);
      if (['http:', 'https:', 'ftp:'].indexOf(url.protocol) !== -1) return !!url.hostname;
      return ['mailto:', 'tel:'].indexOf(url.protocol) !== -1 && url.pathname.trim().length > 0;
    } catch (error) { return false; }
  }

  function items(value, label, validate) {
    check(Array.isArray(value), label);
    Array.from(value).forEach(function (item) {
      check(object(item), label);
      validate(item);
    });
  }

  function recordIds(records, label) {
    var seen = new Set();
    records.forEach(function (record) {
      check(text(record.id, true) && !seen.has(record.id), label);
      seen.add(record.id);
    });
  }

  function orderedNumbers(value, maximum) {
    return Array.isArray(value) && value.length > 0 && Array.from(value).every(function (number, index) {
      return integer(number, 1, maximum) && (!index || number > value[index - 1]);
    });
  }

  function validateData(data) {
    check(object(data) && keys.every(function (key) { return Object.prototype.hasOwnProperty.call(data, key); }) &&
      Object.keys(data).every(function (key) { return keys.indexOf(key) !== -1; }), '备份数据');
    check(object(data.profile) && text(data.profile.name, true) && text(data.profile.tagline) &&
      (data.profile.bio === undefined || text(data.profile.bio)), '个人资料');
    items(data.links, '链接', function (link) {
      check(text(link.title, true) && validUrl(link.url), '链接网址');
    });
    items(data.todos, '待办', function (todo) {
      check(text(todo.text, true) && typeof todo.done === 'boolean', '待办');
    });
    check(integer(data.scheduleWeek, 1, 60), '课表周次');
    items(data.accounts, '账号', function (account) {
      check(text(account.site, true) && text(account.user, true) && text(account.pass) && account.pass.length > 0, '账号');
      if (account.secret !== undefined) {
        check(text(account.secret), '账号密钥');
        var secret = account.secret.replace(/[\s=]+/g, '').toUpperCase();
        check(/^[A-Z2-7]+$/.test(secret) && secret.length * 5 >= 8, '账号密钥');
      }
    });
    items(data.birthdays, '好友生日', function (birthday) {
      check(text(birthday.name, true) && integer(birthday.month, 1, 12) && integer(birthday.day, 1, 30) &&
        typeof birthday.leap === 'boolean' && text(birthday.note), '好友生日');
    });
    recordIds(data.birthdays, '好友生日ID');
    items(data.personalEvents, '日历事件', function (event) {
      check(text(event.title, true) && validDate(event.date) && text(event.note), '日历事件');
    });
    recordIds(data.personalEvents, '日历事件ID');
    if (data.importedSchedule !== null) {
      var schedule = data.importedSchedule;
      check(object(schedule) && schedule.version === 1 && Array.isArray(schedule.courses) && schedule.courses.length > 0, '课表');
      items(schedule.courses, '课表', function (course) {
        check(text(course.name, true) && text(course.teacher) && text(course.room) && integer(course.day, 1, 7) &&
          orderedNumbers(course.periods, 12) && orderedNumbers(course.weeks, 60) &&
          ['green', 'orange', 'red', 'teal'].indexOf(course.color) !== -1 &&
          (course.roomWeek10 === undefined || text(course.roomWeek10)), '课表');
      });
    }
    return JSON.parse(JSON.stringify(data));
  }

  function validateEnvelope(backup) {
    check(object(backup) && backup.format === 'Applexddd.backup', '备份文件');
    if (backup.version !== 1) throw new Error('不支持此备份版本，请使用兼容版本的生活助理。');
    check(validTimestamp(backup.exportedAt), '备份时间');
    return { format: 'Applexddd.backup', version: 1, exportedAt: backup.exportedAt, data: validateData(backup.data) };
  }

  function create(data, exportedAt) {
    return validateEnvelope({ format: 'Applexddd.backup', version: 1, exportedAt: exportedAt, data: data });
  }

  function parse(source) {
    var backup;
    try {
      if (typeof source !== 'string') throw new Error();
      backup = JSON.parse(source.replace(/^\uFEFF/, ''));
    } catch (error) { throw new Error('备份文件无法读取，请选择生活助理导出的 JSON 文件。'); }
    return validateEnvelope(backup);
  }

  function restore(storage, backup) {
    var data = validateEnvelope(backup).data;
    var previous = {};
    var next = {};
    try {
      keys.forEach(function (key) {
        previous[key] = storage.getItem(key);
        next[key] = JSON.stringify(data[key]);
      });
    } catch (error) { throw new Error('读取本机数据失败，未导入备份，请检查浏览器存储权限。'); }
    var changed = [];
    try {
      keys.forEach(function (key) {
        if (previous[key] === next[key]) return;
        storage.setItem(key, next[key]);
        changed.push(key);
      });
    } catch (error) {
      // 先释放本次写入，避免较大的旧值在回滚中途触及容量上限。
      changed.forEach(function (key) {
        try { storage.removeItem(key); } catch (removeError) {}
      });
      changed.forEach(function (key) {
        if (previous[key] !== null) {
          try { storage.setItem(key, previous[key]); } catch (restoreError) {}
        }
      });
      var recovered = false;
      try {
        recovered = changed.every(function (key) { return storage.getItem(key) === previous[key]; });
      } catch (readError) {}
      if (!recovered) throw new Error('导入失败，且未能完整恢复原数据。请保留备份文件，检查浏览器存储权限后重新导入。');
      throw new Error('导入保存失败，原数据已恢复。请检查浏览器存储空间和权限后重试。');
    }
  }

  var api = { create: create, parse: parse, restore: restore };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DataBackup = api;
})(typeof window === 'object' ? window : globalThis);
