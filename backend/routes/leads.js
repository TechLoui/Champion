'use strict';

const express = require('express');
const router  = express.Router();

let db   = null;
let mail = null;

function getDb() {
  if (db) return db;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    db = admin.firestore();
    return db;
  } catch (err) {
    console.error('[leads] Firebase Admin init falhou:', err.message);
    return null;
  }
}

function getMail() {
  if (mail) return mail;
  if (!process.env.RESEND_API_KEY) return null;
  try {
    const { Resend } = require('resend');
    mail = new Resend(process.env.RESEND_API_KEY);
    return mail;
  } catch (err) {
    console.error('[leads] Resend init falhou:', err.message);
    return null;
  }
}

function sanitize(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml(lead) {
  const row = (label, value) =>
    value ? `<tr><td style="padding:6px 0;color:#687080;font-size:13px;min-width:90px;">${label}</td><td style="padding:6px 0;font-size:13px;color:#15191F;">${value}</td></tr>` : '';

  const name    = esc(lead.name);
  const email   = esc(lead.email);
  const phone   = esc(lead.phone);
  const source  = esc(lead.source);
  const message = esc(lead.message);

  return `<!doctype html>
<html lang="pt-br">
<head><meta charset="utf-8" /><title>Novo contato — Champion</title></head>
<body style="margin:0;padding:0;background:#F2F4F8;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E5E8EF;">
        <tr>
          <td style="background:linear-gradient(135deg,#EC4815,#C13808);padding:24px 32px;">
            <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,.65);">Champion Saúde Animal</p>
            <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#fff;">Novo contato recebido</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${row('Nome', name)}
              ${row('E-mail', email ? `<a href="mailto:${email}" style="color:#EC4815;">${email}</a>` : '')}
              ${row('Telefone', phone)}
              ${row('Origem', source)}
            </table>
            ${message ? `
            <div style="margin-top:20px;padding:16px;background:#F9FAFB;border-radius:10px;border:1px solid #E5E8EF;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9EA6B4;">Mensagem</p>
              <p style="margin:0;font-size:14px;color:#15191F;line-height:1.6;">${message}</p>
            </div>` : ''}
            <div style="margin-top:24px;">
              <a href="https://champion.ind.br/admin.html" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#EC4815,#C13808);color:#fff;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;">
                Abrir painel administrativo
              </a>
              ${email ? `<a href="mailto:${email}?subject=Champion%20—%20Retorno%20de%20contato" style="display:inline-block;margin-left:10px;padding:12px 24px;background:#fff;color:#15191F;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;border:1.5px solid #E5E8EF;">Responder</a>` : ''}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #F0F2F6;">
            <p style="margin:0;font-size:12px;color:#B0B8C6;">Enviado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · Champion Saúde Animal</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

router.post('/', async (req, res) => {
  const name    = sanitize(req.body?.name, 120);
  const email   = sanitize(req.body?.email, 200);
  const phone   = sanitize(req.body?.phone, 30);
  const message = sanitize(req.body?.message, 2000);
  const source  = sanitize(req.body?.source || 'Site', 80);

  if (!name) return res.status(422).json({ error: 'O campo nome é obrigatório.' });
  if (!email && !phone) return res.status(422).json({ error: 'Informe ao menos e-mail ou telefone.' });

  const lead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name, email, phone, message, source,
    status: 'open',
    createdAt: new Date().toISOString()
  };

  const firestore = getDb();
  const resend    = getMail();

  const [saveResult, emailResult] = await Promise.allSettled([
    firestore
      ? firestore.collection('adminLeads').doc(lead.id).set(lead)
      : Promise.resolve(null),
    resend && process.env.NOTIFICATION_EMAIL
      ? resend.emails.send({
          from: process.env.FROM_EMAIL || 'noreply@champion.ind.br',
          to: [process.env.NOTIFICATION_EMAIL],
          subject: `Novo contato: ${name}`,
          html: buildEmailHtml(lead)
        })
      : Promise.resolve(null)
  ]);

  if (saveResult.status === 'rejected') {
    console.error('[leads] Firestore save falhou:', saveResult.reason?.message);
  }
  if (emailResult.status === 'rejected') {
    console.error('[leads] Resend send falhou:', emailResult.reason?.message);
  }

  res.status(201).json({ ok: true, id: lead.id });
});

module.exports = router;
