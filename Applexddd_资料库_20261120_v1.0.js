(function (root) {
  'use strict';

  var library = document.getElementById('mingjun-library');
  if (!library) return;

  library.innerHTML = `
    <button id="library-add" class="btn primary" type="button">添加资料</button>
    <p id="library-feedback" class="life-feedback" role="status" hidden></p>
    <ul id="library-list" class="item-list"></ul>
    <dialog id="library-dialog" class="life-dialog" aria-labelledby="library-dialog-title">
      <div class="life-dialog-body">
        <div class="life-dialog-header">
          <h2 id="library-dialog-title">添加资料</h2>
        </div>
        <form id="library-form" class="life-form">
          <label>标题<input id="library-title" type="text" required></label>
          <label>笔记（选填）<textarea id="library-note" rows="5"></textarea></label>
          <label>网址（选填）<input id="library-url" type="url" placeholder="https://"></label>
          <p id="library-form-feedback" class="life-feedback" role="status" hidden></p>
          <div class="backup-actions">
            <button id="library-cancel" class="btn" type="button">取消</button>
            <button class="btn primary" type="submit">保存资料</button>
          </div>
        </form>
      </div>
    </dialog>`;

  var addButton = document.getElementById('library-add');
  var list = document.getElementById('library-list');
  var dialog = document.getElementById('library-dialog');
  var heading = document.getElementById('library-dialog-title');
  var form = document.getElementById('library-form');
  var title = document.getElementById('library-title');
  var note = document.getElementById('library-note');
  var url = document.getElementById('library-url');
  var feedback = document.getElementById('library-feedback');
  var formFeedback = document.getElementById('library-form-feedback');
  var editingId = null;

  function report(target, message) {
    target.textContent = message;
    target.hidden = !message;
  }

  function readLibrary() {
    var raw = root.localStorage.getItem('library');
    var records = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(records)) throw new Error('资料库格式不正确。');
    return records;
  }

  function renderLibrary(records) {
    list.replaceChildren();
    if (!records.length) {
      var empty = document.createElement('li');
      empty.className = 'list-empty';
      empty.textContent = '暂无资料';
      list.appendChild(empty);
    }
    records.forEach(function (record) {
      var item = document.createElement('li');
      item.className = 'item';
      var summary = document.createElement('div');
      summary.className = 'item-text';
      var hasLink = root.DataBackup.isLibraryUrl(record.url);
      var name = document.createElement(hasLink ? 'a' : 'strong');
      if (hasLink) {
        name.href = record.url;
        name.target = '_blank';
        name.rel = 'noopener noreferrer';
      }
      name.textContent = record.title;
      summary.appendChild(name);
      if (record.note) {
        var excerpt = document.createElement('p');
        excerpt.className = 'item-meta';
        excerpt.style.whiteSpace = 'pre-wrap';
        excerpt.textContent = record.note;
        summary.appendChild(excerpt);
      }

      var actions = document.createElement('div');
      actions.className = 'inline-form';
      var edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn';
      edit.textContent = '编辑';
      edit.setAttribute('aria-label', '编辑 ' + record.title);
      edit.addEventListener('click', function () { openEditor(record); });
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn';
      remove.textContent = '删除';
      remove.setAttribute('aria-label', '删除 ' + record.title);
      remove.addEventListener('click', function () {
        if (!root.confirm('删除资料“' + record.title + '”？')) return;
        var remaining;
        try {
          remaining = readLibrary().filter(function (entry) { return entry.id !== record.id; });
          root.localStorage.setItem('library', JSON.stringify(remaining));
        } catch (error) {
          report(feedback, '删除失败，请检查浏览器的本地存储权限。');
          return;
        }
        renderLibrary(remaining);
        report(feedback, '资料已删除。');
        addButton.focus();
      });
      actions.append(edit, remove);
      item.append(summary, actions);
      list.appendChild(item);
    });
  }

  function openEditor(record) {
    form.reset();
    report(formFeedback, '');
    editingId = record ? record.id : null;
    heading.textContent = record ? '编辑资料' : '添加资料';
    if (record) {
      title.value = record.title;
      note.value = record.note;
      url.value = record.url;
    }
    dialog.showModal();
    title.focus();
  }

  addButton.addEventListener('click', function () { openEditor(null); });
  document.getElementById('library-cancel').addEventListener('click', function () { dialog.close(); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var entryTitle = title.value.trim();
    var entryUrl = url.value.trim();
    if (!entryTitle) {
      report(formFeedback, '请填写标题。');
      title.focus();
      return;
    }
    if (entryUrl && !root.DataBackup.isLibraryUrl(entryUrl)) {
      report(formFeedback, '请输入以 http:// 或 https:// 开头的有效网址。');
      url.focus();
      return;
    }

    var records;
    try {
      records = readLibrary();
      var entry = { id: editingId || root.crypto.randomUUID(), title: entryTitle, note: note.value, url: entryUrl };
      if (editingId) {
        var index = records.findIndex(function (record) { return record.id === editingId; });
        if (index < 0) {
          report(formFeedback, '这条资料已被删除。');
          return;
        }
        records[index] = entry;
      } else {
        records.unshift(entry);
      }
      root.localStorage.setItem('library', JSON.stringify(records));
    } catch (error) {
      report(formFeedback, '保存失败，请检查浏览器的本地存储空间和权限。');
      return;
    }
    dialog.close();
    renderLibrary(records);
    report(feedback, editingId ? '资料已更新。' : '资料已添加。');
    addButton.focus();
  });

  try {
    renderLibrary(readLibrary());
  } catch (error) {
    report(feedback, '读取资料库失败，请检查本地数据和存储权限。');
  }
})(window);
