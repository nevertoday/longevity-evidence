import { renderClaim } from './claim.ts';
import { DIRECTIONS, type Direction } from './directions.ts';
import { EVIDENCE_KINDS, EXPLAIN_STAGE, type EvidenceKind } from './explain.ts';
import { html, raw, type Html, type Part } from './html.ts';
import { ENABLED_LOCALES, FALLBACK_LOCALE, type Locale, type LocaleCode } from './locales.ts';
import {
  GRADES,
  MYTH_VERDICTS,
  TOPICS,
  sortByGrade,
  type Grade,
  type Guide,
  type Study,
  type TopicId,
  type Upstream,
  type VerdictId,
} from './model.ts';
import { APPEARANCE_KEY, SITE_ORIGIN, SOURCE_REPO, UPSTREAM_CONTRIBUTING } from './site.ts';
import type { T, UiKey } from './ui.ts';

export type Page =
  | { kind: 'home' }
  | { kind: 'topic'; topic: TopicId }
  | { kind: 'studies' }
  | { kind: 'study'; study: Study }
  | { kind: 'myths' }
  | { kind: 'about' };

export function pagePath(code: LocaleCode, page: Page): string {
  switch (page.kind) {
    case 'home':
      return `${code}/`;
    case 'topic':
      return `${code}/topics/${page.topic}/`;
    case 'studies':
      return `${code}/studies/`;
    case 'study':
      return `${code}/studies/${page.study.id}/`;
    case 'myths':
      return `${code}/myths/`;
    case 'about':
      return `${code}/about/`;
  }
}

// The file under dist/ that holds the page.
export const outFile = (code: LocaleCode, page: Page) => `${pagePath(code, page)}index.html`;

export function sitePages(up: Upstream): Page[] {
  return [
    { kind: 'home' },
    ...TOPICS.map((topic) => ({ kind: 'topic', topic }) as const),
    { kind: 'studies' },
    ...up.studies.map((study) => ({ kind: 'study', study }) as const),
    { kind: 'myths' },
    { kind: 'about' },
  ];
}

// `base` prefixes every internal link and asset.
type Ctx = { locale: Locale; t: T; guide: Guide; up: Upstream; base: string };
type Content = { title: string; description: string; body: Html };

const toRoot = (path: string) => '../'.repeat(path.split('/').filter(Boolean).length);
const link = (ctx: Ctx, page: Page, code: LocaleCode = ctx.locale.code) => ctx.base + pagePath(code, page);
const attr = (name: string, value: string | null) => (value === null ? null : html` ${raw(name)}="${value}"`);
const commitUrl = (up: Upstream) => `${up.source.repository}/tree/${up.source.commit}`;

const isMyth = (s: Study) => MYTH_VERDICTS.includes(s.verdict);

// Kit icons (`pnpm xxd icon`). Each sits beside text that says the same thing, so screen readers skip it.
const TOPIC_ICON: Record<TopicId, string> = {
  eating: 'Leaf',
  drinking: 'Coffee',
  movement: 'Bike',
  sleep: 'MoonStar',
  habits: 'CalendarDays',
  mind: 'Smile',
  body: 'Ruler',
  environment: 'Wind',
  supplements: 'FlaskConical',
  illness: 'Thermometer',
};
const DIRECTION_ICON: Record<Direction, string> = { helps: 'Check', harms: 'TriangleAlert', 'no-effect': 'Equal', mixed: 'ArrowUpDown' };
const KIND_ICON: Record<EvidenceKind, string> = { trial: 'Shuffle', observational: 'Eye', indirect: 'Lightbulb' };

// Colour carries meaning only: harm is danger, a mixed result is a warning, the rest stays ink.
const DIRECTION_TONE: Record<Direction, string | null> = { helps: null, harms: 'danger', 'no-effect': null, mixed: 'warning' };
const VERDICT_TONE: Record<VerdictId, string | null> = { corrected: 'warning', partly: null, 'no-direct': null, qualified: null };

// Bars filled out of four, so the strength reads without knowing the letter scale.
const STRENGTH: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1 };

// Home page lists: grade A or B, split by which way the evidence points, strongest grade first.
const HOME_LISTS = {
  // Trials in diagnosed patients are not advice for healthy readers, so they stay on the illness topic page.
  helps: (s: Study) => s.direction === 'helps' && s.topic !== 'illness',
  'no-help': (s: Study) => s.direction === 'harms' || s.direction === 'no-effect',
} as const;

const HOME_MYTHS = 6;
const RELATED = 3;

function strongEvidence(studies: readonly Study[], keep: (s: Study) => boolean): Study[] {
  const picked = studies.filter((s) => (s.grade === 'A' || s.grade === 'B') && keep(s));
  return sortByGrade(TOPICS.flatMap((topic) => picked.filter((s) => s.topic === topic)));
}

const byTopicThenGrade = (studies: readonly Study[]) => TOPICS.flatMap((topic) => sortByGrade(studies.filter((s) => s.topic === topic)));

const icon = (name: string, size: 12 | 14 | 20) => html`<i data-xxd-icon="${name}" data-size="${size}" aria-hidden="true"></i>`;

function gradeBadge(ctx: Ctx, grade: Grade): Html {
  return html`<span class="xxd-badge">${ctx.t('grade.badge', { grade, label: ctx.guide.grades[grade].label })}</span>`;
}

function directionChip(ctx: Ctx, direction: Direction): Html {
  return html`<span class="xxd-badge" data-direction="${direction}"${attr('data-tone', DIRECTION_TONE[direction])}>${icon(DIRECTION_ICON[direction], 12)}${ctx.t(`direction.${direction}` as const)}</span>`;
}

function verdictChip(ctx: Ctx, verdict: VerdictId): Html {
  return html`<span class="xxd-badge"${attr('data-tone', VERDICT_TONE[verdict])}>${ctx.t(`verdict.${verdict}` as const)}</span>`;
}

function strength(ctx: Ctx, grade: Grade): Html {
  const label = ctx.t(`strength.${grade}` as const);
  return html`<span class="strength" role="meter" aria-label="${ctx.t('strength.label')}" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${STRENGTH[grade]}" aria-valuetext="${label}"><span class="xxd-meter strength__bars" data-segments data-strength="${STRENGTH[grade]}"><span class="xxd-meter__track"><span class="xxd-meter__fill"></span></span></span>${label}</span>`;
}

function kindLabel(ctx: Ctx, kind: EvidenceKind): Html {
  return html`<span class="kind">${icon(KIND_ICON[kind], 14)}${ctx.t(`kind.${kind}` as const)}</span>`;
}

function topicLabel(ctx: Ctx, topic: TopicId): Html {
  return html`<span class="topic-label">${icon(TOPIC_ICON[topic], 14)}${ctx.t(`topic.${topic}` as const)}</span>`;
}

// The one study card: home lists, topic pages, the full list and "related" all use it. The whole card is the link.
function studyCard(ctx: Ctx, s: Study, level: 2 | 3): Html {
  const e = s.explain[ctx.locale.code];
  const h = raw(`h${level}`);
  return html`<a class="xxd-card study-card" href="${link(ctx, { kind: 'study', study: s })}">
${topicLabel(ctx, s.topic)}
<${h} class="study-card__title">${e.question}</${h}>
<p class="study-card__text">${e.answer}</p>
<span class="card-foot">${directionChip(ctx, s.direction)}${strength(ctx, s.grade)}</span>
</a>`;
}

const studyCards = (ctx: Ctx, studies: readonly Study[], level: 2 | 3) =>
  html`<ul class="card-grid">${studies.map((s) => html`<li>${studyCard(ctx, s, level)}</li>`)}</ul>`;

function mythCard(ctx: Ctx, s: Study, level: 2 | 3): Html {
  const e = s.explain[ctx.locale.code];
  const h = raw(`h${level}`);
  return html`<a class="xxd-card study-card myth-card" href="${link(ctx, { kind: 'study', study: s })}">
<${h} class="study-card__title">${e.myth}</${h}>
<span class="kicker">${ctx.t('myths.evidence')}</span>
<p class="study-card__text">${e.answer}</p>
<span class="card-foot">${verdictChip(ctx, s.verdict)}${topicLabel(ctx, s.topic)}</span>
</a>`;
}

const mythCards = (ctx: Ctx, studies: readonly Study[], level: 2 | 3) =>
  html`<ul class="card-grid">${studies.map((s) => html`<li>${mythCard(ctx, s, level)}</li>`)}</ul>`;

function topicCard(ctx: Ctx, topic: TopicId): Html {
  const { t } = ctx;
  return html`<a class="xxd-card topic-card" href="${link(ctx, { kind: 'topic', topic })}">${icon(TOPIC_ICON[topic], 20)}
<h3 class="topic-card__name">${t(`topic.${topic}` as const)}</h3>
<p class="topic-card__question">${t(`topic.${topic}.question` as const)}</p>
<span class="topic-card__count">${t.studies(ctx.up.studies.filter((s) => s.topic === topic).length)}</span>
</a>`;
}

type Crumb = { label: string; page: Page };

// From the home page down to the page itself.
function trail(ctx: Ctx, page: Extract<Page, { kind: 'topic' | 'study' }>): Crumb[] {
  const { t } = ctx;
  const home: Crumb = { label: t('breadcrumb.home'), page: { kind: 'home' } };
  const topic = (id: TopicId): Crumb => ({ label: t(`topic.${id}` as const), page: { kind: 'topic', topic: id } });
  switch (page.kind) {
    case 'topic':
      return [home, topic(page.topic)];
    case 'study':
      return [home, topic(page.study.topic), { label: page.study.explain[ctx.locale.code].question, page }];
  }
}

// The visible trail leaves out the page the reader is on.
function crumbs(ctx: Ctx, page: Extract<Page, { kind: 'topic' | 'study' }>): Html {
  return html`<nav aria-label="${ctx.t('breadcrumb.label')}"><ol class="xxd-breadcrumbs">${trail(ctx, page)
    .slice(0, -1)
    .map((c) => html`<li><a href="${link(ctx, c.page)}">${c.label}</a></li>`)}</ol></nav>`;
}

type Header = { crumbs?: Html; icon?: string; lead?: string };

function pageHeader(ctx: Ctx, title: string, desc: Part[], opts: Header = {}): Html {
  return html`<header class="xxd-page-header">
${opts.crumbs ?? null}
<div class="xxd-page-header__row"><h1 class="xxd-page-header__title">${opts.icon ? icon(opts.icon, 20) : null}${title}</h1></div>
${opts.lead ? html`<p class="page-lead">${opts.lead}</p>` : null}
${desc.map((d) => html`<p class="xxd-page-header__desc">${d}</p>`)}
</header>`;
}

function section(id: string, title: string, body: Part, level: 2 | 3 = 2): Html {
  const h = raw(`h${level}`);
  return html`<section class="section" aria-labelledby="${id}"><${h} class="section__title" id="${id}">${title}</${h}>${body}</section>`;
}

function facts(rows: [Part, Part][]): Html {
  return html`<dl class="facts">${rows.map(([term, value]) => html`<div class="facts__row"><dt>${term}</dt><dd>${value}</dd></div>`)}</dl>`;
}

function gradeFacts(ctx: Ctx): Html {
  return facts(
    GRADES.map((g) => [
      strength(ctx, g),
      html`${gradeBadge(ctx, g)} ${ctx.guide.grades[g].meaning} <span class="facts__count">${ctx.t.studies(ctx.up.studies.filter((s) => s.grade === g).length)}</span>`,
    ]),
  );
}

function directionFacts(ctx: Ctx): Html {
  return facts(
    DIRECTIONS.map((d) => [
      directionChip(ctx, d),
      html`${ctx.t(`direction.${d}.desc` as const)} <span class="facts__count">${ctx.t.studies(ctx.up.studies.filter((s) => s.direction === d).length)}</span>`,
    ]),
  );
}

function kindFacts(ctx: Ctx): Html {
  return facts(
    EVIDENCE_KINDS.map((k) => [
      kindLabel(ctx, k),
      html`${ctx.t(`kind.${k}.desc` as const)} <span class="facts__count">${ctx.t.studies(ctx.up.studies.filter((s) => s.kind === k).length)}</span>`,
    ]),
  );
}

// Upstream writes numbers straight after abbreviations ("RR1.19"), so only a letter ends a term.
const termPattern = (term: string) => new RegExp(`(?<![A-Za-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?![A-Za-z])`);

function glossary(ctx: Ctx, keep: (term: string) => boolean): Html {
  return facts(
    ctx.guide.glossary.filter((e) => keep(e.term)).map((e) => [`${e.term} · ${e.name}`, e.description] as [string, Part]),
  );
}

function home(ctx: Ctx): Content {
  const { t, up } = ctx;
  const total = up.studies.length;
  const helps = strongEvidence(up.studies, HOME_LISTS.helps);
  const noHelp = strongEvidence(up.studies, HOME_LISTS['no-help']);
  const myths = up.studies.filter(isMyth);
  const count = (v: VerdictId) => myths.filter((s) => s.verdict === v).length;
  const teaser = MYTH_VERDICTS.flatMap((v) => sortByGrade(myths.filter((s) => s.verdict === v))).slice(0, HOME_MYTHS);
  const mythsPage = link(ctx, { kind: 'myths' });
  const figure = (key: UiKey, n: number, href: string) =>
    html`<li><a class="xxd-card figure" href="${href}">${t.html(key, { count: html`<span class="figure__value">${n}</span>` })}</a></li>`;
  const illness = html`<a class="xxd-link" href="${link(ctx, { kind: 'topic', topic: 'illness' })}">${t('topic.illness')}</a>`;
  const upstream = html`<a class="xxd-link" href="${up.source.repository}">HowToLiveLonger</a>`;
  return {
    title: t('site.tagline', { count: total }),
    description: t('site.description', { count: total }),
    body: html`<header class="hero">
<p class="eyebrow">${t('home.eyebrow')}</p>
<h1 class="page-title hero__title">${t('home.title')}</h1>
<p class="hero__lead">${t('home.lead', { count: total })}</p>
<ul class="figures">${figure('home.figure.helps', helps.length, '#helps')}${figure('home.figure.nohelp', noHelp.length, '#no-help')}${figure('home.figure.myths', myths.length, mythsPage)}</ul>
</header>
${section('helps', t('home.helps.title'), html`<p class="section__intro">${t.html('home.helps.intro', { count: helps.length, illness })}</p>${studyCards(ctx, helps, 3)}`)}
${section('no-help', t('home.nohelp.title'), html`<p class="section__intro">${t('home.nohelp.intro', { count: noHelp.length })}</p>${studyCards(ctx, noHelp, 3)}`)}
${section(
  'myths',
  t('home.myths.title'),
  html`<p class="section__intro">${t('home.myths.intro', { corrected: count('corrected'), partly: count('partly'), nodirect: count('no-direct') })}</p>
${mythCards(ctx, teaser, 3)}
<p class="more"><a class="xxd-link" href="${mythsPage}">${t('home.myths.more', { count: myths.length })}</a></p>`,
)}
${section('topics', t('home.topics.title'), html`<ul class="topic-grid">${TOPICS.map((topic) => html`<li>${topicCard(ctx, topic)}</li>`)}</ul>`)}
${section(
  'read',
  t('home.read.title'),
  html`<div class="read-grid">
<div class="read-card"><h3 class="read-card__title">${t('home.read.strength.title')}</h3><p class="read-card__text">${t('home.read.grades')}</p>
<ul class="levels">${GRADES.map((g) => html`<li>${strength(ctx, g)}<span class="levels__desc">${t(`strength.${g}.desc` as const)}</span></li>`)}</ul></div>
<div class="read-card"><h3 class="read-card__title">${t('home.read.observe.title')}</h3><p class="read-card__text">${t('home.read.association')}</p></div>
<div class="read-card"><h3 class="read-card__title">${t('home.read.add.title')}</h3><p class="read-card__text">${t('home.read.additive')}</p></div>
</div>
<p class="section__note">${t.html('home.read.source', { upstream })}</p>
<p class="more"><a class="xxd-link" href="${link(ctx, { kind: 'about' })}">${t('home.read.more')}</a></p>`,
)}`,
  };
}

function topicPage(ctx: Ctx, topic: TopicId): Content {
  const { t, up } = ctx;
  const studies = sortByGrade(up.studies.filter((s) => s.topic === topic));
  const name = t(`topic.${topic}` as const);
  const desc = t(`topic.${topic}.desc` as const);
  return {
    title: name,
    description: `${t(`topic.${topic}.question` as const)} ${desc}`,
    body: html`${pageHeader(ctx, name, [desc, t('topic.intro', { count: t.studies(studies.length) })], {
      crumbs: crumbs(ctx, { kind: 'topic', topic }),
      icon: TOPIC_ICON[topic],
      lead: t(`topic.${topic}.question` as const),
    })}
${studyCards(ctx, studies, 2)}`,
  };
}

// One storyline: the question, the answer, what to do, why, the catch, how solid it is, the papers, then the raw record.
function studyPage(ctx: Ctx, s: Study): Content {
  const { t, guide: g, up } = ctx;
  const tx = s.text[ctx.locale.code];
  const e = s.explain[ctx.locale.code];
  const myth = isMyth(s);
  const topicName = t(`topic.${s.topic}` as const);
  const topicRef: Page = { kind: 'topic', topic: s.topic };
  const rows: [string, Part][] = [
    [g.fields.finding, tx.finding],
    [g.fields.effect, tx.effect],
    [g.fields.ci, tx.ci],
    [g.fields.comparison, tx.comparison],
    [g.fields.population, tx.population],
    [g.fields.design, tx.design],
    [t('study.grade'), html`${gradeBadge(ctx, s.grade)} ${g.grades[s.grade].meaning}`],
    [t('study.direction'), html`${directionChip(ctx, s.direction)} ${t(`direction.${s.direction}.desc` as const)}`],
    [g.fields.gradeReason, tx.gradeReason],
    [g.fields.limitations, tx.limitations],
    [g.fields.action, tx.action],
    ...(tx.title === tx.factor ? [] : [[g.fields.factor, tx.factor] as [string, Part]]),
  ];
  const shown = [
    tx.summary,
    myth ? tx.originalClaim : '',
    tx.finding,
    tx.effect,
    tx.ci,
    tx.comparison,
    tx.population,
    tx.design,
    tx.gradeReason,
    tx.limitations,
    tx.action,
    s.sources.some((src) => src.doi) ? 'DOI' : '',
    ...tx.sources.map((n) => n.note),
  ].join('\n');
  const terms = g.glossary.filter((entry) => termPattern(entry.term).test(shown));
  const related = sortByGrade(up.studies.filter((r) => r.topic === s.topic && r !== s)).slice(0, RELATED);

  return {
    title: e.question,
    description: e.answer,
    body: html`<article class="story">
<header class="story__head">
${crumbs(ctx, { kind: 'study', study: s })}
<p class="eyebrow">${icon(TOPIC_ICON[s.topic], 14)}${topicName}</p>
<h1 class="page-title">${e.question}</h1>
<p class="story__answer">${e.answer}</p>
<p class="story__facts">${directionChip(ctx, s.direction)}${strength(ctx, s.grade)}${kindLabel(ctx, s.kind)}</p>
</header>
<section class="xxd-layer takeaway" aria-labelledby="todo"><h2 class="xxd-layer__secondary" id="todo">${t('study.takeaway')}</h2><p class="xxd-layer__primary">${tx.takeaway}</p></section>
${section('why', t('study.why.title'), e.why.map((p) => html`<p class="prose-text">${p}</p>`))}
${myth
  ? section(
      'claim',
      t('study.claim.title'),
      html`<blockquote class="quote">${e.myth}</blockquote>
<p class="verdict">${verdictChip(ctx, s.verdict)}<span>${t(`verdict.${s.verdict}.desc` as const)}</span></p>`,
    )
  : null}
${section('caution', t('study.caution.title'), html`<p class="prose-text">${e.caution}</p>`)}
${section(
  'evidence',
  t('study.evidence.title'),
  html`<div class="evidence"><p class="evidence__head">${strength(ctx, s.grade)}</p><p class="prose-text">${t(`strength.${s.grade}.desc` as const)}</p></div>
<div class="evidence"><p class="evidence__head">${kindLabel(ctx, s.kind)}</p><p class="prose-text">${t(`kind.${s.kind}.desc` as const)}</p></div>`,
)}
${section(
  'sources',
  t('study.sources.title'),
  html`<ol class="sources">${s.sources.map(
    (src) => html`<li class="source"><a class="xxd-link source__title" href="${src.url}" rel="noopener noreferrer">${src.title}</a> <span class="source__year">${src.year}</span></li>`,
  )}</ol>`,
)}
<details class="xxd-collapse raw">
<summary><h2 class="raw__title" id="raw">${t('study.raw.title')}</h2></summary>
<div class="raw__body">
<p class="raw__intro">${t('study.raw.intro')}</p>
<h3 class="raw__heading">${tx.title}</h3>
<p class="raw__text">${tx.summary}</p>
${myth ? html`<h3 class="raw__heading">${t('study.claim.original')}</h3><div class="claim">${renderClaim(tx.originalClaim)}</div>` : null}
<h3 class="raw__heading">${t('study.numbers.title')}</h3>
${facts(rows)}
<h3 class="raw__heading">${t('study.raw.sources')}</h3>
<ol class="sources">${s.sources.map((src, i) => {
  const note = tx.sources[i];
  return html`<li class="source"><p class="source__name">${src.title}</p>
<p class="source__meta"><span>${src.year}</span>${src.doi ? html`<span>DOI <a class="xxd-link" href="https://doi.org/${src.doi}" rel="noopener noreferrer">${src.doi}</a></span>` : null}</p>
<dl class="source__facts"><div><dt>${t('study.source.read')}</dt><dd>${note?.readLevel}</dd></div><div><dt>${t('study.source.status')}</dt><dd>${note?.status}</dd></div></dl>
<p class="source__note">${note?.note}</p>
${src.originalUrl ? html`<p class="source__meta"><a class="xxd-link" href="${src.originalUrl}" rel="nofollow noopener noreferrer">${t('study.source.original')}</a></p>` : null}</li>`;
})}</ol>
${terms.length ? html`<h3 class="raw__heading">${t('study.terms.title')}</h3>${glossary(ctx, (term) => terms.some((entry) => entry.term === term))}` : null}
</div>
</details>
</article>
${related.length
  ? section(
      'related',
      t('study.related.title'),
      html`${studyCards(ctx, related, 3)}<p class="more"><a class="xxd-link" href="${link(ctx, topicRef)}">${t('study.back', { topic: topicName })}</a></p>`,
    )
  : null}`,
  };
}

function mythsPage(ctx: Ctx): Content {
  const { t, up } = ctx;
  const myths = up.studies.filter(isMyth);
  return {
    title: t('myths.title'),
    description: t('myths.intro', { count: myths.length }),
    body: html`${pageHeader(ctx, t('myths.title'), [t('myths.intro', { count: myths.length })])}
${MYTH_VERDICTS.map((v) => {
  const group = sortByGrade(myths.filter((s) => s.verdict === v));
  return section(
    `verdict-${v}`,
    `${t(`verdict.${v}` as const)} · ${group.length}`,
    html`<p class="section__intro">${t(`verdict.${v}.desc` as const)}</p>${mythCards(ctx, group, 3)}`,
  );
})}`,
  };
}

function studiesPage(ctx: Ctx): Content {
  const { t, up } = ctx;
  const total = up.studies.length;
  const options = (all: string, values: [string, string][]) =>
    html`<option value="">${all}</option>${values.map(([value, label]) => html`<option value="${value}">${label}</option>`)}`;
  const search = (s: Study) => {
    const tx = s.text[ctx.locale.code];
    const e = s.explain[ctx.locale.code];
    return [e.question, e.answer, tx.title, tx.factor, tx.summary, tx.takeaway, t(`topic.${s.topic}` as const), t(`direction.${s.direction}` as const)].join(' ');
  };
  return {
    title: t('studies.title'),
    description: t('studies.intro', { count: t.studies(total) }),
    body: html`${pageHeader(ctx, t('studies.title'), [t('studies.intro', { count: t.studies(total) })])}
<form class="filters" id="filter" role="search" data-filter hidden>
<div class="xxd-field filters__search"><label class="xxd-label" for="filter-q">${t('studies.search.label')}</label><div class="xxd-input-wrap"><i data-xxd-icon="Search" data-size="16"></i><input class="xxd-input" id="filter-q" name="q" type="search" autocomplete="off" placeholder="${t('studies.search.placeholder')}"></div></div>
<div class="xxd-field"><label class="xxd-label" for="filter-topic">${t('studies.topic.label')}</label><label class="xxd-select"><select id="filter-topic" name="topic">${options(
      t('studies.topic.all'),
      TOPICS.map((topic) => [topic, t(`topic.${topic}` as const)]),
    )}</select></label></div>
<div class="xxd-field"><label class="xxd-label" for="filter-grade">${t('studies.grade.label')}</label><label class="xxd-select"><select id="filter-grade" name="grade">${options(
      t('studies.grade.all'),
      GRADES.map((g) => [g, t(`strength.${g}` as const)]),
    )}</select></label></div>
<div class="xxd-field"><label class="xxd-label" for="filter-direction">${t('studies.direction.label')}</label><label class="xxd-select"><select id="filter-direction" name="direction">${options(
      t('studies.direction.all'),
      DIRECTIONS.map((d) => [d, t(`direction.${d}` as const)]),
    )}</select></label></div>
</form>
<p class="filter-count"><span aria-live="polite" data-filter-count="${t('studies.shown', { shown: '{shown}', total: '{total}' })}">${t('studies.shown', { shown: total, total })}</span><button class="xxd-link" type="reset" form="filter" data-filter-reset hidden>${t('studies.reset')}</button></p>
<ul class="card-grid" data-filter-list>${byTopicThenGrade(up.studies).map(
      (s) => html`<li data-topic="${s.topic}" data-grade="${s.grade}" data-direction="${s.direction}" data-search="${search(s)}">${studyCard(ctx, s, 2)}</li>`,
    )}</ul>
<div class="xxd-empty" data-filter-empty hidden><i data-xxd-icon="SearchX"></i><p class="xxd-empty__title">${t('studies.empty.title')}</p><p class="xxd-empty__text">${t('studies.empty.text')}</p></div>`,
  };
}

function aboutPage(ctx: Ctx): Content {
  const { t, up } = ctx;
  const n = (pred: (s: Study) => boolean) => up.studies.filter(pred).length;
  const repo = html`<a class="xxd-link" href="${up.source.repository}">geekan/HowToLiveLonger</a>`;
  const commit = html`<a class="xxd-link" href="${commitUrl(up)}"><code>${up.source.commit.slice(0, 7)}</code></a>`;
  const verdicts: VerdictId[] = [...MYTH_VERDICTS, 'qualified'];
  return {
    title: t('about.title'),
    description: t('about.lead'),
    body: html`<div class="column">${pageHeader(ctx, t('about.title'), [t('about.lead')])}
${section(
  'method',
  t('about.method.title'),
  html`<p class="prose-text">${t('about.method.text', { original: n((s) => s.origin === 'original'), added: n((s) => s.origin === 'added') })}</p><p class="prose-text">${t('about.method.limits')}</p><p class="prose-text">${t(`about.review.${EXPLAIN_STAGE[ctx.locale.code]}` as const)}</p>`,
)}
${section('grades', t('about.grades.title'), html`<p class="section__intro">${ctx.guide.gradeNote}</p>${gradeFacts(ctx)}`)}
${section('directions', t('about.directions.title'), html`<p class="section__intro">${t('about.directions.intro')}</p>${directionFacts(ctx)}`)}
${section('kinds', t('about.kinds.title'), html`<p class="section__intro">${t('about.kinds.intro')}</p>${kindFacts(ctx)}`)}
${section(
  'verdicts',
  t('about.verdicts.title'),
  facts(
    verdicts.map((v) => [
      t(`verdict.${v}` as const),
      html`${t(`verdict.${v}.desc` as const)} <span class="facts__count">${t.studies(n((s) => s.verdict === v))}</span>`,
    ]),
  ),
)}
${section('disclaimer', t('about.disclaimer.title'), html`<p class="prose-text">${t('about.disclaimer.text')}</p>`)}
${section(
  'source',
  t('about.source.title'),
  html`<p class="prose-text">${t.html('about.source.text', { repo, commit, date: up.source.committedAt.slice(0, 10) })}</p><p class="prose-text">${t('about.source.kit')}</p>`,
)}
${section(
  'contribute',
  t('about.contribute.title'),
  html`<p class="prose-text">${t.html('about.contribute.text', { guide: html`<a class="xxd-link" href="${UPSTREAM_CONTRIBUTING}">${t('about.contribute.guide')}</a>` })}</p><p class="prose-text">${t.html('about.contribute.site', { repo: html`<a class="xxd-link" href="${SOURCE_REPO}">${t('about.contribute.repo')}</a>` })}</p>`,
)}</div>`,
  };
}

function content(ctx: Ctx, page: Page): Content {
  switch (page.kind) {
    case 'home':
      return home(ctx);
    case 'topic':
      return topicPage(ctx, page.topic);
    case 'studies':
      return studiesPage(ctx);
    case 'study':
      return studyPage(ctx, page.study);
    case 'myths':
      return mythsPage(ctx);
    case 'about':
      return aboutPage(ctx);
  }
}

const NAV: [Page, UiKey][] = [
  [{ kind: 'myths' }, 'nav.myths'],
  [{ kind: 'studies' }, 'nav.studies'],
  [{ kind: 'about' }, 'nav.about'],
];

function head(base: string, title: string, description: string, links: Part): Html {
  return html`<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${links}
<meta name="color-scheme" content="light dark">
<script src="${base}vendor/xxd/boot.js" data-key="${APPEARANCE_KEY}" data-default-theme="system"></script>
<link rel="stylesheet" href="${base}vendor/xxd/xxd.css">
<link rel="stylesheet" href="${base}assets/site.css">
<script defer src="${base}vendor/xxd/icons.js"></script>
<script defer src="${base}vendor/xxd/xxd.js"></script>
<script defer src="${base}assets/site.js"></script>`;
}

export function renderPage(locale: Locale, t: T, up: Upstream, page: Page): string {
  const path = pagePath(locale.code, page);
  const ctx: Ctx = { locale, t, guide: up.guide[locale.code], up, base: toRoot(path) };
  const c = content(ctx, page);
  const title = page.kind === 'home' ? `${t('site.name')} · ${c.title}` : `${c.title} · ${t('site.name')}`;
  const links = html`<link rel="canonical" href="${SITE_ORIGIN}/${path}">
${ENABLED_LOCALES.map((l) => html`<link rel="alternate" hreflang="${l.htmlLang}" href="${SITE_ORIGIN}/${pagePath(l.code, page)}">\n`)}${
    page.kind === 'home' ? html`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/">` : null
  }`;
  const doc = html`<!doctype html>
<html lang="${locale.htmlLang}" dir="${locale.dir}">
<head>
${head(ctx.base, title, c.description, links)}
</head>
<body class="xxd-page">
<a class="xxd-sr-only-focusable" href="#main">${t('skip')}</a>
<header class="site-header"><div class="site-header__inner">
<a class="site-brand" href="${link(ctx, { kind: 'home' })}"${attr('aria-current', page.kind === 'home' ? 'page' : null)}><span class="site-brand__name">${t('site.name')}</span><span class="site-brand__tagline">${t('site.tagline', { count: up.studies.length })}</span></a>
<nav class="site-nav" aria-label="${t('nav.label')}">${NAV.map(([p, key]) => {
    const current = p.kind === page.kind;
    return html`<a class="xxd-link" data-variant="${current ? 'current' : 'plain'}" href="${link(ctx, p)}"${attr('aria-current', current ? 'page' : null)}>${t(key)}</a>`;
  })}</nav>
<div class="site-tools">
<nav class="site-lang" aria-label="${t('lang.label')}">
<details class="site-lang__details">
<summary class="xxd-btn site-lang__trigger" data-size="sm" data-variant="ghost"><i data-xxd-icon="Languages" data-size="16"></i><span>${locale.label}</span><span class="site-lang__caret" aria-hidden="true"></span></summary>
<div class="xxd-menu site-lang__menu" role="menu" aria-label="${t('lang.label')}">${ENABLED_LOCALES.map(
    (l) =>
      html`<a class="xxd-menu__item" role="menuitem" href="${link(ctx, page, l.code)}" hreflang="${l.htmlLang}" lang="${l.htmlLang}"${attr('aria-current', l.code === locale.code ? 'true' : null)}>${l.label}</a>`,
  )}</div>
</details>
</nav>
<button class="xxd-btn xxd-appearance-btn" data-size="sm" data-variant="ghost" data-icon-only type="button" hidden data-xxd-popover="appearance-pop" aria-label="${t('appearance')}" data-tooltip="${t('appearance')}"><i class="xxd-appearance-btn__sun" data-xxd-icon="Sun" data-size="16"></i><i class="xxd-appearance-btn__moon" data-xxd-icon="Moon" data-size="16"></i></button>
<div class="xxd-popover xxd-appearance-pop" id="appearance-pop" popover data-placement="bottom-end"></div>
</div>
</div></header>
<main id="main" class="site-main" tabindex="-1">
${c.body}
</main>
<footer class="site-footer"><div class="site-footer__inner">
<p>${t('footer.disclaimer')}</p>
<p>${t.html('footer.source', { upstream: html`<a class="xxd-link" href="${commitUrl(up)}">geekan/HowToLiveLonger</a>` })}</p>
<p><a class="xxd-link" href="${link(ctx, { kind: 'about' })}">${t('footer.about')}</a> · <a class="xxd-link" href="${SOURCE_REPO}">${t('footer.code')}</a></p>
</div></footer>
</body>
</html>
`;
  return doc.value;
}

// The root page picks a language from the browser's preferred languages and lists every language as a link.
export function renderRoot(locales: { locale: Locale; t: T }[], up: Upstream): string {
  const codes = locales.map((l) => l.locale.code);
  const fallback = locales.find((l) => l.locale.code === FALLBACK_LOCALE) ?? locales[0];
  if (!fallback) throw new Error('no enabled locales');
  const redirect = `(function(){var codes=${JSON.stringify(codes)};var langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];for(var i=0;i<langs.length;i++){var c=String(langs[i]).toLowerCase().split("-")[0];if(codes.indexOf(c)>=0){location.replace(c+"/");return}}location.replace(${JSON.stringify(FALLBACK_LOCALE)}+"/")})();`;
  const links = html`<link rel="canonical" href="${SITE_ORIGIN}/">
${locales.map((l) => html`<link rel="alternate" hreflang="${l.locale.htmlLang}" href="${SITE_ORIGIN}/${l.locale.code}/">\n`)}<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/">`;
  const title = locales.map((l) => l.t('site.name')).join(' · ');
  const description = locales.map((l) => l.t('site.description', { count: up.studies.length })).join(' ');
  return html`<!doctype html>
<html lang="${fallback.locale.htmlLang}" dir="${fallback.locale.dir}">
<head>
<script>${raw(redirect)}</script>
${head('', title, description, links)}
</head>
<body class="xxd-page">
<main id="main" class="site-main">
<h1 class="page-title">${locales.map((l) => html`<span class="root-title" lang="${l.locale.htmlLang}">${l.t('site.name')}</span>`)}</h1>
<ul class="root-langs">${locales.map(
  (l) => html`<li lang="${l.locale.htmlLang}" dir="${l.locale.dir}"><a class="xxd-link" href="${l.locale.code}/" hreflang="${l.locale.htmlLang}">${l.locale.label}</a><p class="root-langs__desc">${l.t('home.title')}</p></li>`,
)}</ul>
</main>
</body>
</html>
`.value;
}
