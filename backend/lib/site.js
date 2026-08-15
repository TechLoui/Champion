'use strict';

/**
 * Conteúdo do próprio site, para o agente responder dúvidas sobre a Champion
 * sem inventar.
 *
 * Duas fontes:
 *  - INSTITUCIONAL: fatos estáveis (história, sede, prêmios, contato, entrega).
 *    Ficam no prompt porque não mudam e uma chamada de ferramenta só para
 *    dizer "a sede é em Anápolis" seria latência à toa.
 *  - Blog: conteúdo técnico que muda. Vem por ferramenta, do mesmo Firestore
 *    que o painel-blog.html escreve.
 */

const { getDb } = require('./firebase');

const POSTS_COLLECTION = 'blogPosts';

/* Extraído de sobre.html, index.html e do rodapé. Se o site mudar, atualize
   aqui — é a única cópia que o agente enxerga. */
const INSTITUCIONAL = `## A Champion

Empresa genuinamente brasileira de saúde e nutrição animal, com mais de 67 anos de história (desde 1959). Razão social: Champion Farmoquímico Ltda.

**Sede:** Anápolis-GO, a 50 km de Goiânia — Av. Diomício de Freitas, L.12, DAIA, CEP 75132-000. Atende todo o Brasil.

**Reconhecimento:** quatro vezes eleita a melhor empresa de produtos veterinários do Brasil pelo Serasa Experian em parceria com a revista Globo Rural. Três títulos consecutivos como uma das Melhores Empresas para Você Trabalhar, pela revista Você S/A.

**Posicionamento:** produzir com qualidade, sem resíduos, respeitando o bem-estar animal, com o menor custo total do mercado. A empresa se descreve como quem "cresce de mãos dadas com o amigo pecuarista".

**Linhas de produto:** sanidade (larvicidas, parasitários), mineralização, suplementos, núcleos e vitaminas — para bovinos, equinos, suínos, ovinos e aves.

**Contato:** 0800 723 1616 · contato@champion.ind.br · WhatsApp e redes (@championsaudeanimal no Instagram e Facebook, canal Amigo Pecuarista no YouTube).

**Revenda:** quem quer revender Champion acessa revendachampion.com.br ou fala com o comercial pelo WhatsApp.

**Conteúdo do site que você pode indicar:**
- Blog — material técnico sobre mineralização, manejo e sanidade.

**Compra:** pelo site, com pagamento no checkout do Shopify (Pix, boleto ou cartão). Frete grátis acima de R$ 500. Entrega para todo o Brasil.`;

/**
 * Busca artigos publicados do blog por termo.
 * Se o Firestore não estiver configurado, devolve lista vazia — o agente é
 * instruído a encaminhar em vez de improvisar.
 */
async function buscarConteudo(termo, limite) {
  const db = getDb();
  if (!db) return [];

  const busca = String(termo || '').trim().toLowerCase();
  const max = Math.min(Math.max(Number(limite) || 3, 1), 5);

  const snapshot = await db.collection(POSTS_COLLECTION).get();
  const posts = [];

  snapshot.forEach((doc) => {
    const p = doc.data() || {};
    if (p.status && p.status !== 'published') return;
    posts.push({
      slug: p.slug || doc.id,
      titulo: p.title || '',
      categoria: p.category || '',
      resumo: p.excerpt || '',
      conteudo: String(p.content || '')
    });
  });

  /* Ranking simples por ocorrência do termo. O volume de posts é pequeno
     (dezenas), então não compensa índice de busca nem embedding. */
  const pontuados = posts
    .map((p) => {
      const alvo = `${p.titulo} ${p.categoria} ${p.resumo} ${p.conteudo}`.toLowerCase();
      let score = 0;
      busca.split(/\s+/).filter((t) => t.length > 2).forEach((t) => {
        if (p.titulo.toLowerCase().includes(t)) score += 3;
        if (alvo.includes(t)) score += 1;
      });
      return { p, score };
    })
    .filter((x) => !busca || x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);

  const base = process.env.SITE_URL || 'https://ofertaschampion.com.br';

  return pontuados.map(({ p }) => ({
    titulo: p.titulo,
    categoria: p.categoria,
    resumo: p.resumo,
    /* Trecho do corpo — o suficiente para o agente responder com substância
       sem carregar o artigo inteiro no contexto. */
    trecho: p.conteudo.replace(/\s+/g, ' ').slice(0, 900),
    url: `${base}/blog.html?post=${p.slug}`
  }));
}

module.exports = { INSTITUCIONAL, buscarConteudo };
