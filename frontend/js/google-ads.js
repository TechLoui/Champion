/* =============================================================================
   champion.ind.br — rastreamento Google Ads + Google Analytics 4
   Conta Google Ads: AW-1006745171 (Champion Saúde Animal, 549-994-5615)
   -----------------------------------------------------------------------------
   LEIA ANTES DE MEXER — a função purchase() hoje nunca é chamada.

   Não existe página de pedido concluído em champion.ind.br. O checkout.html
   termina em `window.location.href = url` e manda o cliente para
   lojachampion.com.br, domínio da Shopify, de onde ele nunca volta. Nenhum
   script deste site roda lá.

   Ou seja: purchase() está pronta e correta, mas fica inerte até que exista
   uma página de retorno neste domínio. Enquanto isso, quem reporta a venda ao
   Google é o canal "Google e YouTube" do painel da Shopify.

   O que DE FATO funciona a partir daqui: whatsappLead, viewItem, addToCart e
   beginCheckout — todos acontecem no site, antes de o cliente sair.

   ANTES DE SUBIR: preencha GA4_ID na linha marcada.
   ============================================================================= */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------------
     1. IDs
     ------------------------------------------------------------------------- */
  var AW_ID = 'AW-1006745171';

  // >>> PREENCHER <<<
  // Measurement ID do GA4, no formato G-XXXXXXXXXX.
  // Onde achar: analytics.google.com > Administrador > Fluxos de dados >
  // (fluxo do site champion.ind.br) > "ID da métrica".
  // A propriedade correta é a "Loja Champion - GA4" (ID 405957827), que é a
  // vinculada ao Google Ads.
  var GA4_ID = '';   // exemplo: 'G-AB12CD34EF'

  /* Rótulos reais de conversão desta conta.
     Como pegar o rótulo de outra ação no futuro:
     Google Ads > Metas > Conversões > (clicar na ação) > Detalhes >
     Fontes de dados "Gerenciar" > "Ver snippet de evento". */
  var LABELS = {
    purchase:     AW_ID + '/PYVhCJyo_4wZENPshuAD', // ação "Ads Purchase"
    whatsappLead: AW_ID + '/SYaPCNyeiMcZENPshuAD'  // ação "botão whatsapp landing page"
  };

  /* ---------------------------------------------------------------------------
     2. Carrega a biblioteca gtag uma única vez
     ------------------------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + AW_ID;
    document.head.appendChild(s);
  }

  /* Medição entre domínios — o ponto que quebrava a atribuição.
     O clique do anúncio chega em champion.ind.br trazendo o gclid, mas a
     compra acontece em lojachampion.com.br (Shopify), que tem GTM próprio
     disparando a conversão "Ads Purchase". Sem linker o gclid não atravessa o
     salto, e a venda era registrada sem saber de qual anúncio veio.
     `accept_incoming` cobre o caminho de volta. */
  var LINKER = {
    domains: ['champion.ind.br', 'lojachampion.com.br'],
    decorate_forms: true,
    accept_incoming: true
  };

  gtag('js', new Date());
  gtag('config', AW_ID, { linker: LINKER });
  if (GA4_ID) {
    gtag('config', GA4_ID, { send_page_view: true, linker: LINKER });
  }

  /* ---------------------------------------------------------------------------
     3. Utilitários
     ------------------------------------------------------------------------- */
  function num(v) {
    var n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : 0;
  }
  function jaEnviado(chave) {
    try { return !!window.localStorage.getItem(chave); } catch (e) { return false; }
  }
  function marcarEnviado(chave) {
    try { window.localStorage.setItem(chave, String(Date.now())); } catch (e) {}
  }
  /* items no formato do Google Ads (remarketing dinâmico / Shopping) */
  function itemsAds(items) {
    return (items || []).map(function (i) {
      return { id: String(i.id), google_business_vertical: 'retail' };
    });
  }
  /* items no formato do GA4 (ecommerce) */
  function itemsGa4(items) {
    return (items || []).map(function (i, idx) {
      return {
        item_id: String(i.id),
        item_name: i.name || String(i.id),
        item_category: i.category || undefined,
        item_variant: i.variant || undefined,
        price: num(i.price),
        quantity: Number(i.qty || i.quantity || 1),
        index: idx
      };
    });
  }

  /* ---------------------------------------------------------------------------
     4. COMPRA CONCLUÍDA
     ---------------------------------------------------------------------------
     INERTE HOJE: não há página de pedido concluído neste domínio (ver o aviso
     no topo do arquivo). Fica pronta para o dia em que houver retorno da
     Shopify para cá.

     ATENÇÃO ao ligar: o canal da Shopify já reporta compra ao Google Ads. Se
     esta função passar a disparar sem desativar aquele reporte, a mesma venda
     será contada duas vezes.

     ChampionTracking.purchase({
       id: 'CH-10432', total: 1299.00, frete: 0,
       items: [{ id:'difly-s3', name:'DIFLY S3', variant:'6 kg',
                 category:'Bovinos', price:1299.00, qty:1 }],
       cliente: { email:'...', telefone:'+55...' }
     });
     ------------------------------------------------------------------------- */
  function purchase(pedido) {
    if (!pedido || pedido.id === undefined || pedido.id === null) return;

    var id = String(pedido.id);
    var chave = 'champion_conv_' + id;
    if (jaEnviado(chave)) return;              /* evita contagem dupla no F5 */

    var valor = num(pedido.total);

    /* Conversões otimizadas: o gtag faz o hash localmente, nada sai em texto
       puro. Exige "Conversões otimizadas" ativado no Google Ads. */
    if (pedido.cliente && (pedido.cliente.email || pedido.cliente.telefone)) {
      var ud = {};
      if (pedido.cliente.email) ud.email = String(pedido.cliente.email).trim().toLowerCase();
      if (pedido.cliente.telefone) ud.phone_number = String(pedido.cliente.telefone).replace(/[^\d+]/g, '');
      gtag('set', 'user_data', ud);
    }

    gtag('event', 'conversion', {
      send_to: LABELS.purchase,
      value: valor,
      currency: 'BRL',
      transaction_id: id,
      items: itemsAds(pedido.items)
    });

    if (GA4_ID) {
      gtag('event', 'purchase', {
        send_to: GA4_ID,
        transaction_id: id,
        value: valor,
        currency: 'BRL',
        shipping: num(pedido.frete),
        items: itemsGa4(pedido.items)
      });
    }

    marcarEnviado(chave);
  }

  /* ---------------------------------------------------------------------------
     5. CLIQUE NO BOTÃO DE WHATSAPP
     ---------------------------------------------------------------------------
     Registra o lead e só então navega, para o evento não se perder.
     Ligado automaticamente pela delegação da seção 7 — não precisa de onclick
     no HTML.
     ------------------------------------------------------------------------- */
  function whatsappLead(url) {
    var navegou = false;
    function ir() {
      if (navegou) return;
      navegou = true;
      if (url) window.location = url;
    }

    gtag('event', 'conversion', {
      send_to: LABELS.whatsappLead,
      event_callback: ir
    });

    if (GA4_ID) {
      gtag('event', 'generate_lead', { send_to: GA4_ID, method: 'whatsapp' });
    }

    window.setTimeout(ir, 1000);  /* fallback se o callback não voltar */
    return false;
  }

  /* ---------------------------------------------------------------------------
     6. EVENTOS DE FUNIL
     ---------------------------------------------------------------------------
     Não são ações de conversão. Servem para remarketing dinâmico, Shopping e
     para o GA4 montar o funil.
     ------------------------------------------------------------------------- */
  function viewItem(item) {
    if (!item) return;
    gtag('event', 'view_item', {
      send_to: AW_ID, value: num(item.price), currency: 'BRL', items: itemsAds([item])
    });
    if (GA4_ID) {
      gtag('event', 'view_item', {
        send_to: GA4_ID, value: num(item.price), currency: 'BRL', items: itemsGa4([item])
      });
    }
  }

  function addToCart(item) {
    if (!item) return;
    var qtd = Number(item.qty || 1);
    gtag('event', 'add_to_cart', {
      send_to: AW_ID, value: num(item.price) * qtd, currency: 'BRL', items: itemsAds([item])
    });
    if (GA4_ID) {
      gtag('event', 'add_to_cart', {
        send_to: GA4_ID, value: num(item.price) * qtd, currency: 'BRL', items: itemsGa4([item])
      });
    }
  }

  function beginCheckout(carrinho) {
    if (!carrinho) return;
    gtag('event', 'begin_checkout', {
      send_to: AW_ID, value: num(carrinho.total), currency: 'BRL', items: itemsAds(carrinho.items)
    });
    if (GA4_ID) {
      gtag('event', 'begin_checkout', {
        send_to: GA4_ID, value: num(carrinho.total), currency: 'BRL', items: itemsGa4(carrinho.items)
      });
    }
  }

  /* ---------------------------------------------------------------------------
     7. WhatsApp: ligação automática por delegação
     ---------------------------------------------------------------------------
     O site tem nove links de WhatsApp espalhados por cinco páginas, e o
     site-settings.js ainda reescreve esses href em tempo de execução a partir
     do painel admin. Marcar onclick em cada um seria frágil e quebraria no
     primeiro link novo que alguém adicionasse.

     Aqui um único listener no documento cobre todos, os atuais e os futuros.
     Cliques com Ctrl/Cmd/meio abrem em nova aba e não perdem o evento, então
     nesses casos apenas registramos e deixamos o navegador seguir.
     ------------------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!a) return;

    var href = a.getAttribute('href') || '';
    var novaAba = e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1
      || (a.getAttribute('target') || '').toLowerCase() === '_blank';

    if (novaAba) {
      /* A página atual não sai do ar: basta registrar. */
      gtag('event', 'conversion', { send_to: LABELS.whatsappLead });
      if (GA4_ID) gtag('event', 'generate_lead', { send_to: GA4_ID, method: 'whatsapp' });
      return;
    }

    e.preventDefault();
    whatsappLead(href);
  }, true);

  /* ---------------------------------------------------------------------------
     8. Saída para outro domínio preservando a atribuição
     ---------------------------------------------------------------------------
     O linker do gtag só decora CLIQUE em <a>. Um `location.href = url` sai sem
     o parâmetro _gl, o gclid morre no salto e a compra na Shopify vira venda
     órfã. Passar por uma âncora sintética faz o linker interceptar o clique e
     anexar o parâmetro antes de navegar.

     Usar em qualquer navegação para lojachampion.com.br — hoje, o botão de ir
     para o pagamento no checkout.
     ------------------------------------------------------------------------- */
  function irPara(url) {
    if (!url) return;
    try {
      var a = document.createElement('a');
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);

      /* Se a navegação começar, `pagehide` dispara e cancela o plano B. Sem
         essa checagem, uma rede lenta faria o timeout reescrever a URL sem o
         _gl no meio de uma navegação que já estava correta. */
      var saindo = false;
      window.addEventListener('pagehide', function () { saindo = true; }, { once: true });

      a.click();

      /* Plano B: se o clique não navegar (bloqueio de popup, política de
         segurança), o cliente ainda chega ao pagamento. Perde-se a atribuição,
         nunca a venda. */
      window.setTimeout(function () {
        if (saindo) return;
        window.location.href = url;
      }, 1200);
    } catch (e) {
      window.location.href = url;
    }
  }

  /* ---------------------------------------------------------------------------
     9. API pública
     ------------------------------------------------------------------------- */
  window.ChampionTracking = {
    purchase: purchase,
    irPara: irPara,
    whatsappLead: whatsappLead,
    viewItem: viewItem,
    addToCart: addToCart,
    beginCheckout: beginCheckout
  };

  /* Compatibilidade com o nome antigo usado no site. */
  window.ChampionGoogleAds = window.ChampionTracking;
})();
