// HTML parser - extracts data from pages

import * as cheerio from 'cheerio';
import { resolveUrl, isValidUrl } from './utils/normalizer.js';

export interface ParseResult {
  title: string | null;
  description: string | null;
  favicon: string | null;
  links: string[];
  ogImage: string | null;
}

/**
 * Parse HTML and extract useful data
 */
export function parseHtml(html: string, baseUrl: string): ParseResult {
  const $ = cheerio.load(html);

  // Extract title
  const title = $('title').first().text().trim() ||
                $('meta[property="og:title"]').attr('content') ||
                $('h1').first().text().trim() ||
                null;

  // Extract description
  const description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') ||
                      null;

  // Extract favicon
  let favicon = $('link[rel="icon"]').attr('href') ||
                $('link[rel="shortcut icon"]').attr('href') ||
                $('link[rel="apple-touch-icon"]').attr('href') ||
                '/favicon.ico';
  
  if (favicon && !favicon.startsWith('data:')) {
    favicon = resolveUrl(baseUrl, favicon);
  }

  // Extract OG image (for potential thumbnails)
  let ogImage = $('meta[property="og:image"]').attr('content') ||
                $('meta[name="twitter:image"]').attr('content') ||
                null;
  
  if (ogImage) {
    ogImage = resolveUrl(baseUrl, ogImage);
  }

  // Extract links
  const links: string[] = [];
  const seenLinks = new Set<string>();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    // Resolve relative URLs
    const absoluteUrl = resolveUrl(baseUrl, href);

    // Skip if invalid or already seen
    if (!isValidUrl(absoluteUrl)) return;
    if (seenLinks.has(absoluteUrl)) return;

    seenLinks.add(absoluteUrl);
    links.push(absoluteUrl);
  });

  return {
    title: title ? title.slice(0, 500) : null, // Limit title length
    description: description ? description.slice(0, 1000) : null, // Limit description
    favicon,
    links,
    ogImage
  };
}

/**
 * Extract text content from HTML (for search/indexing)
 */
export function extractText(html: string): string {
  const $ = cheerio.load(html);

  // Remove scripts, styles, and other non-content elements
  $('script, style, noscript, iframe, svg, canvas').remove();
  $('header, footer, nav, aside').remove(); // Often navigation, not content

  // Get text content
  let text = $('body').text();

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // Limit length
  return text.slice(0, 10000);
}
