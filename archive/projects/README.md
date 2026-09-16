# Archived projects

Project pages removed from the live site. To restore one:

1. Move `<name>.md` back to `content/projects/`.
2. Move `images/<name>/` back to `images/` if present (the markdown references `hero`, resolved relative to `/images/<name>/`).
3. Add `{ name: '<name>', featured: false }` to `PROJECTS` in `data.js` at the position you want it listed.
4. Add `https://charliexue.com/projects/<name>` back to `sitemap.xml`.
