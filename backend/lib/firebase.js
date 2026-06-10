'use strict';

/* Champion · Firebase Admin compartilhado
 * Inicialização preguiçosa (lazy). Aceita as credenciais de duas formas:
 *  1) Variáveis separadas: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *  2) JSON completo: FIREBASE_SERVICE_ACCOUNT
 * As variáveis separadas têm prioridade quando ambas existem.
 * Reutilizado pelas rotas (leads, checkout, webhook) para evitar dupla init. */

let _admin = null;

function buildCredential(admin) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      /* Nas env vars a chave vem com \n escapado — converte para quebras reais. */
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    });
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  }
  return null;
}

function getAdmin() {
  if (_admin) return _admin;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const credential = buildCredential(admin);
      if (!credential) return null;
      admin.initializeApp({ credential: credential });
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
