'use strict';

const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'sfd',
  password: process.env.PGPASSWORD || 'sfd_password',
  database: process.env.PGDATABASE || 'sfd_sig',
});

const BRANCHES = ['B-01', 'B-02', 'B-03'];
const AGENTS   = ['A-101', 'A-102', 'A-103', 'A-104'];
const MEMBERS  = Array.from({ length: 30 }, (_, i) => `M-${1000 + i}`);
const OPS      = ['DEPOSIT', 'WITHDRAWAL', 'LOAN', 'REPAYMENT', 'TRANSFER'];
const CHANNELS = ['AGENCY', 'MOBILE', 'WEB'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randAmount = () => Math.round((5000 + Math.random() * 495000) / 100) * 100; // 5k–500k XOF
const shortId = () => crypto.randomBytes(4).toString('hex').toUpperCase();

function parseCount() {
  const idx = process.argv.indexOf('--count');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 20;
}

async function insertTransaction(client) {
  const id = `TX-${Date.now()}-${shortId()}`;
  const opDate = new Date(Date.now() - Math.floor(Math.random() * 7 * 86400000)); // 7 derniers jours
  const valDate = new Date(opDate.getTime() + Math.floor(Math.random() * 120000));
  await client.query(
    `INSERT INTO sig.transactions
       (transaction_id, member_id, agent_id, branch_id, operation_type,
        amount, currency, channel, status, description, operation_date, validation_date)
     VALUES ($1,$2,$3,$4,$5,$6,'XOF',$7,'VALIDATED',$8,$9,$10)`,
    [id, pick(MEMBERS), pick(AGENTS), pick(BRANCHES), pick(OPS),
     randAmount(), pick(CHANNELS), 'Operation simulee', opDate, valDate]
  );
  return id;
}

async function insertLog(client) {
  const id = `LOG-${Date.now()}-${shortId()}`;
  await client.query(
    `INSERT INTO sig.audit_logs (log_id, actor_id, action, target, ip_address, details)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, pick(AGENTS), pick(['LOGIN', 'LOGOUT', 'CONFIG_CHANGE', 'EXPORT']),
     pick(MEMBERS), '10.0.0.' + (1 + Math.floor(Math.random() * 254)),
     JSON.stringify({ ua: 'sig-client/1.0' })]
  );
  return id;
}

async function main() {
  const count = parseCount();
  const client = await pool.connect();
  let tx = 0, logs = 0;
  try {
    for (let i = 0; i < count; i++) {
      if (Math.random() < 0.8) { await insertTransaction(client); tx++; }
      else { await insertLog(client); logs++; }
    }
    console.log(`Genere : ${tx} transactions, ${logs} logs (total ${count}).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('Erreur generateur :', e.message); process.exit(1); });