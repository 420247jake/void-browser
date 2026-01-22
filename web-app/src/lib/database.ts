// Web demo version - no database, just in-memory storage
// This replaces the Tauri database implementation

import { VoidNode, VoidEdge } from "./types";

// In-memory storage for demo
let nodes: VoidNode[] = [];
let edges: VoidEdge[] = [];

export function useVoidDatabase() {
  return {
    nodes,
    edges,
    loading: false,
    error: null,
    addNode: async (url: string) => {
      console.log("Demo mode: addNode not implemented");
      return null;
    },
    addEdge: async (sourceId: number, targetId: number) => {
      console.log("Demo mode: addEdge not implemented");
      return null;
    },
    updateNodePosition: async (id: number, x: number, y: number, z: number) => {
      const node = nodes.find(n => n.id === id);
      if (node) {
        node.position_x = x;
        node.position_y = y;
        node.position_z = z;
      }
    },
    deleteNode: async (id: number) => {
      nodes = nodes.filter(n => n.id !== id);
      edges = edges.filter(e => e.source_id !== id && e.target_id !== id);
    },
    refreshData: async () => {},
  };
}

export function resetDbConnection() {
  // No-op for demo
}

export function getDbInstance() {
  return null;
}
