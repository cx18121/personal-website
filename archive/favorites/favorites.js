// Archived /favorites command. Not imported anywhere. See README.md.

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
