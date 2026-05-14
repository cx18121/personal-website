// Thin index for the /projects list. Tagline, stack, status, links etc.
// live in each project's frontmatter at content/projects/{name}.md — that
// markdown file is the single source of truth. Edit one file, not two.
//
// This array exists only to:
//   - establish the rendering order (top = most prominent)
//   - flag which projects are "featured" (above the fold) — list ordering
//     metadata, not project metadata
//   - give the autocomplete + closestCommand fast access to the name set
export const PROJECTS = [
  { name: 'sparrow', featured: true },
  { name: 'spectre', featured: true },
  { name: 'podium', featured: true },
  { name: 'philly-vibe-map', featured: true },
  { name: 'cve-intel', featured: true },
  { name: 'auto-shorts', featured: false },
  { name: 'algotrader-bridge', featured: false },
  { name: 'skyops', featured: false },
  { name: 'coursemap', featured: false },
  { name: 'vulnscan', featured: false },
  { name: 'gatekeeper', featured: false },
];

// Visited entries have full content at /content/travels/{name}.md.
// Wishlist entries are one-liners only — `why` is rendered inline.
// Ordered most-recent first (visited) / by preference (wishlist).
export const TRAVELS = {
  visited: [
    {
      name: 'yunnan',
      country: 'china',
      month: 'jul',
      year: 2024,
    },
    {
      name: 'peru',
      country: 'peru',
      month: 'jun',
      endMonth: 'jul',
      year: 2025,
    },
  ],
  wishlist: [
    {
      name: 'patagonia',
      country: 'argentina / chile',
      why: 'hike the o loop',
    },
    {
      name: 'vietnam',
      country: 'vietnam',
      why: 'motorbike around the entire country',
    },
    {
      name: 'guatemala',
      country: 'guatemala',
      why: 'see volcanos erupt',
    },
  ],
};

// Ordering rules:
//   - Section order = first-seen tag order. The first 'book' in this array
//     determines where the "books" section lands; later books cluster into it.
//   - Within-section order = array order among items sharing that tag.
//   So to put a new book at the bottom of the books section, append it after
//   the last existing book. To introduce a new section (say 'podcast'), pick
//   where you want it and place the first such entry there.
//
// Adding a new tag requires touching two other spots:
//   - app.js → FAV_TAG_LABELS                            (plural section label)
//   - styles.css → .fav-section-head[data-tag='<tag>']    (head color)
// Both degrade gracefully if missing: the head will say the singular tag in
// the default --fg color until you fill them in.
//
// Existing tag colors: book=violet, film=pink, places=cyan, food=red,
// team=yellow, restaurant=orange.
//
// `by` is optional. `blurb` is optional too — blurb-less rows are fine.
export const FAVORITES = [
  {
    tag: 'book',
    name: 'what if?',
    by: 'randall munroe',
    blurb: 'what if you could make a jetpack from a machine gun?',
  },
  {
    tag: 'book',
    name: 'murder on the orient express',
    by: 'agatha christie',
    blurb: 'my favorite mystery of all time',
  },
  {
    tag: 'book',
    name: "surely you're joking, mr. feynman!",
    by: 'richard feynman',
    blurb: 'dude is funny af',
  },
  {
    tag: 'places',
    name: 'killington',
    blurb: 'ski outer limits',
  },
  {
    tag: 'places',
    name: 'gravity vault princeton',
    blurb: 'my home gym',
  },
  {
    tag: 'food',
    name: 'japanese curry',
    blurb: 'use golden curry hot',
  },
  {
    tag: 'food',
    name: 'lanzhou beef noodles',
  },
  {
    tag: 'food',
    name: 'suan cai yu',
  },
  {
    tag: 'team',
    name: 'washington capitals',
    blurb: 'ovi is my goat',
  },
  {
    tag: 'restaurant',
    name: 'pho cali',
    by: 'philly',
    blurb: 'been going there for 15 years',
  },
  {
    tag: 'restaurant',
    name: "xi'an famous foods",
    by: 'nyc',
    blurb: 'get the liang pi',
  },
  {
    tag: 'restaurant',
    name: 'taco bell',
  },
  {
    tag: 'film',
    name: 'shawshank redemption',
  },
  {
    tag: 'film',
    name: 'good will hunting',
  },
];

export const SKILLS = {
  languages: [
    'python',
    'typescript',
    'go',
    'java',
    'c++',
    'javascript',
    'sql',
    'bash',
    'r',
  ],
  'ai / ml': [
    'pytorch',
    'sentence-transformers',
    'faiss',
    'bertopic',
    'lora',
    'mediapipe',
    'pgvector',
  ],
  frameworks: [
    'fastapi',
    'react',
    'next.js',
    'prisma',
    'anthropic api',
    'gradle',
  ],
  tools: [
    'docker',
    'aws',
    'terraform',
    'postgres',
    'linux',
    'git',
    'vercel',
    'modal',
    'supabase',
    'ghidra',
  ],
};

// Welcome panel · "what's new" entries. Most recent first. Body can include
// HTML (e.g. <span class="cmd">). Keep to 3-4 entries — this is a tease.
export const WHATS_NEW = [
  {
    date: '2026-05',
    body: 'Redesigned this site as an interactive terminal',
  },
  {
    date: '2026-05',
    body: 'Shipped <span class="cmd">sparrow</span> · automatic cold email outreach to startups, for students',
  },
  {
    date: '2026-04',
    body: 'Shipped <span class="cmd">spectre</span> · real-time 1v1 fighting, from anywhere, with just a camera',
  },
];

// Footer mode indicator — current location/context. Shown next to the moon
// glyph. Update when you move.
export const LOCATION = 'ithaca';

export const ABOUT = `charlie xue
cs & statistics @ cornell

I build full-stack AI applications and ML systems.
Currently focused on building for early-stage startups.`;

export const CONTACT = `email     <a href="mailto:cx267@cornell.edu">cx267@cornell.edu</a>
github    <a href="https://github.com/cx18121" target="_blank" rel="noreferrer">github.com/cx18121</a>
linkedin  <a href="https://www.linkedin.com/in/charles-xue/" target="_blank" rel="noreferrer">linkedin.com/in/charles-xue</a>`;

export const COMMANDS = [
  { cmd: '/about', desc: 'who I am' },
  { cmd: '/projects', desc: "what I've built" },
  { cmd: '/skills', desc: 'stack & tools' },
  { cmd: '/contact', desc: 'how to reach me' },
  { cmd: '/travels', desc: 'places visited & want to visit' },
  { cmd: '/favorites', desc: 'what i like' },
  { cmd: '/theme', desc: 'change color scheme' },
  { cmd: '/help', desc: 'show all commands' },
  { cmd: '/open', desc: 'open a project' },
  { cmd: '/clear', desc: 'clear the screen' },
  { cmd: '/source', desc: "this site's code" },
];

export const MASCOTS = [
  '    ▄▄▄▄▄▄▄\n   █ ◕   ◕ █\n   █   ▽   █\n    ▀▀▀▀▀▀▀', // default
  '    ▄▄▄▄▄▄▄\n   █ ◔   ◔ █\n   █   ─   █\n    ▀▀▀▀▀▀▀', // chill
  '    ▄▄▄▄▄▄▄\n   █ ◕   ◔ █\n   █   ‿   █\n    ▀▀▀▀▀▀▀', // winking
  '    ▄▄▄▄▄▄▄\n   █ ◐   ◑ █\n   █   ─   █\n    ▀▀▀▀▀▀▀', // scanning
  '    ▄▄▄▄▄▄▄\n   █ ◕   ◔ █\n   █   ▾   █\n    ▀▀▀▀▀▀▀', // smug
];

export const THEMES = [
  {
    name: 'classic',
    desc: 'warm orange/cream',
    bg: '#1a1a1a',
    fg: '#e5e2dd',
    orange: '#d97757',
    dim: '#7a7670',
    mute: '#5c5852',
    yellow: '#c9a96e',
    violet: '#b08ad6',
    cyan: '#6fb1bc',
    pink: '#d36a8c',
    red: '#d96363',
  },
  {
    name: 'tokyo-night',
    desc: 'cool blue/purple',
    bg: '#1a1b26',
    fg: '#c0caf5',
    orange: '#ff9e64',
    dim: '#565f89',
    mute: '#414868',
    yellow: '#e0af68',
    violet: '#bb9af7',
    cyan: '#7dcfff',
    pink: '#f7768e',
    red: '#f7768e',
  },
  {
    name: 'one-dark',
    desc: 'atom editor classic',
    bg: '#282c34',
    fg: '#abb2bf',
    orange: '#d19a66',
    dim: '#5c6370',
    mute: '#3e4451',
    yellow: '#e5c07b',
    violet: '#c678dd',
    cyan: '#56b6c2',
    pink: '#e06c75',
    red: '#e06c75',
  },
  {
    name: 'crt-green',
    desc: 'retro phosphor',
    bg: '#001100',
    fg: '#00ff66',
    orange: '#00ff66',
    dim: '#008833',
    mute: '#005522',
    yellow: '#ccff66',
    violet: '#66ff99',
    cyan: '#33ffaa',
    pink: '#88ff88',
    red: '#ff3366',
  },
  {
    name: 'solarized',
    desc: 'muted teal/cyan',
    bg: '#002b36',
    fg: '#93a1a1',
    orange: '#cb4b16',
    dim: '#586e75',
    mute: '#475a62',
    yellow: '#b58900',
    violet: '#6c71c4',
    cyan: '#2aa198',
    pink: '#d33682',
    red: '#dc322f',
  },
  {
    name: 'catppuccin',
    desc: 'pastel mauve/peach',
    bg: '#1e1e2e',
    fg: '#cdd6f4',
    orange: '#fab387',
    dim: '#a6adc8',
    mute: '#45475a',
    yellow: '#f9e2af',
    violet: '#cba6f7',
    cyan: '#74c7ec',
    pink: '#f5c2e7',
    red: '#f38ba8',
  },
  {
    name: 'dracula',
    desc: 'saturated purple/pink',
    bg: '#282a36',
    fg: '#f8f8f2',
    orange: '#ffb86c',
    dim: '#6272a4',
    mute: '#44475a',
    yellow: '#f1fa8c',
    violet: '#bd93f9',
    cyan: '#8be9fd',
    pink: '#ff79c6',
    red: '#ff5555',
  },
];
