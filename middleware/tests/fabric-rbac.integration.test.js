'use strict';

const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const { TestGatewayClient } = require('../fabric-gateway/test-gateway');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const runRealTests = process.env.RUN_FABRIC_RBAC_TESTS === '1';
const describeFabric = runRealTests ? describe : describe.skip;

describeFabric('RBAC réel sur Fabric (transactions ledger)', () => {
  const suffix = crypto.randomUUID();
  const eventId = `RBAC-EVENT-${suffix}`;
  const alertId = `RBAC-ALERT-${suffix}`;
  const reportId = `RBAC-REPORT-${suffix}`;
  const payloadJson = JSON.stringify({ testRun: suffix });
  const sourceHash = crypto.createHash('sha256').update(payloadJson).digest('hex');
  const clients = {};

  beforeAll(() => {
    for (const role of ['writer', 'reader', 'auditor']) {
      clients[role] = new TestGatewayClient(role).connect();
    }
  });

  afterAll(() => {
    for (const client of Object.values(clients)) client.close();
  });

  test('writer cree; reader et auditor lisent et verifient; writer ne lit pas', async () => {
    const created = await clients.writer.submit(
      'createAttestedEvent', eventId, 'TRANSACTION', payloadJson, sourceHash
    );
    expect(created.txId).toBeTruthy();
    expect(JSON.parse(created.result).eventId).toBe(eventId);

    for (const role of ['reader', 'auditor']) {
      const event = JSON.parse(await clients[role].evaluate('getAttestedEvent', eventId));
      expect(event.eventId).toBe(eventId);
      const verification = JSON.parse(await clients[role].evaluate(
        'verifyEventIntegrity', eventId, payloadJson
      ));
      expect(verification.integrityStatus).toBe('VALID');
      await expect(clients[role].submit(
        'createAttestedEvent',
        `${eventId}-${role}`,
        'TRANSACTION',
        payloadJson,
        sourceHash
      )).rejects.toThrow();
    }
    await expect(clients.writer.evaluate('getAttestedEvent', eventId)).rejects.toThrow();
    await expect(clients.writer.evaluate(
      'verifyEventIntegrity', eventId, payloadJson
    )).rejects.toThrow();
  });

  test('seul auditor cree et lit une alerte', async () => {
    const created = await clients.auditor.submit(
      'createAuditAlert', alertId, 'RBAC_TEST', 'LOW', '[]', 'test-signature'
    );
    expect(created.txId).toBeTruthy();
    expect(JSON.parse(await clients.auditor.evaluate('getAuditAlert', alertId)).alertId).toBe(alertId);

    await expect(clients.writer.submit(
      'createAuditAlert', `${alertId}-writer`, 'RBAC_TEST', 'LOW', '[]', 'test-signature'
    )).rejects.toThrow();
    await expect(clients.reader.submit(
      'createAuditAlert', `${alertId}-reader`, 'RBAC_TEST', 'LOW', '[]', 'test-signature'
    )).rejects.toThrow();
    await expect(clients.writer.evaluate('getAuditAlert', alertId)).rejects.toThrow();
    await expect(clients.reader.evaluate('getAuditAlert', alertId)).rejects.toThrow();
  });

  test('seul auditor certifie; reader et auditor consultent la certification', async () => {
    const created = await clients.auditor.submit(
      'certifyReport', reportId, sourceHash, '2026-01-01', '2026-01-02'
    );
    expect(created.txId).toBeTruthy();

    for (const role of ['reader', 'auditor']) {
      expect(JSON.parse(await clients[role].evaluate(
        'getReportCertification', reportId
      )).reportId).toBe(reportId);
    }
    await expect(clients.writer.submit(
      'certifyReport', `${reportId}-writer`, sourceHash, '2026-01-01', '2026-01-02'
    )).rejects.toThrow();
    await expect(clients.reader.submit(
      'certifyReport', `${reportId}-reader`, sourceHash, '2026-01-01', '2026-01-02'
    )).rejects.toThrow();
    await expect(clients.writer.evaluate('getReportCertification', reportId)).rejects.toThrow();
  });
});
