'use strict';
const AuditRule = require('../audit-rule');

class MultiAccountAgentRule extends AuditRule {
  evaluate(events) {
    const { maxTxPerHour = 5 } = this.config.params || {};
    const byAgent = new Map();
    for (const e of events) {
      if (e.eventType !== 'TRANSACTION') continue;
      const a = e.data.parties.agentId;
      (byAgent.get(a) || byAgent.set(a, []).get(a)).push({
        t: new Date(e.data.timestamps.operationDate).getTime(),
        memberId: e.data.parties.memberId, sigId: e.sigId });
    }
    const alerts = [];
    for (const [agent, list] of byAgent.entries()) {
      list.sort((x, y) => x.t - y.t);
      for (let i = 0; i < list.length; i++) {
        const win = list.filter((x) => x.t >= list[i].t && x.t < list[i].t + 3600000);
        const accounts = new Set(win.map((x) => x.memberId));
        if (win.length > maxTxPerHour && accounts.size > 1) {
          alerts.push(this.makeAlert(win.map((x) => x.sigId),
            `Agent ${agent}: ${win.length} transactions sur ${accounts.size} comptes en <1h`));
          break;
        }
      }
    }
    return alerts;
  }
}
module.exports = MultiAccountAgentRule;