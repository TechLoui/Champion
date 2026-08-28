/* Champion · Slug do produto na página de detalhe
 *
 * A mesma página responde por duas rotas:
 *   /produto?p=<slug>    → o slug vem na query string
 *   /produtos/<slug>     → o slug vem no caminho
 *
 * A segunda é servida por um rewrite interno do Apache (produto.html?p=<slug>),
 * mas rewrite interno NÃO altera a barra de endereços: window.location.search
 * continua vazio. Ler só a query string fazia toda URL /produtos/<slug> cair no
 * default e renderizar sempre o mesmo produto.
 *
 * Script clássico de propósito: é usado pelo script inline da página, por
 * produto-video.js e pelo módulo products-cms.js.
 */
(function () {
  'use strict';

  window.championProductSlug = function championProductSlug() {
    var fromQuery = new URLSearchParams(window.location.search).get('p');
    if (fromQuery) return fromQuery;

    var m = window.location.pathname.match(/^\/produtos\/([^/?#]+)\/?$/);
    if (!m) return '';

    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  };
})();
