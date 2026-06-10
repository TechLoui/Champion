'use strict';

/* Champion · Firebase Admin compartilhado
 * Inicialização preguiçosa (lazy) a partir de FIREBASE_SERVICE_ACCOUNT.
 * Reutilizado pelas rotas de checkout e webhook para evitar dupla init. */

let _admin = null;

function getAdmin() {
  if (_admin) return _admin;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    _admin = admin;
    return admin;
  } catch (err) {
    console.error('[firebase] init falhou:', err.message);
    return null;
  }
}

function getDb() {
  const admin = getAdmin();
  return admin ? admin.firestore() : null;
}

module.exports = { getAdmin, getDb };
