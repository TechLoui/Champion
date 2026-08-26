/* Champion · Google Ads (gtag.js)
 *
 * Carrega a tag base da conta e registra a visita. Isso já habilita
 * remarketing e a mensuração de tráfego vindo dos anúncios.
 *
 * A CONVERSÃO DE COMPRA NÃO SAI DAQUI, e não é esquecimento: o checkout roda
 * em lojachampion.com.br, domínio da Shopify, onde este script não existe.
 * Quem registra a venda é o canal "Google e YouTube" do painel da Shopify.
 * Disparar uma conversão de compra aqui contaria vendas que não aconteceram.
 *
 * Para marcar uma conversão específica (formulário, clique no WhatsApp, início
 * de checkout) o Google exige um RÓTULO além da tag — algo como
 * 'AW-1006745171/AbC-D_efGhIjK'. Enquanto não houver rótulo cadastrado, use
 * ChampionGoogleAds.conversao() que ele simplesmente não faz nada, em vez de
 * enviar evento inválido.
 */
(function () {
  'use strict';

  var TAG = 'AW-1006745171';

  window.dataLayer = window.dataLayer || [];
  /* O gtag precisa ser global: o script do Google e qualquer outra tag futura
     (Analytics, por exemplo) procuram por window.gtag. Dentro do IIFE, uma
     declaração comum ficaria invisível para eles. */
  window.gtag = function gtag() { window.dataLayer.push(arguments); };

  window.gtag('js', new Date());
  window.gtag('config', TAG);

  /* Carrega o gtag.js de forma assíncrona, para a tag nunca segurar a página. */
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(TAG);
  document.head.appendChild(s);

  window.ChampionGoogleAds = {
    /* `rotulo` é o send_to completo ('AW-xxx/YYY'). Sem ele não há conversão
       válida a enviar, então a função sai calada — analytics nunca deve
       derrubar a página nem poluir a conta com evento malformado. */
    conversao: function (rotulo, dados) {
      if (!rotulo || rotulo.indexOf('/') === -1) return;
      try {
        var carga = { send_to: rotulo };
        if (dados) {
          for (var k in dados) {
            if (Object.prototype.hasOwnProperty.call(dados, k)) carga[k] = dados[k];
          }
        }
        window.gtag('event', 'conversion', carga);
      } catch (e) { /* ignora */ }
    }
  };
})();
