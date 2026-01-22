/**
 * Web-compatible database adapter
 * Uses localStorage instead of SQLite for the web demo
 */

import { isWebDemo, getStoredSites, getStoredEdges, saveSites, saveEdges, miniCrawl, DEMO_SITES, DEMO_EDGES } from './webMock';

export interface Site {
  id: number;
  url: string;
  title: string;
  domain: string;
  favicon: string | null;
  screenshot: string | null;
  description: string | null;
  depth: number;
  crawled_at: string;
  position_x: number;
  position_y: number;
  position_z: number;
}

export interface Edge {
  from_id: number;
  to_id: number;
}

// In-memory state for web demo
let sites: Site[] = [];
let edges: Edge[] = [];
let nextId = 100;
let initialized = false;

// Initialize from localStorage
function init() {
  if (initialized) return;
  sites = getStoredSites() as Site[];
  edges = getStoredEdges() as Edge[];
  nextId = Math.max(...sites.map(s => s.id), 100) + 1;
  initialized = true;
}

// Web database adapter
export const webDatabase = {
  // Get all sites
  async getAllSites(): Promise<Site[]> {
    init();
    return [...sites];
  },

  // Get all edges
  async getAllEdges(): Promise<Edge[]> {
    init();
    return [...edges];
  },

  // Add a new site
  async addSite(url: string): Promise<Site> {
    init();
    
    // Check if already exists
    const existing = sites.find(s => s.url === url);
    if (existing) return existing;

    // Mini crawl to get metadata
    const metadata = await miniCrawl(url);
    
    // Generate random position
    const position_x = (Math.random() - 0.5) * 80;
    const position_y = (Math.random() - 0.5) * 40;
    const position_z = (Math.random() - 0.5) * 80;

    const newSite: Site = {
      id: nextId++,
      url: metadata.url,
      title: metadata.title,
      domain: metadata.domain,
      favicon: metadata.favicon,
      screenshot: null,
      description: metadata.description,
      depth: 0,
      crawled_at: new Date().toISOString(),
      position_x,
      position_y,
      position_z,
    };

    sites.push(newSite);
    saveSites(sites);
    
    return newSite;
  },

  // Add an edge between sites
  async addEdge(fromId: number, toId: number): Promise<void> {
    init();
    
    // Check if edge already exists
    const exists = edges.some(e => 
      (e.from_id === fromId && e.to_id === toId) ||
      (e.from_id === toId && e.to_id === fromId)
    );
    
    if (!exists) {
      edges.push({ from_id: fromId, to_id: toId });
      saveEdges(edges);
    }
  },

  // Delete a site
  async deleteSite(id: number): Promise<void> {
    init();
    sites = sites.filter(s => s.id !== id);
    edges = edges.filter(e => e.from_id !== id && e.to_id !== id);
    saveSites(sites);
    saveEdges(edges);
  },

  // Update site position
  async updatePosition(id: number, x: number, y: number, z: number): Promise<void> {
    init();
    const site = sites.find(s => s.id === id);
    if (site) {
      site.position_x = x;
      site.position_y = y;
      site.position_z = z;
      saveSites(sites);
    }
  },

  // Reset to demo data
  async resetDemo(): Promise<void> {
    sites = [...DEMO_SITES] as Site[];
    edges = [...DEMO_EDGES] as Edge[];
    nextId = Math.max(...sites.map(s => s.id), 100) + 1;
    saveSites(sites);
    saveEdges(edges);
  },

  // Search sites
  async searchSites(query: string): Promise<Site[]> {
    init();
    const q = query.toLowerCase();
    return sites.filter(s => 
      s.url.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      s.domain.toLowerCase().includes(q)
    );
  },

  // Get stats
  async getStats(): Promise<{
    totalSites: number;
    totalEdges: number;
    domains: string[];
  }> {
    init();
    const domains = [...new Set(sites.map(s => s.domain))];
    return {
      totalSites: sites.length,
      totalEdges: edges.length,
      domains,
    };
  },
};
