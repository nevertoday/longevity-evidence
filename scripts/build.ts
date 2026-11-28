// Render every enabled locale into dist/. The old dist/ is replaced only after the new one is complete.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENABLED_LOCALES, FALLBACK_LOCALE } from '../src/locales.ts';
import { loadUpstream } from '../src/model.ts';
import { alternates, outFile, pageUrl, renderPage, renderRoot, ROOT_URL, sitePages, type Page, type Site } from '../src/pages.ts';
import { robotsTxt, sitemapXml } from '../src/seo.ts';
import { loadUi } from '../src/ui.ts';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const OUT = 'dist';
const TMP = 'dist.tmp';
const VENDOR_FILES = ['boot.js', 'xxd.css', 'icons.js', 'xxd.js', 'LICENSE'];

rmSync(TMP, { recursive: true, force: true });
const write = (path: string, text: string) => {
  const file = join(TMP, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

const up = loadUpstream();
const locales = ENABLED_LOCALES.map((locale) => ({ locale, t: loadUi(locale) }));
const explainedAt = execFileSync('git', ['log', '-1', '--format=%cs', '--', 'content/explain'], { encoding: 'utf8' }).trim();
if (!explainedAt) throw new Error('git log has no commit for content/explain, so study pages cannot say when their explanations were revised');
const site: Site = { up, langs: locales, explainedAt };
const pages = sitePages(up);
const notFound: Page = { kind: 'notfound' };
for (const lang of locales) {
  for (const page of [...pages, notFound]) write(outFile(lang.locale.code, page), renderPage(site, lang, page));
}
write('index.html', renderRoot(site));
// For a missing URL outside every language folder.
const fallback = locales.find((l) => l.locale.code === FALLBACK_LOCALE);
if (!fallback) throw new Error(`FALLBACK_LOCALE ${FALLBACK_LOCALE} is not enabled`);
write('404.html', renderPage(site, fallback, notFound));
write(
  'sitemap.xml',
  sitemapXml([
    { loc: ROOT_URL, alternates: alternates({ kind: 'home' }) },
    ...pages.flatMap((page) => locales.map(({ locale }) => ({ loc: pageUrl(locale.code, page), alternates: alternates(page) }))),
  ]),
);
write('robots.txt', robotsTxt());
for (const file of VENDOR_FILES) cpSync(join('vendor/xxd', file), join(TMP, 'vendor/xxd', file));
cpSync('src/assets', join(TMP, 'assets'), { recursive: true });

rmSync(OUT, { recursive: true, force: true });
renameSync(TMP, OUT);
console.log(`dist/: ${pages.length * locales.length + 1} pages and ${locales.length + 1} not-found pages, ${locales.map((l) => l.locale.code).join(' + ')}, upstream ${up.source.commit.slice(0, 7)}`);
