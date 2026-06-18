'use strict';
const fs = require('fs');

class AuditEngine {
  constructor(rules) { this.rules = rules; }
  run(events) {
    let alerts = [];
    for (const rule of this.rules) {
      if (rule.config.enabled === false) continue;
      alerts = alerts.concat(rule.evaluate(events));
    }
    return alerts;
  }
}

function loadRules(configPath) {
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const registry = {
    R1: require('./rules/r1-double-deposit'),
    R2: require('./rules/r2-threshold'),
    R3: require('./rules/r3-off-hours'),
    R4: require('./rules/r4-balance-mismatch'),
    R5: require('./rules/r5-multi-account-agent'),
  };
  return raw.rules.filter((c) => registry[c.ruleId]).map((c) => new registry[c.ruleId](c));
}

module.exports = { AuditEngine, loadRules };