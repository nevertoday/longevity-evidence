# Check a popular claim

The myths page lists 30 claims from the original guide, grouped by verdict (wrong, partly right, no direct evidence). Each card asks the reader's question, states the claim in one line under `网上说`, gives the research answer under `研究实际发现`, and ends with the verdict and the evidence strength. The home page shows a few of the same cards.

## Sub-features

- `myths-groups` puts the cards in three verdict sections, each with a count and a one-line meaning.
- `myths-card` gives every card a question title and two labelled lines, the claim and the finding.
- `myths-open` opens the study, whose claim section repeats the short claim and whose raw-data fold keeps the full original wording.
- `myths-home` shows the same card on the home page.

## How to get to it (user POV)

- Choose `流行说法` in the site navigation, or open `/zh/myths/`.
- On the home page, choose a card in the popular-claims section or `看全部 30 条说法`.

## Driving it with drive.ts

Preconditions:

- The baseline preconditions in `README.md` hold.

- **Cards.** Step `{ "go": "/zh/myths/", "width": 1440, "expectStatus": 200 }`. There are 30 `.myth-card` elements, and each has `.study-card__title` plus two `.myth-card__line .kicker` labels.
- **Open.** Step `{ "click": ".myth-card[href$='/studies/nuts-general/']", "nav": true }`. The path is `/zh/studies/nuts-general/` and `section[aria-labelledby=claim] blockquote` contains `39%`.
- **Original wording.** Step `{ "click": "details.raw > summary" }`. The fold contains `7216`, a figure that exists only in the full original claim.
- **Other languages.** Steps `{ "go": "/en/myths/", "width": 1440 }` and `{ "go": "/de/myths/", "width": 390 }` render 30 cards. Look at the shots for overlong lines.
- **Proof.** Run `journeys/myths.json`. The evidence holds `06-myths-1440.png`, `12-myths-390-top.png`, `15-myths-en-1440.png` and `17-myths-de-390.png`.

## Gotchas

- The claim line is the short `myth` field in `content/explain/<lang>.json`. Its length is capped per language in `src/explain.ts` (`MYTH_MAX_CHARS`), and the build fails above the cap.
- The finding line is the same `answer` the study card uses. It answers the card's question, not the claim, so the question must stay on the card.
- The full-page shot of `/zh/myths/` is very tall. Use `"viewport": true`.
