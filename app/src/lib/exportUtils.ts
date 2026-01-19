/**
 * Export/Import utilities for Void Browser
 * Supports JSON, CSV, and browser bookmark formats
 */

import { VoidNode, VoidEdge } from "./types";

// ==================== EXPORT FORMATS ====================

export interface ExportData {
  version: string;
  exportedAt: string;
  sessionName?: string;
  nodes: ExportNode[];
  edges: ExportEdge[];
  metadata: ExportMetadata;
}

export interface ExportNode {
  id: number;
  url: string;
  title: string;
  favicon?: string;
  position: { x: number; y: number; z: number };
  isAlive: boolean;
  isFavorite?: boolean;
  lastCrawled?: string;
  createdAt: string;
}

export interface ExportEdge {
  sourceId: number;
  targetId: number;
  sourceUrl?: string;
  targetUrl?: string;
}

export interface ExportMetadata {
  totalNodes: number;
  totalEdges: number;
  domains: string[];
  dateRange: { earliest: string; latest: string } | null;
}

// ==================== JSON EXPORT ====================

export function exportToJSON(
  nodes: VoidNode[],
  edges: VoidEdge[],
  sessionName?: string
): string {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  const exportData: ExportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    sessionName,
    nodes: nodes.map(n => ({
      id: n.id,
      url: n.url,
      title: n.title,
      favicon: n.favicon || undefined,
      position: { x: n.position_x, y: n.position_y, z: n.position_z },
      isAlive: n.is_alive,
      isFavorite: n.is_favorite || undefined,
      lastCrawled: n.last_crawled || undefined,
      createdAt: n.created_at,
    })),
    edges: edges.map(e => ({
      sourceId: e.source_id,
      targetId: e.target_id,
      sourceUrl: nodeMap.get(e.source_id)?.url,
      targetUrl: nodeMap.get(e.target_id)?.url,
    })),
    metadata: generateMetadata(nodes, edges),
  };
  
  return JSON.stringify(exportData, null, 2);
}

// ==================== CSV EXPORT ====================

export function exportNodesToCSV(nodes: VoidNode[]): string {
  const headers = [
    "id",
    "url",
    "title",
    "domain",
    "position_x",
    "position_y",
    "position_z",
    "is_alive",
    "is_favorite",
    "last_crawled",
    "created_at",
  ];
  
  const rows = nodes.map(n => {
    let domain = "";
    try {
      domain = new URL(n.url).hostname;
    } catch {}
    
    return [
      n.id,
      escapeCSV(n.url),
      escapeCSV(n.title),
      escapeCSV(domain),
      n.position_x.toFixed(2),
      n.position_y.toFixed(2),
      n.position_z.toFixed(2),
      n.is_alive ? "true" : "false",
      n.is_favorite ? "true" : "false",
      n.last_crawled || "",
      n.created_at,
    ].join(",");
  });
  
  return [headers.join(","), ...rows].join("\n");
}

export function exportEdgesToCSV(edges: VoidEdge[], nodes: VoidNode[]): string {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  const headers = ["source_id", "target_id", "source_url", "target_url"];
  
  const rows = edges.map(e => {
    const source = nodeMap.get(e.source_id);
    const target = nodeMap.get(e.target_id);
    return [
      e.source_id,
      e.target_id,
      escapeCSV(source?.url || ""),
      escapeCSV(target?.url || ""),
    ].join(",");
  });
  
  return [headers.join(","), ...rows].join("\n");
}

function escapeCSV(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ==================== METADATA GENERATION ====================

function generateMetadata(nodes: VoidNode[], edges: VoidEdge[]): ExportMetadata {
  const domains = new Set<string>();
  let earliest: Date | null = null;
  let latest: Date | null = null;
  
  for (const node of nodes) {
    try {
      domains.add(new URL(node.url).hostname);
    } catch {}
    
    const date = new Date(node.created_at);
    if (!earliest || date < earliest) earliest = date;
    if (!latest || date > latest) latest = date;
  }
  
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    domains: Array.from(domains).sort(),
    dateRange: earliest && latest ? {
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
    } : null,
  };
}

// ==================== BROWSER BOOKMARKS IMPORT ====================

export interface BookmarkItem {
  url: string;
  title: string;
  dateAdded?: number;
  folder?: string;
}

/**
 * Parse Chrome bookmarks JSON export
 * Chrome exports bookmarks as nested JSON with "children" arrays
 */
export function parseChromeBookmarks(jsonContent: string): BookmarkItem[] {
  const bookmarks: BookmarkItem[] = [];
  
  try {
    const data = JSON.parse(jsonContent);
    
    function traverse(node: any, folderPath: string = "") {
      if (node.type === "url" && node.url) {
        bookmarks.push({
          url: node.url,
          title: node.name || node.url,
          dateAdded: node.date_added ? parseInt(node.date_added) : undefined,
          folder: folderPath || undefined,
        });
      }
      
      if (node.children && Array.isArray(node.children)) {
        const newPath = folderPath 
          ? `${folderPath}/${node.name || "Folder"}`
          : node.name || "";
        
        for (const child of node.children) {
          traverse(child, newPath);
        }
      }
    }
    
    // Chrome has "roots" with "bookmark_bar", "other", "synced"
    if (data.roots) {
      for (const key of Object.keys(data.roots)) {
        traverse(data.roots[key], "");
      }
    } else {
      // Try direct traverse if format differs
      traverse(data, "");
    }
  } catch (err) {
    console.error("Failed to parse Chrome bookmarks:", err);
  }
  
  return bookmarks;
}

/**
 * Parse Firefox bookmarks HTML export
 * Firefox exports as HTML with nested DL/DT/DD tags
 */
export function parseFirefoxBookmarks(htmlContent: string): BookmarkItem[] {
  const bookmarks: BookmarkItem[] = [];
  
  // Simple regex-based parser for Firefox bookmark HTML
  const linkRegex = /<A[^>]+HREF="([^"]+)"[^>]*>([^<]*)<\/A>/gi;
  const folderRegex = /<H3[^>]*>([^<]*)<\/H3>/gi;
  
  let currentFolder = "";
  let lastIndex = 0;
  
  // Find all folder headers and links, maintaining order
  const combined: { type: "folder" | "link"; match: RegExpExecArray }[] = [];
  
  let match;
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    combined.push({ type: "link", match });
  }
  
  linkRegex.lastIndex = 0;
  while ((match = folderRegex.exec(htmlContent)) !== null) {
    combined.push({ type: "folder", match });
  }
  
  // Sort by position in document
  combined.sort((a, b) => a.match.index - b.match.index);
  
  for (const item of combined) {
    if (item.type === "folder") {
      currentFolder = item.match[1];
    } else {
      const url = item.match[1];
      const title = item.match[2] || url;
      
      // Skip internal firefox URLs
      if (url.startsWith("place:") || url.startsWith("javascript:")) {
        continue;
      }
      
      bookmarks.push({
        url,
        title,
        folder: currentFolder || undefined,
      });
    }
  }
  
  return bookmarks;
}

/**
 * Auto-detect and parse bookmark file
 */
export function parseBookmarks(content: string): BookmarkItem[] {
  const trimmed = content.trim();
  
  // Detect JSON (Chrome)
  if (trimmed.startsWith("{")) {
    return parseChromeBookmarks(content);
  }
  
  // Detect HTML (Firefox)
  if (trimmed.toLowerCase().includes("<!doctype") || trimmed.toLowerCase().includes("<html")) {
    return parseFirefoxBookmarks(content);
  }
  
  // Try JSON first, fall back to HTML
  try {
    return parseChromeBookmarks(content);
  } catch {
    return parseFirefoxBookmarks(content);
  }
}

// ==================== VOID SESSION IMPORT ====================

/**
 * Parse a Void Browser JSON export
 */
export function parseVoidExport(jsonContent: string): ExportData | null {
  try {
    const data = JSON.parse(jsonContent);
    
    // Validate structure
    if (!data.nodes || !Array.isArray(data.nodes)) {
      console.error("Invalid Void export: missing nodes array");
      return null;
    }
    
    return data as ExportData;
  } catch (err) {
    console.error("Failed to parse Void export:", err);
    return null;
  }
}

// ==================== MERGE UTILITIES ====================

export interface MergeResult {
  newNodes: ExportNode[];
  newEdges: ExportEdge[];
  duplicateUrls: string[];
  stats: {
    nodesAdded: number;
    nodesSkipped: number;
    edgesAdded: number;
    edgesSkipped: number;
  };
}

/**
 * Merge imported data with existing nodes, avoiding duplicates
 */
export function prepareMerge(
  existingNodes: VoidNode[],
  importNodes: ExportNode[],
  importEdges: ExportEdge[]
): MergeResult {
  const existingUrls = new Set(existingNodes.map(n => n.url.toLowerCase()));
  const duplicateUrls: string[] = [];
  const newNodes: ExportNode[] = [];
  
  // Track old->new ID mapping for edge remapping
  const idMap = new Map<number, number>();
  let nextId = Math.max(0, ...existingNodes.map(n => n.id)) + 1;
  
  for (const node of importNodes) {
    const urlLower = node.url.toLowerCase();
    
    if (existingUrls.has(urlLower)) {
      duplicateUrls.push(node.url);
      // Map to existing node
      const existing = existingNodes.find(n => n.url.toLowerCase() === urlLower);
      if (existing) {
        idMap.set(node.id, existing.id);
      }
    } else {
      idMap.set(node.id, nextId);
      newNodes.push({ ...node, id: nextId });
      existingUrls.add(urlLower);
      nextId++;
    }
  }
  
  // Remap and filter edges
  const existingEdgeSet = new Set<string>();
  const newEdges: ExportEdge[] = [];
  
  for (const edge of importEdges) {
    const newSourceId = idMap.get(edge.sourceId);
    const newTargetId = idMap.get(edge.targetId);
    
    if (newSourceId && newTargetId && newSourceId !== newTargetId) {
      const key = `${newSourceId}-${newTargetId}`;
      if (!existingEdgeSet.has(key)) {
        existingEdgeSet.add(key);
        newEdges.push({
          sourceId: newSourceId,
          targetId: newTargetId,
        });
      }
    }
  }
  
  return {
    newNodes,
    newEdges,
    duplicateUrls,
    stats: {
      nodesAdded: newNodes.length,
      nodesSkipped: duplicateUrls.length,
      edgesAdded: newEdges.length,
      edgesSkipped: importEdges.length - newEdges.length,
    },
  };
}
