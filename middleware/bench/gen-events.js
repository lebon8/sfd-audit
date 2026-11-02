'use strict';
const { randomUUID } = require('crypto');
const { canonicalStringify, hashObject } = require('../engine/hasher');

const OPS = ['DEPOSIT', 'WITHDRAWAL', 'LOAN', 'REPAYMENT', 'TRANSFER'];

// Genere un evenement pret a ancrer, en memoire (isole la blockchain de Postgres/JDBC)
function makeEvent(i, producer = 'BENCH') {
  const eventId = randomUUID();
  const sigId = `${producer}-${Date.now()}-${i}`;
  const raw = {
    transactionId: sigId, operationType: OPS[i % OPS.length],
    amount: 10000 + (i % 500) * 137, memberId: `M-${i % 1000}`, agentId: `A-${i % 50}`,
  };
  const payload = { entityType: 'financial_transaction', action: 'CREATE', data: raw };
  return {
    eventId, sigId, eventType: 'TRANSACTION',
    eventTimestamp: new Date().toISOString(),
    payloadJson: canonicalStringify(payload),
    sourceHash: hashObject(raw),
  };
}

module.exports = { makeEvent };