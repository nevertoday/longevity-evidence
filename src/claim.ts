import { escape, raw, type Html } from './html.ts';

// Fifteen upstream `originalClaim` texts are archived README Markdown: nested "* " lists, links,
// images and **bold**. This renders that subset. Images are dropped because upstream
// treats them as illustrations, not sources. Other text passes through escaped.

type Line = { depth: number; text: string } | { depth: null; text: string };

const LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;

function inline(text: string, links: { text: string; url: string }[]): string {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => {
      const link = links[Number(i)] as { text: string; url: string };
      const label = escape(link.text);
      return /^https?:\/\//.test(link.url) ? `<a href="${escape(link.url)}" rel="nofollow noopener noreferrer">${label}</a>` : label;
    });
}

function list(lines: { depth: number; html: string }[]): string {
  let out = '';
  let depth = -1;
  for (const line of lines) {
    const d = Math.min(line.depth, depth + 1);
    if (d > depth) out += '<ul>';
    else out += '</li>' + '</ul></li>'.repeat(depth - d);
    out += `<li>${line.html}`;
    depth = d;
  }
  return out + '</li>' + '</ul></li>'.repeat(depth) + '</ul>';
}

export function renderClaim(markdown: string): Html {
  const links: { text: string; url: string }[] = [];
  const text = markdown.replace(IMAGE, '').replace(LINK, (_, label: string, url: string) => {
    links.push({ text: label.replace(/\s+/g, ' ').trim(), url });
    return `\u0000${links.length - 1}\u0000`;
  });

  const lines: Line[] = text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const item = /^(\s*)\*\s+(.*)$/.exec(l);
      return item ? { depth: Math.floor((item[1] as string).length / 2), text: item[2] as string } : { depth: null, text: l.trim() };
    })
    .filter((l) => l.text.trim() !== '');

  let out = '';
  let items: { depth: number; html: string }[] = [];
  for (const line of lines) {
    if (line.depth === null) {
      if (items.length) out += list(items);
      items = [];
      out += `<p>${inline(line.text, links)}</p>`;
    } else {
      items.push({ depth: line.depth, html: inline(line.text, links) });
    }
  }
  if (items.length) out += list(items);
  return raw(out);
}
