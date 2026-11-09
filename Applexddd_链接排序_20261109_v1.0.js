(function (root) {
  'use strict';

  var instances = new WeakSet();
  var rowSelector = '.link-item[data-link-index]';

  function init(list, options) {
    if (!list || instances.has(list)) return;
    instances.add(list);
    var gesture = null;
    var modeRow = null;
    var holdTimer;
    var scrollFrame;
    var suppressClickUntil = 0;
    var lastTouchAt = 0;
    var statusElement = null;

    function rows() { return Array.from(list.querySelectorAll(rowSelector)); }
    function announce(message) {
      if (!statusElement || !statusElement.isConnected) {
        statusElement = document.createElement('p');
        statusElement.className = 'link-sort-status';
        statusElement.setAttribute('role', 'status');
        statusElement.setAttribute('aria-live', 'polite');
        list.insertAdjacentElement('afterend', statusElement);
      }
      statusElement.textContent = message;
    }
    function clearTargets() {
      rows().forEach(function (row) { row.classList.remove('link-drop-target'); });
    }
    function clearMode() {
      if (modeRow) modeRow.classList.remove('link-sort-active');
      list.querySelectorAll('.link-sort-actions').forEach(function (actions) { actions.remove(); });
      modeRow = null;
      delete list.dataset.reordering;
    }
    function move(from, to, keepMode) {
      clearMode();
      if (from === to) return;
      var succeeded = options.move(from, to);
      if (succeeded === false) { announce('位置未更改，请重试。'); return; }
      announce('链接已移到第 ' + (to + 1) + ' 位。');
      if (keepMode) {
        var row = list.querySelector('[data-link-index="' + to + '"]');
        if (row) activateMode(row, true);
      }
    }
    function activateMode(row, focus) {
      clearMode();
      modeRow = row;
      row.classList.add('link-sort-active');
      list.dataset.reordering = 'true';
      var actions = document.createElement('div');
      actions.className = 'link-sort-actions';
      var index = Number(row.dataset.linkIndex);
      [['上移', -1, 'link-move-up'], ['下移', 1, 'link-move-down'], ['完成', 0, 'link-sort-done']].forEach(function (spec) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn ' + spec[2];
        button.textContent = spec[0];
        button.disabled = spec[1] < 0 && index === 0 || spec[1] > 0 && index === rows().length - 1;
        button.addEventListener('click', function (event) {
          event.stopPropagation();
          if (spec[1]) move(index, index + spec[1], true);
          else {
            clearMode();
            var anchor = row.querySelector('a');
            if (anchor) anchor.focus({ preventScroll: true });
          }
        });
        actions.appendChild(button);
      });
      row.appendChild(actions);
      announce('排序模式：上下拖动，或使用上移、下移按钮。');
      if (focus) actions.querySelector('button:not(:disabled)').focus({ preventScroll: true });
    }

    function eligible(target) {
      if (target.closest('button,input,textarea,select,[contenteditable]')) return null;
      var row = target.closest(rowSelector);
      return row && list.contains(row) ? row : null;
    }
    function updateTarget() {
      if (!gesture || !gesture.active) return;
      var otherRows = rows().filter(function (row) { return row !== gesture.row; });
      gesture.to = otherRows.filter(function (row) {
        var box = row.getBoundingClientRect();
        return gesture.y > box.top + box.height / 2;
      }).length;
      clearTargets();
      var target = rows()[gesture.to];
      if (target && target !== gesture.row) target.classList.add('link-drop-target');
      gesture.row.style.transform = 'translateY(' + (gesture.y - gesture.startY + root.scrollY - gesture.scrollY) + 'px)';
    }
    function autoScroll() {
      if (!gesture || !gesture.active) return;
      var delta = gesture.y < 64 ? -8 : gesture.y > root.innerHeight - 90 ? 8 : 0;
      if (delta) { root.scrollBy(0, delta); updateTarget(); }
      scrollFrame = root.requestAnimationFrame(autoScroll);
    }
    function begin(row, x, y, kind) {
      if (modeRow && !list.contains(modeRow)) clearMode();
      if (gesture) finish(true);
      gesture = { row: row, x: x, startY: y, y: y, scrollY: root.scrollY,
        from: Number(row.dataset.linkIndex), to: Number(row.dataset.linkIndex), active: false, moved: false, kind: kind };
      holdTimer = setTimeout(function () {
        if (!gesture || !list.contains(row)) return;
        gesture.active = true;
        activateMode(row, false);
        row.classList.add('link-dragging');
        var selection = root.getSelection();
        if (selection) selection.removeAllRanges();
        autoScroll();
      }, 450);
    }
    function track(x, y, event) {
      if (!gesture) return;
      var dx = x - gesture.x;
      var dy = y - gesture.startY;
      if (!gesture.active) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) finish(true);
        return;
      }
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      gesture.y = y;
      if (Math.abs(dy) > 6) gesture.moved = true;
      if (gesture.moved) updateTarget();
    }
    function finish(cancelled, event) {
      clearTimeout(holdTimer);
      root.cancelAnimationFrame(scrollFrame);
      var current = gesture;
      gesture = null;
      if (!current) return;
      current.row.style.removeProperty('transform');
      current.row.classList.remove('link-dragging');
      clearTargets();
      if (!current.active) return;
      suppressClickUntil = Date.now() + 600;
      if (event) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
      }
      if (cancelled) { clearMode(); return; }
      if (current.moved && current.from !== current.to) move(current.from, current.to, false);
    }

    list.addEventListener('touchstart', function (event) {
      lastTouchAt = Date.now();
      suppressClickUntil = 0;
      if (event.touches.length !== 1) { finish(true); return; }
      if (modeRow && !list.contains(modeRow)) clearMode();
      var row = eligible(event.target);
      if (!row) {
        if (!event.target.closest('.link-sort-actions')) clearMode();
        return;
      }
      var touch = event.touches[0];
      if (touch.clientX <= 24 || touch.clientX >= root.innerWidth - 24) return;
      begin(row, touch.clientX, touch.clientY, 'touch');
    }, { passive: true });
    list.addEventListener('touchmove', function (event) {
      if (!gesture || gesture.kind !== 'touch') return;
      if (event.touches.length !== 1) { finish(true, event); return; }
      track(event.touches[0].clientX, event.touches[0].clientY, event);
    }, { passive: false });
    list.addEventListener('touchend', function (event) {
      if (gesture && gesture.kind === 'touch') finish(event.touches.length > 0, event);
    }, { passive: false });
    list.addEventListener('touchcancel', function (event) { finish(true, event); }, { passive: false });

    list.addEventListener('mousedown', function (event) {
      if (event.button !== 0 || Date.now() - lastTouchAt < 800) return;
      suppressClickUntil = 0;
      var row = eligible(event.target);
      if (row) begin(row, event.clientX, event.clientY, 'mouse');
      else if (!event.target.closest('.link-sort-actions')) clearMode();
    });
    root.document.addEventListener('mousemove', function (event) {
      if (gesture && gesture.kind === 'mouse') track(event.clientX, event.clientY, event);
    });
    root.document.addEventListener('mouseup', function (event) {
      if (gesture && gesture.kind === 'mouse') finish(false, event);
    });
    list.addEventListener('dragstart', function (event) { if (gesture && gesture.active) event.preventDefault(); });
    list.addEventListener('click', function (event) {
      if (Date.now() < suppressClickUntil && !event.target.closest('.link-sort-actions')) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    list.addEventListener('contextmenu', function (event) {
      var row = eligible(event.target);
      if (!row) return;
      event.preventDefault();
      if (!gesture || !gesture.active) activateMode(row, true);
    });
    list.addEventListener('keydown', function (event) {
      var row = event.target.closest(rowSelector);
      if (!row) return;
      if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) {
        event.preventDefault(); activateMode(row, true);
      } else if (event.key === 'Escape' && modeRow) {
        event.preventDefault(); finish(true); clearMode();
        var anchor = row.querySelector('a'); if (anchor) anchor.focus();
      }
    });
    root.document.addEventListener('touchstart', function (event) { if (!list.contains(event.target)) { finish(true); clearMode(); } }, { passive: true });
    root.document.addEventListener('mousedown', function (event) { if (!list.contains(event.target)) { finish(true); clearMode(); } });
  }

  root.LinkReorder = { init: init };
})(typeof window === 'object' ? window : globalThis);
