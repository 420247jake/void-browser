// robots.txt parser and checker

import axios from 'axios';

interface RobotsRules {
  disallowed: string[];
  allowed: string[];
  crawlDelay: number | null;
  fetched: boolean;
}

export class RobotsChecker {
  private cache: Map<string, RobotsRules> = new Map();
  private userAgent: string;

  constructor(userAgent: string = 'VoidBrowser') {
    this.userAgent = userAgent.toLowerCase();
  }

  /**
   * Check if a URL is allowed to be crawled
   */
  async isAllowed(url: string): Promise<boolean> {
    const domain = this.extractDomain(url);
    const rules = await this.getRules(domain);
    
    if (!rules.fetched) {
      // If we couldn't fetch robots.txt, assume allowed
      return true;
    }

    const path = this.extractPath(url);

    // Check allowed first (more specific)
    for (const pattern of rules.allowed) {
      if (this.matchesPattern(path, pattern)) {
        return true;
      }
    }

    // Check disallowed
    for (const pattern of rules.disallowed) {
      if (this.matchesPattern(path, pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get crawl delay for a domain (if specified)
   */
  async getCrawlDelay(domain: string): Promise<number | null> {
    const rules = await this.getRules(domain);
    return rules.crawlDelay;
  }

  /**
   * Fetch and parse robots.txt for a domain
   */
  private async getRules(domain: string): Promise<RobotsRules> {
    if (this.cache.has(domain)) {
      return this.cache.get(domain)!;
    }

    const rules: RobotsRules = {
      disallowed: [],
      allowed: [],
      crawlDelay: null,
      fetched: false
    };

    try {
      const robotsUrl = `https://${domain}/robots.txt`;
      const response = await axios.get(robotsUrl, {
        timeout: 5000,
        headers: { 'User-Agent': this.userAgent },
        validateStatus: (status) => status < 500
      });

      if (response.status === 200 && typeof response.data === 'string') {
        this.parseRobotsTxt(response.data, rules);
        rules.fetched = true;
      }
    } catch {
      // Failed to fetch - that's fine, assume no restrictions
    }

    this.cache.set(domain, rules);
    return rules;
  }

  /**
   * Parse robots.txt content
   */
  private parseRobotsTxt(content: string, rules: RobotsRules): void {
    const lines = content.split('\n');
    let inOurSection = false;
    let inWildcardSection = false;

    for (const rawLine of lines) {
      const line = rawLine.trim().toLowerCase();
      
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) continue;

      // Check for user-agent directive
      if (line.startsWith('user-agent:')) {
        const agent = line.substring(11).trim();
        
        if (agent === '*') {
          inWildcardSection = true;
          inOurSection = false;
        } else if (agent.includes('voidbrowser') || this.userAgent.includes(agent)) {
          inOurSection = true;
          inWildcardSection = false;
        } else {
          inOurSection = false;
          inWildcardSection = false;
        }
        continue;
      }

      // Only process rules if we're in a relevant section
      if (!inOurSection && !inWildcardSection) continue;

      // Parse directives
      if (line.startsWith('disallow:')) {
        const path = rawLine.substring(rawLine.indexOf(':') + 1).trim();
        if (path) {
          rules.disallowed.push(path);
        }
      } else if (line.startsWith('allow:')) {
        const path = rawLine.substring(rawLine.indexOf(':') + 1).trim();
        if (path) {
          rules.allowed.push(path);
        }
      } else if (line.startsWith('crawl-delay:')) {
        const delay = parseFloat(line.substring(12).trim());
        if (!isNaN(delay) && delay > 0) {
          rules.crawlDelay = delay * 1000; // Convert to ms
        }
      }
    }
  }

  /**
   * Check if a path matches a robots.txt pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Handle wildcard patterns
    if (pattern.includes('*')) {
      const regex = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
        .replace(/\*/g, '.*'); // Convert * to .*
      return new RegExp(`^${regex}`).test(path);
    }

    // Handle $ end anchor
    if (pattern.endsWith('$')) {
      return path === pattern.slice(0, -1);
    }

    // Simple prefix match
    return path.startsWith(pattern);
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  private extractPath(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch {
      return '/';
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
