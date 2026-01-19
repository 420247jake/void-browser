/**
 * Crawl Depth & Link Analysis Utilities
 * Phase 7: Advanced Crawl Features
 */

import { VoidNode, VoidEdge } from "./types";

// ==================== DEPTH CALCULATION ====================

export interface NodeDepthInfo {
  nodeId: number;
  depth: number;
  pathFromRoot: number[];
}

/**
 * Calculate the depth of each node from a root node using BFS
 * Depth 0 = root node, Depth 1 = directly linked, etc.
 */
export function calculateNodeDepths(
  nodes: VoidNode[],
  edges: VoidEdge[],
  rootNodeId: number
): Map<number, NodeDepthInfo> {
  const depthMap = new Map<number, NodeDepthInfo>();
  
  // Build adjacency list (bidirectional for graph traversal)
  const adjacency = new Map<number, number[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.source_id)?.push(edge.target_id);
    adjacency.get(edge.target_id)?.push(edge.source_id);
  }
  
  // BFS from root
  const queue: { id: number; depth: number; path: number[] }[] = [
    { id: rootNodeId, depth: 0, path: [rootNodeId] }
  ];
  const visited = new Set<number>();
  
  while (queue.length > 0) {
    const { id, depth, path } = queue.shift()!;
    
    if (visited.has(id)) continue;
    visited.add(id);
    
    depthMap.set(id, {
      nodeId: id,
      depth,
      pathFromRoot: path,
    });
    
    const neighbors = adjacency.get(id) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        queue.push({
          id: neighborId,
          depth: depth + 1,
          path: [...path, neighborId],
        });
      }
    }
  }
  
  return depthMap;
}

/**
 * Get depth color based on how far from root
 * Returns HSL color string
 */
export function getDepthColor(depth: number, maxDepth: number = 10): string {
  // Hue goes from cyan (180) to purple (280) as depth increases
  const hue = 180 + (depth / maxDepth) * 100;
  const saturation = 80;
  const lightness = 50 + (depth / maxDepth) * 10; // Slightly lighter as depth increases
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get depth color as RGB values for Three.js
 */
export function getDepthColorRGB(depth: number, maxDepth: number = 10): { r: number; g: number; b: number } {
  const colors = [
    { r: 0.31, g: 0.76, b: 0.97 },  // Depth 0 - Cyan
    { r: 0.40, g: 0.70, b: 0.95 },  // Depth 1
    { r: 0.50, g: 0.60, b: 0.90 },  // Depth 2
    { r: 0.60, g: 0.50, b: 0.85 },  // Depth 3
    { r: 0.70, g: 0.40, b: 0.80 },  // Depth 4
    { r: 0.75, g: 0.35, b: 0.75 },  // Depth 5
    { r: 0.80, g: 0.30, b: 0.70 },  // Depth 6 - Purple
    { r: 0.85, g: 0.25, b: 0.65 },  // Depth 7
    { r: 0.90, g: 0.20, b: 0.60 },  // Depth 8
    { r: 0.95, g: 0.15, b: 0.55 },  // Depth 9+
  ];
  
  const index = Math.min(depth, colors.length - 1);
  return colors[index];
}

// ==================== BROKEN LINK DETECTION ====================

export interface BrokenLinkReport {
  totalNodes: number;
  aliveNodes: number;
  deadNodes: number;
  neverCrawled: number;
  staleNodes: number;
  deadNodeList: BrokenNodeInfo[];
  staleNodeList: BrokenNodeInfo[];
}

export interface BrokenNodeInfo {
  id: number;
  url: string;
  title: string;
  lastCrawled: string | null;
  daysSinceCheck: number | null;
}

/**
 * Generate a broken link report
 */
export function generateBrokenLinkReport(
  nodes: VoidNode[],
  staleDaysThreshold: number = 7
): BrokenLinkReport {
  const now = new Date();
  const deadNodes: BrokenNodeInfo[] = [];
  const staleNodes: BrokenNodeInfo[] = [];
  let neverCrawled = 0;
  let aliveCount = 0;
  
  for (const node of nodes) {
    let daysSinceCheck: number | null = null;
    
    if (node.last_crawled) {
      const lastCrawled = new Date(node.last_crawled);
      daysSinceCheck = Math.floor((now.getTime() - lastCrawled.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      neverCrawled++;
    }
    
    const info: BrokenNodeInfo = {
      id: node.id,
      url: node.url,
      title: node.title,
      lastCrawled: node.last_crawled,
      daysSinceCheck,
    };
    
    if (!node.is_alive) {
      deadNodes.push(info);
    } else {
      aliveCount++;
      if (daysSinceCheck !== null && daysSinceCheck > staleDaysThreshold) {
        staleNodes.push(info);
      }
    }
  }
  
  // Sort by days since check (oldest first)
  deadNodes.sort((a, b) => (b.daysSinceCheck || 0) - (a.daysSinceCheck || 0));
  staleNodes.sort((a, b) => (b.daysSinceCheck || 0) - (a.daysSinceCheck || 0));
  
  return {
    totalNodes: nodes.length,
    aliveNodes: aliveCount,
    deadNodes: deadNodes.length,
    neverCrawled,
    staleNodes: staleNodes.length,
    deadNodeList: deadNodes,
    staleNodeList: staleNodes,
  };
}

// ==================== SITEMAP PARSING ====================

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

/**
 * Parse an XML sitemap
 */
export function parseSitemap(xmlContent: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  
  // Simple regex-based parser for sitemap XML
  const urlRegex = /<url>([\s\S]*?)<\/url>/gi;
  const locRegex = /<loc>([^<]+)<\/loc>/i;
  const lastmodRegex = /<lastmod>([^<]+)<\/lastmod>/i;
  const changefreqRegex = /<changefreq>([^<]+)<\/changefreq>/i;
  const priorityRegex = /<priority>([^<]+)<\/priority>/i;
  
  let match;
  while ((match = urlRegex.exec(xmlContent)) !== null) {
    const urlBlock = match[1];
    
    const locMatch = locRegex.exec(urlBlock);
    if (!locMatch) continue;
    
    const entry: SitemapEntry = {
      url: locMatch[1].trim(),
    };
    
    const lastmodMatch = lastmodRegex.exec(urlBlock);
    if (lastmodMatch) {
      entry.lastmod = lastmodMatch[1].trim();
    }
    
    const changefreqMatch = changefreqRegex.exec(urlBlock);
    if (changefreqMatch) {
      entry.changefreq = changefreqMatch[1].trim();
    }
    
    const priorityMatch = priorityRegex.exec(urlBlock);
    if (priorityMatch) {
      entry.priority = parseFloat(priorityMatch[1].trim());
    }
    
    entries.push(entry);
  }
  
  // Also handle sitemap index files
  const sitemapIndexRegex = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
  while ((match = sitemapIndexRegex.exec(xmlContent)) !== null) {
    const sitemapBlock = match[1];
    const locMatch = locRegex.exec(sitemapBlock);
    if (locMatch) {
      // This is a sitemap index entry - the URL points to another sitemap
      entries.push({
        url: locMatch[1].trim(),
        changefreq: "sitemap-index",
      });
    }
  }
  
  return entries;
}

/**
 * Parse a robots.txt to find sitemap URLs
 */
export function parseSitemapFromRobots(robotsTxt: string): string[] {
  const sitemaps: string[] = [];
  const lines = robotsTxt.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith('sitemap:')) {
      const url = line.substring(line.indexOf(':') + 1).trim();
      if (url) {
        sitemaps.push(url);
      }
    }
  }
  
  return sitemaps;
}

// ==================== CRAWL STATISTICS ====================

export interface CrawlStatistics {
  totalNodes: number;
  crawledNodes: number;
  pendingNodes: number;
  healthScore: number; // 0-100
  avgDepth: number;
  maxDepth: number;
  domainDistribution: Map<string, number>;
  crawlCoverage: number; // percentage
  recentActivity: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

/**
 * Calculate comprehensive crawl statistics
 */
export function calculateCrawlStatistics(
  nodes: VoidNode[],
  edges: VoidEdge[],
  rootNodeId?: number
): CrawlStatistics {
  const now = new Date();
  let crawledCount = 0;
  let aliveCount = 0;
  let last24h = 0;
  let last7d = 0;
  let last30d = 0;
  const domainDistribution = new Map<string, number>();
  
  for (const node of nodes) {
    // Domain distribution
    try {
      const domain = new URL(node.url).hostname;
      domainDistribution.set(domain, (domainDistribution.get(domain) || 0) + 1);
    } catch {}
    
    // Crawl status
    if (node.last_crawled) {
      crawledCount++;
      const lastCrawled = new Date(node.last_crawled);
      const hoursSince = (now.getTime() - lastCrawled.getTime()) / (1000 * 60 * 60);
      
      if (hoursSince <= 24) last24h++;
      if (hoursSince <= 24 * 7) last7d++;
      if (hoursSince <= 24 * 30) last30d++;
    }
    
    if (node.is_alive) aliveCount++;
  }
  
  // Calculate depth stats
  let avgDepth = 0;
  let maxDepth = 0;
  
  if (rootNodeId && nodes.length > 0) {
    const depthMap = calculateNodeDepths(nodes, edges, rootNodeId);
    let totalDepth = 0;
    let depthCount = 0;
    
    for (const info of depthMap.values()) {
      totalDepth += info.depth;
      depthCount++;
      if (info.depth > maxDepth) maxDepth = info.depth;
    }
    
    avgDepth = depthCount > 0 ? totalDepth / depthCount : 0;
  }
  
  // Health score: combination of alive ratio and crawl freshness
  const aliveRatio = nodes.length > 0 ? aliveCount / nodes.length : 1;
  const freshnessRatio = nodes.length > 0 ? last7d / nodes.length : 1;
  const healthScore = Math.round((aliveRatio * 0.6 + freshnessRatio * 0.4) * 100);
  
  return {
    totalNodes: nodes.length,
    crawledNodes: crawledCount,
    pendingNodes: nodes.length - crawledCount,
    healthScore,
    avgDepth: Math.round(avgDepth * 10) / 10,
    maxDepth,
    domainDistribution,
    crawlCoverage: nodes.length > 0 ? Math.round((crawledCount / nodes.length) * 100) : 0,
    recentActivity: {
      last24h,
      last7d,
      last30d,
    },
  };
}
