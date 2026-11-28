---
name: verify-longevity
description: Drive the 活得更久 / Live Longer static site (longevity.xiaoxiaodong.ai) in a local wrangler dev instance with headless Chrome, the way a reader uses it, and capture screenshots, page text and HTTP results as proof. Use after changing pages, styles, site.js, translations, SEO output or wrangler.jsonc, before deploying, or whenever a claim about how the site behaves needs evidence.
---

# Verify the Live Longer site

The site is static. `npm run build` writes 625 pages in 8 languages to `dist/`, and Cloudflare Workers static assets serves them (`wrangler.jsonc`). There is no login, no database and no server code. Readers do seven things, and each has a journey in `journeys/` and a recipe in `features/`.

The helper `drive.ts` does everything: it checks the build, starts one `wrangler dev` and one headless Chrome, plays a journey, saves evidence and stops both. Run every command from the repo root.

## Launch

```sh
npm run build                                   # dist/ must be current; doctor checks it
node .claude/skills/verify-longevity/drive.ts run .claude/skills/verify-longevity/journeys/<feature>.json
```

`run` launches the instance itself:

- `npx wrangler@4 dev --ip 127.0.0.1 --port <free port>` serves `dist/` with the production asset rules: `/zh/about` answers 307 to `/zh/about/`, and a missing page gets the nearest `404.html` with status 404. `python3 -m http.server` does neither, so never verify 404s or redirects with it.
- Ready means `Ready on` is printed **and** `/zh/` returns 200. It takes 10 to 25 seconds. The ready line names the pid and port.
- Headless Chrome starts with a throwaway profile in `$TMPDIR/verify-longevity-*`, so stored theme choices never leak between runs or into the user's browser.

Teardown is automatic when the run ends, fails or is interrupted. `run` exits 1 if any step failed.

## Doctor

```sh
node .claude/skills/verify-longevity/drive.ts doctor
```

Read-only. Every line must say `ok`:

- `dist/ built` and `dist/ is current`: `dist/index.html` exists and is newer than everything in `src/`, `content/`, `data/` and `scripts/`. Otherwise run `npm run build`.
- `dist/ matches data/upstream`: the about page names the commit in `data/upstream/SOURCE.json`.
- `Chrome`: the binary exists. Set `CHROME_EXE` to use another.
- `no leftover instance of ours`: no pid in `.verify/pids.json` is alive. If one is, another verify run is going or one crashed. Do not drive alongside it. Run `cleanup` only if you know it is stranded.
- `dev servers on this Mac < 3`: this Mac allows at most 3 dev servers at once (user rule). Other sessions' servers are not ours to stop. Wait instead.

`run` calls doctor first and refuses to start on any `FAIL`.

## Drive

A journey is JSON: `{ "name": "...", "steps": [ ... ] }`. Steps run in order:

| Step | What it does |
| --- | --- |
| `{ "go": "/zh/", "width": 390, "scheme": "light", "acceptLanguage": "zh-CN", "noScript": false, "expectStatus": 200 }` | Navigate like a reader. Width 390 is a phone and 1440 a desktop. The defaults are 390, light and `zh-CN,zh;q=0.9`. |
| `{ "click": "<css>", "text": "<visible text>", "nav": true }` | A real mouse press and release at the first line box of the first match. `text` picks the match by its visible label. `nav` waits for the next page load. |
| `{ "type": "<css>", "text": "咖啡" }` | Focus the field, select its contents and type over them. |
| `{ "choose": "<css select>", "value": "drinking" }` | Pick a `<select>` option by value. See the Gotchas in `features/README.md`. |
| `{ "press": "Escape" }` | Escape, Enter, Tab, ArrowDown, ArrowUp or Space. |
| `{ "waitFor": "<js>", "timeout": 5000 }` | Wait until the expression is truthy. |
| `{ "expect": "<js>", "label": "..." }` | Fail the step unless the expression is truthy. |
| `{ "read": "<js>", "label": "..." }` | Record a value in the log without judging it. |
| `{ "shot": "name", "viewport": false }` | Full-page PNG. Set `viewport` for menus and popovers. |
| `{ "snapshot": "name" }` | The URL, title, lang, dir, theme and visible text of `<main>`. |
| `{ "fetch": "/robots.txt", "label": "...", "expectStatus": 200 }` | A plain HTTP request without redirects, for headers and status. |

Use stable handles that already exist in the markup: ids (`#filter-q`, `#filter-topic`, `#appearance-pop`), `data-filter-*` attributes, `aria-label` on `nav`, `hreflang` on language links, and `href` endings such as `a.topic-card[href$='/topics/drinking/']`. Never use coordinates or nth-child.

For a check no journey covers yet, copy the closest journey to `$TMPDIR`, edit it and run it. Add it to `journeys/` and its feature file once it proves something lasting.

Pass `--keep-going` to play every step even after a failure, which is useful when you are fixing several at once.

## Evidence

Each run writes `.verify/<UTC time>-<journey name>/`, which git ignores:

- `log.jsonl` has one line per step with the step, `ok`, the page path `at`, any `value`, `status` or `error`, and file paths.
- `NN-<name>.png` and `NN-<name>.txt` come from `shot` and `snapshot`. A failed step adds `NN-failure.png` of the viewport.
- `summary.txt` gives pass or fail, the journey file and the build time of `dist/`.

Proof standards:

- Drive what a reader does: click the card, type in the box, follow the link. Never call `site.js` functions or set state that a reader cannot.
- Record the action and the state it produced. Pair every `click` or `type` with an `expect` on what changed, such as the URL, the count text or `data-theme`, as well as a `shot`.
- A screenshot alone is not proof. Pair it with an `expect` or a `snapshot`, and open the PNG and look at it before you claim anything from it.
- Check the side effects a reader relies on: the URL query after filtering, `localStorage` theme persistence across pages, HTTP status and `noindex` on 404s.
- Report what the log shows, with the evidence folder path. A skipped feature is reported as skipped, never as covered by a different journey.

## Cleanup

`run` stops what it started. It kills the process group of each pid it recorded (wrangler, workerd, Chrome and Chrome helpers), waits for them to exit, deletes `.verify/pids.json` and the Chrome profile, and prints `stopped wrangler dev <pid>, chrome <pid>`. If a run was killed with `kill -9` or the machine slept, run:

```sh
node .claude/skills/verify-longevity/drive.ts cleanup
lsof -i :<port from the ready line>             # must print nothing
```

`cleanup` kills only pids that `drive.ts` recorded, never anything by name. Evidence in `.verify/` survives cleanup. Delete old evidence folders yourself when they are no longer needed.

## Helpers

- `drive.ts` is the whole harness. It runs on Node 26 with no dependencies, and its usage is shown above. `npm run typecheck` covers it.
- `journeys/*.json` hold one journey per feature in `features/`.
- `npm run screenshots` (in `scripts/`) is a separate visual sweep of about 30 pages at both widths over `python3 -m http.server`. Use it for layout review. It cannot prove 404s or redirects.
- `npm run check` is the static check of `dist/`: links, lang, canonical, hreflang, sitemap and structured data. Run it alongside a journey and do not count it as one.

The `collect/` scripts (PubMed fetch, bot runner, validator) are a second, internal CLI surface. They are not part of the reader-facing site and are not mapped here. `collect/README.md` describes how to check them.
