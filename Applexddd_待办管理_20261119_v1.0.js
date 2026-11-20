(function (root) {
  'use strict';

  function validTimestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
    var date = new Date(value);
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 19) === value.slice(0, 19);
  }

  function normalize(todos, nowISO) {
    var pending = [];
    var completed = [];
    todos.forEach(function (todo) {
      var item = Object.assign({}, todo);
      if (item.done) {
        if (!validTimestamp(item.completedAt)) item.completedAt = nowISO;
        completed.push(item);
      } else {
        delete item.completedAt;
        pending.push(item);
      }
    });
    return pending.concat(completed);
  }

  function toggle(todos, index, nowISO) {
    var result = todos.slice();
    var item = Object.assign({}, result.splice(index, 1)[0]);
    item.done = !item.done;
    if (item.done) {
      item.completedAt = nowISO;
      result.push(item);
    } else {
      delete item.completedAt;
      result.unshift(item);
    }
    return result;
  }

  function partition(todos, nowISO) {
    var active = [];
    var archived = [];
    var now = Date.parse(nowISO);
    todos.forEach(function (todo) {
      if (todo.done && validTimestamp(todo.completedAt) && now - Date.parse(todo.completedAt) >= 604800000) {
        archived.push(todo);
      } else {
        active.push(todo);
      }
    });
    return { active: active, archived: archived };
  }

  var api = { normalize: normalize, toggle: toggle, partition: partition };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TodoManager = api;
})(typeof window === 'object' ? window : globalThis);
