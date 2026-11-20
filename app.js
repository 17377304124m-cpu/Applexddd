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
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }
  };

  var $ = function (s) { return document.querySelector(s); };

  function svgIcon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-' +
      name + '"></use></svg>';
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  /* ================= 主导航 ================= */
  var tabs = document.querySelectorAll('.tabbar .tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var changingPage = !tab.classList.contains('active');
      tabs.forEach(function (t) {
        t.classList.remove('active');
        t.removeAttribute('aria-current');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      $('#page-' + tab.dataset.page).classList.add('active');
      if (changingPage) window.scrollTo(0, 0);
      if (tab.dataset.page === 'tools') renderTodos();
      if (tab.dataset.page === 'info' && $('#tool-schedule').classList.contains('active')) showTodaySchedule();
      if (tab.dataset.page === 'tools' || tab.dataset.page === 'personal') {
        var back = $('#page-' + tab.dataset.page + ' [data-subview]:not([hidden]) [data-panel-back]');
        if (back) back.click();
      }
    });
  });

  function openSubview(page, name) {
    page.querySelector('[data-section-menu]').hidden = Boolean(name);
    page.querySelectorAll('[data-subview]').forEach(function (panel) {
      panel.hidden = panel.dataset.subview !== name;
      if (!panel.hidden) panel.querySelector('h1').focus({ preventScroll: true });
    });
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (event) {
    var config = event.target.closest('[data-open-config]');
    if (config && !config.closest('#page-personal')) {
      $('.tab[data-page="personal"]').click();
      openSubview($('#page-personal'), 'config');
      return;
    }
    var open = event.target.closest('[data-open-panel]');
    if (open) {
      openSubview(open.closest('.menu-page'), open.dataset.openPanel);
      return;
    }
    var back = event.target.closest('[data-panel-back]');
    if (back) {
      var panel = back.closest('[data-subview]');
      var page = panel.closest('.menu-page');
      openSubview(page, '');
      page.querySelector('[data-open-panel="' + panel.dataset.subview + '"]').focus({ preventScroll: true });
    }
  });

  var theme = store.get('theme', 'light') === 'dark' ? 'dark' : 'light';

  function renderTheme() {
    document.documentElement.dataset.theme = theme;
    $('meta[name="theme-color"]').content = theme === 'dark' ? '#111111' : '#f7f7f7';
    $('[name="mingjun-theme"][value="' + theme + '"]').checked = true;
    $('#theme-current').textContent = theme === 'dark' ? '黑色' : '白色';
  }

  document.querySelectorAll('[name="mingjun-theme"]').forEach(function (option) {
    option.addEventListener('change', function () {
      if (store.set('theme', option.value)) {
        theme = option.value;
        $('#theme-feedback').textContent = '';
      } else {
        $('#theme-feedback').textContent = '主题保存失败，请检查浏览器存储权限。';
      }
      renderTheme();
    });
  });
  renderTheme();

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
    $('#menu-profile-name').textContent = profile.name;
  }

  editBtn.addEventListener('click', function () {
    if (!editing) {
      editing = true;
      editBtn.title = '保存资料';
      editBtn.setAttribute('aria-label', '保存资料');
      editBtn.textContent = '保存资料';
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
      editBtn.textContent = '编辑资料';
    }
  });

  /* ================= 生活日历 ================= */
  var calendarNow = new Date();
  var calendarYear = calendarNow.getFullYear();
  var calendarMonth = calendarNow.getMonth() + 1;
  var calendarSelected = calendarNow.getDate();
  var birthdays = store.get('birthdays', []);
  var personalEvents = store.get('personalEvents', []);
  var weekdays = '日一二三四五六';

  function renderCalendar() {
    var today = new Date();
    var todayKey = LifeCalendar.getDayInfo(today.getFullYear(), today.getMonth() + 1, today.getDate()).key;
    $('#home-date').dateTime = todayKey;
    $('#home-date-day').textContent = today.getDate();
    $('#home-date-label').textContent = (today.getMonth() + 1) + '月 · 周' + weekdays[today.getDay()];
    var selected = LifeCalendar.getDayInfo(calendarYear, calendarMonth, calendarSelected);
    var selectedEntries = LifeCalendar.getPersonalEntries(selected.key, birthdays, personalEvents);
    var selectedFestivals = LifeCalendar.getFestivalDetails(selected);
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
    var heading = el('h2');
    heading.textContent = calendarMonth + '月' + calendarSelected + '日 · 周' + weekdays[selected.weekday];
    if (selected.key === todayKey) heading.textContent += ' · 今天';
    var lunar = el('p', 'calendar-lunar');
    lunar.textContent = '农历 ' + selected.lunar;
    var detailHeading = el('div', 'calendar-detail-heading');
    detailHeading.appendChild(heading);
    detailHeading.appendChild(lunar);
    detail.appendChild(detailHeading);
    if (selected.holiday || selected.workday) {
      var status = el('p', 'calendar-status');
      status.textContent = selected.holiday ? selected.holiday + '假期 · 休息日' : '调休补班 · 工作日';
      detail.appendChild(status);
    }
    if (selectedFestivals.length) {
      var festivalList = el('ul', 'calendar-festivals');
      selectedFestivals.forEach(function (festival) {
        var item = el('li');
        var name = el('h3');
        name.textContent = festival.name;
        var description = el('p');
        description.textContent = festival.description;
        item.appendChild(name);
        item.appendChild(description);
        festivalList.appendChild(item);
      });
      detail.appendChild(festivalList);
    } else if (!selectedEntries.length) {
      var emptyNotice = el('p', 'calendar-events');
      emptyNotice.textContent = '暂无安排';
      detail.appendChild(emptyNotice);
    }
    if (selectedEntries.length) {
      var dayList = el('ul', 'day-events');
      selectedEntries.forEach(function (entry) {
        var item = el('li');
        var title = el('h3');
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
    renderCalendar();
    $('#calendar-grid').querySelector('[data-date="' + key + '"]').focus({ preventScroll: true });
    $('.calendar-section').scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'
    });
  }

  var lifeEntryDialog = $('#life-entry-dialog');
  var lifeEntryFeedback = $('#life-entry-feedback');

  function savePersonalRecords(key, records) {
    try {
      localStorage.setItem(key, JSON.stringify(records));
      return true;
    } catch (error) {
      lifeEntryFeedback.textContent = '保存失败，请检查浏览器是否允许本地存储后重试。';
      return false;
    }
  }

  function openPersonalEntry(kind) {
    var isBirthday = kind === 'birthday';
    $('#life-entry-title').textContent = isBirthday ? '添加好友生日' : '添加事件';
    $('#birthday-form').hidden = !isBirthday;
    $('#event-form').hidden = isBirthday;
    if (!isBirthday) $('#event-date').value = LifeCalendar.getDayInfo(calendarYear, calendarMonth, calendarSelected).key;
    lifeEntryFeedback.textContent = '';
    lifeEntryDialog.showModal();
    $(isBirthday ? '#birthday-name' : '#event-title').focus();
  }

  $('#birthday-open').addEventListener('click', function () { openPersonalEntry('birthday'); });
  $('#event-open').addEventListener('click', function () { openPersonalEntry('event'); });
  $('#life-entry-close').addEventListener('click', function () { lifeEntryDialog.close(); });

  $('#birthday-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var name = $('#birthday-name').value.trim();
    if (!name) { lifeEntryFeedback.textContent = '请填写好友姓名'; return; }
    var record = {
      id: crypto.randomUUID(), name: name,
      month: Number($('#birthday-month').value), day: Number($('#birthday-day').value),
      leap: $('#birthday-leap').checked, note: $('#birthday-note').value.trim()
    };
    var next = birthdays.concat([record]);
    if (!savePersonalRecords('birthdays', next)) return;
    birthdays = next;
    event.target.reset();
    lifeEntryFeedback.textContent = '已保存“' + name + '”的农历生日';
    renderCalendar();
  });

  $('#event-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var title = $('#event-title').value.trim();
    if (!title) { lifeEntryFeedback.textContent = '请填写事件名称'; return; }
    var record = { id: crypto.randomUUID(), title: title, date: $('#event-date').value, note: $('#event-note').value.trim() };
    var next = personalEvents.concat([record]);
    if (!savePersonalRecords('personalEvents', next)) return;
    personalEvents = next;
    event.target.reset();
    $('#event-date').value = record.date;
    lifeEntryFeedback.textContent = '已保存“' + title + '”';
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
    if (!links.length) {
      var empty = el('li', 'list-empty');
      empty.textContent = '暂无链接';
      linkList.appendChild(empty);
    }
    links.forEach(function (link, i) {
      var li = el('li', 'link-item');
      li.dataset.linkIndex = i;
      var icon = el('span', 'link-icon');
      icon.innerHTML = svgIcon('link');
      var a = el('a');
      if (DataBackup.isLinkUrl(link.url)) a.href = link.url;
      a.draggable = false;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = link.title;
      var small = el('small');
      small.textContent = link.url;
      a.appendChild(small);
      var actions = el('div', 'link-actions');
      var copy = el('button', 'icon-btn link-copy copy-btn');
      copy.title = '复制网址';
      copy.setAttribute('aria-label', '复制网址');
      copy.innerHTML = svgIcon('copy');
      copy.addEventListener('click', function () { copyText(link.url, copy); });
      var del = el('button', 'icon-btn link-del');
      del.title = '删除链接';
      del.setAttribute('aria-label', '删除链接');
      del.innerHTML = svgIcon('trash');
      del.addEventListener('click', function () {
        links.splice(i, 1);
        store.set('links', links);
        renderLinks();
      });
      li.appendChild(icon);
      li.appendChild(a);
      actions.appendChild(copy);
      actions.appendChild(del);
      li.appendChild(actions);
      linkList.appendChild(li);
    });
  }

  $('#link-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('#link-title').value.trim();
    var url = $('#link-url').value.trim();
    if (!title || !url) { $('#link-form-feedback').textContent = '请填写名称和网址。'; return; }
    if (!DataBackup.isLinkUrl(url)) { $('#link-form-feedback').textContent = '请填写受支持的网址。'; return; }
    var next = links.concat([{ title: title, url: url }]);
    if (!store.set('links', next)) { $('#link-form-feedback').textContent = '保存失败，请检查浏览器本地存储权限后重试。'; return; }
    links = next;
    e.target.reset();
    renderLinks();
    $('#link-dialog').close();
    $('#info-feedback').textContent = '链接已添加。';
  });

  $('#link-add-open').addEventListener('click', function () {
    $('#link-form').reset();
    $('#link-form-feedback').textContent = '';
    $('#link-dialog').showModal();
  });
  $('#link-dialog-close').addEventListener('click', function () { $('#link-dialog').close(); });

  LinkReorder.init(linkList, {
    move: function (from, to) {
      if (from === to || from < 0 || to < 0 || from >= links.length || to >= links.length) return false;
      var next = links.slice();
      next.splice(to, 0, next.splice(from, 1)[0]);
      if (!store.set('links', next)) { $('#info-feedback').textContent = '排序保存失败，原顺序未修改。'; return false; }
      links = next;
      renderLinks();
      $('#info-feedback').textContent = '链接顺序已更新。';
      return true;
    }
  });

  /* ================= 信息分段切换 ================= */
  var segments = document.querySelectorAll('.segmented .segment[data-tool]');
  segments.forEach(function (seg) {
    seg.addEventListener('click', function () {
      var page = seg.closest('.page');
      page.querySelectorAll('[data-tool]').forEach(function (s) { setSelectedTab(s, s === seg); });
      page.querySelectorAll('.tool-panel').forEach(function (p) { p.classList.remove('active'); });
      $('#tool-' + seg.dataset.tool).classList.add('active');
      if (seg.dataset.tool === 'schedule') showTodaySchedule();
    });
  });

  function setSelectedTab(tab, selected) {
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }

  document.querySelectorAll('.segmented[role="tablist"]').forEach(function (list) {
    var buttons = Array.from(list.querySelectorAll('[role="tab"]'));
    buttons.forEach(function (button) { setSelectedTab(button, button.classList.contains('active')); });
    list.addEventListener('keydown', function (event) {
      var index = buttons.indexOf(event.target);
      if (index === -1) return;
      if (event.key === 'ArrowLeft') index = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'ArrowRight') index = (index + 1) % buttons.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = buttons.length - 1;
      else return;
      event.preventDefault();
      buttons[index].click();
      buttons[index].focus();
    });
  });

  /* ================= 待办 ================= */
  var todos = store.get('todos', []);
  var todoList = $('#todo-list');
  var todoArchive = $('#todo-archive');
  var todoArchiveList = $('#todo-archive-list');
  var todoArchiveTimer;
  var normalizedTodos = TodoManager.normalize(todos, new Date().toISOString());
  if (JSON.stringify(normalizedTodos) !== JSON.stringify(todos)) {
    if (store.set('todos', normalizedTodos)) todos = normalizedTodos;
    else $('#todo-feedback').textContent = '保存失败，旧待办的完成时间尚未保存，请检查浏览器本地存储权限后重试。';
  }

  function saveTodos(next) {
    next = TodoManager.normalize(next, new Date().toISOString());
    if (!store.set('todos', next)) {
      $('#todo-feedback').textContent = '保存失败，请检查浏览器本地存储权限后重试。';
      return false;
    }
    todos = next;
    $('#todo-feedback').textContent = '';
    renderTodos();
    return true;
  }

  function renderTodos() {
    clearTimeout(todoArchiveTimer);
    var now = new Date();
    var groups = TodoManager.partition(todos, now.toISOString());
    todoList.innerHTML = '';
    todoArchiveList.innerHTML = '';
    todoArchive.hidden = !groups.archived.length;
    $('#todo-archive-summary').textContent = '已归档（' + groups.archived.length + '）';
    if (!groups.archived.length) todoArchive.open = false;
    if (!groups.active.length) {
      var empty = el('li', 'list-empty');
      empty.textContent = '暂无待办';
      todoList.appendChild(empty);
    }
    groups.active.concat(groups.archived).forEach(function (todo) {
      var li = el('li', 'item' + (todo.done ? ' done' : ''));
      var check = el('button', 'icon-btn check-btn');
      check.title = todo.done ? '标记未完成' : '标记完成';
      check.setAttribute('aria-label', check.title);
      check.setAttribute('aria-pressed', String(todo.done));
      check.innerHTML = svgIcon(todo.done ? 'done' : 'pending');
      check.addEventListener('click', function () {
        saveTodos(TodoManager.toggle(todos, todos.indexOf(todo), new Date().toISOString()));
      });
      var text = el('div', 'item-text');
      text.textContent = todo.text;
      var del = el('button', 'icon-btn danger');
      del.title = '删除待办';
      del.setAttribute('aria-label', '删除待办');
      del.innerHTML = svgIcon('trash');
      del.addEventListener('click', function () {
        var next = todos.slice();
        next.splice(todos.indexOf(todo), 1);
        saveTodos(next);
      });
      li.appendChild(check);
      li.appendChild(text);
      li.appendChild(del);
      (groups.archived.indexOf(todo) === -1 ? todoList : todoArchiveList).appendChild(li);
    });
    var nextArchive = Infinity;
    groups.active.forEach(function (todo) {
      if (!todo.done) return;
      var remaining = Date.parse(todo.completedAt) + 604800000 - now.getTime();
      if (remaining > 0) nextArchive = Math.min(nextArchive, remaining);
    });
    if (isFinite(nextArchive)) todoArchiveTimer = setTimeout(renderTodos, Math.min(nextArchive, 2147483647));
  }

  $('#todo-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('#todo-input').value.trim();
    if (!text) return;
    if (saveTodos([{ text: text, done: false }].concat(todos))) e.target.reset();
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
    var currentWeek = Math.min(60, Math.max(1, ScheduleDate.getCurrent(new Date()).week));
    WEEK_MIN = currentWeek;
    WEEK_MAX = currentWeek;
    COURSES.forEach(function (course) {
      course.weeks.forEach(function (week) {
        WEEK_MIN = Math.min(WEEK_MIN, week);
        WEEK_MAX = Math.max(WEEK_MAX, week);
      });
    });
  }
  updateScheduleBounds();
  var currentSchedule = ScheduleDate.getCurrent(new Date());
  var scheduleWeek = Math.min(60, Math.max(1, currentSchedule.week));
  var scheduleDay = currentSchedule.day;
  var scheduleOutsideTerm = currentSchedule.week < 1 || currentSchedule.week > 60;
  var scheduleDateKey = new Date().toDateString();

  function showTodaySchedule() {
    var now = new Date();
    var current = ScheduleDate.getCurrent(now);
    scheduleWeek = Math.min(60, Math.max(1, current.week));
    scheduleDay = current.day;
    scheduleOutsideTerm = current.week < 1 || current.week > 60;
    scheduleDateKey = now.toDateString();
    updateScheduleBounds();
    renderSchedule();
  }

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
    $('#week-label').textContent = scheduleOutsideTerm ? '本学期外' : '第' + scheduleWeek + '周';
    $('#week-prev').disabled = scheduleOutsideTerm ? scheduleWeek === 1 : scheduleWeek <= WEEK_MIN;
    $('#week-next').disabled = scheduleOutsideTerm ? scheduleWeek === 60 : scheduleWeek >= WEEK_MAX;
    document.querySelectorAll('.day-tabs .segment').forEach(function (seg) {
      setSelectedTab(seg, parseInt(seg.dataset.day, 10) === scheduleDay);
    });
    $('#schedule-day-panel').setAttribute('aria-labelledby', 'schedule-day-' + scheduleDay);
    var list = $('#schedule-list');
    list.innerHTML = '';
    var todays = COURSES.filter(function (c) {
      return !scheduleOutsideTerm && c.day === scheduleDay && c.weeks.indexOf(scheduleWeek) !== -1;
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
    if (scheduleOutsideTerm || scheduleWeek > WEEK_MIN) {
      if (!scheduleOutsideTerm) scheduleWeek--;
      scheduleOutsideTerm = false;
      store.set('scheduleWeek', scheduleWeek);
      renderSchedule();
    }
  });
  $('#week-next').addEventListener('click', function () {
    if (scheduleOutsideTerm || scheduleWeek < WEEK_MAX) {
      if (!scheduleOutsideTerm) scheduleWeek++;
      scheduleOutsideTerm = false;
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
      $('#schedule-feedback').textContent = '课表已更新，共 ' + courses.length + ' 条课程。';
      $('#schedule-feedback').hidden = false;
      showTodaySchedule();
    }
  });

  /* ================= 账号本 ================= */
  var accounts = store.get('accounts', []);
  var accountList = $('#account-list');
  var totpUpdaters = [];
  var editingAccountIndex = -1;

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
      btn.innerHTML = svgIcon('check');
      btn.classList.add('copied');
      $('#info-feedback').textContent = btn.title.replace(/^复制/, '') + '已复制。';
      setTimeout(function () {
        btn.innerHTML = svgIcon('copy');
        btn.classList.remove('copied');
      }, 1200);
    }
    function failed() { $('#info-feedback').textContent = '复制失败，请重试。'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done, failed); });
    } else {
      legacyCopy(text, done, failed);
    }
  }

  function legacyCopy(text, done, failed) {
    var ta = el('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { if (document.execCommand('copy')) done(); else failed(); } catch (e) { failed(); }
    document.body.removeChild(ta);
  }

  function renderAccounts() {
    accountList.innerHTML = '';
    totpUpdaters = [];
    if (!accounts.length) {
      var empty = el('li', 'list-empty');
      empty.textContent = '暂无账号';
      accountList.appendChild(empty);
    }
    accounts.forEach(function (acc, i) {
      var li = el('li', 'item account-item');
      var wrap = el('div', 'item-text');
      var site = el('div', 'account-site');
      site.textContent = acc.site;
      var user = el('span', 'account-user');
      user.textContent = acc.user;
      var userLine = el('div', 'account-line');
      userLine.append('账号：', user);
      var pass = el('span', 'account-pass');
      pass.textContent = '••••••';
      var passLine = el('div', 'account-line');
      passLine.append('密码：', pass);
      wrap.appendChild(site);
      wrap.appendChild(userLine);
      wrap.appendChild(passLine);

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

      var copyUser = el('button', 'icon-btn copy-btn copy-user');
      copyUser.title = '复制账号';
      copyUser.setAttribute('aria-label', '复制账号');
      copyUser.innerHTML = svgIcon('copy');
      copyUser.addEventListener('click', function () { copyText(acc.user, copyUser); });

      var copyPass = el('button', 'icon-btn copy-btn copy-pass');
      copyPass.title = '复制密码';
      copyPass.setAttribute('aria-label', '复制密码');
      copyPass.innerHTML = svgIcon('copy');
      copyPass.addEventListener('click', function () { copyText(acc.pass, copyPass); });

      if (copyCode) {
        var secretBytesForCopy = base32Decode(acc.secret);
        var cc = el('button', 'icon-btn copy-btn totp-copy');
        cc.title = '复制验证码';
        cc.setAttribute('aria-label', '复制验证码');
        cc.innerHTML = svgIcon('copy');
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
      eye.innerHTML = svgIcon('eye');
      eye.addEventListener('click', function () {
        visible = !visible;
        pass.textContent = visible ? acc.pass : '••••••';
        eye.innerHTML = svgIcon(visible ? 'eye-off' : 'eye');
      });

      var edit = el('button', 'icon-btn account-edit');
      edit.title = '修改账号';
      edit.setAttribute('aria-label', '修改账号');
      edit.innerHTML = svgIcon('edit');
      edit.addEventListener('click', function () { openAccountDialog(i); });

      var del = el('button', 'icon-btn danger');
      del.title = '删除账号';
      del.setAttribute('aria-label', '删除账号');
      del.innerHTML = svgIcon('trash');
      del.addEventListener('click', function () {
        accounts.splice(i, 1);
        store.set('accounts', accounts);
        renderAccounts();
      });

      actions.appendChild(copyUser);
      actions.appendChild(copyPass);
      actions.appendChild(eye);
      actions.appendChild(edit);
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
    if (!site || !user || !pass) { $('#account-form-feedback').textContent = '请填写名称、账号和密码。'; return; }
    if (secret && !base32Decode(secret)) {
      $('#account-form-feedback').textContent = '2FA 密钥格式不正确，请检查后重试。';
      return;
    }
    var entry = { site: site, user: user, pass: pass };
    if (secret) entry.secret = secret.replace(/\s+/g, '').toUpperCase();
    var isEditing = editingAccountIndex >= 0;
    var next = isEditing ? accounts.slice() : [entry].concat(accounts);
    if (isEditing) next[editingAccountIndex] = entry;
    if (!store.set('accounts', next)) { $('#account-form-feedback').textContent = '保存失败，请检查浏览器本地存储权限后重试。'; return; }
    accounts = next;
    editingAccountIndex = -1;
    e.target.reset();
    renderAccounts();
    $('#account-dialog').close();
    $('#info-feedback').textContent = isEditing ? '账号已修改。' : '账号已添加。';
  });

  function openAccountDialog(index) {
    var account = index >= 0 ? accounts[index] : null;
    editingAccountIndex = account ? index : -1;
    $('#account-form').reset();
    $('#account-form-feedback').textContent = '';
    $('#account-dialog-title').textContent = account ? '修改账号' : '添加账号';
    $('#account-save').textContent = account ? '保存修改' : '保存账号';
    if (account) {
      $('#account-site').value = account.site;
      $('#account-user').value = account.user;
      $('#account-pass').value = account.pass;
      $('#account-secret').value = account.secret || '';
    }
    $('#account-dialog').showModal();
  }

  $('#account-add-open').addEventListener('click', function () {
    openAccountDialog(-1);
  });
  $('#account-dialog-close').addEventListener('click', function () {
    editingAccountIndex = -1;
    $('#account-dialog').close();
  });

  /* ================= 初始化 ================= */
  var dateRefreshTimer;
  function refreshDateViews() {
    if (document.hidden) return;
    renderTodos();
    if (new Date().toDateString() !== scheduleDateKey) {
      renderCalendar();
      showTodaySchedule();
    }
    clearTimeout(dateRefreshTimer);
    var now = new Date();
    var nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    dateRefreshTimer = setTimeout(refreshDateViews, nextDay.getTime() - now.getTime() + 50);
  }
  window.addEventListener('focus', refreshDateViews);
  window.addEventListener('pageshow', refreshDateViews);
  document.addEventListener('visibilitychange', refreshDateViews);
  BackupUI.init({
    getData: function () {
      return {
        profile: profile, links: links, todos: todos, scheduleWeek: scheduleWeek,
        accounts: accounts, birthdays: birthdays, personalEvents: personalEvents,
        importedSchedule: { version: 1, courses: COURSES },
        library: store.get('library', []), memory: store.get('memory', ''),
        chatHistory: store.get('chatHistory', []), theme: theme
      };
    }
  });
  QuickEventCapture.init({
    save: function (events) {
      var added = events.map(function (event) {
        return { id: crypto.randomUUID(), title: event.title, date: event.date, note: event.note };
      });
      var next = personalEvents.concat(added);
      localStorage.setItem('personalEvents', JSON.stringify(next));
      personalEvents = next;
      renderCalendar();
    },
    reveal: jumpToCalendar
  });
  MobileSwipes.init();
  FixedViewport.init();
  renderProfile();
  renderCalendar();
  renderLinks();
  renderTodos();
  renderSchedule();
  refreshDateViews();
  renderAccounts();
  tickTotp();
  setInterval(tickTotp, 1000);
})();
