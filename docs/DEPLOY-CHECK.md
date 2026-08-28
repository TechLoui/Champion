# Conferência de deploy — champion.ind.br (Hostinger)

O deploy de 26/08 subiu os HTML e os arquivos JS **novos**, mas não os JS
**alterados**. Como o sintoma era silencioso (a página abria, só mostrava o
produto errado), a falha só apareceu no teste manual slug a slug.

Esta é a lista para conferir depois de subir. Leva um minuto.

## 1. Todo arquivo JS/CSS precisa vir com `?v=20260828-7`

O `.htaccess` cacheia JS e CSS por 1 hora, e a Hostinger tem cache próprio
(LiteSpeed). Um arquivo alterado que mantém a mesma URL continua sendo servido
da versão antiga. Por isso o stamp é unificado: 91 referências, todas iguais.

**Sempre que um JS mudar, bumpe o stamp.** Sem isso o mesmo problema volta, e
volta invisível — a página responde 200 servindo código velho.

## 2. Marcadores — o que precisa estar dentro de cada arquivo

Tamanho e hash valem para o pacote `champion-site-hostinger.zip` desta rodada.

| arquivo | bytes | sha256 (12) | precisa conter |
|---|---:|---|---|
| `js/products-cms.js` | 55207 | `cdc114ce1d21` | `atualizarEstadoEscolha`, `siblingsOf` |
| `js/product-slug.js` | 1032 | `d4f7d3795023` | `championProductSlug` |
| `js/product-data.js` | 4390 | `82b5711ed8cd` | `assetUrl` |
| `js/asset-url.js` | 880 | `ce8af90894ec` | `assetUrl` |
| `js/shopify-client.js` | 10595 | `d56394892b83` | `familia` |
| `js/main.js` | 120581 | `898795302592` | `setTextByRoute` |
| `js/ao-vivo.js` | 4038 | `455c6bc0b09d` | `rEnr_Ryomdk` |
| `js/lead-form.js` | 11810 | `b3ff86e58ad0` | `data-lead-form` |
| `js/conta-shopify.js` | 6438 | `839e58911cb8` | `shopifyOrders` |
| `css/styles.css` | 252198 | `3a857c3d216f` | `aguardando-escolha`, `lead-box` |
| `produto.html` | 22640 | `5ead3019fca1` | `data-lead-form` |
| `404.html` | 3501 | `452be9b6664f` | — |
| `.htaccess` | 3987 | `62eda9debacd` | `201.48.81.157` |

**`asset-url.js` não aparece em nenhum `<script>` do HTML — isso é esperado.**
Ele é um módulo ES, importado por `product-data.js`, `products-cms.js`,
`blog.js`, `banners-cms.js` e `admin.js`. Procurá-lo no HTML dá falso negativo.

## 3. Checagem rápida (bypassa cache)

```bash
for f in products-cms produto-video product-slug product-data asset-url shopify-client main; do
  n=$(curl -s "https://champion.ind.br/js/$f.js?bust=$RANDOM" \
      | grep -cE 'championProductSlug|assetUrl|setTextByRoute|familia|siblingsOf')
  printf '%-20s %s ocorrencia(s)\n' "$f.js" "$n"
done
# o 404 de verdade: um endereço que não existe
curl -s -o /dev/null -w 'inexistente -> %{http_code} (esperado 404)\n' \
  "https://champion.ind.br/nao-existe-$RANDOM"
```

Qualquer `0` na primeira lista significa que o arquivo não subiu ou está vindo
do cache.

**Não teste o 404 pedindo `/404.html`** — a regra que remove o `.html` responde
301 para `/404`, e isso parece falha sem ser. O teste certo é pedir um endereço
inexistente e conferir se o status é **404** (antes era 200 servindo a home).

## 4. O teste que realmente prova

Status 200 não prova nada — a rota `/produtos/<slug>` responde 200 para
qualquer slug. **O que prova é o `<h1>` correto por slug.**

Como o `<h1>` é preenchido por JavaScript, isso só funciona num navegador. No
`curl` puro todos saem como `Difly Champion`, que é o conteúdo estático de
exemplo do HTML.

## 5. Ordem de upload

`404.html` precisa ir **junto ou antes** do `.htaccess`. Se o `ErrorDocument`
apontar para um arquivo ausente, o Apache passa a servir a página de erro
genérica dele.

---

# Escolha de apresentação (peso) na página de produto

No Shopify os tamanhos são **produtos separados**, não variantes de um produto:

```
difly                      protex-imunoestimulante-bovino
difly-mosca-balde-6kg      protex-250-ml
difly-sache-de-20-g        protex-100-ml
```

Dos 24 handles do catálogo, 18 carregam o peso no próprio handle. Como
`hasVariants = vnodes.length > 1` e cada produto tem uma variante só, o seletor
nunca aparecia — caía no rótulo único de `presentations`.

A solução não mexe nos SKUs nem nos handles (o SEO das URLs atuais é
preservado). O agrupamento é declarado em **metafields**.

## O que cadastrar no Shopify

Dois metafields, namespace **`custom`**, tipo **texto de uma linha**:

| chave | o que é | exemplo |
|---|---|---|
| `familia` | identificador do grupo — igual em todos os tamanhos do mesmo item | `difly` |
| `apresentacao` | rótulo do botão, o que o cliente lê | `Sachê 20 g` |

Exemplo para a linha Difly:

| produto | `familia` | `apresentacao` |
|---|---|---|
| `difly` | `difly` | `Balde 6 kg` |
| `difly-mosca-balde-6kg` | `difly` | `Balde 6 kg` |
| `difly-sache-de-20-g` | `difly` | `Sachê 20 g` |
| `difly-s3` | *(vazio)* | *(vazio)* |

**O Difly S3 fica de fora de propósito.** É outra formulação, não um tamanho do
Difly. Foi por isso que o agrupamento é declarado e não inferido do nome: por
prefixo, o S3 apareceria como uma "versão" do Difly — erro de produto, e num
item veterinário isso é sério.

## Comportamento

- Família vazia ou com um só produto → nada muda, segue o rótulo de sempre.
- Dois ou mais → viram botões com miniatura, apresentação e preço, ordenados do
  mais barato ao mais caro.
- **Nenhuma opção vem pré-selecionada.** Enquanto o cliente não escolhe, o preço
  aparece como "A partir de R$ X" — o menor da família.
- Clicar seleciona: troca preço e imagem na hora, sem recarregar e sem mudar de
  endereço. Os textos e os dados estruturados seguem sendo os do produto pelo
  qual o visitante entrou.
- **Adicionar ao carrinho sem escolher não adivinha tamanho** — leva o cliente
  até o seletor com o aviso "Escolha a apresentação antes de adicionar".
- Cada apresentação é um produto Shopify com seu próprio GID, então o checkout
  recebe exatamente o item escolhido.
- Apresentação sem estoque avisa e pede outra, em vez de deixar comprar.
- Produtos em rascunho nunca aparecem como opção.

Nada disso exige mudança de código: assim que os metafields forem preenchidos,
o seletor aparece sozinho.

---

# Exceção temporária: rede da Champion no `www`

## Por que existe

O domínio do Active Directory se chama `champion.ind.br`, igual ao domínio
público. Os controladores registram o próprio IP no apex da zona — comportamento
normal do AD. Resultado, dentro do escritório:

```
champion.ind.br       → 192.168.1.5 / 192.168.1.2   (servidores internos)
www.champion.ind.br   → 147.93.14.35                (o site, correto)
```

O redirect de `www` para o apex, que é correto para o público, mandaria o
visitante interno do endereço que funciona para o que não funciona. A exceção
isenta o IP de saída do escritório desse redirect.

```apache
RewriteCond %{HTTP_HOST} ^www\.(.+)$ [NC]
RewriteCond %{REMOTE_ADDR} !^201\.48\.81\.157$
RewriteRule ^ https://%1%{REQUEST_URI} [R=301,L]
```

Funciona porque o site **não** está atrás do proxy da Cloudflare — o servidor
enxerga o IP real do visitante. Se o proxy for ligado um dia, `REMOTE_ADDR` passa
a ser o IP da Cloudflare e esta regra para de funcionar.

## Como usar, no escritório

Acessar **`https://www.champion.ind.br`**. Vale distribuir como link ou favorito.

Digitar `champion.ind.br` sem o `www` **continua caindo no painel interno**, e
não há nada no site que corrija isso — a requisição nunca chega ao servidor.

## Como verificar depois do deploy

De dentro do escritório:

```
curl.exe -I https://www.champion.ind.br/
```
Esperado: **`HTTP/1.1 200`** (fica no www, sem redirecionar).

De fora (4G no celular, ou qualquer rede externa): a mesma URL tem que devolver
**`301`** com `Location: https://champion.ind.br/`.

Se os dois derem 301, a exceção não pegou. Se os dois derem 200, o redirect
quebrou para o público — nesse caso reverter na hora.

## Riscos conhecidos

- **IP fixo — confirmado pela Champion em 27/08/2026.** Era o principal risco:
  com IP dinâmico a regra deixaria de valer na primeira troca, sem erro nenhum,
  e o sintoma voltaria idêntico.
- Se um dia entrar um **segundo link de internet** (backup, redundância), o IP de
  saída muda no failover e a exceção para de valer justamente durante a queda.
  Cada link precisa da sua própria linha `RewriteCond`.
- Se o IP for trocado por qualquer motivo, atualizar a linha no `.htaccess`.

## Quando remover

Assim que o DNS interno for corrigido (procedimento do AD acima). Apagar a linha
`RewriteCond %{REMOTE_ADDR} ...` e o bloco de comentário. A partir daí o `www`
volta a redirecionar para o apex para todo mundo, inclusive o escritório — que
não precisará mais da exceção, porque o apex passará a resolver certo lá dentro.

## Se um dia existir redirect no servidor interno

Cogitou-se configurar o servidor interno que responde pelo apex
(`192.168.1.5`) para redirecionar `champion.ind.br` → `https://www.champion.ind.br/`,
resolvendo o problema também para quem digita sem o `www`.

Isso funciona, e não afeta o público: `192.168.1.5` é endereço privado, não
roteável na internet — nenhum cliente ou robô de busca alcança aquele servidor.

**As duas regras dependem uma da outra.** Sem a exceção de IP acima, o redirect
interno cria um loop:

```
champion.ind.br → 192.168.1.5 → 301 → www.champion.ind.br
                → nosso servidor → 301 → champion.ind.br
                → 192.168.1.5 → 301 → www ...
```

Ou seja: **nunca remover a exceção do `.htaccess` sem remover antes o redirect
interno.** Quando o DNS do AD for corrigido, sair na ordem: primeiro o redirect
interno, depois a exceção daqui.

---

# Conta do cliente pela Shopify (fase 1: status do pedido)

A loja usa as **novas contas de cliente**, onde `customerAccessTokenCreate` da
Storefront API não existe. O caminho é OAuth 2.0 / OIDC com a Customer Account
API, e a troca do código pelo token tem de ser server-side — por isso mora no
backend do Railway, em `backend/routes/conta.js`.

O token nunca chega ao navegador. O que vai é um id de sessão em cookie
`httpOnly`; o token fica no Firestore, na coleção `customerSessions`.

## O que configurar no Shopify

Criar um app de **Customer Account API** (headless) e anotar:

- **Shop ID** — o número que aparece nas URLs de autenticação
- **Client ID**
- **Client secret** — obrigatório. O documento de descoberta desta loja lista
  `token_endpoint_auth_methods_supported: client_secret_basic, client_secret_post`,
  sem `none`: o endpoint de token não aceita cliente público, e PKCE sozinho
  não basta.

Registrar como **redirect URI** autorizada:

```
https://<seu-backend>/api/conta/callback
```

## Variáveis de ambiente no Railway

| variável | exemplo |
|---|---|
| `SHOPIFY_SHOP_ID` | `57535168647` |
| `SHOPIFY_CUSTOMER_CLIENT_ID` | `shp_xxxxxxxx-...` |
| `SHOPIFY_CUSTOMER_CLIENT_SECRET` | **obrigatório** |
| `BACKEND_URL` | `https://api.champion.ind.br` |
| `SITE_URL` | `https://champion.ind.br` |
| `ALLOWED_ORIGINS` | `https://champion.ind.br,https://www.champion.ind.br` |

**`ALLOWED_ORIGINS` deixou de ser opcional.** Com o cookie de sessão em jogo,
aceitar origem desconhecida permitiria a qualquer site agir em nome do visitante
logado. Se estiver vazio, as rotas de conta respondem 503 de propósito — é
melhor o login não funcionar do que ficar exposto sem ninguém perceber.

## O domínio `api.champion.ind.br`

Enquanto o backend responder em `...railway.app`, o cookie de sessão é **cookie
de terceiros** — Safari e Firefox bloqueiam por padrão, e o Chrome está
encerrando. Dá para testar no Chrome, mas não dá para lançar assim.

A correção é apontar `api.champion.ind.br` para o Railway (domínio personalizado
lá + registro no DNS público). Aí o cookie é de primeira parte.

**Atenção — isso esbarra no Active Directory:** a zona interna é autoritativa
para `champion.ind.br`, então `api.champion.ind.br` **não vai resolver dentro do
escritório** sem um registro `api` criado lá. Mesma conversa da seção anterior,
com um item a mais.

## Verificar depois de configurar

```bash
curl -s https://<backend>/api/health          # deve responder ok
curl -si https://<backend>/api/conta/login    # deve responder 302 para shopify.com
```

Um **503** em `/api/conta/login` significa `ALLOWED_ORIGINS` vazio.
Um **JSON de erro** significa que faltou `SHOPIFY_SHOP_ID`, `CLIENT_ID` ou
`BACKEND_URL`.

## Uma coisa a validar na primeira execução

A query de pedidos em `/api/conta/pedidos` foi escrita contra o schema
documentado da Customer Account API, mas não foi possível executá-la sem as
credenciais. Se algum nome de campo divergir, o erro do GraphQL sai **cru no log
do Railway** de propósito — é o que permite corrigir sem adivinhação.

## Os dois apps não se misturam

A loja tem **dois** apps, com credenciais diferentes e não intercambiáveis:

| app | serve para | credencial |
|---|---|---|
| App personalizado (já existia) | catálogo, carrinho, checkout — token da Storefront | `shpss_…` |
| Customer Account API (criar) | login do cliente e status do pedido | `shp_…` + secret próprio |

`SHOPIFY_CUSTOMER_CLIENT_ID` e `SHOPIFY_CUSTOMER_CLIENT_SECRET` são **do
segundo**. Usar as credenciais do primeiro devolve erro de cliente inválido no
`/oauth/token`, sem dizer por quê.

## Endpoints — confirmados no documento de descoberta

Não precisa perguntar a ninguém: a própria loja publica.

```
https://shopify.com/authentication/57535168647/.well-known/openid-configuration
```

O que ele devolve, e que o código já usa:

```
authorization_endpoint  https://shopify.com/authentication/57535168647/oauth/authorize
token_endpoint          https://shopify.com/authentication/57535168647/oauth/token
end_session_endpoint    https://shopify.com/authentication/57535168647/logout
scopes_supported        openid, email, customer-account-api:full
code_challenge_methods  S256
auth methods            client_secret_basic, client_secret_post   ← sem "none"
```

Se um dia o login parar de funcionar sem motivo aparente, esse endereço é o
primeiro lugar a olhar: ele mostra o que a loja realmente aceita hoje.
