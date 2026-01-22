/**
 * Optimized VoidScene with performance enhancements
 * 
 * Features:
 * - Frustum culling
 * - Level of Detail (LOD)
 * - Instanced rendering for large graphs
 * - WebWorker layout calculations
 * - Spatial indexing
 */

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SiteNode } from "./SiteNode";
import { Connection, AnimatedConnection } from "./Connection";
import { ClusterBoundaries } from "./ClusterBoundary";
import { InstancedNodes, InstancedConnections } from "./InstancedNodes";
import { VoidNode, VoidEdge } from "../lib/types";
import { getDomainColor } from "../lib/colors";
import { calculateLayout, getClusterInfo, LayoutMode, LayoutOptions } from "../lib/layout";
import { getTheme } from "../lib/themes";
import { 
  isInFrustum, 
  getLODLevel,
  Octree,
  PerformanceMonitor,
  throttle,
} from "../lib/performance";
import { calculateLayoutAsync, terminateLayoutWorker } from "../lib/layoutWorker";

interface DisplaySettings {
  showLabels: boolean;
  showEdges: boolean;
  nodeSize: number;
  labelScale: number;
  layoutMode: LayoutMode;
  showClusterBoundaries: boolean;
  theme: string;
  animateEdges: boolean;
  showNodeImportance: boolean;
}

interface VoidSceneProps {
  nodes: VoidNode[];
  edges: VoidEdge[];
  onEnterNode?: (url: string, title: string) => void;
  onRightClickNode?: (node: VoidNode, screenPos: { x: number; y: number }) => void;
  displaySettings?: DisplaySettings;
  onNodePositionsUpdated?: (positions: Map<number, [number, number, number]>) => void;
  enablePerformanceMode?: boolean; // Auto-enable optimizations for large graphs
}

const DEFAULT_DISPLAY: DisplaySettings = {
  showLabels: true,
  showEdges: true,
  nodeSize: 1.0,
  labelScale: 1.0,
  layoutMode: "random",
  showClusterBoundaries: false,
  theme: "cyan",
  animateEdges: false,
  showNodeImportance: false,
};

// Thresholds
const LARGE_GRAPH_THRESHOLD = 500; // Use worker for layout
const INSTANCING_THRESHOLD = 500;  // Use instancing for rendering (raised to preserve preview cards)
const FRUSTUM_CULLING_THRESHOLD = 100; // Enable frustum culling

export function VoidSceneOptimized({ 
  nodes, 
  edges, 
  onEnterNode, 
  onRightClickNode, 
  displaySettings = DEFAULT_DISPLAY,
  onNodePositionsUpdated,
  enablePerformanceMode = true,
}: VoidSceneProps) {
  const { camera, gl } = useThree();
  
  // Track layout-computed positions
  const [layoutPositions, setLayoutPositions] = useState<Map<number, [number, number, number]> | null>(null);
  const [prevLayoutMode, setPrevLayoutMode] = useState<LayoutMode>(displaySettings.layoutMode);
  const [layoutProgress, setLayoutProgress] = useState<number | null>(null);
  
  // Visible nodes after frustum culling
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<number>>(new Set());
  
  // Performance monitoring
  const perfMonitor = useRef(new PerformanceMonitor());
  
  // Octree for spatial queries
  const octreeRef = useRef<Octree<VoidNode> | null>(null);

  // Get current theme
  const theme = useMemo(() => getTheme(displaySettings.theme), [displaySettings.theme]);

  // Decide rendering mode
  const useInstancing = enablePerformanceMode && nodes.length >= INSTANCING_THRESHOLD;
  const useFrustumCulling = enablePerformanceMode && nodes.length >= FRUSTUM_CULLING_THRESHOLD;
  const useWorkerLayout = enablePerformanceMode && nodes.length >= LARGE_GRAPH_THRESHOLD;

  // Calculate node importance (connection count)
  const nodeImportance = useMemo(() => {
    const importance = new Map<number, number>();
    nodes.forEach(n => importance.set(n.id, 0));
    
    edges.forEach(edge => {
      importance.set(edge.source_id, (importance.get(edge.source_id) || 0) + 1);
      importance.set(edge.target_id, (importance.get(edge.target_id) || 0) + 1);
    });
    
    // Normalize to 0.7-1.5 range
    const maxConnections = Math.max(...importance.values(), 1);
    nodes.forEach(n => {
      const count = importance.get(n.id) || 0;
      const normalized = 0.7 + (count / maxConnections) * 0.8;
      importance.set(n.id, normalized);
    });
    
    return importance;
  }, [nodes, edges]);

  // Get effective position for a node
  const getNodePosition = useCallback((node: VoidNode): [number, number, number] => {
    if (layoutPositions && layoutPositions.has(node.id)) {
      return layoutPositions.get(node.id)!;
    }
    return [node.position_x, node.position_y, node.position_z];
  }, [layoutPositions]);

  // Node position map
  const nodePositions = useMemo(() => {
    const map = new Map<number, [number, number, number]>();
    nodes.forEach(node => {
      map.set(node.id, getNodePosition(node));
    });
    return map;
  }, [nodes, getNodePosition]);

  // Node colors
  const nodeColors = useMemo(() => {
    const map = new Map<number, string>();
    nodes.forEach(node => {
      map.set(node.id, getDomainColor(node.url));
    });
    return map;
  }, [nodes]);

  // Build octree when positions change
  useEffect(() => {
    if (!useFrustumCulling) return;
    
    // Calculate bounds
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    nodePositions.forEach(([x, y, z]) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    });
    
    // Add padding
    const padding = 50;
    const bounds = new THREE.Box3(
      new THREE.Vector3(minX - padding, minY - padding, minZ - padding),
      new THREE.Vector3(maxX + padding, maxY + padding, maxZ + padding)
    );
    
    // Create octree
    const octree = new Octree<VoidNode>(bounds, 8, 6);
    nodes.forEach(node => {
      const pos = nodePositions.get(node.id);
      if (pos) {
        octree.insert(node, new THREE.Vector3(pos[0], pos[1], pos[2]));
      }
    });
    
    octreeRef.current = octree;
  }, [nodePositions, nodes, useFrustumCulling]);

  // Calculate layout (with worker for large graphs)
  useEffect(() => {
    const layoutMode = displaySettings.layoutMode;
    
    if (layoutMode !== prevLayoutMode || !layoutPositions) {
      setPrevLayoutMode(layoutMode);
      
      if (layoutMode === "random") {
        setLayoutPositions(null);
        setLayoutProgress(null);
      } else if (useWorkerLayout) {
        // Use WebWorker for large graphs
        // Map layout modes to worker-supported modes
        const workerMode = layoutMode === "depth" ? "radial" : layoutMode;
        
        setLayoutProgress(0);
        
        const nodeData = nodes.map(n => ({
          id: n.id,
          x: n.position_x,
          y: n.position_y,
          z: n.position_z,
          url: n.url,
        }));
        
        calculateLayoutAsync(
          nodeData,
          edges.map(e => ({ source_id: e.source_id, target_id: e.target_id })),
          {
            mode: workerMode as 'force' | 'grid' | 'radial' | 'cluster',
            iterations: layoutMode === "force" ? 150 : 100,
          },
          (progress) => setLayoutProgress(progress)
        ).then(positions => {
          setLayoutPositions(positions);
          setLayoutProgress(null);
          if (onNodePositionsUpdated) {
            onNodePositionsUpdated(positions);
          }
        }).catch(err => {
          console.error("Layout worker error:", err);
          setLayoutProgress(null);
        });
      } else {
        // Synchronous layout for small graphs
        const options: LayoutOptions = {
          mode: layoutMode,
          iterations: layoutMode === "force" ? 150 : 100,
        };
        
        const newPositions = calculateLayout(nodes, edges, options);
        setLayoutPositions(newPositions);
        
        if (onNodePositionsUpdated) {
          onNodePositionsUpdated(newPositions);
        }
      }
    }
  }, [displaySettings.layoutMode, nodes.length, prevLayoutMode, useWorkerLayout]);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      terminateLayoutWorker();
    };
  }, []);

  // Throttled frustum culling update
  const updateVisibility = useMemo(() => throttle((cam: THREE.Camera) => {
    if (!useFrustumCulling) {
      // Show all nodes
      setVisibleNodeIds(new Set(nodes.map(n => n.id)));
      return;
    }
    
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      cam.projectionMatrix,
      cam.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);
    
    // Query octree or iterate
    if (octreeRef.current) {
      const visible = octreeRef.current.queryFrustum(frustum);
      setVisibleNodeIds(new Set(visible.map(n => n.id)));
    } else {
      const visible = new Set<number>();
      nodes.forEach(node => {
        const pos = nodePositions.get(node.id);
        if (pos && isInFrustum(pos, cam, 10)) {
          visible.add(node.id);
        }
      });
      setVisibleNodeIds(visible);
    }
  }, 100), [nodes, nodePositions, useFrustumCulling]);

  // Update visibility on camera move
  useFrame(() => {
    updateVisibility(camera);
    perfMonitor.current.update(gl);
    perfMonitor.current.setVisibility(
      visibleNodeIds.size, 
      nodes.length,
      edges.filter(e => visibleNodeIds.has(e.source_id) || visibleNodeIds.has(e.target_id)).length,
      edges.length
    );
  });

  // Visible nodes
  const visibleNodes = useMemo(() => {
    if (!useFrustumCulling) return nodes;
    return nodes.filter(n => visibleNodeIds.has(n.id));
  }, [nodes, visibleNodeIds, useFrustumCulling]);

  // Visible edges (at least one endpoint visible)
  const visibleEdges = useMemo(() => {
    if (!displaySettings.showEdges) return [];
    if (!useFrustumCulling) return edges;
    return edges.filter(e => 
      visibleNodeIds.has(e.source_id) || visibleNodeIds.has(e.target_id)
    );
  }, [edges, visibleNodeIds, displaySettings.showEdges, useFrustumCulling]);

  // Cluster info for boundaries
  const clusterInfo = useMemo(() => {
    if (!displaySettings.showClusterBoundaries) return new Map();
    
    const positionedNodes = nodes.map(node => ({
      ...node,
      position_x: nodePositions.get(node.id)?.[0] ?? node.position_x,
      position_y: nodePositions.get(node.id)?.[1] ?? node.position_y,
      position_z: nodePositions.get(node.id)?.[2] ?? node.position_z,
    }));
    
    return getClusterInfo(positionedNodes);
  }, [nodes, nodePositions, displaySettings.showClusterBoundaries]);

  // Connection component
  const ConnectionComponent = displaySettings.animateEdges ? AnimatedConnection : Connection;

  // Loading indicator for layout
  if (layoutProgress !== null) {
    return (
      <group>
        {/* Show minimal scene while calculating */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={theme.primary} wireframe />
        </mesh>
      </group>
    );
  }

  // Use instanced rendering for large graphs
  if (useInstancing) {
    return (
      <group>
        {/* Cluster boundaries */}
        {displaySettings.showClusterBoundaries && (
          <ClusterBoundaries 
            clusters={clusterInfo}
            showLabels={displaySettings.showLabels}
          />
        )}

        {/* Instanced nodes */}
        <InstancedNodes
          nodes={visibleNodes}
          positions={nodePositions}
          colors={nodeColors}
          onEnterNode={onEnterNode}
          onRightClickNode={onRightClickNode}
          displaySettings={{
            nodeSize: displaySettings.nodeSize,
            showLabels: displaySettings.showLabels,
            labelScale: displaySettings.labelScale,
            theme: displaySettings.theme,
          }}
        />

        {/* Instanced connections */}
        {displaySettings.showEdges && (
          <InstancedConnections
            edges={visibleEdges}
            positions={nodePositions}
            colors={nodeColors}
            visible={displaySettings.showEdges}
          />
        )}
      </group>
    );
  }

  // Standard rendering for smaller graphs
  return (
    <group>
      {/* Cluster boundaries */}
      {displaySettings.showClusterBoundaries && (
        <ClusterBoundaries 
          clusters={clusterInfo}
          showLabels={displaySettings.showLabels}
        />
      )}

      {/* Render visible nodes */}
      {visibleNodes.map((node) => {
        const position = getNodePosition(node);
        const importanceScale = displaySettings.showNodeImportance 
          ? (nodeImportance.get(node.id) || 1) 
          : 1;
        
        return (
          <SiteNode
            key={node.id}
            id={String(node.id)}
            url={node.url}
            title={node.title || new URL(node.url).hostname}
            position={position}
            isAlive={node.is_alive}
            favicon={node.favicon || undefined}
            screenshot={node.screenshot || undefined}
            lastCrawled={node.last_crawled || undefined}
            color={node.is_alive ? nodeColors.get(node.id) || theme.nodeAlive : theme.nodeDead}
            onEnter={onEnterNode}
            onRightClick={onRightClickNode ? (screenPos) => onRightClickNode(node, screenPos) : undefined}
            scale={displaySettings.nodeSize * importanceScale}
            showLabel={displaySettings.showLabels}
            labelScale={displaySettings.labelScale}
          />
        );
      })}
      
      {/* Render visible connections */}
      {displaySettings.showEdges && visibleEdges.map((edge) => {
        const startPos = nodePositions.get(edge.source_id);
        const endPos = nodePositions.get(edge.target_id);
        if (!startPos || !endPos) return null;
        
        const startColor = nodeColors.get(edge.source_id) || theme.primary;
        const endColor = nodeColors.get(edge.target_id) || theme.primary;
        
        return (
          <ConnectionComponent
            key={`edge-${edge.id}`}
            start={startPos}
            end={endPos}
            startColor={startColor}
            endColor={endColor}
          />
        );
      })}
    </group>
  );
}

// Re-export original VoidScene as default for backwards compatibility
export { VoidSceneOptimized as VoidScene };
