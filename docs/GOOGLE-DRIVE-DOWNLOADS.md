# Google Drive e área de Downloads

Esta integração permite navegar em uma pasta privada do Google Drive pelo painel administrativo, classificar os materiais e liberar somente os arquivos escolhidos em `https://champion.ind.br/downloads`.

## Como funciona

- O navegador do visitante nunca acessa o Google Drive diretamente.
- O backend usa uma conta de serviço com permissão somente de leitura na pasta raiz compartilhada.
- Ao publicar um arquivo ou uma pasta, o painel grava no Firestore apenas os metadados necessários e as permissões de visualização/download.
- A API pública lista somente documentos com `status: published` e transmite o arquivo do Drive pelo backend.
- Remover uma publicação do painel não apaga o arquivo original do Drive.

Coleções criadas no Firestore:

- `downloads`: arquivos importados e suas opções de publicação.
- `downloadCategories`: categorias definidas no painel.
- `downloadSources`: arquivos/pastas selecionados como origem, para rastreabilidade e reimportação.

O acesso administrativo continua protegido por Firebase Auth e pelo documento `blogAdmins/{uid}` com `active: true`.

## 1. Preparar o Google Cloud

1. Abra o projeto Google Cloud usado pela conta de serviço escolhida.
2. Em **APIs e serviços > Biblioteca**, habilite **Google Drive API**.
3. Crie uma conta de serviço dedicada ou reutilize, inicialmente, a conta de serviço do Firebase já usada pelo backend.
4. Copie o campo `client_email` do JSON da conta de serviço.
5. No Google Drive, compartilhe **somente a pasta raiz dos materiais** com esse e-mail, como **Leitor**.
6. Copie o ID da pasta. Em uma URL como `https://drive.google.com/drive/folders/ID_DA_PASTA`, o valor depois de `/folders/` é o ID.

Uma conta de serviço não enxerga automaticamente o Drive de uma pessoa. O compartilhamento da pasta com o `client_email` é obrigatório. Não torne a pasta pública.

## 2. Variáveis no Railway

Adicione no serviço do backend:

```text
GOOGLE_DRIVE_ROOT_FOLDER_ID=ID_DA_PASTA_COMPARTILHADA
GOOGLE_DRIVE_SERVICE_ACCOUNT={JSON_COMPLETO_DA_CONTA_DE_SERVICO}
```

Se a mesma conta de serviço do Firebase tiver acesso à pasta, `GOOGLE_DRIVE_SERVICE_ACCOUNT` pode ser omitida: o backend usa `FIREBASE_SERVICE_ACCOUNT` ou as variáveis separadas do Firebase como fallback.

Também são aceitas credenciais Drive separadas:

```text
GOOGLE_DRIVE_PROJECT_ID=seu-projeto-google
GOOGLE_DRIVE_CLIENT_EMAIL=service-account@seu-projeto.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Variáveis opcionais:

```text
GOOGLE_DRIVE_IMPORT_MAX_FILES=1000
GOOGLE_DRIVE_IMPORT_MAX_DEPTH=25
GOOGLE_DRIVE_IMPORT_MAX_ITEMS=5000
PUBLIC_DOWNLOADS_SCAN_LIMIT=5000
```

`ALLOWED_ORIGINS` precisa conter o domínio oficial:

```text
https://champion.ind.br,https://www.champion.ind.br
```

Nunca envie o JSON da conta de serviço para o frontend nem faça commit de arquivos de credencial.

## 3. Publicar e validar o backend

Depois do deploy, confira:

```bash
curl https://champion-production-cab6.up.railway.app/api/health
```

Em `config.googleDrive`, o valor deve ser `true`. A verificação completa da pasta é exibida dentro da seção **Downloads** do painel, pois o endpoint de status exige login administrativo.

Principais endpoints:

| Método | Endpoint | Acesso | Finalidade |
|---|---|---|---|
| `GET` | `/api/admin/drive/status` | Admin | Testa credencial e pasta raiz |
| `GET` | `/api/admin/drive/items` | Admin | Navega/pesquisa no Drive |
| `GET/POST/PATCH/DELETE` | `/api/admin/downloads` | Admin | Publicações |
| `GET/POST/PATCH/DELETE` | `/api/admin/download-categories` | Admin | Categorias |
| `GET` | `/api/downloads` | Público | Busca e lista publicações |
| `GET` | `/api/downloads/categories` | Público | Lista categorias ativas |
| `GET` | `/api/downloads/:id/view` | Público | Visualização inline autorizada |
| `GET` | `/api/downloads/:id/download` | Público | Download autorizado |

## 4. Uso no painel

1. Entre em `/login-admin` com um administrador Firebase válido.
2. Abra **Downloads** na barra lateral.
3. Confira se o cartão do Drive mostra **Conectado**.
4. Crie as categorias necessárias.
5. Navegue pelas pastas ou pesquise no Drive.
6. Selecione arquivos ou pastas. Pastas são importadas recursivamente.
7. Defina as categorias e libere **Visualização**, **Download** ou ambos.
8. Publique a seleção.

Arquivos Google Docs, Sheets e Slides são exportados em um formato apropriado. PDFs, imagens, áudio, vídeo e texto podem ser visualizados no navegador; tipos não seguros para visualização ficam disponíveis apenas para download.

Para captar arquivos novos de uma pasta já usada, selecione e publique a pasta novamente. Os arquivos já cadastrados preservam o status, as categorias e as permissões ajustadas individualmente; as opções da barra de publicação são aplicadas aos arquivos novos. O processo atual é sob demanda e não executa sincronização automática em segundo plano.

## 5. Checklist de produção

- [ ] Google Drive API habilitada.
- [ ] Pasta raiz compartilhada com o `client_email` da conta de serviço.
- [ ] `GOOGLE_DRIVE_ROOT_FOLDER_ID` configurada no Railway.
- [ ] Credencial Drive configurada ou fallback Firebase confirmado.
- [ ] `ALLOWED_ORIGINS` contém `champion.ind.br` e `www.champion.ind.br`.
- [ ] Backend publicado e `/api/health` com `config.googleDrive: true`.
- [ ] Frontend publicado com `downloads.html`, `css/downloads.css`, `js/downloads.js` e o menu atualizado.
- [ ] Categoria criada e um arquivo de teste publicado.
- [ ] Busca, filtro, visualização e download testados no domínio oficial.

## Segurança e limites

- Todas as rotas administrativas exigem token Firebase válido e a whitelist `blogAdmins`.
- Navegação, importação e streaming rejeitam itens fora da pasta raiz configurada.
- A rota pública nunca aceita um ID arbitrário do Drive; ela resolve o ID a partir de uma publicação válida no Firestore.
- O backend usa rate limit e valida tamanhos, profundidade, paginação, IDs e intervalos de bytes.
- Visualizações usam uma lista restrita de MIME types e respostas com `nosniff`/sandbox.
