async page => {
  const fixtures = await (await page.request.get('http://127.0.0.1:5510/qa-fixtures')).json();
  const layouts = [];
  await page.route('**/api/chat', async route => {
    const body = route.request().postDataJSON();
    const reply = body.mensagem.includes('Difly') ? fixtures.difly : fixtures.vermisal;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  const sizes = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 390, height: 360 },
    { width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }];
  for (const viewport of sizes) {
    await page.setViewportSize(viewport);
    await page.goto('http://127.0.0.1:5510/qa-reset');
    await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
    await page.goto('http://127.0.0.1:5510/index.html');
    await page.locator('#chatFab').click();
    await page.locator('#chatInput').fill('Quero saber mais sobre o Vermisal');
    await page.locator('#chatEnviar').click();
    await page.locator('.chat-card').waitFor();
    await page.waitForFunction(() => !document.getElementById('chatEnviar').disabled);
    const geometry = await page.evaluate(() => {
      const corpo = document.getElementById('chatCorpo');
      const painel = document.getElementById('chatPainel').getBoundingClientRect();
      const head = document.querySelector('.chat-head').getBoundingClientRect();
      const form = document.querySelector('.chat-form').getBoundingClientRect();
      const resposta = [...corpo.querySelectorAll('.chat-msg-bot')].at(-1).getBoundingClientRect();
      const limites = corpo.getBoundingClientRect();
      return { viewport: [innerWidth, innerHeight], painel: [painel.top, painel.bottom, painel.left, painel.right],
        form: [form.top, form.bottom], header: [head.top, head.bottom], overflowX: corpo.scrollWidth - corpo.clientWidth,
        respostaVisivel: resposta.top >= limites.top - 1 && resposta.top < limites.bottom,
        corpoAltura: corpo.clientHeight, textareaOverflow: document.getElementById('chatInput').scrollHeight - document.getElementById('chatInput').clientHeight,
        fotos: corpo.querySelectorAll('.chat-card-foto img').length, fotosSemFalha: [...corpo.querySelectorAll('.chat-card-foto img')].every(i => !i.complete || i.naturalWidth > 0),
        verFoto: /Ver foto/.test(corpo.innerText), slide: corpo.querySelectorAll('.chat-slide').length };
    });
    if (geometry.painel[0] < -1 || geometry.painel[1] > geometry.viewport[1] + 1 || geometry.painel[2] < -1 || geometry.painel[3] > geometry.viewport[0] + 1) throw Error('Painel fora da tela: ' + JSON.stringify(geometry));
    if (geometry.overflowX > 1 || geometry.textareaOverflow > 1 || !geometry.respostaVisivel || geometry.corpoAltura < 100 || geometry.verFoto || geometry.slide) throw Error('Encaixe inválido: ' + JSON.stringify(geometry));
    layouts.push({ viewport, ...geometry });
    await page.locator('#chatPainel').screenshot({ path: 'output/playwright/chat-__ENGINE__-' + viewport.width + 'x' + viewport.height + '.png' });
    const antes = await page.locator('#chatCorpo').evaluate(e => e.scrollTop);
    await page.locator('#chatClose').click();
    await page.locator('#chatFab').click();
    await page.waitForFunction(antes => Math.abs(document.getElementById('chatCorpo').scrollTop - antes) < 2, antes);
    await page.locator('#chatInput').fill('Me manda a foto do Difly');
    await page.locator('#chatEnviar').click();
    await page.locator('.chat-card').nth(1).waitFor();
    const variantes = page.locator('.chat-card').nth(1).locator('.chat-option');
    if (await variantes.count() !== fixtures.difly.produtos[0].apresentacoes.length) throw Error('Embalagem escondida');
    await variantes.last().click();
    if (await page.locator('.chat-inline-qtd').count() !== 1) throw Error('Quantidade não está no card');
    const editor = await page.locator('.chat-inline-qtd').boundingBox();
    if (editor.x < 0 || editor.x + editor.width > geometry.viewport[0] + 1) throw Error('Quantidade fora da largura');
    await page.locator('.chat-inline-cancel').click();
  }
  return layouts;
}
