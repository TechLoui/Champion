// Função executada por playwright-cli run-code, com mocks somente no navegador.
async page => {
  const requests = [];
  const produto = (i, preco = 10, estoque = true) => ({ handle: 'qa-' + i, nome: 'Produto QA ' + i, resumo: 'Teste da interface',
    foto: '', apresentacoes: [{ variantId: 'v' + i, apresentacao: 'Balde 10 kg', precoNum: preco, preco: preco ? 'R$ 10,00' : 'R$ 0,00',
      disponivel: estoque, compravel: preco > 0 && estoque, sobConsulta: preco <= 0 }] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.route('**/api/chat', async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const segunda = body.catalogoOffset === 4;
    const compra = body.mensagem.startsWith('Quero 1 unidade');
    const reply = compra ? { resposta: 'Item validado.', produtos: [], carrinho: [{ handle: 'qa-1', nome: 'Produto QA 1', variantId: 'v1',
      apresentacao: 'Balde 10 kg', precoNum: 10, quantidade: 1, disponivel: true, compravel: true, sobConsulta: false }] }
      : { resposta: segunda ? 'Últimos produtos.' : 'Mostrando produtos 1 a 4 de 6.',
        produtos: segunda ? [produto(5), produto(6)] : [produto(1), produto(2, 0), produto(3, 10, false), produto(4)],
        catalogo: { total: 6, de: segunda ? 5 : 1, ate: segunda ? 6 : 4, proximoOffset: segunda ? null : 4 } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  await page.goto('http://127.0.0.1:5510/qa-reset');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('http://127.0.0.1:5510/index.html');
  await page.evaluate(() => {
    localStorage.clear();
    window.qaItens = [];
    window.ChampionCart = { add: i => window.qaItens.push(i), count: () => window.qaItens.length, items: () => window.qaItens,
      total: () => window.qaItens.reduce((total, i) => total + i.price * i.qty, 0), remove: () => {}, open: () => {} };
  });
  await page.getByRole('button', { name: /Abrir atendimento/ }).click();
  const input = page.locator('#chatInput');
  await input.fill('Me mostre todos os produtos do catálogo');
  await page.locator('#chatEnviar').click();
  await page.locator('.chat-card').nth(3).waitFor();
  if (await page.locator('.chat-card').count() !== 4) throw Error('Quarto card oculto');
  const zero = page.locator('.chat-card').nth(1).locator('.chat-option');
  if (!await zero.isDisabled() || !/Sob consulta/.test(await zero.innerText())) throw Error('Preço zero comprável');
  if (!await page.locator('.chat-card').nth(2).locator('.chat-option').isDisabled()) throw Error('Sem estoque comprável');
  await page.getByRole('button', { name: 'Mostrar mais produtos', exact: true }).click();
  await page.locator('.chat-card').nth(5).waitFor();
  if (requests[1].catalogoOffset !== 4 || await page.locator('.chat-card').count() !== 6) throw Error('Próxima página incorreta');
  await page.locator('.chat-card').first().locator('.chat-option').click();
  await page.locator('.chat-inline-add').click();
  await page.waitForFunction(() => window.qaItens.length === 1);
  await page.waitForFunction(() => document.getElementById('chatEnviar').disabled === false);
  if (/Não consegui me conectar/.test(await page.locator('#championChat').innerText())) throw Error('Erro após resposta válida');
  if ((await page.evaluate(() => window.qaItens)).length !== 1) throw Error('Inclusão duplicada');
  await page.locator('#championChat').screenshot({ path: 'output/playwright/chat-mobile-refinamentos.png' });
  return { cards: await page.locator('.chat-card').count(), paginaOffset: requests[1].catalogoOffset,
    carrinho: await page.evaluate(() => window.qaItens), viewport: page.viewportSize() };
}
