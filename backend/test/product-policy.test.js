'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarApresentacao, rotuloUnico, fichaParaAgente } = require('../lib/product-policy');

for (const valor of [0, null, undefined, -10, NaN, Infinity, '']) {
  test(`preço inválido ${String(valor)} fica sob consulta mesmo com estoque`, () => {
    const a = normalizarApresentacao({ precoNum: valor, preco: 'R$ 0,00', disponivel: true });
    assert.equal(a.precoNum, null);
    assert.equal(a.preco, 'Sob consulta');
    assert.equal(a.sobConsulta, true);
    assert.equal(a.compravel, false);
  });
}
for (const estoque of [false, undefined, null]) {
  test(`estoque ${String(estoque)} nunca permite compra`, () => {
    assert.equal(normalizarApresentacao({ precoNum: 10, disponivel: estoque }).compravel, false);
  });
}
test('preço positivo e estoque confirmado permitem compra', () => {
  const a = normalizarApresentacao({ precoNum: '12.34', disponivel: true });
  assert.equal(a.precoNum, 12.34);
  assert.equal(a.compravel, true);
  assert.equal(a.sobConsulta, false);
});
test('apresentação única usa informação explícita, nunca inventa peso', () => {
  assert.equal(rotuloUnico({ title: 'ADE BALDE 20 Kg' }), 'BALDE 20 Kg');
  assert.equal(rotuloUnico({ title: 'ADE (4 Fardos de 25kg)' }), '4 Fardos de 25kg');
  assert.equal(rotuloUnico({ handle: 'nutribac-20-kg' }), '20 kg');
  assert.equal(rotuloUnico({ title: 'Protex' }), 'Apresentação única');
});
test('ficha não altera rótulo original e avisa sobre campos ausentes e embalagem', () => {
  const p = fichaParaAgente({ descricao: 'Rótulo original. Apresentação antiga.', apresentacoes: [{ precoNum: 0, disponivel: true }] });
  assert.equal(p.descricao, 'Rótulo original. Apresentação antiga.');
  assert.equal(p.modo_de_uso, undefined);
  assert.equal(p.avisos_cadastro.length, 3);
});
