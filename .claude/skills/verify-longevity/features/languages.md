# Switch language

Every page exists in eight languages. A reader switches through the language menu and lands on the same page in the new language. Arabic reads right to left. The bare root URL sends a visitor to the language their browser prefers, and without JavaScript it lists every language instead.

## Sub-features

- `lang-menu` opens the `details.site-lang__details` menu and closes it with Escape or an outside click.
- `lang-switch` moves to the same page in the chosen language.
- `lang-rtl` gives Arabic pages `dir="rtl"`.
- `lang-root` sends `/` to `/zh/` for Chinese, `/fr/` for French and `/en/` for any unsupported language.
- `lang-root-nojs` lists links to all eight languages on `/` without scripts.

## How to get to it (user POV)

- Choose the language button (`summary.site-lang__trigger`, showing the current language name) in the header, then a language.
- Open `https://longevity.xiaoxiaodong.ai/` with any browser language.

## Driving it with drive.ts

Preconditions:

- The baseline preconditions in `README.md` hold.

- **Open menu.** Step `{ "go": "/zh/studies/coffee/" }`, then `{ "click": "summary.site-lang__trigger" }`. `.site-lang__details` is open.
- **Switch.** Step `{ "click": ".xxd-menu__item[hreflang='en']", "nav": true }`. The path is `/en/studies/coffee/` and `lang` is `en`.
- **Escape.** Open the menu again, then `{ "press": "Escape" }`. The menu is closed.
- **Arabic.** Step `{ "go": "/ar/studies/coffee/" }`. `dir` is `rtl` and `lang` is `ar`.
- **Root redirect.** Step `{ "go": "/", "acceptLanguage": "fr-FR,fr;q=0.9" }`, then `{ "waitFor": "location.pathname === '/fr/'" }`. Repeat with `zh-CN` (expect `/zh/`) and `ko-KR` (expect `/en/`).
- **Root without JS.** Step `{ "go": "/", "noScript": true }`. At least eight `a[hreflang]` links are present.
- **Proof.** Run `journeys/languages.json`. The evidence holds `04-menu-open.png` (viewport), `12-ar-coffee.png` and `21-root-nojs.txt`.

## Gotchas

- Chinese uses `hreflang="zh-CN"` while its path is `/zh/`. Select by `hreflang`, then assert the path.
- The root redirect runs in an inline script after load. Use `waitFor` on the path, not an `expect` right after `go`.
- `acceptLanguage` sets both the header and `navigator.languages`. The redirect reads `navigator.languages`.
