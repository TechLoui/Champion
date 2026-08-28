'use strict';

/* Champion · Firebase Admin compartilhado
 * Inicialização preguiçosa (lazy). Aceita as credenciais de duas formas:
 *  1) Variáveis separadas: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *  2) JSON completo: FIREBASE_SERVICE_ACCOUNT
 * As variáveis separadas têm prioridade quando ambas existem.
 * Reutilizado pelas rotas (leads, checkout, webhook) para evitar dupla init. */

let _admin = null;

/* A mesma chave chega de jeitos diferentes conforme como foi colada no painel.
   Todas estas variações já apareceram e todas produzem o mesmo erro opaco do
   OpenSSL ("DECODER routines::unsupported"), que não diz qual é o problema:

     - aspas em volta do valor, que o painel guarda como parte do texto;
     - \n literal em vez de quebra de linha (o caso comum);
     - \\n, quando o valor já vinha escapado e o painel escapou de novo;
     - \r\n, de quem copiou de um editor do Windows;
     - o PEM inteiro em base64, de quem tentou fugir do problema da quebra.

   Normalizar é seguro: numa chave já correta nenhuma destas trocas encontra o
   que substituir. */
function normalizarChave(bruta) {
  let k = String(bruta || '').trim();
  if (!k) return '';

  /* Aspas em volta do valor inteiro. */
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }

  /* Escapado duas vezes antes de uma vez, senão a primeira troca consome a
     barra da segunda e sobra um "n" solto no meio da chave. */
  k = k.split('\\\\n').join('\n');
  k = k.split('\\n').join('\n');
  k = k.split('\r\n').join('\n');

  /* Sem cabeçalho PEM, a aposta é base64 do PEM inteiro. */
  if (!k.includes('BEGIN')) {
    try {
      const decodificada = Buffer.from(k, 'base64').toString('utf8');
      if (decodificada.includes('BEGIN')) k = decodificada;
    } catch (err) { /* não era base64: segue com o valor original */ }
  }

  /* O SDK exige a quebra final. */
  if (!k.endsWith('\n')) k += '\n';
  return k;
}

/* Falha cedo e com nome: o erro do OpenSSL não diz qual variável está errada. */
function conferirChave(k) {
  if (!k.includes('-----BEGIN') || !k.includes('PRIVATE KEY-----')) {
    console.error('[firebase] FIREBASE_PRIVATE_KEY não parece um PEM: falta o cabeçalho -----BEGIN PRIVATE KEY-----.');
    return false;
  }
  if (k.split('\n').length < 3) {
    console.error('[firebase] FIREBASE_PRIVATE_KEY veio numa linha só — as quebras de linha se perderam.');
    return false;
  }
  return true;
}

function buildCredential(admin) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const privateKey = normalizarChave(process.env.FIREBASE_PRIVATE_KEY);
    if (!conferirChave(privateKey)) return null;
    return admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey
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
      conta.private_key = normalizarChave(conta.private_key);
    }
    return admin.credential.cert(conta);
  }
  return null;
}

/* Tenta carregar a chave com o crypto do próprio Node. É a única forma de
   saber se o PEM em si está válido: se o crypto aceita e o Google recusa, o
   problema não é o formato da variável — é a conta de serviço (projeto errado,
   chave revogada, service account desativada).

   Devolve só medidas e a mensagem de erro. Nenhum pedaço da chave sai daqui. */
function diagnosticarChave() {
  const bruta = process.env.FIREBASE_PRIVATE_KEY
    || (process.env.FIREBASE_SERVICE_ACCOUNT && (() => {
      try { return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).private_key; }
      catch (err) { return ''; }
    })())
    || '';

  if (!bruta) return { presente: false };

  const k = normalizarChave(bruta);
  const info = {
    presente: true,
    origem: process.env.FIREBASE_PRIVATE_KEY ? 'FIREBASE_PRIVATE_KEY' : 'FIREBASE_SERVICE_ACCOUNT',
    tamanhoBruto: String(bruta).length,
    tamanhoNormalizado: k.length,
    linhas: k.split('\n').filter(Boolean).length,
    temCabecalho: k.includes('-----BEGIN'),
    temRodape: k.includes('-----END'),
    tipo: (k.match(/-----BEGIN ([A-Z ]+)-----/) || [])[1] || null,
    valida: false,
    erro: null
  };

  try {
    require('crypto').createPrivateKey(k);
    info.valida = true;
  } catch (err) {
    info.erro = String(err && err.message || err).slice(0, 160);
  }
  return info;
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

module.exports = { getAdmin, getDb , diagnosticarChave };
