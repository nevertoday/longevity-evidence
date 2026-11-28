// Bring in batch files that a web bot (Grok, Muse …) wrote by following the desktop instructions.
// Each file is JSON lines. The first line is the batch manifest, which names the PMIDs the bot read. Every later
// line is a finding or a skip. This script fetches those PMIDs from PubMed itself, so a quote is checked against
// PubMed's abstract and never against text the bot supplied, and then validates the batch like any other shard.
// Usage: node collect/import-batch.ts <file.jsonl> ...
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSkip } from './schema.ts';
import { loadPapers, passed, validateShard } from './validate.ts';

type Manifest = { batch: string; card: string; retstart: number; retmax: number; queryCount: number; pmids: string[] };

function parseManifest(line: string | undefined, file: string): Manifest {
  const m = JSON.parse(line ?? 'null') as Partial<Manifest> | null;
  if (!m || typeof m.batch !== 'string' || !/^[a-z]+-[A-Z]+-\d{4}$/.test(m.batch)) throw new Error(`${file}: first line must be the manifest with a batch like "eating-MA-0001"`);
  if (!Array.isArray(m.pmids) || !m.pmids.length || !m.pmids.every((p) => typeof p === 'string' && /^\d{1,9}$/.test(p))) throw new Error(`${file}: manifest pmids must be PMID strings`);
  return m as Manifest;
}

const files = process.argv.slice(2).map((f) => resolve(f));
if (!files.length) {
  console.error('Usage: node collect/import-batch.ts <file.jsonl> ...');
  process.exit(1);
}
const here = fileURLToPath(new URL('.', import.meta.url));
process.chdir(here);
mkdirSync('out/shards', { recursive: true });
mkdirSync('out/findings', { recursive: true });

const batches = files.map((file) => {
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{'));
  const manifest = parseManifest(lines[0], basename(file));
  const pmids = [...new Set(manifest.pmids)];
  writeFileSync(`out/shards/${manifest.batch}.txt`, `${pmids.join('\n')}\n`);
  writeFileSync(`out/findings/${manifest.batch}.jsonl`, `${lines.slice(1).join('\n')}\n`);
  return { manifest, pmids };
});

const wanted = [...new Set(batches.flatMap((b) => b.pmids))];
const have = existsSync('out/papers.jsonl') ? loadPapers() : new Map();
const missing = wanted.filter((id) => !have.has(id));
for (let i = 0; i < missing.length; i += 150) {
  const term = missing
    .slice(i, i + 150)
    .map((id) => `${id}[uid]`)
    .join(' OR ');
  execFileSync('node', ['fetch-pubmed.ts', '--term', term], { stdio: 'inherit' });
}

const papers = loadPapers();
let failed = 0;
for (const { manifest, pmids } of batches) {
  const r = validateShard(manifest.batch, papers);
  const unknown = pmids.filter((id) => !papers.has(id));
  if (!passed(r)) failed++;
  const findings = r.rows.filter((x) => !isSkip(x)).length;
  console.log(
    `${manifest.batch}: ${pmids.length} papers, ${findings} findings, ${r.rows.length - findings} skips, ${r.rejects.length} rejected, ${r.missing.length} unanswered` +
      (unknown.length ? `, ${unknown.length} PMIDs PubMed does not have` : '') +
      (r.rejects.length ? ` → out/rejects/${manifest.batch}.jsonl` : ''),
  );
}
process.exit(failed ? 1 : 0);

