// HTTP fetcher - handles web requests

import axios, { AxiosError } from 'axios';
import type { CrawlerOptions, CrawlResult } from './types.js';
import { parseHtml } from './parser.js';

export class Fetcher {
  private options: CrawlerOptions;

  constructor(options: CrawlerOptions) {
    this.options = options;
  }

  /**
   * Fetch and parse a URL
   */
  async fetch(url: string): Promise<CrawlResult> {
    try {
      const response = await axios.get(url, {
        timeout: this.options.timeout,
        maxRedirects: 5,
        headers: {
          'User-Agent': this.options.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        validateStatus: (status) => status < 500, // Accept redirects and 4xx
        responseType: 'text'
      });

      // Check if response is HTML
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return {
          url,
          statusCode: response.status,
          title: null,
          description: null,
          favicon: null,
          links: [],
          error: `Not HTML: ${contentType}`
        };
      }

      // Parse HTML
      const parsed = parseHtml(response.data, url);

      return {
        url,
        statusCode: response.status,
        title: parsed.title,
        description: parsed.description,
        favicon: parsed.favicon,
        links: parsed.links
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      
      return {
        url,
        statusCode: axiosError.response?.status || 0,
        title: null,
        description: null,
        favicon: null,
        links: [],
        error: axiosError.message
      };
    }
  }

  /**
   * Check if URL is reachable (HEAD request)
   */
  async ping(url: string): Promise<{ ok: boolean; statusCode: number }> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        maxRedirects: 3,
        headers: {
          'User-Agent': this.options.userAgent
        },
        validateStatus: () => true
      });

      return {
        ok: response.status >= 200 && response.status < 400,
        statusCode: response.status
      };
    } catch {
      return { ok: false, statusCode: 0 };
    }
  }

  /**
   * Fetch favicon as base64
   */
  async fetchFavicon(faviconUrl: string): Promise<string | null> {
    try {
      const response = await axios.get(faviconUrl, {
        timeout: 5000,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': this.options.userAgent
        }
      });

      const contentType = response.headers['content-type'] || 'image/x-icon';
      const base64 = Buffer.from(response.data).toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch {
      return null;
    }
  }

  /**
   * Update options
   */
  setOptions(options: Partial<CrawlerOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
