// The prompt owns command matching and execution. This component owns the
// listbox, its selection, and the space it can occupy around the prompt.
export function createCommandSuggestions({ root, input, anchor, scroller, onChoose }) {
  let items = [];
  let index = 0;
  const viewport = window.visualViewport;

  function position() {
    if (!items.length) return;
    const style = getComputedStyle(root);
    const inset = parseFloat(style.getPropertyValue('--ac-inset'));
    const gap = parseFloat(style.getPropertyValue('--ac-gap'));
    const rect = anchor.getBoundingClientRect();
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    const margin = 12;
    root.style.left = `${rect.left + inset}px`;
    root.style.width = `${rect.width - 2 * inset}px`;
    root.style.maxHeight = '';
    const content = root.scrollHeight;
    const row = root.firstElementChild?.offsetHeight || 34;
    const cap = items.length > 8 ? row * 8 + 8 : content;
    const above = rect.top - top - margin - gap;
    const below = bottom - rect.bottom - margin - gap;
    const height = Math.max(0, Math.min(content, cap, Math.max(above, below)));
    root.style.top = `${below >= above ? rect.bottom + gap : rect.top - gap - height}px`;
    root.style.maxHeight = `${height}px`;
  }

  function move(delta) {
    if (!items.length) return;
    select(Math.max(0, Math.min(index + delta, items.length - 1)));
  }

  function select(next) {
    if (next === index || !items[next]) return;
    root.children[index].classList.remove('active');
    root.children[index].setAttribute('aria-selected', 'false');
    index = next;
    const option = root.children[index];
    option.classList.add('active');
    option.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  }

  function close() {
    root.classList.remove('show');
    items = [];
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function show(matches) {
    if (!matches.length) return close();
    items = matches;
    index = 0;
    root.replaceChildren(...matches.map(({ cmd, desc }, i) => {
      const option = document.createElement('div');
      option.className = i ? 'item' : 'item active';
      option.id = `command-option-${i}`;
      option.dataset.i = i;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(i === 0));
      for (const [className, text] of [['cmd', cmd], ['desc', desc]]) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text || '';
        option.append(span);
      }
      option.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') select(i);
      });
      return option;
    }));
    root.classList.add('show');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', root.firstElementChild.id);
    position();
    root.scrollTop = 0;
  }

  root.addEventListener('mousedown', (event) => event.preventDefault());
  root.addEventListener('click', (event) => {
    const option = event.target.closest('[role="option"]');
    const match = option && items[Number(option.dataset.i)];
    if (match) onChoose(match.cmd);
  });
  new ResizeObserver(position).observe(anchor);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position);
  scroller.addEventListener('scroll', position);
  viewport?.addEventListener('resize', position);
  viewport?.addEventListener('scroll', position);

  return { show, close, move, get selected() { return items[index]?.cmd; } };
}
