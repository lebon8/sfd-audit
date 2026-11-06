'use strict';

const { anchorEnvelopes } = require('../ingest-core');

function envelope(sigId = 'SIG-TEST-1') {
  return {
    sourceType: 'transaction',
    sigId,
    raw: {
      transaction_id: sigId,
      member_id: 'M-1',
      agent_id: 'A-1',
      branch_id: 'B-1',
      operation_type: 'DEPOSIT',
      amount: '50000',
      currency: 'XOF',
      channel: 'AGENCY',
      status: 'VALIDATED',
      description: 'test',
      operation_date: '2026-03-15T10:00:00Z',
      validation_date: '2026-03-15T10:01:00Z',
    },
  };
}

function dependencies({ alreadyIndexed = false, submitError, indexError } = {}) {
  return {
    gateway: {
      submit: jest.fn(async () => {
        if (submitError) throw submitError;
        return { txId: 'fabric-tx-1' };
      }),
    },
    store: {
      isIndexed: jest.fn().mockResolvedValue(alreadyIndexed),
      recordAttestation: jest.fn(async () => {
        if (indexError) throw indexError;
      }),
    },
  };
}

describe('Ingestion simulée PostgreSQL/Fabric', () => {
  test('ancre d abord sur Fabric puis enregistre la corrélation PostgreSQL', async () => {
    const deps = dependencies();
    const result = await anchorEnvelopes([envelope()], deps);

    expect(result).toMatchObject({ total: 1, anchored: 1, failed: 0, rejected: 0 });
    expect(deps.gateway.submit).toHaveBeenCalledWith(
      'createAttestedEvent',
      expect.any(String),
      'TRANSACTION',
      expect.any(String),
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
    expect(deps.store.recordAttestation).toHaveBeenCalledWith(expect.objectContaining({
      sigId: 'SIG-TEST-1',
      blockchainTxId: 'fabric-tx-1',
    }));
  });

  test('ne resoumet pas un identifiant SIG déjà indexé', async () => {
    const deps = dependencies({ alreadyIndexed: true });
    const result = await anchorEnvelopes([envelope()], deps);

    expect(result).toMatchObject({ duplicate: 1, anchored: 0, failed: 0 });
    expect(deps.gateway.submit).not.toHaveBeenCalled();
  });

  test('ne crée pas d index si la transaction Fabric échoue', async () => {
    const deps = dependencies({ submitError: new Error('peer indisponible') });
    const result = await anchorEnvelopes([envelope()], deps);

    expect(result).toMatchObject({ anchored: 0, failed: 1 });
    expect(deps.store.recordAttestation).not.toHaveBeenCalled();
  });

  test('signale un échec d indexation après le commit Fabric sans prétendre à l atomicité', async () => {
    const deps = dependencies({ indexError: new Error('PostgreSQL indisponible') });
    const result = await anchorEnvelopes([envelope()], deps);

    expect(result).toMatchObject({ anchored: 0, failed: 1 });
    expect(deps.gateway.submit).toHaveBeenCalledTimes(1);
    expect(deps.store.recordAttestation).toHaveBeenCalledTimes(1);
  });
});
