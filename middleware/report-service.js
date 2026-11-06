'use strict';
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const { RoleGatewayClient } = require('./fabric-gateway/role-gateway');
const { isMissingLedgerRecord } = require('./fabric-gateway/errors');
const { CorrelationStore } = require('./db/correlation');
const { buildReportPdf } = require('./reporting/report-builder');
const { hashBuffer } = require('./reporting/report-signer');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const shortId = () => randomBytes(3).toString('hex').toUpperCase();

function computeStats(events) {
  const s = { totalEvents: events.length, totalTransactions: 0, totalLogs: 0,
              totalAmount: 0, byOperation: {}, byAgent: {} };
  for (const e of events) {
    if (e.eventType === 'TRANSACTION') {
      s.totalTransactions++;
      s.totalAmount += e.data.amount.value;
      s.byOperation[e.data.operationType] = (s.byOperation[e.data.operationType] || 0) + 1;
      s.byAgent[e.data.parties.agentId] = (s.byAgent[e.data.parties.agentId] || 0) + 1;
    } else s.totalLogs++;
  }
  return s;
}

async function generateReport(periodFrom, periodTo) {
  const gateway = new RoleGatewayClient('auditor').connect();
  const store = new CorrelationStore();
  try {
    const indexed = await store.findEventsByPeriod(periodFrom, periodTo);
    const events = [];
    let orphans = 0;
    for (const row of indexed) {
      try {
        const evt = JSON.parse(await gateway.evaluate('getAttestedEvent', row.event_id));
        const payload = JSON.parse(evt.payload);
        events.push({ eventType: evt.eventType,
                      sigId: row.sig_id, data: payload.data });
      } catch (e) {
        if (isMissingLedgerRecord(e)) orphans++;   // index desynchronise du ledger
        else throw e;
      }
    }
    if (orphans > 0) {
      console.warn(`[audit] ${orphans} evenement(s) indexe(s) absent(s) du ledger (index desynchronise). Reconciliation manuelle requise; aucune reinitialisation n'a ete effectuee.`);
    }
    const alerts = await store.findAlertsForSigIds(events.map((e) => e.sigId));
    const stats = computeStats(events);

    const reportId = `RPT-${Date.now()}-${shortId()}`;
    const generatedAt = new Date().toISOString();
    const pdf = await buildReportPdf({ reportId, periodFrom, periodTo, stats, alerts, generatedAt });
    const reportHash = hashBuffer(pdf);

    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const pdfPath = path.join(REPORTS_DIR, `${reportId}.pdf`);
    fs.writeFileSync(pdfPath, pdf);

    // Ancrage du SEUL hash
    const { txId } = await gateway.submit('certifyReport', reportId, reportHash, periodFrom, periodTo);

    return { reportId, pdfPath, reportHash, blockchainTxId: txId, events: events.length, alerts: alerts.length };
  } finally {
    await store.close();
    gateway.close();
  }
}

async function verifyReport(reportId, filePath) {
  const gateway = new RoleGatewayClient('reader').connect();
  try {
    const fileHash = hashBuffer(fs.readFileSync(filePath));
    let cert;
    try { cert = JSON.parse(await gateway.evaluate('getReportCertification', reportId)); }
    catch (error) {
      if (isMissingLedgerRecord(error)) {
        return { status: 'UNKNOWN', message: 'Rapport non certifie ou introuvable' };
      }
      throw error;
    }
    return {
      status: fileHash === cert.reportHash ? 'VALID' : 'TAMPERED',
      reportId, anchoredHash: cert.reportHash, fileHash, certifiedAt: cert.certifiedAt,
    };
  } finally {
    gateway.close();
  }
}

async function verifyReportByHash(reportId, fileHash) {
  const gateway = new RoleGatewayClient('reader').connect();
  try {
    let cert;
    try { cert = JSON.parse(await gateway.evaluate('getReportCertification', reportId)); }
    catch (error) {
      if (isMissingLedgerRecord(error)) {
        return { status: 'UNKNOWN', message: 'Rapport non certifie ou introuvable' };
      }
      throw error;
    }
    return { status: fileHash === cert.reportHash ? 'VALID' : 'TAMPERED',
             reportId, anchoredHash: cert.reportHash, fileHash, certifiedAt: cert.certifiedAt };
  } finally { gateway.close(); }
}

async function getStats(periodFrom, periodTo) {
  const gateway = new RoleGatewayClient('reader').connect();
  const store = new CorrelationStore();
  try {
    const indexed = await store.findEventsByPeriod(periodFrom, periodTo);
    const events = [];
    let orphans = 0;
    for (const row of indexed) {
      try {
        const evt = JSON.parse(await gateway.evaluate('getAttestedEvent', row.event_id));
        const payload = JSON.parse(evt.payload);
        events.push({ eventType: evt.eventType,
                      sigId: row.sig_id, data: payload.data });
      } catch (e) {
        if (isMissingLedgerRecord(e)) orphans++;   // index desynchronise du ledger
        else throw e;
      }
    }
    if (orphans > 0) {
      console.warn(`[audit] ${orphans} evenement(s) indexe(s) absent(s) du ledger (index desynchronise). Reconciliation manuelle requise; aucune reinitialisation n'a ete effectuee.`);
    }
    const alerts = await store.findAlerts({});
    return { ...computeStats(events), totalAlerts: alerts.length,
             alertsBySeverity: alerts.reduce((a, x) => ((a[x.severity] = (a[x.severity] || 0) + 1), a), {}) };
  } finally { await store.close(); gateway.close(); }
}

module.exports = { generateReport, verifyReport, verifyReportByHash, getStats };