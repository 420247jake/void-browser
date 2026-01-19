// Core types for Void Browser crawler

export interface VoidNode {
  id: string;
  url: string;
  normalizedUrl: string;
  domain: string;
  title: string | null;
  description: string | null;
  favicon: string | null;
  thumbnail: Buffer | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  statusCode: number | null;
  isAlive: boolean;
  depth: number;
  crawledAt: string;
  lastVisited: string | null;
  createdAt: string;
}

export interface VoidEdge {
  id?: number;
  sourceId: string;
  targetUrl: string;
  targetId: string | null;
  createdAt?: string;
}

export interface CrawlResult {
  url: string;
  statusCode: number;
  title: string | null;
  description: string | null;
  favicon: string | null;
  links: string[];
  error?: string;
}

export interface CrawlerOptions {
  maxDepth: number;           // How deep to spider (default: 3)
  maxNodes: number;           // Max pages to crawl (default: 1000)
  concurrency: number;        // Parallel requests (default: 5)
  rateLimit: number;          // MS between requests per domain (default: 1000)
  stayOnDomain: boolean;      // Only crawl same domain? (default: false)
  takeScreenshots: boolean;   // Capture thumbnails? (default: false)
  respectRobotsTxt: boolean;  // Honor robots.txt? (default: true)
  userAgent: string;          // Custom UA string
  timeout: number;            // Request timeout in MS (default: 10000)
}

export interface CrawlerStats {
  nodesFound: number;
  nodesCrawled: number;
  edgesFound: number;
  errors: number;
  startTime: Date;
  domains: Set<string>;
}

export interface QueueItem {
  url: string;
  depth: number;
  sourceId: string | null;
}

export const DEFAULT_OPTIONS: CrawlerOptions = {
  maxDepth: 3,
  maxNodes: 1000,
  concurrency: 5,
  rateLimit: 1000,
  stayOnDomain: false,
  takeScreenshots: false,
  respectRobotsTxt: true,
  userAgent: 'VoidBrowser/1.0 (Web Crawler)',
  timeout: 10000
};
