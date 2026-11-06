'use strict';
const { RoleGatewayClient } = require('../fabric-gateway/role-gateway');
const { CorrelationStore } = require('../db/correlation');

const gateways = new Map();
let store;
function getGateway(role) {
  if (!['writer', 'reader', 'auditor'].includes(role)) {
    throw new Error('Role Gateway requis ou inconnu');
  }
  if (!gateways.has(role)) gateways.set(role, new RoleGatewayClient(role).connect());
  return gateways.get(role);
}
function getStore()   { if (!store)   store   = new CorrelationStore();         return store; }
async function shutdown() {
  const activeGateways = [...gateways.values()];
  gateways.clear();
  try {
    if (store) await store.close();
  } finally {
    for (const gateway of activeGateways) gateway.close();
  }
}

module.exports = { getGateway, getStore, shutdown };