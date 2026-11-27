import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIRECTION_BY_ID, type Direction } from './directions.ts';
import { evidenceKind, KIND_IDS, loadExplainers, type EvidenceKind, type Explainer } from './explain.ts';
import { LOCALE_CODES, type LocaleCode } from './locales.ts';

export const GRADES = ['A', 'B', 'C', 'D'] as const;
export type Grade = (typeof GRADES)[number];

// Upstream verdicts judge the original claim, not the habit.
const VERDICT_BY_UPSTREAM = {
  支持但需限定: 'qualified',
  部分支持: 'partly',
  需纠正: 'corrected',
  无直接ACM证据: 'no-direct',
} as const;
export type VerdictId = (typeof VERDICT_BY_UPSTREAM)[keyof typeof VERDICT_BY_UPSTREAM];

// Whether the record checks a claim from the original guide or adds a study found during review.
const ORIGIN_BY_UPSTREAM = { 原库: 'original', 新增: 'added' } as const;
export type Origin = (typeof ORIGIN_BY_UPSTREAM)[keyof typeof ORIGIN_BY_UPSTREAM];

// Verdicts where the popular claim was wrong, overstated or untested, in the order the myths page lists them.
export const MYTH_VERDICTS: readonly VerdictId[] = ['corrected', 'partly', 'no-direct'];

// Reader-facing areas of everyday life, in display order.
export const TOPICS = [
  'eating',
  'drinking',
  'movement',
  'sleep',
  'habits',
  'mind',
  'body',
  'environment',
  'supplements',
  'illness',
] as const;
export type TopicId = (typeof TOPICS)[number];

// Upstream subcategories come from a programmer metaphor (input solid, input gas, output, context).
const TOPIC_BY_SUBCATEGORY: Record<string, TopicId> = {
  固体: 'eating',
  液体: 'drinking',
  药物: 'supplements',
  气体: 'environment',
  光照: 'environment',
  运动: 'movement',
  久坐: 'movement',
  日常: 'habits',
  睡眠: 'sleep',
  情绪: 'mind',
  贫富: 'mind',
  体重: 'body',
  新冠: 'illness',
};

// Records whose subcategory puts them somewhere a reader would not look.
const TOPIC_OVERRIDES: Record<string, TopicId> = {
  smoking: 'habits',
  'heavy-housework': 'movement',
  // Treatment trials in diagnosed patients. Upstream rules forbid reading these as advice for healthy people.
  'metformin-diabetes': 'illness',
  'statins-indicated-patients': 'illness',
  'intensive-bp-control': 'illness',
  'dapagliflozin-ckd': 'illness',
  'semaglutide-select': 'illness',
  'hepatitis-c-treatment': 'illness',
};

export const DETAIL_FIELDS = [
  'factor',
  'originalClaim',
  'finding',
  'effect',
  'ci',
  'comparison',
  'population',
  'design',
  'gradeReason',
  'limitations',
  'action',
] as const;
export type DetailField = (typeof DETAIL_FIELDS)[number];

export type SourceText = { note: string; readLevel: string; status: string };

export type StudyText = Record<DetailField, string> & {
  title: string;
  summary: string;
  takeaway: string;
  sources: SourceText[];
};

export type Source = {
  title: string;
  url: string;
  doi: string | null;
  year: number;
  originalUrl: string | null;
};

export type Study = {
  id: string;
  topic: TopicId;
  grade: Grade;
  direction: Direction;
  verdict: VerdictId;
  origin: Origin;
  sources: Source[];
  text: Record<LocaleCode, StudyText>;
  // This site's plain-language restatement, from content/explain/.
  kind: EvidenceKind;
  explain: Record<LocaleCode, Explainer>;
};

export type GlossaryEntry = { term: string; name: string; description: string };

// Upstream's own reading aids, translated upstream into every language.
export type Guide = {
  grades: Record<Grade, { label: string; meaning: string }>;
  fields: Record<DetailField, string>;
  gradeNote: string;
  glossary: GlossaryEntry[];
};

export type UpstreamSource = { repository: string; commit: string; committedAt: string };

export type Upstream = {
  studies: Study[];
  guide: Record<LocaleCode, Guide>;
  source: UpstreamSource;
};

// Upstream layout: Chinese is the source language, kept in data/evidence.json.
// interface.json carries zh and en interface text; every other language keeps its own in locales/<code>.json.
const SOURCE_LANG: LocaleCode = 'zh';
const detailFile = (code: LocaleCode) => (code === SOURCE_LANG ? 'data/evidence.json' : `locales/${code}.json`);
const uiFile = (code: LocaleCode) => (code === 'zh' || code === 'en' ? 'locales/interface.json' : `locales/${code}.json`);
const readerFile = (code: LocaleCode) => `locales/readers/${code}.json`;

export const UPSTREAM_FILES: readonly string[] = [
  ...new Set([
    'LICENSE',
    'data/evidence.json',
    'data/glossary.json',
    ...LOCALE_CODES.flatMap((code) => [detailFile(code), uiFile(code), readerFile(code)]),
  ]),
].sort();

export const UPSTREAM_DIR = 'data/upstream';

type Obj = Record<string, unknown>;

function obj(v: unknown, at: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${at}: expected an object`);
  return v as Obj;
}

function arr(v: unknown, at: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${at}: expected an array`);
  return v;
}

function str(v: unknown, at: string): string {
  if (typeof v !== 'string') throw new Error(`${at}: expected a string`);
  return v;
}

function optStr(v: unknown, at: string): string | null {
  return v === undefined ? null : str(v, at);
}

function lookup<T>(table: Record<string, T>, key: string, at: string): T {
  if (!Object.hasOwn(table, key)) throw new Error(`${at}: unknown value "${key}"`);
  return table[key] as T;
}

type Lang = {
  detail: (id: string) => Obj;
  reader: (id: string) => Obj;
  term: (raw: string, at: string) => string;
  guide: Guide;
};

function byId(records: unknown, at: string): Map<string, Obj> {
  const entries = Array.isArray(records)
    ? records.map((r, i) => obj(r, `${at}[${i}]`)).map((r) => [str(r.id, `${at} id`), r] as const)
    : Object.entries(obj(records, at)).map(([id, r]) => [id, obj(r, `${at}.${id}`)] as const);
  return new Map(entries);
}

function parseLang(code: LocaleCode, json: (file: string) => Obj): Lang {
  const details = byId(json(detailFile(code)).records, `${detailFile(code)} records`);
  const readers = byId(json(readerFile(code)).records, `${readerFile(code)} records`);
  const uiRoot = uiFile(code) === 'locales/interface.json' ? obj(json(uiFile(code))[code], `interface.json ${code}`) : json(uiFile(code));
  const ui = obj(uiRoot.ui, `${uiFile(code)} ui`);
  const terms = obj(uiRoot.terms, `${uiFile(code)} terms`);
  const uiText = (key: string) => str(ui[key], `${uiFile(code)} ui.${key}`);
  const glossary = obj(obj(json('data/glossary.json').languages, 'glossary languages')[code], `glossary ${code}`);
  const get = (map: Map<string, Obj>, file: string) => (id: string) => {
    const record = map.get(id);
    if (!record) throw new Error(`${file}: no record "${id}"`);
    return record;
  };
  return {
    detail: get(details, detailFile(code)),
    reader: get(readers, readerFile(code)),
    term: code === SOURCE_LANG ? (raw) => raw : (raw, at) => str(lookup(terms, raw, `${at} (${code} terms)`), at),
    guide: {
      grades: Object.fromEntries(
        GRADES.map((g) => [g, { label: uiText(`grade${g}`), meaning: uiText(`guide${g}`) }]),
      ) as Guide['grades'],
      fields: Object.fromEntries(DETAIL_FIELDS.map((f) => [f, uiText(f)])) as Guide['fields'],
      gradeNote: uiText('sideNote'),
      glossary: Object.entries(glossary).map(([term, v]) => {
        const entry = obj(v, `glossary ${code}.${term}`);
        return { term, name: str(entry.name, `glossary ${code}.${term}.name`), description: str(entry.description, `glossary ${code}.${term}.description`) };
      }),
    },
  };
}

function parseSource(v: unknown, at: string): Source {
  const s = obj(v, at);
  if (typeof s.year !== 'number') throw new Error(`${at}.year: expected a number`);
  return {
    title: str(s.title, `${at}.title`),
    url: str(s.url, `${at}.url`),
    doi: str(s.doi, `${at}.doi`) || null,
    year: s.year,
    originalUrl: optStr(s.originalUrl, `${at}.originalUrl`),
  };
}

function parseText(id: string, rawSources: Obj[], lang: Lang, at: string): StudyText {
  const d = lang.detail(id);
  const r = lang.reader(id);
  const fields = Object.fromEntries(DETAIL_FIELDS.map((f) => [f, str(d[f], `${at}.${f}`)])) as Record<DetailField, string>;
  const notes = arr(d.sources, `${at}.sources`);
  if (notes.length !== rawSources.length) throw new Error(`${at}: ${notes.length} source notes for ${rawSources.length} sources`);
  return {
    ...fields,
    title: optStr(r.title, `${at} reader title`) ?? fields.factor,
    summary: str(r.summary, `${at} reader summary`),
    takeaway: str(r.takeaway, `${at} reader takeaway`),
    sources: rawSources.map((s, i) => ({
      note: str(obj(notes[i], `${at}.sources[${i}]`).evidence, `${at}.sources[${i}].evidence`),
      readLevel: lang.term(str(s.readLevel, `${at}.sources[${i}].readLevel`), `${at}.sources[${i}].readLevel`),
      status: lang.term(str(s.status, `${at}.sources[${i}].status`), `${at}.sources[${i}].status`),
    })),
  };
}

function directionOf(id: string): Direction {
  const entry = DIRECTION_BY_ID[id];
  if (!entry) throw new Error(`record ${id} has no entry in DIRECTION_BY_ID (src/directions.ts)`);
  return entry.direction;
}

function parseStudy(r: Obj, langs: Record<LocaleCode, Lang>): Omit<Study, 'explain'> {
  const id = str(r.id, 'record id');
  const at = `record ${id}`;
  const rawSources = arr(r.sources, `${at}.sources`).map((s, i) => obj(s, `${at}.sources[${i}]`));
  return {
    id,
    topic: TOPIC_OVERRIDES[id] ?? lookup(TOPIC_BY_SUBCATEGORY, str(r.subcategory, `${at}.subcategory`), `${at}.subcategory`),
    grade: lookup(Object.fromEntries(GRADES.map((g) => [g, g])), str(r.grade, `${at}.grade`), `${at}.grade`),
    direction: directionOf(id),
    kind: evidenceKind(id),
    verdict: lookup(VERDICT_BY_UPSTREAM, str(r.verdict, `${at}.verdict`), `${at}.verdict`),
    origin: lookup(ORIGIN_BY_UPSTREAM, str(r.origin, `${at}.origin`), `${at}.origin`),
    sources: rawSources.map((s, i) => parseSource(s, `${at}.sources[${i}]`)),
    text: Object.fromEntries(
      LOCALE_CODES.map((code) => [code, parseText(id, rawSources, langs[code], `${at} (${code})`)]),
    ) as Record<LocaleCode, StudyText>,
  };
}

export function loadUpstream(dir: string = UPSTREAM_DIR): Upstream {
  const cache = new Map<string, Obj>();
  const json = (file: string): Obj => {
    let value = cache.get(file);
    if (!value) {
      value = obj(JSON.parse(readFileSync(join(dir, file), 'utf8')), file);
      cache.set(file, value);
    }
    return value;
  };
  const langs = Object.fromEntries(LOCALE_CODES.map((code) => [code, parseLang(code, json)])) as Record<LocaleCode, Lang>;
  const records = arr(json('data/evidence.json').records, 'evidence.json records');
  const parsed = records.map((r, i) => parseStudy(obj(r, `evidence.json records[${i}]`), langs));
  const explainers = loadExplainers(parsed.map((s) => ({ id: s.id, isMyth: MYTH_VERDICTS.includes(s.verdict) })));
  const studies: Study[] = parsed.map((s) => ({ ...s, explain: explainers[s.id]! }));

  const ids = new Set(studies.map((s) => s.id));
  if (ids.size !== studies.length) throw new Error('evidence.json: duplicate record ids');
  for (const id of Object.keys(TOPIC_OVERRIDES)) {
    if (!ids.has(id)) throw new Error(`TOPIC_OVERRIDES names "${id}", which upstream no longer has`);
  }
  for (const id of KIND_IDS) {
    if (!ids.has(id)) throw new Error(`src/explain.ts names "${id}", which upstream no longer has`);
  }
  for (const id of Object.keys(DIRECTION_BY_ID)) {
    if (!ids.has(id)) throw new Error(`DIRECTION_BY_ID names "${id}", which upstream no longer has`);
  }

  const source = obj(JSON.parse(readFileSync(join(dir, 'SOURCE.json'), 'utf8')), 'SOURCE.json');
  return {
    studies,
    guide: Object.fromEntries(LOCALE_CODES.map((code) => [code, langs[code].guide])) as Record<LocaleCode, Guide>,
    source: {
      repository: str(source.repository, 'SOURCE.json repository'),
      commit: str(source.commit, 'SOURCE.json commit'),
      committedAt: str(source.committedAt, 'SOURCE.json committedAt'),
    },
  };
}

const GRADE_RANK: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3 };

// Stable: studies with the same grade keep upstream order.
export function sortByGrade(studies: readonly Study[]): Study[] {
  return studies.toSorted((a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade]);
}
