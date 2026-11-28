# Live Longer verification map

This directory is the maintained source for verifying what readers of the Live Longer site can do. Read this index, then use the matching feature file as the recipe. Each feature has a journey in `../journeys/` that plays the whole recipe.

## Baseline preconditions

- `npm run build` has run since the last change to `src/`, `content/`, `data/` or `scripts/`.
- `node .claude/skills/verify-longevity/drive.ts doctor` prints only `ok` lines.
- The instance is the one `drive.ts run` starts for this journey. Never point a journey at another session's server or at production.
- The content is the pinned upstream snapshot (`data/upstream/SOURCE.json`, 64 studies). Counts in the recipes, such as 64, 8 and 7, hold for that snapshot. When upstream is synced, update the counts in the recipe and the journey together.

## Driving conventions

- Run every recipe with `node .claude/skills/verify-longevity/drive.ts run .claude/skills/verify-longevity/journeys/<feature>.json`.
- Every journey starts on a fresh Chrome profile, so no theme choice or filter is left over from another run.
- Prefer ids, `data-*` attributes, `aria-label`, `hreflang` and `href` endings. Never use coordinates or positions in a list.
- Treat selectors and values in the recipes as literal.
- Default viewport is a 390-wide phone with a light system theme and Chinese as the browser language. A step that needs another setting says so.

## Proof and skip reporting

- Pair each reader action with an `expect` on the state it changed, plus a `shot` or `snapshot`.
- Open at least one PNG per journey and look at it before reporting.
- Report the evidence folder `.verify/<time>-<journey>/` and the summary line.
- Report an unreachable path with the failing step from `log.jsonl` and its `NN-failure.png`.
- Do not report a feature as verified through a different feature's journey.

## Gotchas (apply to every feature)

- `choose` sets a `<select>` value and fires `input` and `change`. Headless Chrome cannot open the native option list, so this is the one step that does not go through the pointer. Everything that happens after the event is the real `site.js` path.
- `python3 -m http.server` (used by `npm run screenshots`) ignores `404.html` and never redirects to the trailing slash. Prove 404s and redirects only through `drive.ts`.
- A wrapped inline link's bounding box can be centred on its neighbour. `click` aims at the first line box, so prefer a selector that matches the link itself, not its parent.
- Full-page shots of long pages run past 10,000 px. Use `"viewport": true` for anything that floats, such as menus, popovers and the language list.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the reader-visible behavior, then exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with drive.ts` (starting with `Preconditions:`), and `Gotchas`.

## Features

- [Browse by topic](./browse.md) covers home → topic → study and the breadcrumb back.
- [Read a study](./study-page.md) covers the storyline, dates, sources, the raw-data fold and structured data.
- [Check a popular claim](./myths.md) covers the myths page cards, their verdict groups and the link to the full original claim.
- [Find studies](./study-list.md) covers search, topic, grade and direction filters, the empty state, reset, shareable URLs and no-JS.
- [Switch language](./languages.md) covers the language menu, right-to-left Arabic and the root page's language redirect.
- [Choose appearance](./appearance.md) covers the theme popover and its persistence across pages.
- [Missing pages and crawler files](./not-found-and-crawlers.md) covers the 404 pages, the trailing-slash redirect, robots.txt and sitemap.xml.
