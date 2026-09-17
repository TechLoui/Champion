'use strict';

/* Dados comerciais atuais têm prioridade sobre texto livre antigo. Não
   inventa preço, estoque, composição ou modo de uso ausente no cadastro. */
function normalizarApresentacao(apr) {
  const valor = Number(apr.precoNum);
  const valido = apr.precoNum != null && Number.isFinite(valor) && valor > 0;
  const disponivel = apr.disponivel === true;
  return {
    ...apr,
    preco: valido ? (apr.preco || valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })) : 'Sob consulta',
    precoNum: valido ? valor : null,
    sobConsulta: !valido,
    disponivel,
    compravel: valido && disponivel
  };
}

function rotuloUnico(node) {
  const nome = String(node.title || '');
  const parenteses = nome.match(/\(([^()]*(?:kg|ml|litros?|\bg\b)[^()]*)\)/i);
  if (parenteses) return parenteses[1].trim();
  const balde = nome.match(/balde\s+\d+(?:[.,]\d+)?\s*kg/i);
  if (balde) return balde[0];
  const rotulo = String(node.description || '').match(/Apresenta[çc][ãa]o\s*:\s*((?:Pote|Barrica|Caixa|Frasco|Balde)\s+(?:pl[aá]stic[oa]\s+)?(?:de\s+)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|litros?))/i);
  if (rotulo) return rotulo[1];
  /* O handle cadastrado só serve como fallback para um peso único explícito. */
  const peso = String(node.handle || '').match(/-(\d+)(?:-(\d))?-(kg|ml|l|g)$/i);
  if (peso && !/fardo|25x|25-x/.test(node.handle)) return `${peso[1]}${peso[2] ? ',' + peso[2] : ''} ${peso[3]}`;
  return 'Apresentação única';
}

function prepararProduto(produto) {
  return { ...produto, apresentacoes: (produto.apresentacoes || []).map(normalizarApresentacao) };
}

function fichaParaAgente(produto) {
  const atual = prepararProduto(produto);
  return {
    ...atual,
    avisos_cadastro: [
      ...(!produto.modo_de_uso ? ['Campo de modo de uso estruturado não preenchido; não invente nem adapte instruções.'] : []),
      'Para venda, use exclusivamente as apresentações, preços e disponibilidade estruturados atuais. A descrição livre pode conter embalagens antigas; divergências devem ser confirmadas pela equipe técnica.',
      ...(!atual.apresentacoes.some((a) => !a.sobConsulta) ? ['Preço sob consulta: não oferecer inclusão ao carrinho; encaminhar ao WhatsApp para confirmar valor.'] : [])
    ]
  };
}

module.exports = { normalizarApresentacao, prepararProduto, rotuloUnico, fichaParaAgente };
