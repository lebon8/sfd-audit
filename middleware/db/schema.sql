-- Schema MIDDLEWARE : index hors-chaine (piste A2)
CREATE SCHEMA IF NOT EXISTS mw;

-- Correspondance sig_id <-> blockchain + horodatage metier.
-- C'est CETTE table qui sert les requetes par periode (pas la blockchain).
CREATE TABLE IF NOT EXISTS mw.attested_index (
  event_id          TEXT PRIMARY KEY,
  sig_id            TEXT NOT NULL,           -- transaction_id ou log_id source
  event_type        TEXT NOT NULL,           -- TRANSACTION|LOG|AUDIT
  source_hash       TEXT NOT NULL,
  blockchain_tx_id  TEXT,                    -- txId Fabric apres ancrage
  event_timestamp   TIMESTAMPTZ NOT NULL,    -- horodatage metier (requetes periode)
  anchored_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mw.alert_index (
  alert_id          TEXT PRIMARY KEY,
  rule_id           TEXT NOT NULL,
  severity          TEXT NOT NULL,
  related_tx_ids    JSONB NOT NULL,
  blockchain_tx_id  TEXT,
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attested_ts   ON mw.attested_index(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_attested_type ON mw.attested_index(event_type);
CREATE INDEX IF NOT EXISTS idx_alert_detected ON mw.alert_index(detected_at);