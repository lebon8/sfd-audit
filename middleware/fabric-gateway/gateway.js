'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');

const TN              = process.env.FABRIC_TN;
const MSP_ID          = process.env.FABRIC_MSP_ID          || 'Org1MSP';
const CHANNEL         = process.env.FABRIC_CHANNEL         || 'sfdchannel';
const CHAINCODE       = process.env.FABRIC_CHAINCODE       || 'agnostictrace';
const PEER_ENDPOINT   = process.env.FABRIC_PEER_ENDPOINT   || 'localhost:7051';
const PEER_HOST_ALIAS = process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.org1.example.com';

const ORG_DOMAIN = 'org1.example.com';
const ORG_USER   = 'User1@org1.example.com';
const PEER       = 'peer0.org1.example.com';

const tlsCertPath = () => path.join(TN, 'organizations/peerOrganizations', ORG_DOMAIN, 'peers', PEER, 'tls/ca.crt');
const certDir     = () => path.join(TN, 'organizations/peerOrganizations', ORG_DOMAIN, 'users', ORG_USER, 'msp/signcerts');
const keyDir      = () => path.join(TN, 'organizations/peerOrganizations', ORG_DOMAIN, 'users', ORG_USER, 'msp/keystore');

function firstFile(dir) {
  const files = fs.readdirSync(dir);
  if (files.length === 0) throw new Error(`Aucun fichier dans ${dir}`);
  return path.join(dir, files[0]);
}

function newGrpcConnection() {
  const tlsRootCert = fs.readFileSync(tlsCertPath());
  const creds = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(PEER_ENDPOINT, creds, { 'grpc.ssl_target_name_override': PEER_HOST_ALIAS });
}

function newIdentity() {
  const credentials = fs.readFileSync(firstFile(certDir()));
  return { mspId: MSP_ID, credentials };
}

function newSigner() {
  const privateKeyPem = fs.readFileSync(firstFile(keyDir()));
  return signers.newPrivateKeySigner(crypto.createPrivateKey(privateKeyPem));
}

class GatewayClient {
  connect() {
    if (!TN) throw new Error('Variable FABRIC_TN non definie dans .env');
    this.client = newGrpcConnection();
    this.gateway = connect({
      client: this.client,
      identity: newIdentity(),
      signer: newSigner(),
      hash: hash.sha256,
      evaluateOptions:     () => ({ deadline: Date.now() + 5000 }),
      endorseOptions:      () => ({ deadline: Date.now() + 15000 }),
      submitOptions:       () => ({ deadline: Date.now() + 5000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });
    this.contract = this.gateway.getNetwork(CHANNEL).getContract(CHAINCODE);
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