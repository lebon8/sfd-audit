'use strict';

class AuditRule {
  constructor(config) { this.config = config; }

  makeAlert(relatedTxIds, detail, severity = this.config.severity) {
    return { ruleId: this.config.ruleId, severity, relatedTxIds, detail };
  }

  evaluate(_events) { throw new Error(`Regle ${this.config.ruleId} : evaluate() non implemente`); }
}

module.exports = AuditRule;