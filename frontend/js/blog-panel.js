import { blogReady } from './blog.js?v=20261118-1';
import { escapeHtml as esc, slugify, filterPosts, preparePost, validatePost, safeImageUrl, renderContent, readingStats, recoveryKey } from './blog-panel-model.js?v=20261118-1';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const form = $('#postForm');
const field = name => form.elements.namedItem(name);
const previewMode = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('preview') === '1';
const state = { posts: [], config: {}, user: null, route: '', post: null, baseline: '', dirty: false, settingsDirty: false, saving: false, uploads: 0, uploadErrors: new Set(), page: 1, recovery: null };
let api, store, recoveryTimer, toastTimer, routeBusy = false;
const imageUploads = new WeakMap();
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const imageUrl = value => safeImageUrl(value, { allowData: previewMode });
const publicPostUrl = post => '/blog?post=' + encodeURIComponent(post.slug);

function toast(message) {
  const el = $('#panelToast');
  el.textContent = message; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}
function feedback(id, message = '', success = false) {
  const el = $(id); el.textContent = message; el.hidden = !message;
  el.classList.toggle('is-success', success); el.classList.toggle('is-error', !success);
}
function friendly(error) {
  if (/permission|unauthorized|unauthenticated/i.test(error?.code || '')) return 'Seu acesso não permite esta ação. Entre novamente ou fale com o administrador.';
  if (/network|unavailable|offline/i.test(`${error?.code} ${error?.message}`)) return 'Sem conexão no momento. Suas alterações continuam aqui; tente novamente.';
  return error?.message || 'Não foi possível concluir. Tente novamente.';
}
function confirmAction(title, message, accept = 'Continuar', danger = false) {
  const dialog = $('#confirmDialog');
  $('#confirmTitle').textContent = title; $('#confirmMessage').textContent = message;
  const button = $('#confirmAccept'); button.textContent = accept; button.classList.toggle('btn-danger', danger);
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (settled) return; settled = true; dialog.close(); cleanup(); resolve(value); };
    const yes = () => finish(true), no = () => finish(false);
    const cleanup = () => { button.removeEventListener('click', yes); $('#confirmCancel').removeEventListener('click', no); dialog.removeEventListener('cancel', no); };
    button.addEventListener('click', yes); $('#confirmCancel').addEventListener('click', no); dialog.addEventListener('cancel', no);
    dialog.showModal(); $('#confirmCancel').focus();
  });
}
function closeMenu() {
  const wasOpen = $('#panelSidebar').classList.contains('is-open');
  $('#panelSidebar').classList.remove('is-open'); $('#panelBackdrop').hidden = true;
  $('#panelMenu').setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open');
  $('.workspace-body').inert = false;
  const mobile = matchMedia('(max-width: 980px)').matches;
  $('#panelSidebar').inert = mobile;
  $('#panelSidebar').setAttribute('aria-hidden', String(mobile));
  $('#panelSidebar').removeAttribute('role'); $('#panelSidebar').removeAttribute('aria-modal');
  if (wasOpen && mobile) $('#panelMenu').focus();
}
async function canLeave() {
  if (state.saving || state.uploads) { toast('Aguarde a operação em andamento.'); return false; }
  if (!state.dirty && !state.settingsDirty) return true;
  const recovered = state.dirty ? flushEditorRecovery() : false;
  return confirmAction('Sair sem salvar?', state.dirty
    ? recovered ? 'As alterações ainda não foram enviadas. Uma recuperação do artigo fica disponível neste navegador.' : 'As alterações ainda não foram enviadas e a recuperação local não está disponível. Ao sair, você perderá essas alterações.'
    : 'As alterações das configurações ainda não foram salvas.', 'Sair sem salvar');
}
async function navigate(hash, force = false) {
  if (!(await canLeave())) return;
  if (location.hash === hash || force) history.replaceState(null, '', hash);
  else history.pushState(null, '', hash);
  await renderRoute(hash);
}
function statusBadge(status) {
  return `<span class="status-badge ${status === 'published' ? 'is-published' : 'is-draft'}">${status === 'published' ? 'Publicado' : 'Rascunho'}</span>`;
}
function dateLabel(date) {
  const parsed = new Date(String(date || '').slice(0, 10) + 'T12:00:00');
  return Number.isNaN(parsed.getTime()) ? 'Sem data' : parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function postRow(post) {
  const cover = imageUrl(post.image);
  return `<article class="post-row"><div class="post-cover">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : '<span aria-hidden="true">Aa</span>'}</div><div class="post-info"><button type="button" class="post-title" data-edit="${esc(post.id)}">${esc(post.title)}</button><div class="post-meta"><span>${esc(post.category)}</span><span>${esc(dateLabel(post.date))}</span><span>${esc(post.author)}</span></div></div>${statusBadge(post.status)}<div class="post-actions"><button class="row-action" type="button" data-edit="${esc(post.id)}" aria-label="Editar ${esc(post.title)}">Editar</button><button class="row-action" type="button" data-duplicate="${esc(post.id)}" aria-label="Duplicar ${esc(post.title)}">Duplicar</button>${post.status === 'published' ? `<a class="row-action" href="${publicPostUrl(post)}" target="_blank" rel="noopener" aria-label="Ver ${esc(post.title)} no blog">Ver</a>` : ''}<button class="row-action danger" type="button" data-delete="${esc(post.id)}" aria-label="Excluir ${esc(post.title)}">Excluir</button></div></article>`;
}
function fillCategories() {
  const categories = [...new Set(state.posts.map(post => post.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'pt-BR'));
  const select = $('#postCategory'), selected = select.value;
  select.innerHTML = '<option value="">Todas as categorias</option>' + categories.map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('');
  select.value = categories.includes(selected) ? selected : '';
  $('#categoryOptions').innerHTML = categories.map(cat => `<option value="${esc(cat)}"></option>`).join('');
}
function renderLists() {
  $('#statTotal').textContent = state.posts.length;
  $('#statPublished').textContent = state.posts.filter(p => p.status === 'published').length;
  $('#statDrafts').textContent = state.posts.filter(p => p.status === 'draft').length;
  $('#statCategories').textContent = new Set(state.posts.map(p => p.category).filter(Boolean)).size;
  const recent = filterPosts(state.posts, { pageSize: 5 }).items;
  $('#recentPosts').innerHTML = recent.length ? recent.map(postRow).join('') : '<div class="list-empty"><h3>Seu primeiro artigo começa aqui.</h3><p>Crie um rascunho e publique quando estiver pronto.</p><button type="button" class="btn btn-primary" data-action="new">Criar artigo</button></div>';
  const result = filterPosts(state.posts, { query: $('#postSearch').value, status: $('#postStatus').value, category: $('#postCategory').value, sort: $('#postSort').value, page: state.page, pageSize: 10 });
  state.page = result.page;
  $('#postList').innerHTML = result.items.length ? result.items.map(postRow).join('') : '<div class="list-empty"><h3>Nenhum artigo encontrado.</h3><p>Altere a busca ou limpe os filtros para ver outros artigos.</p><button type="button" class="btn btn-secondary" data-action="clear-filters">Limpar filtros</button></div>';
  $('#postResultCount').textContent = `${result.total} ${result.total === 1 ? 'artigo' : 'artigos'}`;
  $('#postPageInfo').textContent = result.total ? `Página ${result.page} de ${result.pages}` : 'Nenhum resultado';
  $('#postPrev').disabled = result.page <= 1; $('#postNext').disabled = result.page >= result.pages;
}
async function loadData() {
  const [posts, config] = await Promise.all([api.getPosts(), api.getConfig()]);
  state.posts = posts; state.config = config; fillCategories(); renderLists();
}
function collectRows(kind) {
  return $$(`[data-row="${kind}"]`).map(row => Object.fromEntries($$('[data-field]', row).map(input => [input.dataset.field, input.value])));
}
function collect() {
  return { ...Object.fromEntries(new FormData(form)), status: state.post?.status || 'draft', gallery: collectRows('gallery'), steps: collectRows('step') };
}
function currentRecoveryKey() { return recoveryKey(state.user.uid || state.user.email, field('id').value || 'new'); }
function saveEditorRecovery(data) {
  if (!state.user) return false;
  try { localStorage.setItem(currentRecoveryKey(), JSON.stringify({ data, savedAt: new Date().toISOString() })); return true; }
  catch { return false; }
}
function flushEditorRecovery() {
  clearTimeout(recoveryTimer);
  return !state.dirty || saveEditorRecovery(collect());
}
function updateEditor() {
  const data = collect();
  state.dirty = JSON.stringify(data) !== state.baseline;
  const stats = readingStats([data.content, ...data.steps.map(step => step.description)].join(' '));
  $('#wordCount').textContent = stats.words; $('#readingTime').textContent = `${stats.minutes} min`;
  $('#editorSaveState').textContent = state.dirty ? 'Alterações não salvas' : (state.post?.id ? 'Alterações salvas' : 'Novo rascunho');
  $$('[data-template-fields]').forEach(el => { el.hidden = el.dataset.templateFields !== data.template; });
  for (const [name, id] of [['image', '#coverPreview'], ['secondaryImage', '#secondaryPreview']]) {
    const image = $(id), url = imageUrl(data[name]);
    image.hidden = !url; if (url && image.getAttribute('src') !== url) image.src = url;
    if (name === 'image') image.style.aspectRatio = data.bannerAspect === 'auto' ? 'auto' : data.bannerAspect;
  }
  clearTimeout(recoveryTimer);
  if (state.dirty) recoveryTimer = setTimeout(() => {
    $('#editorSaveState').textContent = saveEditorRecovery(data) ? 'Recuperação guardada neste navegador' : 'Alterações não salvas · recuperação local indisponível';
  }, 700);
}
function addRow(kind, data = {}) {
  const row = document.createElement('div'); row.className = 'repeat-row'; row.dataset.row = kind;
  row.innerHTML = kind === 'gallery'
    ? `<div class="field"><label>Endereço da imagem<input data-field="image" type="text" value="${esc(data.image || '')}" placeholder="https://…"></label></div><div class="field"><label>Legenda<input data-field="caption" value="${esc(data.caption || '')}"></label></div>`
    : `<div class="field"><label>Título da etapa<input data-field="title" value="${esc(data.title || '')}"></label></div><div class="field"><label>Descrição<textarea data-field="description" rows="3">${esc(data.description || '')}</textarea></label></div><div class="field"><label>Imagem da etapa (opcional)<input data-field="image" type="text" value="${esc(data.image || '')}" placeholder="https://…"></label></div>`;
  row.innerHTML += '<div class="row-actions"><label class="btn btn-secondary">Enviar imagem<input class="repeat-upload" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Enviar imagem para este item"></label><button type="button" class="row-action" data-move="up" aria-label="Mover item para cima">↑</button><button type="button" class="row-action" data-move="down" aria-label="Mover item para baixo">↓</button><button type="button" class="row-action danger" data-remove-row>Remover</button></div>';
  $(kind === 'gallery' ? '#galleryRows' : '#stepsRows').append(row);
}
function fillEditor(data = {}, recover = true) {
  [field('image'), field('secondaryImage'), ...$$('[data-row] [data-field="image"]')].forEach(invalidateImageUpload);
  clearTimeout(recoveryTimer); form.reset(); state.uploadErrors.clear();
  state.post = data.id ? { ...data } : null;
  const values = { id: '', title: '', slug: '', excerpt: '', content: '', category: '', author: 'Equipe Champion', date: today(), template: 'standard', bannerAspect: '16/9', image: '', secondaryImage: '', secondaryCaption: '', ...data };
  for (const [name, value] of Object.entries(values)) { const input = field(name); if (input && typeof value !== 'object') input.value = value ?? ''; }
  form.dataset.slugEdited = data.id || data.slug ? 'true' : 'false';
  $('#galleryRows').replaceChildren(); $('#stepsRows').replaceChildren();
  (data.gallery || []).forEach(row => addRow('gallery', row)); (data.steps || []).forEach(row => addRow('step', row));
  $('#editorTitle').textContent = data.id ? 'Editar artigo' : 'Novo artigo';
  $('#editorStatus').innerHTML = statusBadge(data.status || 'draft');
  $('#publishPost').textContent = data.status === 'published' ? 'Salvar alterações' : 'Publicar artigo';
  $('#saveDraft').textContent = data.status === 'published' ? 'Voltar a rascunho' : 'Salvar rascunho';
  feedback('#editorFeedback'); $('#localRecovery').hidden = true; state.recovery = null;
  state.baseline = JSON.stringify(collect()); updateEditor();
  if (recover) {
    try { const saved = JSON.parse(localStorage.getItem(currentRecoveryKey())); if (saved?.data && JSON.stringify(saved.data) !== state.baseline) { state.recovery = saved; $('#localRecovery').hidden = false; } }
    catch { /* A malformed local recovery never changes the saved article. */ }
  }
}
function fillSettings() {
  const settings = $('#settingsForm');
  for (const key of ['title', 'subtitle', 'heroImage']) settings.elements.namedItem(key).value = state.config[key] || '';
  $('#featuredPost').innerHTML = '<option value="">Escolher automaticamente</option>' + state.posts.filter(p => p.status === 'published').map(p => `<option value="${esc(p.slug)}">${esc(p.title)}</option>`).join('');
  $('#featuredPost').value = state.config.featuredSlug || '';
  state.settingsDirty = false; settings.dataset.baseline = JSON.stringify(Object.fromEntries(new FormData(settings))); feedback('#settingsFeedback');
}
async function renderRoute(hash = location.hash) {
  state.dirty = false; state.settingsDirty = false; clearTimeout(recoveryTimer); closeMenu();
  const route = hash.replace(/^#/, '') || 'overview';
  const page = route === 'new' || route.startsWith('edit/') ? 'editor' : ['overview', 'articles', 'settings'].includes(route) ? route : 'overview';
  state.route = '#' + route;
  $$('[data-page]').forEach(el => { el.hidden = el.dataset.page !== page; });
  $$('[data-route]').forEach(el => { const active = el.dataset.route === (page === 'editor' ? 'articles' : page); el.classList.toggle('is-active', active); if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  $('#panelPageTitle').textContent = ({ overview: 'Visão geral', articles: 'Artigos', editor: 'Editor de artigo', settings: 'Configurações' })[page];
  if (page === 'editor') {
    const id = route.startsWith('edit/') ? decodeURIComponent(route.slice(5)) : '';
    const post = id ? state.posts.find(post => post.id === id) : null;
    if (id && !post) { toast('Este artigo não está disponível.'); history.replaceState(null, '', '#articles'); return renderRoute('#articles'); }
    fillEditor(post || {});
  }
  if (page === 'settings') fillSettings();
  if (page === 'articles' || page === 'overview') renderLists();
  const heading = $(`[data-page="${page}"] h1, [data-page="${page}"] h2`);
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  $('.bp-content, .workspace-content, main')?.scrollTo({ top: 0 });
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}
async function persist(status) {
  if (state.saving || state.uploads) return toast('Aguarde o envio da imagem.');
  if (state.uploadErrors.size) return feedback('#editorFeedback', 'Uma imagem não foi enviada. Tente novamente ou remova a imagem antes de salvar.');
  if (status === 'draft' && state.post?.status === 'published' && !(await confirmAction('Voltar a rascunho?', 'O artigo deixará de aparecer nos blogs até ser publicado novamente.', 'Voltar a rascunho'))) return;
  const data = collect();
  if (!data.title.trim() && !data.content.trim() && !data.gallery.length && !data.steps.length) return feedback('#editorFeedback', 'Preencha o título ou comece o conteúdo antes de salvar.');
  const post = preparePost({ ...data, status }, state.posts);
  const errors = validatePost(post, { publishing: status === 'published', allowData: previewMode });
  if (errors.length) {
    feedback('#editorFeedback', errors[0].message); const input = field(errors[0].field);
    if (input) { for (const details of $$('details', form)) if (details.contains(input)) details.open = true; input.focus(); input.setAttribute('aria-invalid', 'true'); }
    return;
  }
  state.saving = true; form.inert = true; $('#publishPost').disabled = true; $('#saveDraft').disabled = true;
  const recovery = currentRecoveryKey(); clearTimeout(recoveryTimer); feedback('#editorFeedback'); $('#editorSaveState').textContent = 'Salvando…';
  try {
    const saved = await api.savePost(post);
    state.posts = [saved, ...state.posts.filter(item => item.id !== saved.id)];
    try { localStorage.removeItem(recovery); localStorage.removeItem(recoveryKey(state.user.uid || state.user.email, saved.id)); } catch { /* Saving remotely does not depend on browser storage. */ }
    fillCategories(); fillEditor(saved, false); renderLists();
    history.replaceState(null, '', '#edit/' + encodeURIComponent(saved.id)); state.route = location.hash;
    feedback('#editorFeedback', previewMode ? 'Prévia local salva. Nenhum blog foi alterado.' : status === 'published' ? 'Artigo salvo e publicado nos blogs.' : 'Rascunho salvo. Ele ainda não aparece nos blogs.', true);
    toast(previewMode ? 'Salvo somente nesta prévia local.' : 'Artigo salvo com sucesso.');
  } catch (error) { feedback('#editorFeedback', friendly(error)); $('#editorSaveState').textContent = 'Não foi possível salvar · alterações preservadas'; }
  finally { state.saving = false; form.inert = false; syncEditorButtons(); }
}
function syncEditorButtons() {
  const busy = state.saving || state.uploads > 0;
  $('#publishPost').disabled = busy; $('#saveDraft').disabled = busy;
}
function invalidateImageUpload(input) {
  const task = imageUploads.get(input);
  if (!task) return;
  imageUploads.delete(input);
  if (task.counted) { task.counted = false; state.uploads = Math.max(0, state.uploads - 1); syncEditorButtons(); }
}
async function upload(file, input) {
  if (!file) return;
  invalidateImageUpload(input);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) { feedback('#editorFeedback', 'Escolha uma imagem JPG, PNG ou WebP de até 5 MB.'); return; }
  const task = { counted: true }; imageUploads.set(input, task);
  const current = () => input.isConnected && imageUploads.get(input) === task;
  state.uploads++; syncEditorButtons(); feedback('#editorFeedback', 'Enviando imagem…', true);
  try {
    const url = previewMode ? await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }) : await store.uploadImage(file, 'blog');
    if (!current()) return;
    if (!imageUrl(url)) throw new Error('O endereço da imagem enviada é inválido.');
    input.value = url; state.uploadErrors.delete(input); updateEditor(); feedback('#editorFeedback', 'Imagem pronta para salvar.', true);
  } catch { if (current()) { state.uploadErrors.add(input); feedback('#editorFeedback', 'Não foi possível enviar a imagem. A imagem anterior foi preservada. Tente novamente.'); } }
  finally {
    if (task.counted) { task.counted = false; state.uploads = Math.max(0, state.uploads - 1); }
    if (imageUploads.get(input) === task) imageUploads.delete(input);
    syncEditorButtons();
  }
}
function preview() {
  const post = collect(), stats = readingStats(post.content);
  const cover = imageUrl(post.image), secondary = imageUrl(post.secondaryImage);
  let html = `<article class="article-preview"><p class="preview-category">${esc(post.category || 'Categoria')}</p><h1>${esc(post.title || 'Título do artigo')}</h1><p class="preview-excerpt">${esc(post.excerpt)}</p><p class="preview-meta">${esc(post.author)} · ${esc(dateLabel(post.date))} · ${stats.minutes} min de leitura</p>${cover ? `<img class="preview-cover" src="${esc(cover)}" alt="" style="aspect-ratio:${esc(post.bannerAspect === 'auto' ? 'auto' : post.bannerAspect)}">` : ''}${secondary ? `<figure><img src="${esc(secondary)}" alt="${esc(post.secondaryCaption)}"><figcaption>${esc(post.secondaryCaption)}</figcaption></figure>` : ''}<div class="preview-content">${renderContent(post.content)}</div>`;
  if (post.template === 'gallery') html += `<div class="preview-gallery">${post.gallery.filter(item => imageUrl(item.image)).map(item => `<figure><img src="${esc(imageUrl(item.image))}" alt="${esc(item.caption)}"><figcaption>${esc(item.caption)}</figcaption></figure>`).join('')}</div>`;
  if (post.template === 'tutorial') html += `<ol class="preview-steps">${post.steps.map(step => `<li><h2>${esc(step.title)}</h2>${imageUrl(step.image) ? `<img src="${esc(imageUrl(step.image))}" alt="">` : ''}<p>${esc(step.description).replace(/\n/g, '<br>')}</p></li>`).join('')}</ol>`;
  $('#previewBody').innerHTML = html + '</article>'; $('#postPreview').showModal();
}
function formatText(format) {
  const input = field('content'), start = input.selectionStart, end = input.selectionEnd, selection = input.value.slice(start, end);
  let value = ({ bold: `**${selection || 'texto em destaque'}**`, italic: `*${selection || 'texto em itálico'}*`, heading: `\n## ${selection || 'Título da seção'}\n`, list: `\n${(selection || 'Item da lista').split('\n').map(line => '- ' + line).join('\n')}\n`, link: `[${selection || 'texto do link'}](https://)` })[format];
  if (value) { input.setRangeText(value, start, end, 'select'); input.focus(); updateEditor(); }
}
function clearFilters() { $('#postSearch').value = ''; $('#postStatus').value = 'all'; $('#postCategory').value = ''; $('#postSort').value = 'newest'; state.page = 1; renderLists(); }

document.addEventListener('click', async event => {
  const button = event.target.closest('button,a'); if (!button || !state.user) return;
  if (button.classList.contains('skip-link')) { event.preventDefault(); $('#workspaceMain').focus(); return; }
  if (button.dataset.route) { event.preventDefault(); return navigate(button.getAttribute('href')); }
  if (button.dataset.action === 'new') return navigate('#new', location.hash === '#new');
  if (button.dataset.action === 'back') return navigate('#articles');
  if (button.dataset.action === 'clear-filters') return clearFilters();
  if (button.dataset.edit) return navigate('#edit/' + encodeURIComponent(button.dataset.edit));
  if (button.dataset.duplicate) {
    if (!(await canLeave())) return;
    const post = state.posts.find(post => post.id === button.dataset.duplicate); if (!post) return;
    history.replaceState(null, '', '#new'); await renderRoute('#new');
    fillEditor({ ...post, id: '', title: post.title + ' — cópia', slug: post.slug + '-copia', status: 'draft', date: today() }, false); state.baseline = ''; updateEditor(); field('title').focus(); return;
  }
  if (button.dataset.delete) {
    const post = state.posts.find(post => post.id === button.dataset.delete); if (!post) return;
    if (!(await confirmAction('Excluir artigo?', `“${post.title}” será removido dos blogs. Esta ação não pode ser desfeita.`, 'Excluir artigo', true))) return;
    button.disabled = true;
    try { await api.deletePost(post.id); state.posts = state.posts.filter(item => item.id !== post.id); fillCategories(); renderLists(); toast('Artigo excluído.'); }
    catch (error) { toast(friendly(error)); button.disabled = false; } return;
  }
  if (button.dataset.format) return formatText(button.dataset.format);
  if (button.dataset.removeImage) { const input = field(button.dataset.removeImage); invalidateImageUpload(input); input.value = ''; state.uploadErrors.delete(input); updateEditor(); }
  if (button.hasAttribute('data-remove-row')) { const row = button.closest('[data-row]'); $$('input', row).forEach(input => { invalidateImageUpload(input); state.uploadErrors.delete(input); }); row.remove(); updateEditor(); }
  if (button.dataset.move) { const row = button.closest('[data-row]'); if (button.dataset.move === 'up' && row.previousElementSibling) row.previousElementSibling.before(row); else if (button.dataset.move === 'down' && row.nextElementSibling) row.nextElementSibling.after(row); updateEditor(); }
});
$('#panelMenu').addEventListener('click', () => {
  if ($('#panelSidebar').classList.contains('is-open')) return closeMenu();
  const sidebar = $('#panelSidebar'); sidebar.inert = false; sidebar.setAttribute('aria-hidden', 'false'); sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); sidebar.classList.add('is-open');
  $('#panelBackdrop').hidden = false; $('#panelMenu').setAttribute('aria-expanded', 'true'); document.body.classList.add('menu-open'); $('.workspace-body').inert = true;
  $('#panelCloseMenu').focus();
});
$('#panelBackdrop').addEventListener('click', closeMenu);
$('#panelCloseMenu').addEventListener('click', closeMenu);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && (state.route.startsWith('#edit/') || state.route === '#new')) { event.preventDefault(); if ($('dialog[open]')) return; persist(state.post?.status || 'draft'); } });
window.addEventListener('resize', () => { if (!$('#panelSidebar').classList.contains('is-open') || innerWidth > 980) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key !== 'Tab' || !$('#panelSidebar').classList.contains('is-open')) return;
  const controls = $$('a[href],button:not(:disabled)', $('#panelSidebar')), first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
window.addEventListener('beforeunload', event => { if (state.dirty) flushEditorRecovery(); if (state.dirty || state.settingsDirty || state.saving || state.uploads) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('hashchange', async () => {
  if (routeBusy || !state.user || location.hash === state.route) return;
  routeBusy = true;
  try { if (await canLeave()) await renderRoute(location.hash); else history.replaceState(null, '', state.route); }
  finally { routeBusy = false; }
});
for (const id of ['#postSearch', '#postStatus', '#postCategory', '#postSort']) $(id).addEventListener(id === '#postSearch' ? 'input' : 'change', () => { state.page = 1; renderLists(); });
$('#postClearFilters').addEventListener('click', clearFilters);
$('#postPrev').addEventListener('click', () => { state.page--; renderLists(); }); $('#postNext').addEventListener('click', () => { state.page++; renderLists(); });
form.addEventListener('submit', event => { event.preventDefault(); persist(state.post?.status || 'draft'); });
form.addEventListener('input', event => { event.target.removeAttribute('aria-invalid'); state.uploadErrors.delete(event.target); if (event.target === field('image') || event.target === field('secondaryImage') || event.target.matches('[data-row] [data-field="image"]')) invalidateImageUpload(event.target); if (event.target === field('slug')) form.dataset.slugEdited = 'true'; if (event.target === field('title') && form.dataset.slugEdited !== 'true') field('slug').value = slugify(event.target.value); updateEditor(); });
form.addEventListener('change', async event => {
  const file = event.target;
  if (file.type === 'file') { const input = file.id === 'coverFile' ? field('image') : file.id === 'secondaryFile' ? field('secondaryImage') : $('[data-field="image"]', file.closest('[data-row]')); if (input) await upload(file.files[0], input); file.value = ''; }
  else updateEditor();
});
$('#addGallery').addEventListener('click', () => { addRow('gallery'); updateEditor(); }); $('#addStep').addEventListener('click', () => { addRow('step'); updateEditor(); });
$('#saveDraft').addEventListener('click', () => persist('draft')); $('#publishPost').addEventListener('click', () => persist('published'));
$('#previewPost').addEventListener('click', preview); $('#closePreview').addEventListener('click', () => $('#postPreview').close());
$('#recoverDraft').addEventListener('click', () => {
  if (state.saving || state.uploads) return toast('Aguarde a operação em andamento.');
  const saved = state.recovery; if (!saved) return;
  const baseline = state.baseline, livePost = state.post, liveId = field('id').value || '';
  fillEditor({ ...saved.data, id: liveId, status: livePost?.status || 'draft' }, false);
  state.post = livePost; state.baseline = baseline; updateEditor(); toast('Alterações recuperadas. Revise antes de salvar.');
});
$('#discardRecovery').addEventListener('click', () => { localStorage.removeItem(currentRecoveryKey()); state.recovery = null; $('#localRecovery').hidden = true; });
$('#settingsForm').addEventListener('input', () => { state.settingsDirty = JSON.stringify(Object.fromEntries(new FormData($('#settingsForm')))) !== $('#settingsForm').dataset.baseline; });
$('#settingsForm').addEventListener('submit', async event => {
  event.preventDefault(); const settings = event.target; if (!settings.reportValidity() || state.saving) return;
  const data = Object.fromEntries(new FormData(settings));
  if (data.heroImage && !safeImageUrl(data.heroImage)) return feedback('#settingsFeedback', 'Informe um endereço HTTPS válido para a capa.');
  if (data.featuredSlug && !state.posts.some(post => post.slug === data.featuredSlug && post.status === 'published')) return feedback('#settingsFeedback', 'Selecione um artigo publicado para o destaque.');
  const submit = $('button[type="submit"]', settings); state.saving = true; settings.inert = true; submit.disabled = true; feedback('#settingsFeedback');
  try { await api.saveConfig(data); state.config = { ...state.config, ...data }; settings.dataset.baseline = JSON.stringify(data); state.settingsDirty = false; feedback('#settingsFeedback', 'Configurações salvas.', true); }
  catch (error) { feedback('#settingsFeedback', friendly(error)); }
  finally { state.saving = false; settings.inert = false; submit.disabled = false; }
});
$('#panelLogout').addEventListener('click', async () => { if (!(await canLeave())) return; state.dirty = false; state.settingsDirty = false; if (previewMode) { location.href = '/login-blog'; return; } try { await store.logout(); localStorage.removeItem('champion-blog-admin-session'); localStorage.removeItem('champion-admin-session'); location.replace('/login-blog'); } catch (error) { toast(friendly(error)); } });
$('#gateRetry').addEventListener('click', () => location.reload());
$('#gateSignOut').addEventListener('click', async () => {
  state.dirty = false; state.settingsDirty = false;
  try { await store?.logout(); } catch { /* The login screen can still be opened offline. */ }
  localStorage.removeItem('champion-blog-admin-session'); localStorage.removeItem('champion-admin-session'); location.replace('/login-blog');
});

function gateError(message, signIn = false) {
  if (state.user && state.dirty) {
    try { localStorage.setItem(currentRecoveryKey(), JSON.stringify({ data: collect(), savedAt: new Date().toISOString() })); } catch { /* Keep the form in memory if recovery is unavailable. */ }
  }
  $('#blogWorkspace').hidden = true; $('#panelGate').hidden = false; $('#gateMessage').textContent = message; $('#gateRetry').hidden = false; $('#gateSignOut').hidden = !signIn; $('.gate-spinner').hidden = true;
}

async function start(user) {
  if (state.user) return;
  state.user = user; $('#panelUserName').textContent = user.displayName || (previewMode ? 'Prévia local' : 'Administrador'); $('#panelUserEmail').textContent = user.email || ''; $('#panelAvatar').textContent = (user.displayName || user.email || 'A')[0].toUpperCase();
  try {
    await loadData(); $('#panelGate').hidden = true; $('#blogWorkspace').hidden = false;
    await renderRoute(location.hash || '#overview'); if (previewMode) toast('Prévia local. As alterações ficam somente neste navegador.');
  } catch (error) { gateError(friendly(error), true); state.user = null; }
}
try {
  api = await blogReady; store = window.ChampionBlogStore;
  if (previewMode) await start({ uid: 'local-preview', email: 'editor@exemplo.local' });
  else if (!store?.isFirebase) gateError('Não foi possível conectar ao painel. Confira sua conexão e tente novamente.', true);
  else store.onAuthChanged((allowed, user) => {
    if (allowed) start(user);
    else if (!user) { localStorage.removeItem('champion-blog-admin-session'); localStorage.removeItem('champion-admin-session'); location.replace('/login-blog'); }
    else gateError('Esta conta não tem acesso ao painel. Entre com uma conta autorizada.', true);
  });
} catch (error) { gateError(friendly(error), true); }
