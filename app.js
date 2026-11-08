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
    tagline: '保持好奇，持续行动',
    bio: '这里是个人简介。点击右上角铅笔可以修改名字、签名和这段介绍，内容会保存在本地。'
  });

  var nameEl = $('#profile-name');
  var taglineEl = $('#profile-tagline');
  var bioEl = $('#profile-bio');
  var editBtn = $('#profile-edit-btn');
  var editing = false;

  function renderProfile() {
    nameEl.textContent = profile.name;
    taglineEl.textContent = profile.tagline;
    bioEl.textContent = profile.bio;
    document.title = profile.name + '的主页';
  }

  editBtn.addEventListener('click', function () {
    if (!editing) {
      editing = true;
      nameEl.innerHTML = '<input id="edit-name" class="editing-input" maxlength="20">';
      taglineEl.innerHTML = '<input id="edit-tagline" class="editing-input" maxlength="40">';
      bioEl.innerHTML = '<textarea id="edit-bio" rows="4" maxlength="300"></textarea>';
      $('#edit-name').value = profile.name;
      $('#edit-tagline').value = profile.tagline;
      $('#edit-bio').value = profile.bio;
      editBtn.classList.add('accent');
    } else {
      editing = false;
      profile = {
        name: $('#edit-name').value.trim() || profile.name,
        tagline: $('#edit-tagline').value.trim(),
        bio: $('#edit-bio').value.trim()
      };
      store.set('profile', profile);
      renderProfile();
      editBtn.classList.remove('accent');
    }
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

  /* ================= 便签 ================= */
  var notes = store.get('notes', []);
  var noteList = $('#note-list');

  function renderNotes() {
    noteList.innerHTML = '';
    notes.forEach(function (note, i) {
      var li = el('li', 'item');
      var wrap = el('div', 'item-text');
      wrap.textContent = note.text;
      var meta = el('div', 'item-meta');
      meta.textContent = new Date(note.ts).toLocaleString('zh-CN');
      wrap.appendChild(meta);
      var del = el('button', 'icon-btn danger');
      del.title = '删除便签';
      del.setAttribute('aria-label', '删除便签');
      del.innerHTML = svgIcon(ICON_TRASH);
      del.addEventListener('click', function () {
        notes.splice(i, 1);
        store.set('notes', notes);
        renderNotes();
      });
      li.appendChild(wrap);
      li.appendChild(del);
      noteList.appendChild(li);
    });
  }

  $('#note-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('#note-input').value.trim();
    if (!text) return;
    notes.unshift({ text: text, ts: Date.now() });
    store.set('notes', notes);
    e.target.reset();
    renderNotes();
  });

  /* ================= 番茄钟 ================= */
  var RING_LEN = 552.92;
  var pomoTotal = 25 * 60;
  var pomoLeft = pomoTotal;
  var pomoTimer = null;
  var pomoDone = store.get('pomoDone', 0);
  var timeEl = $('#pomo-time');
  var ringEl = $('#ring-progress');

  function fmt(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function renderPomo() {
    timeEl.textContent = fmt(pomoLeft);
    ringEl.style.strokeDashoffset = String(RING_LEN * (1 - pomoLeft / pomoTotal));
    $('#pomo-count').textContent = String(pomoDone);
  }

  function setPomoRunning(running) {
    $('#pomo-icon-play').classList.toggle('hidden', running);
    $('#pomo-icon-pause').classList.toggle('hidden', !running);
  }

  function stopPomo() {
    clearInterval(pomoTimer);
    pomoTimer = null;
    setPomoRunning(false);
  }

  $('#pomo-toggle').addEventListener('click', function () {
    if (pomoTimer) {
      stopPomo();
      return;
    }
    setPomoRunning(true);
    pomoTimer = setInterval(function () {
      pomoLeft--;
      if (pomoLeft <= 0) {
        stopPomo();
        pomoLeft = pomoTotal;
        if (pomoTotal === 25 * 60) {
          pomoDone++;
          store.set('pomoDone', pomoDone);
        }
        if (navigator.vibrate) navigator.vibrate(200);
      }
      renderPomo();
    }, 1000);
  });

  $('#pomo-reset').addEventListener('click', function () {
    stopPomo();
    pomoLeft = pomoTotal;
    renderPomo();
  });

  document.querySelectorAll('.pomo-modes .segment').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.pomo-modes .segment').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      stopPomo();
      pomoTotal = parseInt(btn.dataset.minutes, 10) * 60;
      pomoLeft = pomoTotal;
      renderPomo();
    });
  });

  /* ================= 初始化 ================= */
  renderProfile();
  renderLinks();
  renderTodos();
  renderNotes();
  renderPomo();
})();
