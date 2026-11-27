import { readFileSync } from 'node:fs';
import { escape, Html, raw } from './html.ts';
import type { Locale } from './locales.ts';
import zh from './ui/zh.json' with { type: 'json' };

// zh.json is the schema: every other language file must have the same keys and placeholders.
export type UiKey = keyof typeof zh;
type Vars = Record<string, string | number>;

export type T = {
  (key: UiKey, vars?: Vars): string;
  // Escapes the string itself and inserts markup for the named placeholders.
  html: (key: UiKey, vars: Record<string, Html | string | number>) => Html;
  studies: (count: number) => string;
};

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

function parseStrings(locale: Locale): Record<UiKey, string> {
  const file = new URL(`./ui/${locale.code}.json`, import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) throw new Error(`src/ui/${locale.code}.json: expected an object`);
  const strings = parsed as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(zh) as UiKey[]) {
    const value = strings[key];
    if (typeof value !== 'string' || value.trim() === '') problems.push(`missing or empty "${key}"`);
    else if (placeholders(value) !== placeholders(zh[key])) problems.push(`"${key}" placeholders differ from zh.json`);
  }
  for (const key of Object.keys(strings)) if (!Object.hasOwn(zh, key)) problems.push(`unknown key "${key}"`);
  if (problems.length) throw new Error(`src/ui/${locale.code}.json:\n  ${problems.join('\n  ')}`);
  return strings as Record<UiKey, string>;
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!Object.hasOwn(vars, name)) throw new Error(`no value for {${name}} in "${text}"`);
    return vars[name] as string;
  });
}

export function loadUi(locale: Locale): T {
  const strings = parseStrings(locale);
  const plural = new Intl.PluralRules(locale.htmlLang);
  const t = (key: UiKey, vars: Vars = {}) =>
    fill(strings[key], Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)])));
  t.html = (key: UiKey, vars: Record<string, Html | string | number>) =>
    raw(
      fill(
        escape(strings[key]),
        Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v instanceof Html ? v.value : escape(String(v))])),
      ),
    );
  t.studies = (count: number) => t(plural.select(count) === 'one' ? 'count.studies.one' : 'count.studies.other', { count });
  return t;
}
