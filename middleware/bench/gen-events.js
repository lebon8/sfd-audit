
'use strict';

const { randomUUID } = require('crypto');
const { canonicalStringify, hashObject } = require('../engine/hasher');

const OPS = ['DEPOSIT', 'WITHDRAWAL', 'LOAN', 'REPAYMENT', 'TRANSFER'];

function makeEvent(i, producer = 'BENCH') {
  const eventId = randomUUID();
  const sigId = `${producer}-${Date.now()}-${i}`;

  const raw = {
    transactionId: sigId,
    operationType: OPS[i % OPS.length],

    amount: {
      value: 10000 + (i % 500) * 137,
      currency: 'XOF'
    },

    parties: {
      memberId: `M-${i % 1000}`,
      agentId: `A-${i % 50}`,
      branchId: `BR-${i % 10}`
    },

    timestamps: {
      operationDate: new Date().toISOString(),
      validationDate: new Date().toISOString()
    }
  };

  const payload = {
    entityType: 'financial_transaction',
    action: 'CREATE',
    data: raw
  };

  return {
    eventId,
    sigId,
    eventType: 'TRANSACTION',
    eventTimestamp: raw.timestamps.operationDate,
    payloadJson: canonicalStringify(payload),
    sourceHash: hashObject(raw)
  };
}

module.exports = { makeEvent };