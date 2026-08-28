/* Champion · Vídeo de uso na página de produto
 *
 * Liga o botão "Como usar" ao vídeo correspondente. Quem abre e toca é a
 * lightbox que já existe no main.js: ela escuta clique em qualquer elemento
 * com [data-video], então aqui só preenchemos o atributo e revelamos o botão.
 *
 * Produto sem vídeo mantém o botão oculto — melhor não ter botão do que ter um
 * que abre vídeo de outro produto.
 *
 * Para adicionar um vídeo novo, basta uma linha no mapa abaixo. Se um dia isso
 * crescer muito, o caminho é virar campo no painel admin em vez de código.
 */
(function () {
  'use strict';

  /* Chave: o handle que vem em produto.html?p=<handle>.
     O site usa duas grafias para o VER-MI-SAL (o handle da Shopify e o id
     interno, ver PRODUCT_ALIASES em product-data.js), então as duas entram. */
  var VIDEOS = {
    /* DIFLY Mosca — mesmo vídeo nas três apresentações */
    'difly': '4dW8rIn8wZc',
    'difly-sache-de-20-g': '4dW8rIn8wZc',
    'difly-mosca-balde-6kg': '4dW8rIn8wZc',

    /* DIFLY S3 */
    'difly-s3': '_OIE0xjLS5M',

    /* VER-MI-SAL */
    'ver-mi-sal': 'eWfc6fLPTSA',
    'vermi-sal': 'eWfc6fLPTSA',

    /* ADE — pó e fardo */
    'a-d-e-po-champion': 'WKO4o6FOejM',
    'ade-po-1kg': 'WKO4o6FOejM'
  };

  function init() {
    var botao = document.getElementById('comoUsarBtn');
    if (!botao) return;

    /* Mesmo padrão do products-cms: sem ?p= a página mostra o Difly. */
    var handle = (window.championProductSlug ? window.championProductSlug() : new URLSearchParams(window.location.search).get('p')) || 'difly';
    var video = VIDEOS[handle];
    if (!video) return;

    botao.setAttribute('data-video', video);
    botao.hidden = false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
