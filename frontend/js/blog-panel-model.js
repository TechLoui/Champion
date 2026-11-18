const ASPECTS = ['16/9', '21/9', '4/3', '3/2', '1/1', 'auto'];
const TEMPLATES = ['standard', 'gallery', 'tutorial'];
const text = value => typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
const fold = value => text(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

export function slugify(value) {
  return fold(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '') || 'artigo';
}

function timestamp(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') {
    const result = value.toMillis();
    return Number.isFinite(result) ? result : 0;
  }
  if (typeof value === 'object' && Number.isFinite(value.seconds ?? value._seconds)) {
    return Number(value.seconds ?? value._seconds) * 1000 + Number(value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6;
  }
  const result = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(result) ? result : 0;
}

export function filterPosts(posts, { query = '', status = 'all', category = '', sort = 'newest', page = 1, pageSize = 10 } = {}) {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  const matches = (Array.isArray(posts) ? posts : []).filter(post => {
    if (!post || typeof post !== 'object') return false;
    if (status !== 'all' && status && post.status !== status) return false;
    if (category && fold(post.category) !== fold(category)) return false;
    const searchable = fold([post.title, post.category, post.author].map(text).join(' '));
    return terms.every(term => searchable.includes(term));
  });
  const byTitle = (a, b) => text(a.title).localeCompare(text(b.title), 'pt-BR', { sensitivity: 'base' });
  matches.sort((a, b) => {
    if (sort === 'title') return byTitle(a, b);
    const first = timestamp(a.updatedAt) || timestamp(a.date);
    const second = timestamp(b.updatedAt) || timestamp(b.date);
    return (sort === 'oldest' ? first - second : second - first) || byTitle(a, b);
  });
  const size = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0 ? Math.max(1, Math.min(100, Math.floor(Number(pageSize)))) : 10;
  const pages = Math.max(1, Math.ceil(matches.length / size));
  const selectedPage = Math.max(1, Math.min(pages, Number.isFinite(Number(page)) ? Math.floor(Number(page)) : 1));
  return { items: matches.slice((selectedPage - 1) * size, selectedPage * size), total: matches.length, page: selectedPage, pages };
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function preparePost(data = {}, posts = []) {
  const source = data && typeof data === 'object' ? data : {};
  const id = text(source.id || source._id) || `post-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`}`;
  const title = text(source.title) || 'Sem título';
  const baseSlug = slugify(source.slug || title);
  const occupied = new Set((Array.isArray(posts) ? posts : []).filter(post => text(post?.id) !== id).map(post => text(post?.slug)));
  let slug = baseSlug;
  let suffix = 2;
  while (occupied.has(slug)) {
    const ending = `-${suffix++}`;
    slug = baseSlug.slice(0, 80 - ending.length).replace(/-+$/g, '') + ending;
  }
  const gallery = (Array.isArray(source.gallery) ? source.gallery : [])
    .filter(item => item && typeof item === 'object')
    .map(item => ({ image: text(item.image), caption: text(item.caption) }))
    .filter(item => item.image || item.caption);
  const steps = (Array.isArray(source.steps) ? source.steps : [])
    .filter(item => item && typeof item === 'object')
    .map(item => ({ title: text(item.title), image: text(item.image), description: text(item.description) }))
    .filter(item => item.title || item.image || item.description);
  return {
    id, slug, title,
    category: text(source.category) || 'Champion',
    author: text(source.author) || 'Equipe Champion',
    date: text(source.date) || today(),
    status: source.status === 'published' ? 'published' : 'draft',
    excerpt: text(source.excerpt), content: text(source.content), image: text(source.image),
    bannerAspect: ASPECTS.includes(source.bannerAspect) ? source.bannerAspect : '16/9',
    secondaryImage: text(source.secondaryImage), secondaryCaption: text(source.secondaryCaption),
    template: TEMPLATES.includes(source.template) ? source.template : 'standard',
    gallery, steps
  };
}

function cleanUrl(value) {
  const candidate = text(value);
  if (!candidate || /[\x00-\x20\x7f\\]/.test(candidate)) return '';
  try {
    if (/[\x00-\x1f\x7f\\]/.test(decodeURIComponent(candidate))) return '';
  } catch { return ''; }
  return candidate;
}

export function safeImageUrl(value, { allowData = false } = {}) {
  const raw = text(value);
  if (allowData && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(raw)) return raw;
  const candidate = cleanUrl(raw);
  if (!candidate) return '';
  if (candidate.startsWith('/')) {
    if (candidate.startsWith('//') || decodeURIComponent(candidate).startsWith('//')) return '';
    return candidate;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return '';
    return candidate;
  } catch { return ''; }
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validatePost(post = {}, { publishing = false, allowData = false } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (publishing) {
    if (text(post.title).length < 5 || text(post.title) === 'Sem título') add('title', 'Escreva um título com pelo menos 5 caracteres.');
    if (text(post.excerpt).length < 10) add('excerpt', 'Escreva um resumo com pelo menos 10 caracteres.');
    if (!post.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) add('slug', 'Revise o endereço do artigo. Use letras, números e hífens.');
    if (!validDate(post.date)) add('date', 'Escolha uma data válida para o artigo.');
    if (post.template === 'gallery') {
      if (!Array.isArray(post.gallery) || !post.gallery.some(item => text(item?.image))) add('gallery', 'Adicione pelo menos uma imagem à galeria.');
    } else if (post.template === 'tutorial') {
      if (!Array.isArray(post.steps) || !post.steps.some(item => text(item?.title) && text(item?.description))) add('steps', 'Adicione uma etapa com título e descrição.');
    } else if (text(post.content).length < 30) add('content', 'Escreva o conteúdo do artigo antes de publicar.');
  } else if (post.date && !validDate(post.date)) {
    add('date', 'Escolha uma data válida para o artigo.');
  }
  if (text(post.title).length > 220) add('title', 'Use até 220 caracteres no título.');
  if (text(post.excerpt).length > 700) add('excerpt', 'Use até 700 caracteres no resumo.');
  if (text(post.content).length > 200000) add('content', 'O conteúdo excede o limite de 200 mil caracteres.');
  const images = [
    ['image', post.image], ['secondaryImage', post.secondaryImage],
    ...(post.template === 'gallery' && Array.isArray(post.gallery) ? post.gallery.map(item => ['gallery', item?.image]) : []),
    ...(post.template === 'tutorial' && Array.isArray(post.steps) ? post.steps.map(item => ['steps', item?.image]) : [])
  ];
  for (const [field, value] of images) {
    if (text(value) && !safeImageUrl(value, { allowData })) add(field, 'Use uma imagem enviada pelo painel ou um endereço HTTPS válido.');
  }
  return errors;
}

function safeLinkUrl(value) {
  const candidate = cleanUrl(value);
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' && parsed.hostname && !parsed.username && !parsed.password ? candidate : '';
  } catch { return ''; }
}

function inline(textValue, allowLinks = true, depth = 0) {
  const value = String(textValue ?? '');
  if (depth > 4) return escapeHtml(value);
  const pattern = /\[([^\]\r\n]+)\]\(([^()\s]+)\)|\*\*([^*\r\n]+)\*\*|\*([^*\r\n]+)\*/gu;
  let html = '';
  let position = 0;
  for (const match of value.matchAll(pattern)) {
    html += escapeHtml(value.slice(position, match.index));
    if (match[1] !== undefined) {
      const url = allowLinks ? safeLinkUrl(match[2]) : '';
      html += url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${inline(match[1], false, depth + 1)}</a>` : escapeHtml(match[0]);
    } else if (match[3] !== undefined) {
      html += `<strong>${inline(match[3], allowLinks, depth + 1)}</strong>`;
    } else {
      html += `<em>${inline(match[4], allowLinks, depth + 1)}</em>`;
    }
    position = match.index + match[0].length;
  }
  return html + escapeHtml(value.slice(position));
}

export function renderContent(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').split(/\n[\t ]*\n+/).map(blockValue => {
    const block = blockValue.trim();
    if (!block) return '';
    const heading = block.match(/^(#{1,3})\s+(.+)$/s);
    if (heading) {
      const tag = heading[1].length === 3 ? 'h3' : 'h2';
      return `<${tag}>${inline(heading[2])}</${tag}>`;
    }
    const lines = block.split('\n');
    if (lines.every(line => /^\s*[-*]\s+/.test(line))) return `<ul>${lines.map(line => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    if (lines.every(line => /^\s*\d+[.)]\s+/.test(line))) return `<ol>${lines.map(line => `<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
    if (/^>\s?/.test(block)) return `<blockquote>${inline(block.replace(/^>\s?/gm, '')).replace(/\n/g, '<br>')}</blockquote>`;
    return `<p>${inline(block).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

export function readingStats(value) {
  const content = String(value ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '');
  const words = (content.match(/[\p{L}\p{N}]+(?:['’'-][\p{L}\p{N}]+)*/gu) || []).length;
  return { words, minutes: words ? Math.max(1, Math.ceil(words / 200)) : 0 };
}

export function recoveryKey(userId, postId) {
  return `champion-blog-editor:v2:${encodeURIComponent(text(userId) || 'local-preview')}:${encodeURIComponent(text(postId) || 'new')}`;
}
