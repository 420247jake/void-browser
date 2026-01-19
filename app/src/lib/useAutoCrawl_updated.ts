import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CrawlResult {
  node_id: number;
  title: string | null;
  favicon: string | null;
  is_alive: boolean;
  error: string | null;
  links_found: number;
}

interface DiscoveryResult {
  source_node_id: number;
  links_found: number;
  nodes_added: number;
  edges_added: number;
  new_node_ids: number[];
}

interface AutoCrawlStatus {
  nodes_pending: number;
  last_crawled_id: number | null;
  last_crawled_url: string | null;
}

interface VoidNode {
  id: number;
  url: string;
  title: string;
  favicon: string | null;
  screenshot: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  is_alive: boolean;
  last_crawled: string | null;
  created_at: string;
}

export interface AutoCrawlSettings {
  enabled: boolean;
  intervalSeconds: number;
  staleDays: number;
  // NEW: Discovery settings
  discoveryEnabled: boolean;
  discoveryIntervalSeconds: number;
  maxNewNodesPerDiscovery: number;
  externalLinksOnly: boolean;
  maxTotalNodes: number;
}

export const DEFAULT_AUTO_CRAWL_SETTINGS: AutoCrawlSettings = {
  enabled: false,
  intervalSeconds: 15,
  staleDays: 7,
  // NEW defaults
  discoveryEnabled: false,
  discoveryIntervalSeconds: 30,
  maxNewNodesPerDiscovery: 3,
  externalLinksOnly: false,
  maxTotalNodes: 500,
};

export function useAutoCrawl(
  settings: AutoCrawlSettings,
  onNodeUpdated?: (nodeId: number, result: CrawlResult) => void,
  onNodesDiscovered?: (result: DiscoveryResult) => void
) {
  const [status, setStatus] = useState<AutoCrawlStatus>({
    nodes_pending: 0,
    last_crawled_id: null,
    last_crawled_url: null,
  });
  const [isCrawling, setIsCrawling] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentlyCrawling, setCurrentlyCrawling] = useState<string | null>(null);
  const [discoveryStats, setDiscoveryStats] = useState({ totalDiscovered: 0, lastDiscoveryTime: null as string | null });
  const [nodeCount, setNodeCount] = useState(0);
  
  // Use refs to avoid recreating callbacks
  const intervalRef = useRef<number | null>(null);
  const discoveryIntervalRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const isDiscoveringRef = useRef(false);
  const settingsRef = useRef(settings);
  const onNodeUpdatedRef = useRef(onNodeUpdated);
  const onNodesDiscoveredRef = useRef(onNodesDiscovered);
  const hasLoggedEnabledRef = useRef(false);
  const hasLoggedDiscoveryRef = useRef(false);
  
  // Keep refs in sync
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  
  useEffect(() => {
    onNodeUpdatedRef.current = onNodeUpdated;
  }, [onNodeUpdated]);

  useEffect(() => {
    onNodesDiscoveredRef.current = onNodesDiscovered;
  }, [onNodesDiscovered]);

  // Fetch status - stable callback using ref
  const refreshStatus = useCallback(async () => {
    try {
      const newStatus = await invoke<AutoCrawlStatus>("get_auto_crawl_status", {
        staleDays: settingsRef.current.staleDays,
      });
      setStatus(newStatus);
      
      // Get node count for discovery limit check
      const count = await invoke<number>("get_node_count").catch(() => 0);
      setNodeCount(count);
    } catch (err) {
      console.error("Auto-crawl: Failed to get status:", err);
    }
  }, []);

  // Crawl one node - stable callback using refs
  const crawlNext = useCallback(async () => {
    if (isRunningRef.current) return;
    
    isRunningRef.current = true;
    setIsCrawling(true);
    setLastError(null);

    try {
      const target = await invoke<VoidNode | null>("get_next_crawl_target", {
        staleDays: settingsRef.current.staleDays,
      });

      if (!target) {
        if (Math.random() < 0.1) {
          console.log("Auto-crawl: No nodes to crawl");
        }
        setCurrentlyCrawling(null);
        return;
      }

      console.log(`Auto-crawl: Crawling ${target.url}`);
      setCurrentlyCrawling(target.url);

      const result = await invoke<CrawlResult>("crawl_single_node", {
        nodeId: target.id,
      });

      console.log("Auto-crawl result:", result);

      if (result.error) {
        setLastError(result.error);
      }

      if (onNodeUpdatedRef.current) {
        onNodeUpdatedRef.current(target.id, result);
      }

      await refreshStatus();
    } catch (err) {
      console.error("Auto-crawl error:", err);
      setLastError(String(err));
    } finally {
      setIsCrawling(false);
      setCurrentlyCrawling(null);
      isRunningRef.current = false;
    }
  }, [refreshStatus]);

  // NEW: Discovery function - picks a random node and discovers new links
  const discoverNext = useCallback(async () => {
    if (isDiscoveringRef.current) return;
    
    // Check node limit
    if (nodeCount >= settingsRef.current.maxTotalNodes) {
      console.log(`Auto-discovery: Node limit reached (${nodeCount}/${settingsRef.current.maxTotalNodes})`);
      return;
    }
    
    isDiscoveringRef.current = true;
    setIsDiscovering(true);
    setLastError(null);

    try {
      // Get a random node to discover from
      const target = await invoke<VoidNode | null>("get_random_discovery_target");

      if (!target) {
        console.log("Auto-discovery: No nodes available for discovery");
        return;
      }

      console.log(`Auto-discovery: Discovering links from ${target.url}`);
      setCurrentlyCrawling(target.url);

      const result = await invoke<DiscoveryResult>("discover_links_from_node", {
        nodeId: target.id,
        maxNewNodes: settingsRef.current.maxNewNodesPerDiscovery,
        externalOnly: settingsRef.current.externalLinksOnly,
      });

      console.log("Auto-discovery result:", result);

      setDiscoveryStats(prev => ({
        totalDiscovered: prev.totalDiscovered + result.nodes_added,
        lastDiscoveryTime: new Date().toISOString(),
      }));

      if (onNodesDiscoveredRef.current) {
        onNodesDiscoveredRef.current(result);
      }

      await refreshStatus();
    } catch (err) {
      console.error("Auto-discovery error:", err);
      setLastError(String(err));
    } finally {
      setIsDiscovering(false);
      setCurrentlyCrawling(null);
      isDiscoveringRef.current = false;
    }
  }, [refreshStatus, nodeCount]);

  // Manual trigger for crawl
  const crawlNow = useCallback(() => {
    if (!isRunningRef.current) {
      crawlNext();
    }
  }, [crawlNext]);

  // Manual trigger for discovery
  const discoverNow = useCallback(() => {
    if (!isDiscoveringRef.current) {
      discoverNext();
    }
  }, [discoverNext]);

  // Reset all crawl timestamps
  const resetAllTimestamps = useCallback(async () => {
    try {
      const count = await invoke<number>("reset_all_crawl_timestamps");
      console.log(`Reset crawl timestamps for ${count} nodes`);
      await refreshStatus();
      return count;
    } catch (err) {
      console.error("Failed to reset timestamps:", err);
      return 0;
    }
  }, [refreshStatus]);

  // Start/stop crawl interval based on settings
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (settings.enabled) {
      if (!hasLoggedEnabledRef.current) {
        console.log(`Auto-crawl enabled: every ${settings.intervalSeconds}s`);
        hasLoggedEnabledRef.current = true;
      }
      
      refreshStatus();
      
      intervalRef.current = window.setInterval(() => {
        crawlNext();
      }, settings.intervalSeconds * 1000);

      crawlNext();
    } else {
      hasLoggedEnabledRef.current = false;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [settings.enabled, settings.intervalSeconds, crawlNext, refreshStatus]);

  // NEW: Start/stop discovery interval based on settings
  useEffect(() => {
    if (discoveryIntervalRef.current) {
      clearInterval(discoveryIntervalRef.current);
      discoveryIntervalRef.current = null;
    }

    if (settings.discoveryEnabled) {
      if (!hasLoggedDiscoveryRef.current) {
        console.log(`Auto-discovery enabled: every ${settings.discoveryIntervalSeconds}s, max ${settings.maxNewNodesPerDiscovery} nodes per discovery`);
        hasLoggedDiscoveryRef.current = true;
      }
      
      discoveryIntervalRef.current = window.setInterval(() => {
        discoverNext();
      }, settings.discoveryIntervalSeconds * 1000);

      // Initial discovery after a short delay
      setTimeout(() => discoverNext(), 3000);
    } else {
      hasLoggedDiscoveryRef.current = false;
    }

    return () => {
      if (discoveryIntervalRef.current) {
        clearInterval(discoveryIntervalRef.current);
        discoveryIntervalRef.current = null;
      }
    };
  }, [settings.discoveryEnabled, settings.discoveryIntervalSeconds, discoverNext]);

  // Refresh status periodically
  useEffect(() => {
    const statusInterval = setInterval(refreshStatus, 30000);
    refreshStatus();
    return () => clearInterval(statusInterval);
  }, [refreshStatus]);

  return {
    status,
    isCrawling,
    isDiscovering,
    lastError,
    currentlyCrawling,
    discoveryStats,
    nodeCount,
    crawlNow,
    discoverNow,
    refreshStatus,
    resetAllTimestamps,
  };
}
