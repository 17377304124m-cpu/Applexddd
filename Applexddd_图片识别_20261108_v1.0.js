(function () {
  'use strict';

  var engineLoader;
  function loadEngine() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!engineLoader) engineLoader = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timer = setTimeout(fail, 30000);
      function fail() {
        clearTimeout(timer);
        script.remove();
        reject(new Error('识别资源加载失败，请检查网络后重试。'));
      }
      script.src = 'Applexddd_OCR引擎_20261108_v1.0.js';
      script.onload = function () { clearTimeout(timer); resolve(window.Tesseract); };
      script.onerror = fail;
      document.head.appendChild(script);
    }).catch(function (error) { engineLoader = null; throw error; });
    return engineLoader;
  }

  window.ImageTextRecognizer = {
    recognize: async function (file, options) {
      options = options || {};
      if (options.signal && options.signal.aborted) throw new DOMException('识别已取消。', 'AbortError');
      if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) {
        throw new Error('请选择 15MB 以内的 PNG、JPG 或 WEBP 图片。');
      }
      var controller = new AbortController();
      var worker = null;
      var termination = null;
      var imageUrl = '';
      var timer;
      var phase = 'reading';
      var stoppedReason = null;
      var rejectStopped;
      var stopped = new Promise(function (resolve, reject) { rejectStopped = reject; });
      // 取消可能先于共享脚本加载结束，避免未赢得竞速的取消 Promise 产生未处理异常。
      stopped.catch(function () {});

      function terminate() {
        if (worker && !termination) termination = Promise.resolve().then(function () { return worker.terminate(); }).catch(function () {});
        return termination || Promise.resolve();
      }
      function stop(error) {
        if (stoppedReason) return;
        stoppedReason = error;
        controller.abort();
        terminate();
        rejectStopped(error);
      }
      function abort() { stop(new DOMException('识别已取消。', 'AbortError')); }
      function progress(nextPhase, value) {
        phase = nextPhase;
        if (!stoppedReason && options.onProgress) options.onProgress({ phase: nextPhase, progress: value });
      }
      if (options.signal) options.signal.addEventListener('abort', abort, { once: true });

      try {
        progress('reading', 0);
        if (stoppedReason) throw stoppedReason;
        imageUrl = URL.createObjectURL(file);
        var image = new Image();
        image.src = imageUrl;
        await Promise.race([image.decode(), stopped]);
        var scale = Math.min(2, 2400 / image.naturalWidth, 3200 / image.naturalHeight);
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        var context = canvas.getContext('2d');
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        progress('loading', 0);
        if (stoppedReason) throw stoppedReason;
        var engine = await Promise.race([loadEngine(), stopped]);
        if (stoppedReason) throw stoppedReason;
        timer = setTimeout(function () { stop(new Error('识别资源加载超时，请检查网络后重试。')); }, 60000);
        var creating = engine.createWorker('chi_sim', 1, {
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
          langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim@1.0.0/4.0.0_best_int',
          workerBlobURL: true, cacheMethod: 'none', signal: controller.signal,
          errorHandler: function () {},
          logger: function (message) {
            if (message.status === 'recognizing text') progress('recognizing', message.progress);
          }
        }).then(function (created) {
          worker = created;
          if (stoppedReason) terminate();
          return created;
        });
        await Promise.race([creating, stopped]);
        clearTimeout(timer);
        if (stoppedReason) throw stoppedReason;
        progress('recognizing', 0);
        if (stoppedReason) throw stoppedReason;
        timer = setTimeout(function () { stop(new Error('图片识别超时，请缩小或裁剪图片后重试。')); }, 120000);
        var result = await Promise.race([worker.recognize(canvas, {}, { text: true, blocks: true }), stopped]);
        progress('recognizing', 1);
        return result.data;
      } catch (error) {
        if (stoppedReason) throw stoppedReason;
        if (phase === 'reading') throw new Error('图片无法读取，请更换 PNG、JPG 或 WEBP 图片后重试。');
        if (phase === 'loading') throw new Error('识别资源加载失败，请检查网络后重试。');
        throw new Error('图片识别失败，请换一张清晰截图后重试。');
      } finally {
        clearTimeout(timer);
        if (options.signal) options.signal.removeEventListener('abort', abort);
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        await terminate();
      }
    }
  };
})();
