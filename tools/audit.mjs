/**
 * LiquidGlass UI — browser verification harness (zero dependencies).
 *
 * Drives the already-running headless Chrome over the DevTools Protocol,
 * audits each page (console errors, layout, styles, interactions, a11y),
 * and writes full-page screenshots.
 *
 * Requires: Chrome started with --remote-debugging-port=9333
 *           static server on http://127.0.0.1:4173
 *
 * Usage: node tools/audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const CDP_PORT = Number(process.env.CDP_PORT || 9333);
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const OUT = process.env.SHOT_DIR ? path.resolve(process.env.SHOT_DIR) : path.resolve('shots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Minimal CDP client                                                   */
/* ------------------------------------------------------------------ */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.waiters = [];
    this.events = [];
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || 'CDP error'));
        else p.resolve(msg.result);
        return;
      }
      this.events.push(msg);
      for (const w of this.waiters.slice()) {
        if (w.method !== msg.method) continue;
        this.waiters.splice(this.waiters.indexOf(w), 1);
        clearTimeout(w.timer);
        w.resolve(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
      const orig = this.pending.get(id);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); orig.resolve(v); },
        reject: (e) => { clearTimeout(timer); orig.reject(e); },
      });
    });
  }

  waitFor(method, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const w = { method, resolve };
      w.timer = setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error(`CDP event timeout: ${method}`));
      }, timeout);
      this.waiters.push(w);
    });
  }
}

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('No page target on CDP port ' + CDP_PORT);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP WebSocket failed')), { once: true });
  });
  return new Cdp(ws);
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (res.exceptionDetails) {
    const d = res.exceptionDetails;
    const detail = (d.exception && d.exception.description) || d.text || 'unknown';
    throw new Error('Evaluation failed: ' + detail.split('\n').slice(0, 3).join(' | '));
  }
  return res.result ? res.result.value : undefined;
}

async function goto(cdp, url, viewport) {
  cdp.events.length = 0;
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.dsf || 1,
    mobile: !!viewport.mobile,
  });
  const loaded = cdp.waitFor('Page.loadEventFired', 30000).catch(() => null);
  const nav = await cdp.send('Page.navigate', { url });
  if (nav.errorText) throw new Error(`Navigation failed: ${nav.errorText} (${url})`);
  await loaded;
  await sleep(viewport.settle || 1200);
}

async function screenshot(cdp, file) {
  let width = 0;
  let height = 0;
  const metrics = await cdp.send('Page.getLayoutMetrics').catch(() => ({}));
  const size = metrics.cssContentSize || metrics.contentSize;
  if (size) {
    width = Math.ceil(size.width);
    height = Math.ceil(size.height);
  }
  if (!width || !height) {
    const dims = await evaluate(cdp, '({w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight})');
    width = dims.w;
    height = dims.h;
  }
  height = Math.min(height, 16000);
  const res = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
  return { file: path.basename(file), width, height, bytes: fs.statSync(file).size };
}

/* ------------------------------------------------------------------ */
/* Issue collection                                                     */
/* ------------------------------------------------------------------ */
function collectIssues(cdp) {
  const reqUrl = new Map();
  for (const e of cdp.events) {
    if (e.method === 'Network.requestWillBeSent') reqUrl.set(e.params.requestId, e.params.request.url);
  }
  const issues = { exceptions: [], console: [], log: [], netFailed: [], httpErrors: [] };
  for (const e of cdp.events) {
    switch (e.method) {
      case 'Runtime.exceptionThrown': {
        const d = e.params.exceptionDetails || {};
        issues.exceptions.push({
          text: d.text || '',
          desc: ((d.exception && d.exception.description) || '').split('\n')[0],
          url: d.url || '',
          line: d.lineNumber,
        });
        break;
      }
      case 'Runtime.consoleAPICalled': {
        const t = e.params.type;
        if (t === 'error' || t === 'warning' || t === 'assert') {
          issues.console.push({
            type: t,
            args: (e.params.args || []).map((a) => (a.value !== undefined ? String(a.value) : (a.description || a.type))),
          });
        }
        break;
      }
      case 'Log.entryAdded': {
        const en = e.params.entry || {};
        if (en.level === 'error' || en.level === 'warning') {
          issues.log.push({ level: en.level, text: en.text, url: en.url || '' });
        }
        break;
      }
      case 'Network.loadingFailed': {
        const p = e.params;
        if (p.canceled) break;
        const url = reqUrl.get(p.requestId) || '';
        if (/favicon\.ico/.test(url)) break;
        issues.netFailed.push({ url, error: p.errorText });
        break;
      }
      case 'Network.responseReceived': {
        const r = e.params.response || {};
        if (r.status >= 400 && !/favicon\.ico/.test(r.url)) issues.httpErrors.push({ status: r.status, url: r.url });
        break;
      }
      default:
        break;
    }
  }
  const uniq = (arr) => Array.from(new Map(arr.map((x) => [JSON.stringify(x), x])).values());
  issues.console = uniq(issues.console);
  issues.log = uniq(issues.log);
  issues.netFailed = uniq(issues.netFailed);
  issues.httpErrors = uniq(issues.httpErrors);
  return issues;
}

function mergeIssues(a, b) {
  const keys = ['exceptions', 'console', 'log', 'netFailed', 'httpErrors'];
  const out = {};
  for (const k of keys) out[k] = Array.from(new Map([...(a[k] || []), ...(b[k] || [])].map((x) => [JSON.stringify(x), x])).values());
  return out;
}

/* ------------------------------------------------------------------ */
/* Page audit: CSS demo (demo.html / index.html)                        */
/* ------------------------------------------------------------------ */
async function pageAuditDemo() {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const cs = (s, p) => {
    const el = typeof s === 'string' ? $(s) : s;
    return el ? getComputedStyle(el).getPropertyValue(p) : null;
  };
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const out = {
    url: location.href,
    title: document.title,
    lang: document.documentElement.lang,
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    sheets: [],
    counts: {},
    computed: {},
    layout: {},
    interactions: {},
    a11y: {},
    scriptErrors: [],
  };

  out.sheets = Array.from(document.styleSheets).map((s) => {
    let rules = -1;
    let err = null;
    try { rules = s.cssRules ? s.cssRules.length : -1; } catch (e) { err = String(e); }
    return { href: s.href ? s.href.split('/').pop() : null, rules, err };
  });

  const sels = [
    '.lg-scene', '.lg-glass', '.lg-navbar', '.lg-navbar__brand', '.lg-navbar__nav', '.lg-navbar__link',
    '.lg-h1', '.lg-sub', '.lg-section-title', '.lg-btn', '.lg-btn--primary', '.lg-btn--success',
    '.lg-btn--warning', '.lg-btn--danger', '.lg-btn--ghost', '.lg-btn--sm', '.lg-btn--lg', '.lg-btn[disabled]',
    '.lg-field', '.lg-input', '.lg-input--error', '.lg-select', '.lg-slider', '.lg-check', '.lg-radio',
    '.lg-switch', '.lg-switch.on', '.lg-stat', '.lg-stat__label', '.lg-stat__value', '.lg-stat__delta--up',
    '.lg-stat__delta--down', '.lg-progress', '.lg-progress--lg', '.lg-progress--sm', '.lg-progress__bar',
    '.lg-tabs', '.lg-tab', '.lg-tab.active', '.lg-badge', '.lg-badge--dot', '.lg-card', '.lg-dropdown',
    '.lg-dropdown__menu', '.lg-dropdown__item', '.lg-droplets', '.lg-droplet', '.lg-row', '.lg-grid',
  ];
  for (const s of sels) out.counts[s] = $$(s).length;

  out.computed = {
    scene: {
      bgImage: (cs('.lg-scene', 'background-image') || '').slice(0, 100),
      animationName: cs('.lg-scene', 'animation-name'),
      fontFamily: cs('.lg-scene', 'font-family'),
    },
    glass: {
      backdrop: cs('.lg-glass', 'backdrop-filter'),
      webkitBackdrop: cs('.lg-glass', '-webkit-backdrop-filter'),
      radius: cs('.lg-glass', 'border-radius'),
      borderTopWidth: cs('.lg-glass', 'border-top-width'),
      hasShadow: (cs('.lg-glass', 'box-shadow') || 'none') !== 'none',
    },
    button: {
      radius: cs('.lg-btn', 'border-radius'),
      cursor: cs('.lg-btn', 'cursor'),
      backdrop: cs('.lg-btn', 'backdrop-filter'),
      transition: cs('.lg-btn', 'transition-duration'),
    },
    buttonPrimary: {
      bgImage: (cs('.lg-btn--primary', 'background-image') || '').slice(0, 130),
      color: cs('.lg-btn--primary', 'color'),
    },
    buttonDisabled: {
      opacity: cs('.lg-btn[disabled]', 'opacity'),
      cursor: cs('.lg-btn[disabled]', 'cursor'),
    },
    input: { radius: cs('.lg-input', 'border-radius'), bg: cs('.lg-input', 'background-color') },
    inputError: {
      borderColor: cs('.lg-input--error', 'border-color'),
      textColor: cs('.lg-input--error', 'color'),
    },
    select: { radius: cs('.lg-select', 'border-radius') },
    switchOn: {
      w: cs('.lg-switch', 'width'),
      bg: (cs('.lg-switch.on', 'background-image') || cs('.lg-switch.on', 'background-color') || '').slice(0, 90),
    },
    stat: { valueSize: cs('.lg-stat__value', 'font-size') },
    progress: {
      radius: cs('.lg-progress', 'border-radius'),
      barBg: (cs('.lg-progress__bar', 'background-image') || '').slice(0, 110),
    },
    tabActive: { bg: cs('.lg-tab.active', 'background-color'), color: cs('.lg-tab.active', 'color') },
    badge: { radius: cs('.lg-badge', 'border-radius'), fontSize: cs('.lg-badge', 'font-size') },
    dropdownMenu: {
      opacity: cs('.lg-dropdown__menu', 'opacity'),
      transform: cs('.lg-dropdown__menu', 'transform'),
    },
    support: {
      backdropFilter: CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'),
      maskComposite: CSS.supports('mask-composite', 'exclude'),
    },
  };

  const de = document.documentElement;
  const wide = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('.lg-droplets')) return;
    const b = el.getBoundingClientRect();
    if (b.width > 0 && b.right > de.clientWidth + 2) {
      wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 60), right: +b.right.toFixed(1) });
    }
  });
  const hidden = [];
  for (const s of sels) {
    for (const el of $$(s)) {
      const b = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if ((b.width < 2 || b.height < 2) && st.display !== 'none' && st.visibility !== 'hidden') {
        hidden.push({ sel: s, tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 50) });
      }
    }
  }
  out.layout = {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    scrollHeight: de.scrollHeight,
    horizontalOverflow: de.scrollWidth > de.clientWidth + 2,
    wideElements: wide.slice(0, 12),
    hiddenElements: hidden.slice(0, 12),
  };

  try {
    const tabs = $$('.lg-tab');
    const panel = $('#tabPanel');
    if (tabs[1]) tabs[1].click();
    await sleep(60);
    out.interactions.tabs = {
      activeIndex: tabs.findIndex((b) => b.classList.contains('active')),
      panel: panel ? panel.textContent.trim().slice(0, 30) : null,
    };

    const dd = $('.lg-dropdown');
    const ddToggle = $('[data-dropdown-toggle]');
    if (ddToggle) ddToggle.click();
    await sleep(60);
    out.interactions.dropdownOpen = dd ? dd.classList.contains('open') : null;
    document.body.click();
    await sleep(60);
    out.interactions.dropdownClosed = dd ? !dd.classList.contains('open') : null;

    const ts = $('[data-toast-success]');
    const td = $('[data-toast-danger]');
    if (ts) ts.click();
    if (td) td.click();
    await sleep(150);
    out.interactions.toasts = $$('#toastHost .lg-toast').map((t) => ({
      type: (t.className.match(/lg-toast--(\w+)/) || [])[1] || null,
      text: t.textContent.trim(),
      h: +t.getBoundingClientRect().height.toFixed(0),
    }));

    const sw = $('.lg-switch');
    if (sw) {
      const before = sw.classList.contains('on');
      sw.click();
      await sleep(30);
      out.interactions.switchToggle = { before, after: sw.classList.contains('on') };
    }

    const cb = $('.lg-check input');
    if (cb) {
      const before = cb.checked;
      cb.click();
      out.interactions.checkbox = { before, after: cb.checked };
    }

    const sl = $('.lg-slider');
    if (sl) {
      sl.value = '20';
      sl.dispatchEvent(new Event('input', { bubbles: true }));
      out.interactions.sliderValue = sl.value;
    }

    out.interactions.progressPercents = $$('.lg-progress__bar').map((b) => {
      const pw = b.parentElement.getBoundingClientRect().width;
      return pw ? +(b.getBoundingClientRect().width / pw * 100).toFixed(1) : null;
    });
  } catch (e) {
    out.scriptErrors.push(String(e));
  }

  const labelable = Array.from(document.querySelectorAll('input, select, textarea'));
  out.a11y = {
    lang: document.documentElement.lang || null,
    h1Count: $$('h1').length,
    labelableMissingName: labelable
      .filter((el) => !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title'))
      .map((el) => ({ tag: el.tagName.toLowerCase(), type: el.type, cls: String(el.className || '').slice(0, 40) })),
    imgsWithoutAlt: $$('img').filter((i) => !i.hasAttribute('alt')).length,
    buttonsWithoutText: $$('button').filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
    hasReducedMotionRule: (() => {
      try {
        return Array.from(document.styleSheets).some((s) => {
          try {
            return Array.from(s.cssRules || []).some((r) => r.media && r.media.mediaText.includes('prefers-reduced-motion'));
          } catch (e) { return false; }
        });
      } catch (e) { return null; }
    })(),
  };

  return out;
}

/* ------------------------------------------------------------------ */
/* Page audit: wc/test.html                                             */
/* ------------------------------------------------------------------ */
async function pageAuditWc() {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const names = ['lg-button', 'lg-card', 'lg-input', 'lg-select', 'lg-switch', 'lg-badge', 'lg-stat', 'lg-progress', 'lg-tabs', 'lg-tab', 'lg-toast', 'lg-rain', 'lg-grating', 'lg-controls', 'lg-lens'];
  const out = {
    url: location.href,
    title: document.title,
    version: (window.LiquidGlassUI && window.LiquidGlassUI.version) || null,
    componentDefs: {},
    present: [],
    missingOnPage: [],
    upgrades: {},
    rain: [],
    grating: null,
    controls: null,
    lens: null,
    layout: {},
    interactions: {},
    scriptErrors: [],
  };

  for (const n of names) out.componentDefs[n] = !!customElements.get(n);
  for (const n of names) if ($(n)) out.present.push(n);
  out.missingOnPage = names.filter((n) => !$(n));
  for (const n of out.present) {
    const el = $(n);
    out.upgrades[n] = {
      hasShadow: !!(el && el.shadowRoot),
      shadowChildren: el && el.shadowRoot ? el.shadowRoot.children.length : 0,
    };
  }

  out.rain = $$('lg-rain').map((el) => {
    const root = el.shadowRoot;
    const kw = root && root.querySelector('.lg-rain');
    return {
      global: el.hasAttribute('global'),
      density: el.getAttribute('density'),
      drips: root ? root.querySelectorAll('.drip').length : -1,
      droppers: root ? root.querySelectorAll('.dropper').length : -1,
      sprites: root ? root.querySelectorAll('.sp').length : -1,
      droplets: root ? root.querySelectorAll('.lg-droplet').length : -1,
      position: kw ? getComputedStyle(kw).position : null,
    };
  });

  const gr = $('lg-grating');
  const g = gr && gr.shadowRoot && gr.shadowRoot.querySelector('.lg-grating');
  out.grating = g ? {
    bg: (g.style.background || '').slice(0, 170),
    opacity: getComputedStyle(g).opacity,
    position: getComputedStyle(g).position,
    mixBlend: getComputedStyle(g).mixBlendMode,
    zIndex: getComputedStyle(g).zIndex,
  } : null;

  const ctl = $('#demoControls');
  const ctlRoot = ctl && ctl.shadowRoot;
  const panel = ctlRoot && ctlRoot.querySelector('.lg-controls');
  out.controls = panel ? {
    rows: ctlRoot.querySelectorAll('.lg-controls__row').length,
    sliders: ctlRoot.querySelectorAll('input[type=range]').length,
    switches: ctlRoot.querySelectorAll('.lg-switch').length,
    position: getComputedStyle(panel).position,
    rect: (() => { const b = panel.getBoundingClientRect(); return { x: +b.x.toFixed(0), y: +b.y.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0) }; })(),
  } : null;

  try {
    const wrap = $('.wrap');
    if (wrap && panel) {
      const wb = wrap.getBoundingClientRect();
      const pb = panel.getBoundingClientRect();
      out.controls.overlapsContent = wb.right > pb.left + 1;
      out.controls.wrapRight = +wb.right.toFixed(0);
      out.controls.panelLeft = +pb.left.toFixed(0);
    }
  } catch (e) { out.scriptErrors.push(String(e)); }

  const lens = $('lg-lens');
  const lr = lens && lens.shadowRoot;
  if (lr) {
    const cfgEl = lr.querySelector('[data-json]');
    const scene = lr.querySelector('.lg-lens__scene');
    out.lens = {
      width: lens.getAttribute('width'),
      height: lens.getAttribute('height'),
      hasControlsAttr: lens.hasAttribute('controls'),
      panelExists: !!lr.querySelector('.lg-lens__panel'),
      panelRows: lr.querySelectorAll('.lg-lens__prow').length,
      jsonValid: (() => { try { return JSON.parse(cfgEl ? cfgEl.textContent : 'null'); } catch (e) { return String(e); } })(),
      filterInDocument: !!document.querySelector('svg defs filter'),
      sceneFilter: scene ? getComputedStyle(scene).filter : null,
      rect: (() => { const b = lens.getBoundingClientRect(); return { w: +b.width.toFixed(0), h: +b.height.toFixed(0) }; })(),
    };
    try {
      const sl = lr.querySelector('.lg-lens__pslider');
      if (sl) {
        const before = sl.value;
        sl.value = '60';
        sl.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(120);
        const cfg = JSON.parse(cfgEl.textContent);
        out.lens.sliderTest = { key: sl.dataset.k, before, after: sl.value, cfgValue: cfg[sl.dataset.k], jsonUpdated: cfg[sl.dataset.k] === 60 };
      }
    } catch (e) { out.scriptErrors.push('lens slider: ' + String(e)); }
  }

  try {
    const log = $('#eventLog');
    const before = log ? log.textContent : null;
    const sw = ctlRoot && ctlRoot.querySelector('.lg-switch');
    if (sw) { sw.click(); await sleep(80); }
    const sl = ctlRoot && ctlRoot.querySelector('[data-k="spacing"]');
    if (sl) {
      sl.value = '12';
      sl.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(100);
    }
    out.interactions = {
      eventLogChanged: log ? log.textContent !== before : null,
      eventLogTail: log ? log.textContent.trim().slice(-240) : null,
      controlsSwitchToggled: sw ? sw.classList.contains('on') : null,
      spacingValue: sl ? sl.value : null,
    };
  } catch (e) { out.scriptErrors.push(String(e)); }

  const de = document.documentElement;
  out.layout = {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    scrollHeight: de.scrollHeight,
    overflowX: de.scrollWidth > de.clientWidth + 2,
  };

  return out;
}

/* ------------------------------------------------------------------ */
/* Page audit: wc/verify.html (all 15 components)                       */
/* ------------------------------------------------------------------ */
async function pageAuditVerify() {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const shq = (sel, inner) => { try { return $(sel).shadowRoot.querySelector(inner); } catch (e) { return null; } };
  const names = ['lg-button', 'lg-card', 'lg-input', 'lg-select', 'lg-switch', 'lg-badge', 'lg-stat', 'lg-progress', 'lg-tabs', 'lg-tab', 'lg-toast', 'lg-rain', 'lg-grating', 'lg-controls', 'lg-lens'];
  const out = { url: location.href, title: document.title, version: (window.LiquidGlassUI && window.LiquidGlassUI.version) || null, components: {}, interactions: {}, layout: {}, scriptErrors: [] };

  for (const n of names) {
    const els = $$(n);
    out.components[n] = els.map((el) => {
      const b = el.getBoundingClientRect();
      return {
        hasShadow: !!el.shadowRoot,
        display: getComputedStyle(el).display,
        shadowChildren: el.shadowRoot ? el.shadowRoot.children.length : 0,
        w: +b.width.toFixed(0),
        h: +b.height.toFixed(0),
      };
    });
  }

  try {
    const log = $('#eventLog');
    const before = log ? log.textContent : '';
    const btn = shq('#btnPrimary', 'button');
    if (btn) btn.click();
    await sleep(80);
    const dark = shq('#switchDark', '.lg-switch');
    if (dark) dark.click();
    await sleep(80);

    const tabEls = $$('#tabsDemo lg-tab');
    const tabBtns = tabEls.map((t) => t.shadowRoot && t.shadowRoot.querySelector('.lg-tab'));
    if (tabBtns[2]) tabBtns[2].click();
    await sleep(100);

    const p = $('#progressB');
    if (p && p.setValue) p.setValue(37);
    await sleep(40);

    const input = shq('#inputName', 'input');
    if (input) { input.value = '张三'; input.dispatchEvent(new Event('input', { bubbles: true })); }
    await sleep(40);
    const sel = shq('#selectRole', 'select');
    if (sel) { sel.selectedIndex = 0; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    await sleep(60);

    out.interactions = {
      logChanged: log ? log.textContent !== before : null,
      logTail: log ? log.textContent.trim().slice(-260) : null,
      buttonClick: !!(log && log.textContent.includes('lg-click')),
      switchToggle: !!(log && log.textContent.includes('lg-toggle')),
      switchState: $('#switchDark') && $('#switchDark').checked ? $('#switchDark').checked() : null,
      tabActive: tabBtns.map((b) => (b ? b.classList.contains('active') : null)),
      tabSelectEvent: !!(log && log.textContent.includes('lg-tab-select')),
      progressBWidth: (() => { const b = shq('#progressB', '.lg-progress__bar'); return b ? parseFloat(b.style.width) : null; })(),
      inputEvent: !!(log && log.textContent.includes('lg-input')),
      selectChangeEvent: !!(log && log.textContent.includes('lg-change')),
    };
  } catch (e) {
    out.scriptErrors.push(String(e));
  }

  const de = document.documentElement;
  const wide = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('lg-rain') || el.closest('lg-grating')) return;
    const b = el.getBoundingClientRect();
    if (b.width > 0 && b.right > de.clientWidth + 2) {
      wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 50), right: +b.right.toFixed(0) });
    }
  });
  out.layout = {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    scrollHeight: de.scrollHeight,
    horizontalOverflow: de.scrollWidth > de.clientWidth + 2,
    wideElements: wide.slice(0, 10),
  };

  return out;
}

/* ------------------------------------------------------------------ */
/* Page audit: wc/isolated.html (no page CSS — API/behavior contract)   */
/* ------------------------------------------------------------------ */
async function pageAuditIsolated() {
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const out = {
    url: location.href,
    version: (window.LiquidGlassUI && window.LiquidGlassUI.version) || null,
    cssBytes: window.LiquidGlassUI ? window.LiquidGlassUI.css.length : null,
    components: {},
    functional: {},
    events: [],
    exceptions: [],
    reconnect: null,
    attributeUpdate: null,
  };

  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
  const eventTypes = ['lg-click', 'lg-toggle', 'lg-input', 'lg-change', 'lg-tab-select', 'lg-control'];
  eventTypes.forEach((t) => document.addEventListener(t, (e) => out.events.push({
    type: t,
    detail: e.detail || null,
    target: e.target && e.target.tagName ? e.target.tagName.toLowerCase() : null,
  })));

  const sandbox = document.getElementById('sandbox');
  sandbox.insertAdjacentHTML('beforeend', [
    '<lg-button id="i-btn" variant="primary">按钮</lg-button>',
    '<lg-button id="i-btn-disabled" disabled>禁用</lg-button>',
    '<lg-card id="i-card"><span>卡片内容</span></lg-card>',
    '<lg-input id="i-input" placeholder="姓名" value="初始值"></lg-input>',
    '<lg-select id="i-select"><option>一</option><option selected>二</option></lg-select>',
    '<lg-switch id="i-switch" checked>通知</lg-switch>',
    '<lg-badge id="i-badge" variant="success" dot>已通过</lg-badge>',
    '<lg-stat id="i-stat" label="营收" value="¥86.2万" delta="+8.3%" trend="up"></lg-stat>',
    '<lg-progress id="i-progress" value="82" size="lg"></lg-progress>',
    '<lg-tabs id="i-tabs"><lg-tab>概览</lg-tab><lg-tab>图表</lg-tab></lg-tabs>',
    '<lg-toast id="i-toast" type="success">成功</lg-toast>',
    '<lg-rain id="i-rain" density="4"></lg-rain>',
    '<lg-grating id="i-grating" count="8" base="7" opacity="0.45"></lg-grating>',
    '<lg-lens id="i-lens" width="300" height="200"></lg-lens>',
    '<lg-controls id="i-controls"></lg-controls>',
  ].join(''));
  await sleep(250);

  const ids = ['i-btn', 'i-btn-disabled', 'i-card', 'i-input', 'i-select', 'i-switch', 'i-badge', 'i-stat', 'i-progress', 'i-tabs', 'i-toast', 'i-rain', 'i-grating', 'i-lens', 'i-controls'];
  let totalStyleBytes = 0;
  for (const id of ids) {
    const el = document.getElementById(id);
    const sr = el && el.shadowRoot;
    const styles = sr ? Array.from(sr.querySelectorAll('style')).map((s) => s.textContent.length) : [];
    const bytes = styles.reduce((a, c) => a + c, 0);
    totalStyleBytes += bytes;
    const b = el ? el.getBoundingClientRect() : null;
    out.components[id] = {
      tag: el ? el.tagName.toLowerCase() : null,
      upgraded: !!sr,
      hostDisplay: el ? getComputedStyle(el).display : null,
      rect: b ? { w: +b.width.toFixed(1), h: +b.height.toFixed(1) } : null,
      shadowChildren: sr ? sr.children.length : 0,
      styleCount: styles.length,
      styleBytes: bytes,
      firstInnerClass: sr && sr.querySelector('[class]') ? String(sr.querySelector('[class]').className).slice(0, 60) : null,
    };
  }
  out.totalStyleBytes = totalStyleBytes;

  // ---- functional tests ----
  const btnInner = (() => { try { return document.getElementById('i-btn').shadowRoot.querySelector('button'); } catch (e) { return null; } })();
  if (btnInner) { btnInner.click(); await sleep(40); }

  const disabledBefore = out.events.length;
  const disabledInner = (() => { try { return document.getElementById('i-btn-disabled').shadowRoot.querySelector('button'); } catch (e) { return null; } })();
  if (disabledInner) { disabledInner.click(); await sleep(40); }
  const disabledEmitted = out.events.length > disabledBefore;

  const input = document.getElementById('i-input');
  const inputInner = (() => { try { return input.shadowRoot.querySelector('input'); } catch (e) { return null; } })();
  if (inputInner) { inputInner.value = '张三'; inputInner.dispatchEvent(new Event('input', { bubbles: true })); await sleep(40); }

  const select = document.getElementById('i-select');
  const selectInner = (() => { try { return select.shadowRoot.querySelector('select'); } catch (e) { return null; } })();
  if (selectInner) { selectInner.selectedIndex = 0; selectInner.dispatchEvent(new Event('change', { bubbles: true })); await sleep(40); }

  const sw = document.getElementById('i-switch');
  const swInner = (() => { try { return sw.shadowRoot.querySelector('.lg-switch'); } catch (e) { return null; } })();
  if (swInner) { swInner.click(); await sleep(40); }

  const tabEls = Array.from(document.querySelectorAll('#i-tabs lg-tab'));
  const tabBtns = tabEls.map((t) => (t.shadowRoot ? t.shadowRoot.querySelector('.lg-tab') : null));
  if (tabBtns[1]) { tabBtns[1].click(); await sleep(70); }

  const progress = document.getElementById('i-progress');
  if (progress && progress.setValue) { progress.setValue(37); await sleep(30); }

  const rain = document.getElementById('i-rain');
  const rainRoot = rain && rain.shadowRoot;

  const grating = document.getElementById('i-grating');
  const gratingRoot = grating && grating.shadowRoot;
  const gEl = gratingRoot && gratingRoot.querySelector('.lg-grating');
  const gratingBg = gEl ? gEl.style.background : null;
  let gratingToggle = null;
  if (grating && grating.off && grating.on) {
    grating.off();
    const off = gEl.classList.contains('off');
    grating.on();
    const on = !gEl.classList.contains('off');
    gratingToggle = { off, on };
  }

  const lens = document.getElementById('i-lens');
  const lensRoot = lens && lens.shadowRoot;
  const lensScene = lensRoot && lensRoot.querySelector('.lg-lens__scene');
  const lensFilter = document.querySelector('svg defs filter');
  let lensConfig = null;
  if (lens && lens.applyConfig) {
    lens.applyConfig({ displace: 80 });
    await sleep(40);
    lensConfig = lens.CONFIG ? Object.assign({}, lens.CONFIG) : null;
  }
  const dispEl = lensFilter && lensFilter.querySelector('feDisplacementMap');

  const controls = document.getElementById('i-controls');
  const ctlRoot = controls && controls.shadowRoot;
  const ctlSwitch = ctlRoot && ctlRoot.querySelector('.lg-switch');
  const controlBefore = out.events.filter((e) => e.type === 'lg-control').length;
  if (ctlSwitch) { ctlSwitch.click(); await sleep(40); }
  const controlAfter = out.events.filter((e) => e.type === 'lg-control').length;

  // ---- attribute update behavior ----
  input.setAttribute('value', '新值');
  progress.setAttribute('value', '10');
  await sleep(40);
  out.attributeUpdate = {
    inputValueAfterSetAttribute: input.getValue ? input.getValue() : null,
    progressBarAfterSetAttribute: progress.shadowRoot ? progress.shadowRoot.querySelector('.lg-progress__bar').style.width : null,
  };

  // ---- reconnect behavior (custom elements must survive DOM moves) ----
  const btnEl = document.getElementById('i-btn');
  const errBefore = errors.length;
  try { document.body.appendChild(btnEl); } catch (e) { /* recorded via error event */ }
  await sleep(60);
  out.reconnect = { errorsAfterMove: errors.slice(errBefore), stillUpgraded: !!btnEl.shadowRoot };

  out.functional = {
    buttonClickEvent: out.events.some((e) => e.type === 'lg-click'),
    disabledButtonEmitted: disabledEmitted,
    inputEvent: out.events.some((e) => e.type === 'lg-input'),
    selectChangeEvent: out.events.some((e) => e.type === 'lg-change'),
    toggleEvent: out.events.some((e) => e.type === 'lg-toggle'),
    switchCheckedAfterClick: sw && sw.checked ? sw.checked() : null,
    tabActiveStates: tabBtns.map((b) => (b ? b.classList.contains('active') : null)),
    tabSelectEvent: out.events.some((e) => e.type === 'lg-tab-select'),
    progressBarWidth: progress.shadowRoot ? parseFloat(progress.shadowRoot.querySelector('.lg-progress__bar').style.width) : null,
    rain: rainRoot ? {
      drips: rainRoot.querySelectorAll('.drip').length,
      droppers: rainRoot.querySelectorAll('.dropper').length,
      droplets: rainRoot.querySelectorAll('.lg-droplet').length,
      drops: rainRoot.querySelectorAll('.drop').length,
      sprites: rainRoot.querySelectorAll('.sp').length,
    } : null,
    gratingBg: gratingBg ? gratingBg.slice(0, 130) : null,
    gratingToggle,
    lens: lensRoot ? {
      panelExists: !!lensRoot.querySelector('.lg-lens__panel'),
      sceneFilter: lensScene ? getComputedStyle(lensScene).filter : null,
      filterInDocument: !!lensFilter,
      displaceAfterApply: dispEl ? dispEl.getAttribute('scale') : null,
      configAfterApply: lensConfig,
      svgCountInBody: document.querySelectorAll('body > svg').length,
    } : null,
    controls: ctlRoot ? {
      rows: ctlRoot.querySelectorAll('.lg-controls__row').length,
      controlEventEmitted: controlAfter > controlBefore,
      lastControlDetail: (out.events.filter((e) => e.type === 'lg-control').slice(-1)[0] || {}).detail || null,
    } : null,
    selectOptions: select ? {
      lightDomOptions: select.querySelectorAll('option').length,
      internalOptions: selectInner ? selectInner.options.length : null,
    } : null,
    exceptions: errors,
    events: out.events.slice(0, 25),
  };

  return out;
}

/* ------------------------------------------------------------------ */
/* Runner                                                               */
/* ------------------------------------------------------------------ */
const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  chrome: null,
  pages: [],
  summary: {},
  issues: [],
};

function issue(severity, area, message) {
  report.issues.push({ severity, area, message });
}

async function auditPage(cdp, name, url, viewport, fn, shotName, opts = {}) {
  await goto(cdp, url, viewport);
  const rec = { name, url, viewport, screenshot: null, data: null, error: null, issues: null };
  try {
    if (opts.screenshotFirst !== false) rec.screenshot = await screenshot(cdp, path.join(OUT, shotName));
    rec.data = await evaluate(cdp, `(${fn.toString()})()`);
    if (opts.screenshotFirst === false) rec.screenshot = await screenshot(cdp, path.join(OUT, shotName));
  } catch (e) {
    rec.error = String(e.message || e);
  }
  rec.issues = collectIssues(cdp);
  report.pages.push(rec);
  console.log(`\n=== ${name} ===`);
  console.log(`  url: ${url}`);
  console.log(`  viewport: ${viewport.width}x${viewport.height}${viewport.mobile ? ' (mobile)' : ''}`);
  if (rec.error) console.log(`  AUDIT ERROR: ${rec.error}`);
  if (rec.screenshot) console.log(`  screenshot: ${rec.screenshot.file} (${rec.screenshot.width}x${rec.screenshot.height}, ${Math.round(rec.screenshot.bytes / 1024)}KB)`);
  console.log(`  console/exceptions: ${rec.issues.exceptions.length} exceptions, ${rec.issues.console.length} console, ${rec.issues.httpErrors.length} HTTP>=400, ${rec.issues.netFailed.length} net failures`);
  if (rec.data) {
    if (rec.data.viewport) console.log(`  viewport: ${rec.data.viewport.w}x${rec.data.viewport.h}`);
    if (rec.data.layout) console.log(`  layout: overflowX=${rec.data.layout.horizontalOverflow} scrollW=${rec.data.layout.scrollWidth}`);
    if (rec.data.interactions) console.log(`  interactions: ${JSON.stringify(rec.data.interactions).slice(0, 400)}`);
    if (rec.data.functional) console.log(`  functional: ${JSON.stringify(rec.data.functional).slice(0, 600)}`);
  }
  return rec;
}

async function main() {
  const cdp = await connect();
  const version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  report.chrome = { browser: version.Browser, protocol: version['Protocol-Version'] };
  console.log(`Chrome ${version.Browser} / CDP ${version['Protocol-Version']}`);

  for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await cdp.send(`${domain}.enable`);

  const demo = await auditPage(cdp, 'demo.html (desktop)', `${BASE}/demo.html`, { width: 1440, height: 900 }, pageAuditDemo, 'demo-desktop.png');
  const demoMobile = await auditPage(cdp, 'demo.html (mobile)', `${BASE}/demo.html`, { width: 390, height: 844, mobile: true }, pageAuditDemo, 'demo-mobile.png');
  const wcDesktop = await auditPage(cdp, 'wc/test.html (desktop)', `${BASE}/wc/test.html`, { width: 1440, height: 900 }, pageAuditWc, 'wc-test-desktop.png');
  const wcTablet = await auditPage(cdp, 'wc/test.html (tablet 900px)', `${BASE}/wc/test.html`, { width: 900, height: 1000 }, pageAuditWc, 'wc-test-tablet.png');
  const verify = await auditPage(cdp, 'wc/verify.html (desktop)', `${BASE}/wc/verify.html`, { width: 1440, height: 900 }, pageAuditVerify, 'wc-verify-desktop.png');
  const verifyMobile = await auditPage(cdp, 'wc/verify.html (mobile)', `${BASE}/wc/verify.html`, { width: 390, height: 844, mobile: true }, pageAuditVerify, 'wc-verify-mobile.png');
  const isolated = await auditPage(cdp, 'wc/isolated.html', `${BASE}/wc/isolated.html`, { width: 1200, height: 900 }, pageAuditIsolated, 'wc-isolated.png', { screenshotFirst: false });

  /* ---------------- derive issues ---------------- */
  const p = (name) => report.pages.find((x) => x.name.startsWith(name));
  const issuesFor = (rec) => rec && rec.issues;

  for (const rec of report.pages) {
    if (rec.error) issue('error', rec.name, 'audit did not complete: ' + rec.error);
    const iss = rec.issues;
    for (const ex of iss.exceptions) issue('error', rec.name, 'uncaught exception: ' + (ex.desc || ex.text));
    for (const c of iss.console) if (c.type === 'error') issue('error', rec.name, 'console.error: ' + c.args.join(' ').slice(0, 240));
    for (const e of iss.httpErrors) issue('warning', rec.name, `HTTP ${e.status}: ${e.url.split('/').pop()}`);
    for (const n of iss.netFailed) issue('error', rec.name, `request failed: ${n.error} ${n.url.split('/').pop()}`);
  }

  if (demo && demo.data) {
    const d = demo.data;
    if (!d.computed.support.backdropFilter) issue('warning', 'browser', 'backdrop-filter not supported by this browser build');
    if (!d.computed.glass.hasShadow) issue('warning', 'demo.html', '.lg-glass has no box-shadow');
    if (d.layout.horizontalOverflow) issue('warning', 'demo.html (desktop)', `horizontal overflow: scrollWidth ${d.layout.scrollWidth} > clientWidth ${d.layout.clientWidth}`);
    if (d.layout.wideElements.length) issue('warning', 'demo.html (desktop)', 'elements extend past viewport: ' + d.layout.wideElements.map((x) => `${x.cls || x.tag}@${x.right}`).join(', '));
    if (d.layout.hiddenElements.length) issue('warning', 'demo.html', 'zero-size visible elements: ' + d.layout.hiddenElements.map((x) => x.sel).join(', '));
    if (d.interactions.tabs && d.interactions.tabs.activeIndex !== 1) issue('error', 'demo.html', 'tab click did not activate the clicked tab');
    if (d.interactions.tabs && !/图表/.test(d.interactions.tabs.panel || '')) issue('error', 'demo.html', 'tab panel text did not switch');
    if (d.interactions.dropdownOpen !== true) issue('error', 'demo.html', 'dropdown did not open');
    if (d.interactions.dropdownClosed !== true) issue('error', 'demo.html', 'dropdown did not close on outside click');
    if (!d.interactions.toasts || d.interactions.toasts.length !== 2) issue('error', 'demo.html', 'toasts did not appear');
    if (!d.interactions.switchToggle || d.interactions.switchToggle.before === d.interactions.switchToggle.after) issue('error', 'demo.html', 'switch did not toggle');
    const pct = d.interactions.progressPercents || [];
    if (pct.length !== 3 || pct.some((v) => v === null || v < 1)) issue('error', 'demo.html', 'progress bars not sized: ' + JSON.stringify(pct));
    if (d.a11y.labelableMissingName.length) issue('warning', 'demo.html', 'form controls without accessible name: ' + d.a11y.labelableMissingName.map((x) => x.tag + '.' + x.cls).join(', '));
    if (d.a11y.hasReducedMotionRule === false) issue('warning', 'demo.html', 'no prefers-reduced-motion CSS rule found');
  }

  if (demoMobile && demoMobile.data) {
    const d = demoMobile.data;
    if (d.layout.horizontalOverflow) issue('error', 'demo.html (mobile)', `horizontal overflow at 390px: scrollWidth ${d.layout.scrollWidth}`);
    if (d.layout.wideElements.length) issue('warning', 'demo.html (mobile)', 'elements past right edge: ' + d.layout.wideElements.map((x) => `${x.cls || x.tag}@${x.right}`).join(', '));
    if (d.a11y && d.a11y.labelableMissingName && d.a11y.labelableMissingName.length) {
      issue('warning', 'demo.html (mobile)', 'form controls without accessible name: ' + d.a11y.labelableMissingName.map((x) => x.tag + '.' + x.cls).join(', '));
    }
  }

  if (wcDesktop && wcDesktop.data) {
    const d = wcDesktop.data;
    const missingDefs = Object.entries(d.componentDefs).filter(([, v]) => !v).map(([k]) => k);
    if (missingDefs.length) issue('error', 'wc/test.html', 'custom elements not defined: ' + missingDefs.join(', '));
    const badUpgrades = Object.entries(d.upgrades).filter(([, v]) => !v.hasShadow).map(([k]) => k);
    if (badUpgrades.length) issue('error', 'wc/test.html', 'components failed to upgrade: ' + badUpgrades.join(', '));
    if (d.missingOnPage.length) issue('info', 'wc/test.html', 'components not exercised on this page: ' + d.missingOnPage.join(', ') + ' (covered by wc/verify.html)');
    for (const r of d.rain) {
      if (r.drips < 2) issue('error', 'wc/test.html', `lg-rain density=${r.density} rendered ${r.drips} drips`);
    }
    if (d.grating && !d.grating.bg) issue('error', 'wc/test.html', 'lg-grating has no background gradient');
    if (d.controls && d.controls.overlapsContent) issue('error', 'wc/test.html', `fixed controls overlap content: content right ${d.controls.wrapRight}px > panel left ${d.controls.panelLeft}px at 1440px`);
    if (d.lens) {
      if (!d.lens.panelExists) issue('error', 'wc/test.html', 'lg-lens controls panel missing');
      if (!d.lens.filterInDocument) issue('error', 'wc/test.html', 'lg-lens SVG filter missing from document');
      if (!/url\(/.test(d.lens.sceneFilter || '')) issue('error', 'wc/test.html', 'lg-lens scene filter not applied: ' + d.lens.sceneFilter);
      if (d.lens.panelRows !== 7) issue('warning', 'wc/test.html', `lg-lens panel has ${d.lens.panelRows} slider rows (expected 7)`);
      if (d.lens.sliderTest && !d.lens.sliderTest.jsonUpdated) issue('error', 'wc/test.html', 'lg-lens slider did not update JSON config');
    }
    if (d.interactions.eventLogChanged !== true) issue('error', 'wc/test.html', 'lg-control events did not update the event log');
    if (d.layout.overflowX) issue('warning', 'wc/test.html', 'horizontal overflow at 1440px');
  }

  if (wcTablet && wcTablet.data) {
    const d = wcTablet.data;
    if (d.controls && d.controls.overlapsContent) issue('error', 'wc/test.html (tablet 900px)', `fixed controls overlap content: content right ${d.controls.wrapRight}px > panel left ${d.controls.panelLeft}px`);
    if (d.layout.overflowX) issue('warning', 'wc/test.html (tablet 900px)', 'horizontal overflow');
  }

  if (verify && verify.data) {
    const d = verify.data;
    const missing = Object.entries(d.components).filter(([, list]) => list.length === 0).map(([k]) => k);
    if (missing.length) issue('error', 'wc/verify.html', 'components missing: ' + missing.join(', '));
    const notUpgraded = [];
    for (const [tag, list] of Object.entries(d.components)) {
      for (const c of list) if (!c.hasShadow) notUpgraded.push(tag);
    }
    if (notUpgraded.length) issue('error', 'wc/verify.html', 'components without shadow root: ' + Array.from(new Set(notUpgraded)).join(', '));
    const it = d.interactions || {};
    if (!it.buttonClick) issue('error', 'wc/verify.html', 'lg-button did not emit lg-click');
    if (!it.switchToggle || it.switchState !== true) issue('error', 'wc/verify.html', 'lg-switch did not emit lg-toggle / did not switch on');
    if (!it.tabSelectEvent || !(it.tabActive || []).includes(true)) issue('error', 'wc/verify.html', 'lg-tabs did not activate clicked tab');
    if (it.progressBWidth !== 37) issue('error', 'wc/verify.html', 'lg-progress.setValue did not resize bar: ' + it.progressBWidth);
    if (!it.inputEvent) issue('error', 'wc/verify.html', 'lg-input did not emit lg-input');
    if (!it.selectChangeEvent) issue('error', 'wc/verify.html', 'lg-select did not emit lg-change');
    if (d.layout.horizontalOverflow) issue('warning', 'wc/verify.html (desktop)', 'horizontal overflow: ' + d.layout.scrollWidth);
    if (d.scriptErrors.length) issue('error', 'wc/verify.html', 'script errors: ' + d.scriptErrors.join(' | '));
  }

  if (verifyMobile && verifyMobile.data) {
    const d = verifyMobile.data;
    if (d.layout.horizontalOverflow) issue('error', 'wc/verify.html (mobile)', 'horizontal overflow at 390px: ' + d.layout.scrollWidth);
    if (d.layout.wideElements.length) issue('warning', 'wc/verify.html (mobile)', 'elements past right edge: ' + d.layout.wideElements.map((x) => `${x.cls || x.tag}@${x.right}`).join(', '));
  }

  if (isolated && isolated.data) {
    const d = isolated.data;
    const notUpgraded = Object.entries(d.components).filter(([, c]) => !c.upgraded).map(([id]) => id);
    if (notUpgraded.length) issue('error', 'wc/isolated.html', 'components failed to upgrade: ' + notUpgraded.join(', '));
    const f = d.functional || {};
    if (!f.buttonClickEvent) issue('error', 'wc/isolated.html', 'lg-button: no lg-click');
    if (f.disabledButtonEmitted) issue('error', 'wc/isolated.html', 'disabled lg-button still emitted lg-click');
    if (!f.inputEvent) issue('error', 'wc/isolated.html', 'lg-input: no lg-input');
    if (!f.selectChangeEvent) issue('error', 'wc/isolated.html', 'lg-select: no lg-change');
    if (!f.toggleEvent) issue('error', 'wc/isolated.html', 'lg-switch: no lg-toggle');
    if (f.progressBarWidth !== 37) issue('error', 'wc/isolated.html', 'lg-progress.setValue failed: ' + f.progressBarWidth);
    if (!f.tabSelectEvent) issue('error', 'wc/isolated.html', 'lg-tabs: no lg-tab-select');
    if (f.rain && f.rain.drips !== 4) issue('error', 'wc/isolated.html', 'lg-rain density=4 rendered ' + f.rain.drips + ' drips');
    if (!f.gratingBg) issue('error', 'wc/isolated.html', 'lg-grating: no background');
    if (f.gratingToggle && (!f.gratingToggle.off || !f.gratingToggle.on)) issue('error', 'wc/isolated.html', 'lg-grating off()/on() failed');
    if (!f.lens || !f.lens.filterInDocument) issue('error', 'wc/isolated.html', 'lg-lens SVG filter missing');
    if (f.lens && f.lens.displaceAfterApply !== '80') issue('error', 'wc/isolated.html', 'lg-lens applyConfig did not update feDisplacementMap: ' + (f.lens && f.lens.displaceAfterApply));
    if (!f.controls || !f.controls.controlEventEmitted) issue('error', 'wc/isolated.html', 'lg-controls did not emit lg-control');
    if (!d.attributeUpdate.inputValueAfterSetAttribute === '新值' || d.attributeUpdate.inputValueAfterSetAttribute !== '新值') {
      issue('warning', 'wc/isolated.html', 'lg-input: setting value attribute after upgrade does not update the input (no observedAttributes)');
    }
    if (d.attributeUpdate.progressBarAfterSetAttribute !== '10%') {
      issue('warning', 'wc/isolated.html', `lg-progress: setting value attribute after upgrade does not update bar (${d.attributeUpdate.progressBarAfterSetAttribute}) — no observedAttributes`);
    }
    if (d.reconnect && d.reconnect.errorsAfterMove && d.reconnect.errorsAfterMove.length) {
      issue('error', 'wc/isolated.html', 're-inserting a component throws (connectedCallback calls attachShadow twice): ' + d.reconnect.errorsAfterMove.slice(0, 2).join(' | '));
    }
    const inlineHosts = Object.entries(d.components).filter(([, c]) => c.hostDisplay === 'inline' && ['lg-card', 'lg-stat', 'lg-tabs', 'lg-rain', 'lg-grating', 'lg-lens'].includes(c.tag)).map(([, c]) => c.tag);
    if (inlineHosts.length) issue('warning', 'wc/liquidglass-ui.js', 'host elements default to display:inline (no :host layout rule): ' + Array.from(new Set(inlineHosts)).join(', '));
    if (d.functional.selectOptions && d.functional.selectOptions.lightDomOptions > 0) {
      issue('info', 'wc/liquidglass-ui.js', `lg-select leaves ${d.functional.selectOptions.lightDomOptions} <option> nodes in the light DOM (hidden duplicates)`);
    }
    if (d.totalStyleBytes > 0) {
      issue('info', 'wc/liquidglass-ui.js', `${d.components && Object.keys(d.components).length} component instances inject ${Math.round(d.totalStyleBytes / 1024)}KB of <style> CSS total (~${Math.round(d.totalStyleBytes / Object.keys(d.components).length / 1024)}KB each); adoptedStyleSheets would share it`);
    }
    if (d.functional.lens && d.functional.lens.svgCountInBody > 0) {
      issue('info', 'wc/liquidglass-ui.js', `lg-lens appends ${d.functional.lens.svgCountInBody} SVG filter(s) to document.body and never removes them`);
    }
    if (d.functional.exceptions && d.functional.exceptions.length) {
      issue('warning', 'wc/isolated.html', 'isolated page errors: ' + d.functional.exceptions.join(' | '));
    }
  }

  report.summary = {
    pagesAudited: report.pages.length,
    screenshots: report.pages.map((x) => x.screenshot && x.screenshot.file).filter(Boolean),
    issueCounts: {
      error: report.issues.filter((i) => i.severity === 'error').length,
      warning: report.issues.filter((i) => i.severity === 'warning').length,
      info: report.issues.filter((i) => i.severity === 'info').length,
    },
    consoleErrors: report.pages.reduce((a, x) => a + x.issues.exceptions.length + x.issues.console.length + x.issues.netFailed.length, 0),
  };

  fs.writeFileSync(path.join(OUT, '..', 'verify-report.json'), JSON.stringify(report, null, 2));
  console.log('\n===================== SUMMARY =====================');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('\nIssues:');
  for (const i of report.issues) console.log(`  [${i.severity}] ${i.area}: ${i.message}`);
  console.log('\nReport: verify-report.json');
  console.log('Screenshots: ' + OUT);

  cdp.ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL: ' + (e && e.stack || e));
  process.exitCode = 1;
});
