'use strict';

/* A identidade vem do catálogo, nunca de uma lista de produtos inventada no
   prompt. Espaços e hífens não distinguem marcas; códigos como S3 e B12 sim. */
function normalizar(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_trecho, valor) => valor.replace(/[.,]/g, 'd') + 'pct')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const EMBALAGEM = new Set([
  'champion', 'kg', 'g', 'gr', 'ml', 'l', 'litro', 'litros',
  'balde', 'baldes', 'fardo', 'fardos', 'sache', 'saches', 'frasco', 'frascos', 'x',
  'de', 'do', 'da', 'dos', 'das', 'para', 'com'
]);
const CONVERSA = new Set((
  'a o as os um uma uns umas de do da dos das e em no na nos nas com para por ' +
  'sobre quero queria gostaria saber mais conhecer ver mostrar mostre manda mande ' +
  'envia envie foto fotos imagem imagens produto produtos preco precos custa quanto ' +
  'tem voces voce me mim eu favor bom boa dia tarde noite ola oi apresentacao ' +
  'apresentacoes informacao informacoes detalhe detalhes comprar compra unidade unidades ' +
  'the a an i want would like know more about show send please product products price ' +
  'how much is of for do you have information ' +
  'el la los las un una quiero quisiera saber mas acerca del mostrar muestra envia ' +
  'precio cuanto cuesta tienen ustedes informacion'
).split(/\s+/));

function limparNome(value) {
  const nome = normalizar(value).replace(/\b([a-z]{1,2}) (\d+)\b/g, (trecho, codigo, numero) =>
    EMBALAGEM.has(codigo) || CONVERSA.has(codigo) ? trecho : codigo + numero
  );
  return nome.split(' ').filter((t) =>
    t && !EMBALAGEM.has(t) && !/^\d+(?:kg|g|gr|ml|l)?$/.test(t) && !/^\d+x\d+(?:kg|g)?$/.test(t)
  );
}

function identidades(produto) {
  return [...new Set([produto.nome, produto.handle]
    .flatMap((v) => [normalizar(v), limparNome(v).join(' ')]).filter(Boolean))];
}

/* Reconhece nomes dentro de frases completas, respeitando limites de palavras.
   "Vermisal", "Vermi Sal" e "Ver-Mi-Sal" têm a mesma identidade compacta.
   Não casa "Protex" com "proteção" nem "Difly" dentro de "Difly S3". */
function reconhecerProdutos(texto, produtos) {
  const tokens = normalizar(texto).split(' ').filter(Boolean);
  const matches = [];
  for (const produto of produtos || []) {
    for (const nome of identidades(produto)) {
      const alvo = nome.replace(/ /g, '');
      if (alvo.length < 3) continue;
      for (let inicio = 0; inicio < tokens.length; inicio += 1) {
        let trecho = '';
        for (let fim = inicio; fim < tokens.length && trecho.length <= alvo.length; fim += 1) {
          trecho += tokens[fim];
          if (trecho !== alvo) continue;
          if (alvo.length <= 3 && fim !== inicio) continue;
          /* Não trocar uma linha desconhecida por outra: "Difly S2" não é
             uma solicitação do Difly comum. Números de embalagem não são códigos. */
          const seguinte = tokens[fim + 1] || '';
          const codigoSeparado = /^[a-z]{1,2}$/.test(seguinte) && !CONVERSA.has(seguinte) &&
            !EMBALAGEM.has(seguinte) && /^\d+$/.test(tokens[fim + 2] || '');
          if (codigoSeparado || /^(?:[a-z]+\d+|\d+(?:d\d+)?pct)$/.test(seguinte)) continue;
          matches.push({ produto, inicio, fim, peso: alvo.length });
        }
      }
    }
  }
  const especificos = matches.filter((m) => !matches.some((outro) =>
    outro.inicio <= m.inicio && outro.fim >= m.fim && outro.peso > m.peso
  )).sort((a, b) => a.inicio - b.inicio || b.peso - a.peso);
  return [...new Map(especificos.map((m) => [m.produto.handle, m.produto])).values()];
}

function termosBusca(texto) {
  return limparNome(texto).filter((t) => !CONVERSA.has(t));
}

/* Damerau-Levenshtein: também tolera duas letras vizinhas trocadas. Só é usado
   para sugerir nomes; uma aproximação nunca vira produto confirmado. */
function distancia(a, b) {
  const linhas = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) linhas[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) linhas[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      linhas[i][j] = Math.min(
        linhas[i - 1][j] + 1, linhas[i][j - 1] + 1,
        linhas[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        linhas[i][j] = Math.min(linhas[i][j], linhas[i - 2][j - 2] + 1);
      }
    }
  }
  return linhas[a.length][b.length];
}

function buscarNoCatalogo(texto, produtos, limite = 6) {
  const exatos = reconhecerProdutos(texto, produtos);
  if (exatos.length) return {
    produtos: exatos.slice(0, limite), correspondencia: 'nome', sugestoes: [], total: exatos.length
  };

  const termos = termosBusca(texto);
  if (!termos.some((t) => /[a-z]{3,}/.test(t))) {
    return { produtos: [], correspondencia: 'nenhuma', sugestoes: [] };
  }
  const parciais = (produtos || []).filter((p) => identidades(p).some((nome) => {
    const palavras = nome.split(' ');
    const compacto = termos.join('');
    return (compacto.length >= 4 && nome.replace(/ /g, '').startsWith(compacto)) ||
      termos.every((t) => palavras.some((p) => p === t || (t.length >= 4 && p.startsWith(t))));
  }));
  if (parciais.length) {
    return {
      produtos: parciais.slice(0, limite), correspondencia: 'nome_parcial', sugestoes: [], total: parciais.length
    };
  }

  const alvo = termos.join('');
  const tolerancia = alvo.length >= 8 ? 2 : alvo.length >= 4 ? 1 : 0;
  const sugestoes = tolerancia && alvo.length <= 64 ? (produtos || []).map((produto) => {
    const erros = identidades(produto).map((nome) => {
      const candidato = nome.replace(/ /g, '');
      /* Nunca aproximar códigos/concentrações diferentes nem nomes curtos. */
      if (candidato.length < 4 || Math.abs(candidato.length - alvo.length) > tolerancia ||
          (candidato.match(/\d+/g) || []).join() !== (alvo.match(/\d+/g) || []).join()) return Infinity;
      return distancia(alvo, candidato);
    });
    return { produto, erros: Math.min(...erros) };
  }).filter((p) => p.erros <= tolerancia).sort((a, b) => a.erros - b.erros)
    .slice(0, Math.min(limite, 4)).map((p) => p.produto) : [];
  return { produtos: [], correspondencia: sugestoes.length ? 'aproximada' : 'nenhuma', sugestoes };
}

module.exports = { normalizar, reconhecerProdutos, buscarNoCatalogo };
