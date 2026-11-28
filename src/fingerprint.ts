// This site writes four layers on top of each upstream record: its direction (src/directions.ts), its kind of evidence
// (src/explain.ts), its topic override (src/model.ts) and its plain-language explanations (content/explain/).
// Upstream can change a record's numbers without changing its id, so each record carries a fingerprint of its Chinese
// source text, and FINGERPRINT_FILE keeps the fingerprint each record had when those layers were last checked against it.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const FINGERPRINT_FILE = 'content/upstream-fingerprints.json';

// Key order in upstream JSON carries no meaning, so it must not change the fingerprint.
const canonical = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(canonical);
  if (typeof v !== 'object' || v === null) return v;
  const o = v as Record<string, unknown>;
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canonical(o[k])]));
};

export const fingerprint = (v: unknown): string => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex').slice(0, 16);

export function readFingerprints(file: string = FINGERPRINT_FILE): Record<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${file}: expected an object`);
  for (const [id, value] of Object.entries(parsed)) {
    if (typeof value !== 'string' || !/^[0-9a-f]{16}$/.test(value)) throw new Error(`${file}: "${id}" is not a fingerprint`);
  }
  return parsed as Record<string, string>;
}

export function writeFingerprints(fingerprints: Record<string, string>, file: string = FINGERPRINT_FILE): void {
  const sorted = Object.fromEntries(Object.keys(fingerprints).sort().map((id) => [id, fingerprints[id]]));
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}
