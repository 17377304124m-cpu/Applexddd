(function (root) {
  'use strict';

  function init(options) {
    var exportButton = document.getElementById('backup-export');
    var importButton = document.getElementById('backup-import');
    var fileInput = document.getElementById('backup-file');
    var feedback = document.getElementById('backup-feedback');
    var dialog = document.getElementById('backup-dialog');
    var restoreFeedback = document.getElementById('backup-restore-feedback');
    var confirmButton = document.getElementById('backup-confirm');
    var pending = null;
    var restoring = false;

    exportButton.addEventListener('click', function () {
      feedback.textContent = '';
      var url;
      var anchor;
      try {
        var now = new Date();
        var backup = DataBackup.create(options.getData(), now.toISOString());
        var blob = new Blob([JSON.stringify(backup)], { type: 'application/json;charset=utf-8' });
        url = URL.createObjectURL(blob);
        var day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
        anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'Applexddd_数据备份_' + day + '_v1.0.json';
        document.body.appendChild(anchor);
        anchor.click();
        feedback.textContent = '备份文件已生成，请保存到“文件”或其他安全位置。';
      } catch (error) {
        feedback.textContent = '导出失败，请确认本地数据完整后重试。';
      } finally {
        if (anchor) anchor.remove();
        if (url) setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      }
    });

    importButton.addEventListener('click', function () {
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', async function () {
      var file = fileInput.files[0];
      if (!file) return;
      pending = null;
      feedback.textContent = '';
      restoreFeedback.textContent = '';
      if (file.size > 20 * 1024 * 1024) {
        feedback.textContent = '备份文件不能超过20MB，请选择本站导出的JSON备份。';
        fileInput.value = '';
        return;
      }
      exportButton.disabled = true;
      importButton.disabled = true;
      try {
        pending = DataBackup.parse(await file.text());
        var summary = document.getElementById('backup-summary');
        summary.replaceChildren();
        var time = document.createElement('p');
        time.className = 'backup-time';
        time.textContent = '备份时间：' + new Date(pending.exportedAt).toLocaleString('zh-CN', { hour12: false });
        summary.appendChild(time);
        var data = pending.data;
        var counts = document.createElement('dl');
        counts.className = 'backup-counts';
        [
          ['个人资料', '1份'],
          ['好友生日', data.birthdays.length + '位'],
          ['日历事件', data.personalEvents.length + '条'],
          ['待办', data.todos.length + '条'],
          ['课表', data.importedSchedule ? data.importedSchedule.courses.length + '条课程' : '默认课表'],
          ['账号', data.accounts.length + '个'],
          ['常用链接', data.links.length + '个']
        ].forEach(function (item) {
          var row = document.createElement('div');
          var label = document.createElement('dt');
          var value = document.createElement('dd');
          label.textContent = item[0];
          value.textContent = item[1];
          row.append(label, value);
          counts.appendChild(row);
        });
        summary.appendChild(counts);
        confirmButton.disabled = false;
        dialog.showModal();
        document.getElementById('backup-cancel').focus();
      } catch (error) {
        pending = null;
        feedback.textContent = error.message || '无法读取备份，请重新选择本站导出的JSON文件。';
      } finally {
        exportButton.disabled = false;
        importButton.disabled = false;
        fileInput.value = '';
      }
    });

    function cancel() { if (!restoring) dialog.close(); }
    document.getElementById('backup-close').addEventListener('click', cancel);
    document.getElementById('backup-cancel').addEventListener('click', cancel);
    dialog.addEventListener('close', function () { pending = null; });
    dialog.addEventListener('cancel', function (event) { if (restoring) event.preventDefault(); });

    confirmButton.addEventListener('click', function () {
      if (!pending || restoring) return;
      restoring = true;
      confirmButton.disabled = true;
      restoreFeedback.textContent = '';
      try {
        DataBackup.restore(root.localStorage, pending);
        pending = null;
        dialog.close();
        feedback.textContent = '数据已恢复，正在刷新。';
        root.location.reload();
      } catch (error) {
        restoreFeedback.textContent = error.message || '恢复失败，请重试。';
        feedback.textContent = restoreFeedback.textContent;
        restoring = false;
        confirmButton.disabled = false;
      }
    });
  }

  root.BackupUI = { init: init };
})(window);
