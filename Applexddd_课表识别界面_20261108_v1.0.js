(function () {
  'use strict';

  var ocrLoader;
  function loadRecognizer() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!ocrLoader) ocrLoader = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timer = setTimeout(function () { fail(); }, 30000);
      function fail() {
        clearTimeout(timer);
        script.remove();
        reject(new Error('识别资源加载失败，请检查网络后重试。'));
      }
      script.src = 'Applexddd_OCR引擎_20261108_v1.0.js';
      script.onload = function () { clearTimeout(timer); resolve(window.Tesseract); };
      script.onerror = fail;
      document.head.appendChild(script);
    }).catch(function (error) { ocrLoader = null; throw error; });
    return ocrLoader;
  }

  window.SchedulePhotoImport = {
    init: function (options) {
      var $ = function (selector) { return document.querySelector(selector); };
      var dialog = $('#schedule-dialog');
      var status = $('#schedule-import-status');
      var rows = [];
      var selectedFile = null;
      var imageUrl = '';
      var worker = null;
      var run = 0;
      var busy = false;
      var initializationController = null;

      function setBusy(value) {
        busy = value;
        $('#schedule-photo').disabled = value;
        $('#schedule-recognize').disabled = value || !selectedFile;
        $('#schedule-cancel-recognition').hidden = !value;
        $('#schedule-progress').hidden = !value;
        $('#schedule-save').disabled = value;
      }

      function cancelRecognition() {
        run++;
        if (initializationController) { initializationController.abort(); initializationController = null; }
        if (worker) { worker.terminate(); worker = null; }
        setBusy(false);
      }

      function readRows() {
        return Array.from($('#schedule-course-rows').children).map(function (row) {
          var record = {};
          row.querySelectorAll('[data-field]').forEach(function (field) {
            record[field.dataset.field] = field.dataset.field === 'day' ? Number(field.value) : field.value.trim();
          });
          return record;
        });
      }

      function renderRows() {
        var list = $('#schedule-course-rows');
        list.innerHTML = '';
        rows.forEach(function (record, index) {
          var row = document.createElement('section');
          row.className = 'schedule-course-row';
          var header = document.createElement('div');
          header.className = 'schedule-course-header';
          var title = document.createElement('h3');
          title.textContent = '课程 ' + (index + 1);
          var remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'btn';
          remove.textContent = '移除';
          remove.setAttribute('aria-label', '移除课程' + (index + 1));
          remove.addEventListener('click', function () {
            rows = readRows(); rows.splice(index, 1); renderRows();
          });
          header.appendChild(title); header.appendChild(remove); row.appendChild(header);
          var fields = document.createElement('div');
          fields.className = 'schedule-course-fields';
          [
            ['name', '课程名称', '如：高等数学'], ['day', '星期'],
            ['periodsText', '节次', '如：1-2'], ['weeksText', '周次', '如：1-16 或 1-16单周'],
            ['room', '教室（选填）', '如：A-210'], ['teacher', '老师（选填）', '']
          ].forEach(function (spec) {
            var label = document.createElement('label');
            label.textContent = spec[1];
            if (spec[0] === 'name') label.className = 'course-name-field';
            var input = document.createElement(spec[0] === 'day' ? 'select' : 'input');
            input.dataset.field = spec[0];
            if (spec[0] === 'day') {
              ['请选择', '周一', '周二', '周三', '周四', '周五', '周六', '周日'].forEach(function (day, value) {
                var option = document.createElement('option');
                option.value = value || ''; option.textContent = day; input.appendChild(option);
              });
            } else {
              input.type = 'text'; input.maxLength = 120; input.placeholder = spec[2];
            }
            input.required = ['name', 'day', 'periodsText', 'weeksText'].indexOf(spec[0]) !== -1;
            input.value = record[spec[0]] || '';
            label.appendChild(input); fields.appendChild(label);
          });
          row.appendChild(fields); list.appendChild(row);
        });
      }

      function open(edit) {
        selectedFile = null;
        $('#schedule-photo').value = '';
        $('#schedule-review').hidden = !edit;
        $('#schedule-photo-section').hidden = edit;
        $('#schedule-image-details').hidden = true;
        $('#schedule-image-details').open = false;
        status.textContent = '';
        rows = [];
        if (edit) options.getCourses().forEach(function (course) {
          var groups = [{ weeks: course.weeks, room: course.room }];
          if (course.roomWeek10 && course.weeks.indexOf(10) !== -1) {
            groups = [{ weeks: [10], room: course.roomWeek10 }, {
              weeks: course.weeks.filter(function (week) { return week !== 10; }), room: course.room
            }];
          }
          groups.filter(function (group) { return group.weeks.length; }).forEach(function (group) {
            rows.push({ name: course.name, teacher: course.teacher, day: course.day,
              periodsText: ScheduleImport.formatRanges(course.periods),
              weeksText: ScheduleImport.formatRanges(group.weeks), room: group.room });
          });
        });
        $('#schedule-dialog-title').textContent = edit ? '修改课表' : '图片导入课表';
        renderRows(); setBusy(false); dialog.showModal();
      }

      $('#schedule-import').addEventListener('click', function () { open(false); });
      $('#schedule-edit').addEventListener('click', function () { open(true); });
      $('#schedule-close').addEventListener('click', function () { dialog.close(); });
      dialog.addEventListener('close', function () {
        cancelRecognition();
        if (imageUrl) { URL.revokeObjectURL(imageUrl); imageUrl = ''; }
        $('#schedule-image').removeAttribute('src');
      });
      $('#schedule-cancel-recognition').addEventListener('click', function () {
        cancelRecognition(); status.textContent = '已取消识别，原课表未修改。';
      });

      $('#schedule-photo').addEventListener('change', function () {
        selectedFile = this.files[0] || null;
        status.textContent = '';
        rows = []; renderRows(); $('#schedule-review').hidden = true;
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = '';
        $('#schedule-image').removeAttribute('src');
        $('#schedule-image-details').hidden = true;
        if (selectedFile && (!/^image\/(png|jpeg|webp)$/.test(selectedFile.type) || selectedFile.size > 15 * 1024 * 1024)) {
          status.textContent = '请选择 15MB 以内的 PNG、JPG 或 WEBP 图片。';
          selectedFile = null;
        }
        if (selectedFile) {
          imageUrl = URL.createObjectURL(selectedFile);
          $('#schedule-image').src = imageUrl;
          $('#schedule-image-details').hidden = false;
        }
        setBusy(false);
      });

      $('#schedule-recognize').addEventListener('click', async function () {
        if (!selectedFile || busy) return;
        var currentRun = ++run;
        var currentWorker;
        var initializationTimer;
        var timedOut = false;
        setBusy(true); $('#schedule-progress').value = 0;
        status.textContent = '正在读取图片…';
        try {
          var image = new Image(); image.src = imageUrl; await image.decode();
          var scale = Math.min(2, 2400 / image.naturalWidth, 3200 / image.naturalHeight);
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(image.naturalWidth * scale);
          canvas.height = Math.round(image.naturalHeight * scale);
          var context = canvas.getContext('2d');
          context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          if (run !== currentRun) return;
          status.textContent = '正在加载识别资源…';
          var engine = await loadRecognizer();
          if (run !== currentRun) return;
          initializationController = new AbortController();
          var controller = initializationController;
          initializationTimer = setTimeout(function () { timedOut = true; controller.abort(); }, 60000);
          currentWorker = await engine.createWorker('chi_sim', 1, {
            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
            langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim@1.0.0/4.0.0_best_int',
            workerBlobURL: true, cacheMethod: 'none',
            signal: controller.signal,
            errorHandler: function () {},
            logger: function (message) {
              if (run !== currentRun) return;
              if (message.status === 'recognizing text') {
                $('#schedule-progress').value = message.progress;
                status.textContent = '正在识别课表… ' + Math.round(message.progress * 100) + '%';
              }
            }
          });
          clearTimeout(initializationTimer);
          if (initializationController === controller) initializationController = null;
          if (run !== currentRun) { await currentWorker.terminate(); return; }
          worker = currentWorker;
          var result = await currentWorker.recognize(canvas, {}, { text: true, blocks: true });
          if (run !== currentRun) return;
          rows = ScheduleImport.parseOcr(result.data);
          $('#schedule-review').hidden = false;
          renderRows();
          status.textContent = rows.length ? '已整理出 ' + rows.length + ' 条课程，请核对后保存。' : '未能整理出课程，请换一张清晰截图，或对照原图添加课程。';
        } catch (error) {
          if (run === currentRun) status.textContent = timedOut ? '识别资源加载超时，请检查网络后重试；原课表未修改。' : '识别失败，请检查网络与图片后重试；原课表未修改。';
        } finally {
          clearTimeout(initializationTimer);
          if (initializationController === controller) initializationController = null;
          if (currentWorker && worker === currentWorker) { worker = null; await currentWorker.terminate(); }
          if (run === currentRun) setBusy(false);
        }
      });

      $('#schedule-add-course').addEventListener('click', function () {
        rows = readRows(); rows.push({ name: '', day: 0, periodsText: '', weeksText: '', room: '', teacher: '' });
        renderRows(); $('#schedule-course-rows').lastElementChild.querySelector('input').focus();
      });
      $('#schedule-review-form').addEventListener('submit', function (event) {
        event.preventDefault();
        if (busy) return;
        var checked = ScheduleImport.validateRows(readRows());
        if (checked.errors.length) { status.textContent = checked.errors.join('\n'); return; }
        if (!confirm('确认用这 ' + checked.courses.length + ' 条课程替换当前课表？')) return;
        try { options.save(checked.courses); dialog.close(); }
        catch (error) { status.textContent = '保存失败，请检查浏览器本地存储权限后重试；原课表未修改。'; }
      });
    }
  };
})();
