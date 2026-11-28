// Check the content model and the built site in dist/. Run after `npm run build`. Exits 1 on any problem.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRECTIONS, type Direction } from '../src/directions.ts';
import { EXPLAIN_STAGE, type Explainer } from '../src/explain.ts';
import { FINGERPRINT_FILE, readFingerprints } from '../src/fingerprint.ts';
import { escape } from '../src/html.ts';
import { ENABLED_LOCALES } from '../src/locales.ts';
import { loadUpstream, MYTH_VERDICTS } from '../src/model.ts';
import { SITE_ORIGIN } from '../src/site.ts';
import { loadUi } from '../src/ui.ts';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const problems: string[] = [];
const up = loadUpstream();
const REQUIRED = ['title', 'summary', 'takeaway', 'finding'] as const;
const explainText = (e: Explainer) => [e.question, e.answer, ...e.why, e.caution, ...(e.myth === null ? [] : [e.myth])];

const isPlaceholder = (text: string) => text.startsWith('TODO');
for (const locale of ENABLED_LOCALES) {
  try {
    loadUi(locale);
  } catch (e) {
    problems.push((e as Error).message);
  }
  // Untranslated interface text is written as "TODO " + the English text, so it cannot ship.
  const strings = JSON.parse(readFileSync(`src/ui/${locale.code}.json`, 'utf8')) as Record<string, string>;
  for (const [key, value] of Object.entries(strings)) {
    if (isPlaceholder(value)) problems.push(`${locale.code}: src/ui has a placeholder for ${key}`);
  }
  for (const s of up.studies) {
    for (const field of REQUIRED) {
      if (!s.text[locale.code][field].trim()) problems.push(`${locale.code}: study ${s.id} has an empty ${field}`);
    }
    const e = s.explain[locale.code];
    if (explainText(e).some(isPlaceholder)) {
      problems.push(`${locale.code}: content/explain has a placeholder for ${s.id}`);
    }
  }
}
// The myths page says these claims all come from the original guide.
for (const s of up.studies) {
  if (MYTH_VERDICTS.includes(s.verdict) && s.origin !== 'original') problems.push(`study ${s.id} is on the myths page but was added in review`);
}

// The site-written layers must have been checked against each record as upstream has it now.
const checked = readFingerprints();
for (const id of Object.keys(checked)) {
  if (!up.studies.some((s) => s.id === id)) problems.push(`${FINGERPRINT_FILE} names "${id}", which upstream no longer has`);
}
const stale = up.studies.filter((s) => checked[s.id] !== s.fingerprint).map((s) => s.id);
if (stale.length) {
  problems.push(
    `upstream changed ${stale.length} records since this site's direction, kind, topic and explanations were checked against them: ${stale.join(', ')}. ` +
      'See what changed with `git diff -- data/upstream` (or `git log -p -- data/upstream`), update src/directions.ts, src/explain.ts, ' +
      `TOPIC_OVERRIDES in src/model.ts and content/explain/*.json to fit, then run \`npm run mark-checked -- ${stale.join(' ')}\``,
  );
}

if (!existsSync('dist')) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const files = new Set(walk('dist').map((f) => relative('dist', f)));
const pages = [...files].filter((f) => f.endsWith('.html')).sort();
const fileFor = (urlPath: string) => (urlPath === '' || urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
// Cloudflare serves the nearest 404.html at any missing URL, so these are never indexed and link only root-absolute.
const NOT_FOUND = ['404.html', ...ENABLED_LOCALES.map((l) => `${l.code}/404.html`)];
const isNotFound = (file: string) => file === '404.html' || file.endsWith('/404.html');
for (const file of [...NOT_FOUND, 'sitemap.xml', 'robots.txt']) if (!files.has(file)) problems.push(`dist/${file} is missing`);
const distText = (file: string) => (files.has(file) ? readFileSync(join('dist', file), 'utf8') : '');

// The sitemap lists every indexable page and the root once, each with the alternates its own <head> names.
const sitemap = new Map<string, string>();
for (const m of distText('sitemap.xml').matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const body = m[1] as string;
  const loc = /<loc>([^<]*)<\/loc>/.exec(body)?.[1] ?? '';
  if (sitemap.has(loc)) problems.push(`dist/sitemap.xml lists ${loc} twice`);
  sitemap.set(loc, [...body.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g)].map((a) => `${a[1]} ${a[2]}`).sort().join('\n'));
}
const notInSitemap = new Set(sitemap.keys());
const sitemapLine = `Sitemap: ${SITE_ORIGIN}/sitemap.xml`;
if (!distText('robots.txt').split('\n').includes(sitemapLine)) problems.push(`dist/robots.txt has no "${sitemapLine}" line`);

let links = 0;
let notFoundLinks = 0;
let ogPages = 0;
const titles = new Map<string, string>();
for (const file of pages) {
  const text = readFileSync(join('dist', file), 'utf8');
  const urlPath = file.replace(/index\.html$/, '');
  const at = `dist/${file}`;
  const notFound = isNotFound(file);

  for (const m of text.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const ref = (m[1] as string).replaceAll('&amp;', '&');
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) continue;
    links++;
    if (notFound) {
      notFoundLinks++;
      if (!ref.startsWith('/')) problems.push(`${at}: link "${ref}" is not root-absolute`);
    }
    const target = decodeURIComponent(new URL(ref, `https://site.invalid/${urlPath}`).pathname.slice(1));
    if (!files.has(fileFor(target))) problems.push(`${at}: link "${ref}" points to missing ${fileFor(target)}`);
  }

  const h1s = text.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) problems.push(`${at}: ${h1s} <h1> elements, expected 1`);

  const locale = ENABLED_LOCALES.find((l) => urlPath.startsWith(`${l.code}/`));
  const tag = /<html lang="([^"]+)" dir="([^"]+)">/.exec(text);
  if (!tag) problems.push(`${at}: no <html lang dir>`);
  else if (locale && (tag[1] !== locale.htmlLang || tag[2] !== locale.dir)) {
    problems.push(`${at}: <html lang="${tag[1]}" dir="${tag[2]}">, expected lang="${locale.htmlLang}" dir="${locale.dir}"`);
  }

  const title = /<title>([^<]*)<\/title>/.exec(text)?.[1]?.trim();
  if (!title) problems.push(`${at}: empty or missing <title>`);
  const description = /<meta name="description" content="([^"]+)">/.exec(text)?.[1];
  if (!description) problems.push(`${at}: empty or missing meta description`);

  if (notFound) {
    if (!text.includes('<meta name="robots" content="noindex">')) problems.push(`${at}: no robots noindex meta`);
    for (const [what, pattern] of [
      ['a canonical', /<link rel="canonical"/],
      ['an hreflang alternate', /<link rel="alternate" hreflang=/],
      ['an Open Graph tag', /<meta property="og:/],
    ] as const) {
      if (pattern.test(text)) problems.push(`${at}: has ${what}`);
    }
    continue;
  }
  if (title && titles.has(title)) problems.push(`${at}: same <title> as dist/${titles.get(title)}`);
  else if (title) titles.set(title, file);

  const canonicals = [...text.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map((c) => c[1]);
  if (canonicals.length !== 1 || canonicals[0] !== `${SITE_ORIGIN}/${urlPath}`) {
    problems.push(`${at}: canonical ${JSON.stringify(canonicals)}, expected ["${SITE_ORIGIN}/${urlPath}"]`);
  }

  // Link previews show the same title and description as search results.
  const og = (name: string) => new RegExp(`<meta property="og:${name}" content="([^"]*)">`).exec(text)?.[1];
  if (og('url') !== canonicals[0]) problems.push(`${at}: og:url ${og('url')} is not its canonical ${canonicals[0]}`);
  if (!og('title') || og('title') !== title) problems.push(`${at}: og:title "${og('title')}" is not its <title>`);
  if (!og('description') || og('description') !== description) problems.push(`${at}: og:description is not its meta description`);
  ogPages++;

  const alternateLinks = [...text.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)];
  const alternates = new Map(alternateLinks.map((a) => [a[1] as string, a[2] as string]));
  const url = `${SITE_ORIGIN}/${urlPath}`;
  const listed = sitemap.get(url);
  if (listed === undefined) problems.push(`${at}: not in dist/sitemap.xml`);
  else if (listed !== alternateLinks.map((a) => `${a[1]} ${a[2]}`).sort().join('\n')) problems.push(`${at}: its alternates in dist/sitemap.xml differ from its hreflang links`);
  notInSitemap.delete(url);
  for (const l of ENABLED_LOCALES) {
    const href = alternates.get(l.htmlLang);
    if (!href) {
      problems.push(`${at}: no hreflang="${l.htmlLang}" alternate`);
      continue;
    }
    if (!href.startsWith(`${SITE_ORIGIN}/`) || !files.has(fileFor(href.slice(SITE_ORIGIN.length + 1)))) {
      problems.push(`${at}: hreflang="${l.htmlLang}" points to missing ${href}`);
    }
    if (l === locale && href !== `${SITE_ORIGIN}/${urlPath}`) problems.push(`${at}: its own hreflang alternate is not its canonical URL`);
  }
}

for (const loc of notInSitemap) problems.push(`dist/sitemap.xml lists ${loc}, which is not an indexable page in dist/`);

// Every study page exists in every enabled language and shows the upstream text, this site's explanation and its direction.
// A direction chip is an optional kit icon followed by the label.
const directionTag = (text: string) =>
  [...text.matchAll(/<span class="xxd-badge" data-direction="([^"]+)"[^>]*>(?:<i [^>]*><\/i>)?([^<]*)<\/span>/g)].map((m) => ({ direction: m[1], label: m[2] }));
for (const locale of ENABLED_LOCALES) {
  const t = loadUi(locale);
  for (const s of up.studies) {
    const file = `${locale.code}/studies/${s.id}/index.html`;
    if (!files.has(file)) {
      problems.push(`dist/${file} is missing`);
      continue;
    }
    const page = readFileSync(join('dist', file), 'utf8');
    for (const field of REQUIRED) {
      if (!page.includes(escape(s.text[locale.code][field]))) problems.push(`dist/${file} does not show its ${field}`);
    }
    if (!explainText(s.explain[locale.code]).every((line) => page.includes(escape(line)))) problems.push(`dist/${file} does not show all of content/explain`);
    // Cards for other studies in the same topic follow the article; only the article itself must carry this study's direction.
    const text = page.split('aria-labelledby="related"')[0] as string;
    const tags = directionTag(text);
    const label = escape(t(`direction.${s.direction}`));
    if (!tags.length || tags.some((tag) => tag.direction !== s.direction || tag.label !== label)) {
      problems.push(`dist/${file} tags ${JSON.stringify(tags)}, expected only "${s.direction}" labelled "${label}"`);
    }
  }
}

// The home page lists strong evidence by direction: a study that found harm or no effect must never sit under "do this".
const HOME_SECTIONS: Record<string, readonly Direction[]> = { helps: ['helps'], 'no-help': ['harms', 'no-effect'] };
const directionById = new Map(up.studies.map((s) => [s.id, s.direction]));
const homeCounts: string[] = [];
for (const locale of ENABLED_LOCALES) {
  const file = `dist/${locale.code}/index.html`;
  const text = readFileSync(file, 'utf8');
  for (const [id, allowed] of Object.entries(HOME_SECTIONS)) {
    const body = new RegExp(`<section class="section" aria-labelledby="${id}">([\\s\\S]*?)</section>`).exec(text)?.[1];
    if (!body) {
      problems.push(`${file}: no section "${id}"`);
      continue;
    }
    const items = [...body.matchAll(/<a class="xxd-card study-card" href="[^"]*studies\/([^/"]+)\/">([\s\S]*?)<\/a>/g)].map((m) => ({ studyId: m[1], item: m[2] as string }));
    if (!items.length) problems.push(`${file}: section "${id}" lists no studies`);
    for (const { studyId, item } of items) {
      const direction = studyId === undefined ? undefined : directionById.get(studyId);
      const tags = directionTag(item).map((tag) => tag.direction);
      if (!direction || !allowed.includes(direction)) problems.push(`${file}: section "${id}" lists ${studyId}, whose direction is ${direction}`);
      if (tags.length !== 1 || tags[0] !== direction) problems.push(`${file}: ${studyId} in section "${id}" is tagged ${JSON.stringify(tags)}`);
    }
    homeCounts.push(`${locale.code} ${id} ${items.length}`);
  }
}

if (problems.length) {
  console.error(`check failed with ${problems.length} problems:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
const codes = ENABLED_LOCALES.map((l) => l.code).join(' + ');
console.log(`content: ${up.studies.length} studies in ${codes}, each showing its title, summary, takeaway, finding and every content/explain line, none a placeholder`);
console.log(`upstream: all ${up.studies.length} records match the fingerprint they had when the site's layers were last checked (${FINGERPRINT_FILE})`);
console.log(`explain review: ${ENABLED_LOCALES.map((l) => `${l.code} ${EXPLAIN_STAGE[l.code]}`).join(', ')}`);
console.log(`direction: every study page shows its tag (${DIRECTIONS.map((d) => `${d} ${up.studies.filter((s) => s.direction === d).length}`).join(', ')})`);
console.log(`home: no harms or no-effect study under "helps" (${homeCounts.join(', ')})`);
console.log(`ui: src/ui/{${ENABLED_LOCALES.map((l) => l.code).join(',')}}.json have every key and placeholder of zh.json, and no value starts with TODO`);
console.log(`pages: ${pages.length} HTML files, ${links} internal links and assets resolve`);
console.log(`h1: every page has exactly one <h1>`);
console.log(`head: every page has <html lang dir>, a <title> and a meta description; every page but 404.html has a unique <title>, its canonical URL and hreflang for ${codes}`);
console.log(`og: all ${ogPages} indexable pages have og:url equal to their canonical, and og:title and og:description equal to their <title> and meta description`);
console.log(`sitemap: ${sitemap.size} URLs, exactly the indexable pages plus the root, each with the alternates its page's hreflang links name`);
console.log(`robots: dist/robots.txt has "${sitemapLine}"`);
console.log(`404: ${NOT_FOUND.map((f) => `dist/${f}`).join(', ')} are noindex with no canonical, hreflang or Open Graph tags, and all ${notFoundLinks} of their links and assets are root-absolute`);
console.log('check passed');
