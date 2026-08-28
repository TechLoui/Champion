/* Champion · Formulário de interesse
 *
 * Qualifica quem chega pelo site: quem é, que rebanho tem, o que procura e com
 * que urgência. Vai para o mesmo endpoint do contato (/api/leads), então cai no
 * painel admin e dispara o e-mail de notificação sem infraestrutura nova.
 *
 * Em passos porque um formulário de dez campos numa tela só é abandonado; três
 * telas de três ou quatro campos, não. O primeiro passo pede só o contato — se
 * a pessoa desistir no meio, já dá para retornar.
 *
 * Uso: <div data-lead-form></div> em qualquer página. O título e o subtítulo
 * podem vir de data-titulo e data-subtitulo.
 */
'use strict';

(function () {
  const API_URL = (typeof window !== 'undefined' && window.CHAMPION_API_URL)
    || 'https://champion-production-cab6.up.railway.app/api/leads';

  const PASSOS = [
    { id: 'voce', rotulo: 'Você', titulo: 'Como falamos com você',
      ajuda: 'Só o suficiente para nossa equipe retornar.' },
    { id: 'rebanho', rotulo: 'Rebanho', titulo: 'Sobre a sua criação',
      ajuda: 'Ajuda a indicar o produto certo em vez de um catálogo inteiro.' },
    { id: 'interesse', rotulo: 'Interesse', titulo: 'O que você procura',
      ajuda: 'Pode marcar mais de um.' }
  ];

  const PERFIS = ['Pecuarista', 'Revenda', 'Veterinário', 'Cooperativa', 'Outro'];
  const ESPECIES = ['Bovinos', 'Equinos', 'Suínos', 'Aves', 'Ovinos'];
  const REBANHOS = ['Até 100 cabeças', '100 a 500', '500 a 2.000', 'Mais de 2.000', 'Não se aplica'];
  const INTERESSES = [
    'Controle de mosca e carrapato',
    'Mineralização',
    'Nutrição e ganho de peso',
    'Reprodução',
    'Quero orientação técnica'
  ];
  const MOMENTOS = ['Quero comprar agora', 'Estou pesquisando', 'Quero uma visita técnica'];

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* Máscara simples de telefone: só formata, nunca impede de digitar — validação
     rígida em campo de telefone rejeita número legítimo e perde lead. */
  function mascararTelefone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function campo(id, rotulo, attrs) {
    return `<label class="lead-campo">
      <span class="lead-rotulo">${esc(rotulo)}</span>
      <input id="${id}" ${attrs || ''} />
    </label>`;
  }

  function chips(nome, opcoes) {
    return `<div class="lead-chips" data-grupo="${nome}">`
      + opcoes.map((o) => `<button type="button" class="lead-chip" data-valor="${esc(o)}">${esc(o)}</button>`).join('')
      + '</div>';
  }

  function selecao(id, rotulo, opcoes) {
    return `<label class="lead-campo">
      <span class="lead-rotulo">${esc(rotulo)}</span>
      <select id="${id}">
        <option value="">Selecione</option>
        ${opcoes.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
      </select>
    </label>`;
  }

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
              ${campo('leadZap', 'WhatsApp *', 'type="tel" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" required')}
              ${campo('leadEmail', 'E-mail', 'type="email" autocomplete="email" placeholder="seu@email.com"')}
              ${campo('leadCidade', 'Cidade / UF', 'type="text" placeholder="Ex.: Rio Verde / GO"')}
            </div>
          </div>

          <div class="lead-tela" data-tela="1" hidden>
            <h3>${esc(PASSOS[1].titulo)}</h3>
            <p class="lead-ajuda">${esc(PASSOS[1].ajuda)}</p>
            <div class="lead-grade">
              ${selecao('leadPerfil', 'Você é', PERFIS)}
              ${selecao('leadRebanho', 'Tamanho do rebanho', REBANHOS)}
            </div>
            <span class="lead-rotulo lead-rotulo-solto">Espécie</span>
            ${chips('especie', ESPECIES)}
          </div>

          <div class="lead-tela" data-tela="2" hidden>
            <h3>${esc(PASSOS[2].titulo)}</h3>
            <p class="lead-ajuda">${esc(PASSOS[2].ajuda)}</p>
            ${chips('interesse', INTERESSES)}
            <div class="lead-grade lead-grade-1">
              ${selecao('leadMomento', 'Quando pretende resolver', MOMENTOS)}
              <label class="lead-campo">
                <span class="lead-rotulo">Quer detalhar? (opcional)</span>
                <textarea id="leadObs" rows="3" maxlength="600"></textarea>
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

  function ligar(raiz) {
    const form = raiz.querySelector('.lead-form');
    const telas = Array.from(raiz.querySelectorAll('.lead-tela'));
    const trilha = Array.from(raiz.querySelectorAll('.lead-trilha li'));
    const aviso = raiz.querySelector('[data-aviso]');
    const bVoltar = raiz.querySelector('[data-voltar]');
    const bAvancar = raiz.querySelector('[data-avancar]');
    const bEnviar = raiz.querySelector('[data-enviar]');
    const zap = raiz.querySelector('#leadZap');
    let atual = 0;

    zap.addEventListener('input', () => { zap.value = mascararTelefone(zap.value); });

    raiz.querySelectorAll('.lead-chip').forEach((c) => {
      c.addEventListener('click', () => c.classList.toggle('is-on'));
    });

    function dizer(msg, tipo) {
      aviso.textContent = msg || '';
      aviso.hidden = !msg;
      aviso.dataset.tipo = tipo || '';
    }

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
    }

    /* Só o primeiro passo tem campo obrigatório. Cobrar qualificação seria
       trocar lead por formulário perfeito — e não recebe nenhum dos dois. */
    function validarPrimeiro() {
      const nome = raiz.querySelector('#leadNome').value.trim();
      const fone = zap.value.replace(/\D/g, '');
      if (nome.length < 2) { dizer('Precisamos do seu nome para retornar.', 'erro'); return false; }
      if (fone.length < 10) { dizer('Informe um WhatsApp com DDD.', 'erro'); return false; }
      return true;
    }

    bAvancar.addEventListener('click', () => {
      if (atual === 0 && !validarPrimeiro()) return;
      atual = Math.min(atual + 1, telas.length - 1);
      pintar();
    });
    bVoltar.addEventListener('click', () => { atual = Math.max(atual - 1, 0); pintar(); });

    function marcados(grupo) {
      return Array.from(raiz.querySelectorAll(`[data-grupo="${grupo}"] .lead-chip.is-on`))
        .map((c) => c.dataset.valor);
    }

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!validarPrimeiro()) { atual = 0; pintar(); return; }

      const dados = {
        nome: raiz.querySelector('#leadNome').value.trim(),
        email: raiz.querySelector('#leadEmail').value.trim(),
        zap: zap.value.trim(),
        cidade: raiz.querySelector('#leadCidade').value.trim(),
        perfil: raiz.querySelector('#leadPerfil').value,
        rebanho: raiz.querySelector('#leadRebanho').value,
        especie: marcados('especie'),
        interesse: marcados('interesse'),
        momento: raiz.querySelector('#leadMomento').value,
        obs: raiz.querySelector('#leadObs').value.trim()
      };

      /* O backend hoje só persiste name/email/phone/message/source. As respostas
         de qualificação vão dentro de `message`, legíveis no painel e no e-mail,
         e também soltas no corpo — assim, no dia em que o backend passar a
         gravá-las em campo próprio, não é preciso mexer aqui. */
      const linhas = [
        dados.cidade && `Cidade: ${dados.cidade}`,
        dados.perfil && `Perfil: ${dados.perfil}`,
        dados.especie.length && `Espécie: ${dados.especie.join(', ')}`,
        dados.rebanho && `Rebanho: ${dados.rebanho}`,
        dados.interesse.length && `Interesse: ${dados.interesse.join(', ')}`,
        dados.momento && `Momento: ${dados.momento}`,
        dados.obs && `\nObservação: ${dados.obs}`
      ].filter(Boolean);

      bEnviar.disabled = true;
      bEnviar.textContent = 'Enviando...';
      dizer('');

      try {
        const r = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: dados.nome,
            email: dados.email,
            phone: dados.zap,
            message: linhas.join('\n'),
            source: 'Formulário de interesse — ' + (document.title || location.pathname),
            cidade: dados.cidade,
            perfil: dados.perfil,
            especie: dados.especie,
            rebanho: dados.rebanho,
            interesse: dados.interesse,
            momento: dados.momento
          })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);

        raiz.querySelector('.lead-box').innerHTML = `
          <div class="lead-pronto">
            <strong>Recebemos, ${esc(dados.nome.split(' ')[0])}.</strong>
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
