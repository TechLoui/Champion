'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const active = force === undefined ? !this.contains(name) : Boolean(force);
    if (active) this.add(name); else this.remove(name);
    return active;
  }
}

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  dispatch(type, event = {}) {
    if (!event.target) event.target = this;
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
}

class FakeElement extends FakeTarget {
  constructor(name = 'div') {
    super();
    this.name = name;
    this.classList = new FakeClassList();
    this.style = {};
    this.dataset = {};
    this.hidden = false;
    this.nodes = {};
    this.parentElement = null;
    this.focusCalls = 0;
  }
  set className(value) {
    this._className = value;
    this.classList = new FakeClassList();
    String(value).split(/\s+/).filter(Boolean).forEach((name) => this.classList.add(name));
  }
  get className() { return this._className || ''; }
  setAttribute(name, value) { this[name] = value; }
  focus() { this.focusCalls += 1; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 600 }; }
  setPointerCapture(pointerId) { capturedPointer = { element: this, pointerId }; }
  releasePointerCapture(pointerId) {
    if (capturedPointer && capturedPointer.element === this && capturedPointer.pointerId === pointerId) {
      capturedPointer = null;
    }
  }
  querySelector(selector) { return this.nodes[selector] || null; }
  set innerHTML(value) {
    this._innerHTML = value;
    if (!String(value).includes('mapa-palco')) return;

    const palco = new FakeElement('palco');
    const img = new FakeElement('img');
    const fechar = new FakeElement('fechar');
    const som = new FakeElement('som');
    const somLigado = new FakeElement('som-ligado');
    const somMutado = new FakeElement('som-mutado');
    const reset = new FakeElement('reset');
    const mais = new FakeElement('mais');
    const menos = new FakeElement('menos');
    const erro = new FakeElement('erro');
    const carga = new FakeElement('carga');
    const barra = new FakeElement('barra');
    const trilho = new FakeElement('trilho');
    const dica = new FakeElement('dica');

    img.hidden = true;
    erro.hidden = true;
    carga.hidden = true;
    barra.parentElement = trilho;
    som.role = 'switch';
    som['aria-label'] = 'Música do mapa';
    som['aria-checked'] = 'true';
    som.title = 'Mutar música';
    som.nodes = {
      '[data-som-ligado]': somLigado,
      '[data-som-mutado]': somMutado
    };

    this.nodes = {
      '.mapa-img': img,
      '[data-palco]': palco,
      '[data-fechar]': fechar,
      '[data-som]': som,
      '[data-reset]': reset,
      '[data-mais]': mais,
      '[data-menos]': menos,
      '[data-erro]': erro,
      '[data-carga]': carga,
      '[data-barra]': barra,
      '[data-dica]': dica
    };
  }
  get innerHTML() { return this._innerHTML || ''; }
}

let capturedPointer = null;
let nextFrame = 1;
let nextTimer = 1;
let nextInterval = 1;
const frames = new Map();
const timers = new Map();
const intervals = new Map();

function flushFrames() {
  while (frames.size) {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  }
}

function flushTimers() {
  const pending = [...timers.values()];
  timers.clear();
  pending.forEach(({ callback }) => callback());
}

function flushIntervals() {
  let iterations = 0;
  while (intervals.size) {
    if (iterations++ > 1000) throw new Error('intervalo do teste nao terminou');
    [...intervals.values()].forEach(({ callback }) => callback());
  }
}

class FakeWindow extends FakeTarget {
  constructor() {
    super();
    this.innerWidth = 1200;
    this.innerHeight = 800;
  }
  matchMedia() { return { matches: this.innerWidth <= 900 }; }
}

class FakeDocument extends FakeTarget {
  constructor(trigger) {
    super();
    this.readyState = 'complete';
    this.fullscreenElement = null;
    this.trigger = trigger;
    this.body = new FakeElement('body');
    this.body.appendChild = (element) => { this.overlay = element; };
  }
  createElement(name) { return new FakeElement(name); }
  querySelectorAll(selector) { return selector === '[data-mapa-empresa]' ? [this.trigger] : []; }
  exitFullscreen() { this.fullscreenElement = null; }
}

class FakeAudio extends FakeTarget {
  constructor(src) {
    super();
    this.src = src;
    this.currentTime = 0;
    this.paused = true;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.loadCalls = 0;
    lastAudio = this;
  }
  load() { this.loadCalls += 1; }
  play() {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
}

let lastAudio = null;
const trigger = new FakeElement('trigger');
const fakeWindow = new FakeWindow();
const fakeDocument = new FakeDocument(trigger);
const fakeOrientation = new FakeTarget();

global.window = fakeWindow;
global.document = fakeDocument;
global.screen = { orientation: fakeOrientation };
global.Audio = FakeAudio;
global.Image = FakeElement;
global.fetch = () => new Promise(() => {});
global.requestAnimationFrame = (callback) => {
  const id = nextFrame++;
  frames.set(id, callback);
  return id;
};
global.setTimeout = (callback, delay) => {
  const id = nextTimer++;
  timers.set(id, { callback, delay });
  return id;
};
global.clearTimeout = (id) => timers.delete(id);
global.setInterval = (callback, delay) => {
  const id = nextInterval++;
  intervals.set(id, { callback, delay });
  return id;
};
global.clearInterval = (id) => intervals.delete(id);

(async () => {
  require(path.resolve(__dirname, '../frontend/js/mapa-empresa.js'));

  trigger.dispatch('click', { target: trigger, preventDefault() {} });
  flushFrames();
  await Promise.resolve();
  flushIntervals();
  flushFrames();

  const overlay = fakeDocument.overlay;
  const palco = overlay.querySelector('[data-palco]');
  const img = overlay.querySelector('.mapa-img');

  assert.equal(lastAudio.src, '/assets/mapachamp/musica.mpeg');
  assert.equal(lastAudio.loadCalls, 1);
  assert.equal(lastAudio.loop, true);
  assert.equal(lastAudio.volume, 0.5);
  assert.equal(lastAudio.muted, false);
  assert.equal(lastAudio.playCalls, 1);
  assert.equal(overlay.hidden, false);
  assert.equal(fakeDocument.body.classList.contains('mapa-aberto'), true);

  palco.dispatch('pointerdown', { target: img, pointerId: 7, clientX: 100, clientY: 100 });
  assert.equal(capturedPointer.element, img, 'a imagem deve capturar o ponteiro');
  palco.dispatch('pointerup', { target: img, pointerId: 7, clientX: 100, clientY: 100 });
  palco.dispatch('click', { target: img, clientX: 100, clientY: 100 });
  assert.equal(fakeDocument.body.classList.contains('mapa-aberto'), true, 'clicar na imagem não fecha');

  const botaoSom = overlay.querySelector('[data-som]');
  botaoSom.dispatch('click');
  assert.equal(lastAudio.muted, true);
  assert.equal(botaoSom['aria-checked'], 'false');
  assert.equal(botaoSom['aria-label'], 'Música do mapa');
  assert.equal(botaoSom.title, 'Ativar música');
  assert.equal(botaoSom.querySelector('[data-som-ligado]').hidden, true);
  assert.equal(botaoSom.querySelector('[data-som-mutado]').hidden, false);

  palco.dispatch('wheel', {
    target: img,
    deltaY: -1,
    clientX: 650,
    clientY: 390,
    preventDefault() {}
  });
  assert.match(img.style.transform, /scale\(1\.18\)/);

  fakeWindow.innerWidth = 390;
  fakeWindow.innerHeight = 844;
  fakeWindow.dispatch('resize');
  flushFrames();
  assert.equal(overlay.classList.contains('is-girado'), true);
  assert.equal(img.style.transform, 'translate(0px, 0px) scale(1) rotate(90deg)');

  fakeWindow.innerWidth = 844;
  fakeWindow.innerHeight = 390;
  fakeWindow.dispatch('orientationchange');
  flushFrames();
  assert.equal(overlay.classList.contains('is-girado'), false);
  assert.equal(img.style.transform, 'translate(0px, 0px) scale(1)');

  overlay.querySelector('[data-fechar]').dispatch('click');
  flushIntervals();
  assert.equal(lastAudio.pauseCalls >= 1, true);
  assert.equal(lastAudio.currentTime, 0);
  assert.equal(fakeDocument.body.classList.contains('mapa-aberto'), false);

  /* Reabrir durante o fade não pode ser escondido pelo timer do fechamento anterior. */
  trigger.dispatch('click', { target: trigger, preventDefault() {} });
  flushTimers();
  flushFrames();
  assert.equal(overlay.hidden, false);
  assert.equal(lastAudio.playCalls, 2);
  assert.equal(lastAudio.muted, true, 'o estado de mute deve ser preservado ao reabrir');

  palco.dispatch('click', { target: palco });
  flushTimers();
  assert.equal(overlay.hidden, true, 'clicar no fundo continua fechando');

  console.log('mapa-empresa: smoke test OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
