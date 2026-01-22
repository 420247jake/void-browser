/**
 * Analytics library for Void Browser
 * Calculates stats, metrics, and data for the stats dashboard
 */

import { VoidNode, VoidEdge } from "./types";

// Domain statistics
export interface DomainStats {
  domain: string;
  count: number;
  aliveCount: number;
  deadCount: number;
  percentage: number;
  color: string;
}

// Timeline data point
export interface TimelinePoint {
  date: string;
  count: number;
  cumulative: number;
}

// Overall graph statistics
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  uniqueDomains: number;
  aliveNodes: number;
  deadNodes: number;
  favoriteNodes: number;
  avgConnectionsPerNode: number;
  graphDensity: number;
  maxDepth: number;
  orphanNodes: number;
  hubNodes: { node: VoidNode; connections: number }[];
}

// Dead link info
export interface DeadLink {
  node: VoidNode;
  domain: string;
  lastCrawled: string | null;
}

// Color palette for domains (matches the neon theme)
const DOMAIN_COLORS = [
  "#4fc3f7", // Cyan (primary)
  "#f06292", // Pink
  "#ba68c8", // Purple
  "#81c784", // Green
  "#ffb74d", // Orange
  "#64b5f6", // Blue
  "#e57373", // Red
  "#4db6ac", // Teal
  "#fff176", // Yellow
  "#a1887f", // Brown
  "#90a4ae", // Blue Grey
  "#7986cb", // Indigo
];

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/**
 * Get domain-to-color mapping (consistent colors)
 */
export function getDomainColor(domain: string, allDomains: string[]): string {
  const sortedDomains = [...allDomains].sort();
  const index = sortedDomains.indexOf(domain);
  return DOMAIN_COLORS[index % DOMAIN_COLORS.length];
}

/**
 * Calculate domain statistics
 */
export function calculateDomainStats(nodes: VoidNode[]): DomainStats[] {
  const domainMap = new Map<string, { alive: number; dead: number }>();

  // Count nodes per domain
  nodes.forEach((node) => {
    const domain = extractDomain(node.url);
    const current = domainMap.get(domain) || { alive: 0, dead: 0 };
    if (node.is_alive) {
      current.alive++;
    } else {
      current.dead++;
    }
    domainMap.set(domain, current);
  });

  // Convert to array and calculate percentages
  const total = nodes.length;
  const allDomains = Array.from(domainMap.keys());

  return Array.from(domainMap.entries())
    .map(([domain, counts]) => ({
      domain,
      count: counts.alive + counts.dead,
      aliveCount: counts.alive,
      deadCount: counts.dead,
      percentage: total > 0 ? ((counts.alive + counts.dead) / total) * 100 : 0,
      color: getDomainColor(domain, allDomains),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate timeline data (nodes over time)
 */
export function calculateTimeline(nodes: VoidNode[]): TimelinePoint[] {
  // Group nodes by date
  const dateMap = new Map<string, number>();

  nodes.forEach((node) => {
    const date = node.created_at.split("T")[0]; // Get YYYY-MM-DD
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  });

  // Sort dates and calculate cumulative
  const sortedDates = Array.from(dateMap.keys()).sort();
  let cumulative = 0;

  return sortedDates.map((date) => {
    const count = dateMap.get(date) || 0;
    cumulative += count;
    return { date, count, cumulative };
  });
}

/**
 * Calculate overall graph statistics
 */
export function calculateGraphStats(nodes: VoidNode[], edges: VoidEdge[]): GraphStats {
  const totalNodes = nodes.length;
  const totalEdges = edges.length;

  // Unique domains
  const domains = new Set(nodes.map((n) => extractDomain(n.url)));

  // Alive/dead counts
  const aliveNodes = nodes.filter((n) => n.is_alive).length;
  const deadNodes = nodes.filter((n) => !n.is_alive).length;
  const favoriteNodes = nodes.filter((n) => n.is_favorite).length;

  // Connection counts per node
  const connectionCount = new Map<number, number>();
  nodes.forEach((n) => connectionCount.set(n.id, 0));
  edges.forEach((e) => {
    connectionCount.set(e.source_id, (connectionCount.get(e.source_id) || 0) + 1);
    connectionCount.set(e.target_id, (connectionCount.get(e.target_id) || 0) + 1);
  });

  // Average connections
  const avgConnectionsPerNode = totalNodes > 0
    ? Array.from(connectionCount.values()).reduce((a, b) => a + b, 0) / totalNodes
    : 0;

  // Graph density: actual edges / possible edges
  // For directed graph: n * (n-1), for undirected: n * (n-1) / 2
  const possibleEdges = totalNodes * (totalNodes - 1) / 2;
  const graphDensity = possibleEdges > 0 ? totalEdges / possibleEdges : 0;

  // Orphan nodes (no connections)
  const orphanNodes = Array.from(connectionCount.entries())
    .filter(([, count]) => count === 0).length;

  // Hub nodes (top 5 most connected)
  const hubNodes = nodes
    .map((node) => ({
      node,
      connections: connectionCount.get(node.id) || 0,
    }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 5)
    .filter((h) => h.connections > 0);

  // Max depth calculation (simplified - just based on distance from nodes with no incoming edges)
  // This is a BFS from root nodes
  let maxDepth = 0;
  if (totalNodes > 0 && totalEdges > 0) {
    const incomingEdges = new Set(edges.map((e) => e.target_id));
    const rootNodes = nodes.filter((n) => !incomingEdges.has(n.id));
    
    // BFS to find max depth
    const visited = new Set<number>();
    const queue: { id: number; depth: number }[] = rootNodes.map((n) => ({ id: n.id, depth: 0 }));
    
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      maxDepth = Math.max(maxDepth, depth);
      
      // Find children
      edges
        .filter((e) => e.source_id === id)
        .forEach((e) => {
          if (!visited.has(e.target_id)) {
            queue.push({ id: e.target_id, depth: depth + 1 });
          }
        });
    }
  }

  return {
    totalNodes,
    totalEdges,
    uniqueDomains: domains.size,
    aliveNodes,
    deadNodes,
    favoriteNodes,
    avgConnectionsPerNode: Math.round(avgConnectionsPerNode * 100) / 100,
    graphDensity: Math.round(graphDensity * 10000) / 100, // Percentage
    maxDepth,
    orphanNodes,
    hubNodes,
  };
}

/**
 * Get dead links with details
 */
export function getDeadLinks(nodes: VoidNode[]): DeadLink[] {
  return nodes
    .filter((n) => !n.is_alive)
    .map((node) => ({
      node,
      domain: extractDomain(node.url),
      lastCrawled: node.last_crawled,
    }))
    .sort((a, b) => {
      // Sort by last crawled date (most recent first)
      if (!a.lastCrawled && !b.lastCrawled) return 0;
      if (!a.lastCrawled) return 1;
      if (!b.lastCrawled) return -1;
      return new Date(b.lastCrawled).getTime() - new Date(a.lastCrawled).getTime();
    });
}

/**
 * Get crawl activity summary
 */
export function getCrawlActivity(nodes: VoidNode[]): {
  crawledToday: number;
  crawledThisWeek: number;
  neverCrawled: number;
  lastCrawlTime: string | null;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  let crawledToday = 0;
  let crawledThisWeek = 0;
  let neverCrawled = 0;
  let lastCrawlTime: Date | null = null;

  for (const node of nodes) {
    if (!node.last_crawled) {
      neverCrawled++;
    } else {
      const crawlDate = new Date(node.last_crawled);
      if (crawlDate >= today) crawledToday++;
      if (crawlDate >= weekAgo) crawledThisWeek++;
      if (!lastCrawlTime || crawlDate > lastCrawlTime) {
        lastCrawlTime = crawlDate;
      }
    }
  }

  return {
    crawledToday,
    crawledThisWeek,
    neverCrawled,
    lastCrawlTime: lastCrawlTime ? lastCrawlTime.toISOString() : null,
  };
}
