// Layer 0: fetch every PubMed record a query matches into out/papers.jsonl and cut the PMIDs into shards a bot can
// finish in one sitting. Rerunning skips PMIDs already fetched and never rewrites a shard, so a crash loses nothing.
// Usage: node collect/fetch-pubmed.ts --term '<PubMed query>' [--max 200] [--shard-size 50] [--no-shards]
// NCBI allows 3 requests a second, or 10 with NCBI_API_KEY set.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { AbstractSection, Paper } from './schema.ts';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const { values } = parseArgs({ options: { term: { type: 'string' }, max: { type: 'string' }, 'shard-size': { type: 'string', default: '50' }, 'no-shards': { type: 'boolean', default: false } } });
if (!values.term) {
  console.error("Usage: node collect/fetch-pubmed.ts --term '<PubMed query>' [--max N] [--shard-size 50]");
  process.exit(1);
}
const TERM = values.term;
const MAX = values.max ? Number(values.max) : Infinity;
const SHARD_SIZE = Number(values['shard-size']);
const KEY = process.env.NCBI_API_KEY;
const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const PAPERS = 'out/papers.jsonl';
const SHARDS = 'out/shards';
mkdirSync(SHARDS, { recursive: true });

let last = 0;
async function eutils(path: string, params: Record<string, string>): Promise<string> {
  const wait = last + (KEY ? 110 : 350) - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const q = new URLSearchParams({ db: 'pubmed', tool: 'longevity-collect', ...(KEY ? { api_key: KEY } : {}), ...params });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}/${path}?${q}`);
    if (res.ok) return res.text();
    if (attempt === 4) throw new Error(`${path}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const searchCount = async (term: string) => Number(JSON.parse(await eutils('esearch.fcgi', { term, retmode: 'json', rettype: 'count' })).esearchresult.count);
const searchIds = async (term: string, retmax: number): Promise<string[]> =>
  JSON.parse(await eutils('esearch.fcgi', { term, retmode: 'json', retmax: String(retmax), sort: 'pub_date' })).esearchresult.idlist;

// PubMed returns at most 9,999 ids per search, so a larger query is walked one publication year at a time.
async function allIds(): Promise<string[]> {
  const total = await searchCount(TERM);
  console.log(`query matches ${total} records`);
  if (total <= 9999 || MAX <= 9999) return searchIds(TERM, Math.min(total, MAX, 9999));
  const ids: string[] = [];
  for (let year = new Date().getFullYear(); year >= 1900 && ids.length < MAX; year--) {
    const term = `(${TERM}) AND ${year}[dp]`;
    const n = await searchCount(term);
    if (n > 9999) throw new Error(`${year} alone matches ${n}; split the query`);
    if (n) ids.push(...(await searchIds(term, n)));
  }
  return ids.slice(0, MAX);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const plain = (xml: string) =>
  xml
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
      e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
    )
    .replace(/\s+/g, ' ')
    .trim();
const first = (xml: string, re: RegExp) => {
  const m = xml.match(re);
  return m?.[1] ? plain(m[1]) : null;
};
const all = (xml: string, re: RegExp) => [...xml.matchAll(re)].map((m) => plain(m[1] ?? ''));

function parseArticle(xml: string, fetchedAt: string): Paper {
  const pmid = first(xml, /<PMID[^>]*>(\d+)<\/PMID>/);
  if (!pmid) throw new Error('article without PMID');
  const abstractXml = xml.match(/<Abstract>([\s\S]*?)<\/Abstract>/)?.[1] ?? '';
  const abstract: AbstractSection[] = [...abstractXml.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)].map((m) => ({
    label: m[1]?.match(/Label="([^"]*)"/)?.[1] ?? null,
    text: plain(m[2] ?? ''),
  }));
  const year = first(xml, /<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) ?? first(xml, /<PubDate>[\s\S]*?<MedlineDate>(\d{4})/);
  return {
    pmid,
    doi: first(xml, /<ArticleId IdType="doi">([^<]+)<\/ArticleId>/),
    pmcid: first(xml, /<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/),
    title: first(xml, /<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/) ?? '',
    journal: first(xml, /<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/) ?? '',
    year: year ? Number(year) : null,
    publicationTypes: all(xml, /<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g),
    mesh: all(xml, /<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/g),
    abstract,
    fetchedAt,
  };
}

const have = new Set(existsSync(PAPERS) ? readFileSync(PAPERS, 'utf8').split('\n').filter(Boolean).map((l) => (JSON.parse(l) as Paper).pmid) : []);
const sharded = new Set(readdirSync(SHARDS).flatMap((f) => readFileSync(`${SHARDS}/${f}`, 'utf8').split('\n').filter(Boolean)));

const ids = await allIds();
const todo = ids.filter((id) => !have.has(id));
console.log(`${ids.length} ids, ${todo.length} not fetched yet`);
const fetchedAt = new Date().toISOString();
for (let i = 0; i < todo.length; i += 200) {
  const batch = todo.slice(i, i + 200);
  const xml = await eutils('efetch.fcgi', { id: batch.join(','), retmode: 'xml' });
  const papers = (xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? []).map((a) => parseArticle(a, fetchedAt));
  appendFileSync(PAPERS, papers.map((p) => `${JSON.stringify(p)}\n`).join(''));
  for (const p of papers) have.add(p.pmid);
  console.log(`fetched ${Math.min(i + 200, todo.length)}/${todo.length}`);
}

const unsharded = values['no-shards'] ? [] : ids.filter((id) => have.has(id) && !sharded.has(id));
let next = readdirSync(SHARDS).length + 1;
for (let i = 0; i < unsharded.length; i += SHARD_SIZE) {
  writeFileSync(`${SHARDS}/${String(next++).padStart(5, '0')}.txt`, `${unsharded.slice(i, i + SHARD_SIZE).join('\n')}\n`);
}
console.log(`${PAPERS}: ${have.size} papers; ${SHARDS}: ${next - 1} shards`);
