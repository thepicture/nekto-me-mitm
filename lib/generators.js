"use strict";

module.exports = {
  generateFingerprint: () =>
    Math.random().toString(32).slice(2).repeat(3).slice(0, 32),
  generateRandomId: (id) => `${id}_${new Date().getTime()}${Math.random()}`,
};
