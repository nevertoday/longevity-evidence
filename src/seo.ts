// What search engines and link previews read: sitemap.xml, robots.txt and Open Graph tags.
import { escape, html, type Html } from './html.ts';
import { ENABLED_LOCALES, type Locale } from './locales.ts';
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

export type OpenGraph = { type: 'website' | 'article'; siteName: string; title: string; description: string; url: string; locale: Locale };

export function openGraph(og: OpenGraph): Html {
  return html`<meta property="og:type" content="${og.type}">
<meta property="og:site_name" content="${og.siteName}">
<meta property="og:title" content="${og.title}">
<meta property="og:description" content="${og.description}">
<meta property="og:url" content="${og.url}">
<meta property="og:locale" content="${og.locale.ogLocale}">
${ENABLED_LOCALES.filter((l) => l.code !== og.locale.code).map((l) => html`<meta property="og:locale:alternate" content="${l.ogLocale}">\n`)}<meta name="twitter:card" content="summary">`;
}

export const robotsTxt = () => `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
