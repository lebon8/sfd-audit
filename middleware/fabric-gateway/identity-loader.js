'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function findSingleFile(directory, description, predicate = () => true) {
  if (!fs.existsSync(directory)) throw new Error(`${description} introuvable : ${directory}`);
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(directory, entry.name));

  if (files.length !== 1) {
    throw new Error(`${description} : un seul fichier attendu dans ${directory}, ${files.length} trouve(s)`);
  }
  return files[0];
}

function loadMspIdentity(mspDirectory, mspId) {
  if (!mspDirectory) throw new Error('Repertoire MSP non configure');
  if (!mspId) throw new Error('MSP ID non configure');

  const certPath = findSingleFile(
    path.join(mspDirectory, 'signcerts'),
    'Certificat client',
    (name) => name.endsWith('.pem')
  );
  const keyPath = findSingleFile(
    path.join(mspDirectory, 'keystore'),
    'Cle privee cliente',
    (name) => !name.startsWith('.')
  );

  const certificatePem = fs.readFileSync(certPath);
  const privateKeyPem = fs.readFileSync(keyPath);
  const certificate = new crypto.X509Certificate(certificatePem);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const certificatePublicKey = certificate.publicKey.export({ type: 'spki', format: 'der' });
  const privateKeyPublicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });

  if (certificatePublicKey.length !== privateKeyPublicKey.length
      || !crypto.timingSafeEqual(certificatePublicKey, privateKeyPublicKey)) {
    throw new Error(`Le certificat et la cle privee ne correspondent pas dans ${mspDirectory}`);
  }

  return { identity: { mspId, credentials: certificatePem }, privateKey };
}

module.exports = { loadMspIdentity };
