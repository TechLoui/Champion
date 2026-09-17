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
      convite: 'Compre aqui',
      atalhos: ['Ver produtos', 'Preços e embalagens', 'Falar com a equipe'],
      conviteSub: 'Tire dúvidas e monte seu pedido',
      conviteFechar: 'Dispensar convite',
      fechar: 'Fechar atendimento',
      placeholder: 'Mensagem...',
      enviar: 'Enviar',
      campo: 'Sua mensagem',
      saudacao:
        'Olá! Sou o atendente da Champion. Posso ajudar a encontrar o produto certo, ' +
        'ver preços e montar o seu pedido.\n\nMe diga o que você procura — ou escolha uma opção abaixo.',
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
      sobConsulta: 'Sob consulta',
      mostrarMais: 'Mostrar mais produtos',
      escolhaEmbalagem: 'Toque na embalagem para escolher a quantidade',
      embalagem: 'Embalagem',
      quantidade: 'Quantidade',
      consultaEquipe: 'Consultar equipe',
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
      convite: 'Buy here',
      atalhos: ['See products', 'Prices and sizes', 'Talk to the team'],
      conviteSub: 'Ask questions and build your order',
      conviteFechar: 'Dismiss',
      fechar: 'Close support chat',
      placeholder: 'Message...',
      enviar: 'Send',
      campo: 'Your message',
      saudacao:
        "Hello! I'm Champion's support agent. I can help you find the right product, " +
        'check prices and put your order together.\n\nTell me what you are looking for — or pick an option below.',
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
      sobConsulta: 'Price on request',
      mostrarMais: 'Show more products',
      escolhaEmbalagem: 'Tap a size to choose the quantity',
      embalagem: 'Size',
      quantidade: 'Quantity',
      consultaEquipe: 'Contact the team',
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
      convite: 'Compre aquí',
      atalhos: ['Ver productos', 'Precios y tamaños', 'Hablar con el equipo'],
      conviteSub: 'Resuelve dudas y arma tu pedido',
      conviteFechar: 'Descartar',
      fechar: 'Cerrar atención',
      placeholder: 'Mensaje...',
      enviar: 'Enviar',
      campo: 'Tu mensaje',
      saudacao:
        '¡Hola! Soy el asistente de Champion. Puedo ayudarte a encontrar el producto ' +
        'adecuado, consultar precios y armar tu pedido.\n\nDime qué buscas — o elige una opción abajo.',
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
      sobConsulta: 'Precio a consultar',
      mostrarMais: 'Mostrar más productos',
      escolhaEmbalagem: 'Toca una presentación para elegir la cantidad',
      embalagem: 'Presentación',
      quantidade: 'Cantidad',
      consultaEquipe: 'Consultar al equipo',
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
  let posicaoScroll = null;
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
  /* Alinha o TOPO da resposta com o topo da janela, em vez de rolar até o fim.
     Com cards de produto, rolar até o fim empurrava o texto do atendente para
     fora da área visível: o cliente via só os produtos e não a resposta.
     scrollTop se auto-limita, então em resposta curta isso não faz nada. */
  function rolarParaTopo(el) {
    if (!el) return;
    requestAnimationFrame(function () {
      const destino = el.getBoundingClientRect().top - els.corpo.getBoundingClientRect().top + els.corpo.scrollTop - 12;
      els.corpo.scrollTop = Math.max(0, destino);
    });
  }

  function rolarFim(forcar) {
    if (!forcar && !noFim()) return;
    requestAnimationFrame(function () {
      els.corpo.scrollTop = els.corpo.scrollHeight;
    });
  }

  /* Atalhos de partida. Existem porque o chat abria com um campo vazio: quem
     não sabia o que perguntar simplesmente fechava. Somem no primeiro uso —
     são um empurrão inicial, não um menu permanente. */
  function addAtalhos() {
    const opcoes = t('atalhos') || [];
    if (!opcoes.length) return;

    const caixa = document.createElement('div');
    caixa.className = 'chat-atalhos';

    opcoes.forEach(function (texto) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-atalho';
      b.textContent = texto;
      b.addEventListener('click', function () { enviar(texto); });
      caixa.appendChild(b);
    });

    els.corpo.appendChild(caixa);
  }

  function limparAtalhos() {
    const caixa = els.corpo && els.corpo.querySelector('.chat-atalhos');
    if (caixa) caixa.remove();
  }

  function addBolha(papel, texto, destino) {
    const eUsuario = papel === 'user';
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-' + (eUsuario ? 'user' : 'bot');

    /* Mensagens seguidas do mesmo lado se agrupam: espaçamento menor e só a
       primeira do bloco mantém o "rabinho" do balão. */
    const area = destino || els.corpo;
    const anterior = area.lastElementChild;
    if (anterior && anterior.classList.contains(eUsuario ? 'chat-msg-user' : 'chat-msg-bot')) {
      div.classList.add('is-seguida');
    }

    div.innerHTML = formatar(texto);
    area.appendChild(div);
    /* Mensagem nova sempre puxa a tela: quem acabou de escrever quer ver o
       que veio. */
    if (eUsuario) rolarFim(true);
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

  function compravel(a) {
    return Boolean(a && a.disponivel === true && a.compravel !== false &&
      !a.sobConsulta && Number.isFinite(Number(a.precoNum)) && Number(a.precoNum) > 0);
  }

  function ehMobile() {
    return window.matchMedia('(max-width: 560px), (pointer: coarse)').matches;
  }

  function precoApresentacao(a) {
    return Number.isFinite(Number(a.precoNum)) && Number(a.precoNum) > 0 && !a.sobConsulta
      ? (a.preco || moeda(a.precoNum)) : t('sobConsulta');
  }

  function addPagina(catalogo) {
    if (!catalogo) return;
    els.corpo.querySelectorAll('.chat-mais-produtos').forEach(function (b) { b.disabled = true; });
    if (!Number.isInteger(catalogo.proximoOffset) || catalogo.proximoOffset < 1) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-card-cta chat-mais-produtos';
    btn.textContent = t('mostrarMais');
    btn.addEventListener('click', async function () {
      if (enviando) return;
      btn.disabled = true;
      const ok = await enviar(t('mostrarMais'), { catalogoOffset: catalogo.proximoOffset });
      if (!ok) btn.disabled = false;
    });
    els.corpo.appendChild(btn);
  }

  function addCards(produtos, destino) {
    if (!Array.isArray(produtos) || !produtos.length) return;
    const grade = document.createElement('div');
    grade.className = 'chat-cards';
    produtos.slice(0, 4).forEach(function (p) {
      const aprs = Array.isArray(p.apresentacoes) ? p.apresentacoes : [];
      const card = document.createElement('article');
      card.className = 'chat-card';
      const foto = document.createElement('div');
      foto.className = 'chat-card-foto';
      const inicial = String(p.nome || '?').trim().charAt(0).toUpperCase();
      const imagem = urlSegura(p.foto);
      if (imagem) {
        const img = document.createElement('img');
        img.src = imagem;
        img.alt = p.nome || '';
        img.addEventListener('error', function () {
          foto.classList.add('sem-foto');
          foto.textContent = inicial;
        });
        foto.appendChild(img);
      } else {
        foto.classList.add('sem-foto');
        foto.textContent = inicial;
      }
      card.appendChild(foto);
      const info = document.createElement('div');
      info.className = 'chat-card-body';
      const nome = document.createElement('strong');
      const link = urlSegura(p.url);
      if (link) {
        const a = document.createElement('a');
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = t('verDetalhes');
        a.textContent = p.nome || '';
        nome.appendChild(a);
      } else nome.textContent = p.nome || '';
      info.appendChild(nome);
      const dica = document.createElement('span');
      dica.className = 'chat-card-dica';
      dica.textContent = aprs.some(compravel) ? t('escolhaEmbalagem') : t('consultaEquipe');
      info.appendChild(dica);
      card.appendChild(info);
      const variantes = document.createElement('div');
      variantes.className = 'chat-options';
      aprs.forEach(function (a) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chat-option';
        btn.disabled = !compravel(a);
        btn.innerHTML = '<span class="chat-option-nome"></span><span class="chat-option-preco"></span>';
        btn.querySelector('.chat-option-nome').textContent = a.apresentacao || t('embalagem');
        btn.querySelector('.chat-option-preco').textContent = precoApresentacao(a);
        if (a.disponivel === false) {
          const status = document.createElement('small');
          status.className = 'chat-option-status';
          status.textContent = t('esgotado');
          btn.appendChild(status);
        }
        btn.setAttribute('aria-expanded', 'false');
        btn.addEventListener('click', function () {
          if (enviando) return;
          pedirQuantidade(p, a, card);
          btn.classList.add('is-selected');
          btn.setAttribute('aria-expanded', 'true');
        });
        variantes.appendChild(btn);
      });
      card.appendChild(variantes);
      if (!aprs.some(compravel)) {
        const contato = document.createElement('a');
        contato.className = 'chat-consulta-link';
        contato.href = 'https://wa.me/556240150742';
        contato.target = '_blank';
        contato.rel = 'noopener';
        contato.textContent = t('consultaEquipe');
        card.appendChild(contato);
      }
      grade.appendChild(card);
    });
    (destino || els.corpo).appendChild(grade);
    return grade;
  }

  function addResposta(texto, cards, catalogo) {
    let ancora;
    if (Array.isArray(cards) && cards.length) {
      const grupo = document.createElement('div');
      grupo.className = 'chat-resposta-produtos';
      addBolha('assistant', texto, grupo);
      addCards(cards, grupo);
      els.corpo.appendChild(grupo);
      ancora = grupo;
    } else ancora = addBolha('assistant', texto);
    addPagina(catalogo);
    return ancora;
  }

  /* ── Seletor de quantidade ─────────────────────────────── */

  /* Aparece acima do campo de digitar depois que o cliente escolhe uma
     apresentação. Fica fora do histórico de mensagens de propósito: é uma
     ação pendente, não uma coisa que foi dita.

     Só existe para o caminho do clique. Quem digita "quero 3 baldes de 6 kg"
     não passa por aqui — o próprio agente entende e monta o carrinho. */
  function pedirQuantidade(produto, apresentacao, card) {
    if (!compravel(apresentacao) || !card || enviando) return;
    fecharQuantidade();
    let qtd = 1;
    const editor = document.createElement('div');
    editor.className = 'chat-inline-qtd';
    editor.innerHTML =
      '<div class="chat-stepper" role="group">' +
      '<button type="button" class="chat-menos">−</button><output>1</output>' +
      '<button type="button" class="chat-mais">+</button></div>' +
      '<button type="button" class="chat-inline-add"></button>' +
      '<button type="button" class="chat-inline-cancel">×</button>';
    editor.querySelector('.chat-stepper').setAttribute('aria-label', t('quantidade'));
    const menos = editor.querySelector('.chat-menos');
    const mais = editor.querySelector('.chat-mais');
    const adicionar = editor.querySelector('.chat-inline-add');
    const cancelar = editor.querySelector('.chat-inline-cancel');
    menos.setAttribute('aria-label', t('menos'));
    mais.setAttribute('aria-label', t('mais'));
    cancelar.setAttribute('aria-label', t('cancelar'));
    adicionar.textContent = t('adicionar');
    function ajustar(delta) {
      qtd = Math.min(Math.max(qtd + delta, 1), 99);
      editor.querySelector('output').textContent = String(qtd);
      menos.disabled = qtd <= 1;
      mais.disabled = qtd >= 99;
    }
    menos.onclick = function () { ajustar(-1); };
    mais.onclick = function () { ajustar(1); };
    cancelar.onclick = fecharQuantidade;
    adicionar.onclick = function () {
      if (enviando) return;
      fecharQuantidade();
      enviar(frasePedido(qtd, produto.nome, apresentacao.apresentacao));
    };
    card.appendChild(editor);
    ajustar(0);
    requestAnimationFrame(function () {
      const limite = els.corpo.getBoundingClientRect();
      const rect = editor.getBoundingClientRect();
      if (rect.bottom > limite.bottom - 8) els.corpo.scrollTop += rect.bottom - limite.bottom + 8;
    });
  }

  function fecharQuantidade() {
    if (els.qtdBarra) els.qtdBarra.hidden = true;
    if (!els.corpo) return;
    els.corpo.querySelectorAll('.chat-inline-qtd').forEach(function (e) { e.remove(); });
    els.corpo.querySelectorAll('.chat-option.is-selected').forEach(function (b) {
      b.classList.remove('is-selected');
      b.setAttribute('aria-expanded', 'false');
    });
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
    if (!carrinhoDisponivel() || !compravel(apresentacao) ||
        !Number.isInteger(qtd) || qtd < 1 || qtd > 99) return false;

    const apr = apresentacao.apresentacao || '';
    const vid = apresentacao.variantId || '';

    try {
      window.ChampionCart.add({
        /* Mesma convenção de id da vitrine (`produto|variante`), senão o
           mesmo item entraria duas vezes no carrinho. */
        id: vid ? produto.handle + '|' + vid : produto.handle,
        name: produto.nome + (apr && apr !== 'Padrão' ? ' · ' + apr : ''),
        price: Number(apresentacao.precoNum),
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

  async function enviar(mensagem, opcoes) {
    if (enviando || !mensagem.trim()) return;
    enviando = true;
    limparAtalhos();
    /* Escolha pendente perde o sentido assim que a conversa anda. */
    fecharQuantidade();

    const texto = mensagem.trim();
    addBolha('user', texto);
    historico.push({ role: 'user', content: texto });
    salvarHistorico();

    els.input.value = '';
    els.input.style.height = '44px';
    els.input.style.overflowY = 'hidden';
    if (ehMobile()) els.input.blur();
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
          idioma: lang,
          catalogoOffset: opcoes && Number.isInteger(opcoes.catalogoOffset) ? opcoes.catalogoOffset : undefined
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

      const bolhaResposta = addResposta(resposta, cards, payload.catalogo);
      rolarParaTopo(bolhaResposta);

      /* O agente fechou o pedido: os itens entram no carrinho do site e a
         prévia abre com o botão "Finalizar compra" à vista. É isto que
         substitui o link de pagamento colado no meio da conversa. */
      const paraCarrinho = Array.isArray(payload.carrinho) ? payload.carrinho : [];
      if (paraCarrinho.length) {
        let entrou = 0;
        paraCarrinho.forEach(function (i) {
          const ok = adicionarAoCarrinho(
            { handle: i.handle, nome: i.nome, foto: i.foto },
            { apresentacao: i.apresentacao, variantId: i.variantId, precoNum: i.precoNum,
              disponivel: i.disponivel, compravel: i.compravel, sobConsulta: i.sobConsulta },
            Number(i.quantidade)
          );
          if (ok) entrou += 1;
        });
        atualizarBadge();
        if (entrou && carrinhoVisivel()) renderCarrinho();
      }

      /* Os cards ficam guardados junto da mensagem para reaparecerem se a
         pessoa fechar e reabrir o chat. O backend descarta esse campo ao
         remontar o histórico para o modelo. */
      historico.push({ role: 'assistant', content: resposta, cards: cards, catalogo: payload.catalogo || null });
      salvarHistorico();
      return true;
    } catch (err) {
      digitando.remove();
      addBolha('bot', t('erroRede'));
    } finally {
      enviando = false;
      els.enviar.disabled = false;
      if (aberto && !ehMobile()) els.input.focus();
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
      document.documentElement.style.setProperty('--chat-vtop', Math.round(vv.offsetTop) + 'px');
    }

    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
  }

  /* ── Abrir / fechar ────────────────────────────────────── */

  /* ── Convite "Compre aqui" ────────────────────────────────────────────
     A bolinha do chat sozinha não diz o que há dentro: o visitante não
     imagina que dali saem preço e pedido. O balão diz.

     Regras para não virar praga: só aparece depois que a pessoa teve tempo
     de olhar a página, some no primeiro clique, e quem dispensar ou já
     tiver usado o chat não vê de novo por uma semana. ── */
  const CONVITE_CHAVE = 'champion-chat-convite';
  const CONVITE_ATRASO = 12000;   /* ms de leitura antes de convidar */
  const CONVITE_SILENCIO = 7 * 24 * 60 * 60 * 1000;
  let conviteTimer = null;

  function conviteSilenciado() {
    try {
      const quando = Number(localStorage.getItem(CONVITE_CHAVE) || 0);
      return Boolean(quando) && (Date.now() - quando) < CONVITE_SILENCIO;
    } catch (e) { return false; }   /* sem localStorage: mostra, não quebra */
  }

  function silenciarConvite() {
    try { localStorage.setItem(CONVITE_CHAVE, String(Date.now())); } catch (e) {}
  }

  function esconderConvite() {
    if (conviteTimer) { clearTimeout(conviteTimer); conviteTimer = null; }
    if (els.convite && !els.convite.hidden) {
      els.convite.classList.remove('is-on');
      els.convite.hidden = true;
    }
  }

  function agendarConvite() {
    if (!els.convite || aberto || conviteSilenciado()) return;
    conviteTimer = setTimeout(function () {
      if (aberto) return;
      els.conviteTitulo.textContent = t('convite');
      els.conviteSub.textContent = t('conviteSub');
      els.conviteFechar.setAttribute('aria-label', t('conviteFechar'));
      els.convite.hidden = false;
      requestAnimationFrame(function () { els.convite.classList.add('is-on'); });
    }, CONVITE_ATRASO);
  }

  function abrir() {
    aberto = true;
    esconderConvite();
    aplicarIdioma();
    els.painel.hidden = false;
    els.fab.setAttribute('aria-expanded', 'true');
    els.fab.setAttribute('aria-label', t('fechar'));
    document.body.classList.add('chat-aberto');
    document.documentElement.classList.add('chat-page-aberta');

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
      if (!ehMobile()) els.input.focus();
    });

    if (!els.corpo.children.length) {
      if (historico.length) {
        historico.forEach(function (m) {
          if (m.role === 'assistant') addResposta(m.content, m.cards, m.catalogo);
          else addBolha(m.role, m.content);
        });
      } else {
        addBolha('bot', t('saudacao'));
        addAtalhos();
      }
    }
    if (posicaoScroll != null) requestAnimationFrame(function () { els.corpo.scrollTop = posicaoScroll; });
    else rolarParaTopo(Array.from(els.corpo.querySelectorAll('.chat-msg-bot')).pop());
  }

  function fechar() {
    posicaoScroll = els.corpo.scrollTop;
    aberto = false;
    fecharQuantidade();
    fecharCarrinho();
    els.painel.classList.remove('is-open');
    els.fab.setAttribute('aria-expanded', 'false');
    els.fab.setAttribute('aria-label', t('abrir'));
    document.body.classList.remove('chat-aberto');
    document.documentElement.classList.remove('chat-page-aberta');
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
      '<div class="chat-convite" id="chatConvite" hidden>',
      '  <button type="button" class="chat-convite-corpo" id="chatConviteAbrir">',
      '    <strong id="chatConviteTitulo"></strong>',
      '    <span id="chatConviteSub"></span>',
      '  </button>',
      '  <button type="button" class="chat-convite-x" id="chatConviteFechar">',
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '  </button>',
      '</div>',
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
      convite: document.getElementById('chatConvite'),
      conviteAbrir: document.getElementById('chatConviteAbrir'),
      conviteTitulo: document.getElementById('chatConviteTitulo'),
      conviteSub: document.getElementById('chatConviteSub'),
      conviteFechar: document.getElementById('chatConviteFechar'),
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

    els.conviteAbrir?.addEventListener('click', function () {
      /* Clicou no convite: silencia e abre — foi o que ele pediu. */
      silenciarConvite();
      abrir();
    });
    els.conviteFechar?.addEventListener('click', function () {
      silenciarConvite();
      esconderConvite();
    });
    agendarConvite();

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
      if (ev.key === 'Enter' && !ev.shiftKey && !ehMobile()) {
        ev.preventDefault();
        enviar(els.input.value);
      }
    });

    /* Textarea cresce com o texto, até um teto. */
    els.input.addEventListener('input', function () {
      els.input.style.height = 'auto';
      els.input.style.height = Math.min(els.input.scrollHeight, 120) + 'px';
      els.input.style.overflowY = els.input.scrollHeight > 120 ? 'auto' : 'hidden';
    });

    /* Esc fecha a camada mais interna primeiro: janela de variações, depois
       o seletor de quantidade, e só então o chat. */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
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
