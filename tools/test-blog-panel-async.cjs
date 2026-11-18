const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/js/blog-panel.js'), 'utf8');
const between = (start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert(first >= 0 && last > first, `Missing controller block: ${start}`);
  return source.slice(first, last);
};
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };

function uploadContext() {
  const requests = [], buttons = { '#publishPost': {}, '#saveDraft': {} }, messages = [];
  const context = vm.createContext({
    state: { saving: false, uploads: 0, uploadErrors: new Set() }, imageUploads: new WeakMap(), previewMode: false,
    $: selector => buttons[selector], feedback: (...args) => messages.push(args),
    imageUrl: url => url.startsWith('https://') ? url : '', updateEditor: () => {},
    store: { uploadImage: () => { const request = deferred(); requests.push(request); return request.promise; } }
  });
  vm.runInContext(between('function syncEditorButtons()', '\nfunction preview()'), context);
  return { context, requests, buttons, messages };
}

(async () => {
  const file = { type: 'image/png', size: 123 };
  {
    const { context, requests, buttons } = uploadContext();
    const input = { isConnected: true, value: 'old' };
    const first = context.upload(file, input), second = context.upload(file, input);
    check(context.state.uploads === 1, 'A superseded request releases its busy count.');
    requests[1].resolve('https://example.com/new.png'); await second;
    check(input.value.endsWith('/new.png') && !buttons['#publishPost'].disabled, 'The latest selection is used and save resumes.');
    requests[0].resolve('https://example.com/stale.png'); await first;
    check(input.value.endsWith('/new.png') && context.state.uploads === 0, 'A stale upload cannot overwrite the newer image or underflow the busy count.');
  }
  {
    const { context, requests } = uploadContext();
    const input = { isConnected: true, value: 'old' }, operation = context.upload(file, input);
    input.isConnected = false;
    requests[0].reject(new Error('offline')); await operation;
    check(context.state.uploadErrors.size === 0 && context.state.uploads === 0, 'A removed row cannot leave an invisible blocking upload error.');
  }
  {
    const { context, requests, buttons } = uploadContext();
    const input = { isConnected: true, value: 'old' }, operation = context.upload(file, input);
    input.value = 'https://example.com/manual.png'; context.invalidateImageUpload(input);
    requests[0].resolve('https://example.com/stale.png'); await operation;
    check(input.value.endsWith('/manual.png') && !buttons['#saveDraft'].disabled, 'A manual URL edit invalidates the pending file selection.');
  }
  {
    const { context, requests, buttons } = uploadContext();
    const a = { isConnected: true, value: 'a' }, b = { isConnected: true, value: 'b' };
    const first = context.upload(file, a), second = context.upload(file, b);
    check(context.state.uploads === 2, 'Independent fields can upload concurrently.');
    requests[0].resolve('https://example.com/a.png'); await first;
    check(context.state.uploads === 1 && buttons['#publishPost'].disabled, 'Saving remains blocked while another active image is uploading.');
    requests[1].resolve('https://example.com/b.png'); await second;
    check(context.state.uploads === 0 && !buttons['#publishPost'].disabled, 'Both successful requests release the editor.');
  }
  {
    const { context, requests, buttons } = uploadContext();
    const input = { isConnected: true, value: 'old' }, operation = context.upload(file, input);
    context.invalidateImageUpload(input); context.state.saving = true;
    requests[0].resolve('https://example.com/stale.png'); await operation;
    check(buttons['#publishPost'].disabled && buttons['#saveDraft'].disabled, 'An obsolete upload cannot re-enable buttons during a save.');
  }
  {
    const { context, requests } = uploadContext();
    const input = { isConnected: true, value: 'https://example.com/original.png' }, operation = context.upload(file, input);
    requests[0].reject(new Error('offline')); await operation;
    check(input.value.endsWith('/original.png') && context.state.uploadErrors.has(input), 'A real upload failure preserves the saved URL and requests a retry.');
  }
  {
    const { context, requests } = uploadContext();
    await context.upload({ type: 'image/png', size: 0 }, { isConnected: true, value: 'old' });
    check(requests.length === 0 && context.state.uploads === 0, 'Empty files are rejected before starting an upload.');
  }
  {
    const memory = new Map(), messages = [], data = { title: 'Última alteração' };
    const context = vm.createContext({
      state: { user: { uid: 'user' }, dirty: true, settingsDirty: false, saving: false, uploads: 0 }, recoveryTimer: 123,
      recoveryKey: (user, id) => `${user}:${id}`, field: () => ({ value: 'post' }), collect: () => data,
      localStorage: { setItem: (key, value) => memory.set(key, value) }, clearTimeout: () => {},
      confirmAction: async (...args) => { messages.push(args); return true; }, toast: () => {}
    });
    vm.runInContext(between('function currentRecoveryKey()', '\nfunction updateEditor()'), context);
    vm.runInContext(between('async function canLeave()', '\nasync function navigate('), context);
    await context.canLeave();
    check(JSON.parse(memory.get('user:post')).data.title === data.title, 'Leaving immediately flushes the latest edit without waiting for the debounce.');
    check(messages[0][1].includes('fica disponível'), 'A successful flush explains that recovery is available.');
    context.localStorage.setItem = () => { throw new Error('blocked'); };
    await context.canLeave();
    check(messages[1][1].includes('não está disponível') && !messages[1][1].includes('fica disponível'), 'A storage failure never promises recovery.');
  }
  {
    let callback, supplied;
    const live = { id: 'live', status: 'draft', title: 'Servidor' };
    const context = vm.createContext({
      state: { saving: false, uploads: 0, recovery: { data: { id: 'stale', status: 'published', title: 'Recuperação' } }, baseline: 'server', post: live },
      $: () => ({ addEventListener: (_, listener) => { callback = listener; } }), field: () => ({ value: 'live' }),
      fillEditor: data => { supplied = data; context.state.post = { ...data }; }, updateEditor: () => {}, toast: () => {}
    });
    vm.runInContext(between("$('#recoverDraft').addEventListener", "\n$('#discardRecovery')"), context);
    callback();
    check(supplied.id === 'live' && supplied.status === 'draft', 'Recovery cannot replace the live article identity or republish an old status.');
    check(context.state.post === live && context.state.baseline === 'server', 'Recovery preserves the server snapshot used for save semantics.');
  }
  {
    let callback; const request = deferred(), submit = {}, settings = { inert: false, reportValidity: () => true };
    const context = vm.createContext({
      state: { saving: false, settingsDirty: true, posts: [], config: {} },
      $: selector => selector === '#settingsForm' ? { addEventListener: (_, listener) => { callback = listener; } } : submit,
      FormData: class { *[Symbol.iterator]() { yield ['title', 'Blog']; yield ['heroImage', '']; yield ['featuredSlug', '']; } },
      api: { saveConfig: () => request.promise }, feedback: () => {}, friendly: error => error.message
    });
    settings.dataset = {};
    vm.runInContext(between("$('#settingsForm').addEventListener('submit'", "\n$('#panelLogout')"), context);
    const pending = callback({ preventDefault() {}, target: settings });
    check(settings.inert && submit.disabled, 'Settings fields are inert while their submitted snapshot is saving.');
    request.resolve(); await pending;
    check(!settings.inert && !submit.disabled && !context.state.settingsDirty, 'Settings controls are restored only after the save finishes.');
  }
  {
    let callback, saves = 0, modal = true;
    const context = vm.createContext({
      document: { addEventListener: (_, listener) => { callback = listener; } }, state: { route: '#new', post: null },
      closeMenu: () => {}, $: () => modal ? {} : null, persist: () => { saves++; }
    });
    const start = "document.addEventListener('keydown', event => { if (event.key === 'Escape')";
    vm.runInContext(between(start, '\nwindow.addEventListener'), context);
    callback({ key: 's', ctrlKey: true, preventDefault() {} });
    check(saves === 0, 'Ctrl+S cannot save behind a confirmation or preview dialog.');
    modal = false; callback({ key: 's', ctrlKey: true, preventDefault() {} });
    check(saves === 1, 'Ctrl+S still saves normally outside dialogs.');
  }
  {
    let callback, invalidated = null;
    const image = { removeAttribute() {}, matches: () => false };
    const content = { removeAttribute() {}, matches: () => false };
    const context = vm.createContext({
      form: { dataset: {}, addEventListener: (_, listener) => { callback = listener; } },
      state: { uploadErrors: new Set() }, field: name => name === 'image' ? image : name === 'content' ? content : {},
      invalidateImageUpload: input => { invalidated = input; }, updateEditor: () => {}, slugify: value => value
    });
    vm.runInContext(between("form.addEventListener('input'", "\nform.addEventListener('change'"), context);
    callback({ target: image });
    check(invalidated === image, 'The real manual-image input listener invalidates its pending upload.');
    invalidated = null; callback({ target: content });
    check(invalidated === null, 'Typing article text does not cancel unrelated image uploads.');
  }
  {
    let callback, removed = false; const invalidated = [];
    const inputs = [{}, {}], row = { remove: () => { removed = true; } };
    const button = { dataset: {}, classList: { contains: () => false }, hasAttribute: name => name === 'data-remove-row', closest: () => row };
    const context = vm.createContext({
      document: { addEventListener: (_, listener) => { callback = listener; } },
      state: { user: {}, uploadErrors: new Set(inputs) }, $$: () => inputs,
      invalidateImageUpload: input => invalidated.push(input), updateEditor: () => {}
    });
    vm.runInContext(between("document.addEventListener('click'", "\n$('#panelMenu')"), context);
    await callback({ target: { closest: () => button } });
    check(removed && invalidated.length === inputs.length && context.state.uploadErrors.size === 0, 'The actual row-removal handler cancels uploads and clears their error guards.');
  }
  console.log(`OK: ${checks} verificações assíncronas do painel aprovadas.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
