'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_DIR = path.join(__dirname, '..', 'keys');
const PRIV = path.join(KEY_DIR, 'middleware-ed25519-priv.pem');
const PUB  = path.join(KEY_DIR, 'middleware-ed25519-pub.pem');

function ensureKeys() {
  if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR, { recursive: true });
  if (!fs.existsSync(PRIV)) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(PRIV, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    fs.writeFileSync(PUB,  publicKey.export({ type: 'spki',  format: 'pem' }));
  }
}

function signAlert(canonicalString) {
  ensureKeys();
  const key = crypto.createPrivateKey(fs.readFileSync(PRIV));
  return crypto.sign(null, Buffer.from(canonicalString, 'utf8'), key).toString('hex');
}

function verifyAlert(canonicalString, signatureHex) {
  ensureKeys();
  const key = crypto.createPublicKey(fs.readFileSync(PUB));
  return crypto.verify(null, Buffer.from(canonicalString, 'utf8'), key, Buffer.from(signatureHex, 'hex'));
}

module.exports = { signAlert, verifyAlert };