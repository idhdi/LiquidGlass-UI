/**
 * Extra targeted checks: lg-lens height bug, lg-grating visibility,
 * mobile navbar layout. Writes shots/grating-on.png and shots/grating-off.png.
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
  waitFor(method, timeout = 20000) {
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
for (const d of ['Page', 'Runtime']) await cdp.send(`${d}.enable`);

async function evaluate(expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result.value;
}
async function goto(url, width, height) {
  cdp.events.length = 0;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = cdp.waitFor('Page.loadEventFired').catch(() => null);
  await cdp.send('Page.navigate', { url });
  await loaded;
  await sleep(1000);
}

const out = {};

/* ---------- 1. lg-lens height / panel containment ---------- */
await goto(`${BASE}/wc/test.html`, 1440, 900);
out.lens = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const host = document.querySelector('lg-lens');
  const sr = host.shadowRoot;
  const box = sr.querySelector('.lg-lens');
  const panel = sr.querySelector('.lg-lens__panel');
  const hostRect = host.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  const panelRect = panel ? panel.getBoundingClientRect() : null;
  const before = {
    hostRect: { w: +hostRect.width.toFixed(1), h: +hostRect.height.toFixed(1) },
    innerInlineStyle: box.getAttribute('style'),
    innerComputedHeight: getComputedStyle(box).height,
    innerRect: { w: +boxRect.width.toFixed(1), h: +boxRect.height.toFixed(1) },
    panelRect: panelRect ? { x: +panelRect.x.toFixed(1), y: +panelRect.y.toFixed(1), w: +panelRect.width.toFixed(1), h: +panelRect.height.toFixed(1) } : null,
    panelPosition: panel ? getComputedStyle(panel).position : null,
    panelParentIsLensBox: panel ? panel.parentElement === box : null,
    panelParentTag: panel ? (panel.parentElement ? panel.parentElement.className : 'shadow-root') : null
  };
  // Try the same component with an explicit pixel unit
  const probe = document.createElement('lg-lens');
  probe.setAttribute('height', '420px');
  probe.setAttribute('width', '100%');
  probe.setAttribute('controls', '');
  document.querySelector('.wrap').appendChild(probe);
  await sleep(400);
  const probeRect = probe.getBoundingClientRect();
  const probeBox = probe.shadowRoot.querySelector('.lg-lens').getBoundingClientRect();
  const after = {
    hostRect: { w: +probeRect.width.toFixed(1), h: +probeRect.height.toFixed(1) },
    innerRect: { w: +probeBox.width.toFixed(1), h: +probeBox.height.toFixed(1) },
    inlineStyle: probe.shadowRoot.querySelector('.lg-lens').getAttribute('style')
  };
  probe.remove();
  return { before, withPxUnit: after };
})()`);

/* ---------- 2. grating on/off screenshots ---------- */
// Freeze animations and hide rain so the diff isolates the grating layer.
await evaluate(`(() => {
  const st = document.createElement('style');
  st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important} lg-rain{display:none!important}';
  document.head.appendChild(st);
  return true;
})()`);
await sleep(400);
const shot = async (file) => {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(res.data, 'base64'));
};
await shot('grating-on.png');
out.grating = await evaluate(`(() => {
  const g = document.querySelector('lg-grating').shadowRoot.querySelector('.lg-grating');
  const cs = getComputedStyle(g);
  const r = g.getBoundingClientRect();
  return { opacity: cs.opacity, zIndex: cs.zIndex, mixBlend: cs.mixBlendMode, position: cs.position, rect: { w: +r.width.toFixed(0), h: +r.height.toFixed(0) }, bodyBg: getComputedStyle(document.body).backgroundImage.slice(0, 60) };
})()`);
await evaluate(`document.querySelector('lg-grating').off()`);
await sleep(500);
await shot('grating-off.png');

/* ---------- 3. mobile navbar layout (demo.html) ---------- */
await goto(`${BASE}/demo.html`, 390, 844);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
cdp.events.length = 0;
const loaded = cdp.waitFor('Page.loadEventFired').catch(() => null);
await cdp.send('Page.navigate', { url: `${BASE}/demo.html` });
await loaded;
await sleep(900);
out.mobileNavbar = await evaluate(`(() => {
  const bar = document.querySelector('.lg-navbar');
  const brand = document.querySelector('.lg-navbar__brand');
  const nav = document.querySelector('.lg-navbar__nav');
  const links = Array.from(document.querySelectorAll('.lg-navbar__link'));
  const br = bar.getBoundingClientRect(), nr = nav.getBoundingClientRect();
  return {
    barRect: { w: +br.width.toFixed(1), h: +br.height.toFixed(1) },
    brandRect: { w: +brand.getBoundingClientRect().width.toFixed(1), h: +brand.getBoundingClientRect().height.toFixed(1) },
    navRect: { w: +nr.width.toFixed(1), h: +nr.height.toFixed(1) },
    links: links.map((l) => { const r = l.getBoundingClientRect(); return { text: l.textContent, w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }),
    navOverflowsBar: nr.right > br.right + 1,
    navFlexWrap: getComputedStyle(nav).flexWrap,
    barFlexWrap: getComputedStyle(bar).flexWrap
  };
})()`);

console.log(JSON.stringify(out, null, 2));
cdp.ws.close();
process.exit(0);
