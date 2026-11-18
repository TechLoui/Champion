'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const source = await fs.readFile(path.join(__dirname, '../frontend/js/blog-panel-model.js'), 'utf8');
  const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const { escapeHtml, slugify, filterPosts, preparePost, validatePost, safeImageUrl, renderContent, readingStats, recoveryKey } = model;
  let checks = 0;
  const check = (condition, message) => { assert.ok(condition, message); checks++; };
  const posts = [
    { id: 'a', title: 'Nutrição de precisão', slug: 'nutricao-de-precisao', category: 'Nutrição', author: 'Equipe Champion', status: 'published', date: '2026-05-20' },
    { id: 'b', title: 'Sanidade no rebanho', slug: 'sanidade-no-rebanho', category: 'Sanidade', author: 'Ana Silva', status: 'draft', date: '2026-06-10' },
    { id: 'c', title: 'Água para o rebanho', slug: 'agua-para-o-rebanho', category: 'Manejo', author: 'Equipe Champion', status: 'published', date: '2026-04-18' }
  ];
  const original = JSON.stringify(posts);
  check(filterPosts(posts, { query: 'NUTRICAO precisao' }).items[0]?.id === 'a', 'Search ignores accents and capitalization.');
  check(filterPosts(posts, { query: 'sanidade ana' }).items[0]?.id === 'b', 'Search matches multiple tokens across author and category.');
  check(filterPosts(posts, { status: 'draft' }).total === 1, 'Draft filter selects drafts only.');
  check(filterPosts(posts, { category: 'nutricao' }).items[0]?.id === 'a', 'Category matching ignores accent variants.');
  check(filterPosts(posts, { status: 'draft', category: 'Manejo' }).total === 0, 'Filters combine rather than override one another.');
  check(filterPosts(posts).items[0]?.id === 'b', 'Newest posts come first.');
  check(filterPosts(posts, { sort: 'oldest' }).items[0]?.id === 'c', 'Oldest sort reverses the date order.');
  check(filterPosts(posts, { sort: 'title' }).items[0]?.id === 'c', 'Title sort uses the Portuguese alphabet.');
  const paginated = filterPosts(posts, { page: 999, pageSize: 2 });
  check(paginated.page === 2 && paginated.pages === 2 && paginated.items.length === 1, 'Pagination clamps a stale out-of-range page.');
  check(filterPosts([], { page: 4 }).page === 1 && filterPosts([]).pages === 1, 'Empty lists keep a valid first page.');
  check(filterPosts(posts, { page: -4, pageSize: 0 }).page === 1, 'Invalid paging inputs stay bounded.');
  check(filterPosts(posts, { pageSize: 0.5 }).items.length === 1, 'Fractional page sizes cannot become a zero-sized page.');
  check(JSON.stringify(posts) === original, 'Filtering never mutates the original articles.');
  check(filterPosts([{ ...posts[0], updatedAt: { seconds: 2000000000 } }, posts[1]]).items[0].id === 'a', 'Firestore timestamp objects participate in ordering.');
  check(slugify('  Sanidade, água e nutrição!  ') === 'sanidade-agua-e-nutricao', 'Slugs normalize punctuation and accents.');
  check(slugify('***') === 'artigo', 'Empty slug normalization has a useful deterministic base.');
  check(slugify('a'.repeat(79) + ' b').length <= 80 && !slugify('a'.repeat(79) + ' b').endsWith('-'), 'Long slugs stay within the shared limit.');
  const draft = preparePost({ title: 'Nutrição de precisão' }, posts);
  check(draft.status === 'draft' && draft.id && draft.slug === 'nutricao-de-precisao-2', 'New articles are drafts with unique slugs and IDs.');
  check(preparePost({ id: 'a', title: posts[0].title, slug: posts[0].slug }, posts).slug === posts[0].slug, 'Editing keeps the article own slug.');
  check(preparePost({ title: posts[0].title }, posts.concat({ id: 'd', slug: `${posts[0].slug}-2` })).slug === `${posts[0].slug}-3`, 'Slug collision suffixes advance until unused.');
  check(preparePost({}).title === 'Sem título' && preparePost({}).author === 'Equipe Champion', 'Partial drafts have readable defaults.');
  check(preparePost({ status: 'anything' }).status === 'draft', 'Unknown statuses never publish an article.');
  const structured = preparePost({
    id: 'stable', title: 'Um artigo completo', slug: 'um-artigo-completo', author: 'Ana Silva', category: 'Sanidade', date: '2026-11-18', status: 'published',
    excerpt: 'Um resumo completo sobre a rotina.', content: 'Um conteúdo completo com orientação para a rotina do rebanho.', image: '/assets/img/cover.jpg', bannerAspect: '21/9',
    secondaryImage: 'https://example.com/secondary.webp', secondaryCaption: 'Legenda preservada', template: 'gallery',
    gallery: [{ image: 'https://example.com/photo.jpg?alt=media&token=abc', caption: 'Foto do lote' }],
    steps: [{ title: 'Observar', image: '/assets/img/step.png', description: 'Anote os registros.' }]
  });
  check(structured.bannerAspect === '21/9' && structured.secondaryCaption === 'Legenda preservada', 'Editing preserves cover framing and secondary captions.');
  check(structured.gallery[0].image.endsWith('token=abc') && structured.steps[0].description === 'Anote os registros.', 'Gallery, tutorial and image tokens remain intact.');
  for (const aspect of ['16/9', '21/9', '4/3', '3/2', '1/1', 'auto']) check(preparePost({ bannerAspect: aspect }).bannerAspect === aspect, `Aspect ${aspect} is preserved.`);
  check(preparePost({ template: 'unknown', bannerAspect: 'bad' }).template === 'standard', 'Unknown templates safely use the standard layout.');
  check(validatePost(preparePost({}), { publishing: false }).length === 0, 'An incomplete draft can be saved.');
  check(validatePost(preparePost({}), { publishing: true }).some(error => error.field === 'title'), 'A placeholder title cannot be published.');
  check(validatePost(structured, { publishing: true }).length === 0, 'A complete gallery is publishable.');
  check(validatePost({ ...structured, template: 'standard', content: 'curto' }, { publishing: true }).some(error => error.field === 'content'), 'Standard articles need meaningful content before publication.');
  check(validatePost({ ...structured, gallery: [] }, { publishing: true }).some(error => error.field === 'gallery'), 'An empty gallery cannot be published.');
  check(validatePost({ ...structured, template: 'tutorial', steps: [{ title: 'Etapa' }] }, { publishing: true }).some(error => error.field === 'steps'), 'Tutorials require a described step.');
  check(validatePost({ ...structured, date: '2026-02-30' }, { publishing: true }).some(error => error.field === 'date'), 'Calendar dates are validated, not only their shape.');
  check(validatePost({ ...structured, image: 'javascript:alert(1)' }).some(error => error.field === 'image'), 'Unsafe image URLs are rejected even in drafts.');
  const inactiveMedia = { ...structured, template: 'standard', gallery: [{ image: 'javascript:unsafe', caption: 'Em edição' }], steps: [{ title: 'Etapa', description: 'Descrição da etapa.', image: 'javascript:unsafe' }] };
  check(validatePost(inactiveMedia, { publishing: true }).length === 0, 'Unfinished media in inactive templates does not block the standard article.');
  check(validatePost({ ...inactiveMedia, template: 'gallery' }, { publishing: true }).some(error => error.field === 'gallery'), 'Activating the gallery validates its image URLs before publication.');
  check(validatePost({ ...inactiveMedia, template: 'tutorial' }, { publishing: true }).some(error => error.field === 'steps'), 'Activating the tutorial validates its image URLs before publication.');
  for (const url of ['javascript:alert(1)', '//evil.test/photo.jpg', '/%2fevil.test/photo.jpg', 'https://u:p@example.com/x', 'https://example.com/a%0ab', 'https://example.com/a\\b', 'http://example.com/photo.jpg', 'data:image/svg+xml;base64,AAAA']) check(safeImageUrl(url) === '', `Unsafe image rejected: ${url}`);
  check(safeImageUrl('https://example.com/x.jpg?alt=media&token=abc') !== '', 'HTTPS image tokens remain available.');
  check(safeImageUrl('https://example.com/photo%20do%20lote.jpg') !== '', 'Valid encoded spaces in image filenames are preserved.');
  check(safeImageUrl('/assets/img/cover.jpg') === '/assets/img/cover.jpg', 'Internal media paths are supported.');
  check(safeImageUrl('data:image/png;base64,AAAA') === '', 'Production validation does not accept inline image data.');
  check(safeImageUrl('data:image/png;base64,AAAA', { allowData: true }) !== '', 'An explicit isolated preview can show local image data.');
  const rich = renderContent('## Rotina\n\nTexto **importante** e *claro*.\nOutra linha.\n\n- Lote\n- Data\n\n> Observação\n> Seguinte\n\n[Orientação](https://example.com/?q=1&x=2)');
  check(rich.includes('<h2>Rotina</h2>') && rich.includes('<strong>importante</strong>') && rich.includes('<em>claro</em>'), 'The preview supports headings and emphasis.');
  check(rich.includes('<ul><li>Lote</li><li>Data</li></ul>') && rich.includes('<blockquote>Observação<br>Seguinte'), 'The preview supports semantic lists and quotes.');
  check(rich.includes('href="https://example.com/?q=1&amp;x=2"') && rich.includes('rel="noopener noreferrer"'), 'HTTPS references are safely escaped.');
  const hostile = renderContent('<img src=x onerror=alert(1)>\n\n[x](javascript:alert)\n\n[x](https://u:p@example.com/x)');
  check(!hostile.includes('<img') && !hostile.includes('<a '), 'Raw HTML and unsafe link schemes cannot execute in the preview.');
  check(escapeHtml('"<script>&\'') === '&quot;&lt;script&gt;&amp;&#39;', 'All HTML attribute delimiters are escaped.');
  check(readingStats('').words === 0 && readingStats('').minutes === 0, 'Empty content has no reading time.');
  check(readingStats('A rotina do rebanho.').words === 4 && readingStats('palavra '.repeat(201)).minutes === 2, 'Word count and reading estimates follow visible content.');
  check(recoveryKey('ana@example.com', 'post/1') !== recoveryKey('outra@example.com', 'post/1'), 'Local recovery is separated between administrators.');
  check(recoveryKey('ana@example.com', 'post/1') !== recoveryKey('ana@example.com', 'post/2'), 'Local recovery is separated between articles.');
  console.log(`OK: ${checks} verificações do painel do blog aprovadas.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
