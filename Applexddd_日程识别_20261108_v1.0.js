(function (root) {
  'use strict';

  var weekdayNumbers = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };
  var numberChars = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };

  function pad(number) { return String(number).padStart(2, '0'); }

  function normalize(text) {
    return String(text || '').normalize('NFKC')
      .replace(/([\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, '$1')
      .replace(/(?<!\d)(\d(?:[ \t]+\d)+)(?!\d)/g, function (digits) { return digits.replace(/[ \t]/g, ''); })
      .replace(/[ \t]*([年月日号点时分:])[ \t]*/g, '$1')
      .replace(/(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里)[ \t]+(?=[零〇一二两三四五六七八九十\d])/g, '$1').trim();
  }

  function calendarDate(year, month, day) {
    if (!Number.isInteger(year) || year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    var date = new Date(Date.UTC(2000, month - 1, day, 12));
    date.setUTCFullYear(year);
    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? date : null;
  }

  function dateKey(date) {
    return String(date.getUTCFullYear()).padStart(4, '0') + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
  }

  function readDateKey(key) {
    var match = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? calendarDate(Number(match[1]), Number(match[2]), Number(match[3])) : null;
  }

  function findDate(text, reference) {
    var match = text.match(/(?<!\d)(\d{4})(?:年|[-/.])(\d{1,2})(?:月|[-/.])(\d{1,2})(?!\d)(?:日|号)?/);
    var inferredYear = false;
    var date;
    if (match) date = calendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
    else {
      match = text.match(/(?<!\d)(\d{1,2})月(\d{1,2})(?!\d)(?:日|号)?/);
      if (match) {
        inferredYear = true;
        date = calendarDate(reference.getUTCFullYear(), Number(match[1]), Number(match[2]));
      } else {
        match = text.match(/今天|明天|后天/);
        if (match) {
          date = new Date(reference.getTime());
          date.setUTCDate(date.getUTCDate() + { '今天': 0, '明天': 1, '后天': 2 }[match[0]]);
        } else {
          match = text.match(/(?<!每|个)(本|这|下)?(?:周|星期|礼拜)([一二三四五六日天])(?![次节周])/);
          if (!match) return null;
          date = new Date(reference.getTime());
          var currentWeekday = reference.getUTCDay() || 7;
          date.setUTCDate(date.getUTCDate() - currentWeekday + weekdayNumbers[match[2]] + (match[1] === '下' ? 7 : 0));
        }
      }
    }
    return { raw: match[0], key: date ? dateKey(date) : '', inferredYear: inferredYear };
  }

  function chineseNumber(text) {
    if (/^\d+$/.test(text)) return Number(text);
    if (text.indexOf('十') !== -1) {
      var parts = text.split('十');
      return (parts[0] ? numberChars[parts[0]] : 1) * 10 + (parts[1] ? numberChars[parts[1]] : 0);
    }
    return Number(text.split('').map(function (character) { return numberChars[character]; }).join(''));
  }

  function findTime(text) {
    var match = text.match(/(?<![\d:])(?:(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里))?(\d{1,2}):(\d{1,2})(?![\d:])/);
    var hour, minute;
    if (match) { hour = Number(match[2]); minute = Number(match[3]); }
    else {
      match = text.match(/(?:(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里))?([零〇一二两三四五六七八九十\d]{1,3})(?:点|时)(?:(半)|([零〇一二两三四五六七八九十\d]{1,3})(?:分)?)?/);
      if (!match) return null;
      hour = chineseNumber(match[2]); minute = match[3] ? 30 : match[4] ? chineseNumber(match[4]) : 0;
    }
    var period = match[1] || '';
    if (/下午|傍晚|晚上|夜里/.test(period) && hour >= 1 && hour < 12) hour += 12;
    if (period === '中午' && hour >= 1 && hour < 11) hour += 12;
    if ((period === '凌晨' || period === '夜里' || period === '晚上') && hour === 12) hour = 0;
    return { raw: match[0], value: pad(hour) + ':' + pad(minute) };
  }

  function titleFromLine(line, date, time) {
    if (/^(?:地点|位置|教室|备注|地址|联系人|电话)[:：]/.test(line)) return '';
    var cleaned = date ? line.replace(date.raw, ' ') : line;
    var nextTime = time;
    while (nextTime) {
      cleaned = cleaned.replace(nextTime.raw, ' ');
      nextTime = findTime(cleaned);
    }
    cleaned = cleaned.replace(/(?:日程日期|活动日期|会议时间|活动时间|日期|时间)[:：]/g, ' ')
      .replace(/^(?:事项|标题|事件|日程|活动名称|会议主题)[:：]/, '')
      .replace(/^\s*(?:[•·-]|\d{1,2}[.、)）])\s*/, '')
      .replace(/^[\s,，、:：;；()（）\-–—~]+|[\s,，、:：;；()（）\-–—~]+$/g, '')
      .replace(/^(?:请于|于|在)(?=\S)/, '').trim();
    if (/^(?:活动|会议|日程|事项)?(?:通知|安排)[:：]?$/.test(cleaned)) return '';
    return cleaned;
  }

  function makeRow(lines, reference) {
    var firstDate = null, firstTime = null, title = '', priority = -1;
    lines.forEach(function (raw) {
      var line = normalize(raw);
      var date = findDate(line, reference);
      var time = findTime(line);
      if (!firstDate && date) firstDate = date;
      if (!firstTime && time) firstTime = time;
      var candidate = titleFromLine(line, date, time);
      var candidatePriority = /^(?:事项|标题|事件|活动名称|会议主题)[:：]/.test(line) ? 4 : date ? 3 : 2;
      if (candidate && candidatePriority > priority) { title = candidate; priority = candidatePriority; }
    });
    var note = [];
    if (firstDate && firstDate.inferredYear) note.push('年份按参考日期的' + reference.getUTCFullYear() + '年识别。');
    if (firstDate && !firstDate.key) note.push('日期待核对：' + firstDate.raw);
    note.push('原文：' + lines.join('\n'));
    return { title: title, date: firstDate ? firstDate.key : '', time: firstTime ? firstTime.value : '', note: note.join('\n') };
  }

  function parse(text, referenceDateKey) {
    var source = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!source) return [];
    if (!referenceDateKey) {
      var today = new Date();
      referenceDateKey = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    }
    var reference = readDateKey(referenceDateKey);
    if (!reference) throw new Error('参考日期不正确');
    var groups = [], current = [], hasDate = false;
    source.split('\n').forEach(function (rawLine) {
      var pieces = rawLine.split(/[;；]/);
      if (pieces.filter(function (part) { return findDate(normalize(part), reference); }).length < 2) pieces = [rawLine];
      pieces.forEach(function (raw) {
        raw = raw.trim();
        if (!raw) { if (current.length) groups.push(current); current = []; hasDate = false; return; }
        var line = normalize(raw);
        var date = findDate(line, reference);
        if (date && current.length) {
          var containsTitle = !!titleFromLine(line, date, findTime(line));
          var priorHasTitle = current.some(function (part) {
            var normalized = normalize(part);
            return !!titleFromLine(normalized, findDate(normalized, reference), findTime(normalized));
          });
          if (hasDate || (containsTitle && priorHasTitle)) { groups.push(current); current = []; hasDate = false; }
        }
        current.push(raw);
        if (date) hasDate = true;
      });
    });
    if (current.length) groups.push(current);
    return groups.map(function (lines) { return makeRow(lines, reference); })
      .filter(function (row) { return row.title || row.date || row.time || /日期待核对/.test(row.note); });
  }

  function validateRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return { events: [], errors: ['请至少保留一条日程'] };
    var events = [], errors = [];
    rows.forEach(function (row, index) {
      row = row || {};
      var prefix = '第' + (index + 1) + '条日程：';
      var title = String(row.title || '').trim();
      var date = String(row.date || '').trim();
      var time = String(row.time || '').trim();
      var note = String(row.note || '').trim();
      if (!title) errors.push(prefix + '请填写事项标题');
      if (title.length > 80) errors.push(prefix + '标题不能超过80字，请核对修改');
      if (!readDateKey(date)) errors.push(prefix + '请填写有效日期');
      if (time && (!/^\d{2}:\d{2}$/.test(time) || Number(time.slice(0, 2)) > 23 || Number(time.slice(3)) > 59)) {
        errors.push(prefix + '时间应为有效的24小时制 HH:mm');
      }
      var savedNote = time ? '时间：' + time + (note ? '\n' + note : '') : note;
      if (savedNote.length > 300) errors.push(prefix + '时间与备注合计不能超过300字，请核对修改');
      events.push({ title: title, date: date, note: savedNote });
    });
    return { events: errors.length ? [] : events, errors: errors };
  }

  var api = { parse: parse, validateRows: validateRows };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EventCaptureParser = api;
})(typeof window === 'object' ? window : globalThis);
