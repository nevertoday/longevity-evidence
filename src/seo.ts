// What search engines read: sitemap.xml and robots.txt.
import { escape } from './html.ts';
import { SITE_ORIGIN } from './site.ts';

export type Alternate = { hreflang: string; href: string };
export type SitemapUrl = { loc: string; alternates: Alternate[] };

export function sitemapXml(urls: SitemapUrl[]): string {
  const entry = (u: SitemapUrl) => `  <url>
    <loc>${escape(u.loc)}</loc>
${u.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${escape(a.hreflang)}" href="${escape(a.href)}"/>\n`).join('')}  </url>
`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(entry).join('')}</urlset>
`;
}

export const robotsTxt = () => `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
