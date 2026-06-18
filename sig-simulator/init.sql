-- Schema SOURCE (le SIG, vu comme une boite noire par le middleware)
CREATE SCHEMA IF NOT EXISTS sig;

CREATE TABLE IF NOT EXISTS sig.transactions (
  transaction_id   TEXT PRIMARY KEY,
  member_id        TEXT NOT NULL,
  agent_id         TEXT NOT NULL,
  branch_id        TEXT NOT NULL,
  operation_type   TEXT NOT NULL,            -- DEPOSIT|WITHDRAWAL|LOAN|REPAYMENT|TRANSFER
  amount           NUMERIC(18,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'XOF',
  channel          TEXT NOT NULL,            -- AGENCY|MOBILE|WEB
  status           TEXT NOT NULL DEFAULT 'VALIDATED',
  description      TEXT,
  operation_date   TIMESTAMPTZ NOT NULL,
  validation_date  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sig.audit_logs (
  log_id         TEXT PRIMARY KEY,
  actor_id       TEXT NOT NULL,
  action         TEXT NOT NULL,              -- LOGIN|LOGOUT|CONFIG_CHANGE|EXPORT
  target         TEXT,
  ip_address     INET,
  details        JSONB,
  log_timestamp  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_opdate ON sig.transactions(operation_date);
CREATE INDEX IF NOT EXISTS idx_tx_member ON sig.transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_log_ts    ON sig.audit_logs(log_timestamp);