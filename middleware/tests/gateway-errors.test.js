'use strict';

const { isMissingLedgerRecord } = require('../fabric-gateway/errors');

describe('Classification des erreurs Fabric', () => {
  test('identifie une entrée ledger absente', () => {
    expect(isMissingLedgerRecord(new Error('Evenement introuvable'))).toBe(true);
    expect(isMissingLedgerRecord({
      message: 'Endorsement failed',
      details: [{ message: 'Report not found' }],
    })).toBe(true);
  });

  test('ne transforme pas une panne Gateway en entrée absente', () => {
    expect(isMissingLedgerRecord(new Error('deadline exceeded'))).toBe(false);
    expect(isMissingLedgerRecord(new Error('connection refused'))).toBe(false);
  });
});
