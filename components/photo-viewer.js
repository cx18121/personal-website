import { escapeHtml, setOverlayTitle } from './dom.js';

// Thumbnail strip — rendered once per open, then `active` class shifts as
// the user navigates. Each thumb uses the same src as the full image, with
// background-size:cover — fine at 48px even for full-res photos.
// Derive thumb URL from full-size src: insert /thumbs/ before the filename.
// On 404, the <img> onerror handler falls back to the full-size src so
// galleries without a thumbs/ subdir still work.
export function thumbSrcFor(src) {
  const slash = src.lastIndexOf('/');
  if (slash < 0) return src;
  return src.slice(0, slash) + '/thumbs/' + src.slice(slash + 1);
}

// The same gallery is used for project screenshots and travel photos.
export function createPhotoViewer({ root, reader, reducedMotion, keepTabInOverlay, shouldThrottleArrowNav }) {
  let _photoState = null;
  let _photoReturnFocus = null;
  const REDUCE_MOTION = reducedMotion;

  function open({ photos, idx, kind, name, when = '', trigger }) {
    if (!photos.length) return;
    _photoState = { photos, idx, when };
    _photoReturnFocus = trigger;
    setOverlayTitle('photoviewer-cmd', kind, name);
    reader.inert = true;
    root.hidden = false;
    renderThumbs();
    root.querySelector('.reader-close').focus({ preventScroll: true });
    renderPhoto();
  }

  function renderThumbs() {
    if (!_photoState) return;
    const strip = root.querySelector('.photoviewer-thumbs');
    const { photos } = _photoState;
    strip.innerHTML = photos
      .map((p, i) => {
        const thumb = thumbSrcFor(p.src);
        const full = encodeURI(p.src);
        return `<button type="button" class="photoviewer-thumb" data-i="${i}" aria-label="${escapeHtml(`photo ${i + 1}${p.caption ? ': ' + p.caption : ''}`)}"><img width="48" height="48" src="${encodeURI(thumb)}" loading="lazy" decoding="async" alt="" onerror="this.onerror=null;this.src='${full}'" /></button>`;
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
    // Dim while the new bytes arrive so the swap never shows a blank stage.
    // `complete` is true synchronously for cached images, so nothing flickers
    // when the neighbor preload already landed.
    img.classList.toggle('loading', !img.complete);
    img.addEventListener(
      'load',
      () => {
        img.classList.remove('loading');
        if (!dims) _photoDims.set(p.src, { w: img.naturalWidth, h: img.naturalHeight });
      },
      { once: true }
    );
    img.addEventListener('error', () => img.classList.remove('loading'), { once: true });
    document.getElementById('photoviewer-count').textContent =
      `${idx + 1} / ${photos.length}`;
    document.getElementById('photoviewer-caption-text').textContent =
      p.caption || '';
    document.getElementById('photoviewer-caption-meta').textContent = when;
    document.getElementById('photoviewer-status').textContent =
      `Photo ${idx + 1} of ${photos.length}${p.caption ? `. ${p.caption}` : ''}`;

    // Mark the active thumb + scroll it into view.
    const strip = root.querySelector('.photoviewer-thumbs');
    if (strip) {
      strip.querySelectorAll('.photoviewer-thumb').forEach((el, i) => {
        const active = i === idx;
        el.classList.toggle('active', active);
        if (active) {
          el.setAttribute('aria-current', 'true');
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        } else {
          el.removeAttribute('aria-current');
        }
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

  // Touch swipe on the photoviewer stage. The photo tracks the finger 1:1
  // and commits on release by velocity sign, falling back to distance for
  // a slow drag. The set loops, so there is no edge to rubber-band against.
  // Filtered to touch so mouse drags on desktop don't trigger.
  // touch-action: pan-y keeps vertical scroll native.
  function attachSwipe() {
    const stage = document.getElementById('photoviewer-stage');
    const img = document.getElementById('photoviewer-img');
    if (!stage || !img) return;
    let startX = null;
    let lastX = 0;
    let lastT = 0;
    let vx = 0; // px/ms, smoothed
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || !e.isPrimary || e.target.closest('button')) return;
      startX = lastX = e.clientX;
      lastT = e.timeStamp;
      vx = 0;
      img.classList.add('dragging');
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {}
    });
    stage.addEventListener('pointermove', (e) => {
      if (startX === null) return;
      const dt = e.timeStamp - lastT || 1;
      vx = 0.7 * vx + 0.3 * ((e.clientX - lastX) / dt);
      lastX = e.clientX;
      lastT = e.timeStamp;
      if (!REDUCE_MOTION.matches) img.style.transform = `translateX(${e.clientX - startX}px)`;
    });
    const release = (commit) => {
      if (startX === null) return;
      const dx = lastX - startX;
      startX = null;
      img.classList.remove('dragging');
      img.style.transform = '';
      if (!commit) return;
      const fast = Math.abs(vx) > 0.4;
      const far = Math.abs(dx) > 60;
      if (fast) navigatePhoto(vx < 0 ? 1 : -1);
      else if (far) navigatePhoto(dx < 0 ? 1 : -1);
    };
    stage.addEventListener('pointerup', () => release(true));
    stage.addEventListener('pointercancel', () => release(false));
  }
  attachSwipe();

  function navigatePhoto(delta) {
    if (!_photoState) return;
    const n = _photoState.photos.length;
    _photoState.idx = (_photoState.idx + delta + n) % n;
    renderPhoto();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    reader.inert = false;
    const trigger = _photoReturnFocus?.isConnected ? _photoReturnFocus : document.getElementById('reader-close');
    trigger.focus({ preventScroll: true });
    _photoReturnFocus = null;
    _photoState = null;
  }


  function handleKey(event) {
    if (root.hidden) return false;
    keepTabInOverlay(event, root);
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (!shouldThrottleArrowNav(event)) navigatePhoto(event.key === 'ArrowRight' ? 1 : -1);
    }
    return true;
  }

  root.addEventListener('click', (event) => {
    if (event.target.matches('.reader-backdrop') || event.target.closest('.reader-close')) close();
    else if (event.target.closest('.photoviewer-arrow.l')) navigatePhoto(-1);
    else if (event.target.closest('.photoviewer-arrow.r')) navigatePhoto(1);
  });

  return { open, close, handleKey };
}
