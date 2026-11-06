'use strict';

const fs = require('fs');
const path = require('path');
const grpc = require('@grpc/grpc-js');

function getFabricConfig() {
  const fabricNetworkDir = process.env.FABRIC_TN;
  if (!fabricNetworkDir) throw new Error('Variable FABRIC_TN non definie dans .env');

  return {
    fabricNetworkDir,
    mspId: process.env.FABRIC_MSP_ID || 'Org1MSP',
    channel: process.env.FABRIC_CHANNEL || 'sfdchannel',
    chaincode: process.env.FABRIC_CHAINCODE || 'agnostictrace',
    peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
    peerHostAlias: process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.org1.example.com',
  };
}

function newGrpcConnection(config = getFabricConfig()) {
  const tlsCertPath = path.join(
    config.fabricNetworkDir,
    'organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt'
  );
  if (!fs.existsSync(tlsCertPath)) {
    throw new Error(`Certificat TLS du peer introuvable : ${tlsCertPath}`);
  }

  const tlsRootCert = fs.readFileSync(tlsCertPath);
  const credentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(config.peerEndpoint, credentials, {
    'grpc.ssl_target_name_override': config.peerHostAlias,
  });
}

module.exports = { getFabricConfig, newGrpcConnection };
