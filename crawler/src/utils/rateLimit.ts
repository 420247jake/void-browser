// Rate limiter - prevents hammering domains

export class RateLimiter {
  private lastRequest: Map<string, number> = new Map();
  private delayMs: number;

  constructor(delayMs: number = 1000) {
    this.delayMs = delayMs;
  }

  /**
   * Wait if needed before making a request to this domain
   */
  async wait(domain: string): Promise<void> {
    const lastTime = this.lastRequest.get(domain) || 0;
    const now = Date.now();
    const elapsed = now - lastTime;

    if (elapsed < this.delayMs) {
      const waitTime = this.delayMs - elapsed;
      await this.sleep(waitTime);
    }

    this.lastRequest.set(domain, Date.now());
  }

  /**
   * Check if we can make a request now (non-blocking)
   */
  canRequest(domain: string): boolean {
    const lastTime = this.lastRequest.get(domain) || 0;
    return Date.now() - lastTime >= this.delayMs;
  }

  /**
   * Get time until next allowed request
   */
  getWaitTime(domain: string): number {
    const lastTime = this.lastRequest.get(domain) || 0;
    const elapsed = Date.now() - lastTime;
    return Math.max(0, this.delayMs - elapsed);
  }

  /**
   * Update delay setting
   */
  setDelay(delayMs: number): void {
    this.delayMs = delayMs;
  }

  /**
   * Clear rate limit history (useful for testing)
   */
  clear(): void {
    this.lastRequest.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
