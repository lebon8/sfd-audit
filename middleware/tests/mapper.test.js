'use strict';
const { mapTransaction, mapLog, toPivot } = require('../engine/canonical-mapper');
const { canonicalStringify } = require('../engine/hasher');

const txRow = {
  transaction_id: 'TX-1', member_id: 'M-1', agent_id: 'A-1', branch_id: 'B-1',
  operation_type: 'DEPOSIT', amount: '50000', currency: 'XOF', channel: 'AGENCY',
  status: 'VALIDATED', description: 'test',
  operation_date: new Date('2026-03-15T10:00:00Z'),
  validation_date: new Date('2026-03-15T10:01:00Z'),
};

describe('Mapper pivot (T1-T4)', () => {
  test('T1 - transaction -> evenement TRANSACTION conforme', () => {
    const e = mapTransaction(txRow);
    expect(e.eventMetadata.eventType).toBe('TRANSACTION');
    expect(e.payload.entityType).toBe('financial_transaction');
    expect(e.payload.data.amount.value).toBe(50000);          // string -> number
    expect(e.integrityProof.sourceHash).toHaveLength(64);
  });

  test('T2 - log -> evenement LOG (meme metamodele)', () => {
    const e = mapLog({ log_id: 'LOG-1', actor_id: 'A-1', action: 'LOGIN', target: 'M-1',
                       ip_address: '10.0.0.1', details: { ua: 'x' },
                       log_timestamp: new Date('2026-03-15T10:00:00Z') });
    expect(e.eventMetadata.eventType).toBe('LOG');
    expect(e.payload.data.logId).toBe('LOG-1');
  });

  test('T3/T4 - payload canonique a cles triees', () => {
    const json = canonicalStringify(toPivot({ sourceType: 'transaction', raw: txRow }).payload);
    expect(json.indexOf('"action"')).toBeLessThan(json.indexOf('"data"'));
    expect(json).toContain('"amount":{"currency":"XOF","value":50000}');
  });
});