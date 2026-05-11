#!/usr/bin/env node
/* Champion · Seed admin no Firestore
 *
 * Cria o documento blogAdmins/{uid} com active:true para liberar
 * o login no painel administrativo e no painel do blog.
 *
 * Pré-requisitos:
 *   1. backend/service-account.json com a chave do Firebase Admin SDK
 *      (NÃO commitar — já está no .gitignore via backend/.gitignore)
 *   2. UID do usuário (Firebase Console → Authentication → Users → coluna UID)
 *
 * Uso:
 *   cd backend
 *   node scripts/seed-admin.js <UID> [email]
 *
 * Exemplos:
 *   node scripts/seed-admin.js XK4j9zTABCDEFGHIJ admin@champion.com.br
 *   node scripts/seed-admin.js XK4j9zTABCDEFGHIJ
 */

'use strict';

const path = require('path');
const fs = require('fs');

const uid = process.argv[2];
const email = process.argv[3] || 'admin@champion.com.br';

if (!uid) {
  console.error('\n❌ UID não informado.');
  console.error('   Uso: node scripts/seed-admin.js <UID> [email]\n');
  process.exit(1);
}

const saPath = path.resolve(__dirname, '..', 'service-account.json');
if (!fs.existsSync(saPath)) {
  console.error(`\n❌ service-account.json não encontrado em: ${saPath}`);
  console.error('   Baixe em Firebase Console → ⚙️ → Contas de serviço → "Gerar nova chave privada"');
  console.error('   E salve como backend/service-account.json (NÃO comita esse arquivo!)\n');
  process.exit(1);
}

const admin = require('firebase-admin');
const serviceAccount = require(saPath);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  try {
    const ref = db.collection('blogAdmins').doc(uid);
    await ref.set({
      active: true,
      email: email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`\n✅ Documento criado: blogAdmins/${uid}`);
    console.log(`   active: true`);
    console.log(`   email:  ${email}`);
    console.log(`\nO usuário já pode logar no painel admin e no painel do blog.\n`);
  } catch (err) {
    console.error('\n❌ Erro:', err.message, '\n');
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
