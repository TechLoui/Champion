// Configuração da integração Shopify (Storefront API) — Champion Saúde Animal
//
// Preencher na FASE 0 (ver docs/SHOPIFY-INTEGRACAO.md):
//   1. domain          → endereço da loja: "sua-loja.myshopify.com"
//   2. storefrontToken → token PÚBLICO da Storefront API (do app personalizado)
//
// Enquanto estes campos estiverem com os valores-placeholder abaixo, o site
// continua usando a fonte de produtos atual (admin/Firestore). Assim que forem
// preenchidos com dados reais, a vitrine passa automaticamente a puxar do Shopify.

export const CHAMPION_SHOPIFY_CONFIG = {
  domain: 'COLE_A_LOJA.myshopify.com',
  storefrontToken: 'COLE_O_STOREFRONT_TOKEN',
  apiVersion: '2025-01',

  // Namespace dos metafields de conteúdo (ver tabela na doc). Não mudar sem alinhar
  // com o cadastro feito no Shopify.
  metafieldNamespace: 'custom',

  // Comportamento quando um produto fica SEM ESTOQUE no Shopify:
  //   true  → some do catálogo do site (desativa automaticamente)
  //   false → continua aparecendo, marcado como "Esgotado" (melhor p/ SEO)
  hideOutOfStock: false
};

// Considera a integração ativa só quando domain + token estão preenchidos com
// valores reais (nada de "cole", "your-", "placeholder", etc.).
export function isShopifyConfigured(cfg = CHAMPION_SHOPIFY_CONFIG) {
  const domain = String(cfg && cfg.domain || '').trim();
  const token = String(cfg && cfg.storefrontToken || '').trim();
  const looksReal = (v) => v && !/cole|your-|seu-|placeholder/i.test(v);
  return looksReal(domain) && domain.includes('myshopify.com') && looksReal(token);
}
