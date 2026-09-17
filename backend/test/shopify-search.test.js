'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function produto(handle, title, description = '') {
  return {
    handle, title, description, availableForSale: true,
    featuredImage: { url: 'https://example.com/produto.jpg' },
    variants: { nodes: [{ id: 'gid://shopify/ProductVariant/1', title: '1 kg',
      availableForSale: true, price: { amount: '123.45' } }] }
  };
}

function novoCliente() {
  delete require.cache[require.resolve('../lib/shopify')];
  return require('../lib/shopify');
}

function mockStorefront(t, responder) {
  const chamadas = [];
  t.mock.method(global, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body);
    chamadas.push(request);
    return { ok: true, json: async () => ({ data: responder(request) }) };
  });
  return chamadas;
}

test('busca Vermisal no catálogo real sem depender da busca literal Shopify', async (t) => {
  const calls = mockStorefront(t, () => ({ products: {
    nodes: [produto('ver-mi-sal', 'Ver-Mi-Sal')], pageInfo: { hasNextPage: false }
  } }));
  const shopify = novoCliente();
  for (const termo of ['Vermisal', 'Vermi Sal', 'Quero saber mais sobre o Vermisal']) {
    const encontrados = await shopify.buscarProdutos(termo);
    assert.equal(encontrados[0].handle, 'ver-mi-sal');
    assert.equal(encontrados[0].foto, 'https://example.com/produto.jpg');
    assert.equal(encontrados[0].apresentacoes[0].precoNum, 123.45);
    assert.equal(encontrados[0].apresentacoes[0].variantId, 'gid://shopify/ProductVariant/1');
  }
  assert.equal(calls.length, 1, 'reaproveita o catálogo em cache');
  assert.match(calls[0].query, /ChampionCatalogo/);
});

test('catálogo é paginado e consultas simultâneas compartilham a carga', async (t) => {
  const calls = mockStorefront(t, ({ variables }) => ({ products: variables.after ? {
    nodes: [produto('ver-mi-sal', 'Ver-Mi-Sal')], pageInfo: { hasNextPage: false }
  } : {
    nodes: [produto('difly', 'Difly Mosca')], pageInfo: { hasNextPage: true, endCursor: 'pagina-2' }
  } }));
  const shopify = novoCliente();
  const resultados = await Promise.all([shopify.buscarProdutos('Vermisal'), shopify.buscarProdutos('Vermi Sal')]);
  assert.deepEqual(resultados.map((ps) => ps[0].handle), ['ver-mi-sal', 'ver-mi-sal']);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].variables.after, 'pagina-2');
});

test('busca por finalidade ainda consulta o índice Shopify', async (t) => {
  const calls = mockStorefront(t, ({ query }) => ({ products: {
    nodes: [produto('difly', 'Difly Mosca', 'Controle de parasitas')],
    pageInfo: { hasNextPage: false }
  } }));
  const resultado = await novoCliente().pesquisarProdutos('parasitas', 2);
  assert.equal(resultado.correspondencia, 'conteudo');
  assert.equal(resultado.produtos[0].handle, 'difly');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].variables.q, 'parasitas');
  assert.equal(calls[1].variables.first, 2);
});

test('aproximações são sugestões separadas e termos vazios listam o catálogo', async (t) => {
  const calls = mockStorefront(t, () => ({ products: {
    nodes: [produto('ver-mi-sal', 'Ver-Mi-Sal')], pageInfo: { hasNextPage: false }
  } }));
  const shopify = novoCliente();
  const aproximado = await shopify.pesquisarProdutos('Vermissal');
  assert.deepEqual(aproximado.produtos, []);
  assert.equal(aproximado.sugestoes[0].handle, 'ver-mi-sal');
  assert.equal((await shopify.buscarProdutos(''))[0].handle, 'ver-mi-sal');
  assert.equal(calls.length, 1);
});

test('falha de catálogo propaga erro em vez de afirmar produto inexistente', async (t) => {
  t.mock.method(global, 'fetch', async () => { throw new Error('consulta indisponível'); });
  await assert.rejects(novoCliente().buscarProdutos('Vermisal'), /consulta indisponível/);
});
