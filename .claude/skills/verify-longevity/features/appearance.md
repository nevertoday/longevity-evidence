# Choose appearance

A reader can force light or dark, or follow the system, from the appearance button in the header. The choice persists across pages and languages on this device.

## Sub-features

- `appearance-open` shows the button once the kit script loads, and opens the `#appearance-pop` popover.
- `appearance-pick` applies `亮` (light), `暗` (dark) or `跟随系统` (follow system) to `document.documentElement.dataset.theme`.
- `appearance-persist` keeps the choice on later pages through `localStorage`.

## How to get to it (user POV)

- Choose the appearance button (`.xxd-appearance-btn`, `aria-label="外观"` in Chinese) in the header, then a mode.

## Driving it with drive.ts

Preconditions:

- The baseline preconditions in `README.md` hold.
- A fresh profile, which `drive.ts` always gives, starts with no stored choice. The system scheme is light.

- **Button.** Step `{ "go": "/zh/", "scheme": "light" }`, then `{ "waitFor": "!document.querySelector('.xxd-appearance-btn').hidden" }`. The theme is `light`.
- **Open.** Step `{ "click": ".xxd-appearance-btn" }`. `#appearance-pop` matches `:popover-open`.
- **Pick dark.** Step `{ "click": "#appearance-pop button", "text": "暗" }`. `data-theme` is `dark` while the system stays light.
- **Persist.** Step `{ "go": "/en/about/", "scheme": "light" }`. `data-theme` is still `dark`.
- **Proof.** Run `journeys/appearance.json`. The evidence holds `06-popover.png` (viewport) and `12-about-dark.png`.

## Gotchas

- The button stays `hidden` until the UI kit's script mounts the popover, so wait for it before clicking.
- The popover also holds swatch buttons without text. Select a mode by its visible text, never by position.
- The popover labels are translated on other language pages. Record them with a `read` step before you select one by text.
