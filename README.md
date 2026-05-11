# Champion Saúde Animal

Site institucional, blog e painel administrativo da Champion Saúde Animal.

## Estrutura do projeto

```
Champion/
├── frontend/                  # Site público + painéis admin (HTML/CSS/JS estático)
│   ├── index.html             # Home
│   ├── sobre.html             # Sobre a empresa
│   ├── produtos.html          # Listagem de produtos
│   ├── produto.html           # Página individual de produto (?p=slug)
│   ├── blog.html              # Listagem de posts do blog
│   ├── calculo-dose.html      # Ferramenta interativa
│   ├── login-admin.html       # Login do painel administrativo
│   ├── login-blog.html        # Login do painel do blog
│   ├── admin.html             # Painel admin · visão geral / produtos / banners / contatos / configurações
│   ├── painel-blog.html       # Painel do blog
│   ├── admin/                 # Sub-páginas do painel administrativo
│   │   ├── _panel.css         # CSS compartilhado por todas as sub-páginas
│   │   ├── _panel.js          # Login guard + sidebar + logout (script comum)
│   │   ├── produtos-cadastro.html  # Catálogo & preços
│   │   ├── pedidos.html            # Pedidos & frete (kanban + lista)
│   │   └── clientes.html           # Base de clientes
│   ├── assets/                # Imagens e vídeos
│   ├── css/                   # CSS do site público
│   └── js/                    # Scripts do site (módulos ES + Firebase client)
│
├── backend/                   # API Node/Express (deploy: Railway)
│   ├── server.js              # Entrada do servidor
│   ├── routes/
│   │   └── leads.js           # Captura de leads do site
│   ├── package.json
│   └── railway.toml
│
├── docs/                      # Documentação interna
│   ├── ADMIN.md
│   └── FIREBASE-BLOG.md
│
├── .github/                   # CI, templates de issue/PR
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── deploy-frontend.yml
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
│
├── firebase.json              # Configuração do Firebase Hosting + Firestore + Storage
├── firestore.rules
├── storage.rules
└── .gitignore
```

## Painel administrativo

### Visão geral das telas

**Núcleo** (em `admin.html`, com tabs internas):
- Visão geral · dashboard com gráficos (KPIs, linha, donut, barras, pizza)
- Produtos · catálogo (grid de cards + drawer lateral de edição)
- Banners · home
- Contatos · leads
- Configurações · gerais

**Operação** (sub-páginas em `admin/`):
- Catálogo & preços — produtos, categorias, tabelas de preço
- Pedidos & frete — kanban + lista + status (Pago → Separação → Trânsito → Entregue)
- Clientes — base com histórico de compras, segmentação, bloqueio/reativação

### Acesso

Credenciais de desenvolvimento (modo local):
- **E-mail:** `admin@champion.com.br`
- **Senha:** `Champion@2026`

Em produção, o painel autentica via Firebase Auth e exige um documento `blogAdmins/{uid}` com `active: true` no Firestore.

## Rodando localmente

### Frontend (modo simples)

Basta abrir `frontend/index.html` no navegador. Para suporte completo a ES modules, sirva via HTTP (Live Server / `npx serve frontend`).

### Backend

```bash
cd backend
npm install
npm run dev
```

A API escuta em `http://localhost:3000` por padrão. Configure variáveis de ambiente em `backend/.env` (Firebase service account, Resend API key).

## Deploy

- **Frontend:** Firebase Hosting (workflow em `.github/workflows/deploy-frontend.yml`)
- **Backend:** Railway (configuração em `backend/railway.toml`)

## Tecnologias

- **Frontend:** HTML/CSS/JS vanilla, ES modules, Firebase JS SDK (Auth, Firestore, Storage)
- **Backend:** Node 20+, Express, Firebase Admin, Resend (e-mail transacional)
- **Hosting:** Firebase Hosting (estático), Railway (API)
