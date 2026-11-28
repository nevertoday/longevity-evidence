# Find studies

The study list shows all 64 studies and lets a reader narrow them by keyword, topic, grade and whether the habit helps or harms. The URL carries the filters so a filtered list can be shared. Without JavaScript the page still lists every study.

## Sub-features

- `list-search` filters by keyword typed in `#filter-q`.
- `list-select` filters by `#filter-topic`, `#filter-grade` and `#filter-direction`.
- `list-count` updates the `[data-filter-count]` text, for example `显示 8 / 64 项`.
- `list-empty` shows `[data-filter-empty]` when nothing matches.
- `list-reset` shows `[data-filter-reset]` only while a filter is set, and clears every filter and the URL query.
- `list-url` writes filters to the query string and restores them from a shared link.
- `list-nojs` keeps the form hidden and all 64 cards visible when scripts are off.

## How to get to it (user POV)

- Choose `全部研究` in the site navigation, or open `/zh/studies/`.
- Open a shared link such as `/zh/studies/?topic=drinking&grade=B`.

## Driving it with drive.ts

Preconditions:

- The baseline preconditions in `README.md` hold.

- **Ready.** Step `{ "go": "/zh/studies/" }`, then `{ "waitFor": "!document.querySelector('#filter').hidden" }`. The count reads `显示 64 / 64 项`.
- **Topic.** Step `{ "choose": "#filter-topic", "value": "drinking" }`. The count reads `显示 8 / 64 项`, every visible card has `data-topic="drinking"`, the URL query is `?topic=drinking`, and the reset link is visible.
- **Keyword.** Step `{ "type": "#filter-q", "text": "咖啡" }`. The visible cards include `…/studies/coffee/`, and the URL has `q=咖啡`.
- **No match.** Step `{ "type": "#filter-q", "text": "火山" }`. The field holds `火山` and `[data-filter-empty]` is visible.
- **Reset.** Step `{ "click": "[data-filter-reset]" }`. The count returns to `64 / 64`, the query string is empty and the reset link is hidden.
- **Shared link.** Step `{ "go": "/zh/studies/?topic=drinking&grade=B" }`. The selects hold `drinking` and `B`, and the count reads `显示 7 / 64 项`.
- **No JavaScript.** Step `{ "go": "/zh/studies/?topic=drinking", "noScript": true }`. `[data-filter-list] > *` has 64 children.
- **Proof.** Run `journeys/study-list.json`. The evidence holds `14-filtered.png`, `17-empty.png` and `27-nojs.png`.

## Gotchas

- `choose` is the only step that sets a value directly. See `README.md`.
- Keyword matching uses NFKC lowercase over each card's `data-search` text, and every word must match. `咖啡` also matches the tea study, whose text mentions coffee. Assert that coffee is present, not that it is the only match.
- An unknown select value in a shared link, such as `?topic=nope`, is ignored, not applied.
- Reset clears the form in a `setTimeout` after the `reset` event. Wait for the count before you assert.
