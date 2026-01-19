// SQLite storage layer for Void Browser

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import type { VoidNode, VoidEdge } from './types.js';

export class VoidStorage {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.init();
  }

  /**
   * Initialize database schema
   */
  private init(): void {
    this.db.exec(`
      -- Nodes table (websites)
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        normalized_url TEXT,
        domain TEXT,
        title TEXT,
        description TEXT,
        favicon TEXT,
        thumbnail BLOB,
        position_x REAL DEFAULT 0,
        position_y REAL DEFAULT 0,
        position_z REAL DEFAULT 0,
        status_code INTEGER,
        is_alive INTEGER DEFAULT 1,
        depth INTEGER DEFAULT 0,
        crawled_at TEXT,
        last_visited TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Edges table (links between nodes)
      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        target_url TEXT NOT NULL,
        target_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES nodes(id)
      );

      -- Metadata table
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_nodes_domain ON nodes(domain);
      CREATE INDEX IF NOT EXISTS idx_nodes_normalized ON nodes(normalized_url);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_url);
      CREATE INDEX IF NOT EXISTS idx_edges_target_id ON edges(target_id);
    `);

    // Set metadata
    this.setMeta('version', '1.0.0');
    this.setMeta('created_at', new Date().toISOString());
  }

  // ============ NODE OPERATIONS ============

  /**
   * Insert a new node
   */
  insertNode(node: Omit<VoidNode, 'id' | 'createdAt'>): string {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO nodes (
        id, url, normalized_url, domain, title, description,
        favicon, thumbnail, position_x, position_y, position_z,
        status_code, is_alive, depth, crawled_at, last_visited
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      id,
      node.url,
      node.normalizedUrl,
      node.domain,
      node.title,
      node.description,
      node.favicon,
      node.thumbnail,
      node.positionX,
      node.positionY,
      node.positionZ,
      node.statusCode,
      node.isAlive ? 1 : 0,
      node.depth,
      node.crawledAt,
      node.lastVisited
    );

    return id;
  }

  /**
   * Get node by ID
   */
  getNode(id: string): VoidNode | null {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.rowToNode(row) : null;
  }

  /**
   * Get node by URL
   */
  getNodeByUrl(url: string): VoidNode | null {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE url = ?');
    const row = stmt.get(url) as any;
    return row ? this.rowToNode(row) : null;
  }

  /**
   * Get node by normalized URL
   */
  getNodeByNormalizedUrl(normalizedUrl: string): VoidNode | null {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE normalized_url = ?');
    const row = stmt.get(normalizedUrl) as any;
    return row ? this.rowToNode(row) : null;
  }

  /**
   * Check if URL already exists
   */
  hasUrl(normalizedUrl: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM nodes WHERE normalized_url = ?');
    return !!stmt.get(normalizedUrl);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): VoidNode[] {
    const stmt = this.db.prepare('SELECT * FROM nodes ORDER BY crawled_at DESC');
    return stmt.all().map((row: any) => this.rowToNode(row));
  }

  /**
   * Get nodes by domain
   */
  getNodesByDomain(domain: string): VoidNode[] {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE domain = ?');
    return stmt.all(domain).map((row: any) => this.rowToNode(row));
  }

  /**
   * Update node position
   */
  updatePosition(id: string, x: number, y: number, z: number): void {
    const stmt = this.db.prepare(`
      UPDATE nodes SET position_x = ?, position_y = ?, position_z = ?
      WHERE id = ?
    `);
    stmt.run(x, y, z, id);
  }

  /**
   * Update last visited timestamp
   */
  updateLastVisited(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE nodes SET last_visited = ? WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), id);
  }

  /**
   * Get node count
   */
  getNodeCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM nodes');
    return (stmt.get() as any).count;
  }

  /**
   * Get unique domain count
   */
  getDomainCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(DISTINCT domain) as count FROM nodes');
    return (stmt.get() as any).count;
  }

  // ============ EDGE OPERATIONS ============

  /**
   * Insert an edge (link between nodes)
   */
  insertEdge(sourceId: string, targetUrl: string, targetId?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO edges (source_id, target_url, target_id)
      VALUES (?, ?, ?)
    `);
    stmt.run(sourceId, targetUrl, targetId || null);
  }

  /**
   * Update edge target_id when node is crawled
   */
  updateEdgeTargets(targetUrl: string, targetId: string): void {
    const stmt = this.db.prepare(`
      UPDATE edges SET target_id = ? WHERE target_url = ?
    `);
    stmt.run(targetId, targetUrl);
  }

  /**
   * Get outbound edges from a node
   */
  getOutboundEdges(sourceId: string): VoidEdge[] {
    const stmt = this.db.prepare('SELECT * FROM edges WHERE source_id = ?');
    return stmt.all(sourceId) as VoidEdge[];
  }

  /**
   * Get inbound edges to a node
   */
  getInboundEdges(targetId: string): VoidEdge[] {
    const stmt = this.db.prepare('SELECT * FROM edges WHERE target_id = ?');
    return stmt.all(targetId) as VoidEdge[];
  }

  /**
   * Get all edges
   */
  getAllEdges(): VoidEdge[] {
    const stmt = this.db.prepare('SELECT * FROM edges');
    return stmt.all() as VoidEdge[];
  }

  /**
   * Get edge count
   */
  getEdgeCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM edges');
    return (stmt.get() as any).count;
  }

  // ============ METADATA ============

  /**
   * Set metadata value
   */
  setMeta(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)
    `);
    stmt.run(key, value);
  }

  /**
   * Get metadata value
   */
  getMeta(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM metadata WHERE key = ?');
    const row = stmt.get(key) as any;
    return row ? row.value : null;
  }

  // ============ UTILITIES ============

  /**
   * Convert database row to VoidNode
   */
  private rowToNode(row: any): VoidNode {
    return {
      id: row.id,
      url: row.url,
      normalizedUrl: row.normalized_url,
      domain: row.domain,
      title: row.title,
      description: row.description,
      favicon: row.favicon,
      thumbnail: row.thumbnail,
      positionX: row.position_x,
      positionY: row.position_y,
      positionZ: row.position_z,
      statusCode: row.status_code,
      isAlive: !!row.is_alive,
      depth: row.depth,
      crawledAt: row.crawled_at,
      lastVisited: row.last_visited,
      createdAt: row.created_at
    };
  }

  /**
   * Get database path
   */
  getPath(): string {
    return this.dbPath;
  }

  /**
   * Get stats
   */
  getStats(): { nodes: number; edges: number; domains: number } {
    return {
      nodes: this.getNodeCount(),
      edges: this.getEdgeCount(),
      domains: this.getDomainCount()
    };
  }

  /**
   * Clear all data (reset void)
   */
  clear(): void {
    this.db.exec('DELETE FROM edges');
    this.db.exec('DELETE FROM nodes');
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Create a new void database
 */
export function createVoid(name: string, directory: string = './voids'): VoidStorage {
  const dbPath = path.join(directory, `${name}.db`);
  return new VoidStorage(dbPath);
}

/**
 * Open an existing void database
 */
export function openVoid(dbPath: string): VoidStorage {
  return new VoidStorage(dbPath);
}
