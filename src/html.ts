// Markup that is already safe. Everything else interpolated into `html` is escaped.
export class Html {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}

export type Part = Html | string | number | null | undefined | false | readonly Part[];

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ENTITIES[c] as string);
}

function render(part: Part): string {
  if (part === null || part === undefined || part === false) return '';
  if (part instanceof Html) return part.value;
  if (Array.isArray(part)) return part.map(render).join('');
  return escape(String(part));
}

export function html(strings: TemplateStringsArray, ...parts: Part[]): Html {
  let out = strings[0] ?? '';
  parts.forEach((part, i) => {
    out += render(part) + (strings[i + 1] ?? '');
  });
  return new Html(out);
}

export const raw = (markup: string): Html => new Html(markup);
