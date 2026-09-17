'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizar, reconhecerProdutos, buscarNoCatalogo } = require('../lib/product-search');

const produtos = [
  { handle: 'ver-mi-sal', nome: 'Ver-Mi-Sal' },
  { handle: 'difly', nome: 'Difly Mosca Champion 6kg' },
  { handle: 'difly-s3', nome: 'Difly S3 Champion 6kg' },
  { handle: 'nucleo-supera', nome: 'Núcleo Supera (20 kg)' },
  { handle: 'nucleo-premium-tm-force', nome: 'Núcleo Premium TM Force (20 kg)' },
  { handle: 'protex-champion', nome: 'Protex' }
];
const handles = (ps) => ps.map((p) => p.handle);

test('normaliza acentos, caixa e pontuação sem apagar códigos', () => {
  assert.equal(normalizar('  NÚCLEO / Difly S3! '), 'nucleo difly s3');
});

test('todas as grafias de Vermisal e frases completas reconhecem o nome oficial', () => {
  for (const termo of ['Vermisal', 'Vermi Sal', 'Vermi-Sal', 'Ver-Mi-Sal', 'VERMISAL',
    'Quero saber mais sobre o Vermisal', 'Me manda a foto do Vermi-Sal',
    'I want to know more about Vermisal', 'Quiero saber más sobre Vermisal']) {
    const resultado = buscarNoCatalogo(termo, produtos);
    assert.deepEqual(handles(resultado.produtos), ['ver-mi-sal'], termo);
    assert.equal(resultado.correspondencia, 'nome');
  }
});

test('nomes dentro de frases não dependem da embalagem nem da marca Champion', () => {
  assert.deepEqual(handles(reconhecerProdutos('Quer o Difly S3?', produtos)), ['difly-s3']);
  assert.deepEqual(handles(reconhecerProdutos('Tem Nucleo Supera?', produtos)), ['nucleo-supera']);
});

test('Difly e Difly S3 são produtos diferentes e comparação reconhece os dois', () => {
  assert.deepEqual(handles(buscarNoCatalogo('difly', produtos).produtos), ['difly']);
  assert.deepEqual(handles(buscarNoCatalogo('difly s3', produtos).produtos), ['difly-s3']);
  assert.deepEqual(handles(reconhecerProdutos('Compare Difly e Difly S3', produtos)), ['difly', 'difly-s3']);
});

test('grafia aproximada e letras trocadas são sugestões, não produtos confirmados', () => {
  for (const [termo, handle] of [['Vermissal', 'ver-mi-sal'], ['Vermizal', 'ver-mi-sal'],
    ['Quero saber mais sobre o Vermissal', 'ver-mi-sal'], ['Dilfy', 'difly']]) {
    const resultado = buscarNoCatalogo(termo, produtos);
    assert.deepEqual(resultado.produtos, [], termo);
    assert.deepEqual(handles(resultado.sugestoes), [handle], termo);
    assert.equal(resultado.correspondencia, 'aproximada');
  }
});

test('nome parcial ambíguo preserva todas as linhas e um prefixo composto funciona', () => {
  assert.deepEqual(handles(buscarNoCatalogo('nucleo', produtos).produtos),
    ['nucleo-supera', 'nucleo-premium-tm-force']);
  assert.deepEqual(handles(buscarNoCatalogo('vermi', produtos).produtos), ['ver-mi-sal']);
});

test('não troca códigos, concentrações ou marca desconhecida por produto semelhante', () => {
  for (const termo of ['Difly S2', 'Difly S 2', 'Zzzinexistente', 'S3']) {
    const resultado = buscarNoCatalogo(termo, produtos);
    assert.deepEqual(resultado.produtos, [], termo);
    assert.deepEqual(resultado.sugestoes, [], termo);
  }
  const concentracoes = [
    { handle: 'produto-10', nome: 'Produto 10%' },
    { handle: 'produto-20', nome: 'Produto 20%' }
  ];
  assert.deepEqual(handles(buscarNoCatalogo('Produto 10%', concentracoes).produtos), ['produto-10']);
  for (const termo of ['Produto 30%', 'Produto 0,1%']) {
    assert.deepEqual(buscarNoCatalogo(termo, concentracoes).produtos, []);
    assert.deepEqual(buscarNoCatalogo(termo, concentracoes).sugestoes, []);
  }
});

test('não identifica produto por substring dentro de outra palavra', () => {
  for (const texto of ['preciso de proteção', 'antivermisal', 'vermisalxyz', 'protexto']) {
    assert.deepEqual(reconhecerProdutos(texto, produtos), [], texto);
  }
});

test('embalagens distintas continuam disponíveis sem escolher por conta própria', () => {
  const ade = [
    { handle: 'ade-po-1kg', nome: 'ADE (4 Fardos de 25kg)' },
    { handle: 'ade-balde-20-kg', nome: 'ADE BALDE 20 Kg' }
  ];
  assert.deepEqual(handles(buscarNoCatalogo('ADE', ade).produtos), ['ade-po-1kg', 'ade-balde-20-kg']);
  assert.deepEqual(reconhecerProdutos('qual a de maior tamanho?', ade), []);
});

test('limite pequeno não oculta que existem outras opções para um nome parcial', () => {
  const resultado = buscarNoCatalogo('nucleo', produtos, 1);
  assert.equal(resultado.produtos.length, 1);
  assert.equal(resultado.total, 2);
});
