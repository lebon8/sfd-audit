'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { AuditEngine, loadRules } = require('../../middleware/audit/audit-engine');

const DATASET = path.join(__dirname, 'dataset-audit.csv');
const RESULTS = path.join(__dirname, 'resultats-audit.csv');
const MATRIX = path.join(__dirname, 'matrice-confusion.csv');
const CONFIG = path.join(__dirname, '../../middleware/audit/rules-config.json');

function parseDataset(text) {
  const [header, ...lines] = text.trimEnd().split('\n');
  const expectedHeader = [
    'sig_id', 'is_anomaly', 'anomaly_type', 'operation_type', 'amount',
    'currency', 'member_id', 'agent_id', 'operation_date',
  ].join(',');
  if (header !== expectedHeader) throw new Error('Entete inattendue dans le jeu etiquete');

  return lines.map((line) => {
    const [
      sigId, isAnomaly, anomalyType, operationType, amount, currency,
      memberId, agentId, operationDate,
    ] = line.split(',');
    return {
      sigId,
      isAnomaly: isAnomaly === 'true',
      anomalyType,
      event: {
        eventType: 'TRANSACTION',
        sigId,
        data: {
          operationType,
          amount: { value: Number(amount), currency },
          parties: { memberId, agentId },
          timestamps: { operationDate },
        },
      },
    };
  });
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(file, columns, rows) {
  const contents = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\n') + '\n';
  fs.writeFileSync(file, contents);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

const datasetBytes = fs.readFileSync(DATASET);
const datasetHash = crypto.createHash('sha256').update(datasetBytes).digest('hex');
const labeledRows = parseDataset(datasetBytes.toString('utf8'));
const ids = new Set(labeledRows.map((row) => row.sigId));
const positiveCount = labeledRows.filter((row) => row.isAnomaly).length;
if (labeledRows.length !== 1000 || positiveCount !== 50 || ids.size !== 1000) {
  throw new Error('Jeu invalide : 1000 ID uniques, dont exactement 50 anomalies attendus');
}

const engine = new AuditEngine(loadRules(CONFIG));
const alerts = engine.run(labeledRows.map((row) => row.event));
const ruleIdsByEvent = new Map();
for (const alert of alerts) {
  for (const sigId of alert.relatedTxIds) {
    const ruleIds = ruleIdsByEvent.get(sigId) || new Set();
    ruleIds.add(alert.ruleId);
    ruleIdsByEvent.set(sigId, ruleIds);
  }
}

let tp = 0, fp = 0, tn = 0, fn = 0;
const results = labeledRows.map((row) => {
  const triggeredRules = [...(ruleIdsByEvent.get(row.sigId) || [])].sort();
  const detected = triggeredRules.length > 0;
  if (row.isAnomaly && detected) tp++;
  else if (!row.isAnomaly && detected) fp++;
  else if (!row.isAnomaly) tn++;
  else fn++;
  return {
    sig_id: row.sigId,
    is_anomaly: row.isAnomaly,
    anomaly_type: row.anomalyType,
    detected,
    detected_rules: triggeredRules.join('|'),
  };
});

const precision = ratio(tp, tp + fp);
const recall = ratio(tp, tp + fn);
const f1 = precision === null || recall === null || precision + recall === 0
  ? null
  : 2 * precision * recall / (precision + recall);

writeCsv(RESULTS,
  ['sig_id', 'is_anomaly', 'anomaly_type', 'detected', 'detected_rules'],
  results);
writeCsv(MATRIX,
  ['metric', 'value'],
  [
    { metric: 'TP', value: tp },
    { metric: 'FP', value: fp },
    { metric: 'TN', value: tn },
    { metric: 'FN', value: fn },
    { metric: 'precision', value: precision },
    { metric: 'recall', value: recall },
    { metric: 'f1_score', value: f1 },
  ]);

console.log(`Dataset SHA-256: ${datasetHash}`);
console.log(`Rows=${labeledRows.length} labels=${positiveCount} alerts=${alerts.length}`);
console.log(`TP=${tp} FP=${fp} TN=${tn} FN=${fn}`);
console.log(`precision=${precision} recall=${recall} f1=${f1}`);
console.log(`Results: ${RESULTS}`);
console.log(`Confusion matrix: ${MATRIX}`);
