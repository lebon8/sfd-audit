'use strict';
const fs = require('fs');
const { randomBytes } = require('crypto');
const SourceAdapter = require('./source-adapter');
const { normalizeTransactionRow } = require('./tx-normalize');

function splitLine(line, delim) {
  const out = []; let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
      else cur += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === delim) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur); return out;
}

function parseCsv(text, delim) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitLine(lines[0], delim).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = splitLine(l, delim);
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

// Traduit les colonnes legacy -> champs canoniques (mapping declaratif)
function applyMapping(row, mapping) {
  const out = {};
  for (const [canonical, legacyCol] of Object.entries(mapping)) out[canonical] = row[legacyCol];
  return out;
}

class CSVAdapter extends SourceAdapter {
  constructor({ filePath, mapping, delimiter = ';' }) {
    super();
    this.filePath = filePath;
    this.mapping = mapping;
    this.delimiter = delimiter;
  }
  async connect() { if (!fs.existsSync(this.filePath)) throw new Error(`Fichier introuvable : ${this.filePath}`); }
  async disconnect() {}

  async consume() {
    const rows = parseCsv(fs.readFileSync(this.filePath, 'utf8'), this.delimiter);
    return rows.map((row) => {
      const mapped = applyMapping(row, this.mapping);
      const sigId = mapped.transaction_id || `CSV-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;
      return { sourceType: 'transaction', sigId, raw: normalizeTransactionRow(mapped, sigId) };
    });
  }
}

module.exports = CSVAdapter;