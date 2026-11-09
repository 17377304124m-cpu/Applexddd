(function (root) {
  'use strict';

  var boundScopes = new WeakSet();

  function getSwipeDirection(dx, dy, elapsed) {
    if (elapsed > 900 || Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.6) return 0;
    return dx < 0 ? 1 : -1;
  }

  function bind(scope, onSwipe, allowCalendarDay) {
    if (!scope || boundScopes.has(scope)) return;
    boundScopes.add(scope);
    var gesture = null;
    var suppressClickUntil = 0;

    function hasSelection() {
      var selection = root.getSelection();
      return selection && !selection.isCollapsed;
    }

    scope.addEventListener('touchstart', function (event) {
      gesture = null;
      suppressClickUntil = 0;
      if (event.touches.length !== 1 || hasSelection()) return;
      var touch = event.touches[0];
      if (touch.clientX <= 24 || touch.clientX >= root.innerWidth - 24) return;
      var interactive = event.target.closest('input, textarea, select, option, button, a, label, summary, [contenteditable], [role="slider"]');
      if (interactive && !(allowCalendarDay && interactive.classList.contains('calendar-day'))) return;
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, started: Date.now(), horizontal: false };
    }, { passive: true });

    scope.addEventListener('touchmove', function (event) {
      if (!gesture) return;
      if (event.touches.length !== 1 || hasSelection()) { gesture = null; return; }
      var touch = event.touches[0];
      if (touch.identifier !== gesture.id) { gesture = null; return; }
      var dx = Math.abs(touch.clientX - gesture.x);
      var dy = Math.abs(touch.clientY - gesture.y);
      if (!gesture.horizontal && dy > 10 && dy >= dx) { gesture = null; return; }
      if (dx > 14 && dx >= dy * 1.6) gesture.horizontal = true;
      if (gesture.horizontal && event.cancelable) event.preventDefault();
    }, { passive: false });

    scope.addEventListener('touchend', function (event) {
      var current = gesture;
      gesture = null;
      if (!current || event.touches.length || hasSelection()) return;
      var touch = Array.from(event.changedTouches).filter(function (item) { return item.identifier === current.id; })[0];
      if (!touch) return;
      var direction = getSwipeDirection(touch.clientX - current.x, touch.clientY - current.y, Date.now() - current.started);
      if (current.horizontal || direction) suppressClickUntil = Date.now() + 550;
      if (direction) onSwipe(direction);
    }, { passive: true });

    scope.addEventListener('touchcancel', function () { gesture = null; }, { passive: true });
    scope.addEventListener('click', function (event) {
      if (event.isTrusted && Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function init() {
    ['#page-tools', '#page-info'].forEach(function (selector) {
      var page = root.document.querySelector(selector);
      bind(page, function (direction) {
        var buttons = Array.from(page.querySelectorAll('[data-tool]'));
        var current = buttons.findIndex(function (button) { return button.classList.contains('active'); });
        var next = buttons[current + direction];
        if (next) next.click();
      }, false);
    });
    bind(root.document.querySelector('#calendar-grid'), function (direction) {
      root.document.querySelector(direction > 0 ? '#calendar-next' : '#calendar-prev').click();
    }, true);
  }

  var api = { init: init, getSwipeDirection: getSwipeDirection };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MobileSwipes = api;
})(typeof window === 'object' ? window : globalThis);
