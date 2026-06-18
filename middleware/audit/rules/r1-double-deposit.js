'use strict';
const AuditRule = require('../audit-rule');

class DoubleDepositRule extends AuditRule {
  evaluate(events) {
    const alerts = [];
    const { windowSeconds = 300 } = this.config.params || {};
    const txs = events
      .filter((e) => e.eventType === 'TRANSACTION' && e.data.operationType === 'DEPOSIT')
      .map((e) => ({ sigId: e.sigId, memberId: e.data.parties.memberId,
                     amount: e.data.amount.value, t: new Date(e.data.timestamps.operationDate).getTime() }))
      .sort((a, b) => a.t - b.t);

    const groups = new Map();
    for (const tx of txs) {
      const key = `${tx.memberId}|${tx.amount}`;
      (groups.get(key) || groups.set(key, []).get(key)).push(tx);
    }
    for (const list of groups.values()) {
      for (let i = 1; i < list.length; i++) {
        if (list[i].t - list[i - 1].t < windowSeconds * 1000) {
          alerts.push(this.makeAlert([list[i - 1].sigId, list[i].sigId],
            `Double depot: membre ${list[i].memberId}, montant ${list[i].amount}, ecart < ${windowSeconds}s`));
        }
      }
    }
    return alerts;
  }
}
module.exports = DoubleDepositRule;