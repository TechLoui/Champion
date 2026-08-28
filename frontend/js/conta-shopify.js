/* Champion · Conta e pedidos pela Shopify
 *
 * A loja usa as novas contas de cliente, então o login é OAuth: o visitante vai
 * para a Shopify, recebe um código por e-mail e volta. O token nunca chega aqui
 * — quem guarda é o backend, e o navegador só carrega um cookie de sessão.
 *
 * Por isso toda chamada leva credentials: 'include'. Sem isso o cookie não
 * viaja e o backend responde 401 mesmo com a pessoa logada.
 *
 * Convive com o sistema antigo (order-store.js/Firebase) de propósito: enquanto
 * os dois existirem, o pedido real aparece aqui em cima e o histórico local
 * continua embaixo, sem sumir sem aviso.
 */
'use strict';

(function () {
  const API = (window.CHAMPION_API_URL || 'https://champion-production-cab6.up.railway.app/api/leads')
    .replace(/\/api\/leads\/?$/, '') + '/api/conta';

  const alvo = document.getElementById('shopifyOrders');
  if (!alvo) return;

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* Status vêm em inglês e em caixa alta da API. Traduzir aqui em vez de mostrar
     PARTIALLY_FULFILLED para um pecuarista. */
  const PAGAMENTO = {
    PAID: 'Pago', PENDING: 'Aguardando pagamento', REFUNDED: 'Reembolsado',
    PARTIALLY_REFUNDED: 'Reembolsado em parte', VOIDED: 'Cancelado',
    AUTHORIZED: 'Autorizado', PARTIALLY_PAID: 'Pago em parte',
    EXPIRED: 'Pagamento expirado'
  };
  const ENTREGA = {
    FULFILLED: 'Enviado', SUCCESS: 'Enviado', IN_PROGRESS: 'Em separação',
    OPEN: 'Em separação', PENDING_FULFILLMENT: 'Aguardando envio',
    PARTIALLY_FULFILLED: 'Enviado em parte', UNFULFILLED: 'Aguardando envio',
    CANCELLED: 'Cancelado', ERROR: 'Problema no envio', FAILURE: 'Problema no envio'
  };
  const traduzir = (mapa, v) => (v ? (mapa[String(v).toUpperCase()] || String(v)) : null);

  const moeda = (n, m) => Number(n || 0)
    .toLocaleString('pt-BR', { style: 'currency', currency: m || 'BRL' });

  const data = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch (e) { return ''; }
  };

  function chamar(caminho, opcoes) {
    return fetch(API + caminho, Object.assign({ credentials: 'include' }, opcoes || {}));
  }

  function pintarDeslogado(motivo) {
    alvo.innerHTML = `
      <div class="conta-shopify conta-shopify-entrar">
        <h2>Seus pedidos</h2>
        <p>Entre com a sua conta da loja para acompanhar pedidos, pagamento e
           entrega. Não precisa de senha — a Shopify envia um código para o seu
           e-mail.</p>
        ${motivo ? `<p class="conta-shopify-erro">${esc(motivo)}</p>` : ''}
        <a class="btn btn-primary" href="${esc(API)}/login?voltar=/minha-conta">Entrar para ver meus pedidos</a>
      </div>`;
  }

  function pintarVazio(nome) {
    alvo.innerHTML = `
      <div class="conta-shopify">
        ${cabeca(nome)}
        <p class="conta-shopify-vazio">Você ainda não tem pedidos por aqui.
           Quando fizer o primeiro, ele aparece nesta tela com status de
           pagamento e entrega.</p>
      </div>`;
    ligarSair();
  }

  const cabeca = (nome) => `
    <div class="conta-shopify-head">
      <h2>Seus pedidos${nome ? ` · <span>${esc(nome)}</span>` : ''}</h2>
      <button type="button" class="conta-shopify-sair" id="contaSair">Sair</button>
    </div>`;

  function pintarPedidos(nome, pedidos) {
    alvo.innerHTML = `
      <div class="conta-shopify">
        ${cabeca(nome)}
        <ul class="conta-pedidos">
          ${pedidos.map((p) => {
            const pag = traduzir(PAGAMENTO, p.pagamento);
            const ent = traduzir(ENTREGA, p.entrega);
            return `<li class="conta-pedido">
              <div class="conta-pedido-topo">
                <strong>Pedido #${esc(p.numero)}</strong>
                <span class="conta-pedido-data">${esc(data(p.data))}</span>
              </div>
              <div class="conta-pedido-tags">
                ${pag ? `<span class="conta-tag${p.pagamento === 'PAID' ? ' is-ok' : ''}">${esc(pag)}</span>` : ''}
                ${ent ? `<span class="conta-tag">${esc(ent)}</span>` : ''}
              </div>
              ${p.itens.length ? `<p class="conta-pedido-itens">${
                esc(p.itens.map((i) => `${i.qtd}× ${i.titulo}`).join(' · '))}</p>` : ''}
              ${p.total != null ? `<p class="conta-pedido-total">${esc(moeda(p.total, p.moeda))}</p>` : ''}
            </li>`;
          }).join('')}
        </ul>
      </div>`;
    ligarSair();
  }

  function ligarSair() {
    const b = document.getElementById('contaSair');
    if (!b) return;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { await chamar('/sair', { method: 'POST' }); } catch (e) {}
      pintarDeslogado();
    });
  }

  async function iniciar() {
    /* Volta do OAuth com erro: avisa em vez de simplesmente mostrar "entre". */
    const falhou = new URLSearchParams(location.search).get('login') === 'erro';

    alvo.innerHTML = '<div class="conta-shopify"><p class="conta-shopify-vazio">Carregando seus pedidos…</p></div>';

    let eu;
    try {
      const r = await chamar('/eu');
      eu = await r.json();
    } catch (e) {
      /* Backend fora do ar não pode parecer "você não tem conta". */
      alvo.innerHTML = `<div class="conta-shopify"><p class="conta-shopify-erro">
        Não consegui falar com o servidor agora. Recarregue a página em instantes.</p></div>`;
      return;
    }

    if (!eu || !eu.logado) {
      return pintarDeslogado(falhou ? 'Não foi possível concluir o login. Tente de novo.' : '');
    }

    try {
      const r = await chamar('/pedidos');
      if (r.status === 401) return pintarDeslogado('Sua sessão expirou. Entre novamente.');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const { pedidos } = await r.json();
      if (!pedidos || !pedidos.length) return pintarVazio(eu.nome);
      pintarPedidos(eu.nome, pedidos);
    } catch (e) {
      alvo.innerHTML = `<div class="conta-shopify">${cabeca(eu.nome)}
        <p class="conta-shopify-erro">Não consegui carregar seus pedidos agora.</p></div>`;
      ligarSair();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
