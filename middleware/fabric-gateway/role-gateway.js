'use strict';

const { IdentityGatewayClient } = require('./identity-gateway');

const ROLES = new Set(['writer', 'reader', 'auditor']);

class RoleGatewayClient extends IdentityGatewayClient {
  constructor(role) {
    if (!ROLES.has(role)) throw new Error(`Role Gateway inconnu : ${role}`);
    const mspDirectory = process.env[
      `FABRIC_IDENTITY_${role.toUpperCase()}_MSP_DIR`
    ];
    super(role, mspDirectory);
  }
}

module.exports = { RoleGatewayClient };
