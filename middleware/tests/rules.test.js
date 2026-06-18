'use strict';
const path = require('path');
const R1 = require('../audit/rules/r1-double-deposit');
const R2 = require('../audit/rules/r2-threshold');
const R3 = require('../audit/rules/r3-off-hours');
const R4 = require('../audit/rules/r4-balance-mismatch');
const R5 = require('../audit/rules/r5-multi-account-agent');
const { AuditEngine, loadRules } = require('../audit/audit-engine');

// Fabrique d'evenement transaction
function tx(sigId, { member = 'M-1', agent = 'A-1', op = 'DEPOSIT', amount = 50000, date }) {
  return { eventType: 'TRANSACTION', sigId, data: {
    operationType: op, amount: { value: amount, currency: 'XOF' },
    parties: { memberId: member, agentId: agent, branchId: 'B-1' },
    timestamps: { operationDate: date } } };
}

describe('Moteur d audit - injection deterministe (A1-A6)', () => {
  test('A1 - R1 double depot (< 5 min)', () => {
    const r = new R1({ ruleId: 'R1', severity: 'HIGH', params: { windowSeconds: 300 } });
    const a = r.evaluate([
      tx('TX-1', { amount: 50000, date: '2026-03-15T10:00:00Z' }),
      tx('TX-2', { amount: 50000, date: '2026-03-15T10:01:30Z' }), // +90s
    ]);
    expect(a).toHaveLength(1);
    expect(a[0].severity).toBe('HIGH');
    expect(a[0].relatedTxIds).toEqual(['TX-1', 'TX-2']);
  });

  test('A2 - R2 depassement de plafond', () => {
    const r = new R2({ ruleId: 'R2', severity: 'HIGH', params: { maxAmount: 1000000 } });
    const a = r.evaluate([
      tx('TX-1', { amount: 500000,  date: '2026-03-15T10:00:00Z' }),
      tx('TX-2', { amount: 1500000, date: '2026-03-15T10:00:00Z' }),
    ]);
    expect(a).toHaveLength(1);
    expect(a[0].relatedTxIds).toEqual(['TX-2']);
  });

  test('A3 - R3 hors horaire (23h)', () => {
    const r = new R3({ ruleId: 'R3', severity: 'MEDIUM', params: { openHour: 8, closeHour: 17 } });
    const a = r.evaluate([
      tx('TX-1', { date: '2026-03-15T10:00:00' }), // 10h local -> ok
      tx('TX-2', { date: '2026-03-15T23:12:00' }), // 23h local -> alerte
    ]);
    expect(a).toHaveLength(1);
    expect(a[0].relatedTxIds).toEqual(['TX-2']);
  });

  test('A4 - R4 flux net anormal', () => {
    const r = new R4({ ruleId: 'R4', severity: 'MEDIUM', params: { maxNetFlowPerMember: 2000000 } });
    const a = r.evaluate([
      tx('TX-1', { member: 'M-9', amount: 1000000, date: '2026-03-15T10:00:00Z' }),
      tx('TX-2', { member: 'M-9', amount: 1500000, date: '2026-03-15T11:00:00Z' }),
    ]); // net = 2 500 000 > 2 000 000
    expect(a).toHaveLength(1);
  });

  test('A5 - R5 agent multi-comptes (> 5 tx / 1h)', () => {
    const r = new R5({ ruleId: 'R5', severity: 'HIGH', params: { maxTxPerHour: 5 } });
    const events = [];
    for (let i = 0; i < 8; i++) {
      events.push(tx(`TX-${i}`, { agent: 'A-9', member: `M-${i % 6}`,
        date: `2026-03-15T10:${String(i * 5).padStart(2, '0')}:00Z` })); // 8 tx en 35 min
    }
    const a = r.evaluate(events);
    expect(a).toHaveLength(1);
    expect(a[0].relatedTxIds.length).toBeGreaterThan(5);
  });

  test('A6 - non-regression : aucun faux positif', () => {
    const engine = new AuditEngine(loadRules(path.join(__dirname, '..', 'audit', 'rules-config.json')));
    const clean = [
      tx('TX-1', { member: 'M-1', agent: 'A-1', amount: 50000, date: '2026-03-15T10:00:00' }),
      tx('TX-2', { member: 'M-2', agent: 'A-2', amount: 60000, date: '2026-03-15T11:00:00' }),
      tx('TX-3', { member: 'M-3', agent: 'A-3', amount: 70000, date: '2026-03-15T12:00:00' }),
      tx('TX-4', { member: 'M-4', agent: 'A-4', amount: 80000, date: '2026-03-15T13:00:00' }),
    ];
    expect(engine.run(clean)).toHaveLength(0);
  });
});