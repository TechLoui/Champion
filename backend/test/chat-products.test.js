'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shopify = require('../lib/shopify');
const tools = require('../lib/tools');
const { buscarNoCatalogo } = require('../lib/product-search');

const produtos = [
  { handle: 'ver-mi-sal', nome: 'Ver-Mi-Sal', resumo: 'Resumo do catálogo',
    foto: 'https://example.com/vermisal.jpg', url: 'https://example.com/produto?p=ver-mi-sal',
    apresentacoes: [{ variantId: 'gid://shopify/ProductVariant/1', apresentacao: '1 kg', precoNum: 10 }] },
  { handle: 'difly', nome: 'Difly Mosca Champion 6kg' },
  { handle: 'difly-s3', nome: 'Difly S3 Champion 6kg' },
  { handle: 'nucleo-supera', nome: 'Núcleo Supera (20 kg)' },
  { handle: 'nucleo-premium', nome: 'Núcleo Premium TM Force (20 kg)' }
];
const coletor = () => ({ cards: [], vistos: [], carrinho: [] });

function mockCatalogo(t) {
  t.mock.method(shopify, 'catalogo', async () => produtos);
  t.mock.method(shopify, 'pesquisarProdutos', async (termo, limite) => buscarNoCatalogo(termo, produtos, limite));
  t.mock.method(shopify, 'detalhesProduto', async (handle) => {
    const p = produtos.find((p) => p.handle === handle);
    return p ? { ...p, descricao: 'Ficha completa', modo_de_uso: 'Texto exato do rótulo' } : null;
  });
}

test('buscar e mostrar recuperam Vermisal como card estruturado com foto e variantes', async (t) => {
  mockCatalogo(t);
  const dados = coletor();
  const busca = await tools.execute('buscar_produtos', { termo: 'Vermisal' }, dados);
  assert.equal(busca.produtos[0].handle, 'ver-mi-sal');
  const mostrar = await tools.execute('mostrar_produtos', { handles: ['Vermisal'] }, dados);
  assert.deepEqual(mostrar.exibidos, ['Ver-Mi-Sal']);
  assert.equal(dados.cards[0].foto, produtos[0].foto);
  assert.deepEqual(dados.cards[0].apresentacoes, produtos[0].apresentacoes);
  assert.deepEqual(dados.carrinho, []);
});

test('ficha resolve grafia alternativa e mantém o modo de uso da fonte', async (t) => {
  mockCatalogo(t);
  const resultado = await tools.execute('detalhes_produto', { handle: 'Vermisal' }, coletor());
  assert.equal(resultado.produto.handle, 'ver-mi-sal');
  assert.equal(resultado.produto.modo_de_uso, 'Texto exato do rótulo');
});

test('handle curto não seleciona Difly S3 só por ser substring do cache', async (t) => {
  mockCatalogo(t);
  const dados = coletor();
  dados.vistos.push(produtos[2]);
  const resultado = await tools.execute('mostrar_produtos', { handles: ['difly'] }, dados);
  assert.deepEqual(resultado.exibidos, ['Difly Mosca Champion 6kg']);
  assert.equal(dados.cards[0].handle, 'difly');
});

test('handle ambíguo não escolhe a primeira linha do catálogo', async (t) => {
  mockCatalogo(t);
  const dados = coletor();
  dados.vistos.push(produtos[3]);
  const resultado = await tools.execute('mostrar_produtos', { handles: ['nucleo'] }, dados);
  assert.ok(resultado.erro);
  assert.equal(resultado.sugestoes.length, 2);
  assert.deepEqual(dados.cards, []);
});

test('sugestão aproximada exige confirmação e não gera card ou carrinho automático', async (t) => {
  mockCatalogo(t);
  const dados = coletor();
  const resultado = await tools.execute('buscar_produtos', { termo: 'Vermissal' }, dados);
  assert.equal(resultado.sugestoes[0].handle, 'ver-mi-sal');
  assert.match(resultado.instrucao, /Pergunte/);
  assert.deepEqual(dados.vistos, []);
  assert.deepEqual(dados.cards, []);
  assert.deepEqual(dados.carrinho, []);
});

test('rede de segurança dos cards reconhece grafias e ignora peso, sem misturar linhas', () => {
  assert.equal(tools.cardsPorMencao('Conheça o Vermisal.', produtos)[0].handle, 'ver-mi-sal');
  assert.deepEqual(tools.cardsPorMencao('Conheça o Difly S3.', produtos).map((p) => p.handle), ['difly-s3']);
  assert.deepEqual(tools.cardsPorMencao('proteção e cuidado', produtos), []);
});

test('pedido explícito conserva o card mesmo sem repetir o nome na resposta', async (t) => {
  mockCatalogo(t);
  const dados = coletor();
  await tools.consultarMencionados('Quero saber mais sobre o Vermisal', dados);
  const cards = await tools.resolverCards('Vou mostrar as apresentações. Quer mais detalhes?', dados);
  assert.equal(cards[0].handle, 'ver-mi-sal');
});

test('menção negativa e aproximação não ativam cards automáticos do pedido', async (t) => {
  mockCatalogo(t);
  for (const texto of ['Não quero Vermisal', "I don't want Vermisal", 'No quiero Vermisal',
    'Quero saber mais sobre Vermissal']) {
    const dados = coletor();
    await tools.consultarMencionados(texto, dados);
    assert.deepEqual(await tools.resolverCards('Qual produto você quer?', dados), []);
  }
});

test('preposição no em português não impede o card de um pedido positivo', async (t) => {
  mockCatalogo(t);
  const dados = coletor();
  await tools.consultarMencionados('Quero ver Vermisal no site', dados);
  assert.equal((await tools.resolverCards('Vou mostrar as apresentações.', dados))[0].handle, 'ver-mi-sal');
});

test('falha de ferramenta é distinta de busca sem correspondência', async (t) => {
  t.mock.method(shopify, 'pesquisarProdutos', async () => { throw new Error('Serviço indisponível'); });
  const resultado = await tools.execute('buscar_produtos', { termo: 'Vermisal' }, coletor());
  assert.equal(resultado.erro, 'Serviço indisponível');
  assert.equal(resultado.produtos, undefined);
});

function mockModelo(t, respostas) {
  const anterior = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = 'chave-apenas-para-teste';
  delete require.cache[require.resolve('../lib/deepseek')];
  t.after(() => {
    if (anterior === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = anterior;
    delete require.cache[require.resolve('../lib/deepseek')];
  });
  const requests = [];
  t.mock.method(global, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const message = respostas.shift();
    assert.ok(message, 'modelo recebeu mais chamadas que o esperado');
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 10, completion_tokens: 5 } }) };
  });
  return { llm: require('../lib/deepseek'), requests };
}

test('turno completo consulta nome antes do modelo e envia o card sem depender da ferramenta visual', async (t) => {
  mockCatalogo(t);
  const { llm, requests } = mockModelo(t, [{ role: 'assistant', content: 'Vou mostrar as apresentações. Quer mais detalhes?' }]);
  const resultado = await llm.responder([{ role: 'user', content: 'Quero saber mais sobre o Vermisal' }], 'pt');
  const consulta = requests[0].messages.find((m) => m.role === 'tool');
  assert.equal(JSON.parse(consulta.content).produtos[0].handle, 'ver-mi-sal');
  assert.equal(resultado.cards[0].foto, produtos[0].foto);
  assert.deepEqual(resultado.carrinho, []);
  assert.deepEqual(resultado.ferramentas, ['buscar_produtos']);
  assert.equal(resultado.usage.prompt_tokens, 10);
});

test('turno completo mantém busca, ficha e mostrar_produtos integrados', async (t) => {
  mockCatalogo(t);
  const { llm } = mockModelo(t, [
    { role: 'assistant', content: null, tool_calls: [
      { id: 'ficha', type: 'function', function: { name: 'detalhes_produto', arguments: '{"handle":"ver-mi-sal"}' } },
      { id: 'foto', type: 'function', function: { name: 'mostrar_produtos', arguments: '{"handles":["ver-mi-sal"]}' } }
    ] },
    { role: 'assistant', content: 'Aqui está o Ver-Mi-Sal. Quer conhecer as apresentações?' }
  ]);
  const resultado = await llm.responder([{ role: 'user', content: 'Quero saber mais sobre o Vermisal' }], 'pt');
  assert.equal(resultado.cards.length, 1);
  assert.equal(resultado.cards[0].handle, 'ver-mi-sal');
  assert.deepEqual(resultado.ferramentas, ['buscar_produtos', 'detalhes_produto', 'mostrar_produtos']);
});

test('aproximação na mensagem inicial chega ao modelo como sugestão para confirmar', async (t) => {
  mockCatalogo(t);
  const { llm, requests } = mockModelo(t, [{ role: 'assistant', content: 'Você quis dizer Ver-Mi-Sal?' }]);
  const resultado = await llm.responder([{ role: 'user', content: 'Quero saber mais sobre o Vermissal' }], 'pt');
  const consulta = JSON.parse(requests[0].messages.find((m) => m.role === 'tool').content);
  assert.deepEqual(consulta.produtos, []);
  assert.equal(consulta.sugestoes[0].handle, 'ver-mi-sal');
  assert.deepEqual(resultado.cards, []);
  assert.deepEqual(resultado.carrinho, []);
});
