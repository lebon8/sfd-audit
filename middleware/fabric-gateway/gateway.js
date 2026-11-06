'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');
const { getFabricConfig, newGrpcConnection } = require('./network');

const ORG_DOMAIN = 'org1.example.com';
const ORG_USER   = 'User1@org1.example.com';
const PEER       = 'peer0.org1.example.com';

const certDir = (config) => path.join(
  config.fabricNetworkDir, 'organizations/peerOrganizations', ORG_DOMAIN,
  'users', ORG_USER, 'msp/signcerts'
);
const keyDir = (config) => path.join(
  config.fabricNetworkDir, 'organizations/peerOrganizations', ORG_DOMAIN,
  'users', ORG_USER, 'msp/keystore'
);

function firstFile(dir) {
  const files = fs.readdirSync(dir);
  if (files.length === 0) throw new Error(`Aucun fichier dans ${dir}`);
  return path.join(dir, files[0]);
}

function newIdentity(config) {
  const credentials = fs.readFileSync(firstFile(certDir(config)));
  return { mspId: config.mspId, credentials };
}

function newSigner(config) {
  const privateKeyPem = fs.readFileSync(firstFile(keyDir(config)));
  return signers.newPrivateKeySigner(crypto.createPrivateKey(privateKeyPem));
}

class GatewayClient {
  connect() {
    const config = getFabricConfig();
    this.client = newGrpcConnection(config);
    this.gateway = connect({
      client: this.client,
      identity: newIdentity(config),
      signer: newSigner(config),
      hash: hash.sha256,
      evaluateOptions:     () => ({ deadline: Date.now() + 5000 }),
      endorseOptions:      () => ({ deadline: Date.now() + 15000 }),
      submitOptions:       () => ({ deadline: Date.now() + 5000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });
    this.contract = this.gateway.getNetwork(config.channel).getContract(config.chaincode);
    return this;
  }

  // Ecriture sur le ledger -> { txId, result }
  async submit(fn, ...args) {
    const commit = await this.contract.submitAsync(fn, { arguments: args });
    const result = Buffer.from(commit.getResult()).toString();
    const txId = commit.getTransactionId();
    const status = await commit.getStatus();
    if (!status.successful) throw new Error(`Transaction ${txId} non validee (code ${status.code})`);
    return { txId, result };
  }

  // Lecture seule
  async evaluate(fn, ...args) {
    const bytes = await this.contract.evaluateTransaction(fn, ...args);
    return Buffer.from(bytes).toString();
  }

  close() {
    this.gateway?.close();
    this.client?.close();
  }
}

module.exports = { GatewayClient };