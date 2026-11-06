'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class AgnosticTrace extends Contract {

  // ---------- Helpers privés ----------

  _key(type, id) {
    // Espace de noms pour eviter les collisions de cles
    return `${type}:${id}`;
  }

  _now(ctx) {
    // Horodatage deterministe issu de la transaction (Date -> ISO 8601)
    return ctx.stub.getDateTimestamp().toISOString();
  }

  _computeBlockchainHash(payloadJson, sourceHash) {
    // Hash deterministe sur la chaine opaque + le hash source
    return crypto.createHash('sha256')
      .update(`${sourceHash}|${payloadJson}`, 'utf8')
      .digest('hex');
  }

  async _getOrNull(ctx, key) {
    const data = await ctx.stub.getState(key);
    return (data && data.length > 0) ? JSON.parse(data.toString()) : null;
  }

  _require(value, name) {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Argument requis manquant : ${name}`);
    }
  }

  _requireSha256(value, name) {
    this._require(value, name);
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
      throw new Error(`${name} doit etre une empreinte SHA-256 hexadecimale`);
    }
  }

  _parseJsonObject(value, name) {
    this._require(value, name);
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(`${name} doit etre un objet JSON valide`);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${name} doit etre un objet JSON valide`);
    }
    return parsed;
  }

  _requireRole(ctx, allowedRoles) {
    const clientIdentity = ctx?.clientIdentity;
    if (!clientIdentity
        || typeof clientIdentity.getMSPID !== 'function'
        || typeof clientIdentity.getAttributeValue !== 'function') {
      throw new Error('Acces refuse : identite cliente non reconnue');
    }

    const mspId = clientIdentity.getMSPID();
    if (mspId !== 'Org1MSP') {
      throw new Error(`Organisation non autorisée : ${mspId}`);
    }

    const role = clientIdentity.getAttributeValue('role');
    if (!role) {
      throw new Error('Accès refusé : aucun rôle attribué au certificat');
    }

    if (!allowedRoles.includes(role)) {
      throw new Error(`Accès refusé : rôle ${role} non autorisé`);
    }
  }

  // ---------- Evenements attestes ----------
  async createAttestedEvent(ctx, eventId, eventType, payloadJson, sourceHash) {
    this._requireRole(ctx, ['sfd_writer']);
    this._require(eventId, 'eventId');
    this._require(eventType, 'eventType');
    if (!['TRANSACTION', 'LOG', 'AUDIT', 'ALERT'].includes(eventType)) {
      throw new Error('eventType non autorise');
    }
    this._parseJsonObject(payloadJson, 'payloadJson');
    this._requireSha256(sourceHash, 'sourceHash');

    const key = this._key('event', eventId);
    if (await this._getOrNull(ctx, key)) {
      throw new Error(`L'evenement ${eventId} existe deja`);
    }

    const event = {
      docType: 'event',
      eventId,
      eventType,                 // TRANSACTION, LOG, AUDIT...
      payload: payloadJson,      // JSON stringifie, opaque pour la blockchain
      sourceHash,
      blockchainHash: this._computeBlockchainHash(payloadJson, sourceHash),
      timestamp: this._now(ctx),
      txId: ctx.stub.getTxID()
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(event)));
    return JSON.stringify(event);
  }

  async getAttestedEvent(ctx, eventId) {          // NOUVEAU (A1)
    this._requireRole(ctx, ['sfd_reader', 'sfd_auditor']);
    this._require(eventId, 'eventId');
    const event = await this._getOrNull(ctx, this._key('event', eventId));
    if (!event) {
      throw new Error(`Evenement ${eventId} introuvable`);
    }
    return JSON.stringify(event);
  }

  async verifyEventIntegrity(ctx, eventId, recomputedPayloadJson) {
    this._requireRole(ctx, ['sfd_reader', 'sfd_auditor']);
    this._require(eventId, 'eventId');
    this._parseJsonObject(recomputedPayloadJson, 'recomputedPayloadJson');

    const event = await this._getOrNull(ctx, this._key('event', eventId));
    if (!event) {
      throw new Error(`Evenement ${eventId} introuvable`);
    }

    const localHash = this._computeBlockchainHash(recomputedPayloadJson, event.sourceHash);
    return JSON.stringify({
      eventId,
      integrityStatus: localHash === event.blockchainHash ? 'VALID' : 'CORRUPTED',
      blockchainTimestamp: event.timestamp,
      currentVerificationTime: this._now(ctx)
    });
  }

  // ---------- Alertes d'audit ----------

  async createAuditAlert(ctx, alertId, ruleId, severity, relatedTxIdsJson, signature) {
    this._requireRole(ctx, ['sfd_auditor']);
    this._require(alertId, 'alertId');
    this._require(ruleId, 'ruleId');
    this._require(severity, 'severity');
    this._require(signature, 'signature');
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(severity)) {
      throw new Error('severity non autorisee');
    }

    const key = this._key('alert', alertId);
    if (await this._getOrNull(ctx, key)) {
      throw new Error(`L'alerte ${alertId} existe deja`);
    }

    let relatedTxIds;
    try {
      relatedTxIds = JSON.parse(relatedTxIdsJson);
    } catch {
      throw new Error('relatedTxIdsJson doit etre un tableau JSON valide');
    }
    if (!Array.isArray(relatedTxIds)
        || relatedTxIds.some((txId) => typeof txId !== 'string' || txId.trim() === '')) {
      throw new Error('relatedTxIdsJson doit contenir un tableau d identifiants non vides');
    }

    const alert = {
      docType: 'alert',
      alertId,
      ruleId,                    // R1..R5
      severity,                  // LOW | MEDIUM | HIGH
      relatedTxIds,
      signature,
      detectedAt: this._now(ctx)
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(alert)));
    return JSON.stringify(alert);
  }

  async getAuditAlert(ctx, alertId) {             // NOUVEAU (A1)
    this._requireRole(ctx, ['sfd_auditor']);
    this._require(alertId, 'alertId');
    const alert = await this._getOrNull(ctx, this._key('alert', alertId));
    if (!alert) {
      throw new Error(`Alerte ${alertId} introuvable`);
    }
    return JSON.stringify(alert);
  }

  // ---------- Certification de rapports ----------

  async certifyReport(ctx, reportId, reportHash, periodFrom, periodTo) {
    this._requireRole(ctx, ['sfd_auditor']);
    this._require(reportId, 'reportId');
    this._requireSha256(reportHash, 'reportHash');

    const key = this._key('report', reportId);
    if (await this._getOrNull(ctx, key)) {
      throw new Error(`Le rapport ${reportId} est deja certifie`);
    }

    // Seul le hash du rapport est ancre : le PDF ne transite jamais par la blockchain
    const certification = {
      docType: 'report',
      reportId,
      reportHash,
      periodFrom,
      periodTo,
      certifiedAt: this._now(ctx)
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(certification)));
    return JSON.stringify(certification);
  }

  async getReportCertification(ctx, reportId) {
    this._requireRole(ctx, ['sfd_reader', 'sfd_auditor']);
    this._require(reportId, 'reportId');
    const cert = await this._getOrNull(ctx, this._key('report', reportId));
    if (!cert) {
      throw new Error(`Rapport ${reportId} introuvable`);
    }
    return JSON.stringify(cert);
  }
}

module.exports = AgnosticTrace;
