'use strict';
const path = require('path');
const { canonicalStringify, sha256Hex } = require('./engine/hasher');
const { GatewayClient } = require('./fabric-gateway/gateway');
const { CorrelationStore } = require('./db/correlation');
const { AuditEngine, loadRules } = require('./audit/audit-engine');
const { signAlert } = require('./audit/alert-signer');

const RULES_CONFIG = path.join(__dirname, 'audit', 'rules-config.json');

function alertIdFor(ruleId, relatedTxIds) {
  const h = sha256Hex(canonicalStringify({ ruleId, relatedTxIds: [...relatedTxIds].sort() }));
  return `ALERT-${ruleId}-${h.slice(0, 12)}`;
}

// Pre-check on-chain : evaluate (lecture) ne modifie rien et evite une endorsement vouee a l'echec
async function alertExists(gateway, alertId) {
  try { await gateway.evaluate('getAuditAlert', alertId); return true; }
  catch { return false; }   // le chaincode leve "introuvable" si absente
}

async function runAuditCycle(periodFrom, periodTo) {
  const gateway = new GatewayClient().connect();
  const store = new CorrelationStore();
  try {
    const indexed = await store.findEventsByPeriod(periodFrom, periodTo);

    const events = [];
    for (const row of indexed) {
      const evt = JSON.parse(await gateway.evaluate('getAttestedEvent', row.event_id));
      const payload = JSON.parse(evt.payload);
      events.push({ eventId: evt.eventId, eventType: evt.eventType,
                    sigId: row.sig_id, txId: row.blockchain_tx_id, data: payload.data });
    }

    const engine = new AuditEngine(loadRules(RULES_CONFIG));
    const detected = engine.run(events);

    let anchored = 0, skipped = 0, failed = 0;
    for (const a of detected) {
      const alertId = alertIdFor(a.ruleId, a.relatedTxIds);

      if (await alertExists(gateway, alertId)) { skipped++; continue; }

      const canonical = canonicalStringify({ alertId, ruleId: a.ruleId, severity: a.severity, relatedTxIds: a.relatedTxIds });
      const signature = signAlert(canonical);
      try {
        const { txId } = await gateway.submit('createAuditAlert',
          alertId, a.ruleId, a.severity, JSON.stringify(a.relatedTxIds), signature);
        await store.recordAlert({ alertId, ruleId: a.ruleId, severity: a.severity, relatedTxIds: a.relatedTxIds, blockchainTxId: txId });
        anchored++;
      } catch (e) {
        // Affiche la VRAIE cause (details d'endorsement) plutot que d'abandonner tout le cycle
        const detail = [e.message, ...((e.details || []).map((d) => d.message))].filter(Boolean).join(' | ');
        console.error(`Echec alerte ${alertId} [${a.ruleId}] : ${detail}`);
        failed++;
      }
    }
    return { scanned: events.length, detected: detected.length, anchored, skipped, failed };
  } finally {
    await store.close();
    gateway.close();
  }
}

module.exports = { runAuditCycle };