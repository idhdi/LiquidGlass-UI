/**
 * Module A verification: gooey tabs/switch, fresnel, parallax, caustics, trickle.
 * Requires Chrome on :9333 and the static server on :4173.
 */
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = Number(process.env.CDP_PORT || 9333);
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const OUT = path.resolve('shots');
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
      w.timer = setTimeout(() => { this.waiters.splice(this.waiters.indexOf(w), 1); reject(new Error('event timeout ' + method)); }, timeout);
      this.waiters.push(w);
    });
  }
}

const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
const cdp = new Cdp(ws);
for (const d of ['Page', 'Runtime', 'Log', 'Network']) await cdp.send(`${d}.enable`);

async function evaluate(expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result.value;
}

async function goto(url, width, height, mobile = false) {
  cdp.events.length = 0;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  const loaded = cdp.waitFor('Page.loadEventFired').catch(() => null);
  await cdp.send('Page.navigate', { url });
  await loaded;
  await sleep(1400);
}

async function screenshot(file, full = true) {
  let clip;
  if (full) {
    const m = await cdp.send('Page.getLayoutMetrics');
    const s = m.cssContentSize || m.contentSize || { width: 1440, height: 900 };
    clip = { x: 0, y: 0, width: Math.ceil(s.width), height: Math.min(Math.ceil(s.height), 16000), scale: 1 };
  }
  const res = await cdp.send('Page.captureScreenshot', Object.assign({ format: 'png' }, clip ? { captureBeyondViewport: true, clip } : {}));
  fs.writeFileSync(path.join(OUT, file), Buffer.from(res.data, 'base64'));
  return file;
}

function collectIssues() {
  const reqUrl = new Map();
  for (const e of cdp.events) if (e.method === 'Network.requestWillBeSent') reqUrl.set(e.params.requestId, e.params.request.url);
  const issues = [];
  for (const e of cdp.events) {
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails || {};
      issues.push('exception: ' + (((d.exception && d.exception.description) || d.text || '').split('\n')[0]));
    } else if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
      issues.push('console.error: ' + (e.params.args || []).map((a) => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 200));
    } else if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') {
      issues.push('log: ' + e.params.entry.text);
    } else if (e.method === 'Network.loadingFailed' && !e.params.canceled) {
      const u = reqUrl.get(e.params.requestId) || '';
      if (!/favicon/.test(u)) issues.push('net: ' + e.params.errorText + ' ' + u.split('/').pop());
    }
  }
  return Array.from(new Set(issues));
}

async function mouseMove(x, y, steps = 8) {
  const from = { x: 5, y: 5 };
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(from.x + (x - from.x) * (i / steps)),
      y: Math.round(from.y + (y - from.y) * (i / steps)),
      button: 'none',
    });
    await sleep(16);
  }
}

const report = { timestamp: new Date().toISOString(), checks: {}, screenshots: [], issues: {} };

/* ================= 1. showcase structural checks ================= */
await goto(`${BASE}/showcase.html`, 1440, 900);
report.checks.showcase = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const out = { defined: {}, errors: [] };
  const names = ['lg-button','lg-card','lg-input','lg-select','lg-switch','lg-badge','lg-stat','lg-progress','lg-tabs','lg-tab','lg-toast','lg-rain','lg-grating','lg-controls','lg-lens'];
  names.forEach((n) => { out.defined[n] = !!customElements.get(n); });
  out.components = {
    cards: $$('lg-card').length,
    stats: $$('lg-stat').length,
    tabs: $$('lg-tabs').length,
    switches: $$('lg-switch').length
  };
  // A1 tabs
  const tabs = $('#demoTabs');
  const tabEls = $$('#demoTabs lg-tab');
  const blob = tabs.shadowRoot.querySelector('.lg-tabs__blob');
  const tail = tabs.shadowRoot.querySelector('.lg-tabs__tail');
  const goo = tabs.shadowRoot.querySelector('.lg-tabs__goo');
  out.tabs = {
    hasBlob: !!blob,
    hasTail: !!tail,
    gooFilter: getComputedStyle(goo).filter,
    dataGoo: tabEls.map((t) => t.hasAttribute('data-goo')),
    initialActive: tabEls.map((t) => t.shadowRoot.querySelector('.lg-tab').classList.contains('active')),
    initialLeft: blob && blob.style.left,
    initialWidth: blob && blob.style.width,
    log: (document.getElementById('tabsLog') || {}).textContent
  };
  // click second tab
  tabEls[1].shadowRoot.querySelector('.lg-tab').click();
  await sleep(140);
  out.tabs.midLeft = blob && blob.style.left;
  out.tabs.midTailLeft = tail && tail.style.left;
  await sleep(650);
  out.tabs.afterLeft = blob && blob.style.left;
  out.tabs.afterActive = tabEls.map((t) => t.shadowRoot.querySelector('.lg-tab').classList.contains('active'));
  out.tabs.logAfter = (document.getElementById('tabsLog') || {}).textContent;
  // A1 switch
  const sw = $$('lg-switch')[0];
  const inner = sw.shadowRoot.querySelector('.lg-switch');
  const swBlob = sw.shadowRoot.querySelector('.lg-switch__blob');
  const swTail = sw.shadowRoot.querySelector('.lg-switch__tail');
  out.switch = {
    hasBlob: !!swBlob,
    hasTail: !!swTail,
    gooFilter: getComputedStyle(sw.shadowRoot.querySelector('.lg-switch__goo')).filter,
    beforeOn: inner.classList.contains('on'),
    beforeLeft: inner.style.getPropertyValue('--sw-left'),
    beforeBlobLeft: getComputedStyle(swBlob).left
  };
  inner.click();
  await sleep(90);
  out.switch.midOn = inner.classList.contains('on');
  out.switch.midLeft = inner.style.getPropertyValue('--sw-left');
  out.switch.midBlobLeft = getComputedStyle(swBlob).left;
  out.switch.midTailLeft = getComputedStyle(swTail).left;
  out.switch.midAnimClass = inner.classList.contains('lg-switch--anim');
  await sleep(650);
  out.switch.afterOn = inner.classList.contains('on');
  out.switch.afterBlobLeft = getComputedStyle(swBlob).left;
  out.switch.afterAnimClass = inner.classList.contains('lg-switch--anim');
  // A4 caustics
  const card = $('lg-card');
  out.caustics = {
    inCard: !!card.shadowRoot.querySelector('.lg-caustics'),
    cardAnimation: card.shadowRoot.querySelector('.lg-caustics') ? getComputedStyle(card.shadowRoot.querySelector('.lg-caustics')).animationName : null,
    pageLayer: !!$('.caustics-bg'),
    pageAnimation: $('.caustics-bg') ? getComputedStyle($('.caustics-bg')).animationName : null,
    pageOpacity: $('.caustics-bg') ? getComputedStyle($('.caustics-bg')).opacity : null
  };
  // A2/A3 initial layer structure
  out.depth = {
    hasFresnel: !!card.shadowRoot.querySelector('.lg-fresnel'),
    hasBody: !!card.shadowRoot.querySelector('.lg-card__body'),
    hasDroplets: !!card.shadowRoot.querySelector('.lg-droplets'),
    bodyTransform: getComputedStyle(card.shadowRoot.querySelector('.lg-card__body')).transform,
    dropletsTransform: getComputedStyle(card.shadowRoot.querySelector('.lg-droplets')).transform
  };
  out.overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  return out;
})()`);

/* ================= 2. gooey mid-animation screenshot ================= */
await evaluate(`(async () => {
  const t = document.querySelectorAll('#demoTabs lg-tab')[2];
  t.shadowRoot.querySelector('.lg-tab').click();
  await new Promise((r) => setTimeout(r, 110));
  return true;
})()`);
report.screenshots.push(await screenshot('showcase-goo.png', false));

/* ================= 2b. trusted hover -> fresnel + parallax ================= */
// Scroll an in-viewport card to the centre and hover it with trusted mouse events.
await evaluate(`(async () => {
  const cards = Array.from(document.querySelectorAll('lg-card'));
  const target = cards.find((c) => { const r = c.getBoundingClientRect(); return r.height > 60 && r.top > 40 && r.top < innerHeight - 200; }) || cards[2] || cards[0];
  target.scrollIntoView({ block: 'center', behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 300));
  return true;
})()`);
const cardRect = await evaluate(`(() => {
  const cards = Array.from(document.querySelectorAll('lg-card'));
  const target = cards.find((c) => { const r = c.getBoundingClientRect(); return r.height > 60 && r.top > 40 && r.top < innerHeight - 200; }) || cards[2] || cards[0];
  const r = target.getBoundingClientRect();
  return { x: Math.round(r.x + r.width * 0.55), y: Math.round(r.y + Math.min(r.height * 0.45, 150)), w: r.width, h: r.height };
})()`);
await mouseMove(cardRect.x, cardRect.y, 12);
await sleep(500);
report.checks.hover = await evaluate(`(() => {
  const cards = Array.from(document.querySelectorAll('lg-card'));
  const target = cards.find((c) => { const r = c.getBoundingClientRect(); return r.height > 60 && r.top > 40 && r.top < innerHeight - 200; }) || cards[2] || cards[0];
  const sr = target.shadowRoot;
  const fres = sr.querySelector('.lg-fresnel');
  const body = sr.querySelector('.lg-card__body');
  const drops = sr.querySelector('.lg-droplets');
  const glass = sr.querySelector('.lg-card');
  const cs = (el, p) => el ? getComputedStyle(el).getPropertyValue(p) : null;
  return {
    targetIndex: cards.indexOf(target),
    targetRect: (() => { const r = target.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    fresnelExists: !!fres,
    fresnelOpacity: cs(fres, 'opacity'),
    fresnelMask: cs(fres, '-webkit-mask-composite') || cs(fres, 'mask-composite'),
    fresnelBg: (cs(fres, 'background-image') || '').slice(0, 80),
    fx: glass.style.getPropertyValue('--fx'),
    fy: glass.style.getPropertyValue('--fy'),
    tx: glass.style.getPropertyValue('--tx'),
    ty: glass.style.getPropertyValue('--ty'),
    glassClasses: glass.className,
    glassTransform: cs(glass, 'transform'),
    bodyTransform: cs(body, 'transform'),
    dropletsTransform: cs(drops, 'transform'),
    spotlightTransform: cs(sr.querySelector('.lg-spotlight'), 'transform')
  };
})()`);
report.screenshots.push(await screenshot('showcase-desktop.png'));
report.screenshots.push(await screenshot('showcase-hover.png', false));

/* ================= 3. A5 trickle detection (poll) ================= */
let trickle = { found: false, waitedMs: 0 };
for (let i = 0; i < 26 && !trickle.found; i++) {
  await sleep(500);
  trickle = await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('lg-card'));
    const trails = cards.map((c) => c.shadowRoot.querySelectorAll('.lg-wet-trail').length).reduce((a, b) => a + b, 0);
    const anims = cards.reduce((acc, c) => acc + Array.from(c.shadowRoot.querySelectorAll('.lg-droplet')).filter((d) => d.getAnimations().length > 0).length, 0);
    return { found: trails > 0 || anims > 0, trails, anims };
  })()`);
  trickle.waitedMs = (i + 1) * 500;
  if (trickle.found) {
    trickle.waitedMs = (i + 1) * 500;
    report.screenshots.push(await screenshot('showcase-trickle.png'));
  }
}
report.checks.trickle = trickle;

/* ================= 4. mobile ================= */
await goto(`${BASE}/showcase.html`, 390, 844, true);
report.checks.mobile = await evaluate(`(() => {
  const de = document.documentElement;
  const wide = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > de.clientWidth + 2 && !el.closest('.caustics-bg') && !el.closest('.aurora')) {
      wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 40), right: +r.right.toFixed(0) });
    }
  });
  return { viewport: innerWidth, scrollWidth: de.scrollWidth, overflowX: de.scrollWidth > de.clientWidth + 2, wide: wide.slice(0, 8) };
})()`);
report.screenshots.push(await screenshot('showcase-mobile.png'));
report.issues.showcase = collectIssues();

/* ================= 5. regression on existing pages ================= */
await goto(`${BASE}/demo.html`, 1440, 900);
report.regression = report.regression || {};
report.regression.demo = await evaluate(`(() => ({
  buttons: document.querySelectorAll('.lg-btn').length,
  cards: document.querySelectorAll('.lg-card').length,
  progressBars: document.querySelectorAll('.lg-progress__bar').length,
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
}))()`);
report.issues.demo = collectIssues();

await goto(`${BASE}/wc/test.html`, 1440, 900);
report.regression.wcTest = await evaluate(`(async () => {
  const names = ['lg-button','lg-card','lg-input','lg-select','lg-switch','lg-badge','lg-stat','lg-progress','lg-tabs','lg-tab','lg-toast','lg-rain','lg-grating','lg-controls','lg-lens'];
  const card = document.querySelector('lg-card');
  const lens = document.querySelector('lg-lens');
  const lr = lens.getBoundingClientRect();
  const panel = lens.shadowRoot.querySelector('.lg-lens__panel');
  const pr = panel ? panel.getBoundingClientRect() : null;
  return {
    defined: names.filter((n) => customElements.get(n)).length,
    cards: document.querySelectorAll('lg-card').length,
    rainDrips: Array.from(document.querySelectorAll('lg-rain')).map((r) => r.shadowRoot.querySelectorAll('.drip').length),
    lensHeight: Math.round(lr.height),
    panelParentClass: panel && panel.parentElement ? panel.parentElement.className : (panel ? 'shadow-root' : null),
    panelInsideLens: !!(panel && pr && pr.top >= lr.top - 1 && pr.bottom <= lr.bottom + 1 && pr.right <= lr.right + 1),
    causticsInCard: !!(card && card.shadowRoot.querySelector('.lg-caustics')),
    fresnelInCard: !!(card && card.shadowRoot.querySelector('.lg-fresnel'))
  };
})()`);
report.regression.wcTest.reconnect = await evaluate(`(async () => {
  const errors = [];
  const onErr = (e) => errors.push(e.message);
  window.addEventListener('error', onErr);
  const card = document.querySelector('lg-card');
  const parent = card.parentElement;
  parent.removeChild(card);
  document.querySelector('.wrap').appendChild(card);
  await new Promise((r) => setTimeout(r, 120));
  window.removeEventListener('error', onErr);
  return { errors, stillUpgraded: !!card.shadowRoot };
})()`);
report.screenshots.push(await screenshot('wc-test-module-a.png'));
report.issues.wcTest = collectIssues();

await goto(`${BASE}/wc/verify.html`, 1440, 900);
report.regression.verify = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tabs = document.getElementById('tabsDemo');
  const tabEls = Array.from(tabs.querySelectorAll('lg-tab'));
  const blob = tabs.shadowRoot.querySelector('.lg-tabs__blob');
  const before = blob && blob.style.left;
  tabEls[2].shadowRoot.querySelector('.lg-tab').click();
  await sleep(700);
  const sw = document.querySelector('lg-switch');
  const swInner = sw.shadowRoot.querySelector('.lg-switch');
  swInner.click();
  await sleep(120);
  return {
    tabActive: tabEls.map((t) => t.shadowRoot.querySelector('.lg-tab').classList.contains('active')),
    blobMoved: !!(blob && before !== blob.style.left),
    switchOn: swInner.classList.contains('on'),
    switchHasBlob: !!sw.shadowRoot.querySelector('.lg-switch__blob'),
    progressBar: (() => { const p = document.getElementById('progressB'); p.setValue(44); return p.shadowRoot.querySelector('.lg-progress__bar').style.width; })()
  };
})()`);
report.issues.verify = collectIssues();

/* ================= summary ================= */
const errors = Object.values(report.issues).flat().filter((x) => /exception|console\.error/.test(x));
report.summary = {
  screenshots: report.screenshots,
  consoleErrors: errors,
  gooFilterTabs: report.checks.showcase && report.checks.showcase.tabs.gooFilter,
  gooFilterSwitch: report.checks.showcase && report.checks.showcase.switch.gooFilter,
  fresnelOpacity: report.checks.hover && report.checks.hover.fresnelOpacity,
  bodyTransform: report.checks.hover && report.checks.hover.bodyTransform,
  trickle: report.checks.trickle,
  tabsMoved: report.checks.showcase && report.checks.showcase.tabs.initialLeft !== report.checks.showcase.tabs.afterLeft,
};
fs.writeFileSync('module-a-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
cdp.ws.close();
process.exit(0);
