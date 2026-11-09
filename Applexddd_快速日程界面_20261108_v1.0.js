(function () {
  'use strict';

  window.QuickEventCapture = {
    init: function (options) {
      var $ = function (selector) { return document.querySelector(selector); };
      var source = $('#capture-text');
      var status = $('#capture-status');
      var dialog = $('#capture-dialog');
      var rows = [];
      var controller = null;
      var run = 0;
      var imageUrl = '';

      function setBusy(busy) {
        source.disabled = busy;
        $('#capture-photo').disabled = busy;
        $('#capture-pick-image').disabled = busy;
        $('#capture-analyze').disabled = busy;
        $('#capture-cancel').hidden = !busy;
        $('#capture-progress').hidden = !busy;
      }

      function readRows() {
        return Array.from($('#capture-event-rows').children).map(function (row) {
          var record = {};
          row.querySelectorAll('[data-field]').forEach(function (input) { record[input.dataset.field] = input.value.trim(); });
          return record;
        });
      }

      function renderRows() {
        var list = $('#capture-event-rows');
        list.innerHTML = '';
        rows.forEach(function (record, index) {
          var row = document.createElement('section');
          row.className = 'capture-event-row';
          var header = document.createElement('div');
          header.className = 'capture-row-heading';
          var title = document.createElement('h3');
          title.textContent = '日程 ' + (index + 1);
          var remove = document.createElement('button');
          remove.type = 'button'; remove.className = 'btn'; remove.textContent = '移除';
          remove.setAttribute('aria-label', '移除日程' + (index + 1));
          remove.addEventListener('click', function () { rows = readRows(); rows.splice(index, 1); renderRows(); });
          header.appendChild(title); header.appendChild(remove); row.appendChild(header);
          var fields = document.createElement('div');
          fields.className = 'capture-fields';
          [
            ['title', '事项', 'text', 80], ['date', '日期', 'date'],
            ['time', '时间（选填）', 'text', 10], ['note', '备注 / 原文（最多300字）', 'textarea', 300]
          ].forEach(function (field) {
            var label = document.createElement('label');
            label.textContent = field[1];
            if (field[0] === 'title' || field[0] === 'note') label.className = 'capture-wide';
            var input = document.createElement(field[2] === 'textarea' ? 'textarea' : 'input');
            if (field[2] !== 'textarea') input.type = field[2];
            else input.rows = 3;
            if (field[3]) input.maxLength = field[3];
            if (field[0] === 'date') { input.min = '1901-01-01'; input.max = '2099-12-31'; }
            if (field[0] === 'time') input.placeholder = '如：15:00';
            input.dataset.field = field[0];
            input.required = field[0] === 'title' || field[0] === 'date';
            input.value = record[field[0]] || '';
            label.appendChild(input); fields.appendChild(label);
          });
          row.appendChild(fields); list.appendChild(row);
        });
      }

      function openReview() {
        var text = source.value.trim();
        if (!text) { status.textContent = '请先输入文字或添加图片。'; return; }
        var now = new Date();
        var reference = LifeCalendar.getDayInfo(now.getFullYear(), now.getMonth() + 1, now.getDate()).key;
        rows = EventCaptureParser.parse(text, reference);
        renderRows();
        $('#capture-review-status').textContent = !rows.length ? '未识别出具体日程，可点“添加一条”补充。' : rows.some(function (row) { return !row.date; }) ? '部分内容没有明确日期，请补齐后加入日历。' : '请核对日期、时间和事项。';
        dialog.showModal();
      }

      $('#capture-analyze').addEventListener('click', openReview);
      $('#capture-close').addEventListener('click', function () { dialog.close(); });
      $('#capture-pick-image').addEventListener('click', function () { $('#capture-photo').click(); });
      $('#capture-cancel').addEventListener('click', function () {
        run++;
        if (controller) { controller.abort(); controller = null; }
        setBusy(false); status.textContent = '已取消识别，日历未修改。';
      });

      $('#capture-photo').addEventListener('change', async function () {
        var file = this.files[0];
        this.value = '';
        if (!file) return;
        var current = ++run;
        var task = new AbortController();
        controller = task;
        setBusy(true); $('#capture-progress').value = 0;
        status.textContent = '正在读取图片…';
        try {
          var data = await ImageTextRecognizer.recognize(file, {
            signal: task.signal,
            onProgress: function (progress) {
              if (run !== current) return;
              $('#capture-progress').value = progress.progress;
              status.textContent = progress.phase === 'recognizing' ? '正在识别图片… ' + Math.round(progress.progress * 100) + '%' : progress.phase === 'loading' ? '正在加载本机识别资源…' : '正在读取图片…';
            }
          });
          if (run !== current) return;
          if (!data.text.trim()) { status.textContent = '未识别出文字，请换一张清晰图片，或直接输入内容。'; return; }
          source.value = [source.value.trim(), data.text.trim()].filter(Boolean).join('\n');
          if (imageUrl) URL.revokeObjectURL(imageUrl);
          imageUrl = URL.createObjectURL(file);
          $('#capture-preview').src = imageUrl;
          $('#capture-original').hidden = false;
          status.textContent = '图片文字已识别，可修改内容后重新识别日程。';
          if ($('#page-home').classList.contains('active')) openReview();
        } catch (error) {
          if (run === current) status.textContent = error.name === 'AbortError' ? '已取消识别，日历未修改。' : error.message || '图片识别失败，请重试。';
        } finally {
          if (controller === task) controller = null;
          if (run === current) setBusy(false);
        }
      });

      $('#capture-add-row').addEventListener('click', function () {
        rows = readRows(); rows.push({ title: '', date: '', time: '', note: '' });
        renderRows(); $('#capture-event-rows').lastElementChild.querySelector('input').focus();
      });
      $('#capture-review-form').addEventListener('submit', function (event) {
        event.preventDefault();
        var checked = EventCaptureParser.validateRows(readRows());
        if (checked.errors.length) { $('#capture-review-status').textContent = checked.errors.join('\n'); return; }
        $('#capture-save').disabled = true;
        try {
          options.save(checked.events);
        } catch (error) {
          $('#capture-review-status').textContent = '保存失败，请检查浏览器本地存储权限后重试；原事件未修改。';
          return;
        } finally { $('#capture-save').disabled = false; }
        dialog.close();
        status.textContent = '已加入 ' + checked.events.length + ' 条日程。';
        source.value = '';
        $('#capture-original').hidden = true;
        if (imageUrl) { URL.revokeObjectURL(imageUrl); imageUrl = ''; }
        $('#capture-preview').removeAttribute('src');
        options.reveal(checked.events[0].date);
      });
    }
  };
})();
