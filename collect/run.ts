// Give each unfinished shard to a bot with BRIEF.md and only that shard's abstracts, save what it answers, and check
// it. A shard that fails goes back to the bot once more with the rejected lines and the reasons attached.
// A shard whose output already passes is never sent again, so the command can be stopped and rerun at any time.
// Usage: node collect/run.ts [--bot claude|codex] [--shards 5] [--parallel 2] [--model <slug>]
// This Mac runs at most 4 batch workers at once in total, so --parallel is cut to what is left.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadPapers, passed, shardIds, validateShard } from './validate.ts';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const { values } = parseArgs({
  options: { bot: { type: 'string', default: 'claude' }, shards: { type: 'string', default: '5' }, parallel: { type: 'string', default: '2' }, model: { type: 'string' } },
});
const BOT = values.bot;
if (BOT !== 'claude' && BOT !== 'codex') throw new Error(`--bot ${BOT}: use claude or codex`);

const busy = (() => {
  try {
    return execFileSync('pgrep', ['-f', 'agy -p|agy --dangerously|codex exec|claude -p'], { encoding: 'utf8' }).split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
})();
const parallel = Math.min(Number(values.parallel), 4 - busy);
if (parallel < 1) throw new Error(`${busy} batch workers already running on this Mac; the limit is 4`);

const brief = readFileSync('BRIEF.md', 'utf8');
const papers = loadPapers();
mkdirSync('out/findings', { recursive: true });

const done = (shard: string) => existsSync(`out/findings/${shard}.jsonl`) && passed(validateShard(shard, papers));
const queue = readdirSync('out/shards')
  .map((f) => f.replace(/\.txt$/, ''))
  .sort()
  .filter((s) => !done(s))
  .slice(0, Number(values.shards));

function prompt(shard: string): string {
  const input = shardIds(shard).map((id) => {
    const p = papers.get(id);
    if (!p) throw new Error(`shard ${shard}: ${id} was never fetched`);
    return JSON.stringify({ pmid: p.pmid, title: p.title, year: p.year, publicationTypes: p.publicationTypes, abstract: p.abstract });
  });
  const rejectFile = `out/rejects/${shard}.jsonl`;
  const retry = existsSync(rejectFile)
    ? `\n\n## 上一次被退回的行\n\n上一次的输出里，下面这些行没有通过检查。改正后连同其他行一起，把这一批的完整答案重新输出一遍。\n\n${readFileSync(rejectFile, 'utf8')}`
    : '';
  return `${brief}${retry}\n\n## 输入（${input.length} 篇）\n\n${input.join('\n')}\n`;
}

const command = (): [string, string[]] =>
  BOT === 'claude'
    ? ['claude', ['-p', '--tools', '', '--no-session-persistence', '--output-format', 'text', ...(values.model ? ['--model', values.model] : [])]]
    : ['codex', ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', ...(values.model ? ['-m', values.model] : []), '-']];

const ask = (text: string) =>
  new Promise<string>((resolve, reject) => {
    const [cmd, args] = command();
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}`))));
    child.stdin.end(text);
  });

async function work(shard: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const answer = await ask(prompt(shard));
    const lines = answer.split('\n').filter((l) => l.trim().startsWith('{'));
    writeFileSync(`out/findings/${shard}.jsonl`, `${lines.join('\n')}\n`);
    const r = validateShard(shard, papers);
    console.log(`${shard} attempt ${attempt}: ${r.rows.length} ok, ${r.rejects.length} rejected, ${r.missing.length} unanswered`);
    if (passed(r)) return;
  }
}

console.log(`${queue.length} shards to do with ${BOT}, ${parallel} at a time (${busy} other workers running)`);
let next = 0;
await Promise.all(
  Array.from({ length: parallel }, async () => {
    while (next < queue.length) {
      const shard = queue[next++];
      if (shard) await work(shard).catch((e: Error) => console.error(`${shard}: ${e.message}`));
    }
  }),
);
