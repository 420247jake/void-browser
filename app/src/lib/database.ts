import { useState, useEffect, useCallback } from "react";
import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { VoidNode, VoidEdge } from "./types";

let db: Database | null = null;

// Reset the database connection (call when switching sessions)
export async function resetDbConnection(): Promise<void> {
  console.log("resetDbConnection called, db exists:", !!db);
  if (db) {
    try {
      console.log("Closing database connection...");
      await db.close();
      console.log("Database connection closed");
    } catch (err) {
      console.warn("Failed to close database:", err);
    }
    db = null;
    // Give the OS a moment to release the file handle
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function getDb(): Promise<Database> {
  if (db) return db;
  
  // Initialize database path
  const dbPath = await invoke<string>("init_database");
  console.log("Database path:", dbPath);
  
  // Connect to SQLite
  db = await Database.load(`sqlite:${dbPath}`);
  
  // Create tables if they don't exist
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      favicon TEXT,
      screenshot TEXT,
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      position_z REAL NOT NULL DEFAULT 0,
      is_alive INTEGER NOT NULL DEFAULT 1,
      last_crawled TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE,
      UNIQUE(source_id, target_id)
    )
  `);
  
  // Create index for faster lookups
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)`);
  
  console.log("Database initialized");
  return db;
}

// Generate random position for new nodes
function randomPosition(): [number, number, number] {
  return [
    (Math.random() - 0.5) * 40,
    (Math.random() - 0.5) * 30,
    (Math.random() - 0.5) * 40,
  ];
}

// Hook to manage void database
export function useVoidDatabase() {
  const [nodes, setNodes] = useState<VoidNode[]>([]);
  const [edges, setEdges] = useState<VoidEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all nodes and edges
  const loadData = useCallback(async (forceReconnect = false) => {
    try {
      setLoading(true);
      
      // Reset connection if switching sessions
      if (forceReconnect) {
        await resetDbConnection();
      }
      
      const database = await getDb();
      
      const nodeRows = await database.select<VoidNode[]>("SELECT * FROM nodes ORDER BY created_at DESC");
      const edgeRows = await database.select<VoidEdge[]>("SELECT * FROM edges");
      
      setNodes(nodeRows);
      setEdges(edgeRows);
      setError(null);
    } catch (err) {
      console.error("Failed to load data:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Add a new node
  const addNode = useCallback(async (url: string, title?: string): Promise<VoidNode | null> => {
    try {
      const database = await getDb();
      const [x, y, z] = randomPosition();
      
      // Extract title from URL if not provided
      const nodeTitle = title || new URL(url).hostname;
      
      const result = await database.execute(
        `INSERT INTO nodes (url, title, position_x, position_y, position_z) 
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET title = excluded.title`,
        [url, nodeTitle, x, y, z]
      );
      
      // Fetch the inserted/updated node
      const [node] = await database.select<VoidNode[]>(
        "SELECT * FROM nodes WHERE url = ?",
        [url]
      );
      
      if (node) {
        setNodes(prev => {
          const exists = prev.find(n => n.id === node.id);
          if (exists) {
            return prev.map(n => n.id === node.id ? node : n);
          }
          return [node, ...prev];
        });
        return node;
      }
      return null;
    } catch (err) {
      console.error("Failed to add node:", err);
      setError(String(err));
      return null;
    }
  }, []);

  // Add an edge between nodes
  const addEdge = useCallback(async (sourceId: number, targetId: number): Promise<boolean> => {
    try {
      const database = await getDb();
      
      await database.execute(
        `INSERT OR IGNORE INTO edges (source_id, target_id) VALUES (?, ?)`,
        [sourceId, targetId]
      );
      
      // Reload edges
      const edgeRows = await database.select<VoidEdge[]>("SELECT * FROM edges");
      setEdges(edgeRows);
      
      return true;
    } catch (err) {
      console.error("Failed to add edge:", err);
      return false;
    }
  }, []);

  // Update node position
  const updateNodePosition = useCallback(async (
    id: number, 
    x: number, 
    y: number, 
    z: number
  ): Promise<boolean> => {
    try {
      const database = await getDb();
      
      await database.execute(
        `UPDATE nodes SET position_x = ?, position_y = ?, position_z = ? WHERE id = ?`,
        [x, y, z, id]
      );
      
      setNodes(prev => prev.map(n => 
        n.id === id ? { ...n, position_x: x, position_y: y, position_z: z } : n
      ));
      
      return true;
    } catch (err) {
      console.error("Failed to update position:", err);
      return false;
    }
  }, []);

  // Update node after crawling
  const updateNodeCrawlData = useCallback(async (
    id: number,
    data: { title?: string; favicon?: string; screenshot?: string; isAlive?: boolean }
  ): Promise<boolean> => {
    try {
      const database = await getDb();
      
      const updates: string[] = [];
      const values: any[] = [];
      
      if (data.title !== undefined) {
        updates.push("title = ?");
        values.push(data.title);
      }
      if (data.favicon !== undefined) {
        updates.push("favicon = ?");
        values.push(data.favicon);
      }
      if (data.screenshot !== undefined) {
        updates.push("screenshot = ?");
        values.push(data.screenshot);
      }
      if (data.isAlive !== undefined) {
        updates.push("is_alive = ?");
        values.push(data.isAlive ? 1 : 0);
      }
      
      updates.push("last_crawled = datetime('now')");
      values.push(id);
      
      await database.execute(
        `UPDATE nodes SET ${updates.join(", ")} WHERE id = ?`,
        values
      );
      
      // Reload the node
      const [node] = await database.select<VoidNode[]>(
        "SELECT * FROM nodes WHERE id = ?",
        [id]
      );
      
      if (node) {
        setNodes(prev => prev.map(n => n.id === id ? node : n));
      }
      
      return true;
    } catch (err) {
      console.error("Failed to update crawl data:", err);
      return false;
    }
  }, []);

  // Delete a node
  const deleteNode = useCallback(async (id: number): Promise<boolean> => {
    try {
      const database = await getDb();
      
      await database.execute("DELETE FROM edges WHERE source_id = ? OR target_id = ?", [id, id]);
      await database.execute("DELETE FROM nodes WHERE id = ?", [id]);
      
      setNodes(prev => prev.filter(n => n.id !== id));
      setEdges(prev => prev.filter(e => e.source_id !== id && e.target_id !== id));
      
      return true;
    } catch (err) {
      console.error("Failed to delete node:", err);
      return false;
    }
  }, []);

  // Seed with sample data if empty
  const seedSampleData = useCallback(async () => {
    try {
      const database = await getDb();
      
      const [{ count }] = await database.select<[{ count: number }]>(
        "SELECT COUNT(*) as count FROM nodes"
      );
      
      if (count > 0) {
        console.log("Database already has data, skipping seed");
        return;
      }
      
      console.log("Seeding sample data...");
      
      const sampleSites = [
        { url: "https://github.com", title: "GitHub" },
        { url: "https://stackoverflow.com", title: "Stack Overflow" },
        { url: "https://news.ycombinator.com", title: "Hacker News" },
        { url: "https://reddit.com", title: "Reddit" },
        { url: "https://wikipedia.org", title: "Wikipedia" },
        { url: "https://youtube.com", title: "YouTube" },
        { url: "https://discord.com", title: "Discord" },
        { url: "https://twitter.com", title: "Twitter" },
      ];
      
      const nodeIds: number[] = [];
      
      for (const site of sampleSites) {
        const node = await addNode(site.url, site.title);
        if (node) nodeIds.push(node.id);
      }
      
      // Create some connections
      if (nodeIds.length >= 4) {
        await addEdge(nodeIds[0], nodeIds[1]); // github -> stackoverflow
        await addEdge(nodeIds[0], nodeIds[2]); // github -> hackernews
        await addEdge(nodeIds[1], nodeIds[2]); // stackoverflow -> hackernews
        await addEdge(nodeIds[2], nodeIds[3]); // hackernews -> reddit
        await addEdge(nodeIds[3], nodeIds[4]); // reddit -> wikipedia
        await addEdge(nodeIds[4], nodeIds[5]); // wikipedia -> youtube
        await addEdge(nodeIds[5], nodeIds[6]); // youtube -> discord
        await addEdge(nodeIds[6], nodeIds[7]); // discord -> twitter
        await addEdge(nodeIds[0], nodeIds[6]); // github -> discord
        await addEdge(nodeIds[1], nodeIds[3]); // stackoverflow -> reddit
      }
      
      await loadData();
      console.log("Sample data seeded");
    } catch (err) {
      console.error("Failed to seed data:", err);
    }
  }, [addNode, addEdge, loadData]);

  // Initialize on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    nodes,
    edges,
    loading,
    error,
    addNode,
    addEdge,
    updateNodePosition,
    updateNodeCrawlData,
    deleteNode,
    seedSampleData,
    reload: loadData,
    // Use this when switching sessions to force a fresh connection
    reloadWithReconnect: () => loadData(true),
  };
}
