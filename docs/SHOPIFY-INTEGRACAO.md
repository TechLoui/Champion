# Integração Shopify — Champion Saúde Animal

Documento de projeto da migração do e-commerce para o modelo **headless com Shopify**.
O site continua no nosso domínio (Firebase Hosting) e o Shopify passa a ser o motor de
catálogo, estoque, preço, pagamento e pedidos.

---

## 1. Decisões travadas

| Tema | Decisão |
|---|---|
| Catálogo, preço, estoque | **Shopify** (fonte da verdade) |
| Conteúdo dos produtos (benefícios, uso, FAQ) | **Migrado para o Shopify** via metafields |
| Checkout / pagamento | **Checkout hospedado do Shopify** (redirect) |
| Domínio do site | **Fica conosco** (Firebase Hosting), inalterado |
| Domínio do checkout | **Subdomínio da marca** delegado ao Shopify (`loja.seudominio.com.br`) |
| Login / contas de cliente | **Firebase Auth mantido** (não migra pro Shopify) |
| Gestão de pedidos | **No admin do Shopify** (não espelhamos no nosso painel) |
| Controle do catálogo (mostrar no site) | **Modelo B** — produtos vêm do Shopify; o **liga/desliga por produto é feito no nosso painel admin** |
| Produto sem estoque | Aparece no site como **"Esgotado"** (sem botão de compra) — `hideOutOfStock: false` |

---

## 2. Arquitetura

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│  NOSSO SITE (Firebase Host)  │         │         SHOPIFY          │
│  www.seudominio.com.br       │         │                          │
│                              │         │  • Catálogo / preço      │
│  • Vitrine (produtos.html)   │◀───────▶│  • Estoque               │
│  • Página de produto         │  Store- │  • Conteúdo (metafields) │
│  • Carrinho (localStorage)   │  front  │                          │
│  • Blog, institucional,      │   API   │                          │
│    leads, painel admin       │         │                          │
│                              │         │  • Checkout hospedado    │
│  [Finalizar compra] ─────────┼────────▶│    loja.seudominio...    │
│                              │ redirect│  • Pagamento             │
│  • Login (Firebase Auth)     │         │  • Pedidos               │
└─────────────────────────────┘         └──────────────────────────┘
```

- **Catálogo:** a vitrine busca produtos no Shopify pela **Storefront API** (GraphQL, token público).
- **Carrinho:** mantido em `localStorage` como hoje; ao finalizar, criamos o carrinho no Shopify e
  redirecionamos para o `checkoutUrl` (checkout hospedado, no subdomínio da marca).
- **Pedidos:** criados nativamente pelo Shopify no checkout. Geridos no admin do Shopify.
- **Login:** Firebase Auth permanece; o e-mail do cliente logado é pré-preenchido no checkout.

---

## 3. O que muda no código

### Sai (removido/desativado)
- Checkout próprio com Pagar.me — [checkout.html](../frontend/checkout.html) passa a apenas criar o
  carrinho no Shopify e redirecionar.
- Backend de pagamento: `backend/routes/checkout.js`, `backend/routes/webhook-pagarme.js`.
- Tokenização de cartão no frontend.
- Edição de catálogo/estoque/preço no admin ([products-cms.js](../frontend/js/products-cms.js)).
- Fonte estática de produtos ([product-data.js](../frontend/js/product-data.js)) — substituída pela Storefront API.

### Fica (inalterado)
- Blog, páginas institucionais, ferramenta de cálculo de dose.
- Formulário de leads / contato (backend `routes/leads.js`).
- Login e base de clientes (Firebase Auth).
- Painel admin para **Blog, Leads/Contatos, Banners e Configurações**.

### Muda de comportamento
- Aba **Catálogo** e **Pedidos** do painel: removidas ou viram link para o admin do Shopify.
- Página **Minha Conta**: mantém perfil; histórico de pedidos é opcional (ver Fase 3).

---

## 4. Fases de desenvolvimento

| Fase | Entrega | Depende de |
|---|---|---|
| **0** | Setup do Shopify (loja, app, tokens, produtos, metafields, frete, DNS) | **Você** |
| **1** | Vitrine puxando catálogo + conteúdo do Shopify | Fase 0 |
| **2** | Carrinho → checkout do Shopify (redirect, e-mail pré-preenchido) | Fase 1 |
| **3** | (Opcional) Minha Conta lendo pedidos do Shopify por e-mail | Fase 2 |
| **4** | Limpeza: remover Pagar.me, checkout antigo, edição de catálogo | Fase 2 |
| **5** | Teste ponta a ponta + go-live | Fases 1–4 |

---

## 5. Checklist Fase 0 — o que você precisa organizar

- [ ] **Loja Shopify criada** e plano definido (Basic já atende).
- [ ] **App personalizado** criado (Configurações → Apps e canais → Desenvolver apps) e me enviar:
  - [ ] **Storefront API access token** (público — usado na vitrine)
  - [ ] Endereço `sua-loja.myshopify.com`
  - [ ] *(Opcional, só se quisermos histórico em Minha Conta)* **Admin API access token** com escopos `read_orders`, `read_customers`
- [ ] **Produtos cadastrados no Shopify** com: título, preço, **estoque**, imagens, variantes e **SKU**.
- [ ] **Metafields de conteúdo preenchidos** (ver seção 6).
- [ ] **Pagamento configurado** no Shopify (Shopify Payments, Mercado Pago, Pagar.me app, etc.).
- [ ] **Frete configurado** no Shopify: hoje a regra é **grátis acima de R$ 500, senão R$ 38**.
- [ ] **Subdomínio do checkout**: criar `loja.seudominio.com.br` e apontar ao Shopify (registro DNS
      que o Shopify indica ao adicionar o domínio). O domínio principal `www` continua conosco.

### Escopos da Storefront API (marcar no app)
`unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory`,
`unauthenticated_read_checkouts`, `unauthenticated_write_checkouts`.

---

## 6. Especificação dos metafields (conteúdo dos produtos)

O Shopify tem nativamente: **título**, **descrição**, **imagens**, **variantes** e **preço**.
Os campos ricos das nossas páginas atuais viram **metafields** no namespace `custom`.
Crie estas definições em **Configurações → Metafields personalizados → Produtos**:

| Campo (nosso site hoje) | Chave do metafield | Tipo no Shopify | Observação |
|---|---|---|---|
| `headline` | `custom.headline` | Texto de linha única | Frase de destaque no topo |
| `excerpt` | `custom.excerpt` | Texto de várias linhas | Resumo curto (cards/SEO) |
| `benefits` | `custom.benefits` | **Lista** de texto de linha única | Um benefício por item |
| `usage` | `custom.usage` | Texto de várias linhas | Modo de uso / dosagem |
| `presentations` | `custom.presentations` | Texto de linha única | Ex.: "275 g / 25 kg sal" |
| `faq` | `custom.faq` | JSON | Lista de `{ "q": "...", "a": "..." }` |
| `tag` (selo) | `custom.badge` | Texto de linha única | Ex.: "Mais vendido", "Tripla ação" |
| `species` (filtro) | `custom.species` | Texto de linha única | **Slug** — ver valores abaixo |
| `group` (filtro) | `custom.group` | Texto de linha única | **Slug** — ver valores abaixo |
| `use` (filtro) | `custom.use` | Texto de linha única | **Slug** — ver valores abaixo |
| `category` (rótulo) | `custom.category` | Texto de linha única | Ex.: "Bovinos · Larvicida" (se vazio, usa o *Tipo de produto*) |

**Mapeamento direto (campos nativos):**

| Campo (nosso site hoje) | No Shopify |
|---|---|
| `name` | Título do produto |
| `content` | Descrição (corpo) |
| `price` | Preço da variante |
| `image` | Imagens do produto |
| `variants` | Variantes do produto |
| `id` (URL `produto.html?p=<id>`) | **Handle** do produto — ver abaixo |

**Handle = id atual (importante para SEO):** o site usa `produto.html?p=<id>` (ex.: `?p=difly`).
Para preservar URLs e ranqueamento, o **handle** de cada produto no Shopify deve ser igual ao id
atual: `difly`, `difly-s3`, `vermi-sal`, `ade-po`, `diazinon`, etc.

**Slugs aceitos nos filtros** (precisam bater com os filtros da vitrine):
- `custom.species`: `bovinos`, `equinos`, `ovinos`, `suinos`, `aves`, `minerais`, `ambientes`, `veterinario`
- `custom.group`: `larvicida`, `parasitario`, `inseticida`, `mineralizacao`, `suplemento`, `nutricao`, `reproducao`
- `custom.use`: `sal-racao`, `pulverizacao`, `dieta-premix`, `po-topico`, `agua-parada`

> Exemplo de `custom.faq` (JSON):
> ```json
> [
>   { "q": "Pode usar em bezerros?", "a": "Sim, a partir de..." },
>   { "q": "Tem carência?", "a": "Não há resíduo na carne e no leite." }
> ]
> ```

---

## 7. Estrutura de código (Fase 1 — já implementada)

A camada de integração já está montada e é ativada por configuração, sem quebrar o site atual.

**Arquivos novos:**
- [`frontend/js/shopify-config.js`](../frontend/js/shopify-config.js) — domínio, token e namespace
  dos metafields. **É aqui que você cola os dados da Fase 0.**
- [`frontend/js/shopify-client.js`](../frontend/js/shopify-client.js) — cliente da Storefront API:
  busca o catálogo, mapeia cada produto para o formato interno (com o GID da variante para o
  checkout) e cria o carrinho/checkout no Shopify. Publica `window.ChampionShopify`.

**Ajustes mínimos:**
- [`frontend/js/product-data.js`](../frontend/js/product-data.js) — passou a preservar o
  `variantId` (GID do Shopify) na normalização.
- [`frontend/js/products-cms.js`](../frontend/js/products-cms.js) — a vitrine agora carrega os
  produtos do Shopify **quando configurado**; senão, mantém a fonte atual (admin/Firestore).

**Chave liga/desliga:** enquanto `shopify-config.js` estiver com os placeholders, `isShopifyEnabled()`
retorna `false` e nada muda no site. Ao preencher domínio + token reais, a vitrine passa a puxar do
Shopify automaticamente. Fallback seguro: se a Storefront API falhar, cai na fonte local.

**Modelo B — controle de catálogo no painel (já implementado, dormente):**
- [`admin-store.js`](../frontend/js/admin-store.js) ganhou `getCatalogVisibility()` e
  `setProductActive(handle, ativo)`, que guardam **só os flags de liga/desliga** no Firestore
  (`siteSettings/catalogVisibility`) — não duplicam os dados do produto.
- [`admin.js`](../frontend/js/admin.js): no modo Shopify, a aba **Catálogo** lista os produtos
  vindos do Shopify (somente leitura) com botão **Ativar/Desativar** por produto, selo **Esgotado**
  quando sem estoque, e link **"Editar no Shopify"**. Os botões de criar/excluir/restaurar produto
  ficam ocultos (isso é feito no Shopify).
- [`products-cms.js`](../frontend/js/products-cms.js): a vitrine cruza os produtos do Shopify com
  esses flags — produto **desativado no painel some do site**; produto **sem estoque** aparece como
  "Esgotado" (config `hideOutOfStock: false` em [`shopify-config.js`](../frontend/js/shopify-config.js)).
- Padrão: produto novo do Shopify entra **ativo** (visível); você desativa o que não quiser mostrar.

**Fase 2 (checkout) — já implementada, dormente:**
- Os botões "adicionar ao carrinho" ([`products-cms.js`](../frontend/js/products-cms.js)) já carregam
  o `variantId` (GID do Shopify) em cada item do carrinho.
- O [`checkout.html`](../frontend/checkout.html) detecta o modo Shopify: quando ativo, substitui o
  fluxo Pagar.me por um resumo do pedido + botão **"Ir para o pagamento seguro"**, que cria o
  carrinho no Shopify (`createShopifyCheckout`) e redireciona para a `checkoutUrl`. Quando o Shopify
  está desligado, o fluxo Pagar.me atual continua igual.

**Pendente:**
- **Fase 4 (limpeza, após validar):** remover Pagar.me, backend de pagamento (`routes/checkout.js`,
  `routes/webhook-pagarme.js`) e a edição de catálogo no admin.
- Ajuste do sitemap/meta (Cloud Functions) para a nova fonte de dados.

---

## 8. Riscos / pontos de atenção

- **Checkout não é transparente:** no plano padrão do Shopify o cliente é redirecionado para a
  página de checkout hospedada. O subdomínio da marca deixa a URL com a nossa cara, mas ainda é
  uma página do Shopify. Checkout embutido só existe no Shopify Plus (fora de escopo/custo).
- **Publicar no canal de vendas:** o catálogo só aparece na Storefront API se cada produto estiver
  **publicado no canal** ligado ao token (Online Store / Headless). Produto não publicado nesse canal
  = catálogo vazio no site, mesmo com token válido.
- **SKU é a "chave":** todo produto precisa de SKU no Shopify para casar com a vitrine.
- **Frete e impostos** passam a ser regra do Shopify — revisar antes do go-live.
- **SEO das páginas de produto:** hoje há geração de sitemap/meta via Cloud Functions; ajustar para
  refletir a nova fonte de dados na Fase 1.

---

## Anexo A — Como pegar o Storefront API token (passo a passo)

> Pré-requisito: estar logado como **dono da loja** (ou usuário com permissão de
> "Desenvolver apps"). Tudo é feito no painel admin do Shopify.

**1. Abrir o desenvolvimento de apps**
- Admin do Shopify → **Configurações** (canto inferior esquerdo)
- **Apps e canais de venda** → botão **Desenvolver apps**
- Na primeira vez, clique em **Permitir desenvolvimento de apps personalizados** e confirme.

**2. Criar o app**
- **Criar um app** → dê o nome `Champion Site` → **Criar app**.

**3. Liberar os acessos da Storefront API**
- Na aba **Configuração**, seção **API da Storefront** → **Configurar**.
- Marque os escopos:
  - `unauthenticated_read_product_listings` (ler produtos/preços)
  - `unauthenticated_read_product_inventory` (ler estoque)
  - `unauthenticated_read_checkouts`
  - `unauthenticated_write_checkouts` (criar o carrinho/checkout)
- **Salvar**.

**4. Instalar o app**
- Canto superior direito → **Instalar app** → confirmar.

**5. Copiar a chave**
- Aba **Credenciais da API** → seção **Storefront API access token**.
- Copie o token (é uma sequência tipo `a1b2c3...`). **Esse é o valor que preciso.**
  > É o token *público* (Storefront). Não confundir com o *Admin API access token*,
  > que só usaríamos se ligarmos o histórico de pedidos em "Minha Conta".

**6. Descobrir o domínio da loja**
- É o endereço `sua-loja.myshopify.com` (aparece na URL do admin, ou em
  **Configurações → Domínios**). Me mande junto com o token.

**7. Onde vai (eu faço, ou você mesmo)**
- No arquivo [`frontend/js/shopify-config.js`](../frontend/js/shopify-config.js):
  ```js
  domain: 'sua-loja.myshopify.com',
  storefrontToken: 'a1b2c3...'
  ```
- Assim que salvar com os valores reais, a vitrine passa a puxar do Shopify.

> **Segurança:** o Storefront token é público por natureza (fica no navegador) — pode ir no
> código sem risco. Já o *Admin API token* é secreto e **nunca** vai no frontend.

---

_Última atualização: 2026-07-26_
