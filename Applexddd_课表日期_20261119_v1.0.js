(function (root) {
  'use strict';

  var firstMonday = Date.UTC(2026, 8, 7);

  function getCurrent(date) {
    var currentDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return {
      week: Math.floor((currentDay - firstMonday) / 604800000) + 1,
      day: date.getDay() || 7
    };
  }

  var api = { getCurrent: getCurrent };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScheduleDate = api;
})(typeof window === 'object' ? window : globalThis);
