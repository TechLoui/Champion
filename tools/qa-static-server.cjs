'use strict';
const express = require('../backend/node_modules/express');
const fs = require('node:fs');
const path = require('node:path');
const app = express();
app.get('/qa-reset', (_req, res) => res.send('<!doctype html><title>QA reset</title>'));
app.get('/qa-fixtures', async (_req, res, next) => {
  const saved = process.env.CHAMPION_QA_RESULTS || path.join(__dirname, '../output/qa-ia-20260917-refinamentos/resultados.json');
  if (!fs.existsSync(saved)) {
    try {
      const catalogo = await require('../backend/lib/shopify').catalogo();
      const consulta = require('../backend/lib/chat-flow').consultaBreve;
      const reply = handle => {
        const produto = catalogo.find(p => p.handle === handle);
        if (!produto) throw Error('Produto de referência não encontrado: ' + handle);
        const r = consulta({ produtos: [produto], total: 1 }, 'pt');
        return { resposta: r.resposta, produtos: r.cards, carrinho: [] };
      };
      return res.json({ vermisal: reply('ver-mi-sal'), difly: reply('difly') });
    } catch (err) { return next(err); }
  }
  const qa = JSON.parse(fs.readFileSync(saved, 'utf8'));
  res.json({ vermisal: (qa.results.find(r => r.name === 'Final: Vermisal') || qa.results.find(r => r.index === 43)).body,
    difly: (qa.results.find(r => r.name === 'Final: Difly Mosca: foto e três variantes') || qa.results.find(r => r.index === 5)).body });
});
app.use(express.static(path.join(__dirname, '../frontend')));
app.listen(5510, '127.0.0.1', () => console.log('QA-only static server http://127.0.0.1:5510'));
