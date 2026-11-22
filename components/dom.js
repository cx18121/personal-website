export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
}

export function setOverlayTitle(id, kind, name) {
  document.getElementById(id).innerHTML =
    `<span class="path">${kind}/</span>${escapeHtml(name)}`;
}
