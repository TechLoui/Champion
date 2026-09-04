# Guia de produção · Champion Saúde Animal

Passo-a-passo para colocar o site, o painel administrativo e o backend em produção.

---

## 1. Pushar o código pro GitHub

O repositório local já está iniciado e o remote já aponta para `https://github.com/TechLoui/Champion`. Falta autenticar e pushar:

```bash
cd Champion
git push -u origin main
```

> O Windows usará o **Git Credential Manager**. Abrirá um pop-up para login no GitHub. Se preferir, use um Personal Access Token: <https://github.com/settings/tokens>.

A partir do segundo push, basta `git push`.

---

## 2. Firebase — Console

Acesse <https://console.firebase.google.com>, abra o projeto que você criou.

### 2.1. Adicionar app web

1. **Configurações do projeto** → ⚙️ → aba **Geral** → role até **"Seus apps"**
2. Clique no ícone `</>` (Web)
3. Apelido: `champion-web`. NÃO marque "Configurar hospedagem"
4. Copie o objeto `firebaseConfig` que aparece

### 2.2. Colar a config no frontend

Edite [frontend/js/firebase-config.js](../frontend/js/firebase-config.js) e preencha:

```js
export const CHAMPION_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "champion-xxxxx.firebaseapp.com",
  projectId: "champion-xxxxx",
  storageBucket: "champion-xxxxx.appspot.com",
  messagingSenderId: "...",
  appId: "1:...:web:..."
};
```

Commit + push:
```bash
git add frontend/js/firebase-config.js
git commit -m "chore: configurar credenciais Firebase web app"
git push
```

### 2.3. Habilitar Authentication

1. **Build → Authentication → Get started**
2. Aba **Sign-in method** → habilite **E-mail/senha**
3. Aba **Users** → clique **Adicionar usuário**
   - E-mail: `admin@champion.com.br`
   - Senha: `Champion@2026`
4. **COPIE O UID** do usuário criado (você vai precisar no passo 2.5)

### 2.4. Criar Firestore Database

1. **Build → Firestore Database → Criar banco de dados**
2. Modo: **produção** (já temos regras prontas)
3. Local: `southamerica-east1` (São Paulo)
4. Espere a inicialização

### 2.5. Liberar o admin (doc `blogAdmins`)

1. No Firestore, clique **+ Iniciar coleção**
2. ID da coleção: `blogAdmins`
3. ID do documento: cole o **UID** que copiou em 2.3
4. Campos:
   - `active` → boolean → `true`
   - `email` → string → `admin@champion.com.br`
   - `createdAt` → timestamp → agora
5. Salvar

### 2.6. Criar Storage

1. **Build → Storage → Get started**
2. Modo: **produção**
3. Local: o mesmo do Firestore (`southamerica-east1`)

### 2.7. Publicar as regras (Firestore + Storage)

Você pode publicar pelo console (copiar/colar) ou pelo CLI (mais robusto).

**Pelo CLI** (recomendado):
```bash
npm install -g firebase-tools
firebase login
firebase use champion-xxxxx   # use seu projectId
firebase deploy --only firestore:rules,storage
```

**Pelo console** (alternativa): cole o conteúdo de [firestore.rules](../firestore.rules) e [storage.rules](../storage.rules) na aba de regras.

---

## 3. Frontend oficial — Hostinger

O domínio oficial **`https://champion.ind.br`** é servido pela Hostinger/LiteSpeed. Publique o conteúdo atual da pasta `frontend/` na raiz pública do domínio (`public_html`), incluindo o arquivo oculto `.htaccess`. Não envie a pasta `frontend` como um nível extra.

Antes de substituir arquivos, leia [DEPLOY-CHECK.md](DEPLOY-CHECK.md): há conteúdo que existe somente no servidor e não deve ser apagado por uma sincronização destrutiva. Gere um pacote novo a partir de `frontend/`; os diretórios/ZIPs antigos do workspace são artefatos ignorados e podem estar desatualizados.

Depois do upload, valide ao menos:

```bash
curl -I https://champion.ind.br/
curl -I https://champion.ind.br/downloads
```

O segundo endereço precisa responder `200`, sem redirecionar para uma página genérica.

### 3.1. Firebase Hosting alternativo

O `firebase.json` e o workflow [.github/workflows/deploy-frontend.yml](../.github/workflows/deploy-frontend.yml) continuam disponíveis para preview ou hospedagem alternativa, mas publicar ali **não atualiza o domínio oficial da Hostinger**.

---

## 4. Railway (backend)

### 4.1. Conectar o repositório

1. <https://railway.app/dashboard> → **New Project** → **Deploy from GitHub repo**
2. Selecione `TechLoui/Champion`
3. Em **Settings → Service**:
   - **Root Directory:** `backend`
4. O Nixpacks vai detectar Node 20 e rodar `node server.js` (configurado no [backend/railway.toml](../backend/railway.toml))

### 4.2. Variáveis de ambiente

Em **Settings → Variables**, declare:

| Variável | Valor | Obrigatória? |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://champion.ind.br,https://www.champion.ind.br` | **Sim** |
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo da service account (mesmo do GitHub) | Sim, para salvar leads no Firestore |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ID ou URL da pasta raiz compartilhada | Sim, para a área de Downloads |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT` | JSON da conta de serviço com Drive API habilitada; pode omitir se reutilizar a conta Firebase | Conforme a credencial escolhida |
| `RESEND_API_KEY` | Chave da API do Resend (<https://resend.com/api-keys>) | Para enviar e-mail de notificação |
| `NOTIFICATION_EMAIL` | E-mail que recebe os contatos (ex.: `comercial@champion.ind.br`) | Para enviar e-mail |
| `FROM_EMAIL` | Opcional. Default `noreply@champion.ind.br` (precisa estar verificado no Resend) | Não |

> `PORT` o Railway injeta automaticamente — não declarar.

Veja o preparo da pasta, as permissões e o fluxo de publicação em [GOOGLE-DRIVE-DOWNLOADS.md](GOOGLE-DRIVE-DOWNLOADS.md).

### 4.3. Verificar saúde

Após o deploy, a URL pública estará em **Deployments → View Logs**. Teste:

```bash
curl https://<sua-url>.up.railway.app/api/health
# { "ok": true, "service": "champion-backend", "ts": "..." }
```

E um teste real de lead:

```bash
curl -X POST https://<sua-url>.up.railway.app/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@x.com","message":"ping"}'
```

Deve voltar `201` e o documento aparece em `Firestore → adminLeads`.

### 4.4. Apontar o frontend para o backend

Atualmente o site não chama o backend (form de contato grava direto via Firebase ou e-mail). Quando você quiser ativar o endpoint, edite [frontend/js/contact.js](../frontend/js/contact.js) e ajuste para `fetch(BACKEND_URL + '/api/leads', { ... })`. Pode armazenar a URL como constante no topo do arquivo.

---

## 5. Checklist final de produção

- [ ] Repo público/privado no GitHub (`git push` feito)
- [ ] Firebase config preenchida em `frontend/js/firebase-config.js`
- [ ] Authentication com e-mail/senha habilitado
- [ ] Usuário admin criado + doc em `blogAdmins/{uid}` com `active: true`
- [ ] Firestore Database criado (`southamerica-east1`)
- [ ] Storage criado (mesma região)
- [ ] Regras publicadas (Firestore + Storage)
- [ ] Conteúdo de `frontend/` publicado na Hostinger, incluindo `.htaccess`
- [ ] `https://champion.ind.br` e `https://champion.ind.br/downloads` respondendo corretamente
- [ ] (Opcional) Secrets do workflow alternativo: `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`
- [ ] Railway conectado ao repo, root = `backend`
- [ ] Vars Railway: `ALLOWED_ORIGINS`, `FIREBASE_SERVICE_ACCOUNT`, (`RESEND_API_KEY`, `NOTIFICATION_EMAIL`)
- [ ] `/api/health` respondendo na URL Railway
- [ ] Teste end-to-end: cadastro de cliente → pedido → pedido aparece no painel admin

---

## 6. Como testar o fluxo completo em produção

1. Abrir `https://champion-xxxxx.web.app/cliente-conta.html` → criar conta
2. Abrir `https://champion-xxxxx.web.app/produtos.html` → adicionar produto ao carrinho
3. Abrir o carrinho → **Finalizar** → preencher checkout → confirmar
4. Pedido aparece em **Minha conta** (`/minha-conta.html`)
5. Login admin (`/login-admin.html`) com `admin@champion.com.br` / `Champion@2026`
6. **Produtos & Operação → Pedidos & frete** — o pedido aparece como "Pago"
7. **Conteúdo & Cadastros → Clientes** — o cliente aparece com 1 pedido + total

---

## 7. Troubleshooting

**"CORS bloqueado para origem" no backend Railway**
→ A URL do frontend não está em `ALLOWED_ORIGINS`. Adicione e re-deploy.

**Login admin: "Usuário autenticado, mas sem permissão"**
→ Falta o doc `blogAdmins/{uid}` com `active: true`. Confira passo 2.5.

**Painel admin não carrega produtos/pedidos**
→ Provavelmente as regras Firestore não foram publicadas. Rode `firebase deploy --only firestore:rules`.

**Storage: upload falha com "permission-denied"**
→ Verifique que o usuário está logado no Firebase Auth (não só localStorage). Rode `firebase deploy --only storage`.

**Frontend continua em modo localStorage mesmo com Firebase configurado**
→ Confira o console do navegador. Procure por `[ChampionCustomers] Modo Firebase ativo.`. Se aparecer `Firebase indisponível, usando localStorage:` há erro no `firebase-config.js` (campos faltando ou inválidos).
