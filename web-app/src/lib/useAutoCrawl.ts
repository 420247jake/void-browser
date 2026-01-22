// Stub for web demo - no auto crawl functionality
export const DEFAULT_AUTO_CRAWL_SETTINGS = {
  enabled: false,
  maxNodes: 20,
  maxDepth: 1,
  delayBetweenRequests: 1000,
};

export function useAutoCrawl() {
  return {
    isRunning: false,
    progress: 0,
    currentUrl: null,
    start: () => {},
    stop: () => {},
  };
}
