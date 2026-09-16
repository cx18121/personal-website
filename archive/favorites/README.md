# /favorites (archived)

Removed from the live site. Everything needed to bring it back is in this folder.

To restore:

1. `favorites.js`: move `FAVORITES` (with its ordering comment) back into `data.js`, and `FAV_TAG_LABELS` plus `renderFavoritesList` back into `app.js` next to `renderTravelsList`. Import `FAVORITES` in `app.js`.
2. `favorites.css`: paste back into `styles.css` before the focus-visible section, and add `.fav-marker` back to the `.list-active .proj-tick` rule.
3. Wire the command: add `favorites(ui) { renderFavoritesList(ui); }` to `commandHandlers`, `{ cmd: '/favorites', desc: 'what i like' }` to `COMMANDS` in `data.js`, and `'/favorites'` to `STATIC_ROUTES`.
4. Add `/favorites` back to the landing `# more:` line and to `sitemap.xml`.
