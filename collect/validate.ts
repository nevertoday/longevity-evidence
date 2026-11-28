// Check each bot's output against the papers it was given, before anything is imported.
// A shard passes when every line parses and meets checkRow, no finding id repeats, and every PMID in the shard
// has at least one line. Failed lines go to out/rejects/<shard>.jsonl with the reason, which run.ts feeds back.
// Usage: node collect/validate.ts [shard ...]     (default: every shard that has output)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkRow, isSkip, type Paper, type Row } from './schema.ts';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));

export const loadPapers = () =>
  new Map(
    readFileSync('out/papers.jsonl', 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Paper)
      .map((p) => [p.pmid, p]),
  );

export const shardIds = (shard: string) => readFileSync(`out/shards/${shard}.txt`, 'utf8').split('\n').filter(Boolean);

export type ShardResult = { shard: string; rows: Row[]; rejects: { line: string; error: string }[]; missing: string[] };

export function validateShard(shard: string, papers: Map<string, Paper>): ShardResult {
  const ids = new Set(shardIds(shard));
  const rows: Row[] = [];
  const rejects: ShardResult['rejects'] = [];
  const seen = new Set<string>();
  for (const line of readFileSync(`out/findings/${shard}.jsonl`, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      rejects.push({ line, error: 'not JSON' });
      continue;
    }
    const c = checkRow(raw, papers, ids);
    if (!c.ok) {
      rejects.push({ line, error: c.error });
      continue;
    }
    const key = isSkip(c.row) ? `${c.row.pmid}#skip` : `${c.row.pmid}#${c.row.n}`;
    if (seen.has(key)) {
      rejects.push({ line, error: `${key} appears twice` });
      continue;
    }
    seen.add(key);
    rows.push(c.row);
  }
  const answered = new Set(rows.map((r) => r.pmid));
  const missing = [...ids].filter((id) => !answered.has(id));
  mkdirSync('out/rejects', { recursive: true });
  const rejectFile = `out/rejects/${shard}.jsonl`;
  if (rejects.length) writeFileSync(rejectFile, rejects.map((r) => `${JSON.stringify(r)}\n`).join(''));
  else rmSync(rejectFile, { force: true });
  return { shard, rows, rejects, missing };
}

export const passed = (r: ShardResult) => !r.rejects.length && !r.missing.length;

if (import.meta.url === `file://${process.argv[1]}`) {
  const papers = loadPapers();
  const shards = process.argv.length > 2 ? process.argv.slice(2) : existsSync('out/findings') ? readdirSync('out/findings').map((f) => f.replace(/\.jsonl$/, '')) : [];
  let findings = 0;
  let skips = 0;
  let failed = 0;
  const reasons = new Map<string, number>();
  for (const shard of shards.sort()) {
    const r = validateShard(shard, papers);
    findings += r.rows.filter((x) => !isSkip(x)).length;
    skips += r.rows.filter(isSkip).length;
    for (const x of r.rejects) {
      const reason = x.error.replace(/\d[\d.]*/g, 'N').replace(/"[^"]*"/g, '"…"');
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    if (!passed(r)) failed++;
    console.log(`${shard}: ${r.rows.length} ok, ${r.rejects.length} rejected, ${r.missing.length} papers unanswered`);
  }
  console.log(`\n${shards.length} shards, ${shards.length - failed} passed · ${findings} findings · ${skips} skipped papers`);
  for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${n} × ${reason}`);
  process.exit(failed ? 1 : 0);
}
