(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KodoAuthMigration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function stableStringify(value) {
    if (Array.isArray(value)) {
      return '[' + value.map(stableStringify).join(',') + ']';
    }
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + stableStringify(value[key]);
      }).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  function mergeProgress(guestValue, accountValue) {
    if (Array.isArray(guestValue) || Array.isArray(accountValue)) {
      var combined = (Array.isArray(guestValue) ? guestValue : []).concat(
        Array.isArray(accountValue) ? accountValue : []
      );
      var seen = Object.create(null);
      return combined.filter(function (item) {
        var key = stableStringify(item);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }

    if (guestValue && typeof guestValue === 'object' &&
        accountValue && typeof accountValue === 'object') {
      var result = {};
      Object.keys(guestValue).forEach(function (key) {
        result[key] = mergeProgress(guestValue[key], accountValue[key]);
      });
      Object.keys(accountValue).forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(guestValue, key)) {
          result[key] = accountValue[key];
        }
      });
      return result;
    }

    if (typeof guestValue === 'number' && typeof accountValue === 'number') {
      return Math.max(guestValue, accountValue);
    }
    if (typeof guestValue === 'boolean' && typeof accountValue === 'boolean') {
      return guestValue || accountValue;
    }
    return accountValue !== undefined && accountValue !== null ? accountValue : guestValue;
  }

  function mergeGuestData(guestData, accountData, guestId) {
    var guest = guestData || {};
    var account = accountData || {};
    var merged = Object.assign({}, account);

    ['xp', 'gems', 'hearts', 'streak', 'level'].forEach(function (field) {
      var values = [guest[field], account[field]].filter(function (value) {
        return typeof value === 'number' && isFinite(value);
      });
      if (values.length) merged[field] = Math.max.apply(Math, values);
    });

    ['completed', 'stats'].forEach(function (field) {
      if (guest[field] || account[field]) {
        merged[field] = mergeProgress(guest[field] || {}, account[field] || {});
      }
    });

    if (Array.isArray(guest.achievements) || Array.isArray(account.achievements)) {
      merged.achievements = mergeProgress(guest.achievements || [], account.achievements || []);
    }

    if (!account.userName && guest.userName) merged.userName = guest.userName;

    var guestCourseAt = Number(guest.currentCourseUpdatedAt || 0);
    var accountCourseAt = Number(account.currentCourseUpdatedAt || 0);
    if (guest.currentCourse && (!account.currentCourse || guestCourseAt > accountCourseAt)) {
      merged.currentCourse = guest.currentCourse;
      merged.currentCourseUpdatedAt = guestCourseAt || Date.now();
    }

    merged.guestMigrations = Object.assign({}, account.guestMigrations || {});
    if (guestId) merged.guestMigrations[guestId] = true;
    return merged;
  }

  function verifyGuestMerge(expected, actual, guestId) {
    if (!expected || !actual) return false;
    var numericFields = ['xp', 'gems', 'hearts', 'streak', 'level'];
    for (var i = 0; i < numericFields.length; i++) {
      var field = numericFields[i];
      if (expected[field] !== undefined && actual[field] !== expected[field]) return false;
    }
    var objectFields = ['completed', 'stats', 'achievements'];
    for (var j = 0; j < objectFields.length; j++) {
      var objectField = objectFields[j];
      if (expected[objectField] !== undefined &&
          stableStringify(actual[objectField]) !== stableStringify(expected[objectField])) return false;
    }
    if (expected.currentCourse !== actual.currentCourse) return false;
    if (guestId && !(actual.guestMigrations && actual.guestMigrations[guestId] === true)) return false;
    return true;
  }

  return {
    mergeGuestData: mergeGuestData,
    verifyGuestMerge: verifyGuestMerge,
    shouldMigrateGuestId: function (id) {
      return typeof id === 'string' && id.indexOf('DEV-') === 0;
    }
  };
});
