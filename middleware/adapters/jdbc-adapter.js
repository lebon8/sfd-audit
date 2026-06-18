'use strict';

const { Pool } = require('pg');
const SourceAdapter = require('./source-adapter');

class JDBCAdapter extends SourceAdapter {
  constructor(config = {}) {
    super();
    this.pool = new Pool({
      host: config.host || process.env.PGHOST || 'localhost',
      port: Number(config.port || process.env.PGPORT || 5432),
      user: config.user || process.env.PGUSER || 'sfd',
      password: config.password || process.env.PGPASSWORD || 'sfd_password',
      database: config.database || process.env.PGDATABASE || 'sfd_sig',
    });
    this.batchSize = config.batchSize || 100;
  }

  async connect() {
    await this.pool.query('SELECT 1'); // teste la connexion
  }

  // Renvoie les enregistrements PAS ENCORE indexes (idempotent via mw.attested_index)
  async consume() {
    const tx = await this.pool.query(
      `SELECT t.* FROM sig.transactions t
         LEFT JOIN mw.attested_index i ON i.sig_id = t.transaction_id
        WHERE i.event_id IS NULL
        ORDER BY t.created_at
        LIMIT $1`, [this.batchSize]);

    const logs = await this.pool.query(
      `SELECT l.* FROM sig.audit_logs l
         LEFT JOIN mw.attested_index i ON i.sig_id = l.log_id
        WHERE i.event_id IS NULL
        ORDER BY l.log_timestamp
        LIMIT $1`, [this.batchSize]);

    return [
      ...tx.rows.map((raw)   => ({ sourceType: 'transaction', sigId: raw.transaction_id, raw })),
      ...logs.rows.map((raw) => ({ sourceType: 'log',         sigId: raw.log_id,         raw })),
    ];
  }

  async disconnect() {
    await this.pool.end();
  }
}

module.exports = JDBCAdapter;