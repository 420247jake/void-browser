/**
 * Layout Worker
 * 
 * Offloads heavy layout calculations to a WebWorker to keep UI responsive.
 */

// Types for worker messages
export interface LayoutWorkerRequest {
  type: 'calculate';
  nodes: { id: number; x: number; y: number; z: number }[];
  edges: { source_id: number; target_id: number }[];
  options: {
    mode: 'random' | 'force' | 'grid' | 'radial' | 'cluster';
    iterations?: number;
    spread?: number;
  };
}

export interface LayoutWorkerResponse {
  type: 'result' | 'progress' | 'error';
  positions?: Map<number, [number, number, number]>;
  progress?: number;
  error?: string;
}

// Worker code as a string (will be converted to Blob URL)
const workerCode = `
// Force-directed layout calculation
function calculateForceLayout(nodes, edges, iterations = 100) {
  // Initialize positions from input
  const positions = new Map();
  nodes.forEach(n => positions.set(n.id, [n.x, n.y, n.z]));
  
  // Build adjacency list
  const adjacency = new Map();
  nodes.forEach(n => adjacency.set(n.id, new Set()));
  edges.forEach(e => {
    if (adjacency.has(e.source_id)) adjacency.get(e.source_id).add(e.target_id);
    if (adjacency.has(e.target_id)) adjacency.get(e.target_id).add(e.source_id);
  });
  
  const k = 15; // Ideal distance
  const gravity = 0.1;
  
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map();
    nodes.forEach(n => forces.set(n.id, [0, 0, 0]));
    
    // Repulsion between all nodes
    const nodeList = Array.from(positions.keys());
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const id1 = nodeList[i];
        const id2 = nodeList[j];
        const [x1, y1, z1] = positions.get(id1);
        const [x2, y2, z2] = positions.get(id2);
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
        
        // Repulsion force
        const repulsion = (k * k) / dist;
        const fx = (dx / dist) * repulsion;
        const fy = (dy / dist) * repulsion;
        const fz = (dz / dist) * repulsion;
        
        const f1 = forces.get(id1);
        const f2 = forces.get(id2);
        f1[0] -= fx; f1[1] -= fy; f1[2] -= fz;
        f2[0] += fx; f2[1] += fy; f2[2] += fz;
      }
    }
    
    // Attraction along edges
    edges.forEach(e => {
      if (!positions.has(e.source_id) || !positions.has(e.target_id)) return;
      
      const [x1, y1, z1] = positions.get(e.source_id);
      const [x2, y2, z2] = positions.get(e.target_id);
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dz = z2 - z1;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
      
      const attraction = dist / k;
      const fx = (dx / dist) * attraction;
      const fy = (dy / dist) * attraction;
      const fz = (dz / dist) * attraction;
      
      if (forces.has(e.source_id)) {
        const f = forces.get(e.source_id);
        f[0] += fx; f[1] += fy; f[2] += fz;
      }
      if (forces.has(e.target_id)) {
        const f = forces.get(e.target_id);
        f[0] -= fx; f[1] -= fy; f[2] -= fz;
      }
    });
    
    // Apply forces with cooling
    const cooling = 1 - (iter / iterations);
    const maxMove = 5 * cooling;
    
    positions.forEach((pos, id) => {
      const force = forces.get(id);
      if (!force) return;
      
      // Add gravity toward center
      force[0] -= pos[0] * gravity;
      force[1] -= pos[1] * gravity;
      force[2] -= pos[2] * gravity;
      
      // Limit movement
      const mag = Math.sqrt(force[0]**2 + force[1]**2 + force[2]**2);
      if (mag > maxMove) {
        force[0] = (force[0] / mag) * maxMove;
        force[1] = (force[1] / mag) * maxMove;
        force[2] = (force[2] / mag) * maxMove;
      }
      
      pos[0] += force[0];
      pos[1] += force[1];
      pos[2] += force[2];
    });
    
    // Report progress every 10%
    if (iter % Math.ceil(iterations / 10) === 0) {
      self.postMessage({
        type: 'progress',
        progress: iter / iterations
      });
    }
  }
  
  return positions;
}

// Grid layout
function calculateGridLayout(nodes, spread = 20) {
  const positions = new Map();
  const count = nodes.length;
  const cols = Math.ceil(Math.cbrt(count));
  const rows = Math.ceil(count / cols);
  
  nodes.forEach((n, i) => {
    const x = (i % cols - cols / 2) * spread;
    const y = (Math.floor(i / cols) % rows - rows / 2) * spread;
    const z = (Math.floor(i / (cols * rows)) - Math.floor(count / (cols * rows)) / 2) * spread;
    positions.set(n.id, [x, y, z]);
  });
  
  return positions;
}

// Radial layout (nodes in concentric spheres based on connectivity)
function calculateRadialLayout(nodes, edges, spread = 15) {
  const positions = new Map();
  
  // Build adjacency
  const adjacency = new Map();
  nodes.forEach(n => adjacency.set(n.id, new Set()));
  edges.forEach(e => {
    if (adjacency.has(e.source_id)) adjacency.get(e.source_id).add(e.target_id);
    if (adjacency.has(e.target_id)) adjacency.get(e.target_id).add(e.source_id);
  });
  
  // Sort by connection count
  const sorted = [...nodes].sort((a, b) => {
    const aConns = adjacency.get(a.id)?.size || 0;
    const bConns = adjacency.get(b.id)?.size || 0;
    return bConns - aConns;
  });
  
  // Place in concentric spheres
  let currentRadius = 0;
  let nodesInCurrentShell = 1;
  let placedInShell = 0;
  
  sorted.forEach((n, i) => {
    if (placedInShell >= nodesInCurrentShell) {
      currentRadius += spread;
      nodesInCurrentShell = Math.max(1, Math.floor(4 * Math.PI * (currentRadius / spread) ** 2 / 4));
      placedInShell = 0;
    }
    
    // Golden angle distribution
    const phi = Math.acos(1 - 2 * (placedInShell + 0.5) / nodesInCurrentShell);
    const theta = Math.PI * (1 + Math.sqrt(5)) * placedInShell;
    
    const x = currentRadius * Math.sin(phi) * Math.cos(theta);
    const y = currentRadius * Math.sin(phi) * Math.sin(theta);
    const z = currentRadius * Math.cos(phi);
    
    positions.set(n.id, [x, y, z]);
    placedInShell++;
  });
  
  return positions;
}

// Cluster layout (group by domain)
function calculateClusterLayout(nodes, edges, spread = 25) {
  const positions = new Map();
  
  // Group by domain
  const clusters = new Map();
  nodes.forEach(n => {
    try {
      const domain = new URL(n.url || '').hostname.replace('www.', '').split('.').slice(-2).join('.');
      if (!clusters.has(domain)) clusters.set(domain, []);
      clusters.get(domain).push(n);
    } catch {
      if (!clusters.has('other')) clusters.set('other', []);
      clusters.get('other').push(n);
    }
  });
  
  // Place clusters
  const clusterList = Array.from(clusters.entries());
  const clusterCount = clusterList.length;
  
  clusterList.forEach(([domain, clusterNodes], clusterIndex) => {
    // Cluster center using golden angle
    const phi = Math.acos(1 - 2 * (clusterIndex + 0.5) / clusterCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * clusterIndex;
    const clusterRadius = spread * Math.sqrt(clusterCount);
    
    const cx = clusterRadius * Math.sin(phi) * Math.cos(theta);
    const cy = clusterRadius * Math.sin(phi) * Math.sin(theta);
    const cz = clusterRadius * Math.cos(phi);
    
    // Place nodes within cluster
    const nodeCount = clusterNodes.length;
    clusterNodes.forEach((n, nodeIndex) => {
      const innerPhi = Math.acos(1 - 2 * (nodeIndex + 0.5) / Math.max(nodeCount, 1));
      const innerTheta = Math.PI * (1 + Math.sqrt(5)) * nodeIndex;
      const innerRadius = spread * 0.5 * Math.cbrt(nodeCount);
      
      const x = cx + innerRadius * Math.sin(innerPhi) * Math.cos(innerTheta);
      const y = cy + innerRadius * Math.sin(innerPhi) * Math.sin(innerTheta);
      const z = cz + innerRadius * Math.cos(innerPhi);
      
      positions.set(n.id, [x, y, z]);
    });
  });
  
  return positions;
}

// Message handler
self.onmessage = function(e) {
  const { type, nodes, edges, options } = e.data;
  
  if (type !== 'calculate') return;
  
  try {
    let positions;
    
    switch (options.mode) {
      case 'force':
        positions = calculateForceLayout(nodes, edges, options.iterations || 100);
        break;
      case 'grid':
        positions = calculateGridLayout(nodes, options.spread);
        break;
      case 'radial':
        positions = calculateRadialLayout(nodes, edges, options.spread);
        break;
      case 'cluster':
        positions = calculateClusterLayout(nodes, edges, options.spread);
        break;
      default:
        positions = new Map();
        nodes.forEach(n => positions.set(n.id, [n.x, n.y, n.z]));
    }
    
    // Convert Map to array for transfer
    const result = Array.from(positions.entries());
    
    self.postMessage({
      type: 'result',
      positions: result
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message
    });
  }
};
`;

// Create worker from blob URL
let workerInstance: Worker | null = null;
let workerURL: string | null = null;

function getWorker(): Worker {
  if (!workerInstance) {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerURL = URL.createObjectURL(blob);
    workerInstance = new Worker(workerURL);
  }
  return workerInstance;
}

/**
 * Calculate layout in a WebWorker
 */
export function calculateLayoutAsync(
  nodes: { id: number; x: number; y: number; z: number; url?: string }[],
  edges: { source_id: number; target_id: number }[],
  options: {
    mode: 'random' | 'force' | 'grid' | 'radial' | 'cluster';
    iterations?: number;
    spread?: number;
  },
  onProgress?: (progress: number) => void
): Promise<Map<number, [number, number, number]>> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    
    const handleMessage = (e: MessageEvent) => {
      const { type, positions, progress, error } = e.data;
      
      if (type === 'progress' && onProgress) {
        onProgress(progress);
      } else if (type === 'result') {
        worker.removeEventListener('message', handleMessage);
        // Convert array back to Map
        const map = new Map<number, [number, number, number]>(positions);
        resolve(map);
      } else if (type === 'error') {
        worker.removeEventListener('message', handleMessage);
        reject(new Error(error));
      }
    };
    
    worker.addEventListener('message', handleMessage);
    
    // Include URL for cluster layout
    const nodesWithUrl = nodes.map(n => ({
      ...n,
      url: (n as any).url || ''
    }));
    
    worker.postMessage({
      type: 'calculate',
      nodes: nodesWithUrl,
      edges,
      options
    });
  });
}

/**
 * Clean up worker resources
 */
export function terminateLayoutWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  if (workerURL) {
    URL.revokeObjectURL(workerURL);
    workerURL = null;
  }
}
