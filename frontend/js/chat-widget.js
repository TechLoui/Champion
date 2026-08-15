'use strict';

/**
 * Champion · Atendente virtual — widget flutuante.
 *
 * Carregado como <script> comum (não módulo) para funcionar também em file://
 * durante o desenvolvimento, igual ao customer-store.js.
 *
 * O widget não sabe nada sobre produto, preço ou regra de negócio: ele só
 * transporta texto até /api/chat. Toda a inteligência (e todos os limites)
 * ficam no backend, onde a chave da API mora.
 *
 * Idioma: a interface segue o seletor do site (html[data-lang], mesma chave que
 * o main.js usa). O idioma da RESPOSTA é decidido pelo modelo a partir do que o
 * cliente escreveu — alguém pode digitar em espanhol numa página em português.
 *
 * Para apontar para o backend local durante o teste, defina antes deste script:
 *   <script>window.CHAMPION_CHAT_API = 'http://localhost:3000/api/chat';</script>
 */

(function () {
  const API_URL =
    (typeof window !== 'undefined' && window.CHAMPION_CHAT_API) ||
    'https://champion-production-cab6.up.railway.app/api/chat';

  const STORAGE_KEY = 'champion-chat-historico';
  const SESSION_KEY = 'champion-chat-sessao';
  const LANGUAGE_KEY = 'champion-language';
  const MAX_HISTORICO = 20;

  /* Textos da interface. As respostas do agente não passam por aqui — quem
     traduz aquilo é o modelo, conforme o idioma da pergunta. */
  const I18N = {
    pt: {
      titulo: 'Atendimento Champion',
      subtitulo: 'Produtos, preços e pedidos',
      abrir: 'Abrir atendimento',
      fechar: 'Fechar atendimento',
      placeholder: 'Escreva sua mensagem...',
      enviar: 'Enviar',
      campo: 'Sua mensagem',
      saudacao:
        'Olá! Sou o atendente da Champion. Posso ajudar a encontrar o produto certo, ' +
        'ver preços e montar o seu pedido.\n\nPara começar, como posso te chamar?',
      aviso: 'Atendimento automatizado. Dúvida clínica ou de dose: fale com a equipe técnica.',
      semResposta: 'Não consegui formular uma resposta. Pode reformular a pergunta?',
      erroRede: 'Não consegui me conectar. Verifique sua internet ou chame a gente no WhatsApp.',
      erroGenerico: 'Não consegui responder agora. Tente novamente em instantes.',
      digitando: 'Digitando',
      verDetalhes: 'Ver detalhes',
      verVariacoes: 'Ver variações',
      verFoto: 'Ver foto',
      escolher: 'Escolher',
      esgotado: 'Esgotado',
      adicionar: 'Adicionar',
      cancelar: 'Cancelar',
      menos: 'Diminuir quantidade',
      mais: 'Aumentar quantidade',
      pedido: 'Quero {n} {u} do {p}',
      unidade: 'unidade',
      unidades: 'unidades',
      carrinho: 'Seu carrinho',
      carrinhoVazio: 'Carrinho vazio. Escolha um produto que eu adiciono aqui.',
      total: 'Total',
      finalizar: 'Finalizar compra',
      remover: 'Remover',
      verCarrinho: 'Ver carrinho'
    },
    en: {
      titulo: 'Champion Support',
      subtitulo: 'Products, prices and orders',
      abrir: 'Open support chat',
      fechar: 'Close support chat',
      placeholder: 'Type your message...',
      enviar: 'Send',
      campo: 'Your message',
      saudacao:
        "Hello! I'm Champion's support agent. I can help you find the right product, " +
        'check prices and put your order together.\n\nTo start — what should I call you?',
      aviso: 'Automated support. For clinical or dosage questions, talk to our technical team.',
      semResposta: "I couldn't put together an answer. Could you rephrase the question?",
      erroRede: "I couldn't connect. Check your internet or reach us on WhatsApp.",
      erroGenerico: "I couldn't respond right now. Please try again in a moment.",
      digitando: 'Typing',
      verDetalhes: 'View details',
      verVariacoes: 'View sizes',
      verFoto: 'View photo',
      escolher: 'Choose',
      esgotado: 'Sold out',
      adicionar: 'Add',
      cancelar: 'Cancel',
      menos: 'Decrease quantity',
      mais: 'Increase quantity',
      pedido: 'I want {n} {u} of {p}',
      unidade: 'unit',
      unidades: 'units',
      carrinho: 'Your cart',
      carrinhoVazio: 'Cart is empty. Pick a product and I will add it here.',
      total: 'Total',
      finalizar: 'Checkout',
      remover: 'Remove',
      verCarrinho: 'View cart'
    },
    es: {
      titulo: 'Atención Champion',
      subtitulo: 'Productos, precios y pedidos',
      abrir: 'Abrir atención',
      fechar: 'Cerrar atención',
      placeholder: 'Escribe tu mensaje...',
      enviar: 'Enviar',
      campo: 'Tu mensaje',
      saudacao:
        '¡Hola! Soy el asistente de Champion. Puedo ayudarte a encontrar el producto ' +
        'adecuado, consultar precios y armar tu pedido.\n\nPara empezar, ¿cómo te llamas?',
      aviso: 'Atención automatizada. Para dudas clínicas o de dosis, habla con el equipo técnico.',
      semResposta: 'No pude formular una respuesta. ¿Puedes reformular la pregunta?',
      erroRede: 'No pude conectarme. Revisa tu internet o escríbenos por WhatsApp.',
      erroGenerico: 'No pude responder ahora. Inténtalo de nuevo en un momento.',
      digitando: 'Escribiendo',
      verDetalhes: 'Ver detalles',
      verVariacoes: 'Ver presentaciones',
      verFoto: 'Ver foto',
      escolher: 'Elegir',
      esgotado: 'Agotado',
      adicionar: 'Añadir',
      cancelar: 'Cancelar',
      menos: 'Disminuir cantidad',
      mais: 'Aumentar cantidad',
      pedido: 'Quiero {n} {u} de {p}',
      unidade: 'unidad',
      unidades: 'unidades',
      carrinho: 'Tu carrito',
      carrinhoVazio: 'Carrito vacío. Elige un producto y lo agrego aquí.',
      total: 'Total',
      finalizar: 'Finalizar compra',
      remover: 'Quitar',
      verCarrinho: 'Ver carrito'
    }
  };

  let historico = [];
  let aberto = false;
  let enviando = false;
  let lang = 'pt';
  let els = {};

  /* ── Idioma ────────────────────────────────────────────── */

  function detectarIdioma() {
    let l = '';
    try { l = localStorage.getItem(LANGUAGE_KEY) || ''; } catch (e) { /* bloqueado */ }
    if (!l && document.documentElement.dataset) l = document.documentElement.dataset.lang || '';
    l = String(l).toLowerCase().slice(0, 2);
    return I18N[l] ? l : 'pt';
  }

  function t(chave) {
    return (I18N[lang] || I18N.pt)[chave];
  }

  /* Reescreve os rótulos sem derrubar a conversa em andamento. */
  function aplicarIdioma() {
    lang = detectarIdioma();
    if (!els.painel) return;

    els.titulo.textContent = t('titulo');
    els.subtitulo.textContent = t('subtitulo');
    els.input.placeholder = t('placeholder');
    els.input.setAttribute('aria-label', t('campo'));
    els.enviar.setAttribute('aria-label', t('enviar'));
    els.aviso.textContent = t('aviso');
    els.painel.setAttribute('aria-label', t('titulo'));
    els.fab.setAttribute('aria-label', aberto ? t('fechar') : t('abrir'));
    els.qtdOk.textContent = t('adicionar');
    els.qtdMenos.setAttribute('aria-label', t('menos'));
    els.qtdMais.setAttribute('aria-label', t('mais'));
    els.qtdCancelar.setAttribute('aria-label', t('cancelar'));
    els.cartBtn.setAttribute('aria-label', t('verCarrinho'));
    els.carrinhoFechar.setAttribute('aria-label', t('fechar'));
    if (carrinhoVisivel()) {
      els.carrinhoTitulo.textContent = t('carrinho');
      els.finalizar.textContent = t('finalizar');
      renderCarrinho();
    }
  }

  /* ── Sessão ────────────────────────────────────────────── */

  function sessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 'ses-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return 'anon';
    }
  }

  function carregarHistorico() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(-MAX_HISTORICO) : [];
    } catch (e) {
      return [];
    }
  }

  function salvarHistorico() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(historico.slice(-MAX_HISTORICO)));
    } catch (e) { /* sessionStorage cheio ou bloqueado — segue sem persistir */ }
  }

  /* ── Renderização segura ───────────────────────────────── */

  /* A resposta vem de um modelo de linguagem: é texto não confiável e nunca
     entra como HTML. Escapamos tudo e só depois transformamos URLs em links —
     assim o link de pagamento fica clicável sem abrir caminho para injeção. */
  function escapar(texto) {
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* O prompt pede formatação quase nenhuma, mas modelo de linguagem escorrega
     em markdown de vez em quando. Renderizamos o básico em vez de deixar o
     cliente ler "**Difly S3**" com os asteriscos à mostra.

     Ordem importa: escapar primeiro (nada de HTML do modelo), depois links
     (o regex para em "<", então não engole as tags que criamos), depois o
     markdown, e por último as quebras de linha. */
  function formatar(texto) {
    return escapar(texto)
      /* Só http(s). Nada de javascript: ou data:. */
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, function (url) {
        return '<a href="' + url + '" target="_blank" rel="noopener nofollow">' + url + '</a>';
      })
      /* Título vira uma linha em destaque — não temos hierarquia num balão. */
      .replace(/^#{1,6}[ \t]+(.+)$/gm, '<strong>$1</strong>')
      /* Marcador antes do itálico, senão "* item" viraria ênfase. */
      .replace(/^[ \t]*[-*•][ \t]+/gm, '• ')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s.,;:!?)])/gm, '$1<em>$2</em>')
      .replace(/\n/g, '<br>');
  }

  /* Perto do fim = o cliente está acompanhando a conversa. Se ele rolou para
     cima para reler algo, não arrastamos a tela dele à força. */
  function noFim() {
    return els.corpo.scrollHeight - els.corpo.scrollTop - els.corpo.clientHeight < 90;
  }

  /* O scroll vai depois do próximo quadro: logo após um appendChild o layout
     ainda não foi recalculado, e scrollHeight vem com o valor antigo — era o
     que fazia o card parecer travado no lugar enquanto a conversa seguia. */
  function rolarFim(forcar) {
    if (!forcar && !noFim()) return;
    requestAnimationFrame(function () {
      els.corpo.scrollTop = els.corpo.scrollHeight;
    });
  }

  function addBolha(papel, texto) {
    const eUsuario = papel === 'user';
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-' + (eUsuario ? 'user' : 'bot');

    /* Mensagens seguidas do mesmo lado se agrupam: espaçamento menor e só a
       primeira do bloco mantém o "rabinho" do balão. */
    const anterior = els.corpo.lastElementChild;
    if (anterior && anterior.classList.contains(eUsuario ? 'chat-msg-user' : 'chat-msg-bot')) {
      div.classList.add('is-seguida');
    }

    div.innerHTML = formatar(texto);
    els.corpo.appendChild(div);
    /* Mensagem nova sempre puxa a tela: quem acabou de escrever quer ver o
       que veio. */
    rolarFim(true);
    return div;
  }

  /* Cards de produto. Chegam como dado estruturado do backend (nunca como
     texto), então a foto é uma <img> de verdade em vez de uma URL solta.
     Tudo que vem do servidor passa por escapar() antes de virar HTML, e a
     URL da imagem só é aceita se for https. */
  function urlSegura(u) {
    const s = String(u || '').trim();
    return /^https:\/\//i.test(s) ? s : '';
  }

  function addCards(produtos) {
    if (!Array.isArray(produtos) || !produtos.length) return;

    const grade = document.createElement('div');
    grade.className = 'chat-cards';

    produtos.slice(0, 4).forEach(function (p) {
      const foto = urlSegura(p.foto);
      const link = urlSegura(p.url);
      const nome = escapar(p.nome || '');
      const resumo = escapar(String(p.resumo || '').slice(0, 100));
      const aprs = Array.isArray(p.apresentacoes) ? p.apresentacoes.slice(0, 6) : [];

      const card = document.createElement('article');
      card.className = 'chat-card';

      const partes = [];

      /* Sem foto cadastrada no Shopify (ou imagem quebrada) o card mostra a
         inicial do produto em vez de um buraco — degrada em vez de parecer
         defeito. */
      const inicial = escapar(String(p.nome || '?').trim().charAt(0).toUpperCase());
      if (foto) {
        partes.push(
          '<div class="chat-card-foto"><img src="' + foto + '" alt="' + nome +
          '" loading="lazy" onerror="this.parentElement.classList.add(\'sem-foto\');' +
          'this.parentElement.textContent=\'' + inicial + '\'"></div>'
        );
      } else {
        partes.push('<div class="chat-card-foto sem-foto">' + inicial + '</div>');
      }

      partes.push('<div class="chat-card-body">');
      partes.push('<strong>' + nome + '</strong>');
      if (resumo) partes.push('<p>' + resumo + '</p>');

      /* Uma apresentação: preço fixo. Várias: slides que se alternam, cada um
         com o nome da embalagem e o preço dela. É onde o cliente percebe que
         existe embalagem maior — o preço isolado esconde essa escolha. */
      if (aprs.length) {
        partes.push('<div class="chat-slider" data-i="0">');
        aprs.forEach(function (a, i) {
          const rotulo = escapar(a.apresentacao || '');
          const preco = escapar(a.preco || '');
          partes.push(
            '<button type="button" class="chat-slide' + (i === 0 ? ' is-active' : '') + '"' +
            ' data-i="' + i + '"' +
            ' tabindex="' + (i === 0 ? '0' : '-1') + '">' +
            (aprs.length > 1 ? '<span class="chat-slide-nome">' + rotulo + '</span>' : '') +
            '<span class="chat-slide-preco">' + preco + '</span>' +
            '</button>'
          );
        });
        partes.push('</div>');

        if (aprs.length > 1) {
          partes.push('<div class="chat-dots">');
          aprs.forEach(function (a, i) {
            partes.push(
              '<button type="button" class="chat-dot' + (i === 0 ? ' is-active' : '') +
              '" data-ir="' + i + '" aria-label="' + escapar(a.apresentacao || '') + '"></button>'
            );
          });
          partes.push('</div>');
        }
      }

      /* Duas ações: a janela ampliada (foto grande + todas as variações de
         uma vez) e a página completa do produto no site. */
      partes.push('<div class="chat-card-acoes">');
      partes.push(
        '<button type="button" class="chat-card-cta chat-card-vars">' +
        escapar(aprs.length > 1 ? t('verVariacoes') : t('verFoto')) + '</button>'
      );
      if (link) {
        partes.push(
          '<a class="chat-card-link" href="' + link + '" target="_blank" rel="noopener">' +
          escapar(t('verDetalhes')) + '</a>'
        );
      }
      partes.push('</div>');

      partes.push('</div>');
      card.innerHTML = partes.join('');

      /* Tocar numa apresentação abre o seletor de quantidade — não manda o
         pedido direto, porque quantidade é decisão do cliente. */
      card.querySelectorAll('.chat-slide').forEach(function (btn) {
        btn.addEventListener('click', function () {
          pedirQuantidade(p, aprs[Number(btn.dataset.i) || 0]);
        });
      });

      card.querySelectorAll('.chat-dot').forEach(function (dot) {
        dot.addEventListener('click', function () {
          irPara(card.querySelector('.chat-slider'), Number(dot.dataset.ir));
        });
      });

      /* Closure com o produto: nada de serializar objeto em atributo. */
      card.querySelector('.chat-card-vars').addEventListener('click', function () {
        abrirModal(p);
      });

      /* A foto entra depois do layout. Se o cliente estava acompanhando o fim
         da conversa, reencosta no fim quando ela chega. */
      const img = card.querySelector('.chat-card-foto img');
      if (img) img.addEventListener('load', function () { rolarFim(); });

      grade.appendChild(card);
    });

    els.corpo.appendChild(grade);
    rolarFim(true);
  }

  /* ── Seletor de quantidade ─────────────────────────────── */

  /* Aparece acima do campo de digitar depois que o cliente escolhe uma
     apresentação. Fica fora do histórico de mensagens de propósito: é uma
     ação pendente, não uma coisa que foi dita.

     Só existe para o caminho do clique. Quem digita "quero 3 baldes de 6 kg"
     não passa por aqui — o próprio agente entende e monta o carrinho. */
  function pedirQuantidade(produto, apresentacao) {
    if (!apresentacao) return;

    const apr = apresentacao.apresentacao || '';
    let qtd = 1;

    els.qtdRotulo.textContent = (produto.nome || '') + (apr ? ' · ' + apr : '');
    els.qtdPreco.textContent = apresentacao.preco || '';
    els.qtdValor.textContent = '1';
    els.qtdBarra.hidden = false;

    function ajustar(delta) {
      qtd = Math.min(Math.max(qtd + delta, 1), 99);
      els.qtdValor.textContent = String(qtd);
      els.qtdMenos.disabled = qtd <= 1;
      els.qtdMais.disabled = qtd >= 99;
    }

    /* Atribuição em .onclick (e não addEventListener) de propósito: cada
       abertura substitui o handler da anterior em vez de empilhar mais um. */
    els.qtdMenos.onclick = function () { ajustar(-1); };
    els.qtdMais.onclick = function () { ajustar(1); };
    els.qtdCancelar.onclick = fecharQuantidade;
    els.qtdOk.onclick = function () {
      fecharQuantidade();
      /* Entra no carrinho do site na hora — a pessoa vê o contador subir sem
         precisar esperar a resposta do agente. E avisa o agente por texto,
         para ele saber o que foi escolhido e seguir o atendimento. */
      adicionarAoCarrinho(produto, apresentacao, qtd);
      atualizarBadge();
      enviar(frasePedido(qtd, produto.nome, apr));
    };

    ajustar(0);
    els.qtdMais.focus();
  }

  function fecharQuantidade() {
    if (els.qtdBarra) els.qtdBarra.hidden = true;
  }

  /* ── Carrinho do site ──────────────────────────────────── */

  /* O chat NÃO tem carrinho próprio. Ele escreve e lê o carrinho do site
     (window.ChampionCart, localStorage 'champion-cart'), o mesmo que a
     vitrine e a página de produto usam. Assim o que a pessoa monta
     conversando já está lá quando ela fecha o chat e vai para o checkout —
     e não existem dois estados para sincronizar. */
  function carrinhoDisponivel() {
    return Boolean(window.ChampionCart && typeof window.ChampionCart.add === 'function');
  }

  function moeda(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '';
    try {
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch (e) {
      return 'R$ ' + v.toFixed(2);
    }
  }

  function adicionarAoCarrinho(produto, apresentacao, qtd) {
    if (!carrinhoDisponivel()) return false;

    const apr = apresentacao.apresentacao || '';
    const vid = apresentacao.variantId || '';

    try {
      window.ChampionCart.add({
        /* Mesma convenção de id da vitrine (`produto|variante`), senão o
           mesmo item entraria duas vezes no carrinho. */
        id: vid ? produto.handle + '|' + vid : produto.handle,
        name: produto.nome + (apr && apr !== 'Padrão' ? ' · ' + apr : ''),
        price: Number(apresentacao.precoNum) || 0,
        qty: qtd,
        image: produto.foto || '',
        art: String(produto.nome || '?').charAt(0),
        variantId: vid
      }, { open: false });   /* sem abrir a gaveta: a conversa continua aqui */
      return true;
    } catch (e) {
      return false;
    }
  }

  function atualizarBadge() {
    if (!els.cartBadge) return;
    const n = carrinhoDisponivel() ? window.ChampionCart.count() : 0;
    els.cartBadge.textContent = String(n);
    els.cartBadge.hidden = n <= 0;
    els.cartBtn.hidden = !carrinhoDisponivel();
  }

  function renderCarrinho() {
    if (!els.carrinhoItens) return;

    const itens = carrinhoDisponivel() ? window.ChampionCart.items() : [];
    els.carrinhoItens.innerHTML = '';

    if (!itens.length) {
      const vazio = document.createElement('p');
      vazio.className = 'chat-carrinho-vazio';
      vazio.textContent = t('carrinhoVazio');
      els.carrinhoItens.appendChild(vazio);
      els.carrinhoPe.hidden = true;
      return;
    }

    itens.forEach(function (i) {
      const linha = document.createElement('div');
      linha.className = 'chat-carrinho-item';
      linha.innerHTML =
        '<span class="chat-ci-qtd"></span>' +
        '<span class="chat-ci-nome"></span>' +
        '<span class="chat-ci-preco"></span>' +
        '<button type="button" class="chat-ci-x" aria-label="' + escapar(t('remover')) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>';

      linha.querySelector('.chat-ci-qtd').textContent = i.qty + '×';
      linha.querySelector('.chat-ci-nome').textContent = i.name || '';
      linha.querySelector('.chat-ci-preco').textContent = moeda((Number(i.price) || 0) * (i.qty || 1));
      linha.querySelector('.chat-ci-x').addEventListener('click', function () {
        if (carrinhoDisponivel()) window.ChampionCart.remove(i.id);
        renderCarrinho();
      });

      els.carrinhoItens.appendChild(linha);
    });

    els.carrinhoPe.hidden = false;
    els.totalRotulo.textContent = t('total');
    els.totalValor.textContent = moeda(window.ChampionCart.total());
  }

  function abrirCarrinho() {
    fecharQuantidade();
    els.carrinhoTitulo.textContent = t('carrinho');
    els.finalizar.textContent = t('finalizar');
    renderCarrinho();
    els.carrinho.hidden = false;
  }

  function fecharCarrinho() {
    if (els.carrinho) els.carrinho.hidden = true;
  }

  function carrinhoVisivel() {
    return Boolean(els.carrinho && !els.carrinho.hidden);
  }

  /* "Quero 3 unidades do DIFLY S3 6 kg" — texto normal, porque quem interpreta
     é o agente. Assim o caminho do clique e o do teclado chegam iguais nele. */
  function frasePedido(n, nome, apr) {
    return t('pedido')
      .replace('{n}', String(n))
      .replace('{u}', n === 1 ? t('unidade') : t('unidades'))
      .replace('{p}', String(nome || '') + (apr ? ' ' + apr : ''));
  }

  /* ── Janela de variações ───────────────────────────────── */

  /* Uma janela só, reaproveitada. Fica fora do painel do chat (direto no
     body) para poder ser maior que ele — é o ponto do recurso: ver a foto
     grande e todas as apresentações de uma vez, sem o slider. */
  let modalEls = null;
  let modalFoco = null;

  function montarModal() {
    if (modalEls) return modalEls;

    const wrap = document.createElement('div');
    wrap.className = 'chat-modal';
    wrap.hidden = true;
    wrap.innerHTML = [
      '<div class="chat-modal-fundo" data-fechar></div>',
      '<div class="chat-modal-box" role="dialog" aria-modal="true" aria-labelledby="chatModalNome">',
      '  <button type="button" class="chat-modal-x" data-fechar aria-label="Fechar">',
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '  </button>',
      '  <div class="chat-modal-foto" id="chatModalFoto"></div>',
      '  <div class="chat-modal-info">',
      '    <strong id="chatModalNome"></strong>',
      '    <p id="chatModalResumo"></p>',
      '    <div class="chat-modal-vars" id="chatModalVars"></div>',
      '    <a class="chat-modal-link" id="chatModalLink" target="_blank" rel="noopener"></a>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(wrap);

    wrap.querySelectorAll('[data-fechar]').forEach(function (el) {
      el.addEventListener('click', fecharModal);
    });

    modalEls = {
      wrap: wrap,
      foto: wrap.querySelector('#chatModalFoto'),
      nome: wrap.querySelector('#chatModalNome'),
      resumo: wrap.querySelector('#chatModalResumo'),
      vars: wrap.querySelector('#chatModalVars'),
      link: wrap.querySelector('#chatModalLink'),
      x: wrap.querySelector('.chat-modal-x')
    };
    return modalEls;
  }

  function abrirModal(p) {
    const m = montarModal();
    const foto = urlSegura(p.foto);
    const link = urlSegura(p.url);
    const inicial = String(p.nome || '?').trim().charAt(0).toUpperCase();

    modalFoco = document.activeElement;

    m.foto.className = 'chat-modal-foto' + (foto ? '' : ' sem-foto');
    m.foto.innerHTML = '';
    if (foto) {
      const img = document.createElement('img');
      img.src = foto;
      img.alt = String(p.nome || '');
      img.addEventListener('error', function () {
        m.foto.className = 'chat-modal-foto sem-foto';
        m.foto.textContent = inicial;
      });
      m.foto.appendChild(img);
    } else {
      m.foto.textContent = inicial;
    }

    m.nome.textContent = p.nome || '';
    m.resumo.textContent = p.resumo || '';
    m.resumo.hidden = !p.resumo;

    m.vars.innerHTML = '';
    (Array.isArray(p.apresentacoes) ? p.apresentacoes : []).forEach(function (a) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-var' + (a.disponivel === false ? ' esgotado' : '');
      b.innerHTML =
        '<span class="chat-var-nome"></span>' +
        '<span class="chat-var-preco"></span>' +
        '<span class="chat-var-cta"></span>';
      b.querySelector('.chat-var-nome').textContent = a.apresentacao || '';
      b.querySelector('.chat-var-preco').textContent = a.preco || '';
      b.querySelector('.chat-var-cta').textContent =
        a.disponivel === false ? t('esgotado') : t('escolher');

      if (a.disponivel === false) {
        b.disabled = true;
      } else {
        b.addEventListener('click', function () {
          fecharModal();
          pedirQuantidade(p, a);
        });
      }
      m.vars.appendChild(b);
    });

    if (link) {
      m.link.href = link;
      m.link.textContent = t('verDetalhes');
      m.link.hidden = false;
    } else {
      m.link.hidden = true;
    }

    m.wrap.hidden = false;
    document.body.classList.add('chat-modal-aberto');
    requestAnimationFrame(function () {
      m.wrap.classList.add('is-open');
      m.x.focus();
    });
  }

  function fecharModal() {
    if (!modalEls || modalEls.wrap.hidden) return;
    modalEls.wrap.classList.remove('is-open');
    document.body.classList.remove('chat-modal-aberto');
    setTimeout(function () {
      if (modalEls && !modalEls.wrap.classList.contains('is-open')) modalEls.wrap.hidden = true;
    }, 220);
    if (modalFoco && modalFoco.focus) modalFoco.focus();
    modalFoco = null;
  }

  function modalAberto() {
    return Boolean(modalEls && !modalEls.wrap.hidden);
  }

  /* ── Alternância dos slides ────────────────────────────── */

  /* Um único ticker para todos os cards da conversa. Um setInterval por card
     vazaria conforme o histórico cresce, e sincronizados eles ficam mais
     calmos visualmente do que cada um no seu tempo. */
  let ticker = null;

  function irPara(slider, indice) {
    if (!slider) return;
    const slides = slider.querySelectorAll('.chat-slide');
    if (slides.length < 2) return;

    const i = ((indice % slides.length) + slides.length) % slides.length;
    slider.dataset.i = String(i);

    slides.forEach(function (s, n) {
      s.classList.toggle('is-active', n === i);
      s.tabIndex = n === i ? 0 : -1;
    });

    const dots = slider.parentElement.querySelectorAll('.chat-dot');
    dots.forEach(function (d, n) { d.classList.toggle('is-active', n === i); });
  }

  function iniciarTicker() {
    if (ticker) return;
    /* Quem pediu menos movimento não recebe alternância automática — os
       slides continuam acessíveis pelos pontinhos. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    ticker = setInterval(function () {
      els.corpo.querySelectorAll('.chat-slider').forEach(function (slider) {
        /* Não gira o que o cliente está olhando ou usando. */
        if (slider.matches(':hover') || slider.contains(document.activeElement)) return;
        irPara(slider, Number(slider.dataset.i || 0) + 1);
      });
    }, 3200);
  }

  function pararTicker() {
    if (!ticker) return;
    clearInterval(ticker);
    ticker = null;
  }

  function mostrarDigitando() {
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-bot chat-typing';
    div.setAttribute('aria-label', t('digitando'));
    div.innerHTML = '<span></span><span></span><span></span>';
    els.corpo.appendChild(div);
    rolarFim();
    return div;
  }

  /* ── Envio ─────────────────────────────────────────────── */

  async function enviar(mensagem) {
    if (enviando || !mensagem.trim()) return;
    enviando = true;
    /* Escolha pendente perde o sentido assim que a conversa anda. */
    fecharQuantidade();

    const texto = mensagem.trim();
    addBolha('user', texto);
    historico.push({ role: 'user', content: texto });
    salvarHistorico();

    els.input.value = '';
    els.input.style.height = 'auto';
    els.enviar.disabled = true;

    const digitando = mostrarDigitando();

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: texto,
          /* Manda o histórico SEM a mensagem atual (o backend a recebe
             separada) e só com role/content — os cards são enfeite de tela,
             o modelo não precisa deles de volta. */
          historico: historico
            .slice(0, -1)
            .slice(-MAX_HISTORICO)
            .map(function (m) { return { role: m.role, content: m.content }; }),
          sessionId: sessionId(),
          idioma: lang
        })
      });

      const payload = await res.json().catch(function () { return {}; });
      digitando.remove();

      if (!res.ok) {
        addBolha('bot', payload.error || t('erroGenerico'));
        return;
      }

      const resposta = String(payload.resposta || '').trim();
      if (!resposta) {
        addBolha('bot', t('semResposta'));
        return;
      }

      addBolha('bot', resposta);

      const cards = Array.isArray(payload.produtos) ? payload.produtos : [];

      /* Diagnóstico no console do navegador. Se o card não aparecer, esta
         linha diz de imediato se o problema foi o backend não mandar nada ou
         o produto vir sem foto cadastrada no Shopify. */
      try {
        console.info(
          '[champion-chat] ferramentas:', (payload.ferramentas || []).join(', ') || 'nenhuma',
          '| cards:', cards.length,
          '| sem foto:', cards.filter(function (c) { return !c.foto; }).length
        );
      } catch (e) { /* console indisponível */ }

      addCards(cards);

      /* O agente fechou o pedido: os itens entram no carrinho do site e a
         prévia abre com o botão "Finalizar compra" à vista. É isto que
         substitui o link de pagamento colado no meio da conversa. */
      const paraCarrinho = Array.isArray(payload.carrinho) ? payload.carrinho : [];
      if (paraCarrinho.length) {
        let entrou = 0;
        paraCarrinho.forEach(function (i) {
          const ok = adicionarAoCarrinho(
            { handle: i.handle, nome: i.nome, foto: i.foto },
            { apresentacao: i.apresentacao, variantId: i.variantId, precoNum: i.precoNum },
            Math.min(Math.max(Number(i.quantidade) || 1, 1), 99)
          );
          if (ok) entrou += 1;
        });
        atualizarBadge();
        if (entrou) abrirCarrinho();
      }

      /* Os cards ficam guardados junto da mensagem para reaparecerem se a
         pessoa fechar e reabrir o chat. O backend descarta esse campo ao
         remontar o histórico para o modelo. */
      historico.push({ role: 'assistant', content: resposta, cards: cards });
      salvarHistorico();
    } catch (err) {
      digitando.remove();
      addBolha('bot', t('erroRede'));
    } finally {
      enviando = false;
      els.enviar.disabled = false;
      if (aberto) els.input.focus();
    }
  }

  /* ── Teclado do celular ────────────────────────────────── */

  /* Quando o teclado virtual abre, a viewport encolhe mas `100dvh` nem sempre
     acompanha em tempo real (iOS especialmente). O visualViewport dá a altura
     real disponível; repassamos como custom property e o CSS usa ela. */
  function acompanharTeclado() {
    const vv = window.visualViewport;
    if (!vv) return;

    function ajustar() {
      if (!aberto) return;
      const alturaReal = Math.round(vv.height);
      document.documentElement.style.setProperty('--chat-vh', alturaReal + 'px');
      /* Mantém a última mensagem à vista quando o teclado empurra o layout. */
      rolarFim();
    }

    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
  }

  /* ── Abrir / fechar ────────────────────────────────────── */

  function abrir() {
    aberto = true;
    aplicarIdioma();
    els.painel.hidden = false;
    els.fab.setAttribute('aria-expanded', 'true');
    els.fab.setAttribute('aria-label', t('fechar'));
    document.body.classList.add('chat-aberto');

    if (window.visualViewport) {
      document.documentElement.style.setProperty(
        '--chat-vh', Math.round(window.visualViewport.height) + 'px'
      );
    }

    /* Espera o painel pintar antes de animar, senão a transição não roda. */
    requestAnimationFrame(function () {
      els.painel.classList.add('is-open');
      /* Não damos foco automático no celular: o teclado subiria por cima da
         conversa antes de a pessoa ler a saudação. */
      if (window.matchMedia('(min-width: 561px)').matches) els.input.focus();
    });

    if (!els.corpo.children.length) {
      if (historico.length) {
        historico.forEach(function (m) {
          addBolha(m.role, m.content);
          if (m.cards) addCards(m.cards);
        });
      } else {
        addBolha('bot', t('saudacao'));
      }
    }
    rolarFim();
    iniciarTicker();
  }

  function fechar() {
    aberto = false;
    pararTicker();
    fecharModal();
    fecharQuantidade();
    fecharCarrinho();
    els.painel.classList.remove('is-open');
    els.fab.setAttribute('aria-expanded', 'false');
    els.fab.setAttribute('aria-label', t('abrir'));
    document.body.classList.remove('chat-aberto');
    setTimeout(function () { if (!aberto) els.painel.hidden = true; }, 260);
    els.fab.focus();
  }

  /* ── Montagem ──────────────────────────────────────────── */

  function montar() {
    if (document.getElementById('championChat')) return;

    lang = detectarIdioma();

    const wrap = document.createElement('div');
    wrap.id = 'championChat';
    wrap.className = 'chat-widget';
    wrap.innerHTML = [
      '<button type="button" class="chat-fab" id="chatFab" aria-expanded="false" aria-controls="chatPainel">',
      '  <svg class="chat-fab-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
      '  <svg class="chat-fab-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '</button>',
      '<section class="chat-painel" id="chatPainel" role="dialog" hidden>',
      '  <header class="chat-head">',
      '    <span class="chat-head-marca" aria-hidden="true">C</span>',
      '    <div class="chat-head-info">',
      '      <strong id="chatTitulo"></strong>',
      '      <span id="chatSubtitulo"></span>',
      '    </div>',
      '    <button type="button" class="chat-close" id="chatClose">',
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '    </button>',
      '  </header>',
      '  <div class="chat-corpo" id="chatCorpo" role="log" aria-live="polite" aria-atomic="false"></div>',
      '  <div class="chat-qtd" id="chatQtd" hidden>',
      '    <div class="chat-qtd-item">',
      '      <span class="chat-qtd-rotulo" id="chatQtdRotulo"></span>',
      '      <span class="chat-qtd-preco" id="chatQtdPreco"></span>',
      '    </div>',
      '    <div class="chat-qtd-linha">',
      '      <div class="chat-stepper">',
      '        <button type="button" id="chatQtdMenos">&minus;</button>',
      '        <span id="chatQtdValor">1</span>',
      '        <button type="button" id="chatQtdMais">+</button>',
      '      </div>',
      '      <button type="button" class="chat-qtd-ok" id="chatQtdOk"></button>',
      '      <button type="button" class="chat-qtd-x" id="chatQtdCancelar" aria-label="Cancelar">',
      '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '      </button>',
      '    </div>',
      '  </div>',
      '  <div class="chat-carrinho" id="chatCarrinho" hidden>',
      '    <div class="chat-carrinho-head">',
      '      <strong id="chatCarrinhoTitulo"></strong>',
      '      <button type="button" class="chat-carrinho-x" id="chatCarrinhoFechar">',
      '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '      </button>',
      '    </div>',
      '    <div class="chat-carrinho-itens" id="chatCarrinhoItens"></div>',
      '    <div class="chat-carrinho-pe" id="chatCarrinhoPe">',
      '      <div class="chat-carrinho-total"><span id="chatTotalRotulo"></span><strong id="chatTotalValor"></strong></div>',
      '      <button type="button" class="chat-carrinho-ok" id="chatFinalizar"></button>',
      '    </div>',
      '  </div>',
      '  <form class="chat-form" id="chatForm">',
      '    <textarea id="chatInput" rows="1" maxlength="1500"></textarea>',
      '    <button type="button" class="chat-cart-btn" id="chatCartBtn">',
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
      '      <span class="chat-cart-badge" id="chatCartBadge" hidden>0</span>',
      '    </button>',
      '    <button type="submit" id="chatEnviar">',
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
      '    </button>',
      '  </form>',
      '  <p class="chat-aviso" id="chatAviso"></p>',
      '</section>'
    ].join('');

    document.body.appendChild(wrap);

    els = {
      fab: document.getElementById('chatFab'),
      painel: document.getElementById('chatPainel'),
      corpo: document.getElementById('chatCorpo'),
      form: document.getElementById('chatForm'),
      input: document.getElementById('chatInput'),
      enviar: document.getElementById('chatEnviar'),
      fechar: document.getElementById('chatClose'),
      titulo: document.getElementById('chatTitulo'),
      subtitulo: document.getElementById('chatSubtitulo'),
      aviso: document.getElementById('chatAviso'),
      qtdBarra: document.getElementById('chatQtd'),
      qtdRotulo: document.getElementById('chatQtdRotulo'),
      qtdPreco: document.getElementById('chatQtdPreco'),
      qtdValor: document.getElementById('chatQtdValor'),
      qtdMenos: document.getElementById('chatQtdMenos'),
      qtdMais: document.getElementById('chatQtdMais'),
      qtdOk: document.getElementById('chatQtdOk'),
      qtdCancelar: document.getElementById('chatQtdCancelar'),
      cartBtn: document.getElementById('chatCartBtn'),
      cartBadge: document.getElementById('chatCartBadge'),
      carrinho: document.getElementById('chatCarrinho'),
      carrinhoTitulo: document.getElementById('chatCarrinhoTitulo'),
      carrinhoItens: document.getElementById('chatCarrinhoItens'),
      carrinhoFechar: document.getElementById('chatCarrinhoFechar'),
      carrinhoPe: document.getElementById('chatCarrinhoPe'),
      totalRotulo: document.getElementById('chatTotalRotulo'),
      totalValor: document.getElementById('chatTotalValor'),
      finalizar: document.getElementById('chatFinalizar')
    };

    historico = carregarHistorico();
    aplicarIdioma();

    els.fab.addEventListener('click', function () { aberto ? fechar() : abrir(); });
    els.fechar.addEventListener('click', fechar);

    els.cartBtn.addEventListener('click', function () {
      carrinhoVisivel() ? fecharCarrinho() : abrirCarrinho();
    });
    els.carrinhoFechar.addEventListener('click', fecharCarrinho);
    els.finalizar.addEventListener('click', function () {
      if (carrinhoDisponivel()) window.ChampionCart.checkout();
    });

    /* O carrinho pode mudar fora do chat (a pessoa adiciona pela vitrine numa
       outra aba do mesmo site, ou pelo card de produto). O main.js dispara
       este evento a cada save. */
    document.addEventListener('champion:cart', function () {
      atualizarBadge();
      if (carrinhoVisivel()) renderCarrinho();
    });
    atualizarBadge();

    els.form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      enviar(els.input.value);
    });

    /* Enter envia, Shift+Enter quebra linha. No celular o Enter é "nova linha"
       por convenção, então lá só o botão envia. */
    els.input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey && window.matchMedia('(min-width: 561px)').matches) {
        ev.preventDefault();
        enviar(els.input.value);
      }
    });

    /* Textarea cresce com o texto, até um teto. */
    els.input.addEventListener('input', function () {
      els.input.style.height = 'auto';
      els.input.style.height = Math.min(els.input.scrollHeight, 120) + 'px';
    });

    /* Esc fecha a camada mais interna primeiro: janela de variações, depois
       o seletor de quantidade, e só então o chat. */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (modalAberto()) { fecharModal(); return; }
      if (carrinhoVisivel()) { fecharCarrinho(); return; }
      if (els.qtdBarra && !els.qtdBarra.hidden) { fecharQuantidade(); return; }
      if (aberto) fechar();
    });

    /* O seletor de idioma do site troca data-lang sem recarregar a página. */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        if (detectarIdioma() !== lang) aplicarIdioma();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    }

    acompanharTeclado();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }
})();
