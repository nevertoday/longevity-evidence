# Read a study

A study page answers one reader question in a fixed storyline: what to do, why, the original claim, cautions, how strong the evidence is, and the papers. The page dates the data and the site's explanation, links each source, and keeps upstream's full original text in a closed fold.

## Sub-features

- `study-storyline` puts the sections `todo`, `why`, `claim`, `caution`, `evidence` and `sources` in that reading order.
- `study-dates` shows the date of the upstream data and the date the explanation was revised, as two `<time>` elements.
- `study-sources` links each paper to PubMed or its DOI.
- `study-raw` opens a closed `details.raw` fold holding upstream's original fields.
- `study-jsonld` describes the page as a `MedicalWebPage` for search engines.
- `study-locales` gives the same storyline in every language.

## How to get to it (user POV)

- Choose any study card on a home, topic, myths or study-list page.
- Open `/<lang>/studies/<id>/` directly, for example from a search result.

## Driving it with drive.ts

Preconditions:

- The baseline preconditions in `README.md` hold.
- `alcohol`, `coffee` and `aspirin-primary-prevention` have finished explanations in every language, so use one of them.

- **Open.** Step `{ "go": "/zh/studies/alcohol/", "expectStatus": 200 }`. `h1.page-title` reads `每天喝一点酒，对身体有好处吗？`.
- **Storyline.** The ids of `#todo, #why, #claim, #caution, #evidence, #sources` in document order join to `todo,why,claim,caution,evidence,sources`.
- **Dates.** `.section__note time` has two elements whose `datetime` values are `2026-10-22` and `2026-11-27` (upstream commit date, explanation revision date).
- **Sources.** `a.source__title[href^="https://pubmed.ncbi.nlm.nih.gov/"]` exists.
- **Raw data.** The fold starts closed. Step `{ "click": "details.raw > summary" }`. `details.raw` is open and its text is over 200 characters.
- **Structured data.** The `@graph` in `script[type="application/ld+json"]` contains a node of type `MedicalWebPage`.
- **Another language.** Step `{ "go": "/en/studies/alcohol/", "width": 1440 }`. `lang` is `en` and both dates are present.
- **Proof.** Run `journeys/study-page.json`. The evidence holds `13-alcohol.txt` (the full storyline text), `14-alcohol-raw-open.png` and `17-alcohol-en-1440.png`.

## Gotchas

- Most of the 64 studies still show upstream wording in place of a finished plain-language explanation. Check `content/explain/<lang>.json` before you assume a study's storyline text.
- The revision date comes from `git log` on `content/explain`. It changes with every commit there, so a journey that pins it must be updated after such a commit.
- Clicking `summary` toggles the fold. A second click closes it again.
