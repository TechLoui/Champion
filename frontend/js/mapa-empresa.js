/* Champion · Mapa da empresa
 *
 * Abre a planta da fábrica em tela cheia. Um mapa de instalação só serve se
 * der para ampliar: aberto "encaixado na tela" num celular, nenhum rótulo é
 * legível. Por isso o visualizador tem zoom e arrasto, não é só uma imagem
 * grande.
 *
 * Sobre a horizontal no celular: a Screen Orientation API só funciona em tela
 * cheia e nem todo navegador implementa — o Safari do iPhone não trava
 * orientação de jeito nenhum. Então tentamos travar de verdade e, quando não
 * dá, giramos o conteúdo 90° por CSS. O resultado é o mesmo para quem olha, e
 * funciona em qualquer aparelho.
 *
 * Uso: <button data-mapa-empresa>…</button> em qualquer página.
 *      data-src troca o caminho da imagem.
 */
'use strict';

(function () {
  /* O arquivo entregue tem espaço no nome, então precisa ir codificado. Os
     outros nomes ficam como rede: se um dia trocarem o PNG por um JPG ou WebP
     comprimido, o mapa continua abrindo sem mexer aqui. A ordem é a ordem de
     preferência — formatos leves primeiro. */
  const CANDIDATOS = [
    '/assets/mapachamp/mapa.webp',
    '/assets/mapachamp/mapa.jpg',
    '/assets/mapachamp/MAPA%20PIXEL.png',
    '/assets/mapachamp/mapa.png',
    '/assets/mapachamp/mapa.svg'
  ];
  /* Trilha de fundo do mapa. Primeiro o nome que existe hoje na pasta: pedir
     musica.mp3 antes custaria um 404 a cada abertura e atrasaria o início do
     som. Os outros ficam de rede para quando o arquivo for renomeado.
     O conteúdo é MP3 apesar da extensão .mpeg — ver o AddType no .htaccess. */
  const MUSICA_FONTES = [
    '/assets/mapachamp/musica.mpeg',
    '/assets/mapachamp/musica.mp3',
    '/assets/mapachamp/musica.ogg'
  ];

  /* Volume de fundo, o mesmo em qualquer aparelho.

     Chegou a haver um valor por tipo de ponteiro, porque o iOS ignora esta
     propriedade (lá quem manda são os botões do aparelho) e o mesmo número
     soava mais alto no celular. Na escuta os dois ficaram bons em 0.50, então
     o desvio saiu: dois caminhos que devolvem o mesmo número são só uma
     chance a mais de divergirem quando alguém for ajustar. */
  const VOLUME_AMBIENTE = 0.50;
  const ENTRADA_MS = 2200;
  const SAIDA_MS = 700;

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 6;

  let caixa = null;      /* o overlay, criado uma vez e reaproveitado */
  let img = null;
  let palco = null;
  let musica = null;
  let musicaMutada = false;
  let devolverFoco = null;
  let aberto = false;
  let pedidoMusica = 0;
  let quadroAlinhamento = 0;
  let timerFechar = 0;
  let timerDica = 0;
  let timerFade = 0;

  let escala = 1;
  let x = 0;
  let y = 0;
  let girado = false;

  /* ── Estado visual ────────────────────────────────────────────────────── */

  function aplicar() {
    if (!img) return;
    const giro = girado ? ' rotate(90deg)' : '';
    img.style.transform = `translate(${x}px, ${y}px) scale(${escala})${giro}`;
    caixa.classList.toggle('is-ampliado', escala > 1.01);
  }

  function reenquadrar() {
    escala = 1;
    x = 0;
    y = 0;
    aplicar();
  }

  /* O enquadramento acompanha o viewport, inclusive quando o navegador muda
     de tamanho ao entrar em tela cheia ou quando o aparelho gira. */
  function alinharNaTela() {
    if (!caixa || !aberto) return;
    girado = ehEstreito() && window.innerHeight > window.innerWidth;
    caixa.classList.toggle('is-girado', girado);
    reenquadrar();
  }

  function agendarAlinhamento() {
    if (!aberto || quadroAlinhamento) return;
    quadroAlinhamento = requestAnimationFrame(() => {
      quadroAlinhamento = 0;
      alinharNaTela();
    });
  }

  /* Entra e sai devagar. Música de fundo que começa e corta seco chama mais
     atenção que a própria música — o que faz o som soar "ambiente" é a
     ausência de bordas, não só o volume baixo. */
  function esmaecer(destino, ms, aoTerminar) {
    if (!musica) return;
    if (timerFade) { clearInterval(timerFade); timerFade = 0; }

    const inicio = musica.volume;
    const passos = Math.max(1, Math.round(ms / 50));
    let n = 0;

    timerFade = setInterval(() => {
      n += 1;
      const t = n / passos;
      musica.volume = Math.min(1, Math.max(0, inicio + (destino - inicio) * t));
      if (n >= passos) {
        clearInterval(timerFade);
        timerFade = 0;
        if (aoTerminar) aoTerminar();
      }
    }, 50);
  }

  function tocarMusica() {
    const pedidoAtual = ++pedidoMusica;

    if (!musica) {
      musica = new Audio();
      musica.loop = true;
      musica.preload = 'auto';
      musica.muted = musicaMutada;

      /* O arquivo entregue veio como .mpeg, mas é MP3 (cabeçalho ID3). Alguns
         servidores mandam .mpeg como video/mpeg e o elemento de áudio recusa.
         Tentar a lista resolve hoje e continua valendo se um dia o arquivo for
         renomeado para .mp3. */
      let i = 0;
      const tentarFonte = () => {
        if (i >= MUSICA_FONTES.length) return; /* sem música: o mapa segue */
        musica.src = MUSICA_FONTES[i++];
        musica.load();
      };
      musica.addEventListener('error', tentarFonte);
      tentarFonte();
    }

    try { musica.currentTime = 0; } catch (err) { /* ainda sem metadados */ }

    /* Começa em silêncio e sobe: o primeiro instante é o mais incômodo. */
    musica.volume = 0;

    let reproducao;
    try {
      reproducao = musica.play();
    } catch (err) {
      return;
    }
    if (reproducao && typeof reproducao.then === 'function') {
      reproducao.then(() => {
        /* Se o carregamento terminou depois de o mapa fechar, não deixa o
           áudio começar atrasado em segundo plano. */
        if (!aberto || pedidoAtual !== pedidoMusica) { musica.pause(); return; }
        esmaecer(VOLUME_AMBIENTE, ENTRADA_MS);
      }).catch(() => { /* o navegador pode bloquear reprodução automática */ });
    } else {
      esmaecer(VOLUME_AMBIENTE, ENTRADA_MS);
    }
  }

  function pararMusica() {
    pedidoMusica += 1;
    if (!musica) return;

    /* Sai desaparecendo em vez de sumir de uma vez. Se já está inaudível,
       corta direto — esperar meio segundo por nada só atrasa o fechamento. */
    if (musica.volume < 0.01 || musica.paused) {
      if (timerFade) { clearInterval(timerFade); timerFade = 0; }
      musica.pause();
      try { musica.currentTime = 0; } catch (err) { /* nada carregado ainda */ }
      return;
    }

    esmaecer(0, SAIDA_MS, () => {
      musica.pause();
      try { musica.currentTime = 0; } catch (err) { /* nada carregado ainda */ }
    });
  }

  function atualizarBotaoSom() {
    if (!caixa) return;
    const botao = caixa.querySelector('[data-som]');
    if (!botao) return;

    botao.setAttribute('aria-checked', String(!musicaMutada));
    botao.title = musicaMutada ? 'Ativar música' : 'Mutar música';
    botao.querySelector('[data-som-ligado]').hidden = musicaMutada;
    botao.querySelector('[data-som-mutado]').hidden = !musicaMutada;
  }

  function alternarSom() {
    musicaMutada = !musicaMutada;
    if (musica) musica.muted = musicaMutada;
    atualizarBotaoSom();
  }

  /* Zoom ancorado no ponto apontado: ampliar sempre pelo centro faz o detalhe
     que a pessoa quer ver escapar da tela. */
  function zoomPara(novaEscala, pontoX, pontoY) {
    const alvo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, novaEscala));
    if (alvo === escala) return;

    const r = palco.getBoundingClientRect();
    const cx = pontoX - r.left - r.width / 2;
    const cy = pontoY - r.top - r.height / 2;
    const k = alvo / escala;

    x = cx - (cx - x) * k;
    y = cy - (cy - y) * k;
    escala = alvo;

    if (escala === ZOOM_MIN) { x = 0; y = 0; }
    aplicar();
  }

  /* ── Orientação no celular ────────────────────────────────────────────── */

  function ehEstreito() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  async function tentarDeitar() {
    if (!ehEstreito()) return;

    /* Caminho bom: tela cheia de verdade + trava de orientação. */
    try {
      if (caixa.requestFullscreen) await caixa.requestFullscreen({ navigationUI: 'hide' });
      else if (caixa.webkitRequestFullscreen) caixa.webkitRequestFullscreen();
    } catch (err) { /* recusado (gesto não confiável, iOS): segue para o giro */ }

    if (!aberto) {
      desfazerOrientacao();
      return;
    }

    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
        if (!aberto) {
          desfazerOrientacao();
          return;
        }
        girado = false;
        caixa.classList.remove('is-girado');
        reenquadrar();
        return;
      }
    } catch (err) { /* navegador não trava orientação: gira por CSS */ }

    /* Só gira se o aparelho está de fato em pé. Se a pessoa já virou o
       telefone, girar de novo deixaria o mapa de cabeça para o lado. */
    alinharNaTela();
  }

  function desfazerOrientacao() {
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (err) { /* nada a desfazer */ }
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (err) { /* idem */ }
    girado = false;
    caixa.classList.remove('is-girado');
  }

  /* ── Montagem ─────────────────────────────────────────────────────────── */

  function montar() {
    caixa = document.createElement('div');
    caixa.className = 'mapa-overlay';
    caixa.id = 'mapaEmpresa';
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    caixa.setAttribute('aria-label', 'Mapa da empresa');
    caixa.hidden = true;

    caixa.innerHTML = [
      '<div class="mapa-palco" data-palco>',
      '  <img class="mapa-img" alt="Mapa da Champion Saúde Animal" draggable="false" hidden />',
      '  <div class="mapa-carga" data-carga hidden>',
      '    <span>Carregando o mapa…</span>',
      '    <span class="mapa-barra-trilho"><i class="mapa-barra" data-barra></i></span>',
      '  </div>',
      '  <p class="mapa-erro" data-erro hidden>Não consegui carregar o mapa.</p>',
      '</div>',
      '<div class="mapa-zoom">',
      '  <button type="button" class="mapa-btn" data-som role="switch" aria-label="Música do mapa" aria-checked="true" title="Mutar música">',
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '      <path d="M11 5 6 9H3v6h3l5 4z"/>',
      '      <g data-som-ligado><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8.5 8.5 0 0 1 0 12"/></g>',
      '      <g data-som-mutado hidden><path d="m16 9 5 5"/><path d="m21 9-5 5"/></g>',
      '    </svg>',
      '  </button>',
      '  <button type="button" class="mapa-btn" data-menos aria-label="Diminuir zoom">',
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      '  </button>',
      '  <button type="button" class="mapa-btn mapa-btn-texto" data-reset>Ajustar à tela</button>',
      '  <button type="button" class="mapa-btn" data-mais aria-label="Aumentar zoom">',
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      '  </button>',
      '</div>',
      '<button type="button" class="mapa-fechar" data-fechar>',
      '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '  <span>Fechar</span>',
      '</button>',
      '<p class="mapa-dica" data-dica>Arraste para mover · role ou belisque para ampliar</p>'
    ].join('');

    document.body.appendChild(caixa);

    img = caixa.querySelector('.mapa-img');
    palco = caixa.querySelector('[data-palco]');

    ligarControles();
    ligarGestos();
  }

  function ligarControles() {
    caixa.querySelector('[data-fechar]').addEventListener('click', fechar);
    caixa.querySelector('[data-som]').addEventListener('click', alternarSom);
    caixa.querySelector('[data-reset]').addEventListener('click', reenquadrar);
    atualizarBotaoSom();

    const centro = () => {
      const r = palco.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    caixa.querySelector('[data-mais]').addEventListener('click', () => zoomPara(escala * 1.5, ...centro()));
    caixa.querySelector('[data-menos]').addEventListener('click', () => zoomPara(escala / 1.5, ...centro()));

    /* Clicar no fundo fecha; clicar no mapa, não. */
    palco.addEventListener('click', (ev) => { if (ev.target === palco) fechar(); });

    document.addEventListener('keydown', (ev) => {
      if (caixa.hidden) return;
      if (ev.key === 'Escape') { ev.preventDefault(); fechar(); }
      if (ev.key === '+' || ev.key === '=') zoomPara(escala * 1.5, ...centro());
      if (ev.key === '-') zoomPara(escala / 1.5, ...centro());
      if (ev.key === '0') reenquadrar();
    });

    /* Sair da tela cheia pelo gesto do sistema também fecha: senão o overlay
       fica aberto sem tela cheia e a pessoa não entende o que houve. */
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && !caixa.hidden && ehEstreito()) fechar();
    });

    window.addEventListener('resize', agendarAlinhamento);
    window.addEventListener('orientationchange', agendarAlinhamento);
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener('change', agendarAlinhamento);
    }
  }

  function ligarGestos() {
    /* Arrasto com mouse ou um dedo. */
    let arrastando = false;
    let px = 0;
    let py = 0;

    palco.addEventListener('pointerdown', (ev) => {
      if (ev.target !== img) return;
      arrastando = true;
      px = ev.clientX;
      py = ev.clientY;
      /* A imagem precisa capturar o ponteiro. Quando o palco capturava, o
         navegador retargeteava o click para o fundo e fechava o mapa. */
      img.setPointerCapture(ev.pointerId);
      caixa.classList.add('is-arrastando');
    });

    palco.addEventListener('pointermove', (ev) => {
      if (!arrastando) return;
      x += ev.clientX - px;
      y += ev.clientY - py;
      px = ev.clientX;
      py = ev.clientY;
      aplicar();
    });

    const soltar = (ev) => {
      if (!arrastando) return;
      arrastando = false;
      try { img.releasePointerCapture(ev.pointerId); } catch (err) { /* já solto */ }
      caixa.classList.remove('is-arrastando');
    };
    palco.addEventListener('pointerup', soltar);
    palco.addEventListener('pointercancel', soltar);

    /* Roda do mouse / trackpad. passive:false porque precisamos do
       preventDefault: sem ele a página atrás rola junto. */
    palco.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      zoomPara(escala * (ev.deltaY < 0 ? 1.18 : 1 / 1.18), ev.clientX, ev.clientY);
    }, { passive: false });

    /* Beliscar com dois dedos. */
    let distancia0 = 0;
    let escala0 = 1;
    const dist = (t) => Math.hypot(
      t[0].clientX - t[1].clientX,
      t[0].clientY - t[1].clientY
    );

    palco.addEventListener('touchstart', (ev) => {
      if (ev.touches.length !== 2) return;
      distancia0 = dist(ev.touches);
      escala0 = escala;
    }, { passive: true });

    palco.addEventListener('touchmove', (ev) => {
      if (ev.touches.length !== 2 || !distancia0) return;
      ev.preventDefault();
      const meioX = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
      const meioY = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
      zoomPara(escala0 * (dist(ev.touches) / distancia0), meioX, meioY);
    }, { passive: false });

    palco.addEventListener('touchend', () => { distancia0 = 0; });

    /* Dois toques rápidos alternam entre ajustado e ampliado. */
    let ultimoToque = 0;
    palco.addEventListener('click', (ev) => {
      if (ev.target !== img) return;
      const agora = Date.now();
      if (agora - ultimoToque < 300) {
        if (escala > 1.01) reenquadrar();
        else zoomPara(2.5, ev.clientX, ev.clientY);
      }
      ultimoToque = agora;
    });
  }

  /* ── Carregamento da imagem ───────────────────────────────────────────── */

  let carregada = false;
  let carregando = false;

  /* O mapa entregue tem 18,8 MB. Numa conexão de celular isso é meio minuto de
     espera, e meio minuto de tela preta sem sinal de vida parece travamento —
     a pessoa fecha antes de ver o mapa. Por isso o download passa por fetch
     com leitura em pedaços: dá para mostrar a porcentagem de verdade.

     Se o fetch falhar (servidor sem Content-Length, CORS, navegador antigo),
     cai para o <img> comum, que é mais burro mas sempre funciona. */
  async function carregar(src) {
    if (carregando) return;
    carregando = true;

    const erro = caixa.querySelector('[data-erro]');
    const carga = caixa.querySelector('[data-carga]');
    const barra = caixa.querySelector('[data-barra]');
    const lista = src ? [src] : CANDIDATOS;

    erro.hidden = true;
    img.hidden = true;
    carga.hidden = false;
    barra.style.width = '0%';

    for (const alvo of lista) {
      try {
        const r = await fetch(alvo);
        if (!r.ok) continue;

        const total = Number(r.headers.get('content-length')) || 0;
        const leitor = r.body && r.body.getReader ? r.body.getReader() : null;

        let blob;
        if (leitor && total) {
          const pedacos = [];
          let lidos = 0;
          for (;;) {
            const { done, value } = await leitor.read();
            if (done) break;
            pedacos.push(value);
            lidos += value.length;
            barra.style.width = Math.min(100, (lidos / total) * 100) + '%';
          }
          blob = new Blob(pedacos, { type: r.headers.get('content-type') || 'image/png' });
        } else {
          /* Sem Content-Length não há porcentagem honesta a mostrar: a barra
             fica indeterminada em vez de inventar um número. */
          barra.parentElement.classList.add('is-indeterminada');
          blob = await r.blob();
        }

        img.src = URL.createObjectURL(blob);
        img.onload = () => {
          carga.hidden = true;
          img.hidden = false;
          carregada = true;
          carregando = false;
          agendarAlinhamento();
        };
        return;
      } catch (err) {
        /* tenta o próximo candidato */
      }
    }

    /* Nenhum candidato respondeu pelo fetch: última tentativa pelo <img>. */
    let i = 0;
    (function tentarImg() {
      if (i >= lista.length) {
        carga.hidden = true;
        erro.hidden = false;
        erro.textContent = 'Não consegui carregar o mapa. Confira se o arquivo está em '
          + decodeURIComponent(lista[0]) + '.';
        carregando = false;
        return;
      }
      const alvo = lista[i++];
      const teste = new Image();
      teste.onload = () => {
        img.src = alvo;
        img.hidden = false;
        carga.hidden = true;
        carregada = true;
        carregando = false;
        agendarAlinhamento();
      };
      teste.onerror = tentarImg;
      teste.src = alvo;
    })();
  }

  /* ── Abrir e fechar ───────────────────────────────────────────────────── */

  function abrir(botao) {
    if (!caixa) montar();
    if (!carregada) carregar(botao && botao.dataset.src);

    clearTimeout(timerFechar);
    clearTimeout(timerDica);
    devolverFoco = botao || null;
    aberto = true;
    caixa.hidden = false;
    document.body.classList.add('mapa-aberto');
    alinharNaTela();
    tocarMusica();

    /* Precisa de um quadro para a transição sair do estado inicial. */
    requestAnimationFrame(() => caixa.classList.add('is-on'));

    tentarDeitar().finally(agendarAlinhamento);
    caixa.querySelector('[data-fechar]').focus();

    /* A dica some sozinha: depois de alguns segundos ela só atrapalha. */
    const dica = caixa.querySelector('[data-dica]');
    dica.classList.remove('is-off');
    timerDica = setTimeout(() => dica.classList.add('is-off'), 4000);
  }

  function fechar() {
    if (!caixa || !aberto) return;
    aberto = false;
    pararMusica();
    clearTimeout(timerDica);
    desfazerOrientacao();
    caixa.classList.remove('is-on');
    document.body.classList.remove('mapa-aberto');

    timerFechar = setTimeout(() => {
      caixa.hidden = true;
      if (devolverFoco) devolverFoco.focus();
    }, 220);
  }

  /* ── Ligação ──────────────────────────────────────────────────────────── */

  function iniciar() {
    const botoes = document.querySelectorAll('[data-mapa-empresa]');
    if (!botoes.length) return;
    botoes.forEach((b) => {
      b.addEventListener('click', (ev) => { ev.preventDefault(); abrir(b); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
