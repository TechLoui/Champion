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
      verProduto: 'Ver produto',
      quero: 'Quero o',
      aPartirDe: 'a partir de',
      apresentacoes: 'apresentações'
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
      verProduto: 'View product',
      quero: 'I want the',
      aPartirDe: 'from',
      apresentacoes: 'sizes'
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
      verProduto: 'Ver producto',
      quero: 'Quiero el',
      aPartirDe: 'desde',
      apresentacoes: 'presentaciones'
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

  function rolarFim() {
    els.corpo.scrollTop = els.corpo.scrollHeight;
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
    rolarFim();
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

      if (foto) {
        partes.push(
          '<div class="chat-card-foto"><img src="' + foto + '" alt="' + nome +
          '" loading="lazy" onerror="this.closest(\'.chat-card-foto\').remove()"></div>'
        );
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
            ' data-pedido="' + escapar(p.nome + ' ' + (a.apresentacao || '')) + '"' +
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

      if (link) {
        partes.push(
          '<a class="chat-card-cta" href="' + link + '" target="_blank" rel="noopener">' +
          escapar(t('verProduto')) + '</a>'
        );
      }

      partes.push('</div>');
      card.innerHTML = partes.join('');

      /* Tocar numa apresentação responde a pergunta "qual produto?" num toque,
         em vez de obrigar o cliente a digitar o nome e a embalagem. */
      card.querySelectorAll('.chat-slide').forEach(function (btn) {
        btn.addEventListener('click', function () {
          enviar(t('quero') + ' ' + btn.dataset.pedido);
        });
      });

      card.querySelectorAll('.chat-dot').forEach(function (dot) {
        dot.addEventListener('click', function () {
          irPara(card.querySelector('.chat-slider'), Number(dot.dataset.ir));
        });
      });

      grade.appendChild(card);
    });

    els.corpo.appendChild(grade);
    rolarFim();
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
      addCards(cards);

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
      '  <form class="chat-form" id="chatForm">',
      '    <textarea id="chatInput" rows="1" maxlength="1500"></textarea>',
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
      aviso: document.getElementById('chatAviso')
    };

    historico = carregarHistorico();
    aplicarIdioma();

    els.fab.addEventListener('click', function () { aberto ? fechar() : abrir(); });
    els.fechar.addEventListener('click', fechar);

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

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && aberto) fechar();
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
