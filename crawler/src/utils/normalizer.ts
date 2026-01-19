// URL normalization utilities for deduplication

/**
 * Normalize a URL for consistent storage and deduplication
 * - Removes trailing slashes
 * - Removes default ports
 * - Removes www. prefix
 * - Lowercases domain
 * - Sorts query params
 * - Removes fragments (#)
 */
export function normalizeUrl(urlString: string): string {
  try {
    // Handle relative URLs or missing protocol
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = 'https://' + urlString;
    }

    const url = new URL(urlString);

    // Lowercase the hostname
    let hostname = url.hostname.toLowerCase();

    // Remove www. prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    // Build normalized path
    let path = url.pathname;

    // Remove trailing slash (except for root)
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Sort query parameters for consistency
    const params = new URLSearchParams(url.search);
    const sortedParams = new URLSearchParams([...params.entries()].sort());
    const search = sortedParams.toString();

    // Build normalized URL (no fragment)
    let normalized = `${hostname}${path}`;
    if (search) {
      normalized += `?${search}`;
    }

    return normalized;
  } catch {
    // If URL parsing fails, return as-is
    return urlString;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(urlString: string): string {
  try {
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = 'https://' + urlString;
    }
    const url = new URL(urlString);
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return urlString;
  }
}

/**
 * Check if URL is valid and crawlable
 */
export function isValidUrl(urlString: string): boolean {
  try {
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = 'https://' + urlString;
    }
    const url = new URL(urlString);

    // Must be http or https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // Skip common non-page resources
    const skipExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.7z', '.tar', '.gz',
      '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
      '.css', '.js', '.json', '.xml', '.rss',
      '.woff', '.woff2', '.ttf', '.eot'
    ];

    const path = url.pathname.toLowerCase();
    for (const ext of skipExtensions) {
      if (path.endsWith(ext)) {
        return false;
      }
    }

    // Skip certain URL patterns
    const skipPatterns = [
      'javascript:',
      'mailto:',
      'tel:',
      'data:',
      '#'
    ];

    for (const pattern of skipPatterns) {
      if (urlString.toLowerCase().startsWith(pattern)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve relative URL against base URL
 */
export function resolveUrl(base: string, relative: string): string {
  try {
    // Handle protocol-relative URLs
    if (relative.startsWith('//')) {
      const baseUrl = new URL(base);
      return `${baseUrl.protocol}${relative}`;
    }

    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/**
 * Check if URL is on the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  return extractDomain(url1) === extractDomain(url2);
}
