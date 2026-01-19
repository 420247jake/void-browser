// URL Queue - manages URLs to crawl

import type { QueueItem } from './types.js';
import { normalizeUrl } from './utils/normalizer.js';

export class UrlQueue {
  private queue: QueueItem[] = [];
  private seen: Set<string> = new Set();
  private inProgress: Set<string> = new Set();

  /**
   * Add URL to queue if not already seen
   */
  add(url: string, depth: number, sourceId: string | null = null): boolean {
    const normalized = normalizeUrl(url);

    // Skip if already seen or in progress
    if (this.seen.has(normalized) || this.inProgress.has(normalized)) {
      return false;
    }

    this.seen.add(normalized);
    this.queue.push({ url, depth, sourceId });
    return true;
  }

  /**
   * Add multiple URLs
   */
  addMany(urls: string[], depth: number, sourceId: string | null = null): number {
    let added = 0;
    for (const url of urls) {
      if (this.add(url, depth, sourceId)) {
        added++;
      }
    }
    return added;
  }

  /**
   * Get next URL from queue
   */
  next(): QueueItem | null {
    const item = this.queue.shift();
    if (item) {
      this.inProgress.add(normalizeUrl(item.url));
    }
    return item || null;
  }

  /**
   * Get multiple URLs (for concurrent processing)
   */
  nextBatch(count: number): QueueItem[] {
    const batch: QueueItem[] = [];
    for (let i = 0; i < count && this.queue.length > 0; i++) {
      const item = this.next();
      if (item) batch.push(item);
    }
    return batch;
  }

  /**
   * Mark URL as complete (remove from in-progress)
   */
  complete(url: string): void {
    this.inProgress.delete(normalizeUrl(url));
  }

  /**
   * Mark URL as already processed (for resuming)
   */
  markSeen(url: string): void {
    this.seen.add(normalizeUrl(url));
  }

  /**
   * Check if URL has been seen
   */
  hasSeen(url: string): boolean {
    return this.seen.has(normalizeUrl(url));
  }

  /**
   * Get queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Get total seen count
   */
  get seenCount(): number {
    return this.seen.size;
  }

  /**
   * Get in-progress count
   */
  get inProgressCount(): number {
    return this.inProgress.size;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.inProgress.size === 0;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.seen.clear();
    this.inProgress.clear();
  }

  /**
   * Get stats
   */
  getStats(): { queued: number; seen: number; inProgress: number } {
    return {
      queued: this.queue.length,
      seen: this.seen.size,
      inProgress: this.inProgress.size
    };
  }
}
