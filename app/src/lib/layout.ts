/**
 * Layout algorithms for positioning nodes in 3D space
 */

import { VoidNode, VoidEdge } from "./types";

export type LayoutMode = "random" | "force" | "cluster" | "depth";

export interface LayoutOptions {
  mode: LayoutMode;
  // Force-directed options
  iterations?: number;
  springLength?: number;
  springStrength?: number;
  repulsionStrength?: number;
  damping?: number;
  // Cluster options
  clusterSpacing?: number;
  nodeSpacing?: number;
  // Depth options
  shellRadius?: number;
  shellSpacing?: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  mode: "random",
  iterations: 100,
  springLength: 15,
  springStrength: 0.1,
  repulsionStrength: 500,
  damping: 0.9,
  clusterSpacing: 40,
  nodeSpacing: 8,
  shellRadius: 20,
  shellSpacing: 15,
};

interface NodePosition {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Calculate new positions for all nodes based on layout mode
 */
export function calculateLayout(
  nodes: VoidNode[],
  edges: VoidEdge[],
  options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS
): Map<number, [number, number, number]> {
  switch (options.mode) {
    case "force":
      return forceDirectedLayout(nodes, edges, options);
    case "cluster":
      return clusterLayout(nodes, options);
    case "depth":
      return depthShellLayout(nodes, edges, options);
    case "random":
    default:
      return randomLayout(nodes);
  }
}

/**
 * Random layout - scatter nodes randomly in 3D space
 */
function randomLayout(nodes: VoidNode[]): Map<number, [number, number, number]> {
  const positions = new Map<number, [number, number, number]>();
  const spread = Math.max(30, nodes.length * 2);
  
  nodes.forEach(node => {
    positions.set(node.id, [
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
    ]);
  });
  
  return positions;
}

/**
 * Force-directed layout using spring/repulsion simulation
 */
function forceDirectedLayout(
  nodes: VoidNode[],
  edges: VoidEdge[],
  options: LayoutOptions
): Map<number, [number, number, number]> {
  const {
    iterations = 100,
    springLength = 15,
    springStrength = 0.1,
    repulsionStrength = 500,
    damping = 0.9,
  } = options;

  // Initialize positions with current or random
  const positions: NodePosition[] = nodes.map(node => ({
    id: node.id,
    x: node.position_x || (Math.random() - 0.5) * 50,
    y: node.position_y || (Math.random() - 0.5) * 50,
    z: node.position_z || (Math.random() - 0.5) * 50,
    vx: 0,
    vy: 0,
    vz: 0,
  }));

  const posMap = new Map(positions.map(p => [p.id, p]));

  // Build adjacency for quick lookup
  const adjacency = new Map<number, Set<number>>();
  edges.forEach(edge => {
    if (!adjacency.has(edge.source_id)) adjacency.set(edge.source_id, new Set());
    if (!adjacency.has(edge.target_id)) adjacency.set(edge.target_id, new Set());
    adjacency.get(edge.source_id)!.add(edge.target_id);
    adjacency.get(edge.target_id)!.add(edge.source_id);
  });

  // Simulation loop
  for (let iter = 0; iter < iterations; iter++) {
    const temperature = 1 - iter / iterations; // Cooling

    // Calculate repulsion between all pairs
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
        
        // Repulsion force (inverse square)
        const force = (repulsionStrength / (dist * dist)) * temperature;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        
        a.vx -= fx;
        a.vy -= fy;
        a.vz -= fz;
        b.vx += fx;
        b.vy += fy;
        b.vz += fz;
      }
    }

    // Calculate spring forces for connected nodes
    edges.forEach(edge => {
      const a = posMap.get(edge.source_id);
      const b = posMap.get(edge.target_id);
      if (!a || !b) return;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
      
      // Spring force (Hooke's law)
      const displacement = dist - springLength;
      const force = displacement * springStrength * temperature;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      
      a.vx += fx;
      a.vy += fy;
      a.vz += fz;
      b.vx -= fx;
      b.vy -= fy;
      b.vz -= fz;
    });

    // Apply velocities and damping
    positions.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vx *= damping;
      p.vy *= damping;
      p.vz *= damping;
    });
  }

  // Convert to output format
  const result = new Map<number, [number, number, number]>();
  positions.forEach(p => {
    result.set(p.id, [p.x, p.y, p.z]);
  });
  
  return result;
}

/**
 * Cluster layout - group nodes by domain
 */
function clusterLayout(
  nodes: VoidNode[],
  options: LayoutOptions
): Map<number, [number, number, number]> {
  const { clusterSpacing = 40, nodeSpacing = 8 } = options;
  
  // Group by domain
  const clusters = new Map<string, VoidNode[]>();
  nodes.forEach(node => {
    const domain = getDomain(node.url);
    if (!clusters.has(domain)) clusters.set(domain, []);
    clusters.get(domain)!.push(node);
  });

  const positions = new Map<number, [number, number, number]>();
  const clusterCount = clusters.size;
  let clusterIndex = 0;

  // Position clusters in a sphere pattern
  clusters.forEach((clusterNodes, _domain) => {
    // Cluster center using golden angle for even distribution
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const theta = goldenAngle * clusterIndex;
    const phi = Math.acos(1 - (2 * (clusterIndex + 0.5)) / clusterCount);
    
    const clusterRadius = clusterSpacing * Math.cbrt(clusterCount);
    const cx = clusterRadius * Math.sin(phi) * Math.cos(theta);
    const cy = clusterRadius * Math.sin(phi) * Math.sin(theta);
    const cz = clusterRadius * Math.cos(phi);

    // Position nodes within cluster in a smaller sphere
    clusterNodes.forEach((node, nodeIndex) => {
      const nodeTheta = goldenAngle * nodeIndex;
      const nodePhi = Math.acos(1 - (2 * (nodeIndex + 0.5)) / clusterNodes.length);
      const nodeRadius = nodeSpacing * Math.cbrt(clusterNodes.length);
      
      const x = cx + nodeRadius * Math.sin(nodePhi) * Math.cos(nodeTheta);
      const y = cy + nodeRadius * Math.sin(nodePhi) * Math.sin(nodeTheta);
      const z = cz + nodeRadius * Math.cos(nodePhi);
      
      positions.set(node.id, [x, y, z]);
    });

    clusterIndex++;
  });

  return positions;
}

/**
 * Depth shell layout - organize by crawl depth in concentric shells
 */
function depthShellLayout(
  nodes: VoidNode[],
  edges: VoidEdge[],
  options: LayoutOptions
): Map<number, [number, number, number]> {
  const { shellRadius = 20, shellSpacing = 15 } = options;
  
  // Calculate depth from seed nodes (nodes with no incoming edges)
  const incomingEdges = new Map<number, number[]>();
  const outgoingEdges = new Map<number, number[]>();
  
  nodes.forEach(n => {
    incomingEdges.set(n.id, []);
    outgoingEdges.set(n.id, []);
  });
  
  edges.forEach(e => {
    incomingEdges.get(e.target_id)?.push(e.source_id);
    outgoingEdges.get(e.source_id)?.push(e.target_id);
  });

  // Find seed nodes (no incoming edges or marked as seed)
  const seeds = nodes.filter(n => 
    (incomingEdges.get(n.id)?.length || 0) === 0
  );
  
  // BFS to assign depths
  const depths = new Map<number, number>();
  const queue: { id: number; depth: number }[] = [];
  
  // Start from seeds at depth 0, or all nodes if no clear seeds
  if (seeds.length > 0) {
    seeds.forEach(s => {
      depths.set(s.id, 0);
      queue.push({ id: s.id, depth: 0 });
    });
  } else {
    // No clear seeds - use first node
    const first = nodes[0];
    if (first) {
      depths.set(first.id, 0);
      queue.push({ id: first.id, depth: 0 });
    }
  }

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const targets = outgoingEdges.get(id) || [];
    
    targets.forEach(targetId => {
      if (!depths.has(targetId)) {
        depths.set(targetId, depth + 1);
        queue.push({ id: targetId, depth: depth + 1 });
      }
    });
  }

  // Assign remaining unvisited nodes to max depth + 1
  const maxDepth = Math.max(0, ...depths.values());
  nodes.forEach(n => {
    if (!depths.has(n.id)) {
      depths.set(n.id, maxDepth + 1);
    }
  });

  // Group by depth
  const shells = new Map<number, VoidNode[]>();
  nodes.forEach(node => {
    const d = depths.get(node.id) || 0;
    if (!shells.has(d)) shells.set(d, []);
    shells.get(d)!.push(node);
  });

  // Position nodes in shells
  const positions = new Map<number, [number, number, number]>();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  shells.forEach((shellNodes, depth) => {
    const radius = shellRadius + depth * shellSpacing;
    
    shellNodes.forEach((node, index) => {
      const theta = goldenAngle * index;
      const phi = Math.acos(1 - (2 * (index + 0.5)) / shellNodes.length);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      positions.set(node.id, [x, y, z]);
    });
  });

  return positions;
}

/**
 * Extract domain from URL
 */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

/**
 * Get cluster information for visualization
 */
export function getClusterInfo(nodes: VoidNode[]): Map<string, {
  domain: string;
  nodes: VoidNode[];
  center: [number, number, number];
  radius: number;
}> {
  const clusters = new Map<string, VoidNode[]>();
  
  nodes.forEach(node => {
    const domain = getDomain(node.url);
    if (!clusters.has(domain)) clusters.set(domain, []);
    clusters.get(domain)!.push(node);
  });

  const result = new Map<string, {
    domain: string;
    nodes: VoidNode[];
    center: [number, number, number];
    radius: number;
  }>();

  clusters.forEach((clusterNodes, domain) => {
    if (clusterNodes.length < 2) return; // Skip single-node clusters
    
    // Calculate center
    let cx = 0, cy = 0, cz = 0;
    clusterNodes.forEach(n => {
      cx += n.position_x;
      cy += n.position_y;
      cz += n.position_z;
    });
    cx /= clusterNodes.length;
    cy /= clusterNodes.length;
    cz /= clusterNodes.length;

    // Calculate radius (max distance from center)
    let maxDist = 0;
    clusterNodes.forEach(n => {
      const dist = Math.sqrt(
        (n.position_x - cx) ** 2 +
        (n.position_y - cy) ** 2 +
        (n.position_z - cz) ** 2
      );
      maxDist = Math.max(maxDist, dist);
    });

    result.set(domain, {
      domain,
      nodes: clusterNodes,
      center: [cx, cy, cz],
      radius: maxDist + 5, // Add padding
    });
  });

  return result;
}
