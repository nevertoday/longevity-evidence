// Bring in claim batches that a web bot (Grok, Muse …) wrote by following the desktop claim-hunting instructions.
// Each file is JSON lines: a manifest first, then one claim per line. The script fetches every cited PMID from PubMed
// itself and checks each quote against that abstract. With --pages it also opens each official page and checks its
// quote there. Accepted lines go to out/claims/batches/, rejected ones with reasons to out/claims/rejects/.
// Every run rebuilds out/claims/claims.jsonl, one line per claimKey with every language's version merged, and
// out/claims/done/<card>.txt, the claimKeys a card already has, to paste into the bot's next session.
// Usage: node collect/import-claims.ts [--pages] <file.jsonl> ...
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { LocaleCode } from '../src/locales.ts';
import { checkClaim, parseManifest, type Claim, type Evidence, type Sighting } from './claims.ts';
import { normalize } from './schema.ts';
import { loadPapers } from './validate.ts';

const { values, positionals } = parseArgs({ options: { pages: { type: 'boolean', default: false } }, allowPositionals: true });
const files = positionals.map((f) => resolve(f));
if (!files.length) {
  console.error('Usage: node collect/import-claims.ts [--pages] <file.jsonl> ...');
  process.exit(1);
}
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
for (const d of ['out/claims/batches', 'out/claims/rejects', 'out/claims/done']) mkdirSync(d, { recursive: true });

type Batch = { file: string; batch: string; card: string; lang: LocaleCode; lines: string[]; declared: number };
const batches: Batch[] = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{'));
  let head: unknown;
  try {
    head = JSON.parse(lines[0] ?? 'null');
  } catch {
    head = null;
  }
  const m = parseManifest(head);
  if (typeof m === 'string') {
    console.error(`${basename(file)}: ${m}`);
    process.exitCode = 1;
    continue;
  }
  batches.push({ file, batch: m.batch, card: m.card, lang: m.batch.slice(0, 2) as LocaleCode, lines: lines.slice(1), declared: m.claims });
}

// Fetch every cited PMID we do not have yet, so quotes are checked against PubMed's text.
const cited = new Set<string>();
for (const b of batches)
  for (const l of b.lines) {
    try {
      const r = JSON.parse(l) as { evidence?: { kind?: string; pmid?: unknown }[] };
      for (const e of r.evidence ?? []) if (e.kind === 'pubmed' && typeof e.pmid === 'string' && /^\d{1,9}$/.test(e.pmid)) cited.add(e.pmid);
    } catch {}
  }
const have = existsSync('out/papers.jsonl') ? loadPapers() : new Map();
const missing = [...cited].filter((id) => !have.has(id));
for (let i = 0; i < missing.length; i += 150) {
  const term = missing.slice(i, i + 150).map((id) => `${id}[uid]`).join(' OR ');
  execFileSync('node', ['fetch-pubmed.ts', '--term', term, '--no-shards'], { stdio: 'inherit' });
}
const papers = existsSync('out/papers.jsonl') ? loadPapers() : new Map();

const pageCache = new Map<string, string | null>();
async function pageText(url: string): Promise<string | null> {
  if (!pageCache.has(url)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (claim-check)' } });
      const html = res.ok ? await res.text() : null;
      pageCache.set(url, html && normalize(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')));
    } catch {
      pageCache.set(url, null);
    }
  }
  return pageCache.get(url) ?? null;
}

let failed = 0;
for (const b of batches) {
  const ok: Claim[] = [];
  const rejects: { line: string; error: string }[] = [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const line of b.lines) {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      rejects.push({ line, error: 'not JSON' });
      continue;
    }
    const c = checkClaim(raw, b.batch, b.lang, papers);
    if (!c.ok) {
      rejects.push({ line, error: c.error });
      continue;
    }
    if (ids.has(c.claim.id)) rejects.push({ line, error: `id ${c.claim.id} is used twice` });
    else if (keys.has(c.claim.claimKey)) rejects.push({ line, error: `claimKey ${c.claim.claimKey} appears twice in this batch` });
    else {
      if (values.pages) {
        const bad = [];
        for (const e of c.claim.evidence) {
          if (e.kind !== 'authority') continue;
          const t = await pageText(e.url);
          if (t === null) bad.push(`could not open ${e.url}`);
          else if (!t.includes(normalize(e.quote))) bad.push(`quote is not on ${e.url}`);
        }
        if (bad.length) {
          rejects.push({ line, error: bad.join('; ') });
          continue;
        }
      }
      ids.add(c.claim.id);
      keys.add(c.claim.claimKey);
      ok.push(c.claim);
    }
  }
  writeFileSync(`out/claims/batches/${b.batch}.jsonl`, ok.map((c) => `${JSON.stringify(c)}\n`).join(''));
  const rejectFile = `out/claims/rejects/${b.batch}.jsonl`;
  if (rejects.length) writeFileSync(rejectFile, rejects.map((r) => `${JSON.stringify(r)}\n`).join(''));
  else rmSync(rejectFile, { force: true });
  if (rejects.length) failed++;
  const counted = b.lines.length === b.declared ? '' : `, manifest says ${b.declared} but the file has ${b.lines.length}`;
  console.log(`${b.batch}: ${ok.length} accepted, ${rejects.length} rejected${counted}${rejects.length ? ` → collect/${rejectFile}` : ''}`);
}

// Rebuild the merged view from every accepted batch, old and new.
type Merged = {
  claimKey: string;
  claimEn: string;
  topic: Claim['topic'];
  outcome: Claim['outcome'];
  verdicts: Claim['verdict'][];
  versions: Pick<Claim, 'id' | 'lang' | 'claim' | 'question' | 'answer' | 'verdict' | 'grade'>[];
  sightings: Sighting[];
  evidence: Evidence[];
};
const merged = new Map<string, Merged>();
const byCard = new Map<string, Set<string>>();
for (const f of readdirSync('out/claims/batches').sort()) {
  const card = f.replace(/-\d{4}\.jsonl$/, '');
  for (const l of readFileSync(`out/claims/batches/${f}`, 'utf8').split('\n').filter(Boolean)) {
    const c = JSON.parse(l) as Claim;
    byCard.set(card, (byCard.get(card) ?? new Set()).add(c.claimKey));
    const m = merged.get(c.claimKey) ?? { claimKey: c.claimKey, claimEn: c.claimEn, topic: c.topic, outcome: c.outcome, verdicts: [], versions: [], sightings: [], evidence: [] };
    if (!m.verdicts.includes(c.verdict)) m.verdicts.push(c.verdict);
    m.versions.push({ id: c.id, lang: c.lang, claim: c.claim, question: c.question, answer: c.answer, verdict: c.verdict, grade: c.grade });
    for (const s of c.sightings) if (!m.sightings.some((x) => x.url === s.url)) m.sightings.push(s);
    for (const e of c.evidence) if (!m.evidence.some((x) => (x.kind === 'pubmed' && e.kind === 'pubmed' ? x.pmid === e.pmid : x.kind === 'authority' && e.kind === 'authority' && x.url === e.url))) m.evidence.push(e);
    merged.set(c.claimKey, m);
  }
}
writeFileSync('out/claims/claims.jsonl', [...merged.values()].map((m) => `${JSON.stringify(m)}\n`).join(''));
for (const [card, keys] of byCard) writeFileSync(`out/claims/done/${card}.txt`, `${[...keys].sort().join(', ')}\n`);

const rows = [...merged.values()].reduce((n, m) => n + m.versions.length + m.sightings.length + m.evidence.length, 0);
const conflicts = [...merged.values()].filter((m) => m.verdicts.length > 1).length;
console.log(`\nout/claims/claims.jsonl: ${merged.size} claims, ${rows} rows (versions + sightings + evidence), ${conflicts} with verdicts that disagree across versions`);
console.log('Paste out/claims/done/<card>.txt into the bot when you continue a card, so it skips what it already found.');
process.exit(failed || process.exitCode ? 1 : 0);
