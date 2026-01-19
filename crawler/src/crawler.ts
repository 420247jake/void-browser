// Main Crawler Engine - orchestrates the crawl

import { VoidStorage, createVoid } from './storage.js';
import { UrlQueue } from './queue.js';
import { Fetcher } from './fetcher.js';
import { RateLimiter } from './utils/rateLimit.js';
import { normalizeUrl, extractDomain, isSameDomain } from './utils/normalizer.js';
import { ScreenshotCapture } from './screenshot.js';
import type { CrawlerOptions, CrawlerStats } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';

export interface CrawlerEvents {
  onStart?: () => void;
  onNode?: (url: string, title: string | null, depth: number) => void;
  onError?: (url: string, error: string) => void;
  onProgress?: (stats: CrawlerStats) => void;
  onComplete?: (stats: CrawlerStats) => void;
}

export class VoidCrawler {
  private storage: VoidStorage;
  private queue: UrlQueue;
  private fetcher: Fetcher;
  private rateLimiter: RateLimiter;
  private screenshotCapture: ScreenshotCapture | null = null;
  private options: CrawlerOptions;
  private stats: CrawlerStats;
  private events: CrawlerEvents;
  private running: boolean = false;
  private seedDomain: string = '';

  constructor(
    storage: VoidStorage,
    options: Partial<CrawlerOptions> = {},
    events: CrawlerEvents = {}
  ) {
    this.storage = storage;
    this.options = { ...DEFAULT_OPTIONS, ...options } as CrawlerOptions;
    this.events = events;
    this.queue = new UrlQueue();
    this.fetcher = new Fetcher(this.options);
    this.rateLimiter = new RateLimiter(this.options.rateLimit);
    this.stats = this.initStats();
    
    // Initialize screenshot capture if enabled
    if (this.options.takeScreenshots) {
      this.screenshotCapture = new ScreenshotCapture(3);
    }
  }

  private initStats(): CrawlerStats {
    return {
      nodesFound: 0,
      nodesCrawled: 0,
      edgesFound: 0,
      errors: 0,
      startTime: new Date(),
      domains: new Set()
    };
  }

  /**
   * Start crawling from a seed URL
   */
  async crawl(seedUrl: string): Promise<CrawlerStats> {
    this.running = true;
    this.stats = this.initStats();
    this.seedDomain = extractDomain(seedUrl);

    // Add seed to queue
    this.queue.add(seedUrl, 0, null);

    this.events.onStart?.();

    // Process queue
    while (this.running && !this.queue.isEmpty()) {
      // Check limits
      if (this.stats.nodesCrawled >= this.options.maxNodes) {
        break;
      }

      // Get batch for concurrent processing
      const batch = this.queue.nextBatch(this.options.concurrency);
      
      if (batch.length === 0) {
        // Wait for in-progress items
        await this.sleep(100);
        continue;
      }

      // Process batch concurrently
      await Promise.all(batch.map(item => this.processUrl(item.url, item.depth, item.sourceId)));

      // Report progress
      this.events.onProgress?.(this.stats);
    }

    // Cleanup screenshot capture
    if (this.screenshotCapture) {
      await this.screenshotCapture.close();
    }

    this.running = false;
    this.events.onComplete?.(this.stats);
    return this.stats;
  }

  /**
   * Process a single URL
   */
  private async processUrl(url: string, depth: number, sourceId: string | null): Promise<void> {
    const domain = extractDomain(url);

    try {
      // Rate limit per domain
      await this.rateLimiter.wait(domain);

      // Fetch page
      const result = await this.fetcher.fetch(url);

      if (result.error && result.statusCode === 0) {
        this.stats.errors++;
        this.events.onError?.(url, result.error);
        this.queue.complete(url);
        return;
      }

      // Capture screenshot if enabled
      let thumbnail: Buffer | null = null;
      if (this.screenshotCapture && result.statusCode >= 200 && result.statusCode < 400) {
        try {
          thumbnail = await this.screenshotCapture.capture(url);
        } catch (err) {
          // Silently ignore screenshot errors
        }
      }

      // Create node
      const nodeId = this.storage.insertNode({
        url: url,
        normalizedUrl: normalizeUrl(url),
        domain: domain,
        title: result.title,
        description: result.description,
        favicon: result.favicon,
        thumbnail: thumbnail,
        positionX: this.randomPosition(),
        positionY: this.randomPosition(),
        positionZ: this.randomPosition(),
        statusCode: result.statusCode,
        isAlive: result.statusCode >= 200 && result.statusCode < 400,
        depth: depth,
        crawledAt: new Date().toISOString(),
        lastVisited: null
      });

      this.stats.nodesFound++;
      this.stats.nodesCrawled++;
      this.stats.domains.add(domain);

      this.events.onNode?.(url, result.title, depth);

      // Create edge from source
      if (sourceId) {
        this.storage.insertEdge(sourceId, url, nodeId);
        this.stats.edgesFound++;
      }

      // Update edges that point to this URL
      this.storage.updateEdgeTargets(url, nodeId);

      // Add outbound links to queue
      if (depth < this.options.maxDepth) {
        for (const link of result.links) {
          // Filter by domain if stayOnDomain is set
          if (this.options.stayOnDomain && !isSameDomain(link, url)) {
            continue;
          }

          // Check if already in database
          if (this.storage.hasUrl(normalizeUrl(link))) {
            // Still create edge even if we've seen the node
            this.storage.insertEdge(nodeId, link, null);
            this.stats.edgesFound++;
            continue;
          }

          // Add to queue
          if (this.queue.add(link, depth + 1, nodeId)) {
            // Create edge (target_id will be updated when crawled)
            this.storage.insertEdge(nodeId, link, null);
            this.stats.edgesFound++;
          }
        }
      }
    } catch (error) {
      this.stats.errors++;
      this.events.onError?.(url, String(error));
    } finally {
      this.queue.complete(url);
    }
  }

  /**
   * Stop the crawler
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Check if crawler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current stats
   */
  getStats(): CrawlerStats {
    return this.stats;
  }

  /**
   * Get queue stats
   */
  getQueueStats() {
    return this.queue.getStats();
  }

  /**
   * Generate random position for node placement
   */
  private randomPosition(): number {
    // Random position in a sphere
    return (Math.random() - 0.5) * 20;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Re-export DEFAULT_OPTIONS
export { DEFAULT_OPTIONS } from './types.js';
