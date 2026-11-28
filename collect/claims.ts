// A Claim is one health statement that people spread or ask about online, found by a web bot, with a verdict and
// the evidence behind it. Each layer is keyed by the one above it:
//   Claim     claimKey, an English slug shared by every language's version of the same claim
//   Sighting  where the claim was seen online (proof that people really say it)
//   Evidence  a PubMed abstract or an official health body's page, quoted word for word
// The bot finds claims and evidence itself. The importer only trusts what it can check: the schema, the verdict
// rules below, and every PubMed quote against the abstract PubMed itself returns.
import type { LocaleCode } from '../src/locales.ts';
import { TOPICS, type TopicId } from '../src/model.ts';
import { normalize, type Paper } from './schema.ts';

export const CHANNELS = ['factcheck', 'qa', 'social', 'official', 'longevity'] as const;
export type Channel = (typeof CHANNELS)[number];

export const VERDICTS = ['true', 'mostly-true', 'mixed', 'misleading', 'false', 'unproven'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const OUTCOMES = ['lifespan', 'disease', 'body', 'wellbeing', 'other'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const GRADES = ['A', 'B', 'C', 'D'] as const;
export type Grade = (typeof GRADES)[number];

export const DESIGNS = ['meta-analysis', 'systematic-review', 'rct', 'cohort', 'case-control', 'mendelian-randomization', 'cross-sectional', 'lab-or-animal', 'other'] as const;
export type Design = (typeof DESIGNS)[number];

export const STANCES = ['supports', 'refutes', 'mixed'] as const;
export type Stance = (typeof STANCES)[number];

// Official health bodies whose pages count as evidence. A host matches itself and its subdomains.
export const AUTHORITY_HOSTS = [
  'who.int', 'cdc.gov', 'nih.gov', 'cancer.gov', 'fda.gov', 'usda.gov', 'health.gov', 'heart.org', 'cancer.org',
  'nhs.uk', 'nice.org.uk', 'gov.uk', 'cochrane.org', 'cochranelibrary.com', 'efsa.europa.eu', 'ema.europa.eu', 'ecdc.europa.eu',
  'nhc.gov.cn', 'chinacdc.cn', 'cnsoc.org', 'samr.gov.cn', 'nmpa.gov.cn',
  'mhlw.go.jp', 'ncc.go.jp', 'ncvc.go.jp', 'nibiohn.go.jp', 'caa.go.jp',
  'sanidad.gob.es', 'aesan.gob.es', 'aemps.gob.es',
  'sante.gouv.fr', 'has-sante.fr', 'anses.fr', 'inserm.fr', 'e-cancer.fr',
  'rki.de', 'bfr.bund.de', 'bzga.de', 'gesundheitsinformation.de', 'iqwig.de', 'dge.de', 'krebsinformationsdienst.de',
  'gov.br', 'inca.gov.br', 'sns.gov.pt', 'dgs.pt',
  'moh.gov.sa', 'sfda.gov.sa', 'mohap.gov.ae',
] as const;

export type Sighting = { url: string; platform: string; date: string | null; quote: string };
export type PubmedEvidence = { kind: 'pubmed'; pmid: string; design: Design; stance: Stance; quote: string };
export type AuthorityEvidence = { kind: 'authority'; org: string; url: string; stance: Stance; quote: string };
export type Evidence = PubmedEvidence | AuthorityEvidence;

export type Claim = {
  id: string; // `${batch}-${nn}`
  claimKey: string;
  lang: LocaleCode;
  topic: TopicId;
  outcome: Outcome;
  claim: string; // as people say it, in their language
  claimEn: string;
  question: string; // the claim as a reader would ask it, in `lang`
  verdict: Verdict;
  grade: Grade;
  answer: string; // one or two plain sentences in `lang`
  sightings: Sighting[];
  evidence: Evidence[];
  searched: string[]; // the evidence searches the bot ran, so an "unproven" can be rechecked
};

export type Manifest = { batch: string; card: string; queries: string[]; claims: number };

export const CARD = /^(zh|en|es|fr|de|pt|ja|ar)-([a-z]+)-([a-z]+)$/;
export const BATCH = /^(zh|en|es|fr|de|pt|ja|ar)-[a-z]+-[a-z]+-\d{4}$/;
const KEY = /^[a-z0-9]+(-[a-z0-9]+){1,9}$/;
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const host = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
};
export const isAuthority = (url: string) => {
  const h = host(url);
  return !!h && AUTHORITY_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
};

export function parseManifest(raw: unknown): Manifest | string {
  if (!isObj(raw)) return 'first line must be the manifest';
  if (typeof raw.batch !== 'string' || !BATCH.test(raw.batch)) return `manifest batch "${String(raw.batch)}" must look like zh-eating-factcheck-0001`;
  const card = raw.batch.replace(/-\d{4}$/, '');
  const m = card.match(CARD);
  if (raw.card !== card || !m || !oneOf(TOPICS, m[2]) || !oneOf(CHANNELS, m[3])) return `manifest card "${String(raw.card)}" must be ${card} with a known topic and channel`;
  if (!Array.isArray(raw.queries) || !raw.queries.length || !raw.queries.every(text)) return 'manifest queries must list the searches used to find these claims';
  if (!Number.isInteger(raw.claims)) return 'manifest claims must be the number of claim lines';
  return raw as unknown as Manifest;
}

function checkSighting(s: unknown, i: number): string | null {
  if (!isObj(s)) return `sightings[${i}] is not an object`;
  if (typeof s.url !== 'string' || !host(s.url)) return `sightings[${i}].url is not a web address`;
  if (isAuthority(s.url)) return `sightings[${i}] is an official page; put it in evidence`;
  if (!text(s.platform) || !text(s.quote)) return `sightings[${i}] needs platform and quote`;
  if (s.date !== null && (typeof s.date !== 'string' || !DATE.test(s.date))) return `sightings[${i}].date must be YYYY, YYYY-MM, YYYY-MM-DD or null`;
  return null;
}

function checkEvidence(e: unknown, i: number, papers: Map<string, Paper>): string | null {
  if (!isObj(e)) return `evidence[${i}] is not an object`;
  if (!oneOf(STANCES, e.stance)) return `evidence[${i}].stance ${String(e.stance)}`;
  if (!text(e.quote)) return `evidence[${i}].quote is required`;
  if (e.kind === 'pubmed') {
    if (typeof e.pmid !== 'string' || !/^\d{1,9}$/.test(e.pmid)) return `evidence[${i}].pmid must be a PMID string`;
    if (!oneOf(DESIGNS, e.design)) return `evidence[${i}].design ${String(e.design)}`;
    const p = papers.get(e.pmid);
    if (!p) return `evidence[${i}]: PubMed has no record ${e.pmid}`;
    const source = normalize([p.title, ...p.abstract.map((s) => s.text)].join(' '));
    if (!source.includes(normalize(e.quote))) return `evidence[${i}]: quote is not in the title or abstract of PMID ${e.pmid}`;
    return null;
  }
  if (e.kind === 'authority') {
    if (!text(e.org)) return `evidence[${i}].org is required`;
    if (typeof e.url !== 'string' || !isAuthority(e.url)) return `evidence[${i}].url ${String(e.url)} is not on the list of official health sites`;
    return null;
  }
  return `evidence[${i}].kind must be pubmed or authority`;
}

const STRONG: readonly Design[] = ['meta-analysis', 'systematic-review', 'rct'];

// The verdict and grade must follow from the evidence the line carries.
function checkVerdict(c: Claim): string | null {
  const stances = new Set(c.evidence.map((e) => e.stance));
  if (c.verdict === 'unproven') {
    if (c.grade !== 'D') return 'an unproven claim has grade D';
    if (!c.searched.length) return 'an unproven claim must list what was searched';
    return null;
  }
  if (!c.evidence.length) return `verdict ${c.verdict} needs at least one evidence`;
  if ((c.verdict === 'false' || c.verdict === 'misleading') && !stances.has('refutes') && !stances.has('mixed')) return `verdict ${c.verdict} needs evidence that refutes it`;
  if ((c.verdict === 'true' || c.verdict === 'mostly-true') && !stances.has('supports')) return `verdict ${c.verdict} needs evidence that supports it`;
  const pubmed = c.evidence.filter((e): e is PubmedEvidence => e.kind === 'pubmed');
  if (c.grade === 'A' && !pubmed.some((e) => STRONG.includes(e.design))) return 'grade A needs a meta-analysis, systematic review or RCT from PubMed';
  if (c.grade === 'B' && !pubmed.some((e) => e.design !== 'lab-or-animal') && !c.evidence.some((e) => e.kind === 'authority')) return 'grade B needs a human study from PubMed or an official page';
  return null;
}

export function checkClaim(raw: unknown, batch: string, lang: LocaleCode, papers: Map<string, Paper>): { ok: true; claim: Claim } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!isObj(raw)) return fail('not an object');
  if (typeof raw.id !== 'string' || !new RegExp(`^${batch}-\\d{2}$`).test(raw.id)) return fail(`id must be ${batch}-01, -02 …`);
  if (typeof raw.claimKey !== 'string' || !KEY.test(raw.claimKey)) return fail('claimKey must be 2 to 10 lowercase English words joined by -');
  if (raw.lang !== lang) return fail(`lang must be ${lang}, the card's language`);
  if (!oneOf(TOPICS, raw.topic)) return fail(`topic ${String(raw.topic)}`);
  if (!oneOf(OUTCOMES, raw.outcome)) return fail(`outcome ${String(raw.outcome)}`);
  if (!oneOf(VERDICTS, raw.verdict)) return fail(`verdict ${String(raw.verdict)}`);
  if (!oneOf(GRADES, raw.grade)) return fail(`grade ${String(raw.grade)}`);
  for (const k of ['claim', 'claimEn', 'question', 'answer'] as const) if (!text(raw[k])) return fail(`${k} is required`);
  if (!Array.isArray(raw.sightings) || raw.sightings.length < 1 || raw.sightings.length > 5) return fail('sightings must hold 1 to 5 places the claim was seen');
  if (!Array.isArray(raw.evidence) || raw.evidence.length > 6) return fail('evidence must be a list of at most 6');
  if (!Array.isArray(raw.searched) || !raw.searched.every(text)) return fail('searched must be a list of search strings');
  for (const [i, s] of raw.sightings.entries()) {
    const e = checkSighting(s, i);
    if (e) return fail(e);
  }
  for (const [i, ev] of raw.evidence.entries()) {
    const e = checkEvidence(ev, i, papers);
    if (e) return fail(e);
  }
  const claim = raw as unknown as Claim;
  const v = checkVerdict(claim);
  return v ? fail(v) : { ok: true, claim };
}
