'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const shopify = require('../lib/shopify');
const flow = require('../lib/chat-flow');
const { buscarNoCatalogo } = require('../lib/product-search');
const p = { nome: 'Ver-Mi-Sal', handle: 'ver-mi-sal', resumo: 'Ver-Mi-Sal é um produto do catálogo. Apresentação antiga 1,100 kg.',
  apresentacoes: [{ apresentacao: 'Pote 1,110 kg', precoNum: 10, disponivel: false },
    { apresentacao: 'Balde 10 kg', precoNum: 100, disponivel: true }] };

test('consulta geral é breve, respeita estoque e não repete embalagem antiga', () => {
  const r = flow.consultaBreve({ produtos: [p], total: 1 }, 'pt');
  assert.match(r.resposta, /embalagem disponível abaixo/);
  assert.equal(r.cards[0].apresentacoes[0].compravel, false);
  assert.equal(r.cards[0].apresentacoes[1].compravel, true);
  assert.doesNotMatch(r.resposta, /1,100|dosagem/i);
  assert.ok(r.resposta.length < 400);
});
test('produto sem preço não convida a adicionar ao carrinho', () => {
  const r = flow.consultaBreve({ produtos: [{ ...p, apresentacoes: [{ apresentacao: 'Fardo', precoNum: 0, disponivel: true }] }] }, 'pt');
  assert.match(r.resposta, /Preço sob consulta/);
  assert.match(r.resposta, /wa.me/);
  assert.doesNotMatch(r.resposta, /quantidade|R\$ 0/);
});
test('consulta simples nunca captura pedido técnico, compra, comparação ou negação', () => {
  for (const texto of ['Quero saber mais sobre Vermisal', 'Me manda a foto do Vermisal']) assert.equal(flow.ehConsultaSimples(texto), true);
  for (const texto of ['Qual a dose do Vermisal?', 'Quero saber mais sobre composição do Vermisal', 'Não quero foto do Difly S3', 'Quero comprar Vermisal', 'Compare Difly e Difly S3']) assert.equal(flow.ehConsultaSimples(texto), false);
});
test('confirmação positiva resolve único nome e recusa não retorna produto', async (t) => {
  t.mock.method(shopify, 'catalogo', async () => [p]);
  const anterior = { role: 'assistant', content: flow.perguntaConfirmacao([p], 'pt').resposta };
  assert.equal((await flow.produtoConfirmado([anterior, { role: 'user', content: 'sim' }])).produtos[0].handle, p.handle);
  assert.deepEqual(flow.recusaConfirmacao([anterior, { role: 'user', content: 'não' }], 'pt').cards, []);
  assert.equal(await flow.produtoConfirmado([anterior, { role: 'user', content: 'não' }]), null);
});
test('catálogo de 21 itens aparece em seis páginas sem perdas ou duplicatas', async (t) => {
  const itens = Array.from({ length: 21 }, (_, i) => ({ ...p, handle: 'produto-' + i, nome: 'Produto ' + i }));
  t.mock.method(shopify, 'pesquisarProdutos', async (_q, size, offset) => ({ produtos: itens.slice(offset, offset + size), total: 21,
    proximo_offset: offset + size < 21 ? offset + size : null }));
  let history = [{ role: 'user', content: 'Me mostre todos os produtos do catálogo.' }];
  const vistos = [];
  for (let i = 0; i < 6; i++) {
    const r = await flow.catalogoDireto(history.at(-1).content, history, 'pt');
    assert.ok(r, 'reconhece pedido de catálogo e próximas páginas');
    assert.equal(r.catalogo.total, 21);
    vistos.push(...r.cards.map((p) => p.handle));
    history.push({ role: 'assistant', content: r.resposta }, { role: 'user', content: 'Mostrar mais produtos' });
    if (i === 5) assert.equal(r.catalogo.proximoOffset, null);
  }
  assert.equal(vistos.length, 21);
  assert.equal(new Set(vistos).size, 21);
});
test('mais sem contexto não presume uma listagem', async () => {
  assert.equal(await flow.catalogoDireto('mais', [{ role: 'user', content: 'mais' }], 'pt'), null);
});

test('produto conhecido responde sim explicitamente à dúvida sobre ausência', () => {
  assert.match(flow.consultaExistencia({ produtos: [p], total: 1 }, 'Ver-Mi-Sal não tem no catálogo?', 'pt').resposta, /^Sim, Ver-Mi-Sal está no catálogo/);
  assert.equal(flow.consultaExistencia({ produtos: [p] }, 'Não quero Ver-Mi-Sal', 'pt'), null);
  assert.equal(flow.consultaExistencia({ produtos: [p] }, 'Ver-Mi-Sal não tem contraindicação na gestação?', 'pt'), null);
  assert.equal(flow.ehConsultaSimples('Quero saber mais sobre Ver-Mi-Sal na gestação'), false);
});

test('código desconhecido não vira conselho para usar outra linha', () => {
  const r = flow.nomeComCodigoNaoLocalizado('Quero saber mais sobre Difly S2', 'pt');
  assert.deepEqual(r.cards, []);
  assert.match(r.resposta, /Não vou substituir/);
  assert.equal(flow.nomeComCodigoNaoLocalizado('Quero saber mais sobre controle de mosca', 'pt'), null);
});
test('Suino Nobre encontra palavra inteira compactada, não abre equivalência para suino genérico', () => {
  const ps = [{ nome: 'Farinha SUINONOBRE (4 Fardos de 25kg)', handle: 'farinha-suinonobre-fardo-25-x-1kg' }];
  assert.equal(buscarNoCatalogo('Suino Nobre', ps).produtos[0]?.handle, ps[0].handle);
  assert.notEqual(buscarNoCatalogo('Suino', ps).correspondencia, 'nome');
});
