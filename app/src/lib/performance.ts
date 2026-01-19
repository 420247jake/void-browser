/**
 * Performance Optimization Utilities for Void Browser
 * 
 * Includes:
 * - Frustum culling helpers
 * - Level of Detail (LOD) calculations
 * - Spatial indexing (Octree)
 * - Object pooling
 * - Performance metrics
 */

import * as THREE from "three";

// ============================================================
// FRUSTUM CULLING
// ============================================================

/**
 * Check if a point is within the camera frustum
 */
export function isInFrustum(
  point: THREE.Vector3 | [number, number, number],
  camera: THREE.Camera,
  margin: number = 0
): boolean {
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(matrix);

  const vec = Array.isArray(point) 
    ? new THREE.Vector3(point[0], point[1], point[2])
    : point;

  // Expand frustum by margin for smooth transitions
  if (margin > 0) {
    // Create a sphere around the point
    const sphere = new THREE.Sphere(vec, margin);
    return frustum.intersectsSphere(sphere);
  }

  return frustum.containsPoint(vec);
}

/**
 * Batch check multiple points for frustum culling
 * Returns array of indices that are visible
 */
export function getVisibleIndices(
  positions: [number, number, number][],
  camera: THREE.Camera,
  margin: number = 5
): number[] {
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(matrix);

  const visible: number[] = [];
  const sphere = new THREE.Sphere();

  for (let i = 0; i < positions.length; i++) {
    const [x, y, z] = positions[i];
    sphere.set(new THREE.Vector3(x, y, z), margin);
    if (frustum.intersectsSphere(sphere)) {
      visible.push(i);
    }
  }

  return visible;
}

// ============================================================
// LEVEL OF DETAIL (LOD)
// ============================================================

export interface LODLevel {
  distance: number;      // Max distance for this LOD level
  showLabel: boolean;    // Show text labels
  showPreview: boolean;  // Show screenshot previews
  showGlow: boolean;     // Show glow effect
  sphereSegments: number; // Geometry detail
  showConnections: boolean; // Show connections to this node
}

// Default LOD levels
export const DEFAULT_LOD_LEVELS: LODLevel[] = [
  { distance: 15,  showLabel: true,  showPreview: true,  showGlow: true,  sphereSegments: 32, showConnections: true },
  { distance: 40,  showLabel: true,  showPreview: false, showGlow: true,  sphereSegments: 16, showConnections: true },
  { distance: 80,  showLabel: false, showPreview: false, showGlow: true,  sphereSegments: 8,  showConnections: true },
  { distance: 150, showLabel: false, showPreview: false, showGlow: false, sphereSegments: 6,  showConnections: false },
  { distance: Infinity, showLabel: false, showPreview: false, showGlow: false, sphereSegments: 4, showConnections: false },
];

/**
 * Get LOD level for a given distance
 */
export function getLODLevel(distance: number, levels: LODLevel[] = DEFAULT_LOD_LEVELS): LODLevel {
  for (const level of levels) {
    if (distance <= level.distance) {
      return level;
    }
  }
  return levels[levels.length - 1];
}

/**
 * Calculate LOD for all nodes based on camera position
 */
export function calculateNodeLODs(
  positions: Map<number, [number, number, number]>,
  cameraPosition: THREE.Vector3,
  levels: LODLevel[] = DEFAULT_LOD_LEVELS
): Map<number, LODLevel> {
  const lods = new Map<number, LODLevel>();
  
  positions.forEach((pos, id) => {
    const distance = cameraPosition.distanceTo(
      new THREE.Vector3(pos[0], pos[1], pos[2])
    );
    lods.set(id, getLODLevel(distance, levels));
  });

  return lods;
}

// ============================================================
// OCTREE SPATIAL INDEX
// ============================================================

interface OctreeNode<T> {
  bounds: THREE.Box3;
  items: { item: T; position: THREE.Vector3 }[];
  children: OctreeNode<T>[] | null;
}

export class Octree<T> {
  private root: OctreeNode<T>;
  private maxItemsPerNode: number;
  private maxDepth: number;

  constructor(
    bounds: THREE.Box3,
    maxItemsPerNode: number = 8,
    maxDepth: number = 8
  ) {
    this.root = {
      bounds,
      items: [],
      children: null,
    };
    this.maxItemsPerNode = maxItemsPerNode;
    this.maxDepth = maxDepth;
  }

  /**
   * Insert an item into the octree
   */
  insert(item: T, position: THREE.Vector3): void {
    this.insertIntoNode(this.root, item, position, 0);
  }

  private insertIntoNode(
    node: OctreeNode<T>,
    item: T,
    position: THREE.Vector3,
    depth: number
  ): void {
    if (!node.bounds.containsPoint(position)) return;

    // If this is a leaf node
    if (!node.children) {
      node.items.push({ item, position });

      // Subdivide if we exceed capacity and haven't hit max depth
      if (node.items.length > this.maxItemsPerNode && depth < this.maxDepth) {
        this.subdivide(node);
        // Redistribute items
        const items = node.items;
        node.items = [];
        for (const { item: i, position: p } of items) {
          this.insertIntoNode(node, i, p, depth);
        }
      }
    } else {
      // Find which child(ren) contain this point
      for (const child of node.children) {
        if (child.bounds.containsPoint(position)) {
          this.insertIntoNode(child, item, position, depth + 1);
          break;
        }
      }
    }
  }

  private subdivide(node: OctreeNode<T>): void {
    const { min, max } = node.bounds;
    const mid = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

    node.children = [];

    // Create 8 child octants
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          const childMin = new THREE.Vector3(
            x === 0 ? min.x : mid.x,
            y === 0 ? min.y : mid.y,
            z === 0 ? min.z : mid.z
          );
          const childMax = new THREE.Vector3(
            x === 0 ? mid.x : max.x,
            y === 0 ? mid.y : max.y,
            z === 0 ? mid.z : max.z
          );

          node.children.push({
            bounds: new THREE.Box3(childMin, childMax),
            items: [],
            children: null,
          });
        }
      }
    }
  }

  /**
   * Query items within a sphere
   */
  queryRadius(center: THREE.Vector3, radius: number): T[] {
    const results: T[] = [];
    const sphere = new THREE.Sphere(center, radius);
    this.queryRadiusNode(this.root, sphere, results);
    return results;
  }

  private queryRadiusNode(
    node: OctreeNode<T>,
    sphere: THREE.Sphere,
    results: T[]
  ): void {
    if (!node.bounds.intersectsSphere(sphere)) return;

    for (const { item, position } of node.items) {
      if (sphere.containsPoint(position)) {
        results.push(item);
      }
    }

    if (node.children) {
      for (const child of node.children) {
        this.queryRadiusNode(child, sphere, results);
      }
    }
  }

  /**
   * Query items within a frustum
   */
  queryFrustum(frustum: THREE.Frustum): T[] {
    const results: T[] = [];
    this.queryFrustumNode(this.root, frustum, results);
    return results;
  }

  private queryFrustumNode(
    node: OctreeNode<T>,
    frustum: THREE.Frustum,
    results: T[]
  ): void {
    if (!frustum.intersectsBox(node.bounds)) return;

    for (const { item, position } of node.items) {
      if (frustum.containsPoint(position)) {
        results.push(item);
      }
    }

    if (node.children) {
      for (const child of node.children) {
        this.queryFrustumNode(child, frustum, results);
      }
    }
  }

  /**
   * Clear the octree
   */
  clear(): void {
    this.root.items = [];
    this.root.children = null;
  }
}

// ============================================================
// OBJECT POOLING
// ============================================================

export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;

  constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize: number = 0) {
    this.createFn = createFn;
    this.resetFn = resetFn;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    this.resetFn(obj);
    this.pool.push(obj);
  }

  get size(): number {
    return this.pool.length;
  }
}

// ============================================================
// PERFORMANCE METRICS
// ============================================================

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  visibleNodes: number;
  totalNodes: number;
  visibleEdges: number;
  totalEdges: number;
  drawCalls: number;
  triangles: number;
  memoryUsed: number;
}

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private maxSamples: number = 60;
  private lastTime: number = 0;
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    visibleNodes: 0,
    totalNodes: 0,
    visibleEdges: 0,
    totalEdges: 0,
    drawCalls: 0,
    triangles: 0,
    memoryUsed: 0,
  };

  update(gl: THREE.WebGLRenderer): void {
    const now = performance.now();
    if (this.lastTime > 0) {
      const delta = now - this.lastTime;
      this.frameTimes.push(delta);
      if (this.frameTimes.length > this.maxSamples) {
        this.frameTimes.shift();
      }
    }
    this.lastTime = now;

    // Calculate average frame time and FPS
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.metrics.frameTime = avgFrameTime;
    this.metrics.fps = 1000 / avgFrameTime;

    // Get renderer info
    const info = gl.info;
    this.metrics.drawCalls = info.render.calls;
    this.metrics.triangles = info.render.triangles;

    // Memory (if available)
    if ((performance as any).memory) {
      this.metrics.memoryUsed = (performance as any).memory.usedJSHeapSize / 1048576; // MB
    }
  }

  setVisibility(visibleNodes: number, totalNodes: number, visibleEdges: number, totalEdges: number): void {
    this.metrics.visibleNodes = visibleNodes;
    this.metrics.totalNodes = totalNodes;
    this.metrics.visibleEdges = visibleEdges;
    this.metrics.totalEdges = totalEdges;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
}

// ============================================================
// THROTTLED UPDATES
// ============================================================

/**
 * Throttle a function to run at most once per interval
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): T {
  let lastTime = 0;
  let lastResult: ReturnType<T>;

  return ((...args: Parameters<T>) => {
    const now = performance.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      lastResult = fn(...args);
    }
    return lastResult;
  }) as T;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T;
}

// ============================================================
// BATCH UPDATES
// ============================================================

/**
 * Batch multiple updates into a single render frame
 */
export class BatchUpdater {
  private updates: Map<string, () => void> = new Map();
  private scheduled: boolean = false;

  schedule(key: string, update: () => void): void {
    this.updates.set(key, update);
    
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  private flush(): void {
    const updates = Array.from(this.updates.values());
    this.updates.clear();
    this.scheduled = false;

    for (const update of updates) {
      update();
    }
  }
}

// ============================================================
// GEOMETRY CACHING
// ============================================================

const geometryCache = new Map<string, THREE.BufferGeometry>();

/**
 * Get or create a cached sphere geometry
 */
export function getCachedSphereGeometry(
  radius: number,
  widthSegments: number,
  heightSegments: number
): THREE.BufferGeometry {
  const key = `sphere-${radius}-${widthSegments}-${heightSegments}`;
  
  if (!geometryCache.has(key)) {
    geometryCache.set(key, new THREE.SphereGeometry(radius, widthSegments, heightSegments));
  }
  
  return geometryCache.get(key)!;
}

/**
 * Clear geometry cache (call on unmount)
 */
export function clearGeometryCache(): void {
  geometryCache.forEach(geom => geom.dispose());
  geometryCache.clear();
}
