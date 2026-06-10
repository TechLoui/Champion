# Relatório completo de SEO — Champion Saúde Animal

**Domínio canônico:** https://ofertaschampion.com.br · **Hospedagem:** Firebase Hosting (projeto `champion-e84e8`, plano Blaze) · **Backend de dados:** Firestore · **Data:** 2026-06-07

> ⚠️ **Status geral:** a **estrutura** de SEO para resultado nacional está montada no código, mas **nada está deployado/indexado ainda**, e há **2 bloqueios de confiança** a resolver antes de indexar. Estrutura ≠ resultado: ver seções 6 (lacunas) e 8 (ativação).

---

## 1. Resumo executivo

- **Fundação técnica:** ✅ pronta (meta dinâmico, schema rico, sitemap dinâmico, robots, H1s).
- **Conteúdo de produto:** ✅ otimizado (título/H1 por intenção, FAQ automática por grupo, ficha técnica).
- **Conteúdo informacional:** 🟡 motor de guias criado + 3 pilares de maior volume (mosca, sal mineral, vermifugação). Faltam pilares de nutrição, reprodução e espécies.
- **Confiança (E-E-A-T):** 🔴 bloqueado por conteúdo fictício no ar (depoimentos) e checkout em demonstração (Pagar.me não ligado).
- **Autoridade (backlinks):** 🔴 não iniciada (trabalho fora do código).
- **Publicação:** 🔴 não deployado, sitemap não enviado ao Search Console.

**Cobertura estimada de palavras-chave:** marca ~90% · produto ~80% · transacional/categoria ~40% · comparação ~25% · informacional/problema ~35% (após os 3 pilares) · sazonal/regional ~5%.

---

## 2. Diagnóstico do nicho (resumo)

O pecuarista compra de forma técnica e sazonal: sente a dor → pesquisa a solução → compara → decide pela marca. SEO aqui exige cobrir as 3 etapas do funil. Alavancas de decisão do nicho (usar em títulos/textos): **sem resíduo** no leite/carne, **sem manejo / sem resistência**, **custo por cabeça/dia e ganho de peso**. Carros-chefe de busca: **Difly / Difly S3** (mosca/carrapato), **VER-MI-SAL** (vermífugo + mineral), **Núcleos** (ganho de peso).

---

## 3. O que foi implementado (estrutura atual)

### 3.1 SEO técnico
- **Meta dinâmico por produto** (title, description, canonical, Open Graph) — `frontend/js/products-cms.js` (`hydrateProductMeta`).
- **Title/H1/meta por intenção** na home, catálogo, sobre, blog e cálculo de dose.
- **H1 presente** na home (acessível, `.sr-only`) e no catálogo (visível) — antes ausentes.
- **robots.txt** — `frontend/robots.txt` (bloqueia admin/checkout/conta; aponta o sitemap).
- **Sitemap dinâmico** gerado do Firestore — `functions/index.js` (`sitemap`), ligado via rewrite em `firebase.json`. Produto novo entra sozinho.
- **Cache busting** por `?v=` em CSS/JS (CSS `?v=20260522-4`; JS principais `-3`/`-7`).

### 3.2 Dados estruturados (Schema.org)
- `Product` + `Offer` (uma Offer por variante, com `priceValidUntil`, `shippingDetails`, `hasMerchantReturnPolicy`) — `products-cms.js`.
- `FAQPage` — gerado por produto (ver 3.4) e em cada guia.
- `BreadcrumbList` — produtos e guias.
- `Organization` (logo, contato, redes) — injetado em todas as páginas via `frontend/js/main.js`.
- `WebSite` + SearchAction — home (`index.html`).
- `ItemList` — catálogo (`products-cms.js`).
- `Article` — cada página-pilar de guia.
- **Pendente:** `AggregateRating` (depende de sistema de avaliações reais).

### 3.3 Páginas de produto
- Seção de conteúdo rico (descrição, benefícios, modo de uso) + **ficha rápida** + **FAQ acordeão**.
- **Variantes** (tamanho/preço/foto) com seletor e preço "a partir de" no catálogo.
- Interlink **produto → guia** por grupo (card "Guia relacionado").
- Linha de pagamento real ("Pix, boleto ou cartão em até 6× sem juros").

### 3.4 FAQ automática por grupo (cauda longa de perguntas)
Cada produto gera ~10–14 perguntas no vocabulário de busca real, conforme o grupo (larvicida, parasitário, inseticida, vermífugo, mineralização, nutrição, reprodução, suplemento): definição, problema/sintoma, dose, espécie, **resíduo/carência**, preço, onde comprar, registro MAPA e entrega. `products-cms.js` (`buildAutoFaq`/`groupFaq`).

### 3.5 Motor de guias (pilares informacionais)
Páginas **estáticas** (meta perfeita para Google e robôs sociais, sem depender de JS), independentes do blog Firestore:
- Hub: `frontend/guias.html`
- `frontend/guias/controle-mosca-dos-chifres.html` → Difly / Difly S3
- `frontend/guias/sal-mineral-para-gado.html` → VER-MI-SAL
- `frontend/guias/vermifugacao-bovinos.html` → VER-MI-SAL

Cada pilar: H1/title/description/OG, `Article` + `FAQPage` + `BreadcrumbList`, índice, H2s = as próprias buscas, FAQ, cards de produto e interlink guia↔guia↔produto. CSS `.guide-*` no fim de `styles.css`. "Guias" adicionado ao menu das 6 páginas e ao sitemap.

### 3.6 Estratégia de palavras-chave
Mapa completo por produto e por empresa (marca, transacional, comparação, informacional, perguntas, modificadores, sazonalidade) em `docs/seo-keywords.md`.

---

## 4. Cobertura de palavras-chave (detalhe)

| Cluster | Status | Onde está | Lacuna |
|---|---|---|---|
| Marca / navegacional | 🟢 ~90% | titles, FAQ, Organization/WebSite | — |
| Produto (uso/dose/espécie/resíduo/preço) | 🟢 ~80% | FAQ por grupo + título + ficha | descrições 300+ no painel |
| Transacional / categoria | 🟡 ~40% | H1 + intro do catálogo | páginas de categoria com texto |
| Comparação | 🟡 ~25% | guias (cocho x pour-on, x injetável, tipos de sal) | mais comparativos |
| Informacional / problema | 🟡 ~35% | 3 pilares | pilares nutrição/reprodução/espécies |
| Perguntas (long tail) | 🟢 forte | FAQ de produtos + guias | — |
| Sazonal / regional | 🔴 ~5% | menções nos guias | calendário + páginas regionais |

---

## 5. SEO técnico — pendências e atenção

- **URLs limpas `/produtos/:slug`** — ainda em `produto.html?p=`. A função SSR (`functions/index.js` → `productPage`) **já entende os dois formatos**, mas o rewrite **não foi ativado** (no Firebase, arquivo estático tem prioridade; ativar sem teste quebraria as páginas de produto). **Ativar só após testar em canal de preview.**
- **Meta de produto via JS** — hoje o meta do produto é injetado por JavaScript. Bots sociais (WhatsApp/Facebook) não rodam JS. A função `productPage` resolve isso quando ativada (com URLs limpas).
- **AggregateRating** — requer sistema de avaliações reais.
- **Páginas de categoria** — hoje há um catálogo único com filtros; faltam páginas de categoria com texto próprio.

---

## 6. Lacunas e bloqueios (antes de indexar)

| Item | Severidade | Responsável |
|---|---|---|
| **Depoimentos fictícios no ar** (`index.html`, `alt="Foto fictícia de…"`) | 🔴 crítico | decisão do cliente (remover ou fornecer reais) |
| **Pagar.me não ligado** (checkout em demonstração) | 🔴 crítico | cliente (chaves) + dev (integração) |
| **Sem avaliações reais / AggregateRating** | 🟡 médio | cliente + dev |
| **Não deployado / sitemap não enviado ao Search Console** | 🔴 bloqueia tudo | cliente (deploy) |
| **Sem backlinks (autoridade)** | 🟠 alto p/ competir | marketing |
| Pilares restantes + categorias + calendário sazonal | 🟡 médio | dev (conteúdo) |

> **Não enviar o sitemap ao Search Console** enquanto houver conteúdo fictício no ar e o checkout estiver em demonstração — risco de E-E-A-T.

---

## 7. Estimativas de resultado (cenários direcionais)

Pressupõem: deploy+indexação feitos, bloqueios resolvidos, conteúdo continuado e algum link building. Domínio novo = rampa lenta. **Não são promessas**; volume real precisa de validação no Keyword Planner/Search Console.

**Tráfego orgânico mensal (a partir da indexação):**

| Fase | Conservador | Realista | Otimista |
|---|---|---|---|
| Mês 1-2 | 40 | 150 | 400 |
| Mês 3-6 | 300 | 1.000 | 2.800 |
| Mês 6-12 | 1.200 | 4.500 | 12.000 |
| Mês 12-18 | 3.500 | 10.000 | 30.000 |

**Conversão (ilustrativo — substituir pelo ticket médio real):** conversão 0,7–1,2%, ticket médio R$ 200 (chute).

| Fase (realista) | Visitas | Pedidos/mês | Receita orgânica/mês |
|---|---|---|---|
| Mês 3-6 | 1.000 | ~10 | ~R$ 2.000 |
| Mês 6-12 | 4.500 | ~45 | ~R$ 9.000 |
| Mês 12-18 | 10.000 | ~100 | ~R$ 20.000 |

A diferença entre cenários é majoritariamente **backlinks + cadência de conteúdo**. Horizonte realista para virar canal de venda relevante: **6–12 meses**. Atalho de curto prazo: anúncios (Shopping/Meta) usando a mesma estrutura.

---

## 8. Checklist de ativação (passo a passo)

1. [ ] Resolver depoimentos fictícios (remover ou substituir por reais).
2. [ ] Ligar Pagar.me (chaves + endpoint no backend + webhook) e remover o aviso de demonstração no checkout.
3. [ ] `cd functions && npm install`
4. [ ] `firebase deploy --only functions,hosting` (liga o sitemap dinâmico).
5. [ ] Validar `https://ofertaschampion.com.br/sitemap.xml`.
6. [ ] **Google Search Console:** adicionar a propriedade e enviar o sitemap (1 vez).
7. [ ] (Opcional) Testar URLs limpas em preview (`firebase hosting:channel:deploy preview`) antes de ativar o rewrite `/produtos/*`.
8. [ ] Configurar GA4 (tráfego e conversão).
9. [ ] Iniciar link building no nicho (portais do agro, revendas, YouTube).

---

## 9. Roadmap priorizado

**Fase 0 — Destravar (agora)**
- Depoimentos + Pagar.me; deploy + Search Console + GA4.

**Fase 1 — Capturar demanda existente (mês 1)**
- Descrições 300+ palavras nos carro-chefe (painel); páginas de categoria com texto.

**Fase 2 — Autoridade e volume (mês 2-3)**
- Pilares restantes (nutrição/núcleos, reprodução/IATF, espécies); calendário sazonal; FAQ central.
- Início de link building.

**Fase 3 — Escalar (contínuo)**
- Avaliações reais → AggregateRating; URLs limpas + SSR ativados; monitorar e dobrar no que sobe.

---

## 10. Apêndice — arquivos da estrutura de SEO

**Criados:**
- `functions/index.js`, `functions/package.json`, `functions/.gitignore` (sitemap + SSR de produto)
- `frontend/robots.txt`
- `frontend/guias.html` + `frontend/guias/{controle-mosca-dos-chifres,sal-mineral-para-gado,vermifugacao-bovinos}.html`
- `docs/seo-keywords.md`, `docs/seo-relatorio.md`

**Alterados (principais):**
- `frontend/js/products-cms.js` — meta dinâmico, schema, FAQ por grupo, catálogo SEO, interlink, remoção de "Preço fictício".
- `frontend/js/product-data.js` — `variants`, `faq`, `getMinPrice`, `getDisplayImage`.
- `frontend/js/main.js` — `Organization` schema global.
- `frontend/css/styles.css` — `.sr-only`, seção de conteúdo do produto, FAQ, variantes, `.guide-*`.
- `frontend/index.html`, `produtos.html`, `produto.html`, `sobre.html`, `blog.html`, `calculo-dose.html` — H1/title/meta/canonical/OG, nav "Guias", remoção de fictício.
- `firebase.json` — bloco `functions` + rewrite do sitemap.

> Observação: tudo acima está no working tree; **ainda não commitado nem deployado**.
