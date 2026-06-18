'use strict';
const AuditRule = require('../audit-rule');

class ThresholdRule extends AuditRule {
  evaluate(events) {
    const { maxAmount = 1000000 } = this.config.params || {};
    return events
      .filter((e) => e.eventType === 'TRANSACTION' && e.data.amount.value > maxAmount)
      .map((e) => this.makeAlert([e.sigId],
        `Depassement plafond: ${e.data.amount.value} ${e.data.amount.currency} > ${maxAmount}`));
  }
}
module.exports = ThresholdRule;