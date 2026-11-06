'use strict';

const { RoleGatewayClient } = require('../fabric-gateway/role-gateway');
const { TestGatewayClient } = require('../fabric-gateway/test-gateway');

describe('Sélection des identités Gateway par rôle', () => {
  const originalValues = {};

  beforeAll(() => {
    for (const role of ['WRITER', 'READER', 'AUDITOR']) {
      const key = `FABRIC_IDENTITY_${role}_MSP_DIR`;
      originalValues[key] = process.env[key];
      process.env[key] = `/tmp/identity-${role.toLowerCase()}/msp`;
    }
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test.each(['writer', 'reader', 'auditor'])('%s charge le MSP configuré pour ce rôle', (role) => {
    const client = new RoleGatewayClient(role);
    expect(client.identityName).toBe(role);
    expect(client.mspDirectory).toBe(`/tmp/identity-${role}/msp`);
  });

  test('le client de test peut réutiliser le MSP du rôle sans changer GatewayClient', () => {
    const client = new TestGatewayClient('writer');
    expect(client.mspDirectory).toBe('/tmp/identity-writer/msp');
  });

  test('refuse un rôle Gateway inconnu', () => {
    expect(() => new RoleGatewayClient('administrator')).toThrow('Role Gateway inconnu');
  });
});
