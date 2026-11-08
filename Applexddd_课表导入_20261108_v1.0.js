(function (root) {
  'use strict';

  var weekdays = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };
  var colors = ['green', 'orange', 'red', 'teal'];
  var numberList = '\\d+(?:\\s*[-–—~～至]\\s*\\d+)?(?:\\s*[,，、]\\s*\\d+(?:\\s*[-–—~～至]\\s*\\d+)?)*';

  function normalize(text) {
    return String(text || '').normalize('NFKC')
      .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1')
      .replace(/(\d)\s*一\s*(?=\d)/g, '$1-')
      .replace(/\s*([:：,，、;；\-–—~～])\s*/g, '$1')
      .replace(/第\s+(?=\d)/g, '第').replace(/(\d)\s+(?=[节周])/g, '$1').trim();
  }

  function dayNumber(value) {
    var text = normalize(value).replace(/星期|礼拜|周|[:：\s]/g, '');
    return weekdays[text] || (/^[1-7]$/.test(text) ? Number(text) : 0);
  }

  function rangeText(value) {
    return normalize(value).replace(/^第\s*/, '').replace(/(\d)[节周]/g, '$1');
  }

  function newRow(day) {
    return { name: '', teacher: '', day: day || 0, periodsText: '', weeksText: '', room: '' };
  }

  function fieldsFromLine(line) {
    var fields = {};
    var labels = /(课程名称|课程名|课程|名称|星期|上课日|节次|节数|周次|教学周|教室|上课地点|地点|授课教师|任课教师|教师|老师)[:：]/g;
    var matches = Array.from(line.matchAll(labels));
    matches.forEach(function (match, index) {
      var value = line.slice(match.index + match[0].length, index + 1 < matches.length ? matches[index + 1].index : line.length).trim();
      var label = match[1];
      if (/课程|名称/.test(label)) fields.name = value;
      else if (/星期|上课日/.test(label)) fields.day = dayNumber(value);
      else if (/节次|节数/.test(label)) fields.periodsText = rangeText(value);
      else if (/周次|教学周/.test(label)) fields.weeksText = rangeText(value);
      else if (/教室|地点/.test(label)) fields.room = value;
      else fields.teacher = value;
    });
    if (!matches.length) {
      var day = line.match(/(?:星期|礼拜|周)([一二三四五六日天1-7])/);
      var periods = line.match(new RegExp('第?(' + numberList + ')\\s*节'));
      var weeks = line.match(new RegExp('第?(' + numberList + ')\\s*(?:周(?:\\s*[(]?[单双](?:周)?[)]?)?|[(]?[单双]周[)]?)'));
      if (day) fields.day = dayNumber(day[1]);
      if (periods) fields.periodsText = rangeText(periods[0]);
      if (weeks) fields.weeksText = rangeText(weeks[0]);
    }
    return fields;
  }

  function parseLines(lines, impliedDay) {
    var rows = [];
    var current = null;
    lines.forEach(function (raw) {
      var line = normalize(raw);
      if (!line) return;
      var fields = fieldsFromLine(line);
      if (!Object.prototype.hasOwnProperty.call(fields, 'name') && (/(?:课程表|课表)$/.test(line) || /^\d{4}.*(?:学年|学期|校区)/.test(line))) return;
      if (Object.prototype.hasOwnProperty.call(fields, 'name')) {
        if (current) rows.push(current);
        current = newRow(impliedDay);
      }
      if (Object.keys(fields).length) {
        if (!current) {
          if (!fields.periodsText && !fields.weeksText) return;
          current = newRow(impliedDay);
        }
        Object.keys(fields).forEach(function (key) { current[key] = fields[key]; });
        return;
      }
      if (/^(?:(?:星期|节次|周次|课程名称|课程|时间|教室|教师)\s*)+$/.test(line) || /^\d{1,2}:\d{2}/.test(line)) return;
      if (/^第\d+(?:-\d+)?$/.test(line)) return;
      if (!current) {
        current = newRow(impliedDay);
        current.name = line;
      } else if (/^[A-Za-z]+[\d-]*\d(?:[A-Za-z\d-]*)$/.test(line)) {
        current.room = line;
      } else {
        rows.push(current);
        current = newRow(impliedDay);
        current.name = line;
      }
    });
    if (current) rows.push(current);
    return rows;
  }

  function ocrLines(data) {
    var lines = [];
    (data.blocks || []).forEach(function (block) {
      (block.paragraphs || []).forEach(function (paragraph) {
        (paragraph.lines || []).forEach(function (line) { if (line.bbox) lines.push(line); });
      });
    });
    return lines;
  }

  function columnHeaders(lines) {
    var candidates = [];
    lines.forEach(function (line) {
      var words = (line.words || []).filter(function (word) { return word.bbox; });
      var text = '';
      var positions = [];
      words.forEach(function (word) {
        var compact = String(word.text || '').replace(/\s/g, '');
        positions.push({ start: text.length, end: text.length + compact.length, box: word.bbox });
        text += compact;
      });
      if (!words.length) {
        text = normalize(line.text).replace(/\s/g, '');
        positions = [{ start: 0, end: text.length, box: line.bbox }];
      }
      Array.from(text.matchAll(/(?:星期|礼拜|周)([一二三四五六日天1-7])/g)).forEach(function (match) {
        var boxes = positions.filter(function (position) { return position.end > match.index && position.start < match.index + match[0].length; });
        if (!boxes.length) return;
        var x0 = Math.min.apply(null, boxes.map(function (position) { return position.box.x0; }));
        var x1 = Math.max.apply(null, boxes.map(function (position) { return position.box.x1; }));
        candidates.push({ day: dayNumber(match[1]), x: (x0 + x1) / 2, width: x1 - x0, y: (line.bbox.y0 + line.bbox.y1) / 2, bottom: line.bbox.y1 });
      });
    });
    var groups = [];
    candidates.forEach(function (candidate) {
      var group = groups.filter(function (items) { return Math.abs(items[0].y - candidate.y) <= 10; })[0];
      if (group) group.push(candidate);
      else groups.push([candidate]);
    });
    groups = groups.map(function (group) {
      return group.filter(function (item, index) { return group.findIndex(function (other) { return other.day === item.day; }) === index; });
    }).sort(function (a, b) { return b.length - a.length; });
    if (!groups.length || groups[0].length < 2) return [];
    var headers = groups[0].sort(function (a, b) { return a.x - b.x; });
    if (headers.some(function (header, index) { return index && header.x <= headers[index - 1].x; })) return [];
    return headers;
  }

  function parseOcr(data) {
    data = data || {};
    var lines = ocrLines(data);
    var headers = columnHeaders(lines);
    if (!headers.length) return parseLines(String(data.text || '').split(/\r?\n/), 0);
    var bottom = Math.max.apply(null, headers.map(function (header) { return header.bottom; }));
    var columns = headers.map(function () { return []; });
    var left = headers[0].x - (headers[1].x - headers[0].x) / 2 + headers[0].width / 2;
    var last = headers.length - 1;
    var right = headers[last].x + (headers[last].x - headers[last - 1].x) / 2;
    lines.forEach(function (line) {
      if (line.bbox.y0 < bottom) return;
      var groups = headers.map(function () { return []; });
      var words = (line.words || []).filter(function (word) { return word.bbox; });
      if (!words.length) words = [{ text: line.text, bbox: line.bbox }];
      words.forEach(function (word) {
        var x = (word.bbox.x0 + word.bbox.x1) / 2;
        if (x < left || x > right) return;
        var closest = 0;
        headers.forEach(function (header, index) {
          if (Math.abs(header.x - x) < Math.abs(headers[closest].x - x)) closest = index;
        });
        groups[closest].push(word);
      });
      groups.forEach(function (wordsInColumn, index) {
        if (!wordsInColumn.length) return;
        wordsInColumn.sort(function (a, b) { return a.bbox.x0 - b.bbox.x0; });
        columns[index].push({ y: line.bbox.y0, text: wordsInColumn.map(function (word) { return word.text; }).join(' ') });
      });
    });
    var rows = [];
    columns.forEach(function (column, index) {
      column.sort(function (a, b) { return a.y - b.y; });
      rows = rows.concat(parseLines(column.map(function (line) { return line.text; }), headers[index].day));
    });
    return rows;
  }

  function parseNumbers(value, maximum, allowParity) {
    var text = normalize(value).replace(/\s/g, '').replace(/^[第]/, '').replace(/[–—~～至]/g, '-').replace(/[，、；;]/g, ',');
    var parity = '';
    var parityMatch = text.match(/\(?([单双])(?:周)?\)?$/);
    if (parityMatch) {
      if (!allowParity) return null;
      parity = parityMatch[1];
      text = text.slice(0, parityMatch.index);
    }
    text = text.replace(allowParity ? /周$/ : /节$/, '');
    if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(text)) return null;
    var numbers = [];
    var valid = text.split(',').every(function (part) {
      var bounds = part.split('-').map(Number);
      var start = bounds[0];
      var end = bounds.length > 1 ? bounds[1] : start;
      if (start < 1 || end > maximum || end < start) return false;
      for (var number = start; number <= end; number++) {
        if ((!parity || number % 2 === (parity === '单' ? 1 : 0)) && numbers.indexOf(number) === -1) numbers.push(number);
      }
      return true;
    });
    return valid && numbers.length ? numbers.sort(function (a, b) { return a - b; }) : null;
  }

  function validateRows(rows) {
    var errors = [];
    var courses = [];
    if (!Array.isArray(rows) || !rows.length) return { courses: [], errors: ['请至少保留一条课程后再导入'] };
    rows.forEach(function (row, index) {
      row = row || {};
      var prefix = '第' + (index + 1) + '条课程：';
      var name = String(row.name || '').trim();
      var day = Number(row.day);
      var periods = parseNumbers(row.periodsText, 12, false);
      var weeks = parseNumbers(row.weeksText, 60, true);
      if (!name) errors.push(prefix + '请填写课程名称');
      if (!Number.isInteger(day) || day < 1 || day > 7) errors.push(prefix + '请选择星期一至星期日');
      if (!periods) errors.push(prefix + '节次应为1–12，可填写范围或用逗号分隔');
      if (!weeks) errors.push(prefix + '周次应为1–60，可填写范围、离散周次或单双周');
      courses.push({ name: name, teacher: String(row.teacher || '').trim(), day: day, periods: periods, weeks: weeks, room: String(row.room || '').trim(), color: colors[index % colors.length] });
    });
    return { courses: errors.length ? [] : courses, errors: errors };
  }

  function formatRanges(numbers) {
    if (!numbers.length) return '';
    var sorted = Array.from(new Set(numbers)).sort(function (a, b) { return a - b; });
    var parts = [];
    var start = sorted[0];
    var previous = start;
    sorted.slice(1).concat([null]).forEach(function (number) {
      if (number !== null && number === previous + 1) { previous = number; return; }
      parts.push(start === previous ? String(start) : start + '–' + previous);
      start = number;
      previous = number;
    });
    return parts.join('、');
  }

  var api = { parseOcr: parseOcr, validateRows: validateRows, formatRanges: formatRanges };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScheduleImport = api;
})(typeof window === 'object' ? window : globalThis);
