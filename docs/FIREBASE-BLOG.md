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

8. Entre em `painel-blog.html` com o usuário do Firebase e clique em `Restaurar padrão` uma vez para popular posts e configuração inicial.

## Coleções

- `blogPosts`: artigos do blog. Posts com `status: "published"` aparecem publicamente; `status: "draft"` fica restrito ao painel.
- `blogConfig/main`: título, descrição, imagem principal e post em destaque.
- `products`: produtos do catálogo. Produtos publicados aparecem em `produtos.html` e `produto.html`.
- `siteSettings/main`: dados globais de atendimento e comunicação.
- `adminLeads`: contatos recebidos e oportunidades para retorno.
- `blogAdmins/{uid}`: libera acesso ao painel para usuários autenticados.

Sem configuração Firebase, o painel continua em modo local de desenvolvimento para testes.
