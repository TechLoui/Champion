# Blog Champion com Firebase

## Ativação

1. Crie um projeto no Firebase e adicione um app Web.
2. Ative Authentication com provedor Email/senha.
3. Ative Cloud Firestore.
4. Copie a configuração Web do Firebase Console para `js/firebase-config.js`.
5. Crie o usuário administrador em Authentication.
6. Copie o UID desse usuário e crie no Firestore:

```text
blogAdmins/{UID_DO_USUARIO}
active: true
email: "admin@champion.com.br"
name: "Administrador Champion"
```

7. Publique as regras e o site:

```bash
firebase deploy --only firestore:rules,storage:rules,hosting
```

8. Entre em `/login-blog` com o usuário autorizado e abra o painel. Crie os artigos em **Novo artigo**; os dados existentes são preservados e não há restauração automática de exemplos em produção.

## Coleções

- `blogPosts`: artigos do blog. Posts com `status: "published"` aparecem publicamente; `status: "draft"` fica restrito ao painel.
- `blogConfig/main`: título, descrição, imagem principal e post em destaque.
- `products`: produtos do catálogo. Produtos publicados aparecem em `produtos.html` e `produto.html`.
- `siteSettings/main`: dados globais de atendimento e comunicação.
- `adminLeads`: contatos recebidos e oportunidades para retorno.
- `blogAdmins/{uid}`: libera acesso ao painel para usuários autenticados.

## Espaço editorial

O painel tem quatro páginas: visão geral, biblioteca de artigos, editor e configurações. A biblioteca permite buscar por título, categoria e autor, filtrar publicados/rascunhos, ordenar, paginar e duplicar um artigo para uma nova edição.

O editor mantém os modelos padrão, galeria e tutorial, incluindo formato da capa, imagem complementar, legendas e etapas. Imagens JPG, PNG e WebP de até 5 MB são enviadas ao Storage antes de salvar; uma falha preserva a imagem anterior. Rascunhos podem ser salvos incompletos. Publicar exige as informações mínimas do modelo escolhido. Voltar uma publicação a rascunho e excluir um artigo pedem confirmação.

Uma recuperação local por conta e artigo guarda alterações neste navegador; ela não é uma publicação nem substitui **Salvar rascunho**. A prévia pode ser aberta antes de salvar. No celular, as ações de edição ficam na barra inferior.

As configurações de título, descrição, imagem e destaque são do blog Champion. O seletor de destaque contém somente artigos publicados. Os artigos continuam na mesma coleção compartilhada com o Controle Carrapato, cujo atalho administrativo encaminha ao painel central.

O login usa Firebase Auth e verifica `blogAdmins/{uid}.active`. A recuperação de senha envia as instruções pelo Firebase; a mensagem de confirmação não revela se o e-mail pertence a uma conta. Sessões antigas são verificadas antes de abrir o painel. Uma falha no serviço não transforma o painel de produção em modo local.

## Prévia e verificações

Sirva `frontend` por HTTP e abra `http://localhost:8090/painel-blog.html?preview=1`. A prévia sem Firebase só é aceita pelo novo painel em localhost; seus artigos ficam no navegador e não alteram os blogs publicados.

```text
node tools/test-blog-panel.cjs
node tools/test-blog-auth.cjs
```

Os testes de modelo e autenticação usam dados e serviços simulados, sem enviar e-mails ou gravar no Firebase.
