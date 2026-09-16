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
  { name: 'cve-intel', featured: true },
  { name: 'podium', featured: false },
  { name: 'philly-vibe-map', featured: false },
  { name: 'auto-shorts', featured: false },
  { name: 'algotrader-bridge', featured: false },
  { name: 'skyops', featured: false },
  { name: 'vulnscan', featured: false },
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

// Footer mode indicator — current location/context. Shown next to the moon
// glyph. Update when you move.
export const LOCATION = 'ithaca';

export const ABOUT = `<span class="name">charlie xue</span>
cs & statistics @ cornell

I build full-stack AI applications and ML systems. Currently focused on building for early-stage startups. SWE at Pango (YC S26).`;

export const CONTACT = `email     <button type="button" class="copy" data-copy="cx267@cornell.edu">cx267@cornell.edu</button><span class="copy-status muted" aria-live="polite"></span>
github    <a href="https://github.com/cx18121" target="_blank" rel="noreferrer">github.com/cx18121</a>
linkedin  <a href="https://www.linkedin.com/in/charles-xue/" target="_blank" rel="noreferrer">linkedin.com/in/charles-xue</a>`;

export const COMMANDS = [
  { cmd: '/about', desc: 'who I am' },
  { cmd: '/projects', desc: "what I've built" },
  { cmd: '/contact', desc: 'how to reach me' },
  { cmd: '/travels', desc: 'places visited & want to visit' },
  { cmd: '/theme', desc: 'change color scheme' },
  { cmd: '/clear', desc: 'clear the screen' },
];

// Each theme is six tones. Only the accent carries hue; it is the theme's
// signature color, chosen so the three rows in /theme read as different.
export const THEMES = [
  {
    name: 'tokyo-night',
    bg: '#1a1b26',
    fg: '#c0caf5',
    accent: '#7aa2f7',
    dim: '#8a96c2',
    mute: '#414868',
    red: '#f7768e',
  },
  {
    name: 'one-dark',
    bg: '#282c34',
    fg: '#abb2bf',
    accent: '#56b6c2',
    dim: '#9398a6',
    mute: '#3e4451',
    red: '#e06c75',
  },
  {
    name: 'catppuccin',
    bg: '#1e1e2e',
    fg: '#cdd6f4',
    accent: '#cba6f7',
    dim: '#a6adc8',
    mute: '#45475a',
    red: '#f38ba8',
  },
];
