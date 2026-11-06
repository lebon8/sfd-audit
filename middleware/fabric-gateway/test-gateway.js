'use strict';

const { IdentityGatewayClient } = require('./identity-gateway');

const TEST_IDENTITIES = new Set(['writer', 'reader', 'auditor']);

class TestGatewayClient extends IdentityGatewayClient {
  constructor(identityName) {
    if (!TEST_IDENTITIES.has(identityName)) {
      throw new Error(`Identite de test inconnue : ${identityName}`);
    }
    const roleName = identityName.toUpperCase();
    const mspDirectory = process.env[`FABRIC_TEST_${roleName}_MSP_DIR`]
      || process.env[`FABRIC_IDENTITY_${roleName}_MSP_DIR`];
    super(identityName, mspDirectory);
  }
}

module.exports = { TestGatewayClient };
