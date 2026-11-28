// Record that the site-written layers of the named records now match upstream as it is in data/upstream/.
// Run it only after rereading each record and updating its direction, kind, topic and explanations to fit.
// Usage: npm run mark-checked -- <id>...    or    npm run mark-checked -- --all
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FINGERPRINT_FILE, readFingerprints, writeFingerprints } from '../src/fingerprint.ts';
import { loadUpstream } from '../src/model.ts';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: npm run mark-checked -- <id>...   (or --all)');
  process.exit(1);
}
const up = loadUpstream();
const known = new Set(up.studies.map((s) => s.id));
const ids = args.includes('--all') ? [...known] : args;
const unknown = ids.filter((id) => !known.has(id));
if (unknown.length) {
  console.error(`Not upstream records: ${unknown.join(', ')}`);
  process.exit(1);
}

const old = existsSync(FINGERPRINT_FILE) ? readFingerprints() : {};
const marked = new Set(ids);
// Records upstream dropped leave the file; records not named keep their old fingerprint.
const next: Record<string, string> = {};
for (const s of up.studies) {
  const value = marked.has(s.id) ? s.fingerprint : old[s.id];
  if (value !== undefined) next[s.id] = value;
}
writeFingerprints(next);
const stale = up.studies.filter((s) => next[s.id] !== s.fingerprint).length;
console.log(`${FINGERPRINT_FILE}: ${ids.length} marked as checked against upstream ${up.source.commit.slice(0, 7)}, ${stale} still to check`);
