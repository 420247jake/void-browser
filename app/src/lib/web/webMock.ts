/**
 * Web-compatible mock for Tauri APIs
 * This allows Void Browser to run in a browser without Tauri
 */

// Check if we're running in Tauri or web
export const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
export const isWebDemo = !isTauri;

// Sample demo data - pre-crawled sites for the demo
export const DEMO_SITES = [
  {
    id: 1,
    url: "https://jacobterrell.dev",
    title: "Jacob Terrell - Developer",
    domain: "jacobterrell.dev",
    favicon: "https://jacobterrell.dev/favicon.ico",
    screenshot: null,
    description: "Portfolio and projects by Jacob Terrell",
    depth: 0,
    crawled_at: new Date().toISOString(),
    position_x: 0,
    position_y: 0,
    position_z: 0,
  },
  {
    id: 2,
    url: "https://github.com/420247jake",
    title: "420247jake - GitHub",
    domain: "github.com",
    favicon: "https://github.com/favicon.ico",
    screenshot: null,
    description: "GitHub profile",
    depth: 1,
    crawled_at: new Date().toISOString(),
    position_x: 15,
    position_y: 5,
    position_z: -10,
  },
  {
    id: 3,
    url: "https://github.com/420247jake/void-browser",
    title: "Void Browser - GitHub",
    domain: "github.com",
    favicon: "https://github.com/favicon.ico",
    screenshot: null,
    description: "3D Spatial Web Browser",
    depth: 2,
    crawled_at: new Date().toISOString(),
    position_x: 25,
    position_y: 10,
    position_z: -5,
  },
  {
    id: 4,
    url: "https://autohub.blue",
    title: "AutoHub - Discord Bot",
    domain: "autohub.blue",
    favicon: "https://autohub.blue/favicon.ico",
    screenshot: null,
    description: "Discord Bot Management Platform",
    depth: 1,
    crawled_at: new Date().toISOString(),
    position_x: -20,
    position_y: -5,
    position_z: 15,
  },
  {
    id: 5,
    url: "https://discord.com",
    title: "Discord",
    domain: "discord.com",
    favicon: "https://discord.com/favicon.ico",
    screenshot: null,
    description: "Chat platform",
    depth: 2,
    crawled_at: new Date().toISOString(),
    position_x: -30,
    position_y: 0,
    position_z: 25,
  },
  {
    id: 6,
    url: "https://react.dev",
    title: "React",
    domain: "react.dev",
    favicon: "https://react.dev/favicon.ico",
    screenshot: null,
    description: "The library for web and native user interfaces",
    depth: 1,
    crawled_at: new Date().toISOString(),
    position_x: 10,
    position_y: -15,
    position_z: 20,
  },
  {
    id: 7,
    url: "https://threejs.org",
    title: "Three.js",
    domain: "threejs.org",
    favicon: "https://threejs.org/favicon.ico",
    screenshot: null,
    description: "JavaScript 3D library",
    depth: 1,
    crawled_at: new Date().toISOString(),
    position_x: -10,
    position_y: 20,
    position_z: -25,
  },
  {
    id: 8,
    url: "https://tauri.app",
    title: "Tauri",
    domain: "tauri.app",
    favicon: "https://tauri.app/favicon.ico",
    screenshot: null,
    description: "Build desktop apps with web technologies",
    depth: 1,
    crawled_at: new Date().toISOString(),
    position_x: 30,
    position_y: -10,
    position_z: -15,
  },
  {
    id: 9,
    url: "https://rust-lang.org",
    title: "Rust Programming Language",
    domain: "rust-lang.org",
    favicon: "https://rust-lang.org/favicon.ico",
    screenshot: null,
    description: "Reliable and efficient software",
    depth: 2,
    crawled_at: new Date().toISOString(),
    position_x: 40,
    position_y: 0,
    position_z: -20,
  },
  {
    id: 10,
    url: "https://cloudflare.com",
    title: "Cloudflare",
    domain: "cloudflare.com",
    favicon: "https://cloudflare.com/favicon.ico",
    screenshot: null,
    description: "Web performance & security",
    depth: 2,
    crawled_at: new Date().toISOString(),
    position_x: -40,
    position_y: 15,
    position_z: 10,
  },
];

// Demo edges connecting the sites
export const DEMO_EDGES = [
  { from_id: 1, to_id: 2 },  // jacobterrell.dev -> github
  { from_id: 1, to_id: 4 },  // jacobterrell.dev -> autohub
  { from_id: 1, to_id: 6 },  // jacobterrell.dev -> react
  { from_id: 1, to_id: 7 },  // jacobterrell.dev -> threejs
  { from_id: 1, to_id: 8 },  // jacobterrell.dev -> tauri
  { from_id: 2, to_id: 3 },  // github -> void-browser repo
  { from_id: 4, to_id: 5 },  // autohub -> discord
  { from_id: 8, to_id: 9 },  // tauri -> rust
  { from_id: 3, to_id: 6 },  // void-browser -> react
  { from_id: 3, to_id: 7 },  // void-browser -> threejs
  { from_id: 3, to_id: 8 },  // void-browser -> tauri
  { from_id: 1, to_id: 10 }, // jacobterrell.dev -> cloudflare
];

// LocalStorage keys
const STORAGE_KEYS = {
  SITES: 'void-browser-demo-sites',
  EDGES: 'void-browser-demo-edges',
};

// Get sites from localStorage or use demo data
export function getStoredSites(): typeof DEMO_SITES {
  if (typeof localStorage === 'undefined') return DEMO_SITES;
  const stored = localStorage.getItem(STORAGE_KEYS.SITES);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEMO_SITES;
    }
  }
  // Initialize with demo data
  localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(DEMO_SITES));
  return DEMO_SITES;
}

// Get edges from localStorage or use demo data
export function getStoredEdges(): typeof DEMO_EDGES {
  if (typeof localStorage === 'undefined') return DEMO_EDGES;
  const stored = localStorage.getItem(STORAGE_KEYS.EDGES);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEMO_EDGES;
    }
  }
  // Initialize with demo data
  localStorage.setItem(STORAGE_KEYS.EDGES, JSON.stringify(DEMO_EDGES));
  return DEMO_EDGES;
}

// Save sites to localStorage
export function saveSites(sites: typeof DEMO_SITES) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(sites));
}

// Save edges to localStorage
export function saveEdges(edges: typeof DEMO_EDGES) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.EDGES, JSON.stringify(edges));
}

// Reset to demo data
export function resetToDemo() {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(DEMO_SITES));
  localStorage.setItem(STORAGE_KEYS.EDGES, JSON.stringify(DEMO_EDGES));
}

// Mini crawl - fetches basic metadata for a URL (limited in browser)
export async function miniCrawl(url: string): Promise<{
  url: string;
  title: string;
  domain: string;
  favicon: string;
  description: string;
}> {
  // Extract domain
  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    throw new Error('Invalid URL');
  }
  
  // We can't actually crawl due to CORS, but we can construct basic info
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  
  return {
    url,
    title: domain,
    domain,
    favicon,
    description: `Added from web demo`,
  };
}
