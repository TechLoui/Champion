/* Champion · Normalização de caminho de asset
 *
 * O site é servido em rotas de profundidades diferentes (/produtos, mas também
 * /produtos/<slug>). Um caminho relativo como "assets/img/products/difly.png"
 * resolve a partir do documento atual, então em /produtos/difly o navegador
 * pediria /produtos/assets/img/products/difly.png — que não existe.
 *
 * Os caminhos do próprio código já estão absolutos. Este helper existe para os
 * valores que chegam em tempo de execução (Firestore/CMS, Shopify), gravados
 * antes desta correção e que não dá para editar no repositório.
 */

export function assetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  // já absoluto: "/...", "//cdn...", "https:", "data:", "blob:"
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(raw)) return raw;
  return '/' + raw.replace(/^\.?\/*/, '');
}
