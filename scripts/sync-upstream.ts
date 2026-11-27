// Copy the upstream files the site needs from a local clone of geekan/HowToLiveLonger.
// Usage: npm run sync -- <path-to-clone>
// Running it twice with the same clone changes nothing.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { UPSTREAM_DIR, UPSTREAM_FILES } from '../src/model.ts';

const REPOSITORY = 'https://github.com/geekan/HowToLiveLonger';

const clone = process.argv[2];
if (!clone) {
  console.error('Usage: npm run sync -- <path-to-HowToLiveLonger-clone>');
  process.exit(1);
}

const git = (...args: string[]) => execFileSync('git', ['-C', clone, ...args], { encoding: 'utf8' }).trim();
const dirty = git('status', '--porcelain', '--', ...UPSTREAM_FILES);
if (dirty) {
  console.error(`The clone has uncommitted changes in files this site copies, so its commit SHA would not describe them:\n${dirty}`);
  process.exit(1);
}

const source = {
  repository: REPOSITORY,
  commit: git('rev-parse', 'HEAD'),
  committedAt: git('log', '-1', '--format=%cI'),
  license: 'Unlicense',
  files: UPSTREAM_FILES,
};

const wanted = new Map<string, Buffer>(UPSTREAM_FILES.map((f) => [f, readFileSync(join(clone, f))]));
wanted.set('SOURCE.json', Buffer.from(`${JSON.stringify(source, null, 2)}\n`));

let written = 0;
for (const [file, bytes] of wanted) {
  const dest = join(UPSTREAM_DIR, file);
  if (existsSync(dest) && readFileSync(dest).equals(bytes)) continue;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(`${dest}.tmp`, bytes);
  renameSync(`${dest}.tmp`, dest);
  written++;
}

let removed = 0;
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
for (const path of walk(UPSTREAM_DIR)) {
  if (!wanted.has(relative(UPSTREAM_DIR, path))) {
    rmSync(path);
    removed++;
  }
}

console.log(`${REPOSITORY} @ ${source.commit.slice(0, 7)}: ${wanted.size} files, ${written} written, ${removed} removed`);
