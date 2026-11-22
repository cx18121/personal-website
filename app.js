import { terminalRow } from './components/terminal-list.js';
import { createCommandSuggestions } from './components/command-suggestions.js';
import { createPhotoViewer, thumbSrcFor } from './components/photo-viewer.js';
import { escapeHtml, setOverlayTitle } from './components/dom.js';
import {
  PROJECTS,
  TRAVELS,
  ABOUT,
  CONTACT,
  COMMANDS,
  THEMES,
} from './data.js';

const REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
// Scroll behavior for JS-driven scrolls; CSS scroll-behavior doesn't
// reach scrollTo()/scrollIntoView() options.
function scrollBehavior() {
  return REDUCE_MOTION.matches ? 'instant' : 'smooth';
}

// Copies `data-copy` text and flashes a status in the adjacent `.copy-status`.
async function copyToClipboard(el) {
  const status = el.nextElementSibling;
  const show = (msg, cls) => {
    if (!status?.classList.contains('copy-status')) return;
    status.textContent = `  ${msg}`;
    status.classList.toggle('warn', cls === 'warn');
    status.classList.add('show');
    clearTimeout(status._t);
    status._t = setTimeout(() => status.classList.remove('show'), 1600);
  };
  try {
    await navigator.clipboard.writeText(el.dataset.copy);
    show('copied');
  } catch {
    show('select and copy manually', 'warn');
  }
}

// Levenshtein-based "did you mean" suggestion across known commands + project names.
function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  return dp[m][n];
}
function closestCommand(name) {
  const travelNames = TRAVELS.map((t) => t.name);
  const candidates = COMMANDS.map((c) => c.cmd.slice(1))
    .concat(PROJECTS.map((p) => p.name))
    .concat(travelNames);
  let best = null,
    bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(name, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  // Only suggest if reasonably close.
  if (bestD <= Math.max(2, Math.floor(name.length / 2))) {
    if (PROJECTS.some((p) => p.name === best)) return '/open ' + best;
    if (travelNames.includes(best)) return '/travels ' + best;
    return '/' + best;
  }
  return null;
}

function applyTheme(t) {
  document.body.dataset.theme = t.name;
  // Theme pickers remain live in scrollback, unlike change confirmations.
  for (const row of document.querySelectorAll('.theme-row')) {
    row.querySelector('.theme-active').hidden =
      row.querySelector('[data-theme]').dataset.theme !== t.name;
  }
  const root = document.documentElement;
  root.classList.add('switching-theme');
  const r = root.style;
  r.setProperty('--bg', t.bg);
  r.setProperty('--fg', t.fg);
  r.setProperty('--accent', t.accent);
  r.setProperty('--dim', t.dim);
  r.setProperty('--mute', t.mute);
  r.setProperty('--red', t.red);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  void getComputedStyle(root).backgroundColor;
  root.classList.remove('switching-theme');
  try {
    localStorage.setItem('theme', t.name);
  } catch {}
}

// Path-based routing. The site has shareable URLs like /projects,
// /travels/peru, /projects/spectre — Cloudflare Pages serves index.html
// for every unknown path (see /_redirects) and we dispatch the matching
// command on init.
const STATIC_ROUTES = new Set([
  '/about', '/projects', '/contact', '/travels', '/theme', '/help',
]);
function pathToCommand(pathname) {
  const p = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1) : pathname;
  if (p === '' || p === '/') return null;
  if (STATIC_ROUTES.has(p)) return p;
  const m = p.match(/^\/(projects|travels)\/([^/]+)$/);
  if (m) {
    const cmd = m[1] === 'projects' ? 'open' : 'travels';
    // decodeURIComponent throws on malformed sequences (e.g. /projects/%ZZ
    // from a scanner probe). Fall through to null rather than crash init.
    try {
      return `/${cmd} ${decodeURIComponent(m[2])}`;
    } catch {
      return null;
    }
  }
  return null;
}
function readerIndex(kind) {
  return kind === 'project' ? '/projects' : '/travels';
}
function readerPath(kind, name) {
  return `${readerIndex(kind)}/${encodeURIComponent(name)}`;
}

// Restore a previously-chosen theme on load. No-op (and the default stays) if
// nothing is stored or the name is unknown. Runs at module top, before
// ui.init(), so the right palette is on screen before any panel renders.
(function restoreTheme() {
  try {
    const t = THEMES.find((x) => x.name === localStorage.getItem('theme'));
    if (t) applyTheme(t);
  } catch {}
})();

const ui = {
  main: null,
  input: null,
  box: null,
  history: [],
  histIdx: -1,
  init() {
    this.home = document.getElementById('home');
    this.route = document.getElementById('route-output');
    this.main = document.getElementById('command-output');
    this.status = document.getElementById('command-status');
    this.input = document.getElementById('input');
    this.box = document.getElementById('promptbox');
    this.suggestions = createCommandSuggestions({
      root: document.getElementById('ac'),
      input: this.input,
      anchor: this.box,
      scroller: document.getElementById('scrollarea'),
      onChoose: (command) => this.submitCommand(command),
    });
    this.input.addEventListener('input', () => {
      // A long output leaves the prompt below the fold; typing brings the
      // whole box back. The browser alone only reveals the caret line, and
      // its instant scroll cuts a smooth one short, so match it.
      this.box.parentElement.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      this.updateAutocomplete();
    });
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('focus', () =>
      this.box.classList.add('focused')
    );
    this.input.addEventListener('blur', () => {
      this.box.classList.remove('focused');
      this.suggestions.close();
    });
    // Clicking dead space returns focus to the prompt, but only after the
    // mouse is released with nothing selected, so drag-to-select on the
    // output still works. `selecting` holds the prompt's focused look
    // through the drag so the border doesn't flash.
    const passthrough =
      'a, input, textarea, button, .autocomplete, [data-open], [data-travels], .reader, .photoviewer';
    let pendingRefocus = false;
    document.body.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest(passthrough)) return;
      pendingRefocus = true;
      if (document.activeElement === this.input) this.box.classList.add('selecting');
    });
    document.addEventListener('mouseup', (e) => {
      this.box.classList.remove('selecting');
      if (!pendingRefocus) return;
      pendingRefocus = false;
      if (e.target.closest?.(passthrough)) return;
      if (getSelection().isCollapsed) this.input.focus();
    });
    document.body.addEventListener('click', (e) => {
      const readerLink = e.target.closest('a[data-open], a[data-travels]');
      if (readerLink) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const adapter = readerLink.hasAttribute('data-open') ? projectReader : travelReader;
        const name = readerLink.getAttribute(adapter.dataAttr);
        e.preventDefault();
        const trigger = document.activeElement === this.input && !e.detail ? this.input : readerLink;
        tryOpenReader(adapter, name, { trigger, pointerOpen: e.detail > 0 });
        return;
      }
      const themer = e.target.closest('a[data-theme]');
      if (themer) {
        e.preventDefault();
        this.run('/theme ' + themer.dataset.theme);
        return;
      }
      const copier = e.target.closest('[data-copy]');
      if (copier) {
        copyToClipboard(copier);
        return;
      }
      const runner = e.target.closest('a[data-run]');
      if (runner && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        this.run(runner.dataset.run);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || document.getElementById('scrollarea').inert) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      this.input.focus();
      this.input.value = '/';
      this.updateAutocomplete();
    });
    const [command, entryName] = (pathToCommand(location.pathname) || '').split(' ');
    const adapter = entryName ? (command === '/open' ? projectReader : travelReader) : null;
    if (adapter) {
      this.showRoute(readerIndex(adapter.kind));
      const trigger = Array.from(this.route.querySelectorAll(`a[${adapter.dataAttr}]`))
        .find(link => link.getAttribute(adapter.dataAttr) === entryName);
      tryOpenReader(adapter, entryName, { trigger, historyMode: 'deep' });
    } else if (command) {
      this.showRoute(command);
    } else {
      this.landing();
      if (!matchMedia('(pointer: coarse)').matches) this.input.focus({ preventScroll: true });
    }
    // Tab-away blurs the input; nothing refocuses on return, so all the
    // keydown handlers (incl. list nav) silently die. Reclaim focus on
    // window-focus and visibility-restore. Coarse-pointer devices opt out
    // to avoid yanking the soft keyboard up on mobile tab-switch.
    if (!matchMedia('(pointer: coarse)').matches) {
      const refocus = () => {
        if (document.visibilityState !== 'visible') return;
        // Skip if user is interacting with another focusable element
        // (the reader, photoviewer, or any link/button).
        const ae = document.activeElement;
        if (ae && ae !== document.body && ae !== this.input) return;
        if (ae === this.input || !this.route.firstElementChild) this.input.focus({ preventScroll: true });
      };
      window.addEventListener('focus', refocus);
      document.addEventListener('visibilitychange', refocus);
    }
    // Pull marked.js in the background so the first reader open renders on
    // the next frame instead of waiting on a script load.
    if (typeof requestIdleCallback === 'function') requestIdleCallback(loadMarked);
    else setTimeout(loadMarked, 1000);
  },
  // Output goes into the current turn (opened by echo). Each print keeps
  // the turn's echo at the top of the viewport rather than pinning the
  // tail of the output to the bottom, so a long list is read from its
  // command down. scrollIntoView clamps when the turn is short and works
  // whether .scrollarea or the window is the scroller (mobile).
  print(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    (this._routeTarget || this._turn || this.main).appendChild(div);
    if (!this._routeTarget) (this._turn || div).scrollIntoView({ block: 'start', behavior: 'instant' });
    return div;
  },
  echo(cmd) {
    this._turn = document.createElement('div');
    this._turn.className = 'turn';
    this.main.appendChild(this._turn);
    this.print(`<div class="echo" translate="no"><span class="chev" aria-hidden="true">›</span> ${escapeHtml(cmd)}</div>`);
  },
  block(html) {
    const el = this.print(`<div class="block">${html}</div>`);
    smartenTextNodes(el);
    return el;
  },
  updateAutocomplete() {
    const v = this.input.value;
    if (!v.startsWith('/')) {
      this.suggestions.close();
      return;
    }
    let matches;
    // Second-arg autocomplete: after `/open `, show project names.
    const openMatch = v.match(/^\/open(?:\s+(\S*))?$/);
    const themeMatch = v.match(/^\/theme(?:\s+(\S*))?$/);
    const travelMatch = v.match(/^\/travels(?:\s+(\S*))?$/);
    if (openMatch && v.includes(' ')) {
      const q = (openMatch[1] || '').toLowerCase();
      matches = PROJECTS.filter((p) => p.name.toLowerCase().startsWith(q)).map(
        (p) => ({ cmd: '/open ' + p.name, desc: p.tagline || '' })
      );
    } else if (themeMatch && v.includes(' ')) {
      const q = (themeMatch[1] || '').toLowerCase();
      matches = THEMES.filter((t) => t.name.toLowerCase().startsWith(q)).map(
        (t) => ({ cmd: '/theme ' + t.name, desc: t.desc || '' })
      );
    } else if (travelMatch && v.includes(' ')) {
      const q = (travelMatch[1] || '').toLowerCase();
      matches = TRAVELS.filter((trip) => trip.name.toLowerCase().startsWith(q))
        .map((trip) => ({ cmd: '/travels ' + trip.name, desc: tripDate(trip) }));
    } else {
      const q = v.slice(1).toLowerCase();
      matches = COMMANDS.filter((c) => c.cmd.slice(1).startsWith(q));
    }
    this.suggestions.show(matches);
  },
  submitCommand(value) {
    this.input.value = '';
    this.suggestions.close();
    this.run(value);
  },
  onKey(e) {
    // Only the topmost overlay handles keys while a reader is open.
    const reader = document.getElementById('reader');
    const pv = document.getElementById('photoviewer');
    if ((reader && !reader.hidden) || (pv && !pv.hidden)) {
      if (!e.metaKey && !e.ctrlKey) e.preventDefault();
      return;
    }
    const selected = this.suggestions.selected;
    const acOpen = selected !== undefined;
    const inputEmpty = !this.input.value;
    // ↑↓ navigate the most-recent rendered list when input is empty.
    // ↑ at row 0 falls through to history (boundary leak — the list hint
    // surfaces this so it isn't a hidden trick). ↓ at the last row no-ops.
    const listNav = inputEmpty && _activeList && !acOpen;
    if (e.key === 'ArrowDown' && acOpen) {
      e.preventDefault();
      this.suggestions.move(1);
    } else if (e.key === 'ArrowUp' && acOpen) {
      e.preventDefault();
      this.suggestions.move(-1);
    } else if (e.key === 'ArrowDown' && listNav) {
      e.preventDefault();
      if (_activeList.idx < _activeList.rows.length - 1) moveActiveList(1);
    } else if (e.key === 'ArrowUp' && listNav && _activeList.idx > 0) {
      e.preventDefault();
      moveActiveList(-1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.history.length) return;
      this.histIdx = Math.max(
        0,
        this.histIdx === -1 ? this.history.length - 1 : this.histIdx - 1
      );
      this.input.value = this.history[this.histIdx] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.histIdx === -1) return;
      this.histIdx++;
      if (this.histIdx >= this.history.length) {
        this.histIdx = -1;
        this.input.value = '';
      } else this.input.value = this.history[this.histIdx];
    } else if (e.key === 'Tab' && acOpen && !e.shiftKey && this.input.value.trim() !== selected) {
      e.preventDefault();
      this.input.value = selected + ' ';
      this.updateAutocomplete();
    } else if (e.key === 'Enter') {
      if (inputEmpty && !acOpen && _activeList?.idx >= 0) {
        e.preventDefault();
        activateActiveList();
        return;
      }
      this.submitCommand(acOpen ? selected : this.input.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (acOpen) {
        this.suggestions.close();
      } else if (this.input.value) {
        this.input.value = '';
      }
      // Empty input + no autocomplete: esc is a no-op. The CLI is keyboard-
      // first; blurring strands subsequent keypresses (incl. list-nav ↑↓).
    }
  },
  showRoute(command) {
    const heading = document.createElement('h1');
    heading.className = 'route-title';
    heading.textContent = command;
    heading.translate = false;
    heading.tabIndex = -1;
    this.route.replaceChildren(heading);
    this._routeTarget = this.route;
    try {
      commandHandlers[command.slice(1)](this, []);
    } finally {
      this._routeTarget = null;
    }
  },
  announce(message) {
    this.status.textContent = message;
  },
  // The bio isn't part of the terminal's scrollback.
  landing() {
    const paragraphs = ABOUT.split('\n\n').map(text => `<p>${escapeHtml(text)}</p>`).join('');
    const links = ['/projects', '/contact'].map(cmd => `<a href="${cmd}" translate="no">${cmd}</a>`).join('<span aria-hidden="true">·</span>');
    this.home.innerHTML = `<section class="home-intro" aria-label="About Charlie">${paragraphs}</section><nav class="home-links" aria-label="Explore">${links}</nav>`;
    smartenTextNodes(this.home.querySelector('.home-intro'));
  },
  run(raw) {
    const cmd = (raw || '').trim();
    if (!cmd) return;
    this.announce('');
    this.history.push(cmd);
    this.histIdx = -1;
    const norm = cmd.startsWith('/') ? cmd.slice(1) : cmd;
    const [name, ...args] = norm.split(/\s+/);
    if (name !== 'clear') this.echo(raw);

    // Drop the list highlight unless this command is "drill into the list"
    // (open/travels/theme with an argument). Those route through the body
    // click delegate when activating a row, and clearing here would kill
    // the list before the user has a chance to esc back to it.
    const isDrillIn =
      (name === 'open' || name === 'travels' || name === 'theme') &&
      args.length > 0;
    if (!isDrillIn) clearActiveList();

    const handler = commandHandlers[name];
    if (handler) {
      const summary = handler(this, args);
      if (summary) this.announce(summary);
      return;
    }

    const suggestion = closestCommand(name);
    this.announce(suggestion ? `${name}: command not found. Did you mean ${suggestion}?` : `${name}: command not found. Try /help.`);
    if (suggestion) {
      this.block(
        `<span class="warn">${escapeHtml(name)}: command not found</span>. did you mean <span class="key">${suggestion}</span>?`
      );
    } else {
      this.block(
        `<span class="warn">${escapeHtml(name)}: command not found</span>. try <a class="key" data-run="/help" href="/help">/help</a>.`
      );
    }
  },
};

// ── Active list (keyboard nav) ───────────────────────────────────
// The most-recently rendered selectable list (projects/themes/travels) gets
// ↑↓ + ⏎ + esc when the input is empty. Replaced on every command run; only
// one list is "live" at a time. Activation programmatic-clicks the row's
// link, which the body click delegate already routes to the right command.
let _activeList = null; // { rows: HTMLElement[], idx: number }

function attachListNav(rows) {
  clearActiveList();
  if (!rows.length) return;
  _activeList = { rows, idx: -1 };
}
function moveActiveList(d) {
  if (!_activeList) return;
  const { rows } = _activeList;
  const i = Math.max(0, Math.min(rows.length - 1, _activeList.idx + d));
  if (i === _activeList.idx) return;
  rows[_activeList.idx]?.classList.remove('list-active');
  _activeList.idx = i;
  rows[i].classList.add('list-active');
  rows[i].scrollIntoView({ block: 'nearest' });
}
function activateActiveList() {
  if (!_activeList) return false;
  const row = _activeList.rows[_activeList.idx];
  const link = row?.querySelector('[data-open], [data-travels], [data-theme]');
  if (link) link.click();
  return true;
}
function clearActiveList() {
  if (!_activeList) return false;
  _activeList.rows.forEach((r) => r.classList.remove('list-active'));
  _activeList = null;
  return true;
}

// ── Command view renderers ───────────────────────────────────────
// Free functions called by command handlers. Co-located with their
// command, not with the input-handling `ui` object. Each takes the
// ui sink and produces a `ui.block(...)` of rendered HTML.

function tripDate({ month, endMonth, year }) {
  return `${month}${endMonth ? `–${endMonth}` : ''} ${year}`;
}

function renderTravelsList(ui) {
  const rows = TRAVELS.map(trip => terminalRow({
    className: 'travel-row', label: trip.name, href: readerPath('travel', trip.name), action: 'travels', value: trip.name, wholeRow: true,
    after: `<span class="row-meta">${escapeHtml(tripDate(trip))}</span>`,
  }));
  const wrap = ui.block(rows.join(''));
  attachListNav([...wrap.querySelectorAll('.travel-row')]);
  return `${TRAVELS.length} trips listed.`;
}

// ── markdown reader ──────────────────────────────────────────────
// Parses /content/projects/{name}.md (frontmatter + body) and renders
// into the reader modal. Project screenshots use plain markdown image syntax; click any to open
// the photoviewer at full-screen (see attachProjectPhotoHandlers below).
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  let curKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const listMatch = raw.match(/^\s+-\s+(.+)$/);
    const kvMatch = raw.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (listMatch && curKey) {
      if (!Array.isArray(fm[curKey])) fm[curKey] = [];
      fm[curKey].push(listMatch[1].trim());
    } else if (kvMatch) {
      curKey = kvMatch[1];
      fm[curKey] = kvMatch[2].trim();
    }
  }
  return { fm, body: m[2] };
}

// Image-path resolver. Short paths (no slash, no http) in project markdown
// expand to `{imageBase}/{path}`, with a `.webp` default ext. The base is
// scoped to a single renderMarkdown() call below — never set from outside
// this module. Safe because marked.parse is synchronous.
let _currentImageBase = null;
let _currentImageAspect = null; // frontmatter `aspect`, e.g. "1770 / 1125"
let _figureCount = 0;
function resolveImagePath(href) {
  if (!href) return href;
  if (/^(https?:|data:|\/)/.test(href) || href.includes('/')) return href;
  if (!_currentImageBase) return href;
  const withExt = /\.[a-z0-9]+$/i.test(href) ? href : `${href}.webp`;
  return `${_currentImageBase}/${withExt}`;
}

let _markedPromise = null;
function loadMarked() {
  if (typeof marked !== 'undefined') return Promise.resolve();
  if (_markedPromise) return _markedPromise;
  _markedPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = '/vendor/marked.min.js';
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
  return _markedPromise;
}

let _markedConfigured = false;
function configureMarked() {
  if (_markedConfigured) return;
  if (typeof marked === 'undefined') return;
  marked.use({
    renderer: {
      // Marked v12 calls this with positional args (href, title, text), but
      // the API has also drifted to passing a token object in some versions.
      // Accept either shape so the renderer stays stable across upgrades.
      image(hrefOrToken, title, text) {
        let href, alt, cap;
        if (hrefOrToken && typeof hrefOrToken === 'object') {
          href = hrefOrToken.href;
          title = hrefOrToken.title || '';
          alt = hrefOrToken.text || '';
        } else {
          href = hrefOrToken;
          alt = text || '';
          title = title || '';
        }
        cap = title || alt;
        const resolved = resolveImagePath(href || '');
        // First figure is above the fold; the rest can wait.
        const loading = _figureCount++ === 0 ? 'eager' : 'lazy';
        const style = _currentImageAspect
          ? ` style="aspect-ratio: ${escapeHtml(_currentImageAspect)}"`
          : '';
        return `<figure class="full-bleed">
          <img src="${escapeHtml(resolved)}" alt="${escapeHtml(alt)}" loading="${loading}" decoding="async"${style} />
          ${cap ? `<figcaption>${escapeHtml(cap)}</figcaption>` : ''}
        </figure>`;
      },
    },
  });
  _markedConfigured = true;
}

// Typographic punctuation for rendered prose. Runs over text nodes only,
// skipping code, so hrefs and identifiers are never touched. Straight
// quotes in a serif body are the most visible sign of unedited text.
function smartenText(t) {
  return t
    .replace(/(\w)'(\w)/g, '$1\u2019$2')                 // it's, don't
    .replace(/(^|[\s(\[\u2014])'/g, '$1\u2018')            // opening single
    .replace(/'/g, '\u2019')                                // closing single
    .replace(/(^|[\s(\[\u2014])"/g, '$1\u201c')            // opening double
    .replace(/"/g, '\u201d')                                // closing double
    .replace(/\.\.\./g, '\u2026')
    .replace(/(\d[km]?)\s(k|m|ft|days?|million|CVEs|ticks|views|reviews|neighborhoods)\b/g, '$1\u00a0$2');
}
function smartenTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement.closest('code, pre') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = smartenText(n.nodeValue);
    if (s !== n.nodeValue) n.nodeValue = s;
  }
}

// Single entry point for parsing reader-body markdown. `imageBase` (e.g.
// `images/foo`) makes bare image hrefs resolve to that directory; pass
// nothing when relative image expansion isn't wanted (travel entries).
function renderMarkdown(body, { imageBase = null, imageAspect = null } = {}) {
  configureMarked();
  if (typeof marked === 'undefined') return escapeHtml(body);
  _currentImageBase = imageBase;
  _currentImageAspect = imageAspect;
  _figureCount = 0;
  try {
    return marked.parse(body);
  } finally {
    _currentImageBase = null;
    _currentImageAspect = null;
  }
}

// Sidebar rows are key/value pairs; `.item` children stack on desktop and
// flow inline on narrow screens (see the 720px rules in styles.css).
function sidebarRow(label, items) {
  const val = items.map((i) => `<span class="item">${i}</span>`).join('');
  return `<div class="row"><div class="label">${label}</div><div class="val">${val}</div></div>`;
}

function renderSidebar(fm) {
  const rows = [];
  if (fm.shipped) rows.push(sidebarRow('shipped', [escapeHtml(fm.shipped)]));
  if (Array.isArray(fm.stack) && fm.stack.length)
    rows.push(sidebarRow('stack', fm.stack.map(escapeHtml)));
  const link = (href, label) =>
    `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`;
  const links = [];
  if (fm.live) links.push(link(fm.live, 'live'));
  if (fm.repo) links.push(link(fm.repo, 'repo'));
  if (fm.release) links.push(link(fm.release, 'release'));
  if (links.length) rows.push(sidebarRow('links', links));
  return rows.join('');
}

const _mdCache = new Map();
async function loadProjectMd(name) {
  if (_mdCache.has(name)) return _mdCache.get(name);
  const res = await fetch(`/content/projects/${encodeURIComponent(name)}.md`);
  if (!res.ok) throw new Error(`not found (${res.status})`);
  const text = await res.text();
  _mdCache.set(name, text);
  return text;
}

// _currentReader = { adapter, name } — drives keyboard nav, history, & escape.
// `adapter` is one of projectReader / travelReader (defined below).
let _currentReader = null;
let _readerReturnFocus = null;

// Browser-history integration for the reader modal.
// Each reader open pushes a history entry so the browser back button closes
// the modal instead of leaving the site. Internal nav between readers
// (sidebar/arrow keys) replaces state to avoid polluting history.
let readerRequest = 0;
function pushReaderState(name, kind, mode) {
  const url = readerPath(kind, name);
  if (mode === 'deep' || history.state?.reader) {
    // Carry the prior `pushed` flag forward across sibling navigation.
    // Deep-link entry has no prior state, so pushed stays false.
    const pushed = mode !== 'deep' && !!history.state?.pushed;
    history.replaceState({ reader: true, kind, name, pushed }, '', url);
  } else {
    history.pushState({ reader: true, kind, name, pushed: true }, '', url);
  }
}

// ── Reader interface ─────────────────────────────────────────────
// A Reader Adapter satisfies the interface the unified opener depends on.
// Each adapter knows how to: enumerate its entries, fetch one, render
// sidebar HTML, render body HTML. The opener stays generic.
//
// Adapter shape: { kind, dataAttr, list(), loadEntry(name),
//                  renderSidebar(name, data), renderBody(entry, data) }
//
// Two adapters live: projectReader, travelReader. Adding a third
// (e.g. /blog) is a new adapter, not a new pipeline.

const projectReader = {
  kind: 'project',
  dataAttr: 'data-open',
  list: () => PROJECTS,
  async loadEntry(name) {
    const text = await loadProjectMd(name);
    const { fm, body } = parseFrontmatter(text);
    const html = renderMarkdown(body, {
      imageBase: `/images/${fm.name || name}`,
      imageAspect: fm.aspect || null,
    });
    return { fm, html };
  },
  renderSidebar(_name, data) {
    return renderSidebar(data.fm);
  },
  renderBody(entry, data) {
    const title = `<h1 class="proj-title">${escapeHtml(data.fm.name || entry.name)}</h1>`;
    const tagline = entry.tagline
      ? `<div class="proj-tagline">${escapeHtml(entry.tagline)}</div>`
      : '';
    return title + tagline + data.html;
  },
  // Wire each rendered figure to open in the photoviewer. Runs after the
  // reader-body innerHTML is set in openReader().
  afterRender(name) {
    attachProjectPhotoHandlers(name);
  },
};

// Scan the project reader body for figures and attach click handlers that
// open the existing photoviewer with that project's full photo set. Captions
// come from each figure's <figcaption>; src from the <img>.
function attachProjectPhotoHandlers(projectName) {
  const figures = document.querySelectorAll(
    '#reader-body figure.full-bleed'
  );
  const photos = Array.from(figures)
    .map((fig) => {
      const img = fig.querySelector('img');
      const cap = fig.querySelector('figcaption');
      return {
        src: img?.getAttribute('src') || '',
        caption: cap?.textContent || img?.getAttribute('alt') || '',
      };
    })
    .filter((p) => p.src);
  if (!photos.length) return;

  figures.forEach((fig, i) => {
    const img = fig.querySelector('img');
    if (!img) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'screenshot-zoom';
    button.setAttribute('aria-label', `Enlarge screenshot ${i + 1}: ${photos[i].caption}`);
    img.before(button);
    button.append(img);
    button.addEventListener('click', () => openProjectPhotoViewer(photos, i, projectName, button));
  });
}

// Project-flavored photoviewer open. Same overlay as the travel viewer; we
// pass it the project figures and label it with the project name.
function openProjectPhotoViewer(photos, idx, projectName, trigger) {
  photoViewer.open({ photos, idx, kind: 'projects', name: projectName, trigger });
}

const travelReader = {
  kind: 'travel',
  dataAttr: 'data-travels',
  list: () => TRAVELS,
  async loadEntry(name) {
    const trip = TRAVELS.find((t) => t.name === name);
    const text = await loadTravelMd(name);
    const { fm, body } = parseFrontmatter(text);
    fm.name = fm.name || name;
    fm.country = fm.country || trip.country;
    fm.photos = normalizeTravelPhotos(fm.photos, name);
    _travelFmCache.set(name, fm);
    return { fm, html: renderMarkdown(body) };
  },
  renderSidebar: renderTravelSidebar,
  renderBody(_entry, data) {
    return renderTravelBody(data.fm, data.html);
  },
};

// Titlebar reads as a path (projects/sparrow) so it doesn't duplicate the
// body heading and says which kind of entry is open.
function tryOpenReader(adapter, name, options) {
  return openReader(adapter, name, options).catch(() => {
    const message = `Couldn't load ${name}. Try opening it again.`;
    ui.announce(message);
    const existing = document.querySelector('#reader-error');
    const error = document.querySelector('#reader').hidden ? document.querySelector('#page-error') : existing;
    error.textContent = message;
  });
}

async function openReader(adapter, name, { trigger, pointerOpen = false, historyMode = 'push' } = {}) {
  const request = ++readerRequest;
  const returnFocus = trigger || document.activeElement;
  document.getElementById('reader-error').textContent = '';
  document.getElementById('page-error').textContent = '';
  const list = adapter.list();
  const idx = list.findIndex((e) => e.name === name);
  if (idx < 0) {
    if (historyMode === 'deep') history.replaceState(null, '', readerIndex(adapter.kind));
    throw new Error('Entry not found');
  }
  const entry = list[idx];
  const prev = list[(idx - 1 + list.length) % list.length];
  const next = list[(idx + 1) % list.length];

  let data;
  try {
    await loadMarked();
    data = await adapter.loadEntry(name);
  } catch (error) {
    if (request !== readerRequest) return;
    throw error;
  }
  if (request !== readerRequest) return;

  setOverlayTitle('reader-cmd', adapter.kind === 'project' ? 'projects' : 'travels', name);
  document.getElementById('reader-count').textContent =
    `${idx + 1} / ${list.length}`;
  document.getElementById('reader-side').innerHTML = adapter.renderSidebar(
    name,
    data
  );
  const bodyEl = document.getElementById('reader-body');
  bodyEl.innerHTML = adapter.renderBody(entry, data);
  smartenTextNodes(bodyEl);
  const header = document.getElementById('reader-intro');
  const title = bodyEl.firstElementChild;
  header.replaceChildren(title);
  if (bodyEl.firstElementChild?.classList.contains('proj-tagline')) header.append(bodyEl.firstElementChild);
  for (const [selector, sibling, label, direction] of [
    ['reader-prev', prev, `← ${prev.name}`, 'Previous'],
    ['reader-next', next, `${next.name} →`, 'Next'],
  ]) {
    const link = document.getElementById(selector);
    link.removeAttribute('data-open');
    link.removeAttribute('data-travels');
    link.setAttribute(adapter.dataAttr, sibling.name);
    link.href = readerPath(adapter.kind, sibling.name);
    link.textContent = label;
    link.setAttribute('aria-label', `${direction}: ${sibling.name}`);
  }

  _currentReader = { adapter, name };
  // Tell the server which entry was opened — client-side routing means this
  // open fires no other request it can see.
  beacon({ e: 'view', k: adapter.kind, n: name });
  const reader = document.getElementById('reader');
  const opening = reader.hidden;
  if (opening) {
    _readerReturnFocus = returnFocus;
    reader.toggleAttribute('data-pointer-open', pointerOpen);
    document.getElementById('scrollarea').inert = true;
  }
  reader.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('reader-body').parentElement.scrollTop = 0;
  if (opening || !reader.contains(document.activeElement)) {
    document.getElementById('reader-close').focus({ preventScroll: true });
  }
  document.getElementById('reader-status').textContent = `${name}, ${idx + 1} of ${list.length}.`;
  if (historyMode !== 'pop') pushReaderState(name, adapter.kind, historyMode);

  // Optional adapter hook for post-mount DOM work (e.g. attaching click
  // handlers to rendered figures). Runs after innerHTML is set.
  if (typeof adapter.afterRender === 'function') {
    adapter.afterRender(name, data);
  }
}

// ── travels reader ───────────────────────────────────────────────
const _travelMdCache = new Map();
async function loadTravelMd(name) {
  if (_travelMdCache.has(name)) return _travelMdCache.get(name);
  const res = await fetch(`/content/travels/${encodeURIComponent(name)}.md`);
  if (!res.ok) throw new Error(`not found (${res.status})`);
  const text = await res.text();
  _travelMdCache.set(name, text);
  return text;
}

function renderTravelSidebar(currentName) {
  const item = (t) => {
    const active = t.name === currentName ? ' active' : '';
    return `<a class="item trav-item${active}" data-travels="${escapeHtml(t.name)}" href="/travels/${encodeURIComponent(t.name)}">${escapeHtml(t.name)}</a>`;
  };
  return `<div class="row"><div class="label">trips</div><div class="val">${TRAVELS.map(item).join('')}</div></div>`;
}

function renderTravelBody(fm, html) {
  const title = `<h1 class="proj-title">${escapeHtml(fm.name || '')}</h1>`;
  const subParts = [];
  // Skip country when name is country-level (e.g. name=italy, country=italy) —
  // avoids an awkward "italy · italy" tagline.
  if (fm.country && fm.country.toLowerCase() !== (fm.name || '').toLowerCase())
    subParts.push(escapeHtml(fm.country));
  if (fm.when) subParts.push(escapeHtml(fm.when));
  if (fm.days) subParts.push(escapeHtml(String(fm.days)) + ' days');
  const sub = subParts.length
    ? `<div class="proj-tagline">${subParts.join(' · ')}</div>`
    : '';

  // Fixed fields: with / route. Hide empty rows.
  const rows = [];
  if (Array.isArray(fm.with) && fm.with.length) {
    rows.push(`<dt>with</dt><dd>${fm.with.map(escapeHtml).join(', ')}</dd>`);
  } else if (fm.with) {
    rows.push(`<dt>with</dt><dd>${escapeHtml(fm.with)}</dd>`);
  }
  if (fm.route) {
    // Split on arrow separators (→ / -> / –>) and wrap each segment in a
    // nowrap span so multi-word place names like "nevado pisco" stay
    // together; the route still wraps at arrow boundaries.
    const segments = fm.route.split(/\s*(?:→|->|–>)\s*/);
    const arrow = '<span class="trav-route-sep"> → </span>';
    const route = segments
      .map((s) => `<span class="trav-route-seg">${escapeHtml(s.trim())}</span>`)
      .join(arrow);
    rows.push(`<dt>route</dt><dd class="trav-route">${route}</dd>`);
  }
  if (fm.learned) rows.push(`<dt>learned</dt><dd>${escapeHtml(fm.learned)}</dd>`);
  const dl = rows.length ? `<dl class="trav-fields">${rows.join('')}</dl>` : '';

  // Photos preview: inline horizontal-scroll strip of all photos, with a
  // dedicated CTA underneath that opens the full photoviewer. The strip lets
  // readers scrub the trip without committing; the CTA stays unambiguous so
  // they know there's a richer experience behind the click.
  const photos = Array.isArray(fm.photos) ? fm.photos : [];
  const name = escapeHtml(fm.name);
  const photoBtn = photos.length
    ? `<div class="trav-photos">
        <div class="trav-photos-strip">
          ${photos
            .map((p, i) => {
              const thumb = thumbSrcFor(p.src);
              const full = encodeURI(p.src);
              const cap = escapeHtml(p.caption || '');
              return `<button class="trav-photos-thumb" type="button" tabindex="-1" data-trav-photos="${name}" data-idx="${i}" aria-label="photo ${i + 1}${cap ? `: ${cap}` : ''}"><img src="${encodeURI(thumb)}" loading="lazy" decoding="async" alt="" onerror="this.onerror=null;this.src='${full}'" /></button>`;
            })
            .join('')}
        </div>
        <button class="trav-photos-btn" type="button" data-trav-photos="${name}">view all ${photos.length} photos</button>
      </div>`
    : '';

  return title + sub + html + dl + photoBtn;
}

// Photos parsed from frontmatter `photos:` list entries shaped as either:
//   - src: path/to.jpg
//     caption: ...
//   - "path/to.jpg | caption"   (string shorthand)
// Travel photos live on Cloudflare R2 behind media.charliexue.com so the
// repo stays code-only. Project screenshots remain local (they ship with
// the code). Override via TRAVEL_MEDIA_BASE on `window` if you need a
// different host for local testing.
const TRAVEL_MEDIA_BASE =
  (typeof window !== 'undefined' && window.TRAVEL_MEDIA_BASE) ||
  'https://media.charliexue.com/travels';

function normalizeTravelPhotos(raw, travelName) {
  if (!Array.isArray(raw)) return [];
  const expand = (src) => {
    if (!src) return src;
    if (/^(https?:|data:|\/)/.test(src) || src.includes('/')) return src;
    if (!travelName) return src;
    return `${TRAVEL_MEDIA_BASE}/${travelName}/${src}`;
  };
  return raw
    .map((p) => {
      if (typeof p === 'string') {
        const [src, ...rest] = p.split('|').map((s) => s.trim());
        return { src: expand(src), caption: rest.join('|') };
      }
      return { src: expand(p.src || ''), caption: p.caption || '' };
    })
    .filter((p) => p.src);
}

// Cache the parsed frontmatter so the photo viewer can access photos without
// re-fetching. Keyed by travel name.
const _travelFmCache = new Map();

function navigateReader(delta) {
  if (!_currentReader) return;
  const { adapter, name } = _currentReader;
  const list = adapter.list();
  const idx = list.findIndex((e) => e.name === name);
  if (idx < 0) return;
  const target = list[(idx + delta + list.length) % list.length];
  tryOpenReader(adapter, target.name);
}

function closeReader({ fromHistory = false } = {}) {
  ++readerRequest;
  const reader = document.getElementById('reader');
  if (!reader || reader.hidden) return;
  photoViewer.close();
  reader.hidden = true;
  document.getElementById('scrollarea').inert = false;
  document.body.style.overflow = '';
  _currentReader = null;
  const target = _readerReturnFocus?.isConnected && _readerReturnFocus !== document.body
    ? _readerReturnFocus : (ui.route.firstElementChild || ui.input);
  _readerReturnFocus = null;
  target?.focus({ preventScroll: true });
  if (!fromHistory && history.state?.reader) {
    const { pushed, kind } = history.state;
    if (pushed) history.back();
    else history.replaceState(null, '', readerIndex(kind));
  }
}

window.addEventListener('popstate', () => {
  if (!history.state?.reader) {
    closeReader({ fromHistory: true });
    return;
  }
  const { kind, name } = history.state;
  tryOpenReader(kind === 'project' ? projectReader : travelReader, name, { historyMode: 'pop' });
});

const photoViewer = createPhotoViewer({
  root: document.getElementById('photoviewer'),
  reader: document.getElementById('reader'),
  reducedMotion: REDUCE_MOTION,
  keepTabInOverlay,
  shouldThrottleArrowNav,
});

function openPhotoViewer(travelName, startIdx = 0, trigger = document.activeElement) {
  const fm = _travelFmCache.get(travelName);
  if (!fm || !fm.photos || !fm.photos.length) return;
  const idx = Math.min(Math.max(0, startIdx | 0), fm.photos.length - 1);
  photoViewer.open({ photos: fm.photos, idx, kind: 'travels', name: travelName, when: fm.when || '', trigger });
}
function keepTabInOverlay(event, overlay) {
  if (event.key !== 'Tab') return;
  const controls = [...overlay.querySelectorAll('a[href], button:not([disabled])')]
    .filter(el => el.tabIndex >= 0 && el.getClientRects().length);
  const first = controls[0];
  const last = controls.at(-1);
  if (!first) return;
  const active = document.activeElement;
  if (!controls.includes(active) || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

const ARROW_NAV_REPEAT_MS = 100;
let lastArrowNavAt = 0;

function shouldThrottleArrowNav(e) {
  if (!e.repeat) return false;
  const now = performance.now();
  if (now - lastArrowNavAt < ARROW_NAV_REPEAT_MS) return true;
  lastArrowNavAt = now;
  return false;
}

// Reader scroll: rAF velocity loop, not OS key-repeat. Tap = brief glide
// from a single accel/decay; hold = sustained smooth scroll that ramps in
// and decays out. Direct scrollTop manipulation at frame rate, no native
// `scroll-behavior: smooth` (which interferes with continuous input).
const READER_SCROLL = {
  accel: 2.2,    // px/frame² ramp-up while key held
  decay: 0.85,   // velocity multiplier per frame after release
  maxVel: 22,    // px/frame cap (~1320 px/s at 60fps)
  minVel: 0.15,  // stop threshold
};
let _readerScrollDir = 0; // -1 up, 0 idle/decaying, +1 down
let _readerScrollVel = 0;
let _readerScrollRaf = null;
function startReaderScroll(dir) {
  _readerScrollDir = dir;
  if (_readerScrollRaf == null) tickReaderScroll();
}
function stopReaderScroll(dir) {
  // Only release if the released key matches the active direction (so
  // tapping ↑ while holding ↓ doesn't kill the hold).
  if (_readerScrollDir === dir) _readerScrollDir = 0;
}
function tickReaderScroll() {
  const scroller = document.getElementById('reader-body')?.parentElement;
  const reader = document.getElementById('reader');
  if (!scroller || !reader || reader.hidden) {
    _readerScrollRaf = null;
    _readerScrollDir = 0;
    _readerScrollVel = 0;
    return;
  }
  if (_readerScrollDir !== 0) {
    _readerScrollVel += _readerScrollDir * READER_SCROLL.accel;
    if (_readerScrollVel > READER_SCROLL.maxVel) _readerScrollVel = READER_SCROLL.maxVel;
    if (_readerScrollVel < -READER_SCROLL.maxVel) _readerScrollVel = -READER_SCROLL.maxVel;
  } else {
    _readerScrollVel *= READER_SCROLL.decay;
    if (Math.abs(_readerScrollVel) < READER_SCROLL.minVel) {
      _readerScrollVel = 0;
      _readerScrollRaf = null;
      return;
    }
  }
  scroller.scrollTop += _readerScrollVel;
  _readerScrollRaf = requestAnimationFrame(tickReaderScroll);
}

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown') stopReaderScroll(1);
  else if (e.key === 'ArrowUp') stopReaderScroll(-1);
});
// Tab-away / window blur won't fire keyup, so the rAF loop would keep its
// direction set and resume scrolling when the page returns. Hard-stop the
// loop on those events; tap an arrow again to restart.
const cancelReaderScroll = () => {
  _readerScrollDir = 0;
};
document.addEventListener('visibilitychange', cancelReaderScroll);
window.addEventListener('blur', cancelReaderScroll);

document.addEventListener('keydown', (e) => {
  if (photoViewer.handleKey(e)) return;
  const reader = document.getElementById('reader');
  if (!reader || reader.hidden) return;
  keepTabInOverlay(e, reader);
  if (e.key === 'Escape') {
    e.preventDefault();
    closeReader();
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (shouldThrottleArrowNav(e)) return;
    navigateReader(-1);
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (shouldThrottleArrowNav(e)) return;
    navigateReader(1);
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    if (REDUCE_MOTION.matches) {
      document.getElementById('reader-body').parentElement.scrollBy({ top: dir * 48, behavior: 'instant' });
    } else if (!e.repeat) {
      startReaderScroll(dir);
    }
  }
  if (e.key === 'v' || e.key === 'V') {
    // Open the photoviewer for the current entry (travel reader only —
    // project reader has no `data-trav-photos` button to target).
    const trigger = document.querySelector('#reader-body .trav-photos-btn');
    if (trigger) {
      e.preventDefault();
      trigger.click();
    }
    return;
  }
  if (e.key === ' ' && e.target.closest('button')) return;
  if (e.key === 'PageDown' || e.key === 'PageUp' || e.key === ' ') {
    e.preventDefault();
    const scroller = document.getElementById('reader-body')?.parentElement;
    if (!scroller) return;
    const dir = e.key === 'PageUp' || e.shiftKey ? -1 : 1;
    const factor = e.repeat ? 0.4 : 0.9;
    scroller.scrollBy({
      top: dir * scroller.clientHeight * factor,
      behavior: e.repeat ? 'auto' : scrollBehavior(),
    });
  }
});
document.addEventListener('click', (e) => {
  if (e.target.matches('#reader > .reader-backdrop')) closeReader();
  if (e.target.id === 'reader-close' || e.target.closest?.('#reader-close')) {
    e.preventDefault();
    closeReader();
  }
  const photoBtn = e.target.closest('[data-trav-photos]');
  if (photoBtn) {
    e.preventDefault();
    const startIdx = parseInt(photoBtn.dataset.idx, 10);
    const trigger = photoBtn.tabIndex < 0
      ? photoBtn.closest('.trav-photos').querySelector('.trav-photos-btn') : photoBtn;
    openPhotoViewer(photoBtn.dataset.travPhotos, Number.isFinite(startIdx) ? startIdx : 0, trigger);
  }

});

// Same-origin behavioral beacon. One on load and one per project/travel
// opened (client-side routing hides opens from the server). This is evidence
// the app ran, not proof of a human; automation can run JavaScript too.
// keepalive lets the browser continue a request when the tab closes, but
// delivery is best-effort and failures are silent on the client.
//
// Chaining orders the requests, not their background server work. /b replies
// before Discord/session processing finishes, so a subsequent beacon can
// still race with message creation and be dropped by the middleware.
let _beaconChain = Promise.resolve();
function beacon(params) {
  _beaconChain = _beaconChain.then(() => {
    try {
      // Timeout so one hung request can't stall every later beacon behind it.
      return fetch(`/b?${new URLSearchParams(params)}`, {
        keepalive: true,
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    } catch {}
  });
}

// ── Command Registry ─────────────────────────────────────────────
// Each slash command is one entry: a function (ui, args) -> void.
// `ui.run()` dispatches via lookup instead of an if/else chain. Adding a
// new command is one new entry; behavior and data live together.
//
// The `COMMANDS` array in data.js still drives autocomplete
// (those need cmd+desc, not behavior). Keeping the two related but
// separate: catalog vs. dispatch table.

function renderProjectsList(ui) {
  const renderRow = (project) => terminalRow({
    className: 'proj-row', label: project.name, href: readerPath('project', project.name), action: 'open', value: project.name, wholeRow: true,
    before: project.status === 'wip' ? '<span class="warn">[wip]</span>' : '',
    after: `<span class="row-description">${escapeHtml(project.tagline || '')}</span>`,
  });
  const wrap = ui.block(PROJECTS.map(renderRow).join(''));
  attachListNav([...wrap.querySelectorAll('.proj-row')]);
  return `${PROJECTS.length} projects listed.`;
}

function renderThemeList(ui) {
  const current = document.body.dataset.theme || THEMES[0].name;
  const rows = THEMES.map((theme) => {
    const swatches = [theme.bg, theme.fg, theme.accent]
      .map(color => `<span class="theme-swatch" style="background:${color}"></span>`).join('');
    return terminalRow({
      className: 'theme-row', label: theme.name, action: 'theme', value: theme.name,
      href: `?cmd=theme+${encodeURIComponent(theme.name)}`,
      after: `<span class="theme-swatches" aria-hidden="true">${swatches}</span><span class="theme-active row-meta"${theme.name === current ? '' : ' hidden'}>active</span>`,
    });
  });
  const wrap = ui.block(rows.join(''));
  attachListNav([...wrap.querySelectorAll('.theme-row')]);
  return `${THEMES.length} themes listed.`;
}

const commandHandlers = {
  clear(ui) {
    const returnFocusToMain = document.activeElement !== ui.input;
    ++readerRequest;
    ui.route.replaceChildren();
    ui.main.replaceChildren();
    document.getElementById('page-error').textContent = '';
    ui._turn = null;
    ui.input.value = '';
    ui.suggestions.close();
    clearActiveList();
    if (!ui.home.firstElementChild) ui.landing();
    if (location.pathname !== '/') history.replaceState(null, '', '/');
    if (returnFocusToMain) document.getElementById('main').focus({ preventScroll: true });
    document.getElementById('scrollarea').scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
    return 'Returned to the homepage.';
  },
  help(ui) {
    const width = Math.max(...COMMANDS.map((c) => c.cmd.length)) + 2;
    ui.block(
      COMMANDS.map(
        (c) =>
          `<a class="key" data-run="${c.cmd}" href="${c.cmd}">${c.cmd}</a>${' '.repeat(width - c.cmd.length)}<span class="muted">${c.desc}</span>`
      ).join('\n') +
        `\n\n<span class="muted">keys: ↑↓ history · tab complete · esc cancel</span>`
    );
  },
  about(ui) {
    ui.block(ABOUT);
    return 'About Charlie.';
  },
  contact(ui) {
    ui.block(CONTACT);
    return 'Contact options: email, GitHub, and LinkedIn.';
  },
  projects(ui) {
    return renderProjectsList(ui);
  },
  travels(ui, args) {
    if (args.length === 0) {
      return renderTravelsList(ui);
    }
    const target = args[0].toLowerCase();
    if (!TRAVELS.some((t) => t.name === target)) {
      ui.block(
        `<span class="warn">travels "${escapeHtml(target)}" not found</span>. try <span class="key">/travels</span> to list.`
      );
      return;
    }
    tryOpenReader(travelReader, target);
  },
  open(ui, args) {
    const p = PROJECTS.find((x) => x.name === args[0]);
    if (!p) {
      ui.block(
        `<span class="muted">usage:</span> <span class="key">/open &lt;project&gt;</span>\n` +
          PROJECTS.map(
            (x) =>
              `  <span class="key">/open ${x.name}</span>  <span class="muted">${x.tagline || ''}</span>`
          ).join('\n')
      );
      return;
    }
    tryOpenReader(projectReader, p.name);
  },
  theme(ui, args) {
    if (args.length === 0) {
      return renderThemeList(ui);
    }
    const target = args[0];
    const t = THEMES.find((x) => x.name === target);
    if (!t) {
      ui.block(
        `<span class="warn">theme "${escapeHtml(target)}" not found</span>. try <span class="key">/theme</span> to list.`
      );
      return;
    }
    applyTheme(t);
    ui.block(
      `<span class="muted">theme:</span> <span class="key">${t.name}</span>`
    );
  },
};

ui.init();
beacon({ e: 'load' });
