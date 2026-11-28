# Missing pages and crawler files

A reader who follows a broken link gets a real 404 in the right language, with links that lead back into the site, and search engines are told not to index it. Crawlers get `robots.txt` and `sitemap.xml`, and URLs without a trailing slash redirect to the canonical one.

## Sub-features

- `nf-status` answers 404 for a missing page.
- `nf-locale` serves the nearest language's `404.html` (`/fr/...` gets French, anything else gets English).
- `nf-noindex` sets `meta name="robots" content="noindex"` with no canonical link.
- `nf-onward` offers links to the home page, myths and all studies, plus topic cards.
- `crawl-redirect` answers 307 from `/zh/about` to `/zh/about/`.
- `crawl-files` serves `/robots.txt` and `/sitemap.xml` with 200.

## How to get to it (user POV)

- Open any URL that does not exist, such as `/fr/pas-de-page/`.
- A crawler requests `/robots.txt` and `/sitemap.xml`.

## Driving it with drive.ts

Preconditions:

- The baseline preconditions in `README.md` hold. These behaviors exist only under `wrangler dev` or in production, never under `python3 -m http.server`.

- **Redirect.** Step `{ "fetch": "/zh/about", "expectStatus": 307 }`. The log's `location` ends with `/zh/about/`.
- **Crawler files.** Steps `{ "fetch": "/robots.txt", "expectStatus": 200 }` and `{ "fetch": "/sitemap.xml", "expectStatus": 200 }`. The log's `body` starts with `User-agent` and `<?xml`.
- **French 404.** Step `{ "go": "/fr/pas-de-page/", "expectStatus": 404 }`. `lang` is `fr`, robots is `noindex`, and there is no `link[rel=canonical]`.
- **Onward.** Step `{ "click": "main a[href='/fr/studies/']", "nav": true }`. The path is `/fr/studies/`.
- **Root 404.** Step `{ "go": "/no-such-page/", "expectStatus": 404 }`. `lang` is `en`.
- **Proof.** Run `journeys/not-found-and-crawlers.json`. The evidence holds `log.jsonl` with the statuses and `11-root-404.png`.

## Gotchas

- Links on 404 pages are root-absolute (`/fr/studies/`), unlike every other page, because the same file answers at any depth. Select them with an exact `href`.
- At 390 px "Toutes les études" wraps onto two lines. An older driver clicked the neighbouring myths link here. Keep `click` aiming at the first line box.
- Production adds Cloudflare's own headers. The journey proves status and content only, not caching.
