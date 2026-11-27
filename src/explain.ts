// Plain-language explanations this site writes for each upstream record, one file per language in content/explain/.
// Upstream text stays the source of truth; these restate it for readers with no medical background.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALE_CODES, type LocaleCode } from './locales.ts';

export const EXPLAIN_DIR = 'content/explain';

export type Explainer = {
  // The question a reader would ask, e.g. "Is a drink a day good for you?"
  question: string;
  // One or two sentences that answer it, leading with the answer.
  answer: string;
  // Two to four sentences: who was studied, how, and what was found, with the key numbers in everyday terms.
  why: string[];
  // Who the finding does not apply to, or what to be careful about.
  caution: string;
  // The popular claim in plain words. Present exactly when the record's verdict says the claim was wrong, overstated or untested.
  myth: string | null;
};

// How directly the evidence can show cause and effect. Language-independent, so it lives here rather than in content/.
export const EVIDENCE_KINDS = ['trial', 'observational', 'indirect'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

const TRIALS = [
  'potassium-salt',
  'metformin-diabetes',
  'multivitamins',
  'statins-indicated-patients',
  'vitamin-d-general-population',
  'intensive-bp-control',
  'dapagliflozin-ckd',
  'semaglutide-select',
  'aspirin-primary-prevention',
];
// Animal work, country-level statistics, narrative reviews, drug labels and models: none measures deaths in people like the reader.
const INDIRECT = ['sodium-ecological', 'calorie-restriction', 'nmn', 'anti-aging-drugs-review', 'covid-pandemic', 'metformin-adverse-events'];

export function evidenceKind(id: string): EvidenceKind {
  if (TRIALS.includes(id)) return 'trial';
  if (INDIRECT.includes(id)) return 'indirect';
  return 'observational';
}

export const KIND_IDS: readonly string[] = [...TRIALS, ...INDIRECT];

type Obj = Record<string, unknown>;

function text(v: unknown, at: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${at}: expected non-empty text`);
  return v;
}

function parseExplainer(v: unknown, at: string, isMyth: boolean): Explainer {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${at}: expected an object`);
  const e = v as Obj;
  const extra = Object.keys(e).filter((k) => !['question', 'answer', 'why', 'caution', 'myth'].includes(k));
  if (extra.length) throw new Error(`${at}: unknown fields ${extra.join(', ')}`);
  if (!Array.isArray(e.why) || e.why.length < 2 || e.why.length > 4) throw new Error(`${at}.why: expected 2 to 4 sentences`);
  if (isMyth && (e.myth === null || e.myth === undefined)) throw new Error(`${at}.myth: the verdict questions the original claim, so state the claim`);
  if (!isMyth && e.myth !== null && e.myth !== undefined) throw new Error(`${at}.myth: the verdict supports the claim, so leave myth null`);
  return {
    question: text(e.question, `${at}.question`),
    answer: text(e.answer, `${at}.answer`),
    why: e.why.map((s, i) => text(s, `${at}.why[${i}]`)),
    caution: text(e.caution, `${at}.caution`),
    myth: isMyth ? text(e.myth, `${at}.myth`) : null,
  };
}

// Every language must explain every record, and nothing else.
export function loadExplainers(studies: readonly { id: string; isMyth: boolean }[], dir: string = EXPLAIN_DIR): Record<string, Record<LocaleCode, Explainer>> {
  const out: Record<string, Partial<Record<LocaleCode, Explainer>>> = Object.fromEntries(studies.map((s) => [s.id, {}]));
  for (const code of LOCALE_CODES) {
    const file = join(dir, `${code}.json`);
    const json = JSON.parse(readFileSync(file, 'utf8')) as Obj;
    const ids = new Set(studies.map((s) => s.id));
    for (const id of Object.keys(json)) if (!ids.has(id)) throw new Error(`${file}: "${id}" is not an upstream record`);
    for (const s of studies) {
      if (!(s.id in json)) throw new Error(`${file}: no explanation for "${s.id}"`);
      out[s.id]![code] = parseExplainer(json[s.id], `${file} ${s.id}`, s.isMyth);
    }
  }
  return out as Record<string, Record<LocaleCode, Explainer>>;
}
