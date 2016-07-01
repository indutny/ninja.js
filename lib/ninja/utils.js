'use strict';

function copy(obj) {
  const res = {};
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++)
    res[keys[i]] = obj[keys[i]];
  return res;
}
exports.copy = copy;

function extend(a, b) {
  const res = copy(a);
  const keys = Object.keys(b);
  for (let i = 0; i < keys.length; i++)
    res[keys[i]] = b[keys[i]];
  return res;
}
exports.extend = extend;
