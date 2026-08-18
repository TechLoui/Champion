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
    const conta = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    /* A quebra de linha da chave costuma chegar escapada duas vezes, porque
       o painel do Railway escapa de novo o que já vinha escapado no JSON.
       O JSON.parse então devolve a barra invertida literal em vez da quebra,
       o PEM fica inválido e o Admin SDK falha com "DECODER routines::
       unsupported" — que era exatamente o erro no log de produção.

       Normalizar aqui é inofensivo: numa chave já correta não sobra barra
       invertida literal para trocar. */
    if (typeof conta.private_key === 'string') {
      conta.private_key = conta.private_key.replace(/\\n/g, '\n');
    }
    return admin.credential.cert(conta);
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
