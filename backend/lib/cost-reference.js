'use strict';

/* Estimativas comerciais aprovadas para a campanha da home em 30/10/2026.
   São referências de custo por animal, não preços de venda do Shopify nem
   instruções de dose. Não extrapolar para outro período ou mistura. */
const REFERENCIAS = Object.freeze({
  difly: Object.freeze({
    produto: 'Difly',
    periodo_dias: 120,
    preco_referencia_barrica_6kg_reais: 2400,
    rendimento_referencia_animais: 833,
    custo_por_cabeca_120_dias_reais: 2.88,
    custo_por_cabeca_mes_30_dias_reais: 0.72,
    custo_por_cabeca_dia_centavos: 2.4,
    consumo_referencia: 'Exemplo de 60 g de sal ou suplemento por animal ao dia no cocho; não são 60 g de Difly.',
    observacao: 'Simulação arredondada. O preço atual pode variar. A proporção de Difly na mistura deve seguir o rótulo e a orientação técnica.'
  }),
  'difly-s3': Object.freeze({
    produto: 'Difly S3',
    periodo_dias: 120,
    custo_por_cabeca_120_dias_reais: 26.40,
    custo_por_cabeca_dia_centavos: 22,
    observacao: 'Estimativa comercial para 120 dias, não é o preço de uma embalagem. Confira o preço atual e siga o rótulo para o uso.'
  })
});

function consultarCustoReferencia(handle) {
  const chave = String(handle || '').trim().toLowerCase();
  if (!Object.hasOwn(REFERENCIAS, chave)) {
    return { erro: 'Não há custo de referência aprovado para esse produto.',
      instrucao: 'Não calcule por analogia com Difly ou Difly S3. Consulte preço e ficha atuais e encaminhe dúvidas de consumo à equipe técnica.' };
  }
  return { referencia: REFERENCIAS[chave],
    instrucao: 'Apresente como simulação de custo por cabeça no período indicado. Não confunda com preço atual da embalagem ou recomendação de dose; não extrapole para outro período.' };
}

module.exports = { consultarCustoReferencia };
