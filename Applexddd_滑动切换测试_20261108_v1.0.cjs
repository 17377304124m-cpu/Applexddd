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
