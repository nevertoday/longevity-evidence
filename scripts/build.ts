// Render every enabled locale into dist/. The old dist/ is replaced only after the new one is complete.
import { cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENABLED_LOCALES } from '../src/locales.ts';
import { loadUpstream } from '../src/model.ts';
import { renderPage, renderRoot, sitePages } from '../src/pages.ts';
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
const pages = sitePages(up);
for (const { locale, t } of locales) {
  for (const page of pages) {
    const out = renderPage(locale, t, up, page);
    write(join(out.path, 'index.html'), out.html);
  }
}
write('index.html', renderRoot(locales, up));
for (const file of VENDOR_FILES) cpSync(join('vendor/xxd', file), join(TMP, 'vendor/xxd', file));
cpSync('src/assets', join(TMP, 'assets'), { recursive: true });

rmSync(OUT, { recursive: true, force: true });
renameSync(TMP, OUT);
console.log(`dist/: ${pages.length * locales.length + 1} pages, ${locales.map((l) => l.locale.code).join(' + ')}, upstream ${up.source.commit.slice(0, 7)}`);
