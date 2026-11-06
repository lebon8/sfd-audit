'use strict';

jest.mock('fabric-contract-api', () => ({ Contract: class Contract {} }), { virtual: true });

const crypto = require('crypto');
const AgnosticTrace = require('../../chaincode/agnostic-trace/lib/agnosticTrace');

const payloadJson = '{"value":1}';
const sourceHash = 'a'.repeat(64);
const blockchainHash = crypto.createHash('sha256')
  .update(`${sourceHash}|${payloadJson}`, 'utf8')
  .digest('hex');
const fixtures = {
  'event:stored-event': {
    docType: 'event', eventId: 'stored-event', eventType: 'TRANSACTION',
    payload: payloadJson, sourceHash, blockchainHash, timestamp: '2026-01-01T00:00:00.000Z',
  },
  'alert:stored-alert': {
    docType: 'alert', alertId: 'stored-alert', ruleId: 'R1', severity: 'HIGH',
    relatedTxIds: ['tx-1'], signature: 'signature', detectedAt: '2026-01-01T00:00:00.000Z',
  },
  'report:stored-report': {
    docType: 'report', reportId: 'stored-report', reportHash: sourceHash,
    certifiedAt: '2026-01-01T00:00:00.000Z',
  },
};

function createContext(role = 'sfd_reader', mspId = 'Org1MSP', initialState = fixtures) {
  const state = new Map(Object.entries(initialState)
    .map(([key, value]) => [key, Buffer.from(JSON.stringify(value))]));
  return {
    clientIdentity: {
      getMSPID: () => mspId,
      getAttributeValue: (attribute) => attribute === 'role' ? role : null,
    },
    stub: {
      getState: async (key) => state.get(key) || Buffer.alloc(0),
      putState: async (key, value) => state.set(key, Buffer.from(value)),
      getDateTimestamp: () => new Date('2026-01-01T00:00:00.000Z'),
      getTxID: () => 'unit-test-transaction',
    },
  };
}

const operations = [
  ['createAttestedEvent', 'sfd_writer', ['new-event', 'TRANSACTION', payloadJson, sourceHash]],
  ['getAttestedEvent', 'sfd_reader', ['stored-event']],
  ['verifyEventIntegrity', 'sfd_reader', ['stored-event', payloadJson]],
  ['createAuditAlert', 'sfd_auditor', ['new-alert', 'R1', 'HIGH', '["tx-1"]', 'signature']],
  ['getAuditAlert', 'sfd_auditor', ['stored-alert']],
  ['certifyReport', 'sfd_auditor', ['new-report', sourceHash, '2026-01-01', '2026-01-02']],
  ['getReportCertification', 'sfd_reader', ['stored-report']],
];

describe('RBAC et validations du chaincode', () => {
  test.each(operations)('%s n est autorisee qu aux roles attendus', async (method, allowedRole, args) => {
    const roles = ['sfd_writer', 'sfd_reader', 'sfd_auditor'];
    for (const role of roles) {
      const contract = new AgnosticTrace();
      const invocation = contract[method](createContext(role), ...args);
      if (role === allowedRole || (allowedRole === 'sfd_reader' && role === 'sfd_auditor')) {
        await expect(invocation).resolves.toBeDefined();
      } else {
        await expect(invocation).rejects.toThrow('Accès refusé');
      }
    }
  });

  test('refuse une identite cliente absente', async () => {
    const ctx = { ...createContext(), clientIdentity: undefined };
    await expect(new AgnosticTrace().createAttestedEvent(
      ctx, 'event', 'TRANSACTION', payloadJson, sourceHash
    )).rejects.toThrow('identite cliente non reconnue');
  });

  test('refuse un MSP autre que Org1MSP', async () => {
    await expect(new AgnosticTrace().createAttestedEvent(
      createContext('sfd_writer', 'OtherMSP'), 'event', 'TRANSACTION', payloadJson, sourceHash
    )).rejects.toThrow('Organisation non autorisée');
  });

  test('refuse un certificat sans role et un role inconnu', async () => {
    const contract = new AgnosticTrace();
    await expect(contract.createAttestedEvent(
      createContext(null), 'event', 'TRANSACTION', payloadJson, sourceHash
    )).rejects.toThrow('aucun rôle attribué');
    await expect(contract.createAttestedEvent(
      createContext('administrator'), 'event', 'TRANSACTION', payloadJson, sourceHash
    )).rejects.toThrow('rôle administrator non autorisé');
  });

  test('un argument qui pretend etre le role ne remplace pas l identite cliente', async () => {
    await expect(new AgnosticTrace().createAttestedEvent(
      createContext('sfd_reader'),
      'event',
      'TRANSACTION',
      payloadJson,
      sourceHash,
      'sfd_writer'
    )).rejects.toThrow('rôle sfd_reader non autorisé');
  });

  test('valide les empreintes, le type et le JSON des evenements', async () => {
    const contract = new AgnosticTrace();
    await expect(contract.createAttestedEvent(
      createContext('sfd_writer', 'Org1MSP', {}),
      'event', 'UNKNOWN', payloadJson, sourceHash
    )).rejects.toThrow('eventType non autorise');
    await expect(contract.createAttestedEvent(
      createContext('sfd_writer', 'Org1MSP', {}),
      'event', 'TRANSACTION', '{', sourceHash
    )).rejects.toThrow('payloadJson doit etre un objet JSON valide');
    await expect(contract.createAttestedEvent(
      createContext('sfd_writer', 'Org1MSP', {}),
      'event', 'TRANSACTION', payloadJson, 'not-a-hash'
    )).rejects.toThrow('sourceHash doit etre une empreinte SHA-256');
  });

  test('exige un tableau d identifiants pour une alerte', async () => {
    await expect(new AgnosticTrace().createAuditAlert(
      createContext('sfd_auditor', 'Org1MSP', {}),
      'alert', 'R1', 'HIGH', 'null', 'signature'
    )).rejects.toThrow('doit contenir un tableau');
  });

  test('valide le hash du rapport certifie', async () => {
    await expect(new AgnosticTrace().certifyReport(
      createContext('sfd_auditor', 'Org1MSP', {}),
      'report', 'bad-hash', '2026-01-01', '2026-01-02'
    )).rejects.toThrow('reportHash doit etre une empreinte SHA-256');
  });
});
