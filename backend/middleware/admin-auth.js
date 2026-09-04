'use strict';

const { getAdmin, getDb } = require('../lib/firebase');

/*
 * As telas administrativas usam Firebase Auth no navegador. A API nunca
 * confia apenas no fato de o token ser valido: o usuario tambem precisa estar
 * na mesma whitelist (`blogAdmins`) que ja protege o restante do painel.
 */
async function requireAdmin(req, res, next) {
  const authorization = String(req.get('authorization') || '');
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);

  if (!match) {
    return res.status(401).json({
      error: 'Autenticacao administrativa obrigatoria.',
      code: 'ADMIN_AUTH_REQUIRED'
    });
  }
  if (match[1].length > 8192) {
    return res.status(401).json({
      error: 'Token administrativo invalido.',
      code: 'ADMIN_TOKEN_INVALID'
    });
  }

  const admin = getAdmin();
  const db = getDb();
  if (!admin || !db) {
    return res.status(503).json({
      error: 'Firebase Admin nao esta configurado no servidor.',
      code: 'FIREBASE_NOT_CONFIGURED'
    });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (err) {
    const expired = err?.code === 'auth/id-token-expired';
    return res.status(401).json({
      error: expired ? 'Sessao administrativa expirada.' : 'Token administrativo invalido.',
      code: expired ? 'ADMIN_TOKEN_EXPIRED' : 'ADMIN_TOKEN_INVALID'
    });
  }

  try {
    const permission = await db.collection('blogAdmins').doc(decoded.uid).get();

    if (!permission.exists || permission.data()?.active !== true) {
      return res.status(403).json({
        error: 'Usuario sem permissao de administrador.',
        code: 'ADMIN_FORBIDDEN'
      });
    }

    req.adminUser = {
      uid: decoded.uid,
      email: decoded.email || permission.data()?.email || null
    };
    return next();
  } catch (err) {
    console.error('[admin-auth] Falha ao consultar permissoes:', err?.message || err);
    return res.status(503).json({
      error: 'Nao foi possivel validar a permissao administrativa agora.',
      code: 'ADMIN_PERMISSION_UNAVAILABLE'
    });
  }
}

module.exports = { requireAdmin };
