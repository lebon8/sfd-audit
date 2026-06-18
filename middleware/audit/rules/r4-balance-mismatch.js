'use strict';
const AuditRule = require('../audit-rule');

// Proxy cas d'ecole : flux net anormal par membre.
// Le vrai R4 (vs delta de solde declare) exige des soldes non simules -> limite documentee (memoire 6.4).
class BalanceMismatchRule extends AuditRule {
  evaluate(events) {
    const { maxNetFlowPerMember = 2000000 } = this.config.params || {};
    const sign = { DEPOSIT: 1, REPAYMENT: 1, WITHDRAWAL: -1, LOAN: -1, TRANSFER: -1 };
    const flow = new Map();
    for (const e of events) {
      if (e.eventType !== 'TRANSACTION') continue;
      const m = e.data.parties.memberId;
      const entry = flow.get(m) || { net: 0, sigIds: [] };
      entry.net += (sign[e.data.operationType] ?? 0) * e.data.amount.value;
      entry.sigIds.push(e.sigId);
      flow.set(m, entry);
    }
    const alerts = [];
    for (const [m, { net, sigIds }] of flow.entries()) {
      if (Math.abs(net) > maxNetFlowPerMember) {
        alerts.push(this.makeAlert(sigIds, `Flux net anormal membre ${m}: ${net} (seuil ${maxNetFlowPerMember})`));
      }
    }
    return alerts;
  }
}
module.exports = BalanceMismatchRule;