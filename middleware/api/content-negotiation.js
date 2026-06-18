'use strict';

function escapeXml(v) {
  return String(v).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}
function toXml(value, node = 'item') {
  if (Array.isArray(value)) return value.map((v) => toXml(v, node)).join('');
  if (value !== null && typeof value === 'object')
    return `<${node}>${Object.entries(value).map(([k, v]) => toXml(v, k)).join('')}</${node}>`;
  return `<${node}>${escapeXml(value)}</${node}>`;
}
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? v.join('|') : v;
  }
  return out;
}
function toCsv(data) {
  const rows = (Array.isArray(data) ? data : [data]).map((r) => flatten(r));
  if (rows.length === 0) return '';
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}
function negotiate(req, res, data, root = 'result') {
  const fmt = (req.query.format || 'json').toLowerCase();
  if (fmt === 'xml') return res.type('application/xml').send(`<?xml version="1.0"?><${root}s>${toXml(data, root)}</${root}s>`);
  if (fmt === 'csv') return res.type('text/csv').send(toCsv(data));
  return res.json(data);
}

module.exports = { negotiate };