// Check the content model and the built site in dist/. Run after `npm run build`. Exits 1 on any problem.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRECTIONS, type Direction } from '../src/directions.ts';
import { escape } from '../src/html.ts';
import { ENABLED_LOCALES } from '../src/locales.ts';
import { loadUpstream, MYTH_VERDICTS } from '../src/model.ts';
import { SITE_ORIGIN } from '../src/site.ts';
import { loadUi } from '../src/ui.ts';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const problems: string[] = [];
const up = loadUpstream();
const REQUIRED = ['title', 'summary', 'takeaway', 'finding'] as const;

for (const locale of ENABLED_LOCALES) {
  try {
    loadUi(locale);
  } catch (e) {
    problems.push((e as Error).message);
  }
  for (const s of up.studies) {
    for (const field of REQUIRED) {
      if (!s.text[locale.code][field].trim()) problems.push(`${locale.code}: study ${s.id} has an empty ${field}`);
    }
  }
}
// The myths page says these claims all come from the original guide.
for (const s of up.studies) {
  if (MYTH_VERDICTS.includes(s.verdict) && s.origin !== 'original') problems.push(`study ${s.id} is on the myths page but was added in review`);
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

let links = 0;
const titles = new Map<string, string>();
for (const file of pages) {
  const text = readFileSync(join('dist', file), 'utf8');
  const urlPath = file.replace(/index\.html$/, '');
  const at = `dist/${file}`;

  for (const m of text.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const ref = (m[1] as string).replaceAll('&amp;', '&');
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) continue;
    links++;
    const target = decodeURIComponent(new URL(ref, `https://site.invalid/${urlPath}`).pathname.slice(1));
    if (!files.has(fileFor(target))) problems.push(`${at}: link "${ref}" points to missing ${fileFor(target)}`);
  }

  const locale = ENABLED_LOCALES.find((l) => urlPath.startsWith(`${l.code}/`));
  const tag = /<html lang="([^"]+)" dir="([^"]+)">/.exec(text);
  if (!tag) problems.push(`${at}: no <html lang dir>`);
  else if (locale && (tag[1] !== locale.htmlLang || tag[2] !== locale.dir)) {
    problems.push(`${at}: <html lang="${tag[1]}" dir="${tag[2]}">, expected lang="${locale.htmlLang}" dir="${locale.dir}"`);
  }

  const title = /<title>([^<]*)<\/title>/.exec(text)?.[1]?.trim();
  if (!title) problems.push(`${at}: empty or missing <title>`);
  else if (titles.has(title)) problems.push(`${at}: same <title> as dist/${titles.get(title)}`);
  else titles.set(title, file);
  if (!/<meta name="description" content="[^"]+">/.test(text)) problems.push(`${at}: empty or missing meta description`);

  const canonicals = [...text.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map((c) => c[1]);
  if (canonicals.length !== 1 || canonicals[0] !== `${SITE_ORIGIN}/${urlPath}`) {
    problems.push(`${at}: canonical ${JSON.stringify(canonicals)}, expected ["${SITE_ORIGIN}/${urlPath}"]`);
  }

  const alternates = new Map([...text.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((a) => [a[1] as string, a[2] as string]));
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

// Every study page exists in every enabled language and shows the reader text and its direction.
const directionTag = (text: string) => [...text.matchAll(/<span class="xxd-badge" data-direction="([^"]+)"[^>]*>([^<]*)<\/span>/g)].map((m) => ({ direction: m[1], label: m[2] }));
for (const locale of ENABLED_LOCALES) {
  const t = loadUi(locale);
  for (const s of up.studies) {
    const file = `${locale.code}/studies/${s.id}/index.html`;
    if (!files.has(file)) {
      problems.push(`dist/${file} is missing`);
      continue;
    }
    const text = readFileSync(join('dist', file), 'utf8');
    for (const field of REQUIRED) {
      if (!text.includes(escape(s.text[locale.code][field]))) problems.push(`dist/${file} does not show its ${field}`);
    }
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
    const items = [...body.matchAll(/<li class="study">([\s\S]*?)<\/li>/g)].map((m) => m[1] as string);
    if (!items.length) problems.push(`${file}: section "${id}" lists no studies`);
    for (const item of items) {
      const studyId = /href="[^"]*studies\/([^/"]+)\/"/.exec(item)?.[1];
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
console.log(`content: ${up.studies.length} studies in ${codes}, each with title, summary, takeaway and finding`);
console.log(`direction: every study page shows its tag (${DIRECTIONS.map((d) => `${d} ${up.studies.filter((s) => s.direction === d).length}`).join(', ')})`);
console.log(`home: no harms or no-effect study under "helps" (${homeCounts.join(', ')})`);
console.log(`ui: src/ui/{${ENABLED_LOCALES.map((l) => l.code).join(',')}}.json have every key and placeholder of zh.json`);
console.log(`pages: ${pages.length} HTML files, ${links} internal links and assets resolve`);
console.log(`head: every page has <html lang dir>, a unique <title>, a meta description, its canonical URL and hreflang for ${codes}`);
console.log('check passed');
