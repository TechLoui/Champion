/* Champion · Meta Pixel (Facebook/Instagram)
 *
 * Carrega o código base e dispara PageView.
 *
 * O evento de COMPRA não sai daqui, de propósito. O checkout é hospedado pela
 * Shopify, em lojachampion.com.br — outro domínio, fora deste site, onde este
 * script nem chega a rodar. Quem dispara Purchase é o canal "Facebook e
 * Instagram" do painel da Shopify, que enxerga o pedido de verdade.
 *
 * Se alguém adicionar um Purchase aqui "para garantir", cada venda passa a ser
 * contada duas vezes e o custo por conversão do gerenciador vira ficção. Os
 * eventos deste arquivo são só os de navegação (PageView, InitiateCheckout).
 */
(function () {
  'use strict';

  var PIXEL_ID = '625087940224261';

  /* Snippet padrão da Meta: cria a fila fbq() e injeta o fbevents.js de forma
     assíncrona, para o pixel nunca segurar a renderização da página. */
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
    n.queue = []; t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');

  /* Helper para os demais scripts dispararem eventos sem precisar saber se o
     pixel carregou (bloqueador de anúncios, offline). Silencioso por design:
     analytics nunca deve derrubar a página. */
  window.ChampionPixel = {
    track: function (evento, dados) {
      try {
        if (typeof window.fbq === 'function') window.fbq('track', evento, dados || {});
      } catch (e) { /* ignora */ }
    }
  };
})();
