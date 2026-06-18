'use strict';

const { randomUUID } = require('crypto');
const { hashObject } = require('./hasher');

const SOURCE_SYSTEM = 'SIG_SIMULATOR_V1';
const SCHEMA_VERSION = '1.0';

const toIso = (v) => (v instanceof Date ? v.toISOString() : v);

function buildEvent(eventType, entityType, action, data, sourceRecord) {
  return {
    eventMetadata: {
      eventId: randomUUID(),
      eventType,                                  // TRANSACTION | LOG
      eventTimestamp: new Date().toISOString(),
      sourceSystem: SOURCE_SYSTEM,
      sourceSchemaVersion: SCHEMA_VERSION,
    },
    payload: { entityType, action, data },
    integrityProof: { hashAlgorithm: 'SHA-256', sourceHash: hashObject(sourceRecord) },
  };
}

function mapTransaction(row) {
  return buildEvent('TRANSACTION', 'financial_transaction', 'CREATE', {
    transactionId: row.transaction_id,
    operationType: row.operation_type,
    amount: { value: Number(row.amount), currency: row.currency },
    parties: { memberId: row.member_id, agentId: row.agent_id, branchId: row.branch_id },
    timestamps: { operationDate: toIso(row.operation_date), validationDate: toIso(row.validation_date) },
    attributes: { description: row.description, channel: row.channel, status: row.status },
  }, row);
}

function mapLog(row) {
  return buildEvent('LOG', 'system_log', row.action, {
    logId: row.log_id,
    actorId: row.actor_id,
    target: row.target,
    ipAddress: row.ip_address,
    details: row.details,
    timestamps: { logDate: toIso(row.log_timestamp) },
  }, row);
}

function toPivot(envelope) {
  switch (envelope.sourceType) {
    case 'transaction': return mapTransaction(envelope.raw);
    case 'log':         return mapLog(envelope.raw);
    default: throw new Error(`Type source non supporte : ${envelope.sourceType}`);
  }
}

module.exports = { toPivot, mapTransaction, mapLog };