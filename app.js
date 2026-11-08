(function () {
  'use strict';

  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
  };

  var $ = function (s) { return document.querySelector(s); };

  function svgIcon(paths) {
    return '<svg viewBox="0 0 24 24">' + paths + '</svg>';
  }
  var ICON_LINK = '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>';
  var ICON_TRASH = '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6z"/><path d="M10 11v6M14 11v6"/>';
  var ICON_CHECK = '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>';
  var ICON_CIRCLE = '<circle cx="12" cy="12" r="9"/>';
  var ICON_COPY = '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';
  var ICON_COPIED = '<path d="M20 6 9 17l-5-5"/>';
  var ICON_EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
  var ICON_EYE_OFF = '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M6.1 6.1C3.6 7.7 2 12 2 12s3.5 7 10 7c2 0 3.8-.6 5.3-1.5M10 5.2c.6-.1 1.3-.2 2-.2 6.5 0 10 7 10 7s-.8 1.6-2.2 3.2M2 2l20 20"/>';

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  /* ================= 底部标签切换 ================= */
  var tabs = document.querySelectorAll('.tabbar .tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      $('#page-' + tab.dataset.page).classList.add('active');
    });
  });

  /* ================= 个人资料 ================= */
  var profile = store.get('profile', {
    name: '明军',
    tagline: '保持好奇，持续行动'
  });

  var nameEl = $('#profile-name');
  var taglineEl = $('#profile-tagline');
  var editBtn = $('#profile-edit-btn');
  var editing = false;

  function renderProfile() {
    nameEl.textContent = profile.name;
    taglineEl.textContent = profile.tagline;
    document.title = profile.name + '的生活助理';
  }

  editBtn.addEventListener('click', function () {
    if (!editing) {
      editing = true;
      editBtn.title = '保存资料';
      editBtn.setAttribute('aria-label', '保存资料');
      nameEl.innerHTML = '<input id="edit-name" class="editing-input" maxlength="20">';
      taglineEl.innerHTML = '<input id="edit-tagline" class="editing-input" maxlength="40">';
      $('#edit-name').value = profile.name;
      $('#edit-tagline').value = profile.tagline;
      editBtn.classList.add('accent');
    } else {
      editing = false;
      profile.name = $('#edit-name').value.trim() || profile.name;
      profile.tagline = $('#edit-tagline').value.trim();
      store.set('profile', profile);
      renderProfile();
      editBtn.classList.remove('accent');
      editBtn.title = '编辑资料';
      editBtn.setAttribute('aria-label', '编辑资料');
    }
  });

  /* ================= 生活日历 ================= */
  var calendarNow = new Date();
  var calendarYear = calendarNow.getFullYear();
  var calendarMonth = calendarNow.getMonth() + 1;
  var calendarSelected = calendarNow.getDate();
  var birthdays = store.get('birthdays', []);
  var personalEvents = store.get('personalEvents', []);
  var recordKind = 'birthday';

  function renderCalendar() {
    var today = new Date();
    var todayKey = LifeCalendar.getDayInfo(today.getFullYear(), today.getMonth() + 1, today.getDate()).key;
    var selected = LifeCalendar.getDayInfo(calendarYear, calendarMonth, calendarSelected);
    var selectedEntries = LifeCalendar.getPersonalEntries(selected.key, birthdays, personalEvents);
    $('#calendar-month').textContent = calendarYear + ' 年 ' + calendarMonth + ' 月';
    var grid = $('#calendar-grid');
    grid.setAttribute('aria-label', calendarYear + '年' + calendarMonth + '月日期');
    grid.innerHTML = '';
    LifeCalendar.getMonthDays(calendarYear, calendarMonth).forEach(function (info) {
      if (!info) {
        var blank = el('span', 'calendar-blank');
        blank.setAttribute('aria-hidden', 'true');
        grid.appendChild(blank);
        return;
      }
      var button = el('button', 'calendar-day');
      var personal = LifeCalendar.getPersonalEntries(info.key, birthdays, personalEvents);
      button.type = 'button';
      button.dataset.date = info.key;
      button.classList.toggle('is-today', info.key === todayKey);
      button.classList.toggle('is-selected', info.key === selected.key);
      button.classList.toggle('is-weekend', info.weekday === 0 || info.weekday === 6);
      button.classList.toggle('has-event', info.events.length > 0);
      button.classList.toggle('has-personal', personal.length > 0);
      button.setAttribute('aria-pressed', String(info.key === selected.key));
      if (info.key === todayKey) button.setAttribute('aria-current', 'date');
      var description = info.key + '，农历' + info.lunar;
      if (info.events.length) description += '，' + info.events.join('、');
      if (personal.length) description += '，' + personal.map(function (entry) { return entry.title; }).join('、');
      if (info.holiday) description += '，' + info.holiday + '放假';
      if (info.workday) description += '，调休补班';
      button.setAttribute('aria-label', description);
      var number = el('span', 'calendar-number');
      number.textContent = info.day;
      var label = el('span', 'calendar-day-label');
      label.textContent = personal.length ? personal[0].title : info.events[0] || info.lunarShort;
      button.appendChild(number);
      button.appendChild(label);
      if (info.holiday || info.workday) {
        var badge = el('span', 'calendar-badge ' + (info.holiday ? 'badge-holiday' : 'badge-workday'));
        badge.textContent = info.holiday ? '休' : '班';
        button.appendChild(badge);
      }
      button.addEventListener('click', function () {
        calendarSelected = info.day;
        renderCalendar();
        grid.querySelector('[data-date="' + info.key + '"]').focus({ preventScroll: true });
      });
      grid.appendChild(button);
    });
    var detail = $('#calendar-detail');
    detail.innerHTML = '';
    var heading = el('h4');
    heading.textContent = calendarMonth + '月' + calendarSelected + '日 · 周' + '日一二三四五六'[selected.weekday];
    if (selected.key === todayKey) heading.textContent += ' · 今天';
    var lunar = el('p', 'calendar-lunar');
    lunar.textContent = '农历 ' + selected.lunar;
    var events = el('p', 'calendar-events');
    events.textContent = selected.events.length ? selected.events.join(' · ') : '暂无安排';
    var detailHeading = el('div', 'calendar-detail-heading');
    detailHeading.appendChild(heading);
    detailHeading.appendChild(lunar);
    detail.appendChild(detailHeading);
    if (selected.events.length || !selectedEntries.length) detail.appendChild(events);
    if (selectedEntries.length) {
      var dayList = el('ul', 'day-events');
      selectedEntries.forEach(function (entry) {
        var item = el('li');
        var title = el('h5');
        title.textContent = entry.title;
        item.appendChild(title);
        if (entry.note) {
          var note = el('p');
          note.textContent = entry.note;
          item.appendChild(note);
        }
        dayList.appendChild(item);
      });
      detail.appendChild(dayList);
    }
    if (selected.holiday || selected.workday) {
      var status = el('p', 'calendar-status');
      status.textContent = selected.holiday ? selected.holiday + '假期 · 休息日' : '调休补班 · 工作日';
      detail.appendChild(status);
    }
  }

  function changeCalendarMonth(offset) {
    var date = new Date(calendarYear, calendarMonth - 1 + offset, 1);
    calendarYear = date.getFullYear();
    calendarMonth = date.getMonth() + 1;
    calendarSelected = 1;
    renderCalendar();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('#calendar-grid').animate([
        { opacity: 0.3, transform: 'translateX(' + (offset > 0 ? 8 : -8) + 'px)' },
        { opacity: 1, transform: 'translateX(0)' }
      ], { duration: 180, easing: 'ease-out' });
    }
  }

  $('#calendar-prev').addEventListener('click', function () { changeCalendarMonth(-1); });
  $('#calendar-next').addEventListener('click', function () { changeCalendarMonth(1); });
  $('#calendar-today').addEventListener('click', function () {
    var today = new Date();
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth() + 1;
    calendarSelected = today.getDate();
    renderCalendar();
  });

  /* ================= 好友生日与事件 ================= */
  LifeCalendar.lunarMonthNames.forEach(function (name, index) {
    var option = el('option');
    option.value = index + 1;
    option.textContent = name;
    $('#birthday-month').appendChild(option);
  });
  LifeCalendar.lunarDayNames.forEach(function (name, index) {
    var option = el('option');
    option.value = index + 1;
    option.textContent = name;
    $('#birthday-day').appendChild(option);
  });

  function jumpToCalendar(key) {
    var parts = key.split('-').map(Number);
    calendarYear = parts[0];
    calendarMonth = parts[1];
    calendarSelected = parts[2];
    $('#life-dialog').close();
    renderCalendar();
    $('#calendar-grid').querySelector('[data-date="' + key + '"]').focus({ preventScroll: true });
    $('.calendar-section').scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'
    });
  }

  function renderPersonalRecords() {
    var today = new Date();
    var todayKey = LifeCalendar.getDayInfo(today.getFullYear(), today.getMonth() + 1, today.getDate()).key;
    var query = $('#life-search').value.trim().toLocaleLowerCase();
    var records = (recordKind === 'birthday' ? birthdays : personalEvents).map(function (record) {
      var next = recordKind === 'birthday' ? LifeCalendar.nextBirthday(record, todayKey) : null;
      var label = recordKind === 'birthday' ? LifeCalendar.birthdayLabel(record) : record.date;
      return { record: record, date: next ? next.key : record.date, label: label };
    }).filter(function (item) {
      return [item.record.name, item.record.title, item.record.note, item.label, item.date].join(' ').toLocaleLowerCase().indexOf(query) !== -1;
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var list = $('#life-record-list');
    list.innerHTML = '';
    if (!records.length) {
      var empty = el('li', 'life-hint');
      empty.textContent = query ? '没有找到匹配的记录' : recordKind === 'birthday' ? '还没有好友生日，先添加一位吧。' : '还没有事件，先记下一件重要的事。';
      list.appendChild(empty);
    }
    records.forEach(function (item) {
      var record = item.record;
      var row = el('li', 'life-record');
      var heading = el('h3');
      heading.textContent = record.name || record.title;
      var meta = el('p');
      meta.textContent = recordKind === 'birthday' ? item.label + '\n下次生日：' + item.date + (item.date === todayKey ? ' · 就是今天' : '') : '日期：' + item.date;
      row.appendChild(heading);
      row.appendChild(meta);
      if (record.note) {
        var note = el('p');
        note.textContent = record.note;
        row.appendChild(note);
      }
      var actions = el('div', 'life-record-actions');
      var jump = el('button', 'btn');
      jump.textContent = '查看日期';
      jump.addEventListener('click', function () { jumpToCalendar(item.date); });
      var remove = el('button', 'btn delete-record');
      remove.textContent = '删除';
      remove.setAttribute('aria-label', '删除' + (record.name || record.title));
      remove.addEventListener('click', function () {
        if (!confirm('确定删除“' + (record.name || record.title) + '”这条记录吗？')) return;
        var key = recordKind === 'birthday' ? 'birthdays' : 'personalEvents';
        var next = (recordKind === 'birthday' ? birthdays : personalEvents).filter(function (entry) { return entry.id !== record.id; });
        if (!savePersonalRecords(key, next)) return;
        if (recordKind === 'birthday') birthdays = next;
        else personalEvents = next;
        $('#life-feedback').textContent = '已删除记录';
        renderPersonalRecords();
        renderCalendar();
      });
      actions.appendChild(jump);
      actions.appendChild(remove);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function savePersonalRecords(key, records) {
    try {
      localStorage.setItem(key, JSON.stringify(records));
      return true;
    } catch (error) {
      $('#life-feedback').textContent = '保存失败，请检查浏览器是否允许本地存储后重试。';
      return false;
    }
  }

  function openPersonalRecords(kind) {
    recordKind = kind;
    $('#life-dialog-title').textContent = kind === 'birthday' ? '好友生日' : '事件';
    $('#birthday-form').hidden = kind !== 'birthday';
    $('#event-form').hidden = kind !== 'event';
    $('#life-search').value = '';
    $('#life-feedback').textContent = '';
    $('#event-date').value = LifeCalendar.getDayInfo(calendarYear, calendarMonth, calendarSelected).key;
    renderPersonalRecords();
    $('#life-dialog').showModal();
    $(kind === 'birthday' ? '#birthday-name' : '#event-title').focus();
  }

  $('#birthday-open').addEventListener('click', function () { openPersonalRecords('birthday'); });
  $('#event-open').addEventListener('click', function () { openPersonalRecords('event'); });
  $('#life-close').addEventListener('click', function () { $('#life-dialog').close(); });
  $('#life-search').addEventListener('input', renderPersonalRecords);

  $('#birthday-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var name = $('#birthday-name').value.trim();
    if (!name) { $('#life-feedback').textContent = '请填写好友姓名'; return; }
    var record = {
      id: crypto.randomUUID(), name: name,
      month: Number($('#birthday-month').value), day: Number($('#birthday-day').value),
      leap: $('#birthday-leap').checked, note: $('#birthday-note').value.trim()
    };
    var next = birthdays.concat([record]);
    if (!savePersonalRecords('birthdays', next)) return;
    birthdays = next;
    event.target.reset();
    $('#life-search').value = '';
    $('#life-feedback').textContent = '已保存“' + name + '”的农历生日';
    renderPersonalRecords();
    renderCalendar();
  });

  $('#event-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var title = $('#event-title').value.trim();
    if (!title) { $('#life-feedback').textContent = '请填写事件名称'; return; }
    var record = { id: crypto.randomUUID(), title: title, date: $('#event-date').value, note: $('#event-note').value.trim() };
    var next = personalEvents.concat([record]);
    if (!savePersonalRecords('personalEvents', next)) return;
    personalEvents = next;
    event.target.reset();
    $('#event-date').value = record.date;
    $('#life-search').value = '';
    $('#life-feedback').textContent = '已保存“' + title + '”';
    renderPersonalRecords();
    renderCalendar();
  });

  /* ================= 常用链接 ================= */
  var links = store.get('links', [
    { title: 'GitHub', url: 'https://github.com' },
    { title: '哔哩哔哩', url: 'https://www.bilibili.com' }
  ]);
  var linkList = $('#link-list');

  function renderLinks() {
    linkList.innerHTML = '';
    links.forEach(function (link, i) {
      var li = el('li', 'link-item');
      var icon = el('span', 'link-icon');
      icon.innerHTML = svgIcon(ICON_LINK);
      var a = el('a');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = link.title;
      var small = el('small');
      small.textContent = link.url;
      a.appendChild(small);
      var del = el('button', 'icon-btn link-del');
      del.title = '删除链接';
      del.setAttribute('aria-label', '删除链接');
      del.innerHTML = svgIcon(ICON_TRASH);
      del.addEventListener('click', function () {
        links.splice(i, 1);
        store.set('links', links);
        renderLinks();
      });
      li.appendChild(icon);
      li.appendChild(a);
      li.appendChild(del);
      linkList.appendChild(li);
    });
  }

  $('#link-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('#link-title').value.trim();
    var url = $('#link-url').value.trim();
    if (!title || !url) return;
    links.push({ title: title, url: url });
    store.set('links', links);
    e.target.reset();
    renderLinks();
  });

  /* ================= 工具分段切换 ================= */
  var segments = document.querySelectorAll('.segmented .segment[data-tool]');
  segments.forEach(function (seg) {
    seg.addEventListener('click', function () {
      segments.forEach(function (s) { s.classList.remove('active'); });
      seg.classList.add('active');
      document.querySelectorAll('.tool-panel').forEach(function (p) { p.classList.remove('active'); });
      $('#tool-' + seg.dataset.tool).classList.add('active');
    });
  });

  /* ================= 待办 ================= */
  var todos = store.get('todos', []);
  var todoList = $('#todo-list');

  function renderTodos() {
    todoList.innerHTML = '';
    todos.forEach(function (todo, i) {
      var li = el('li', 'item' + (todo.done ? ' done' : ''));
      var check = el('button', 'icon-btn check-btn');
      check.title = todo.done ? '标记未完成' : '标记完成';
      check.setAttribute('aria-label', check.title);
      check.innerHTML = svgIcon(todo.done ? ICON_CHECK : ICON_CIRCLE);
      check.addEventListener('click', function () {
        todo.done = !todo.done;
        store.set('todos', todos);
        renderTodos();
      });
      var text = el('div', 'item-text');
      text.textContent = todo.text;
      var del = el('button', 'icon-btn danger');
      del.title = '删除待办';
      del.setAttribute('aria-label', '删除待办');
      del.innerHTML = svgIcon(ICON_TRASH);
      del.addEventListener('click', function () {
        todos.splice(i, 1);
        store.set('todos', todos);
        renderTodos();
      });
      li.appendChild(check);
      li.appendChild(text);
      li.appendChild(del);
      todoList.appendChild(li);
    });
  }

  $('#todo-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('#todo-input').value.trim();
    if (!text) return;
    todos.unshift({ text: text, done: false });
    store.set('todos', todos);
    e.target.reset();
    renderTodos();
  });

  /* ================= 课表 ================= */
  var PERIODS = {
    1: '08:20–09:00', 2: '09:05–09:45', 3: '09:55–10:35', 4: '10:40–11:20',
    5: '11:25–12:05', 6: '14:30–15:10', 7: '15:15–15:55', 8: '16:05–16:45',
    9: '16:50–17:30', 10: '19:30–20:10', 11: '20:15–20:55', 12: '21:00–21:40'
  };

  function weekRange(a, b) {
    var list = [];
    for (var w = a; w <= b; w++) list.push(w);
    return list;
  }

  // 2026–2027 学年第一学期 · 武鸣校区（第10周起剩余课程）
  var COURSES = [
    { name: '大数据与商务智能', teacher: '邹帆', day: 1, periods: [3, 4, 5], weeks: weekRange(10, 13), room: 'A-210', color: 'orange' },
    { name: '运营管理', teacher: '杨从平', day: 1, periods: [6, 7, 8], weeks: [10], room: 'A-210', color: 'green' },
    { name: '运营管理', teacher: '杨从平', day: 2, periods: [1, 2], weeks: [10], room: 'A-210', color: 'green' },
    { name: '大数据与商务智能', teacher: '邹帆', day: 2, periods: [3, 4, 5], weeks: weekRange(10, 13), room: 'B-313', color: 'orange' },
    { name: '跨境电子商务', teacher: '尹叶青', day: 3, periods: [3, 4, 5], weeks: weekRange(10, 16), room: 'B412', roomWeek10: 'A-306', color: 'teal' },
    { name: '统计学', teacher: '陈桃红', day: 3, periods: [6, 7, 8], weeks: weekRange(12, 16), room: 'A-209', color: 'red' },
    { name: '统计学', teacher: '陈桃红', day: 4, periods: [3, 4, 5], weeks: weekRange(11, 16), room: 'A-209', color: 'red' },
    { name: '战略管理', teacher: '余琨岳', day: 4, periods: [6, 7], weeks: weekRange(10, 12), room: 'A-208', color: 'green' },
    { name: '统计学', teacher: '陈桃红', day: 5, periods: [3, 4, 5], weeks: weekRange(11, 16), room: 'A-209', color: 'red' },
    { name: '战略管理', teacher: '余琨岳', day: 5, periods: [8, 9], weeks: weekRange(10, 12), room: 'A-208', color: 'green' }
  ];

  var importedSchedule = store.get('importedSchedule', null);
  if (importedSchedule && importedSchedule.version === 1 && Array.isArray(importedSchedule.courses) && importedSchedule.courses.length) {
    COURSES = importedSchedule.courses;
  }
  var WEEK_MIN, WEEK_MAX;
  function updateScheduleBounds() {
    var weeks = [];
    COURSES.forEach(function (course) { weeks = weeks.concat(course.weeks); });
    WEEK_MIN = Math.min.apply(null, weeks);
    WEEK_MAX = Math.max.apply(null, weeks);
  }
  updateScheduleBounds();
  var scheduleWeek = store.get('scheduleWeek', 10);
  scheduleWeek = Math.min(WEEK_MAX, Math.max(WEEK_MIN, scheduleWeek));
  var jsDay = new Date().getDay(); // 0=周日
  var scheduleDay = jsDay || 7;

  function periodText(course) {
    var groups = [];
    course.periods.forEach(function (period) {
      var previous = groups[groups.length - 1];
      if (previous && period === previous[previous.length - 1] + 1) previous.push(period);
      else groups.push([period]);
    });
    return groups.map(function (group) {
      var first = group[0], last = group[group.length - 1];
      var range = group.length > 1 ? '第' + first + '–' + last + '节' : '第' + first + '节';
      return range + ' · ' + PERIODS[first].slice(0, 5) + '–' + PERIODS[last].slice(-5);
    }).join('；');
  }

  function weeksText(weeks) {
    return '第' + ScheduleImport.formatRanges(weeks) + '周';
  }

  function renderSchedule() {
    $('#week-label').textContent = '第' + scheduleWeek + '周';
    $('#week-prev').disabled = scheduleWeek <= WEEK_MIN;
    $('#week-next').disabled = scheduleWeek >= WEEK_MAX;
    document.querySelectorAll('.day-tabs .segment').forEach(function (seg) {
      seg.classList.toggle('active', parseInt(seg.dataset.day, 10) === scheduleDay);
    });
    var list = $('#schedule-list');
    list.innerHTML = '';
    var todays = COURSES.filter(function (c) {
      return c.day === scheduleDay && c.weeks.indexOf(scheduleWeek) !== -1;
    }).sort(function (a, b) { return a.periods[0] - b.periods[0]; });
    if (!todays.length) {
      var emptyLi = el('li', 'schedule-empty');
      emptyLi.textContent = '这一天没有课';
      list.appendChild(emptyLi);
      return;
    }
    todays.forEach(function (c) {
      var li = el('li', 'item course-item course-' + c.color);
      var wrap = el('div', 'item-text');
      var name = el('div', 'course-name');
      name.textContent = c.name;
      var meta = el('div', 'item-meta');
      meta.textContent = (c.teacher ? c.teacher + ' · ' : '') + weeksText(c.weeks);
      var time = el('div', 'course-time');
      time.textContent = periodText(c);
      wrap.appendChild(name);
      wrap.appendChild(time);
      wrap.appendChild(meta);
      var room = el('div', 'course-room');
      room.textContent = (scheduleWeek === 10 && c.roomWeek10) ? c.roomWeek10 : c.room;
      if (c.roomWeek10) {
        var tag = el('div', 'course-tag');
        tag.textContent = '教室有变';
        room.appendChild(tag);
      }
      li.appendChild(wrap);
      li.appendChild(room);
      list.appendChild(li);
    });
  }

  $('#week-prev').addEventListener('click', function () {
    if (scheduleWeek > WEEK_MIN) {
      scheduleWeek--;
      store.set('scheduleWeek', scheduleWeek);
      renderSchedule();
    }
  });
  $('#week-next').addEventListener('click', function () {
    if (scheduleWeek < WEEK_MAX) {
      scheduleWeek++;
      store.set('scheduleWeek', scheduleWeek);
      renderSchedule();
    }
  });
  document.querySelectorAll('.day-tabs .segment').forEach(function (seg) {
    seg.addEventListener('click', function () {
      scheduleDay = parseInt(seg.dataset.day, 10);
      renderSchedule();
    });
  });

  SchedulePhotoImport.init({
    getCourses: function () { return COURSES; },
    save: function (courses) {
      localStorage.setItem('importedSchedule', JSON.stringify({ version: 1, courses: courses }));
      COURSES = courses;
      updateScheduleBounds();
      scheduleWeek = Math.min(WEEK_MAX, Math.max(WEEK_MIN, scheduleWeek));
      store.set('scheduleWeek', scheduleWeek);
      $('#schedule-feedback').textContent = '课表已更新，共 ' + courses.length + ' 条课程。';
      $('#schedule-feedback').hidden = false;
      renderSchedule();
    }
  });

  /* ================= 账号本 ================= */
  var accounts = store.get('accounts', []);
  var accountList = $('#account-list');
  var totpUpdaters = [];

  /* TOTP（兼容谷歌验证器）：Base32 解码 + HMAC-SHA1 */
  function base32Decode(str) {
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    var clean = String(str).replace(/[\s=]+/g, '').toUpperCase();
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < clean.length; i++) {
      var idx = alphabet.indexOf(clean[i]);
      if (idx === -1) return null;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return out.length ? new Uint8Array(out) : null;
  }

  function totpCode(secretBytes, step) {
    return crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
      .then(function (key) {
        var buf = new ArrayBuffer(8);
        new DataView(buf).setUint32(4, step);
        return crypto.subtle.sign('HMAC', key, buf);
      })
      .then(function (sig) {
        var h = new Uint8Array(sig);
        var off = h[h.length - 1] & 0xf;
        var num = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
        return ('000000' + (num % 1000000)).slice(-6);
      });
  }

  function tickTotp() {
    var now = Math.floor(Date.now() / 1000);
    var step = Math.floor(now / 30);
    var remain = 30 - (now % 30);
    totpUpdaters.forEach(function (u) { u(step, remain); });
  }

  function copyText(text, btn) {
    function done() {
      btn.innerHTML = svgIcon(ICON_COPIED);
      btn.classList.add('copied');
      setTimeout(function () {
        btn.innerHTML = svgIcon(ICON_COPY);
        btn.classList.remove('copied');
      }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var ta = el('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  function renderAccounts() {
    accountList.innerHTML = '';
    totpUpdaters = [];
    accounts.forEach(function (acc, i) {
      var li = el('li', 'item account-item');
      var wrap = el('div', 'item-text');
      var site = el('div');
      site.textContent = acc.site;
      site.style.fontWeight = '600';
      var user = el('div', 'account-line');
      user.textContent = acc.user;
      var pass = el('div', 'account-line account-pass');
      pass.textContent = '••••••';
      wrap.appendChild(site);
      wrap.appendChild(user);
      wrap.appendChild(pass);

      var copyCode = null;
      if (acc.secret) {
        var secretBytes = base32Decode(acc.secret);
        if (secretBytes) {
          var totpRow = el('div', 'totp-row');
          var codeEl = el('span', 'totp-code');
          codeEl.textContent = '------';
          var remainEl = el('span', 'totp-remain');
          totpRow.appendChild(codeEl);
          totpRow.appendChild(remainEl);
          wrap.appendChild(totpRow);
          var lastStep = -1;
          totpUpdaters.push(function (step, remain) {
            remainEl.textContent = remain + 's';
            remainEl.classList.toggle('urgent', remain <= 5);
            if (step !== lastStep) {
              lastStep = step;
              totpCode(secretBytes, step).then(function (code) {
                codeEl.textContent = code.slice(0, 3) + ' ' + code.slice(3);
              });
            }
          });
          copyCode = true;
        }
      }

      var actions = el('div', 'account-actions');

      var copyUser = el('button', 'icon-btn copy-btn');
      copyUser.title = '复制账号';
      copyUser.setAttribute('aria-label', '复制账号');
      copyUser.innerHTML = svgIcon(ICON_COPY);
      copyUser.addEventListener('click', function () { copyText(acc.user, copyUser); });

      var copyPass = el('button', 'icon-btn copy-btn');
      copyPass.title = '复制密码';
      copyPass.setAttribute('aria-label', '复制密码');
      copyPass.innerHTML = svgIcon(ICON_COPY);
      copyPass.addEventListener('click', function () { copyText(acc.pass, copyPass); });

      if (copyCode) {
        var secretBytesForCopy = base32Decode(acc.secret);
        var cc = el('button', 'icon-btn copy-btn totp-copy');
        cc.title = '复制验证码';
        cc.setAttribute('aria-label', '复制验证码');
        cc.innerHTML = svgIcon(ICON_COPY);
        cc.addEventListener('click', function () {
          var step = Math.floor(Date.now() / 1000 / 30);
          totpCode(secretBytesForCopy, step).then(function (code) { copyText(code, cc); });
        });
        actions.appendChild(cc);
      }

      var visible = false;
      var eye = el('button', 'icon-btn');
      eye.title = '显示 / 隐藏密码';
      eye.setAttribute('aria-label', '显示或隐藏密码');
      eye.innerHTML = svgIcon(ICON_EYE);
      eye.addEventListener('click', function () {
        visible = !visible;
        pass.textContent = visible ? acc.pass : '••••••';
        eye.innerHTML = svgIcon(visible ? ICON_EYE_OFF : ICON_EYE);
      });

      var del = el('button', 'icon-btn danger');
      del.title = '删除账号';
      del.setAttribute('aria-label', '删除账号');
      del.innerHTML = svgIcon(ICON_TRASH);
      del.addEventListener('click', function () {
        accounts.splice(i, 1);
        store.set('accounts', accounts);
        renderAccounts();
      });

      actions.appendChild(copyUser);
      actions.appendChild(copyPass);
      actions.appendChild(eye);
      actions.appendChild(del);
      li.appendChild(wrap);
      li.appendChild(actions);
      accountList.appendChild(li);
    });
    tickTotp();
  }

  $('#account-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var site = $('#account-site').value.trim();
    var user = $('#account-user').value.trim();
    var pass = $('#account-pass').value;
    var secret = $('#account-secret').value.trim();
    if (!site || !user || !pass) return;
    if (secret && !base32Decode(secret)) {
      alert('2FA 密钥格式不正确，应为 Base32 字符串（如 JBSW Y3DP EHPK 3PXP）');
      return;
    }
    var entry = { site: site, user: user, pass: pass };
    if (secret) entry.secret = secret.replace(/\s+/g, '').toUpperCase();
    accounts.unshift(entry);
    store.set('accounts', accounts);
    e.target.reset();
    renderAccounts();
  });

  /* ================= 初始化 ================= */
  renderProfile();
  renderCalendar();
  renderLinks();
  renderTodos();
  renderSchedule();
  renderAccounts();
  tickTotp();
  setInterval(tickTotp, 1000);
})();
