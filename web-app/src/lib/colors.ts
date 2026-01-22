// Domain color generation - consistent colors for each domain

// Vibrant color palette for domains
const DOMAIN_COLORS = [
  "#4fc3f7", // cyan (default)
  "#f06292", // pink
  "#ba68c8", // purple
  "#81c784", // green
  "#ffb74d", // orange
  "#64b5f6", // blue
  "#ff8a65", // coral
  "#aed581", // lime
  "#4dd0e1", // teal
  "#dce775", // yellow-green
  "#7986cb", // indigo
  "#a1887f", // brown
  "#90a4ae", // blue-grey
  "#e57373", // red
  "#fff176", // yellow
];

// Cache domain -> color mapping for consistency
const domainColorCache = new Map<string, string>();
let colorIndex = 0;

export function getDomainColor(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const baseDomain = domain.split('.').slice(-2).join('.'); // e.g., "discord.com"
    
    if (domainColorCache.has(baseDomain)) {
      return domainColorCache.get(baseDomain)!;
    }
    
    // Assign next color in palette
    const color = DOMAIN_COLORS[colorIndex % DOMAIN_COLORS.length];
    domainColorCache.set(baseDomain, color);
    colorIndex++;
    
    return color;
  } catch {
    return DOMAIN_COLORS[0]; // Default cyan
  }
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Reset cache (useful when loading new data)
export function resetDomainColors() {
  domainColorCache.clear();
  colorIndex = 0;
}

// Get all assigned colors (for legend/debugging)
export function getDomainColorMap(): Map<string, string> {
  return new Map(domainColorCache);
}
