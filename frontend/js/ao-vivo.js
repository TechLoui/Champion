/* Champion · "Ao Vivo" no header
 *
 * Passar o cursor mostra uma prévia muda e em loop da transmissão; clicar abre
 * o vídeo na lightbox do main.js (que já escuta [data-video]).
 *
 * Decisões que importam:
 *
 *  - O iframe só é criado no hover e é DESTRUÍDO ao sair. Manter um player
 *    escondido em toda página custaria rede e CPU de todo visitante para uma
 *    prévia que quase ninguém abre.
 *  - Há um atraso antes de carregar: sem ele, passar o mouse a caminho do
 *    carrinho dispararia o download do player.
 *  - Autoplay só funciona mudo, e `loop` num vídeo único exige repetir o id em
 *    `playlist` — sem isso o YouTube ignora o loop.
 *  - Em touch não existe hover: o toque vai direto para a lightbox.
 *  - O painel é filho do body, com position fixed. Dentro do <a> ele herdaria
 *    recortes de overflow do header e aninharia iframe em âncora.
 */
(function () {
  'use strict';

  var VIDEO = 'cL1XbWIhNrI';
  var ATRASO = 350;   /* ms de hover antes de carregar o player */
  var LARGURA = 320;  /* px; a altura sai do 16/9 no CSS */

  function init() {
    var link = document.getElementById('navLive');
    if (!link) return;

    /* O id do vídeo mora SÓ aqui. O HTML das cinco páginas aponta para a página
       de lives do canal, que serve de destino caso o JS não rode; quem define o
       vídeo da lightbox é esta linha. Trocar de transmissão é editar VIDEO. */
    link.setAttribute('data-video', VIDEO);

    /* Sem hover de verdade (celular, tablet): nada de prévia. O clique continua
       funcionando e abre a lightbox, porque o data-video já foi definido. */
    var temHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (!temHover) return;

    var painel = null;
    var timer = null;

    function posicionar() {
      if (!painel) return;
      var r = link.getBoundingClientRect();
      var meio = r.left + r.width / 2;
      /* Não deixa escapar da janela em telas estreitas. */
      var esq = Math.min(Math.max(meio - LARGURA / 2, 12), window.innerWidth - LARGURA - 12);
      painel.style.left = esq + 'px';
      painel.style.top = (r.bottom + 12) + 'px';
    }

    function abrir() {
      if (painel) return;
      painel = document.createElement('div');
      painel.className = 'nav-live-preview';
      painel.style.width = LARGURA + 'px';
      painel.innerHTML = '<iframe title="Prévia da transmissão ao vivo" tabindex="-1"'
        + ' allow="autoplay; encrypted-media"'
        + ' src="https://www.youtube-nocookie.com/embed/' + VIDEO
        + '?autoplay=1&mute=1&loop=1&playlist=' + VIDEO
        + '&controls=0&modestbranding=1&rel=0&playsinline=1"></iframe>';
      document.body.appendChild(painel);
      posicionar();
      /* Um quadro depois, para a transição de entrada acontecer. */
      requestAnimationFrame(function () {
        if (painel) painel.classList.add('is-on');
      });
      window.addEventListener('scroll', posicionar, { passive: true });
      window.addEventListener('resize', posicionar);
    }

    function fechar() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!painel) return;
      /* Remover o nó para o vídeo e encerra as conexões do player. */
      painel.remove();
      painel = null;
      window.removeEventListener('scroll', posicionar);
      window.removeEventListener('resize', posicionar);
    }

    link.addEventListener('mouseenter', function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(abrir, ATRASO);
    });
    link.addEventListener('mouseleave', fechar);
    /* Ao clicar, a lightbox assume: a prévia sai de cena. */
    link.addEventListener('click', fechar);
    /* Teclado: quem chega pelo Tab não recebe prévia, mas também não fica com
       um painel preso na tela se tiver usado o mouse antes. */
    link.addEventListener('blur', fechar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
