/* Champion · Formulário de interesse
 *
 * Qualifica quem chega pelo site: quem é, onde está, e quais produtos quer.
 * Vai para o mesmo endpoint do contato (/api/leads), então cai no painel admin
 * e dispara o e-mail de notificação sem infraestrutura nova.
 *
 * Em passos porque um formulário longo numa tela só é abandonado. O primeiro
 * passo pede apenas o contato — se a pessoa desistir no meio, o lead já está
 * de pé e dá para retornar.
 *
 * Os produtos vêm do catálogo real da Shopify (window.ChampionShopify), não de
 * uma lista cravada aqui: lista fixa envelhece e passa a oferecer produto que
 * não existe mais. São carregados só ao chegar no passo 3, o que também dá
 * tempo do módulo da vitrine terminar de subir.
 *
 * Uso: <div data-lead-form></div> em qualquer página.
 *      data-titulo e data-subtitulo trocam o texto do topo.
 */
'use strict';

(function () {
  const API_URL = (typeof window !== 'undefined' && window.CHAMPION_API_URL)
    || 'https://champion-production-cab6.up.railway.app/api/leads';

  const PASSOS = [
    { rotulo: 'Você', titulo: 'Como falamos com você',
      ajuda: 'Só o suficiente para nossa equipe retornar.' },
    { rotulo: 'Região', titulo: 'Onde fica a sua criação',
      ajuda: 'Assim direcionamos para quem atende a sua região.' },
    { rotulo: 'Interesse', titulo: 'O que você procura',
      ajuda: 'Marque quantos quiser. Se não souber, é só dizer abaixo.' }
  ];

  const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
    'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const PERFIS = ['Pecuarista', 'Revenda', 'Veterinário', 'Cooperativa', 'Outro'];
  const REBANHOS = ['Até 100 cabeças', '100 a 500', '500 a 2.000', 'Mais de 2.000', 'Não se aplica'];
  const MOMENTOS = ['Quero comprar agora', 'Estou pesquisando', 'Quero uma visita técnica'];

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* Máscara que formata mas nunca bloqueia: validação rígida de telefone
     rejeita número legítimo e perde lead. */
  function mascararTelefone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  const campo = (id, rotulo, attrs) => `<label class="lead-campo">
      <span class="lead-rotulo">${esc(rotulo)}</span>
      <input id="${id}" ${attrs || ''} />
    </label>`;

  const selecao = (id, rotulo, opcoes) => `<label class="lead-campo">
      <span class="lead-rotulo">${esc(rotulo)}</span>
      <select id="${id}">
        <option value="">Selecione</option>
        ${opcoes.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
      </select>
    </label>`;

  function montar(raiz) {
    const titulo = raiz.dataset.titulo || 'Não sabe por onde começar?';
    const sub = raiz.dataset.subtitulo
      || 'Conte o que você precisa. Nossa equipe indica o produto certo para o seu rebanho.';

    raiz.innerHTML = `
      <div class="lead-box">
        <div class="lead-cabeca">
          <span class="lead-eyebrow">Atendimento técnico</span>
          <h2>${esc(titulo)}</h2>
          <p>${esc(sub)}</p>
        </div>

        <ol class="lead-trilha" aria-hidden="true">
          ${PASSOS.map((p, i) => `<li data-passo="${i}"><span>${i + 1}</span>${esc(p.rotulo)}</li>`).join('')}
        </ol>

        <form class="lead-form" novalidate>
          <div class="lead-tela" data-tela="0">
            <h3>${esc(PASSOS[0].titulo)}</h3>
            <p class="lead-ajuda">${esc(PASSOS[0].ajuda)}</p>
            <div class="lead-grade">
              ${campo('leadNome', 'Nome completo *', 'type="text" autocomplete="name" required')}
              ${campo('leadZap', 'Telefone / WhatsApp *', 'type="tel" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" required')}
            </div>
            <div class="lead-grade lead-grade-1">
              ${campo('leadEmail', 'E-mail', 'type="email" autocomplete="email" placeholder="seu@email.com"')}
            </div>
          </div>

          <div class="lead-tela" data-tela="1" hidden>
            <h3>${esc(PASSOS[1].titulo)}</h3>
            <p class="lead-ajuda">${esc(PASSOS[1].ajuda)}</p>
            <div class="lead-grade">
              ${selecao('leadEstado', 'Estado *', UFS)}
              ${campo('leadCidade', 'Cidade', 'type="text" autocomplete="address-level2" placeholder="Ex.: Rio Verde"')}
            </div>
            <div class="lead-grade">
              ${selecao('leadPerfil', 'Você é', PERFIS)}
              ${selecao('leadRebanho', 'Tamanho do rebanho', REBANHOS)}
            </div>
          </div>

          <div class="lead-tela" data-tela="2" hidden>
            <h3>${esc(PASSOS[2].titulo)}</h3>
            <p class="lead-ajuda">${esc(PASSOS[2].ajuda)}</p>
            <div class="lead-chips" data-grupo="produtos" data-carregando="1">
              <span class="lead-ajuda">Carregando produtos…</span>
            </div>
            <div class="lead-grade lead-grade-1">
              ${selecao('leadMomento', 'Quando pretende resolver', MOMENTOS)}
              <label class="lead-campo">
                <span class="lead-rotulo">Quer detalhar? (opcional)</span>
                <textarea id="leadObs" rows="3" maxlength="600"
                  placeholder="Conte o problema que quer resolver, se preferir."></textarea>
              </label>
            </div>
          </div>

          <p class="lead-aviso" data-aviso hidden></p>

          <div class="lead-pe">
            <button type="button" class="lead-btn lead-btn-voltar" data-voltar hidden>← Voltar</button>
            <button type="button" class="lead-btn lead-btn-avancar" data-avancar>Próximo →</button>
            <button type="submit" class="lead-btn lead-btn-enviar" data-enviar hidden>Enviar</button>
          </div>

          <ul class="lead-selos">
            <li>Sem compromisso</li>
            <li>Retorno em até 24h</li>
            <li>Orientação técnica gratuita</li>
          </ul>
        </form>
      </div>`;

    ligar(raiz);
  }

  /* Produtos do catálogo real. Espera o módulo da vitrine subir — ele é ES
     module, então carrega depois deste script. */
  function esperarShopify(tentativas) {
    return new Promise((resolve) => {
      let n = 0;
      (function tentar() {
        const api = window.ChampionShopify;
        if (api && typeof api.getProducts === 'function') return resolve(api);
        if (++n >= (tentativas || 40)) return resolve(null);
        setTimeout(tentar, 150);
      })();
    });
  }

  async function carregarProdutos(caixa, preSelecionado) {
    let nomes = [];
    try {
      const api = await esperarShopify();
      if (api) {
        const prods = await api.getProducts();
        nomes = (prods || [])
          .filter((p) => p && p.status !== 'draft' && p.name)
          .map((p) => p.name);
      }
    } catch (e) { /* catálogo indisponível: cai no campo livre abaixo */ }

    caixa.removeAttribute('data-carregando');

    if (!nomes.length) {
      /* Sem catálogo, não deixa o cliente sem saída: o campo de texto do passo
         3 continua lá e o aviso explica. */
      caixa.innerHTML = '<span class="lead-ajuda">Não consegui carregar a lista agora — '
        + 'descreva o que procura no campo abaixo.</span>';
      return;
    }

    caixa.innerHTML = nomes.map((n) =>
      `<button type="button" class="lead-chip" data-valor="${esc(n)}">${esc(n)}</button>`).join('')
      + '<button type="button" class="lead-chip" data-valor="Não sei, quero orientação">Não sei, quero orientação</button>';

    caixa.querySelectorAll('.lead-chip').forEach((c) => {
      c.addEventListener('click', () => c.classList.toggle('is-on'));
      /* Na página de um produto, ele já vem marcado: é o que a pessoa está
         olhando, e pedir para marcar de novo é atrito à toa. */
      if (preSelecionado && c.dataset.valor.toLowerCase() === preSelecionado.toLowerCase()) {
        c.classList.add('is-on');
      }
    });
  }

  function ligar(raiz) {
    const form = raiz.querySelector('.lead-form');
    const telas = Array.from(raiz.querySelectorAll('.lead-tela'));
    const trilha = Array.from(raiz.querySelectorAll('.lead-trilha li'));
    const aviso = raiz.querySelector('[data-aviso]');
    const bVoltar = raiz.querySelector('[data-voltar]');
    const bAvancar = raiz.querySelector('[data-avancar]');
    const bEnviar = raiz.querySelector('[data-enviar]');
    const zap = raiz.querySelector('#leadZap');
    const caixaProdutos = raiz.querySelector('[data-grupo="produtos"]');
    let atual = 0;
    let produtosPedidos = false;

    /* Numa página de produto, o <h1> é o nome dele. */
    const nomeDaPagina = (document.getElementById('detailName') || {}).textContent || '';

    zap.addEventListener('input', () => { zap.value = mascararTelefone(zap.value); });

    const dizer = (msg, tipo) => {
      aviso.textContent = msg || '';
      aviso.hidden = !msg;
      aviso.dataset.tipo = tipo || '';
    };

    function pintar() {
      telas.forEach((t, i) => { t.hidden = i !== atual; });
      trilha.forEach((li, i) => {
        li.classList.toggle('is-on', i === atual);
        li.classList.toggle('is-feito', i < atual);
      });
      bVoltar.hidden = atual === 0;
      bAvancar.hidden = atual === telas.length - 1;
      bEnviar.hidden = atual !== telas.length - 1;
      dizer('');

      if (atual === 2 && !produtosPedidos) {
        produtosPedidos = true;
        carregarProdutos(caixaProdutos, nomeDaPagina.trim());
      }
    }

    function validar(passo) {
      if (passo === 0) {
        const nome = raiz.querySelector('#leadNome').value.trim();
        const fone = zap.value.replace(/\D/g, '');
        if (nome.length < 2) { dizer('Precisamos do seu nome para retornar.', 'erro'); return false; }
        if (fone.length < 10) { dizer('Informe um telefone com DDD.', 'erro'); return false; }
      }
      if (passo === 1 && !raiz.querySelector('#leadEstado').value) {
        dizer('Escolha o estado para direcionarmos ao time certo.', 'erro');
        return false;
      }
      return true;
    }

    bAvancar.addEventListener('click', () => {
      if (!validar(atual)) return;
      atual = Math.min(atual + 1, telas.length - 1);
      pintar();
    });
    bVoltar.addEventListener('click', () => { atual = Math.max(atual - 1, 0); pintar(); });

    const marcados = () => Array.from(raiz.querySelectorAll('[data-grupo="produtos"] .lead-chip.is-on'))
      .map((c) => c.dataset.valor);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      for (let i = 0; i <= 1; i++) {
        if (!validar(i)) { atual = i; pintar(); return; }
      }

      const d = {
        nome: raiz.querySelector('#leadNome').value.trim(),
        email: raiz.querySelector('#leadEmail').value.trim(),
        zap: zap.value.trim(),
        estado: raiz.querySelector('#leadEstado').value,
        cidade: raiz.querySelector('#leadCidade').value.trim(),
        perfil: raiz.querySelector('#leadPerfil').value,
        rebanho: raiz.querySelector('#leadRebanho').value,
        produtos: marcados(),
        momento: raiz.querySelector('#leadMomento').value,
        obs: raiz.querySelector('#leadObs').value.trim()
      };

      const local = [d.cidade, d.estado].filter(Boolean).join(' / ');

      /* As respostas vão dentro de `message`, legíveis no painel e no e-mail, e
         também soltas no corpo — assim, quando o backend passar a gravá-las em
         campo próprio, não é preciso mexer aqui. */
      const linhas = [
        local && `Local: ${local}`,
        d.perfil && `Perfil: ${d.perfil}`,
        d.rebanho && `Rebanho: ${d.rebanho}`,
        d.produtos.length && `Produtos de interesse: ${d.produtos.join(', ')}`,
        d.momento && `Momento: ${d.momento}`,
        d.obs && `\nObservação: ${d.obs}`
      ].filter(Boolean);

      bEnviar.disabled = true;
      bEnviar.textContent = 'Enviando...';
      dizer('');

      try {
        const r = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: d.nome,
            email: d.email,
            phone: d.zap,
            message: linhas.join('\n'),
            source: 'Formulário de interesse — ' + (document.title || location.pathname),
            cidade: local,
            estado: d.estado,
            perfil: d.perfil,
            rebanho: d.rebanho,
            interesse: d.produtos,
            momento: d.momento
          })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);

        raiz.querySelector('.lead-box').innerHTML = `
          <div class="lead-pronto">
            <strong>Recebemos, ${esc(d.nome.split(' ')[0])}.</strong>
            <p>Nossa equipe entra em contato pelo WhatsApp em até 24 horas.
               Se preferir adiantar, fale com a gente agora.</p>
            <a class="lead-btn lead-btn-enviar" target="_blank" rel="noopener"
               href="https://api.whatsapp.com/send/?phone=556240150742&type=phone_number&app_absent=0">
               Falar no WhatsApp</a>
          </div>`;
      } catch (e) {
        bEnviar.disabled = false;
        bEnviar.textContent = 'Enviar';
        dizer('Não consegui enviar agora. Tente de novo ou chame no WhatsApp.', 'erro');
      }
    });

    pintar();
  }

  function iniciar() {
    document.querySelectorAll('[data-lead-form]').forEach(montar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
