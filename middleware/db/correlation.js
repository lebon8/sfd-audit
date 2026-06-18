'use strict';

const { Pool } = require('pg');

class CorrelationStore {
  constructor() {
    this.pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'sfd',
      password: process.env.PGPASSWORD || 'sfd_password',
      database: process.env.PGDATABASE || 'sfd_sig',
    });
  }

  async recordAttestation({ eventId, sigId, eventType, sourceHash, blockchainTxId, eventTimestamp }) {
    await this.pool.query(
      `INSERT INTO mw.attested_index
         (event_id, sig_id, event_type, source_hash, blockchain_tx_id, event_timestamp)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, sigId, eventType, sourceHash, blockchainTxId, eventTimestamp]);
  }

  // Requete par periode (piste A2) : servie par Postgres, pas par la blockchain
  async findEventsByPeriod(from, to) {
    const res = await this.pool.query(
      `SELECT event_id, sig_id, event_type, blockchain_tx_id, event_timestamp
         FROM mw.attested_index
        WHERE event_timestamp >= $1 AND event_timestamp <= $2
        ORDER BY event_timestamp`, [from, to]);
    return res.rows;
  }

  async close() { await this.pool.end(); }
}

module.exports = { CorrelationStore };