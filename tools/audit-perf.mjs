/**
 * LiquidGlass-UI performance optimization verification.
 * Checks: shared stylesheets, GPU-only animations, oklch, contain isolation.
 * Requires Chrome on :9555 and server on :4173.
 */
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = Number(process.env.CDP_PORT || 9555);
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const OUT = path.resolve('shots');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.waiters = []; this.events = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== undefined) {
        const p = this.pending.get(m.id); if (!p) return;
        this.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        return;
      }
      this.events.push(m);
      for (const w of this.waiters.slice()) if (w.method === m.method) {
        this.waiters.splice(this.waiters.indexOf(w), 1); clearTimeout(w.timer); w.resolve(m);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error('timeout ' + method)); }, 30000);
    });
  }
  waitFor(method, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const w = { method, resolve };
      w.timer = setTimeout(() => reject(new Error('event timeout ' + method)), timeout);
      this.waiters.push(w);
    });
  }
}

const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
const cdp = new Cdp(ws);
for (const d of ['Page', 'Runtime', 'Log', 'Network', 'Performance']) await cdp.send(`${d}.enable`);

async function evaluate(expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result.value;
}
async function goto(url, width = 1440, height = 900) {
  cdp.events.length = 0;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = cdp.waitFor('Page.loadEventFired').catch(() => null);
  await cdp.send('Page.navigate', { url });
  await loaded;
  await sleep(1400);
}
async function shot(file) {
  const m = await cdp.send('Page.getLayoutMetrics');
  const s = m.cssContentSize || m.contentSize || { width: 1440, height: 900 };
  const res = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(s.width), height: Math.min(Math.ceil(s.height), 16000), scale: 1 },
  });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(res.data, 'base64'));
  return file;
}
function issues() {
  const out = [];
  for (const e of cdp.events) {
    if (e.method === 'Runtime.exceptionThrown') out.push('exception: ' + (((e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || e.params.exceptionDetails.text || '').split('\n')[0]));
    else if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') out.push('console.error: ' + (e.params.args || []).map((a) => a.value ?? a.description).join(' ').slice(0, 200));
    else if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') out.push('log: ' + e.params.entry.text);
  }
  return [...new Set(out)];
}

const report = {};

/* ================= showcase: shared CSSOM / animations / contain ================= */
await goto(`${BASE}/showcase.html`);
report.showcase = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const hosts = $$('*').filter((el) => el.shadowRoot);
  const roots = hosts.map((h) => h.shadowRoot);
  const sheets = roots.map((r) => r.adoptedStyleSheets && r.adoptedStyleSheets[0]).filter(Boolean);
  const uniqueSheets = new Set(sheets);
  const styleEls = roots.reduce((a, r) => a + r.querySelectorAll('style').length, 0);
  const styleBytes = roots.reduce((a, r) => a + Array.from(r.querySelectorAll('style')).reduce((s, x) => s + x.textContent.length, 0), 0);
  const lensRoot = document.querySelector('lg-lens') && document.querySelector('lg-lens').shadowRoot;
  const sampleGlass = document.querySelector('lg-card').shadowRoot.querySelector('.lg-glass');
  const anims = document.getAnimations({ subtree: true });
  const keyframeProps = new Set();
  const animNames = new Set();
  for (const a of anims) {
    const effect = a.effect;
    if (!effect || !effect.getKeyframes) continue;
    if (a.animationName) animNames.add(a.animationName);
    for (const kf of effect.getKeyframes()) {
      for (const k of Object.keys(kf)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(k)) keyframeProps.add(k);
    }
  }
  // mount benchmark: 60 cards
  const before = performance.memory ? performance.memory.usedJSHeapSize : null;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const t0 = performance.now();
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('lg-card');
    c.textContent = 'bench ' + i;
    host.appendChild(c);
  }
  const mountMs = performance.now() - t0;
  const benchRoots = Array.from(host.children).map((c) => c.shadowRoot);
  const benchStyleBytes = benchRoots.reduce((a, r) => a + Array.from(r.querySelectorAll('style')).reduce((s, x) => s + x.textContent.length, 0), 0);
  const benchSheets = new Set(benchRoots.map((r) => r.adoptedStyleSheets && r.adoptedStyleSheets[0]).filter(Boolean));
  const after = performance.memory ? performance.memory.usedJSHeapSize : null;
  host.remove();
  return {
    components: hosts.length,
    shadowRoots: roots.length,
    styleElements: styleEls,
    styleBytes,
    adoptedSheetInstances: sheets.length,
    uniqueAdoptedSheets: uniqueSheets.size,
    lensSheets: lensRoot ? lensRoot.adoptedStyleSheets.length : null,
    bench: { cards: 60, mountMs: +mountMs.toFixed(1), styleBytes: benchStyleBytes, uniqueSheets: benchSheets.size, heapDeltaBytes: before != null && after != null ? after - before : null },
    animations: { count: anims.length, names: Array.from(animNames).sort(), keyframeProps: Array.from(keyframeProps).sort() },
    contain: {
      glass: getComputedStyle(sampleGlass).contain,
      rain: (() => { const r = document.querySelector('lg-rain'); return r && r.shadowRoot.querySelector('.lg-rain') ? getComputedStyle(r.shadowRoot.querySelector('.lg-rain')).contain : null; })(),
      tabs: (() => { const t = document.querySelector('lg-tabs'); return t && t.shadowRoot.querySelector('.lg-tabs') ? getComputedStyle(t.shadowRoot.querySelector('.lg-tabs')).contain : null; })(),
      lens: lensRoot ? getComputedStyle(lensRoot.querySelector('.lg-lens')).contain : null,
    },
    oklch: {
      supported: CSS.supports('color', 'oklch(0.8 0.14 230)'),
      accentVar: getComputedStyle(sampleGlass).getPropertyValue('--lg-accent').trim(),
      sceneVar: getComputedStyle(sampleGlass).getPropertyValue('--lg-scene').trim().slice(0, 120),
    },
    liquidFlow: (() => { const el = sampleGlass.querySelector('.lg-liquid-flow'); if (!el) return null; const cs = getComputedStyle(el); return { animation: cs.animationName, willChange: cs.willChange, transform: cs.transform }; })(),
    caustics: (() => { const el = sampleGlass.querySelector('.lg-caustics'); if (!el) return null; const cs = getComputedStyle(el); return { animation: cs.animationName, willChange: cs.willChange, transform: cs.transform }; })(),
  };
})()`);

/* CDP layout/style metrics over 2s of animation */
async function metricsDelta(ms) {
  const a = await cdp.send('Performance.getMetrics');
  await sleep(ms);
  const b = await cdp.send('Performance.getMetrics');
  const map = (r) => Object.fromEntries(r.metrics.map((m) => [m.name, m.value]));
  const m1 = map(a), m2 = map(b);
  const pick = ['LayoutCount', 'RecalcStyleCount', 'PaintCount', 'TaskDuration', 'JSHeapUsedSize'];
  const out = {};
  for (const k of pick) out[k] = +(m2[k] - m1[k]).toFixed(0);
  return out;
}
report.showcaseMetrics2s = await metricsDelta(2000);
report.screenshots = [await shot('perf-showcase.png')];
report.issues = { showcase: issues() };

/* ================= demo.html: light DOM oklch + contain + scene ================= */
await goto(`${BASE}/demo.html`);
report.demo = await evaluate(`(() => {
  const glass = document.querySelector('.lg-glass');
  const before = getComputedStyle(document.body, '::before');
  const sceneEl = document.body;
  return {
    contain: getComputedStyle(glass).contain,
    sceneBefore: {
      animation: before.animationName,
      transform: before.transform,
      background: (before.backgroundImage || '').slice(0, 160),
      willChange: before.willChange,
    },
    sceneSelfBg: getComputedStyle(sceneEl).backgroundColor,
    oklchSupported: CSS.supports('color', 'oklch(0.8 0.14 230)'),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--lg-accent').trim(),
    primaryButtonBg: (() => { const b = document.querySelector('.lg-btn--primary'); return b ? getComputedStyle(b).backgroundImage.slice(0, 160) : null; })(),
    progressBg: (() => { const p = document.querySelector('.lg-progress__bar'); return p ? getComputedStyle(p).backgroundImage.slice(0, 160) : null; })(),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    wide: Array.from(document.querySelectorAll('body *')).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > document.documentElement.clientWidth + 2;
    }).slice(0, 10).map((el) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 40), right: Math.round(el.getBoundingClientRect().right) })),
  };
})()`);
report.demoMetrics2s = await metricsDelta(2000);
report.screenshots.push(await shot('perf-demo.png'));
report.issues.demo = issues();

/* ================= wc/test: lens shared sheets + shadow animation properties ================= */
await goto(`${BASE}/wc/test.html`);
report.wcTest = await evaluate(`(() => {
  const hosts = Array.from(document.querySelectorAll('*')).filter((el) => el.shadowRoot);
  const roots = hosts.map((h) => h.shadowRoot);
  const sheets = roots.map((r) => r.adoptedStyleSheets && r.adoptedStyleSheets[0]).filter(Boolean);
  const styleBytes = roots.reduce((a, r) => a + Array.from(r.querySelectorAll('style')).reduce((s, x) => s + x.textContent.length, 0), 0);
  const lens = document.querySelector('lg-lens');
  const lensRoot = lens && lens.shadowRoot;
  const card = document.querySelector('lg-card');
  const glass = card && card.shadowRoot.querySelector('.lg-glass');
  const anims = glass ? glass.getAnimations({ subtree: true }) : [];
  const props = new Set();
  const names = new Set();
  for (const a of anims) {
    if (a.animationName) names.add(a.animationName);
    if (!a.effect || !a.effect.getKeyframes) continue;
    for (const kf of a.effect.getKeyframes()) {
      for (const k of Object.keys(kf)) {
        if (!['offset', 'computedOffset', 'easing', 'composite'].includes(k)) props.add(k);
      }
    }
  }
  return {
    components: hosts.length,
    shadowRoots: roots.length,
    styleElements: roots.reduce((a, r) => a + r.querySelectorAll('style').length, 0),
    styleBytes,
    uniqueSheets: new Set(sheets).size,
    lensSheets: lensRoot ? lensRoot.adoptedStyleSheets.length : null,
    lensHeight: lens ? Math.round(lens.getBoundingClientRect().height) : null,
    glassAnimations: { count: anims.length, names: Array.from(names).sort(), keyframeProps: Array.from(props).sort() },
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  };
})()`);
report.screenshots.push(await shot('perf-wc-test.png'));
report.issues.wcTest = issues();

const errors = Object.values(report.issues).flat().filter((x) => /exception|console\.error/.test(x));
report.summary = {
  styleBytes: report.showcase.styleBytes,
  sharedSheetInstances: report.showcase.adoptedSheetInstances,
  uniqueSheets: report.showcase.uniqueAdoptedSheets,
  bench: report.showcase.bench,
  badKeyframeProps: report.showcase.animations.keyframeProps,
  contain: report.showcase.contain,
  demoContain: report.demo.contain,
  demoSceneAnimation: report.demo.sceneBefore.animation,
  consoleErrors: errors,
};

fs.writeFileSync('perf-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
cdp.ws.close();
process.exit(0);
