# Conferência de deploy — champion.ind.br (Hostinger)

O deploy de 26/08 subiu os HTML e os arquivos JS **novos**, mas não os JS
**alterados**. Como o sintoma era silencioso (a página abria, só mostrava o
produto errado), a falha só apareceu no teste manual slug a slug.

Esta é a lista para conferir depois de subir. Leva um minuto.

## 1. Todo arquivo JS/CSS precisa vir com `?v=20260827-4`

O `.htaccess` cacheia JS e CSS por 1 hora, e a Hostinger tem cache próprio
(LiteSpeed). Um arquivo alterado que mantém a mesma URL continua sendo servido
da versão antiga. Por isso o stamp é unificado: 91 referências, todas iguais.

**Sempre que um JS mudar, bumpe o stamp.** Sem isso o mesmo problema volta, e
volta invisível — a página responde 200 servindo código velho.

## 2. Marcadores — o que precisa estar dentro de cada arquivo

Tamanho e hash valem para o pacote `champion-site-hostinger.zip` desta rodada.

| arquivo | bytes | sha256 (12) | precisa conter |
|---|---:|---|---|
| `js/products-cms.js` | 55109 | `0c955689cfc3` | `atualizarEstadoEscolha`, `siblingsOf` |
| `js/product-slug.js` | 1032 | `d4f7d3795023` | `championProductSlug` |
| `js/product-data.js` | 17344 | `3093df450a19` | `assetUrl`, `family` |
| `js/asset-url.js` | 880 | `ce8af90894ec` | `assetUrl` |
| `js/shopify-client.js` | 10595 | `d56394892b83` | `familia` |
| `js/main.js` | 130494 | `07920ce0f6c8` | `setTextByRoute` |
| `js/ao-vivo.js` | 4038 | `455c6bc0b09d` | `rEnr_Ryomdk` |
| `css/styles.css` | 240167 | `209b5f8b4e31` | `aguardando-escolha` |
| `produto.html` | 40850 | `c49a128c3f94` | `src: '/assets/img/products/` (19x) |
| `404.html` | 3501 | `452be9b6664f` | — |
| `.htaccess` | 3412 | `fa64cea341da` | `ErrorDocument 404 /404.html`, `201.48.81.157` |

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
