// The /projects index. Everything the list rows, the /open autocomplete,
// and the reader header need — so all of it is in the first payload and
// the landing screen paints without a single fetch. Heavier per-project
// detail (stack, links, shipped, screenshots) stays in that project's
// frontmatter at content/projects/{name}.md and is loaded on open.
//
// Projects are shown in this order. Only `wip` gets a status badge.
export const PROJECTS = [
  {
    name: 'sparrow',
    tagline: 'cold email startups automatically',
    status: 'live',
  },
  {
    name: 'spectre',
    tagline: '1v1 fighting game with your phone as a motion controller',
    status: 'live',
  },
  {
    name: 'cve-intel',
    tagline: 'natural language CVE search and analysis engine',
    status: 'live',
  },
  {
    name: 'podium',
    tagline: 'on-device speech practice app',
    status: 'live',
  },
  {
    name: 'philly-vibe-map',
    tagline: 'view neighborhood vibes from 1.1M yelp reviews',
    status: 'live',
  },
  {
    name: 'auto-shorts',
    tagline: 'end-to-end shortform video pipeline',
    status: 'live',
  },
  {
    name: 'algotrader-bridge',
    tagline: 'turn tradingview signals into automatic ibkr trading',
    status: 'live',
  },
  {
    name: 'skyops',
    tagline: 'charter flight operations platform',
    status: 'live',
  },
  {
    name: 'vulnscan',
    tagline: 'AST-based python vuln scanner with fix suggestions',
    status: 'dormant',
  },
];

// Each trip has a matching entry at /content/travels/{name}.md.
export const TRAVELS = [
  { name: 'yunnan', country: 'china', month: 'jul', year: 2024 },
  { name: 'peru', country: 'peru', month: 'jun', endMonth: 'jul', year: 2025 },
];

export const ABOUT = `Hi, I'm Charlie. I'm studying Computer Science and Statistics at Cornell University.

I love building full-stack applied AI apps and optimizing agent harnesses.

I'm currently a software engineer at Pango (YC S26) where I build agents to automate e-commerce operations.

In my free time, I enjoy rock climbing, hiking, and skiing. I was also 7x challenger and peaked at top 20 in North America (top 0.004%) in Teamfight Tactics.`;

export const CONTACT = `email     <button type="button" class="copy" data-copy="cx267@cornell.edu">cx267@cornell.edu</button><span class="copy-status muted" aria-live="polite"></span>
github    <a href="https://github.com/cx18121" target="_blank" rel="noreferrer">github.com/cx18121</a>
linkedin  <a href="https://www.linkedin.com/in/charles-xue/" target="_blank" rel="noreferrer">linkedin.com/in/charles-xue</a>`;

export const COMMANDS = [
  { cmd: '/about', desc: 'info about me' },
  { cmd: '/projects', desc: 'some things I’ve built' },
  { cmd: '/contact', desc: 'how to reach me' },
  { cmd: '/travels', desc: 'places I’ve visited' },
  { cmd: '/theme', desc: 'change the color scheme' },
  { cmd: '/help', desc: 'list commands' },
  { cmd: '/clear', desc: 'return to the clean homepage' },
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
    red: '#ee7c86',
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
