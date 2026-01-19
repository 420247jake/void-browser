// Screenshot capture using Puppeteer

import puppeteer, { Browser, Page } from 'puppeteer';

export class ScreenshotCapture {
  private browser: Browser | null = null;
  private maxConcurrent: number;
  private activePages: number = 0;

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Initialize the browser instance
   */
  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
    });
  }

  /**
   * Capture a screenshot of a URL
   */
  async capture(url: string, width: number = 1280, height: number = 720): Promise<Buffer | null> {
    if (!this.browser) {
      await this.init();
    }

    // Wait if too many pages are active
    while (this.activePages >= this.maxConcurrent) {
      await this.sleep(100);
    }

    this.activePages++;
    let page: Page | null = null;

    try {
      page = await this.browser!.newPage();
      
      await page.setViewport({ width, height });
      
      // Set timeout and navigate
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      });

      // Wait a bit for any late-loading content
      await this.sleep(500);

      // Capture screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        encoding: 'binary',
      }) as Buffer;

      return screenshot;
    } catch (error) {
      console.error(`Screenshot failed for ${url}:`, error);
      return null;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }
      this.activePages--;
    }
  }

  /**
   * Capture multiple screenshots in parallel
   */
  async captureMany(urls: string[]): Promise<Map<string, Buffer | null>> {
    const results = new Map<string, Buffer | null>();
    
    const promises = urls.map(async (url) => {
      const screenshot = await this.capture(url);
      results.set(url, screenshot);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for convenience
let instance: ScreenshotCapture | null = null;

export async function captureScreenshot(url: string): Promise<Buffer | null> {
  if (!instance) {
    instance = new ScreenshotCapture();
    await instance.init();
  }
  return instance.capture(url);
}

export async function closeScreenshotCapture(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
