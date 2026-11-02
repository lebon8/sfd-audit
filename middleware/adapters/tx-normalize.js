'use strict';

// Amene un enregistrement heterogene vers la forme attendue par le mapper pivot
function normalizeTransactionRow(r, sigId) {
  const now = new Date().toISOString();
  return {
    transaction_id: sigId,
    member_id:      r.member_id      || r.memberId      || 'M-UNKNOWN',
    agent_id:       r.agent_id       || r.agentId       || 'A-UNKNOWN',
    branch_id:      r.branch_id       || r.branchId      || 'B-UNKNOWN',
    operation_type: r.operation_type || r.operationType || 'DEPOSIT',
    amount:         r.amount != null ? r.amount : 0,
    currency:       r.currency       || 'XOF',
    channel:        r.channel        || 'WEB',
    status:         r.status         || 'VALIDATED',
    description:    r.description     || 'Ingestion externe',
    operation_date: r.operation_date || r.operationDate || now,
    validation_date:r.validation_date|| r.validationDate|| now,
  };
}

module.exports = { normalizeTransactionRow };