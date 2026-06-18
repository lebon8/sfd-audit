'use strict';
const { buildReportPdf } = require('../reporting/report-builder');
const { hashBuffer } = require('../reporting/report-signer');

const data = {
  reportId: 'RPT-TEST', periodFrom: '2026-01-01T00:00:00Z', periodTo: '2026-12-31T00:00:00Z',
  generatedAt: '2026-03-15T10:00:00Z',
  stats: { totalEvents: 2, totalTransactions: 2, totalLogs: 0, totalAmount: 110000,
           byOperation: { DEPOSIT: 2 }, byAgent: { 'A-1': 2 } },
  alerts: [{ alert_id: 'ALERT-R3-abc', rule_id: 'R3', severity: 'MEDIUM',
             related_tx_ids: ['TX-1'], blockchain_tx_id: 'deadbeef' }],
};

describe('Rapport certifie (RP1-RP3)', () => {
  test('RP1 - genere un PDF valide', async () => {
    const pdf = await buildReportPdf(data);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('RP2 - hash deterministe', () => {
    const buf = Buffer.from('contenu-rapport');
    expect(hashBuffer(buf)).toBe(hashBuffer(Buffer.from('contenu-rapport')));
    expect(hashBuffer(buf)).toHaveLength(64);
  });

  test('RP3 - alteration -> hash different (TAMPERED)', () => {
    const original = Buffer.from('contenu-rapport');
    const altere = Buffer.concat([original, Buffer.from('X')]);
    expect(hashBuffer(original)).not.toBe(hashBuffer(altere));
  });
});