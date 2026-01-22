// Database types
export interface VoidNode {
  id: number;
  url: string;
  title: string;
  favicon: string | null;
  screenshot: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  is_alive: boolean;
  is_favorite?: boolean;
  last_crawled: string | null;
  created_at: string;
}

export interface VoidEdge {
  id: number;
  source_id: number;
  target_id: number;
}

export interface NodePosition {
  id: number;
  position: [number, number, number];
}

// Convert DB node to display format
export function nodeToDisplay(node: VoidNode): {
  id: string;
  url: string;
  title: string;
  position: [number, number, number];
  isAlive: boolean;
  favicon?: string;
  lastCrawled?: string;
} {
  return {
    id: String(node.id),
    url: node.url,
    title: node.title || new URL(node.url).hostname,
    position: [node.position_x, node.position_y, node.position_z],
    isAlive: node.is_alive,
    favicon: node.favicon || undefined,
    lastCrawled: node.last_crawled || undefined,
  };
}
