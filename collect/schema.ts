// Three layers, each keyed by the one below it:
//   Paper    one PubMed record, fetched by script, never written by a bot      (out/papers.jsonl)
//   Finding  one effect estimate a bot copied out of one paper's abstract      (out/findings/<shard>.jsonl)
//   Skip     a paper in the shard that has no estimate, with the reason        (same file as its findings)
// A site Study (src/model.ts) groups findings by exposure; that grouping is done here, not by the bots.
import { TOPICS, type TopicId } from '../src/model.ts';

export type AbstractSection = { label: string | null; text: string };

export type Paper = {
  pmid: string;
  doi: string | null;
  pmcid: string | null;
  title: string;
  journal: string;
  year: number | null;
  publicationTypes: string[];
  mesh: string[];
  abstract: AbstractSection[];
  fetchedAt: string;
};

export const DESIGNS = ['meta-analysis', 'rct', 'cohort', 'case-control', 'mendelian-randomization', 'other'] as const;
export type Design = (typeof DESIGNS)[number];

export const MEASURES = ['HR', 'RR', 'OR', 'IRR', 'SMR', 'risk-difference', 'mean-difference', 'years-of-life'] as const;
export type Measure = (typeof MEASURES)[number];

export const OUTCOMES = ['all-cause-mortality', 'cardiovascular-mortality', 'cancer-mortality', 'life-expectancy', 'other-mortality'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type Finding = {
  pmid: string;
  n: number; // 1, 2, 3 … within the paper; `${pmid}#${n}` is the finding's id
  exposure: string; // what was compared, in the abstract's words: "processed meat", "daily aspirin 100 mg"
  contrast: string; // against what: "highest vs lowest intake", "per 50 g/day", "vs placebo"
  outcome: Outcome;
  measure: Measure;
  value: number;
  ciLow: number | null;
  ciHigh: number | null;
  participants: number | null;
  deaths: number | null;
  design: Design;
  topic: TopicId;
  section: string | null; // the abstract section label the quote comes from, as the paper has it
  quote: string; // copied character for character from that section; holds value, ciLow and ciHigh
};

export type Skip = { pmid: string; skip: 'no-mortality-estimate' | 'no-abstract' | 'not-human' | 'protocol-or-commentary' };

export type Row = Finding | Skip;

export const isSkip = (r: Row): r is Skip => 'skip' in r;

const SKIP_REASONS: readonly Skip['skip'][] = ['no-mortality-estimate', 'no-abstract', 'not-human', 'protocol-or-commentary'];

type Check = { ok: true; row: Row } | { ok: false; error: string };

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown) => v === null || num(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

// Whitespace and dash variants differ between PubMed XML and what a model types back; nothing else may.
export const normalize = (s: string) =>
  s
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

// "1.03" in the quote proves value 1.03; "1.030" or "1.3" does not.
const appears = (n: number, quote: string) => {
  const tokens = normalize(quote).match(/\d+(?:[.,]\d+)?/g) ?? [];
  return tokens.some((t) => Number(t.replace(',', '.')) === n || Number(t.replace(/,/g, '')) === n);
};

// The boundary between a bot's output and our data: every rule a finding must meet before import.
export function checkRow(raw: unknown, papers: Map<string, Paper>, shard: Set<string>): Check {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'not an object' };
  const r = raw as Record<string, unknown>;
  if (typeof r.pmid !== 'string' || !shard.has(r.pmid)) return { ok: false, error: `pmid ${String(r.pmid)} is not in this shard` };
  const paper = papers.get(r.pmid);
  if (!paper) return { ok: false, error: `pmid ${r.pmid} has no fetched paper` };
  if ('skip' in r) {
    if (!oneOf(SKIP_REASONS, r.skip)) return { ok: false, error: `skip reason ${String(r.skip)}` };
    return { ok: true, row: { pmid: r.pmid, skip: r.skip } };
  }
  if (!Number.isInteger(r.n) || (r.n as number) < 1) return { ok: false, error: 'n must be 1, 2, 3 …' };
  if (!text(r.exposure) || !text(r.contrast)) return { ok: false, error: 'exposure and contrast are required' };
  if (!oneOf(OUTCOMES, r.outcome)) return { ok: false, error: `outcome ${String(r.outcome)}` };
  if (!oneOf(MEASURES, r.measure)) return { ok: false, error: `measure ${String(r.measure)}` };
  if (!oneOf(DESIGNS, r.design)) return { ok: false, error: `design ${String(r.design)}` };
  if (!oneOf(TOPICS, r.topic)) return { ok: false, error: `topic ${String(r.topic)}` };
  if (!num(r.value) || !numOrNull(r.ciLow) || !numOrNull(r.ciHigh)) return { ok: false, error: 'value, ciLow, ciHigh must be numbers' };
  if ((r.ciLow === null) !== (r.ciHigh === null)) return { ok: false, error: 'ciLow and ciHigh come together' };
  if (!numOrNull(r.participants) || !numOrNull(r.deaths)) return { ok: false, error: 'participants, deaths must be numbers or null' };
  if (r.section !== null && typeof r.section !== 'string') return { ok: false, error: 'section must be a string or null' };
  if (!text(r.quote)) return { ok: false, error: 'quote is required' };

  const sections = r.section === null ? paper.abstract : paper.abstract.filter((s) => s.label === r.section);
  if (!sections.length) return { ok: false, error: `section "${String(r.section)}" is not in the abstract` };
  if (!normalize(sections.map((s) => s.text).join(' ')).includes(normalize(r.quote))) return { ok: false, error: 'quote is not in the abstract' };
  for (const k of ['value', 'ciLow', 'ciHigh'] as const) {
    const v = r[k];
    if (num(v) && !appears(v, r.quote)) return { ok: false, error: `${k} ${v} is not in the quote` };
  }
  if (num(r.ciLow) && num(r.ciHigh) && !(r.ciLow <= r.value && r.value <= r.ciHigh)) return { ok: false, error: 'value is outside its interval' };
  return { ok: true, row: r as unknown as Finding };
}
