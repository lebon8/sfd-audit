'use strict';
const { GatewayClient } = require('../fabric-gateway/gateway');
const { CorrelationStore } = require('../db/correlation');

let gateway, store;
function getGateway() { if (!gateway) gateway = new GatewayClient().connect(); return gateway; }
function getStore()   { if (!store)   store   = new CorrelationStore();         return store; }
async function shutdown() { if (store) await store.close(); if (gateway) gateway.close(); }

module.exports = { getGateway, getStore, shutdown };