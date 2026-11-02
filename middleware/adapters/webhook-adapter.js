'use strict';
const { randomBytes } = require('crypto');
const SourceAdapter = require('./source-adapter');
const { normalizeTransactionRow } = require('./tx-normalize');

class WebhookAdapter extends SourceAdapter {
  async connect() {}      // push-based : rien a ouvrir
  async disconnect() {}

  // Transforme un lot de records natifs pousses par HTTP en enveloppes normalisees
  toEnvelopes(records) {
    return records.map((r, i) => {
      const sigId = r.transaction_id || r.transactionId ||
        `WH-${Date.now()}-${i}-${randomBytes(2).toString('hex').toUpperCase()}`;
      return { sourceType: 'transaction', sigId, raw: normalizeTransactionRow(r, sigId) };
    });
  }
}

module.exports = WebhookAdapter;