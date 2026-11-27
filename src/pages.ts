import { renderClaim } from './claim.ts';
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
import { APPEARANCE_KEY, SITE_ORIGIN, UPSTREAM_CONTRIBUTING } from './site.ts';
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

type Ctx = { locale: Locale; t: T; guide: Guide; up: Upstream; path: string };
type Content = { title: string; description: string; body: Html };

const toRoot = (path: string) => '../'.repeat(path.split('/').filter(Boolean).length);
const link = (ctx: Ctx, page: Page, code: LocaleCode = ctx.locale.code) => toRoot(ctx.path) + pagePath(code, page);
const asset = (ctx: Ctx, file: string) => toRoot(ctx.path) + file;
const attr = (name: string, value: string | null) => (value === null ? null : html` ${raw(name)}="${value}"`);
const commitUrl = (up: Upstream) => `${up.source.repository}/tree/${up.source.commit}`;

const isMyth = (s: Study) => MYTH_VERDICTS.includes(s.verdict);
const VERDICT_TONE: Record<VerdictId, string | null> = { corrected: 'warning', partly: null, 'no-direct': null, qualified: null };

// Home page list: strong evidence that supports the claim, leaving out trials in diagnosed patients.
function bestSupported(studies: readonly Study[]): Study[] {
  const picked = studies.filter((s) => (s.grade === 'A' || s.grade === 'B') && s.verdict === 'qualified' && s.topic !== 'illness');
  return sortByGrade(TOPICS.flatMap((topic) => picked.filter((s) => s.topic === topic)));
}

const byTopicThenGrade = (studies: readonly Study[]) => TOPICS.flatMap((topic) => sortByGrade(studies.filter((s) => s.topic === topic)));

function gradeBadge(ctx: Ctx, grade: Grade): Html {
  return html`<span class="xxd-badge">${ctx.t('grade.badge', { grade, label: ctx.guide.grades[grade].label })}</span>`;
}

function verdictBadge(ctx: Ctx, verdict: VerdictId): Html | null {
  if (!MYTH_VERDICTS.includes(verdict)) return null;
  return html`<span class="xxd-badge"${attr('data-tone', VERDICT_TONE[verdict])}>${ctx.t(`verdict.${verdict}` as const)}</span>`;
}

function studyItem(ctx: Ctx, s: Study, level: 2 | 3, mode: 'full' | 'brief' | 'filterable'): Html {
  const tx = s.text[ctx.locale.code];
  const h = raw(`h${level}`);
  const search = mode === 'filterable' ? [tx.title, tx.factor, tx.summary, tx.takeaway].join(' ') : null;
  return html`<li class="study"${attr('data-topic', mode === 'filterable' ? s.topic : null)}${attr('data-grade', mode === 'filterable' ? s.grade : null)}${attr('data-search', search)}>
<${h} class="study__title"><a href="${link(ctx, { kind: 'study', study: s })}">${tx.title}</a></${h}>
<div class="study__badges">${gradeBadge(ctx, s.grade)}${verdictBadge(ctx, s.verdict)}${mode === 'filterable' ? html`<span class="study__topic">${ctx.t(`topic.${s.topic}` as const)}</span>` : null}</div>
${mode === 'full' ? html`<p class="study__summary">${tx.summary}</p><p class="study__label">${ctx.t('study.takeaway')}</p>` : null}
<p class="study__takeaway">${tx.takeaway}</p>
</li>`;
}

function crumbs(ctx: Ctx, trail: { label: string; page: Page }[]): Html {
  return html`<nav aria-label="${ctx.t('breadcrumb.label')}"><ol class="xxd-breadcrumbs">${trail.map(
    (c) => html`<li><a href="${link(ctx, c.page)}">${c.label}</a></li>`,
  )}</ol></nav>`;
}

function pageHeader(ctx: Ctx, title: string, desc: Part[], trail: { label: string; page: Page }[] = []): Html {
  return html`<header class="xxd-page-header">
${trail.length ? crumbs(ctx, trail) : null}
<div class="xxd-page-header__row"><h1 class="xxd-page-header__title">${title}</h1></div>
${desc.map((d) => html`<p class="xxd-page-header__desc">${d}</p>`)}
</header>`;
}

function section(id: string, title: string, body: Part, level: 2 | 3 = 2): Html {
  const h = raw(`h${level}`);
  return html`<section class="section" aria-labelledby="${id}"><${h} class="section__title" id="${id}">${title}</${h}>${body}</section>`;
}

function facts(rows: [string, Part][]): Html {
  return html`<dl class="facts">${rows.map(([term, value]) => html`<div class="facts__row"><dt>${term}</dt><dd>${value}</dd></div>`)}</dl>`;
}

function gradeFacts(ctx: Ctx, withCounts: boolean): Html {
  return facts(
    GRADES.map((g) => [
      ctx.t('grade.badge', { grade: g, label: ctx.guide.grades[g].label }),
      html`${ctx.guide.grades[g].meaning}${withCounts ? html` <span class="facts__count">${ctx.t.studies(ctx.up.studies.filter((s) => s.grade === g).length)}</span>` : null}`,
    ]),
  );
}

// Upstream writes numbers straight after abbreviations ("RR1.19"), so only a letter ends a term.
const termPattern = (term: string) => new RegExp(`(?<![A-Za-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?![A-Za-z])`);

function glossary(ctx: Ctx, terms: readonly string[] | ((term: string) => boolean)): Html {
  const keep = typeof terms === 'function' ? terms : (term: string) => terms.includes(term);
  return facts(
    ctx.guide.glossary.filter((e) => keep(e.term)).map((e) => [`${e.term} · ${e.name}`, e.description] as [string, Part]),
  );
}

function topicList(ctx: Ctx): Html {
  return html`<div class="xxd-frame"><ul class="xxd-list topic-list" data-interactive>${TOPICS.map(
    (topic) => html`<li class="xxd-list__item"><a class="xxd-list__main" href="${link(ctx, { kind: 'topic', topic })}"><span class="xxd-list__title">${ctx.t(`topic.${topic}` as const)}</span><span class="xxd-list__meta">${ctx.t(`topic.${topic}.desc` as const)}</span></a><span class="topic-list__count">${ctx.t.studies(ctx.up.studies.filter((s) => s.topic === topic).length)}</span></li>`,
  )}</ul></div>`;
}

function home(ctx: Ctx): Content {
  const { t, up } = ctx;
  const best = bestSupported(up.studies);
  const count = (v: VerdictId) => up.studies.filter((s) => s.verdict === v).length;
  const teaser = sortByGrade(up.studies.filter((s) => s.verdict === 'corrected')).slice(0, 4);
  const illness = html`<a class="xxd-link" href="${link(ctx, { kind: 'topic', topic: 'illness' })}">${t('topic.illness')}</a>`;
  return {
    title: t('home.title'),
    description: t('site.description', { count: up.studies.length }),
    body: html`<header class="home-head"><h1 class="page-title">${t('home.title')}</h1><p class="lead">${t('home.intro', { count: up.studies.length })}</p></header>
${section('best', t('home.best.title'), html`<p class="section__intro">${t.html('home.best.intro', { count: best.length, illness })}</p><ul class="studies">${best.map((s) => studyItem(ctx, s, 3, 'brief'))}</ul>`)}
${section('topics', t('home.topics.title'), topicList(ctx))}
${section(
  'myths',
  t('home.myths.title'),
  html`<p class="section__intro">${t('home.myths.intro', { corrected: count('corrected'), partly: count('partly'), nodirect: count('no-direct') })}</p>
<ul class="studies">${teaser.map((s) => studyItem(ctx, s, 3, 'brief'))}</ul>
<p class="more"><a class="xxd-link" href="${link(ctx, { kind: 'myths' })}">${t('home.myths.more', { count: up.studies.filter(isMyth).length })}</a></p>`,
)}
${section(
  'read',
  t('home.read.title'),
  html`<p class="section__intro">${t('home.read.grades')}</p>${gradeFacts(ctx, false)}
<p class="prose-text">${t('home.read.association')}</p>
<p class="prose-text">${t('home.read.additive')}</p>
<h3 class="subsection__title">${t('home.read.terms')}</h3>${glossary(ctx, ['ACM', 'HR', 'CI', 'RCT'])}
<p class="more"><a class="xxd-link" href="${link(ctx, { kind: 'about' })}">${t('home.read.more')}</a></p>`,
)}`,
  };
}

function topicPage(ctx: Ctx, topic: TopicId): Content {
  const { t, up } = ctx;
  const studies = sortByGrade(up.studies.filter((s) => s.topic === topic));
  const desc = t(`topic.${topic}.desc` as const);
  return {
    title: t(`topic.${topic}` as const),
    description: desc,
    body: html`${pageHeader(ctx, t(`topic.${topic}` as const), [desc, t('topic.intro', { count: t.studies(studies.length) })], [
      { label: t('breadcrumb.home'), page: { kind: 'home' } },
    ])}
<ul class="studies">${studies.map((s) => studyItem(ctx, s, 2, 'full'))}</ul>`,
  };
}

function studyPage(ctx: Ctx, s: Study): Content {
  const { t, guide: g } = ctx;
  const tx = s.text[ctx.locale.code];
  const myth = isMyth(s);
  const topicName = t(`topic.${s.topic}` as const);
  const rows: [string, Part][] = [
    ...(myth ? [] : [[g.fields.finding, tx.finding] as [string, Part]]),
    [g.fields.effect, tx.effect],
    [g.fields.ci, tx.ci],
    [g.fields.comparison, tx.comparison],
    [g.fields.population, tx.population],
    [g.fields.design, tx.design],
    [t('study.grade'), html`${gradeBadge(ctx, s.grade)} ${g.grades[s.grade].meaning}`],
    [g.fields.gradeReason, tx.gradeReason],
    [g.fields.limitations, tx.limitations],
    [g.fields.action, tx.action],
    ...(tx.title === tx.factor ? [] : [[g.fields.factor, tx.factor] as [string, Part]]),
  ];
  const shown = [
    tx.summary,
    tx.takeaway,
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
  const terms = g.glossary.filter((e) => termPattern(e.term).test(shown));
  const topicPageRef: Page = { kind: 'topic', topic: s.topic };

  return {
    title: tx.title,
    description: tx.summary,
    body: html`${pageHeader(ctx, tx.title, [], [
      { label: t('breadcrumb.home'), page: { kind: 'home' } },
      { label: topicName, page: topicPageRef },
    ])}
<div class="study__badges">${gradeBadge(ctx, s.grade)}${verdictBadge(ctx, s.verdict)}</div>
<p class="lead">${tx.summary}</p>
<div class="xxd-layer takeaway"><div class="xxd-layer__secondary">${t('study.takeaway')}</div><div class="xxd-layer__primary">${tx.takeaway}</div></div>
${myth
  ? section(
      'claim',
      t('study.claim.title'),
      html`<div class="versus"><div class="versus__part"><h3 class="versus__label">${t('study.claim.original')}</h3><div class="claim">${renderClaim(tx.originalClaim)}</div></div>
<div class="versus__part"><h3 class="versus__label">${t('study.claim.evidence')}</h3><p class="prose-text">${tx.finding}</p><p class="versus__verdict">${verdictBadge(ctx, s.verdict)} ${t(`verdict.${s.verdict}.desc` as const)}</p></div></div>`,
    )
  : null}
${section('numbers', t('study.numbers.title'), facts(rows))}
${terms.length ? section('terms', t('study.terms.title'), glossary(ctx, (term) => terms.some((e) => e.term === term))) : null}
${section(
  'sources',
  t('study.sources.title'),
  html`<ol class="sources">${s.sources.map((src, i) => {
    const note = tx.sources[i];
    return html`<li class="source"><p class="source__title"><a class="xxd-link" href="${src.url}" rel="noopener noreferrer">${src.title}</a></p>
<p class="source__meta"><span>${src.year}</span>${src.doi ? html`<span>DOI <a class="xxd-link" href="https://doi.org/${src.doi}" rel="noopener noreferrer">${src.doi}</a></span>` : null}</p>
<dl class="source__facts"><div><dt>${t('study.source.read')}</dt><dd>${note?.readLevel}</dd></div><div><dt>${t('study.source.status')}</dt><dd>${note?.status}</dd></div></dl>
<p class="source__note">${note?.note}</p>
${src.originalUrl ? html`<p class="source__meta"><a class="xxd-link" href="${src.originalUrl}" rel="nofollow noopener noreferrer">${t('study.source.original')}</a></p>` : null}</li>`;
  })}</ol>`,
)}
<p class="more"><a class="xxd-link" href="${link(ctx, topicPageRef)}">${t('study.back', { topic: topicName })}</a></p>`,
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
    html`<p class="section__intro">${t(`verdict.${v}.desc` as const)}</p><ul class="studies">${group.map((s) => {
      const tx = s.text[ctx.locale.code];
      return html`<li class="study myth"><h3 class="study__title"><a href="${link(ctx, { kind: 'study', study: s })}">${tx.title}</a></h3>
<div class="study__badges">${gradeBadge(ctx, s.grade)}<span class="study__topic">${t(`topic.${s.topic}` as const)}</span></div>
<div class="versus"><div class="versus__part"><p class="versus__label">${t('myths.claim')}</p><div class="claim">${renderClaim(tx.originalClaim)}</div></div>
<div class="versus__part"><p class="versus__label">${t('myths.evidence')}</p><p class="prose-text">${tx.finding}</p></div></div>
<p class="more"><a class="xxd-link" href="${link(ctx, { kind: 'study', study: s })}">${t('myths.more')}</a></p></li>`;
    })}</ul>`,
  );
})}`,
  };
}

function studiesPage(ctx: Ctx): Content {
  const { t, up } = ctx;
  const total = up.studies.length;
  const options = (all: string, values: [string, string][]) =>
    html`<option value="">${all}</option>${values.map(([value, label]) => html`<option value="${value}">${label}</option>`)}`;
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
      GRADES.map((g) => [g, t('grade.badge', { grade: g, label: ctx.guide.grades[g].label })]),
    )}</select></label></div>
</form>
<p class="filter-count"><span aria-live="polite" data-filter-count="${t('studies.shown', { shown: '{shown}', total: '{total}' })}">${t('studies.shown', { shown: total, total })}</span><button class="xxd-link" type="reset" form="filter" data-filter-reset hidden>${t('studies.reset')}</button></p>
<ul class="studies" data-filter-list>${byTopicThenGrade(up.studies).map((s) => studyItem(ctx, s, 2, 'filterable'))}</ul>
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
    description: t('about.intro'),
    body: html`${pageHeader(ctx, t('about.title'), [t('about.intro')])}
${section(
  'method',
  t('about.method.title'),
  html`<p class="prose-text">${t('about.method.text', { original: n((s) => s.origin === 'original'), added: n((s) => s.origin === 'added') })}</p><p class="prose-text">${t('about.method.limits')}</p>`,
)}
${section('grades', t('about.grades.title'), html`<p class="section__intro">${ctx.guide.gradeNote}</p>${gradeFacts(ctx, true)}`)}
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
  html`<p class="prose-text">${t.html('about.contribute.text', { guide: html`<a class="xxd-link" href="${UPSTREAM_CONTRIBUTING}">${t('about.contribute.guide')}</a>` })}</p><p class="prose-text">${t('about.contribute.site')}</p>`,
)}`,
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

function head(ctx: Ctx, title: string, description: string, links: Part): Html {
  return html`<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${links}
<meta name="color-scheme" content="light dark">
<script src="${asset(ctx, 'vendor/xxd/boot.js')}" data-key="${APPEARANCE_KEY}" data-default-theme="system"></script>
<link rel="stylesheet" href="${asset(ctx, 'vendor/xxd/xxd.css')}">
<link rel="stylesheet" href="${asset(ctx, 'assets/site.css')}">
<script defer src="${asset(ctx, 'vendor/xxd/icons.js')}"></script>
<script defer src="${asset(ctx, 'vendor/xxd/xxd.js')}"></script>
<script defer src="${asset(ctx, 'assets/site.js')}"></script>`;
}

export function renderPage(locale: Locale, t: T, up: Upstream, page: Page): { path: string; html: string } {
  const path = pagePath(locale.code, page);
  const ctx: Ctx = { locale, t, guide: up.guide[locale.code], up, path };
  const c = content(ctx, page);
  const title = page.kind === 'home' ? `${t('site.name')} · ${c.title}` : `${c.title} · ${t('site.name')}`;
  const links = html`<link rel="canonical" href="${SITE_ORIGIN}/${path}">
${ENABLED_LOCALES.map((l) => html`<link rel="alternate" hreflang="${l.htmlLang}" href="${SITE_ORIGIN}/${pagePath(l.code, page)}">\n`)}${
    page.kind === 'home' ? html`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/">` : null
  }`;
  const doc = html`<!doctype html>
<html lang="${locale.htmlLang}" dir="${locale.dir}">
<head>
${head(ctx, title, c.description, links)}
</head>
<body class="xxd-page">
<a class="xxd-sr-only-focusable" href="#main">${t('skip')}</a>
<header class="site-header"><div class="site-header__inner">
<a class="site-brand" href="${link(ctx, { kind: 'home' })}"${attr('aria-current', page.kind === 'home' ? 'page' : null)}>${t('site.name')}</a>
<nav class="site-nav" aria-label="${t('nav.label')}">${NAV.map(([p, key]) => {
    const current = p.kind === page.kind;
    return html`<a class="xxd-link" data-variant="${current ? 'current' : 'plain'}" href="${link(ctx, p)}"${attr('aria-current', current ? 'page' : null)}>${t(key)}</a>`;
  })}</nav>
<div class="site-tools">
<nav class="site-lang" aria-label="${t('lang.label')}">${ENABLED_LOCALES.filter((l) => l.code !== locale.code).map(
    (l) =>
      html`<a class="xxd-link" data-variant="plain" href="${link(ctx, page, l.code)}" hreflang="${l.htmlLang}" lang="${l.htmlLang}"><i data-xxd-icon="Languages" data-size="16"></i>${l.label}</a>`,
  )}</nav>
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
<p><a class="xxd-link" href="${link(ctx, { kind: 'about' })}">${t('footer.about')}</a></p>
</div></footer>
</body>
</html>
`;
  return { path, html: doc.value };
}

// The root page picks a language from the browser's preferred languages and lists every language as a link.
export function renderRoot(locales: { locale: Locale; t: T }[], up: Upstream): string {
  const codes = locales.map((l) => l.locale.code);
  const fallback = locales.find((l) => l.locale.code === FALLBACK_LOCALE) ?? locales[0];
  if (!fallback) throw new Error('no enabled locales');
  const ctx: Ctx = { locale: fallback.locale, t: fallback.t, guide: up.guide[fallback.locale.code], up, path: '' };
  const redirect = `(function(){var codes=${JSON.stringify(codes)};var langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];for(var i=0;i<langs.length;i++){var c=String(langs[i]).toLowerCase().split("-")[0];if(codes.indexOf(c)>=0){location.replace(c+"/");return}}location.replace(${JSON.stringify(FALLBACK_LOCALE)}+"/")})();`;
  const links = html`<link rel="canonical" href="${SITE_ORIGIN}/">
${locales.map((l) => html`<link rel="alternate" hreflang="${l.locale.htmlLang}" href="${SITE_ORIGIN}/${l.locale.code}/">\n`)}<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/">`;
  const title = locales.map((l) => l.t('site.name')).join(' · ');
  const description = locales.map((l) => l.t('site.description', { count: up.studies.length })).join(' ');
  return html`<!doctype html>
<html lang="${fallback.locale.htmlLang}" dir="${fallback.locale.dir}">
<head>
<script>${raw(redirect)}</script>
${head(ctx, title, description, links)}
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
