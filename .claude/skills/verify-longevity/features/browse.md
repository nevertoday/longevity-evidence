# Browse by topic

A reader starts on a language home page, picks one of ten everyday topics, opens a study card from that topic, and can step back to the topic through the breadcrumb.

## Sub-features

- `browse-home` shows a heading and ten topic cards.
- `browse-topic` opens a topic page titled by a reader's question, listing that topic's study cards.
- `browse-study` opens a study from its card.
- `browse-crumb` returns from a study to its topic through the breadcrumb.

## How to get to it (user POV)

- Open `/zh/` (or any language home) and choose a card in the topics section.
- Choose a study card on the topic page.
- On a study page, choose the topic name in the breadcrumb (`nav` labelled `位置` in Chinese).

## Driving it with drive.ts

Preconditions:

- The baseline preconditions in `README.md` hold.

- **Home.** Open `/zh/`. Step `{ "go": "/zh/", "expectStatus": 200 }`. `document.querySelectorAll('a.topic-card').length` is `10`.
- **Topic.** Choose the drinking card. Step `{ "click": "a.topic-card[href$='/topics/drinking/']", "nav": true }`. The path is `/zh/topics/drinking/` and the title is `喝什么好？酒能喝吗？ · 活得更久`.
- **Study.** Choose the alcohol card. Step `{ "click": "a.study-card[href$='/studies/alcohol/']", "nav": true }`. The path is `/zh/studies/alcohol/`.
- **Breadcrumb.** Choose the topic in the breadcrumb. Step `{ "click": "nav[aria-label='位置'] a[href$='/topics/drinking/']", "nav": true }`. The path is `/zh/topics/drinking/` again.
- **Proof.** Run `journeys/browse.json`. The evidence holds `05-home.png`, `10-topic-drinking.txt` (the topic's visible text) and `16-topic-drinking.png`.

## Gotchas

- Links are relative (`../zh/topics/...`), so assert with `href$=` endings, never full hrefs.
- The breadcrumb's `aria-label` is translated: `位置` in Chinese and something else in every other language. Read it from the page before you write a selector for another language.
- The home page's figure cards (`a.figure`) link to sections on the same page, not to topics. Do not count them as topic cards.
