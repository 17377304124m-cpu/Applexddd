const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, 'Applexddd_滑动切换_20261108_v1.0.js');
const gestures = fs.existsSync(file) ? require(file) : null;

test('向左划到下一项，向右划到上一项', () => {
  assert.ok(gestures, '尚未实现触摸滑动');
  assert.equal(gestures.getSwipeDirection(-100, 8, 250), 1);
  assert.equal(gestures.getSwipeDirection(100, -8, 250), -1);
});

test('轻点和短距离拖动不能切换', () => {
  assert.ok(gestures, '尚未实现触摸滑动');
  assert.equal(gestures.getSwipeDirection(0, 0, 100), 0);
  assert.equal(gestures.getSwipeDirection(30, 2, 200), 0);
});

test('竖向滚动与明显斜向移动不能切换', () => {
  assert.ok(gestures, '尚未实现触摸滑动');
  assert.equal(gestures.getSwipeDirection(15, 120, 300), 0);
  assert.equal(gestures.getSwipeDirection(80, 70, 300), 0);
  assert.equal(gestures.getSwipeDirection(-80, -70, 300), 0);
});

test('长按后移动保留文本操作，不切换分类', () => {
  assert.ok(gestures, '尚未实现触摸滑动');
  assert.equal(gestures.getSwipeDirection(100, 3, 1100), 0);
});

function createHistoryGesture() {
  assert.equal(typeof gestures.bindHistory, 'function');
  const dialog = new EventTarget();
  dialog.setPointerCapture = () => {};
  const row = {};
  const item = { closest: (selector) => ({ '.p-history-item': item, '.p-history-row': row })[selector] };
  const edge = { closest: (selector) => selector === '.p-history-edge' ? edge : null };
  const actions = [];
  gestures.bindHistory(dialog, {
    reveal: (swipedRow, open) => actions.push([swipedRow, open]),
    close: () => actions.push('close')
  });

  function dispatch(type, target, clientX, clientY, options = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: 'touch', clientX, clientY, isPrimary: true, button: 0, buttons: 1, detail: 1, ...options });
    Object.defineProperties(event, { target: { value: target }, isTrusted: { value: true } });
    dialog.dispatchEvent(event);
    return event.defaultPrevented;
  }

  return { row, item, edge, actions, dispatch };
}

test('历史行右划露出删除，左划收起删除', () => {
  const { row, item, actions, dispatch } = createHistoryGesture();
  dispatch('pointerdown', item, 50, 30);
  dispatch('pointermove', item, 90, 31);
  dispatch('pointerup', item, 140, 32);
  dispatch('pointerdown', item, 140, 30);
  dispatch('pointerup', item, 50, 32);
  assert.deepEqual(actions, [[row, true], [row, false]]);
});

test('历史边缘只响应左划关闭，向下滚动保留原操作', () => {
  const { item, edge, actions, dispatch } = createHistoryGesture();
  dispatch('pointerdown', item, 50, 30);
  dispatch('pointermove', item, 55, 90);
  dispatch('pointerup', item, 155, 95);
  dispatch('pointerdown', edge, 100, 30);
  dispatch('pointerup', edge, 190, 30);
  assert.deepEqual(actions, []);
  dispatch('pointerdown', edge, 190, 30);
  dispatch('pointerup', edge, 100, 31);
  assert.deepEqual(actions, ['close']);
});

test('历史行横向拖动不会误触，下一次点击和键盘激活仍然有效', () => {
  const { item, actions, dispatch } = createHistoryGesture();
  dispatch('pointerdown', item, 50, 30);
  dispatch('pointermove', item, 75, 30);
  dispatch('pointerup', item, 75, 30);
  assert.deepEqual(actions, []);
  assert.equal(dispatch('click', item, 75, 30), true);
  assert.equal(dispatch('click', item, 75, 30, { detail: 0 }), false);
  dispatch('pointerdown', item, 75, 30);
  dispatch('pointerup', item, 75, 30);
  assert.equal(dispatch('click', item, 75, 30), false);
});
