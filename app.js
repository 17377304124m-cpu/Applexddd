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
  renderLinks();
  renderTodos();
  renderNotes();
  renderAccounts();
  tickTotp();
  setInterval(tickTotp, 1000);
})();
