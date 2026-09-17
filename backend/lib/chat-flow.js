'use strict';

const shopify = require('./shopify');
const { normalizar, reconhecerProdutos } = require('./product-search');
const { prepararProduto } = require('./product-policy');
const WHATSAPP = 'https://wa.me/556240150742';

function idiomaDoCliente(texto, idioma) {
  const t = normalizar(texto);
  if (/\b(quero|voce|voces|gostaria|embalagens|nao|catalogo completo)\b|me manda/.test(t)) return 'pt';
  if (/\b(quiero|quisiera|ustedes|tienen|muestra|envia)\b/.test(t)) return 'es';
  if (/\b(want|would|please|show|send|available|yes)\b/.test(t)) return 'en';
  return ['pt', 'en', 'es'].includes(idioma) ? idioma : 'pt';
}

function resultado(resposta, cards = [], extra = {}) {
  return { resposta, cards: cards.map(prepararProduto), carrinho: [], ferramentas: ['buscar_produtos'],
    usage: { prompt_tokens: 0, completion_tokens: 0 }, ...extra };
}

function perguntaConfirmacao(sugestoes, idioma) {
  const nomes = sugestoes.slice(0, 4).map((p) => p.nome).join(idioma === 'en' ? ' or ' : idioma === 'es' ? ' o ' : ' ou ');
  return resultado({
    pt: `Você quis dizer ${nomes}? Confirme o nome para eu mostrar o produto correto.`,
    en: `Did you mean ${nomes}? Please confirm the name so I can show the correct product.`,
    es: `¿Quisiste decir ${nomes}? Confirma el nombre para mostrarte el producto correcto.`
  }[idioma]);
}

function ehConsultaSimples(texto) {
  const t = normalizar(texto);
  if (/\b(dose|dosagem|aplicar|aplicacao|composicao|concentracao|modo|mistur|tratamento|doente|sintoma|prenhe|gestante|gestacao|gravid|pregnan|seguran|safe|contraindic|bezerro|comparar|compare|difference|composition|dosage|dosis|usar|uso|use|calcular|quantos|quantas|preco|price|precio|custa|adicion|coloc|comprar|buy|add|cart|carrinho)\w*/.test(t)) return false;
  if (/\b(nao|not|dont|don t)\b|\bno quiero\b/.test(t)) return false;
  return /\b(foto|photo|picture|image|imagem)\b/.test(t) ||
    /^(?:quero|gostaria de|queria|i want to|quiero) (?:saber mais|conhecer|know more|saber mas)/.test(t);
}

function descricaoBreve(produto) {
  const texto = String(produto.resumo || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const informacao = texto.split(/Apresenta[çc]|Modo de us[oa]r?|Dosagem|Posologia/i)[0];
  const primeira = informacao.match(/^.*?[.!?](?:\s|(?=[A-ZÀ-Ý])|$)/)?.[0].trim() || informacao;
  if (primeira.length <= 180) return primeira;
  const fim = primeira.slice(0, 176).lastIndexOf(' ');
  return primeira.slice(0, Math.max(fim, 120)).replace(/[ ,;:]$/, '') + '…';
}

function consultaBreve(consulta, idioma) {
  if (consulta.produtos.length !== 1 || (consulta.total || 1) > 1) return null;
  const p = prepararProduto(consulta.produtos[0]);
  const vendaveis = p.apresentacoes.filter((a) => a.compravel);
  const esgotadas = p.apresentacoes.filter((a) => !a.disponivel);
  const sobConsulta = p.apresentacoes.filter((a) => a.sobConsulta);
  const nomes = vendaveis.map((a) => a.apresentacao).join(', ');
  const semEstoque = esgotadas.map((a) => a.apresentacao).join(', ');
  const partes = [idioma === 'pt' ? (descricaoBreve(p) || p.nome) : p.nome];
  if (vendaveis.length) partes.push({ pt: `Disponível: ${nomes}.`, en: `Available: ${nomes}.`, es: `Disponible: ${nomes}.` }[idioma]);
  if (esgotadas.length) partes.push({ pt: `Sem estoque: ${semEstoque}.`, en: `Out of stock: ${semEstoque}.`, es: `Agotado: ${semEstoque}.` }[idioma]);
  if (sobConsulta.length) partes.push({ pt: `Preço sob consulta. Confirme o valor com a equipe: ${WHATSAPP}.`, en: `Price on request. Contact the team: ${WHATSAPP}.`, es: `Precio a consultar. Contacta al equipo: ${WHATSAPP}.` }[idioma]);
  else if (vendaveis.length) partes.push({ pt: 'Quer escolher uma dessas apresentações e a quantidade?', en: 'Which available size and quantity would you like?', es: '¿Qué presentación disponible y cantidad prefieres?' }[idioma]);
  else partes.push({ pt: `Consulte a equipe para reposição: ${WHATSAPP}.`, en: `Ask the team about restocking: ${WHATSAPP}.`, es: `Consulta la reposición con el equipo: ${WHATSAPP}.` }[idioma]);
  return resultado(partes.join('\n\n'), [p]);
}

function offsetDoHistorico(historico) {
  const ultima = [...historico].reverse().find((m) => m.role === 'assistant');
  const trecho = normalizar(ultima?.content || '').match(/(?:mostrando produtos|showing products|mostrando productos) \d+ (?:a|to) (\d+) (?:de|of) \d+/);
  return trecho ? Number(trecho[1]) : null;
}

async function catalogoDireto(texto, historico, idioma, offsetSolicitado) {
  const t = normalizar(texto);
  const inicial = /^(?:me )?(?:mostre|mostra|mostrar|ver|liste|listar|show|see|muestra|mostrarme) (?:(?:todos?|all) (?:os |the |los )?)?(?:os |the |los )?(?:produtos|products|productos)(?: do catalogo| del catalogo)?$/.test(t) ||
    /^(?:quero (?:ver|conhecer) )?(?:o )?catalogo(?: completo)?$/.test(t);
  const mais = /^(?:mostrar|mostre|ver|quero ver|show|see|muestra)?\s*(?:mais|more|mas)(?: (?:produtos|products|productos)(?: do catalogo)?)?$/.test(t);
  if (!inicial && !mais) return null;
  const anterior = offsetDoHistorico(historico.slice(0, -1));
  if (mais && offsetSolicitado == null && anterior == null) return null;
  const offset = inicial ? 0 : Math.max(0, Math.trunc(Number(offsetSolicitado ?? anterior)) || 0);
  const pagina = await shopify.pesquisarProdutos('', 4, offset);
  const total = pagina.total;
  const de = pagina.produtos.length ? offset + 1 : 0;
  const ate = Math.min(offset + pagina.produtos.length, total);
  const continua = pagina.proximo_offset != null;
  const resposta = pagina.produtos.length ? {
    pt: `Temos ${total} produtos no catálogo. Mostrando produtos ${de} a ${ate} de ${total}.${continua ? ' Quer ver os próximos?' : ' Estes são os últimos. Qual produto você quer conhecer?'}`,
    en: `There are ${total} products in the catalog. Showing products ${de} to ${ate} of ${total}.${continua ? ' Would you like to see the next ones?' : ' These are the last ones. Which product interests you?'}`,
    es: `Tenemos ${total} productos en el catálogo. Mostrando productos ${de} a ${ate} de ${total}.${continua ? ' ¿Quieres ver los siguientes?' : ' Estos son los últimos. ¿Qué producto te interesa?'}`
  }[idioma] : { pt: 'Não há mais produtos nesta listagem. Qual produto você quer conhecer?', en: 'There are no more products in this list. Which product interests you?', es: 'No hay más productos en esta lista. ¿Cuál te interesa?' }[idioma];
  return resultado(resposta, pagina.produtos, { catalogo: { total, de, ate, proximoOffset: pagina.proximo_offset } });
}

async function produtoConfirmado(historico) {
  const texto = normalizar(historico.at(-1)?.content || '');
  if (!/^(sim|isso|isso mesmo|sim isso mesmo|pode mostrar|yes|yes please|si|si correcto)$/.test(texto)) return null;
  const ultima = historico.at(-2);
  if (ultima?.role !== 'assistant' || !/Você quis dizer|Did you mean|Quisiste decir/i.test(ultima.content)) return null;
  const ps = reconhecerProdutos(ultima.content, await shopify.catalogo());
  return ps.length === 1 ? { produtos: ps, total: 1, correspondencia: 'nome', sugestoes: [] }
    : ps.length > 1 ? { produtos: [], total: 0, correspondencia: 'aproximada', sugestoes: ps } : null;
}

function recusaConfirmacao(historico, idioma) {
  const anterior = historico.at(-2);
  const texto = normalizar(historico.at(-1)?.content || '');
  if (anterior?.role !== 'assistant' || !/Você quis dizer|Did you mean|Quisiste decir/i.test(anterior.content)) return null;
  if (!/^(nao|nao e esse|nao isso|no|no thanks|no es ese)$/.test(texto)) return null;
  return resultado({ pt: 'Qual é o nome do produto que você procura? Pode mandar outra parte do nome ou pedir o catálogo.',
    en: 'Which product are you looking for? Send another part of its name or ask for the catalog.',
    es: '¿Qué producto buscas? Envía otra parte del nombre o pide el catálogo.' }[idioma]);
}

function consultaExistencia(consulta, texto, idioma) {
  const t = normalizar(texto);
  if (!/catalogo|catalog|mencionou|mentioned|mencionaste/.test(t) ||
      /\b(dose|dosagem|gesta|prenhe|pregnan|contraindic|composicao|composition|comprar|buy|estoque|stock)\w*/.test(t)) return null;
  if (!/nao (?:tem|esta|consta|mencionou)|not (?:in|mentioned)|don t have|no (?:tienen|esta|mencionaste)/.test(t) ||
      /nao quero|don t want|no quiero/.test(t)) return null;
  const breve = consultaBreve(consulta, idioma);
  if (!breve) return null;
  const p = consulta.produtos[0];
  breve.resposta = { pt: `Sim, ${p.nome} está no catálogo.`, en: `Yes, ${p.nome} is in the catalog.`,
    es: `Sí, ${p.nome} está en el catálogo.` }[idioma] + '\n\n' + breve.resposta;
  return breve;
}

function nomeComCodigoNaoLocalizado(texto, idioma) {
  const t = normalizar(texto);
  if (!/\b[a-z]+ ?\d+[a-z]*\b/.test(t) || !/saber mais|know more|saber mas|\btem\b|\bt[eê]m\b|\bhave\b|\btienen\b/.test(t)) return null;
  return resultado({ pt: 'Não localizei esse nome e código no catálogo consultado. Não vou substituir por outra linha. Confirme o nome ou peça o catálogo para conferir as opções oficiais.',
    en: 'I could not find that name and code in the catalog. I will not replace it with another product line. Confirm the name or ask for the catalog to check the official options.',
    es: 'No encontré ese nombre y código en el catálogo. No lo sustituiré por otra línea. Confirma el nombre o pide el catálogo para revisar las opciones oficiales.' }[idioma]);
}

module.exports = { idiomaDoCliente, perguntaConfirmacao, ehConsultaSimples, consultaBreve, catalogoDireto, produtoConfirmado, recusaConfirmacao, consultaExistencia, nomeComCodigoNaoLocalizado };
