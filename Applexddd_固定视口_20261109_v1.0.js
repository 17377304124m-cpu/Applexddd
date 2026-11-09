(function (root) {
  'use strict';

  var initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    var document = root.document;
    var gesture = null;
    var lastTap = null;

    function preventScale(event) {
      if (event.cancelable) event.preventDefault();
    }

    document.addEventListener('gesturestart', preventScale, { passive: false, capture: true });
    document.addEventListener('gesturechange', preventScale, { passive: false, capture: true });
    document.addEventListener('touchmove', function (event) {
      if (event.touches.length > 1) preventScale(event);
    }, { passive: false, capture: true });

    document.addEventListener('touchstart', function (event) {
      gesture = null;
      if (event.touches.length !== 1) { lastTap = null; return; }
      var touch = event.touches[0];
      var target = event.target;
      if (touch.clientX <= 24 || touch.clientX >= root.innerWidth - 24 ||
          !target.closest || target.closest('button, a, input, textarea, select, label, summary, [contenteditable], [role="button"]')) {
        lastTap = null;
        return;
      }
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, target: target, time: Date.now() };
    }, { passive: true, capture: true });

    document.addEventListener('touchend', function (event) {
      var current = gesture;
      gesture = null;
      if (!current || event.touches.length) return;
      var touch = Array.from(event.changedTouches).filter(function (item) { return item.identifier === current.id; })[0];
      var now = Date.now();
      var selection = root.getSelection();
      if (!touch || now - current.time > 350 || Math.abs(touch.clientX - current.x) > 10 ||
          Math.abs(touch.clientY - current.y) > 10 || (selection && !selection.isCollapsed)) {
        lastTap = null;
        return;
      }
      if (lastTap && now - lastTap.time < 300 && lastTap.target === current.target &&
          Math.abs(touch.clientX - lastTap.x) < 24 && Math.abs(touch.clientY - lastTap.y) < 24) {
        preventScale(event);
        lastTap = null;
      } else lastTap = { time: now, target: current.target, x: touch.clientX, y: touch.clientY };
    }, { passive: false, capture: true });

    document.addEventListener('touchcancel', function () { gesture = null; lastTap = null; }, { passive: true, capture: true });
  }

  root.FixedViewport = { init: init };
})(window);
