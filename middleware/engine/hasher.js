'use strict';

const crypto = require('crypto');

// Serialisation canonique : cles triees recursivement, dates en ISO, sortie compacte.
function canonicalStringify(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return '[' + value.map(canonicalStringify).join(',') + ']';

  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  const entries = keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(value[k]));
  return '{' + entries.join(',') + '}';
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

// Empreinte deterministe d'un objet quelconque (clefs triees)
function hashObject(obj) {
  return sha256Hex(canonicalStringify(obj));
}

module.exports = { canonicalStringify, sha256Hex, hashObject };