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
│   │   ├── produtos-cadastro.html
│   │   ├── produtos-midia.html
│   │   ├── pedidos.html
│   │   ├── lojas.html
│   │   ├── clientes.html
│   │   ├── conteudo-faq.html
│   │   ├── conteudo-paginas.html
│   │   ├── controle.html
│   │   ├── relatorios-vendas.html
│   │   ├── relatorios-clientes.html
│   │   ├── relatorios-trafego.html
│   │   └── relatorios-pagamentos.html
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
- Visão geral · métricas resumo
- Produtos · catálogo
- Banners · home
- Contatos · leads
- Configurações · gerais

**Produtos & Operação** (em `admin/`):
- Catálogo & preços — produtos, categorias, tabelas de preço
- Mídias & materiais — imagens, banners regionais, estoque, fichas técnicas
- Pedidos & frete — kanban + lista + integrações de transporte
- Lojas & filiais — matrizes, filiais, revendas

**Conteúdo & Cadastros** (em `admin/`):
- Clientes — cadastro, histórico de compras, segmentação
- FAQ, depoimentos & vagas — gestão de conteúdo de relacionamento
- Páginas institucionais — textos de Home, Sobre, Privacidade, etc.
- Painel central — atalhos, atividade recente, status de integrações

**Relatórios & Performance** (em `admin/`):
- Vendas & financeiro — receita, ticket médio, vendas por canal/categoria
- Ticket & recorrência — top produtos, coortes, top clientes
- Tráfego & comportamento — sessões, abandono de carrinho, funil de conversão
- Pagamentos — distribuição Pix/Cartão/Boleto, aprovação, comportamento por canal

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
