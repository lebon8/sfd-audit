'use strict';
const AuditRule = require('../audit-rule');

class OffHoursRule extends AuditRule {
  evaluate(events) {
    const { openHour = 8, closeHour = 17 } = this.config.params || {};
    return events
      .filter((e) => e.eventType === 'TRANSACTION')
      .map((e) => ({ e, h: new Date(e.data.timestamps.operationDate).getHours() }))
      .filter(({ h }) => h < openHour || h >= closeHour)
      .map(({ e, h }) => this.makeAlert([e.sigId],
        `Operation hors horaire (${h}h), caisse ${openHour}h-${closeHour}h`));
  }
}
module.exports = OffHoursRule;