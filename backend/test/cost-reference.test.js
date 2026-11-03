'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../lib/tools');
const flow = require('../lib/chat-flow');
const { buildSystemPrompt } = require('../lib/prompt');
const shopify = require('../lib/shopify');

test('agente recebe custos aprovados para 120 dias sem confundir suplemento com Difly', async () => {
  const { referencia: difly } = await tools.execute('consultar_custo_referencia', { handle: 'difly' });
  assert.equal(difly.preco_referencia_barrica_6kg_reais, 2400);
  assert.equal(difly.rendimento_referencia_animais, 833);
  assert.equal(difly.custo_por_cabeca_120_dias_reais, 2.88);
  assert.equal(difly.custo_por_cabeca_mes_30_dias_reais, 0.72);
  assert.equal(difly.custo_por_cabeca_dia_centavos, 2.4);
  assert.match(difly.consumo_referencia, /sal ou suplemento/);
  assert.match(difly.consumo_referencia, /não são 60 g de Difly/);

  const { referencia: s3 } = await tools.execute('consultar_custo_referencia', { handle: 'difly-s3' });
  assert.equal(s3.custo_por_cabeca_120_dias_reais, 26.4);
  assert.equal(s3.custo_por_cabeca_dia_centavos, 22);
  assert.equal(s3.custo_por_cabeca_dia_centavos * s3.periodo_dias / 100, s3.custo_por_cabeca_120_dias_reais);
});

test('pergunta de custo vai ao agente e referência não se estende a outros produtos', async () => {
  assert.equal(flow.ehConsultaSimples('Custo por cabeça do Difly em 120 dias?'), false);
  assert.ok(tools.definitions.some((d) => d.function.name === 'consultar_custo_referencia'));
  assert.match(buildSystemPrompt('pt'), /consultar_custo_referencia/);
  assert.match((await tools.execute('consultar_custo_referencia', { handle: 'ver-mi-sal' })).erro, /Não há custo/);
});

test('consulta inicial de custo por cabeça já entrega a simulação junto ao produto', async (t) => {
  t.mock.method(shopify, 'catalogo', async () => [
    { handle: 'difly', nome: 'Difly Mosca', apresentacoes: [] },
    { handle: 'difly-s3', nome: 'Difly S3', apresentacoes: [] }
  ]);
  const coletor = { vistos: [], cards: [], aproximados: [] };
  const resultado = await tools.consultarMencionados('Barrica Difly custa R$ 2.400. Quanto custa por cabeça em 120 dias?', coletor);
  assert.deepEqual(resultado.custos_referencia.map((c) => c.produto), ['Difly']);
  assert.equal(resultado.custos_referencia[0].custo_por_cabeca_120_dias_reais, 2.88);
  const soPreco = await tools.consultarMencionados('Qual o preço da barrica Difly?', coletor);
  assert.equal(soPreco.custos_referencia, undefined);
});
