import {
  PROJECTS,
  TRAVELS,
  FAVORITES,
  ABOUT,
  CONTACT,
  COMMANDS,
  MASCOTS,
  THEMES,
  WHATS_NEW,
  LOCATION,
} from './data.js';

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
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
  const travelNames = [...TRAVELS.visited, ...TRAVELS.wishlist].map(
    (t) => t.name
  );
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

function applyTheme(idx) {
  document.body.dataset.theme = idx;
  const t = THEMES[idx];
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg);
  r.setProperty('--fg', t.fg);
  r.setProperty('--orange', t.orange);
  r.setProperty('--dim', t.dim);
  r.setProperty('--mute', t.mute);
  r.setProperty('--yellow', t.yellow);
  r.setProperty('--violet', t.violet);
  r.setProperty('--cyan', t.cyan);
  r.setProperty('--pink', t.pink);
  r.setProperty('--red', t.red);
  const indicator = document.getElementById('theme-name');
  if (indicator) indicator.textContent = t.name;
  try {
    localStorage.setItem('theme', String(idx));
  } catch {}
}

// Path-based routing. The site has shareable URLs like /projects,
// /travels/peru, /projects/spectre — Cloudflare Pages serves index.html
// for every unknown path (see /_redirects) and we dispatch the matching
// command on init.
const STATIC_ROUTES = new Set([
  '/about', '/projects', '/contact', '/travels', '/favorites',
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
function readerPath(kind, name) {
  const prefix = kind === 'project' ? '/projects' : '/travels';
  return `${prefix}/${encodeURIComponent(name)}`;
}

// Restore a previously-chosen theme on load. No-op (and classic stays) if
// nothing is stored or the index is out of range. Runs at module top, before
// ui.init(), so the right palette is on screen before any panel renders.
(function restoreTheme() {
  try {
    const stored = parseInt(localStorage.getItem('theme'), 10);
    if (Number.isInteger(stored) && stored >= 0 && stored < THEMES.length) {
      applyTheme(stored);
    }
  } catch {}
})();

const ui = {
  main: null,
  input: null,
  ac: null,
  box: null,
  acItems: [],
  acIdx: 0,
  history: [],
  histIdx: -1,
  init() {
    this.main = document.getElementById('main');
    this.input = document.getElementById('input');
    this.ac = document.getElementById('ac');
    this.box = document.getElementById('promptbox');
    this.input.addEventListener('input', () => this.updateAutocomplete());
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('focus', () =>
      this.box.classList.add('focused')
    );
    this.input.addEventListener('blur', () => {
      this.box.classList.remove('focused');
      setTimeout(() => this.hideAc(), 120);
    });
    // Keep input focused when clicking dead space — preventDefault on mousedown
    // stops the blur from firing, which avoids the focus-border flash.
    document.body.addEventListener('mousedown', (e) => {
      if (
        e.target.closest(
          'a, input, textarea, button, .autocomplete, [data-open], [data-travels], .reader, .photoviewer'
        )
      )
        return;
      if (document.activeElement === this.input) e.preventDefault();
    });
    document.body.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-open]');
      if (opener) {
        e.preventDefault();
        this.run('/open ' + opener.dataset.open);
        return;
      }
      const traveler = e.target.closest('[data-travels]');
      if (traveler) {
        e.preventDefault();
        this.run('/travels ' + traveler.dataset.travels);
        return;
      }
      const themer = e.target.closest('a[data-theme]');
      if (themer) {
        e.preventDefault();
        this.run('/theme ' + themer.dataset.theme);
      }
    });
    window.addEventListener('resize', () => {
      if (this.ac.classList.contains('show')) this.positionAc();
    });
    document.getElementById('scrollarea').addEventListener('scroll', () => {
      if (this.ac.classList.contains('show')) this.positionAc();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      this.input.focus();
      this.input.value = '/';
      this.updateAutocomplete();
    });
    const deep = pathToCommand(location.pathname);
    if (deep) setTimeout(() => this.run(deep), 0);
    if (!matchMedia('(pointer: coarse)').matches) this.input.focus();
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
        this.input.focus();
      };
      window.addEventListener('focus', refocus);
      document.addEventListener('visibilitychange', refocus);
    }
    // Warm the project index in the background so /projects and the
    // /open autocomplete don't pay a fetch round-trip on first use.
    getProjectIndex().catch(() => {});
  },
  print(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    this.main.appendChild(div);
    const sa = document.getElementById('scrollarea');
    sa.scrollTo({ top: sa.scrollHeight, behavior: 'smooth' });
    return div;
  },
  echo(cmd) {
    const hasSlash = cmd.startsWith('/');
    const slash = hasSlash ? '/' : '';
    const rest = hasSlash ? cmd.slice(1) : cmd;
    this.print(
      `<div class="echo">› <span class="slash">${slash}</span>${escapeHtml(rest)}</div>`
    );
  },
  block(html) {
    return this.print(`<div class="block">${html}</div>`);
  },
  updateAutocomplete() {
    const v = this.input.value;
    if (!v.startsWith('/')) {
      this.hideAc();
      return;
    }
    let matches;
    // Second-arg autocomplete: after `/open `, show project names.
    const openMatch = v.match(/^\/open(?:\s+(\S*))?$/);
    const themeMatch = v.match(/^\/theme(?:\s+(\S*))?$/);
    const travelMatch = v.match(/^\/travels(?:\s+(\S*))?$/);
    if (openMatch && v.includes(' ')) {
      const q = (openMatch[1] || '').toLowerCase();
      // Use the cached index for taglines if available; bare names if not.
      // Index warms in background on init, so this only misses on the very
      // first keystrokes during cold load.
      const projects = _projectIndexCache || PROJECTS;
      matches = projects.filter((p) => p.name.toLowerCase().startsWith(q)).map(
        (p) => ({ cmd: '/open ' + p.name, desc: p.tagline || '' })
      );
    } else if (themeMatch && v.includes(' ')) {
      const q = (themeMatch[1] || '').toLowerCase();
      matches = THEMES.filter((t) => t.name.toLowerCase().startsWith(q)).map(
        (t) => ({ cmd: '/theme ' + t.name, desc: t.desc || '' })
      );
    } else if (travelMatch && v.includes(' ')) {
      const q = (travelMatch[1] || '').toLowerCase();
      const visited = TRAVELS.visited
        .filter((t) => t.name.toLowerCase().startsWith(q))
        .map((t) => ({
          cmd: '/travels ' + t.name,
          desc: t.endMonth ? `${t.month}–${t.endMonth} ${t.year}` : `${t.month} ${t.year}`,
        }));
      const wish = TRAVELS.wishlist
        .filter((t) => t.name.toLowerCase().startsWith(q))
        .map((t) => ({ cmd: '/travels ' + t.name, desc: 'wishlist' }));
      matches = [...visited, ...wish];
    } else {
      const q = v.slice(1).toLowerCase();
      matches = COMMANDS.filter((c) => c.cmd.slice(1).startsWith(q));
    }
    if (!matches.length) {
      this.hideAc();
      return;
    }
    this.acItems = matches;
    this.acIdx = 0;
    this.ac.innerHTML = matches
      .map(
        (m, i) =>
          `<div class="item ${i === 0 ? 'active' : ''}" data-i="${i}">
         <span class="cmd">${m.cmd}</span><span class="desc">${m.desc}</span>
       </div>`
      )
      .join('');
    this.ac.classList.add('show');
    this.positionAc();
    this.ac.querySelectorAll('.item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.run(this.acItems[+el.dataset.i].cmd);
      });
    });
  },
  positionAc() {
    const r = this.box.getBoundingClientRect();
    const vh = window.innerHeight;
    const margin = 12;
    const cap = 228;
    this.ac.style.left = r.left + 'px';
    this.ac.style.width = r.width + 'px';
    // Allow dropdown to size to content first, capped, so we can read scrollHeight.
    this.ac.style.maxHeight = cap + 'px';
    const content = this.ac.scrollHeight;
    const below = vh - r.bottom - margin - 4;
    const above = r.top - margin - 4;
    if (below >= above) {
      // Drop below — fit dropdown to either content or available space.
      const h = Math.min(content, below, cap);
      this.ac.style.top = r.bottom + 4 + 'px';
      this.ac.style.maxHeight = h + 'px';
    } else {
      const h = Math.min(content, above, cap);
      this.ac.style.top = r.top - h - 4 + 'px';
      this.ac.style.maxHeight = h + 'px';
    }
  },
  hideAc() {
    this.ac.classList.remove('show');
    this.acItems = [];
  },
  setAcActive(i) {
    this.acIdx = i;
    const items = this.ac.querySelectorAll('.item');
    items.forEach((el, j) => el.classList.toggle('active', i === j));
    items[i]?.scrollIntoView({ block: 'nearest' });
  },
  onKey(e) {
    // Reader/photoviewer own the keyboard while open. The input keeps focus
    // (we never blur it — keeps the CLI metaphor intact), but its handlers
    // must stand down so ↑↓⏎ don't fire commands behind the overlay, AND
    // we must preventDefault so letter keys (e.g. `v`) don't insert text.
    // Allow the rare keys the overlay shouldn't shadow (Cmd/Ctrl combos
    // like ⌘R, ⌘L for browser actions).
    const reader = document.getElementById('reader');
    const pv = document.getElementById('photoviewer');
    if ((reader && !reader.hidden) || (pv && !pv.hidden)) {
      if (!e.metaKey && !e.ctrlKey) e.preventDefault();
      return;
    }
    const acOpen = this.ac.classList.contains('show');
    const inputEmpty = !this.input.value;
    // ↑↓ navigate the most-recent rendered list when input is empty.
    // ↑ at row 0 falls through to history (boundary leak — the list hint
    // surfaces this so it isn't a hidden trick). ↓ at the last row no-ops.
    // ←/→ jump between columns for columnar lists (travels).
    const listNav = inputEmpty && _activeList && !acOpen;
    if (e.key === 'ArrowDown' && acOpen) {
      e.preventDefault();
      this.setAcActive(Math.min(this.acIdx + 1, this.acItems.length - 1));
    } else if (e.key === 'ArrowUp' && acOpen) {
      e.preventDefault();
      this.setAcActive(Math.max(this.acIdx - 1, 0));
    } else if (e.key === 'ArrowDown' && listNav) {
      e.preventDefault();
      if (_activeList.idx < _activeList.rows.length - 1) moveActiveList(1);
    } else if (e.key === 'ArrowUp' && listNav && _activeList.idx > 0) {
      e.preventDefault();
      moveActiveList(-1);
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && listNav) {
      // Only consume the key if a column actually moved; otherwise let the
      // input cursor handle it (which on empty input is a no-op anyway).
      if (moveActiveListHoriz(e.key === 'ArrowRight' ? 1 : -1)) {
        e.preventDefault();
      }
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
    } else if (e.key === 'Tab' && acOpen) {
      e.preventDefault();
      this.input.value = this.acItems[this.acIdx].cmd + ' ';
      this.updateAutocomplete();
    } else if (e.key === 'Tab') {
      // No autocomplete to fill — swallow Tab so focus doesn't escape the
      // prompt. There's nothing useful to tab to on the root view.
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (acOpen) this.input.value = this.acItems[this.acIdx].cmd;
      if (inputEmpty && !acOpen && _activeList) {
        e.preventDefault();
        activateActiveList();
        return;
      }
      const v = this.input.value;
      this.input.value = '';
      this.hideAc();
      this.run(v);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (acOpen) {
        this.hideAc();
      } else if (this.input.value) {
        this.input.value = '';
      }
      // Empty input + no autocomplete: esc is a no-op. The CLI is keyboard-
      // first; blurring strands subsequent keypresses (incl. list-nav ↑↓).
    }
  },
  run(raw) {
    const cmd = (raw || '').trim();
    this.echo(raw || '');
    if (!cmd) return;
    this.history.push(cmd);
    this.histIdx = -1;
    const norm = cmd.startsWith('/') ? cmd.slice(1) : cmd;
    const [name, ...args] = norm.split(/\s+/);

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
      handler(this, args);
      return;
    }

    const suggestion = closestCommand(name);
    if (suggestion) {
      this.block(
        `<span class="warn">${escapeHtml(name)}: command not found</span>. did you mean <span class="key">${suggestion}</span>?`
      );
    } else {
      this.block(
        `<span class="warn">${escapeHtml(name)}: command not found</span>. try <span class="key">/help</span>.`
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
  _activeList = { rows, idx: 0 };
  rows[0].classList.add('list-active');
}
function moveActiveList(d) {
  if (!_activeList) return;
  const { rows } = _activeList;
  const i = Math.max(0, Math.min(rows.length - 1, _activeList.idx + d));
  if (i === _activeList.idx) return;
  rows[_activeList.idx].classList.remove('list-active');
  _activeList.idx = i;
  rows[i].classList.add('list-active');
  rows[i].scrollIntoView({ block: 'nearest' });
}
// Columnar lists (just /travels today) get ←/→ to jump between columns at
// the same in-column index. Returns true if a jump happened, false if the
// list isn't columnar — caller decides whether to preventDefault.
function moveActiveListHoriz(d) {
  if (!_activeList) return false;
  const cur = _activeList.rows[_activeList.idx];
  const col = cur.closest('.travels-col');
  if (!col) return false;
  const cols = [...col.parentElement.querySelectorAll('.travels-col')];
  const target = cols[cols.indexOf(col) + d];
  if (!target) return false;
  const colRows = [...col.querySelectorAll('.travel-row')];
  const inColIdx = colRows.indexOf(cur);
  const targetRows = [...target.querySelectorAll('.travel-row')];
  const targetRow = targetRows[Math.min(inColIdx, targetRows.length - 1)];
  if (!targetRow) return false;
  const newIdx = _activeList.rows.indexOf(targetRow);
  if (newIdx < 0) return false;
  cur.classList.remove('list-active');
  _activeList.idx = newIdx;
  targetRow.classList.add('list-active');
  targetRow.scrollIntoView({ block: 'nearest' });
  return true;
}
function activateActiveList() {
  if (!_activeList) return false;
  const row = _activeList.rows[_activeList.idx];
  const link = row.querySelector('[data-open], [data-travels], [data-theme]');
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

function renderProjectOpen(ui, p) {
  openReader(projectReader, p.name).catch((err) => {
    ui.block(
      `<span class="warn">couldn't load ${escapeHtml(p.name)}: ${escapeHtml(err.message)}</span>`
    );
  });
}

// Per-tag section labels for /favorites. Most pluralize cleanly with -s;
// "food" is uncountable so it stays singular. Add new tags here.
const FAV_TAG_LABELS = {
  book: 'books',
  film: 'films',
  places: 'places',
  food: 'food',
  team: 'teams',
  restaurant: 'restaurants',
};

function renderFavoritesList(ui) {
  // Group by tag, preserving first-seen order across groups and item order
  // within each group. So data.js controls which category appears first.
  const order = [];
  const groups = {};
  for (const f of FAVORITES) {
    const tag = (f.tag || '').toLowerCase();
    if (!groups[tag]) {
      groups[tag] = [];
      order.push(tag);
    }
    groups[tag].push(f);
  }

  const sections = order
    .map((tag) => {
      const label = FAV_TAG_LABELS[tag] || tag;
      const head = `<div class="fav-section-head" data-tag="${escapeHtml(tag)}">─── ${escapeHtml(label)} ───</div>`;
      const rows = groups[tag]
        .map((f) => {
          const by = f.by
            ? ` <span class="fav-by">— ${escapeHtml(f.by)}</span>`
            : '';
          const blurb = f.blurb
            ? `<div class="fav-blurb"><span class="fav-blurb-conn">#</span><span>${escapeHtml(f.blurb)}</span></div>`
            : '';
          return `<div class="fav-row"><span class="fav-marker">▸</span><span class="fav-title">${escapeHtml(f.name)}</span>${by}${blurb}</div>`;
        })
        .join('');
      return `<div class="fav-section">${head}${rows}</div>`;
    })
    .join('');

  const hint = `<div class="proj-hint"><span class="muted">my personal list.</span></div>`;
  ui.block(`${hint}<div class="fav-list">${sections}</div>`);
}

function renderTravelsList(ui) {
  const hint = `<div class="proj-hint"><span class="muted">click any place to open, or type <span class="key">/travels &lt;place&gt;</span></span></div>`;
  const visitedRows = TRAVELS.visited
    .map(
      (t) =>
        `<div class="travel-row"><a class="travel-link" data-travels="${escapeHtml(t.name)}" href="/travels/${encodeURIComponent(t.name)}">${escapeHtml(t.name)}</a><span class="travel-date">${escapeHtml(t.endMonth ? `${t.month}–${t.endMonth}` : t.month)} ${t.year}</span></div>`
    )
    .join('');
  const wishRows = TRAVELS.wishlist
    .map(
      (t) =>
        `<div class="travel-row"><a class="travel-link" data-travels="${escapeHtml(t.name)}" href="/travels/${encodeURIComponent(t.name)}">${escapeHtml(t.name)}</a></div>`
    )
    .join('');
  const wrap = ui.block(
    hint +
      `<div class="travels-grid">` +
      `<div class="travels-col"><div class="section-head">─── visited ───</div>${visitedRows}</div>` +
      `<div class="travels-col"><div class="section-head">─── wishlist ───</div>${wishRows}</div>` +
      `</div>`
  );
  attachListNav([...wrap.querySelectorAll('.travel-row')]);
}

// ── markdown reader ──────────────────────────────────────────────
// Parses /content/projects/{name}.md (frontmatter + body) and renders
// into the reader modal. Custom fenced directives:
//   ```terminal title="~/x"       → terminal frame
//   ```gallery layout=strip        → horizontal-scroll figure strip
// Project screenshots use plain markdown image syntax; click any to open
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

function parseFenceParams(infoString) {
  const tokens = (infoString || '').trim().split(/\s+/);
  const lang = tokens.shift() || '';
  const params = {};
  for (const t of tokens) {
    const eq = t.indexOf('=');
    if (eq < 0) {
      params[t] = true;
      continue;
    }
    const k = t.slice(0, eq);
    let v = t.slice(eq + 1);
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    params[k] = v;
  }
  return { lang, params };
}

function renderTerminalBlock(body, params) {
  const title = params.title || 'terminal';
  // Minimal token coloring: lines beginning with `$ ` get an orange prompt.
  const lines = body
    .split('\n')
    .map((line) => {
      if (line.startsWith('$ ')) {
        return `<span style="color:var(--orange)">$</span> <span style="color:var(--yellow)">${escapeHtml(line.slice(2))}</span>`;
      }
      return escapeHtml(line);
    })
    .join('\n');
  return `<div class="term-frame">
    <div class="bar"><span class="title">${escapeHtml(title)}</span></div>
    <pre>${lines}</pre>
  </div>`;
}

function renderDecisionsBlock(body, _params) {
  // Each non-empty line is: headline | body (both may contain inline md)
  const items = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf('|');
      const head = (sep < 0 ? line : line.slice(0, sep)).trim();
      const rest = (sep < 0 ? '' : line.slice(sep + 1)).trim();
      const headHtml = typeof marked !== 'undefined' ? marked.parseInline(head) : escapeHtml(head);
      const bodyHtml = typeof marked !== 'undefined' ? marked.parseInline(rest) : escapeHtml(rest);
      return `<div class="item"><div><div class="head">${headHtml}</div>${
        rest ? `<div class="body">${bodyHtml}</div>` : ''
      }</div></div>`;
    })
    .join('');
  return `<div class="decisions">${items}</div>`;
}

function renderGalleryBlock(body, params) {
  // Each non-empty line is: src | caption
  const figures = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [src, ...rest] = line.split('|').map((s) => s.trim());
      const caption = rest.join('|');
      const resolved = resolveImagePath(src);
      return `<figure>
        <img src="${escapeHtml(resolved)}" alt="${escapeHtml(caption)}" loading="lazy" decoding="async" />
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}
      </figure>`;
    })
    .join('');
  const layout = params.layout || 'strip';
  return `<div class="strip" data-layout="${escapeHtml(layout)}">${figures}</div>`;
}

// Image-path resolver. Short paths (no slash, no http) in project markdown
// expand to `{imageBase}/{path}`, with a `.webp` default ext. The base is
// scoped to a single renderMarkdown() call below — never set from outside
// this module. Safe because marked.parse is synchronous.
let _currentImageBase = null;
function resolveImagePath(href) {
  if (!href) return href;
  if (/^(https?:|data:|\/)/.test(href) || href.includes('/')) return href;
  if (!_currentImageBase) return href;
  const withExt = /\.[a-z0-9]+$/i.test(href) ? href : `${href}.webp`;
  return `${_currentImageBase}/${withExt}`;
}

let _markedConfigured = false;
function configureMarked() {
  if (_markedConfigured) return;
  if (typeof marked === 'undefined') return;
  marked.use({
    renderer: {
      // Marked v12 inconsistency: renderer overrides may be invoked with
      // either a token object or positional args. Same defense pattern as
      // the image renderer below.
      code(textOrToken, infostring) {
        let text, lang;
        if (textOrToken && typeof textOrToken === 'object') {
          text = textOrToken.text;
          lang = textOrToken.lang;
        } else {
          text = textOrToken;
          lang = infostring;
        }
        const { lang: base, params } = parseFenceParams(lang);
        if (base === 'terminal') return renderTerminalBlock(text, params);
        if (base === 'gallery') return renderGalleryBlock(text, params);
        if (base === 'decisions') return renderDecisionsBlock(text, params);
        return false; // fall through to default
      },
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
        return `<figure class="full-bleed">
          <img src="${escapeHtml(resolved)}" alt="${escapeHtml(alt)}" loading="eager" decoding="async" />
          ${cap ? `<figcaption>${escapeHtml(cap)}</figcaption>` : ''}
        </figure>`;
      },
    },
  });
  _markedConfigured = true;
}

// Single entry point for parsing reader-body markdown. `imageBase` (e.g.
// `images/foo`) makes bare image hrefs resolve to that directory; pass
// nothing when relative image expansion isn't wanted (travel entries).
function renderMarkdown(body, { imageBase = null } = {}) {
  configureMarked();
  if (typeof marked === 'undefined') return escapeHtml(body);
  _currentImageBase = imageBase;
  try {
    return marked.parse(body);
  } finally {
    _currentImageBase = null;
  }
}

function renderSidebar(fm) {
  const rows = [];
  rows.push(
    `<div class="row"><div class="label">name</div><div class="val">${escapeHtml(fm.name || '')}</div></div>`
  );
  if (fm.shipped)
    rows.push(
      `<div class="row"><div class="label">shipped</div><div class="val">${escapeHtml(fm.shipped)}</div></div>`
    );
  if (Array.isArray(fm.stack) && fm.stack.length) {
    rows.push(
      `<div class="row"><div class="label">stack</div><div class="val">${fm.stack.map(escapeHtml).join('<br/>')}</div></div>`
    );
  }
  const link = (href, label) =>
    `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`;
  const links = [];
  if (fm.live) links.push(link(fm.live, 'live ↗'));
  if (fm.repo) links.push(link(fm.repo, 'repo ↗'));
  if (fm.release) links.push(link(fm.release, 'release ↗'));
  if (links.length)
    rows.push(
      `<div class="row"><div class="label">links</div><div class="val">${links.join('<br/>')}</div></div>`
    );
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

// Project Index — merges PROJECTS (the order + featured flag) with each
// project's frontmatter (tagline, stack, status, links). Single source of
// truth for project metadata: edit the markdown file, not data.js.
//
// Fetches all project markdown in parallel and caches the merged entries.
// Warmed in ui.init() so /projects and autocomplete don't pay the round-trip
// on first use. Falls back gracefully to bare names if a fetch fails.
let _projectIndexCache = null;
let _projectIndexPromise = null;
async function getProjectIndex() {
  if (_projectIndexCache) return _projectIndexCache;
  if (_projectIndexPromise) return _projectIndexPromise;
  _projectIndexPromise = Promise.all(
    PROJECTS.map(async (p) => {
      try {
        const text = await loadProjectMd(p.name);
        const { fm } = parseFrontmatter(text);
        return { ...p, ...fm };
      } catch {
        return p; // bare name + featured if markdown is missing
      }
    })
  ).then((entries) => {
    _projectIndexCache = entries;
    return entries;
  });
  return _projectIndexPromise;
}

// _currentReader = { adapter, name } — drives keyboard nav, history, & escape.
// `adapter` is one of projectReader / travelReader (defined below).
let _currentReader = null;

// Browser-history integration for the reader modal.
// Each reader open pushes a history entry so the browser back button closes
// the modal instead of leaving the site. Internal nav between readers
// (sidebar/arrow keys) replaces state to avoid polluting history.
let _popstateInProgress = false;
function pushReaderState(name, kind) {
  const url = readerPath(kind, name);
  if (history.state?.reader || location.pathname === url) {
    // Carry the prior `pushed` flag forward across sibling navigation.
    // Deep-link entry has no prior state, so pushed stays false.
    const pushed = !!history.state?.pushed;
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
// Adapter shape: { kind, cmdPrefix, dataAttr, list(), loadEntry(name),
//                  renderSidebar(name, data), renderBody(entry, data) }
//
// Two adapters live: projectReader, travelReader. Adding a third
// (e.g. /blog) is a new adapter, not a new pipeline.

const projectReader = {
  kind: 'project',
  cmdPrefix: '/open',
  dataAttr: 'data-open',
  list: () => PROJECTS,
  async loadEntry(name) {
    const text = await loadProjectMd(name);
    const { fm, body } = parseFrontmatter(text);
    const html = renderMarkdown(body, { imageBase: `/images/${fm.name || name}` });
    return { fm, html };
  },
  renderSidebar(_name, data) {
    return renderSidebar(data.fm);
  },
  renderBody(entry, data) {
    const title = `<h1 class="proj-title">${escapeHtml(data.fm.name || entry.name)}</h1>`;
    const tagline = data.fm.tagline
      ? `<div class="proj-tagline">${escapeHtml(data.fm.tagline)}</div>`
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
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      openProjectPhotoViewer(photos, i, projectName);
    });
  });
}

// Project-flavored photoviewer open. Same overlay as the travel viewer; we
// just construct _photoState directly from the figure list and stamp the
// titlebar to read `/open <project>` instead of `/travels <name>`.
function openProjectPhotoViewer(photos, idx, projectName) {
  _photoState = { photos, idx, travelName: null, when: '' };
  document.getElementById('photoviewer-cmd').textContent =
    `/open ${projectName}`;
  renderThumbs();
  renderPhoto();
  document.getElementById('photoviewer').hidden = false;
}

const travelReader = {
  kind: 'travel',
  cmdPrefix: '/travels',
  dataAttr: 'data-travels',
  list: () => [...TRAVELS.visited, ...TRAVELS.wishlist],
  async loadEntry(name) {
    const visited = TRAVELS.visited.find((t) => t.name === name);
    if (visited) {
      const text = await loadTravelMd(name);
      const { fm, body } = parseFrontmatter(text);
      fm.name = fm.name || name;
      fm.country = fm.country || visited.country;
      fm.photos = normalizeTravelPhotos(fm.photos, fm.name || name);
      _travelFmCache.set(name, fm);
      const html = renderMarkdown(body);
      return { fm, html, isVisited: true };
    }
    const wish = TRAVELS.wishlist.find((t) => t.name === name);
    return { entry: wish, isVisited: false };
  },
  renderSidebar(name, _data) {
    return renderTravelSidebar(name);
  },
  renderBody(entry, data) {
    if (data.isVisited) return renderTravelVisitedBody(data.fm, data.html);
    return renderTravelWishlistBody(data.entry || entry);
  },
};

async function openReader(adapter, name) {
  const list = adapter.list();
  const idx = list.findIndex((e) => e.name === name);
  if (idx < 0) return;
  const entry = list[idx];
  const prev = list[(idx - 1 + list.length) % list.length];
  const next = list[(idx + 1) % list.length];

  const data = await adapter.loadEntry(name);

  document.getElementById('reader-cmd').textContent =
    `${adapter.cmdPrefix} ${name}`;
  document.getElementById('reader-count').textContent =
    `${idx + 1} of ${list.length}`;
  document.getElementById('reader-side').innerHTML = adapter.renderSidebar(
    name,
    data
  );
  document.getElementById('reader-body').innerHTML = adapter.renderBody(
    entry,
    data
  );
  const hasPhotos = !!document.querySelector('#reader-body [data-trav-photos]');
  document.getElementById('reader-nav').innerHTML = `
    <a class="nav-link" ${adapter.dataAttr}="${escapeHtml(prev.name)}" href="#">← ${escapeHtml(prev.name)}</a>
    <span class="muted kbd-hint">[← →] navigate · [esc] close${hasPhotos ? ' · [v] photos' : ''}</span>
    <a class="nav-link" ${adapter.dataAttr}="${escapeHtml(next.name)}" href="#">${escapeHtml(next.name)} →</a>
  `;

  _currentReader = { adapter, name };
  const reader = document.getElementById('reader');
  reader.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('reader-body').parentElement.scrollTop = 0;
  if (!_popstateInProgress) pushReaderState(name, adapter.kind);

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
  const groupRow = (label) => `<div class="trav-group">${label}</div>`;
  const item = (t) => {
    const active = t.name === currentName ? ' active' : '';
    return `<a class="trav-item${active}" data-travels="${escapeHtml(t.name)}" href="/travels/${encodeURIComponent(t.name)}">${escapeHtml(t.name)}</a>`;
  };
  return (
    groupRow('visited') +
    TRAVELS.visited.map(item).join('') +
    groupRow('wishlist') +
    TRAVELS.wishlist.map(item).join('')
  );
}

function renderTravelVisitedBody(fm, html) {
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
        <button class="trav-photos-btn" tabindex="-1" data-trav-photos="${name}">
          <span class="trav-photos-label">[view all photos] ↗ <span class="muted">(${photos.length})</span></span>
        </button>
      </div>`
    : '';

  return title + sub + html + dl + photoBtn;
}

function renderTravelWishlistBody(entry) {
  const title = `<h1 class="proj-title">${escapeHtml(entry.name)}</h1>`;
  // Same country-equals-name suppression as visited entries.
  const sameAsName =
    entry.country &&
    entry.country.toLowerCase() === (entry.name || '').toLowerCase();
  const countryPart = entry.country && !sameAsName
    ? `${escapeHtml(entry.country)} · `
    : '';
  const sub = `<div class="proj-tagline">${countryPart}someday</div>`;
  const why = entry.why
    ? `<p class="trav-why">${escapeHtml(entry.why)}</p>`
    : '';
  return title + sub + why;
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
  openReader(adapter, target.name);
}

function closeReader() {
  const reader = document.getElementById('reader');
  if (!reader || reader.hidden) return;
  reader.hidden = true;
  document.body.style.overflow = '';
  _currentReader = null;
  ui.input?.focus();
  // If the modal was opened during this browsing session (pushed), undo
  // the entry. If it was a deep-link entry (replaced), silently clean the
  // URL so the visitor stays on the site instead of being navigated away.
  if (!_popstateInProgress && history.state?.reader) {
    if (history.state.pushed) {
      history.back();
    } else {
      // Deep-link entry: silently reset to root so the visitor stays on
      // the site (rather than navigating away) and the URL bar doesn't
      // keep showing /projects/spectre after the reader is closed.
      history.replaceState({}, '', '/');
    }
  }
}

// Browser back button closes the reader; forward re-opens if applicable.
window.addEventListener('popstate', () => {
  _popstateInProgress = true;
  try {
    if (!history.state?.reader) {
      closeReader();
    } else {
      const { kind, name } = history.state;
      const adapter = kind === 'project' ? projectReader : travelReader;
      openReader(adapter, name);
    }
  } finally {
    _popstateInProgress = false;
  }
});

// ── photo viewer ──────────────────────────────────────────────────
let _photoState = null; // { photos: [{src, caption}], idx, travelName, when }

function openPhotoViewer(travelName, startIdx = 0) {
  const fm = _travelFmCache.get(travelName);
  if (!fm || !fm.photos || !fm.photos.length) return;
  const idx = Math.min(Math.max(0, startIdx | 0), fm.photos.length - 1);
  _photoState = { photos: fm.photos, idx, travelName, when: fm.when || '' };
  document.getElementById('photoviewer-cmd').textContent =
    `/travels ${travelName}`;
  renderThumbs();
  renderPhoto();
  const pv = document.getElementById('photoviewer');
  pv.hidden = false;
}

// Thumbnail strip — rendered once per open, then `active` class shifts as
// the user navigates. Each thumb uses the same src as the full image, with
// background-size:cover — fine at 48px even for full-res photos.
// Derive thumb URL from full-size src: insert /thumbs/ before the filename.
// On 404, the <img> onerror handler falls back to the full-size src so
// galleries without a thumbs/ subdir still work.
function thumbSrcFor(src) {
  const slash = src.lastIndexOf('/');
  if (slash < 0) return src;
  return src.slice(0, slash) + '/thumbs/' + src.slice(slash + 1);
}

function renderThumbs() {
  if (!_photoState) return;
  const strip = document.getElementById('photoviewer-thumbs');
  const { photos } = _photoState;
  strip.innerHTML = photos
    .map((p, i) => {
      const thumb = thumbSrcFor(p.src);
      const full = encodeURI(p.src);
      return `<button class="photoviewer-thumb" data-i="${i}" aria-label="photo ${i + 1}: ${escapeHtml(p.caption || '')}"><img src="${encodeURI(thumb)}" loading="lazy" decoding="async" alt="" onerror="this.onerror=null;this.src='${full}'" /></button>`;
    })
    .join('');
  strip.querySelectorAll('.photoviewer-thumb').forEach((el) => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.i, 10);
      if (!_photoState || Number.isNaN(i)) return;
      _photoState.idx = i;
      renderPhoto();
    });
  });
}

// src -> { w, h } captured from neighbor preloads. Lets the next renderPhoto
// stamp intrinsic dimensions before the swap, so the browser allocates space
// up-front and there's no brief layout flash when portrait↔landscape.
const _photoDims = new Map();
const _photoPreloads = new Set();

function renderPhoto() {
  if (!_photoState) return;
  const { photos, idx, when } = _photoState;
  const p = photos[idx];
  const img = document.getElementById('photoviewer-img');
  const dims = _photoDims.get(p.src);
  if (dims) {
    img.width = dims.w;
    img.height = dims.h;
  } else {
    img.removeAttribute('width');
    img.removeAttribute('height');
  }
  img.src = p.src;
  img.alt = p.caption || '';
  // Cache dims for revisits even if this photo wasn't preloaded.
  if (!dims) {
    img.addEventListener(
      'load',
      () => _photoDims.set(p.src, { w: img.naturalWidth, h: img.naturalHeight }),
      { once: true }
    );
  }
  document.getElementById('photoviewer-count').textContent =
    `${idx + 1} / ${photos.length}`;
  document.getElementById('photoviewer-caption-text').textContent =
    p.caption || '';
  document.getElementById('photoviewer-caption-meta').textContent = when;

  // Mark the active thumb + scroll it into view.
  const strip = document.getElementById('photoviewer-thumbs');
  if (strip) {
    strip.querySelectorAll('.photoviewer-thumb').forEach((el, i) => {
      const active = i === idx;
      el.classList.toggle('active', active);
      if (active) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  }

  // Preload ±2 neighbors so arrow-key browsing stays instant. Each preloaded
  // Image also seeds _photoDims so the next swap has dimensions ready,
  // eliminating the portrait↔landscape relayout flash.
  const n = photos.length;
  [1, -1, 2, -2].forEach((d) => {
    const q = photos[((idx + d) % n + n) % n];
    if (!q || !q.src || _photoDims.has(q.src) || _photoPreloads.has(q.src)) return;
    _photoPreloads.add(q.src);
    const probe = new Image();
    probe.decoding = 'async';
    probe.onload = () => {
      _photoPreloads.delete(q.src);
      _photoDims.set(q.src, { w: probe.naturalWidth, h: probe.naturalHeight });
    };
    probe.onerror = () => _photoPreloads.delete(q.src);
    probe.src = q.src;
  });
}

// Touch swipe on the photoviewer stage. Horizontal swipe > 50px → navigate.
// Filtered to pointerType === 'touch' so mouse drags on desktop don't trigger.
// touch-action: pan-y in CSS allows vertical scroll to bypass this.
(function attachSwipe() {
  const stage = document.getElementById('photoviewer-stage');
  if (!stage) return;
  let startX = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    startX = e.clientX;
  });
  stage.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) navigatePhoto(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => {
    startX = null;
  });
})();

function navigatePhoto(delta) {
  if (!_photoState) return;
  const n = _photoState.photos.length;
  _photoState.idx = (_photoState.idx + delta + n) % n;
  renderPhoto();
}

function closePhotoViewer() {
  const pv = document.getElementById('photoviewer');
  if (!pv || pv.hidden) return;
  pv.hidden = true;
  _photoState = null;
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
  const pv = document.getElementById('photoviewer');
  if (pv && !pv.hidden) {
    // Photo viewer takes precedence over the reader behind it.
    if (e.key === 'Escape') {
      e.preventDefault();
      closePhotoViewer();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (shouldThrottleArrowNav(e)) return;
      navigatePhoto(-1);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (shouldThrottleArrowNav(e)) return;
      navigatePhoto(1);
      return;
    }
    return;
  }
  const reader = document.getElementById('reader');
  if (!reader || reader.hidden) return;
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
    if (e.repeat) return; // OS auto-repeat ignored; rAF loop owns the velocity
    startReaderScroll(e.key === 'ArrowDown' ? 1 : -1);
  }
  if (e.key === 'v' || e.key === 'V') {
    // Open the photoviewer for the current entry (travel reader only —
    // project reader has no `data-trav-photos` button to target).
    const trigger = document.querySelector('#reader-body [data-trav-photos]');
    if (trigger) {
      e.preventDefault();
      trigger.click();
    }
    return;
  }
  if (e.key === 'PageDown' || e.key === 'PageUp' || e.key === ' ') {
    e.preventDefault();
    const scroller = document.getElementById('reader-body')?.parentElement;
    if (!scroller) return;
    const dir = e.key === 'PageUp' || e.shiftKey ? -1 : 1;
    const factor = e.repeat ? 0.4 : 0.9;
    scroller.scrollBy({
      top: dir * scroller.clientHeight * factor,
      behavior: e.repeat ? 'auto' : 'smooth',
    });
  }
});
document.addEventListener('click', (e) => {
  if (e.target.classList?.contains('reader-backdrop')) {
    // Click backdrop closes whichever overlay is on top.
    const pv = document.getElementById('photoviewer');
    if (pv && !pv.hidden) closePhotoViewer();
    else closeReader();
  }
  if (e.target.id === 'reader-close' || e.target.closest?.('#reader-close')) {
    e.preventDefault();
    closeReader();
  }
  if (e.target.id === 'photoviewer-close' || e.target.closest?.('#photoviewer-close')) {
    e.preventDefault();
    closePhotoViewer();
  }
  const photoBtn = e.target.closest('[data-trav-photos]');
  if (photoBtn) {
    e.preventDefault();
    const startIdx = parseInt(photoBtn.dataset.idx, 10);
    openPhotoViewer(photoBtn.dataset.travPhotos, Number.isFinite(startIdx) ? startIdx : 0);
  }
  if (e.target.id === 'photoviewer-prev') {
    e.preventDefault();
    navigatePhoto(-1);
  }
  if (e.target.id === 'photoviewer-next') {
    e.preventDefault();
    navigatePhoto(1);
  }
});

// Mascot rotates by day-of-month — same mascot all day, a different one
// tomorrow. Stops the random per-refresh flicker.
const mascotEl = document.querySelector('.mascot');
if (mascotEl) {
  const day = new Date().getDate();
  mascotEl.textContent = MASCOTS[day % MASCOTS.length];
}

// Welcome · "what's new" entries from data.js. Body can contain HTML
// (project name spans etc), so it's injected via innerHTML — entries are
// author-controlled, never user input.
const whatsNewEl = document.getElementById('whats-new');
if (whatsNewEl) {
  whatsNewEl.innerHTML = WHATS_NEW.slice(0, 3).map(
    (e) =>
      `<div><span class="muted">${escapeHtml(e.date)}</span> ${e.body}</div>`
  ).join('');
}

// Footer · current location ("mode") from data.js.
const modeEl = document.getElementById('mode');
if (modeEl) modeEl.textContent = LOCATION;

// version.json is generated at deploy time by .github/workflows/deploy.yml.
// Same-origin fetch — no GitHub API, no rate limit. Silent on failure so
// local-file/`file://` previews fall back to the bare title.
fetch('/version.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null))
  .then((v) => {
    if (!v?.ver) return;
    const titleEl = document.querySelector('.welcome .title');
    if (titleEl) titleEl.textContent = `─ charlie.xue ${v.ver} ─`;
  })
  .catch(() => {});

// ── Command Registry ─────────────────────────────────────────────
// Each slash command is one entry: a function (ui, args) -> void.
// `ui.run()` dispatches via lookup instead of an if/else chain. Adding a
// new command is one new entry; behavior and data live together.
//
// The `COMMANDS` array in data.js still drives /help and autocomplete
// (those need cmd+desc, not behavior). Keeping the two related but
// separate: catalog vs. dispatch table.

async function renderProjectsList(ui) {
  const projects = await getProjectIndex();
  const renderRow = (p) => {
    const status =
      p.status === 'wip' ? `<span class="warn">[wip]</span> ` : '';
    // Stack is a YAML list in frontmatter; join with " · " for the list view.
    const stack = Array.isArray(p.stack)
      ? p.stack.join(' · ')
      : escapeHtml(p.stack || '');
    return `<div class="proj-row"><div class="proj-tick">▸</div><div class="proj-body"><div class="proj-head">${status}<a class="proj-link" data-open="${p.name}" href="/projects/${encodeURIComponent(p.name)}">${p.name} →</a><span class="proj-tag">${escapeHtml(p.tagline || '')}</span></div><div class="proj-stack">${stack}</div></div></div>`;
  };
  const featured = projects.filter((p) => p.featured);
  const others = projects.filter((p) => !p.featured);
  const hint = `<div class="proj-hint"><span class="muted">click any project to open, or type <span class="key">/open &lt;name&gt;</span></span></div>`;
  const sections = [];
  if (featured.length)
    sections.push(
      `<div class="section-head">─── featured ───</div>` +
        featured.map(renderRow).join('')
    );
  if (others.length)
    sections.push(
      `<div class="section-head">─── more ───</div>` +
        others.map(renderRow).join('')
    );
  const wrap = ui.block(hint + sections.join(''));
  attachListNav([...wrap.querySelectorAll('.proj-row')]);
}

function renderThemeList(ui) {
  const current = parseInt(document.body.dataset.theme || '0');
  const rows = THEMES.map((t, i) => {
    const swatches = [t.orange, t.yellow, t.violet, t.cyan, t.pink, t.red]
      .map(
        (c) => `<span class="theme-swatch" style="background:${c}"></span>`
      )
      .join('');
    const active =
      i === current ? `<span class="theme-active">(active)</span>` : '';
    return `<div class="theme-row"><div class="proj-tick">▸</div><div class="theme-body"><a class="proj-link theme-link" data-theme="${t.name}" href="?cmd=theme+${encodeURIComponent(t.name)}">${t.name}</a><span class="theme-swatches">${swatches}</span><span class="theme-desc">${escapeHtml(t.desc || '')}</span>${active}</div></div>`;
  }).join('');
  const wrap = ui.block(
    `<div class="proj-hint"><span class="muted">click a theme, or type <span class="key">/theme &lt;name&gt;</span></span></div>${rows}`
  );
  attachListNav([...wrap.querySelectorAll('.theme-row')]);
}

const commandHandlers = {
  clear(ui) {
    ui.main.innerHTML = '';
    clearActiveList();
    // Reset the URL so a refresh doesn't re-run the last deep-linked command.
    if (location.pathname !== '/' || location.search) {
      history.replaceState({}, '', '/');
    }
  },
  help(ui) {
    ui.block(
      COMMANDS.map(
        (c) =>
          `  <span class="key">${c.cmd.padEnd(12)}</span> <span class="muted">${c.desc}</span>`
      ).join('\n') +
        `\n\n  <span class="muted">keys: ↑↓ history · tab complete · esc cancel</span>`
    );
  },
  about(ui) {
    ui.block(ABOUT);
  },
  contact(ui) {
    ui.block(CONTACT);
  },
  source(ui) {
    ui.block(
      `<a href="https://github.com/cx18121/personal-website" target="_blank" rel="noreferrer">github.com/cx18121/personal-website</a>`
    );
  },
  projects(ui) {
    renderProjectsList(ui).catch((err) => {
      ui.block(
        `<span class="warn">couldn't load projects: ${escapeHtml(err.message)}</span>`
      );
    });
  },
  favorites(ui) {
    renderFavoritesList(ui);
  },
  travels(ui, args) {
    if (args.length === 0) {
      renderTravelsList(ui);
      return;
    }
    const target = args[0].toLowerCase();
    const visited = TRAVELS.visited.find((t) => t.name === target);
    const wish = TRAVELS.wishlist.find((t) => t.name === target);
    if (!visited && !wish) {
      ui.block(
        `<span class="warn">travels "${escapeHtml(target)}" not found</span>. try <span class="key">/travels</span> to list.`
      );
      return;
    }
    openReader(travelReader, target).catch((err) => {
      ui.block(
        `<span class="warn">couldn't load ${escapeHtml(target)}: ${escapeHtml(err.message)}</span>`
      );
    });
  },
  open(ui, args) {
    const p = PROJECTS.find((x) => x.name === args[0]);
    if (!p) {
      // Fallback to the cached index if loaded so taglines appear; otherwise
      // fall back to bare names (the index warms in the background on init).
      const projects = _projectIndexCache || PROJECTS;
      ui.block(
        `<span class="muted">usage:</span> <span class="key">/open &lt;project&gt;</span>\n` +
          projects
            .map(
              (x) =>
                `  <span class="key">/open ${x.name}</span>  <span class="muted">${x.tagline || ''}</span>`
            )
            .join('\n')
      );
      return;
    }
    renderProjectOpen(ui, p);
  },
  theme(ui, args) {
    if (args.length === 0) {
      renderThemeList(ui);
      return;
    }
    const target = args[0];
    const idx = THEMES.findIndex((t) => t.name === target);
    if (idx < 0) {
      ui.block(
        `<span class="warn">theme "${escapeHtml(target)}" not found</span>. try <span class="key">/theme</span> to list.`
      );
      return;
    }
    applyTheme(idx);
    ui.block(
      `<span class="muted">theme:</span> <span class="key">${THEMES[idx].name}</span>`
    );
  },
};

ui.init();

function updateClock() {
  const t = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
  document.getElementById('clock').textContent = t
    .replace(' AM', 'am')
    .replace(' PM', 'pm');
}
updateClock();
setTimeout(
  () => {
    updateClock();
    setInterval(updateClock, 60_000);
  },
  60_000 - (Date.now() % 60_000)
);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateClock();
});
