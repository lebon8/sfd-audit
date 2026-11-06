'use strict';

const { connect, signers, hash } = require('@hyperledger/fabric-gateway');
const { getFabricConfig, newGrpcConnection } = require('./network');
const { loadMspIdentity } = require('./identity-loader');

class IdentityGatewayClient {
  constructor(identityName, mspDirectory) {
    this.identityName = identityName;
    this.mspDirectory = mspDirectory;
  }

  connect() {
    const config = getFabricConfig();
    const { identity, privateKey } = loadMspIdentity(this.mspDirectory, config.mspId);

    this.client = newGrpcConnection(config);
    this.gateway = connect({
      client: this.client,
      identity,
      signer: signers.newPrivateKeySigner(privateKey),
      hash: hash.sha256,
      evaluateOptions:     () => ({ deadline: Date.now() + 5000 }),
      endorseOptions:      () => ({ deadline: Date.now() + 15000 }),
      submitOptions:       () => ({ deadline: Date.now() + 5000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });
    this.contract = this.gateway.getNetwork(config.channel).getContract(config.chaincode);
    return this;
  }

  async submit(fn, ...args) {
    const commit = await this.contract.submitAsync(fn, { arguments: args });
    const result = Buffer.from(commit.getResult()).toString();
    const txId = commit.getTransactionId();
    const status = await commit.getStatus();
    if (!status.successful) throw new Error(`Transaction ${txId} non validee (code ${status.code})`);
    return { txId, result };
  }

  async evaluate(fn, ...args) {
    const bytes = await this.contract.evaluateTransaction(fn, ...args);
    return Buffer.from(bytes).toString();
  }

  close() {
    this.gateway?.close();
    this.client?.close();
  }
}

module.exports = { IdentityGatewayClient };
