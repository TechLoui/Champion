# Painel Administrativo Champion

O painel geral fica em:

```text
admin.html
```

## O que ele gerencia

- Produtos do catálogo.
- Status de publicação ou rascunho.
- Dados principais de atendimento.
- Contatos recebidos.
- Atalho para o painel do blog (`painel-blog.html`).

## Modo local

Enquanto `js/firebase-config.js` estiver sem as chaves do Firebase, o painel usa `localStorage`:

```text
admin@champion.com.br
Champion@2026
```

## Modo Firebase

1. Preencha `js/firebase-config.js`.
2. Crie o usuário no Firebase Authentication.
3. Crie o documento `blogAdmins/{uid}` no Firestore:

```text
active: true
email: "admin@champion.com.br"
name: "Administrador Champion"
```

4. Acesse `admin.html` e clique em `Restaurar padrão` em Produtos para popular a coleção `products`.

O catálogo público (`produtos.html`) e a página de detalhe (`produto.html?p=...`) leem os produtos publicados pelo painel.
