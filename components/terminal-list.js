import { escapeHtml } from './dom.js';

export function terminalRow({ className, label, href, action, value, before = '', after = '', wholeRow = false }) {
  const attrs = `href="${escapeHtml(href)}" data-${action}="${escapeHtml(value)}"`;
  const name = `<span translate="no" class="row-name">${escapeHtml(label)}</span>`;
  const content = wholeRow
    ? `<a class="row-link row-full-link" ${attrs}>${before}${name}${after}</a>`
    : `${before}<a class="row-link" ${attrs}>${name}</a>${after}`;
  return `<div class="row-sel ${escapeHtml(className)}">${content}</div>`;
}
