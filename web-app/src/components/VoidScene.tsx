import { useMemo, useEffect, useState, useCallback } from "react";
import { SiteNode } from "./SiteNode";
import { Connection, AnimatedConnection } from "./Connection";
import { ClusterBoundaries } from "./ClusterBoundary";
import { VoidNode, VoidEdge } from "../lib/types";
import { getDomainColor } from "../lib/colors";
import { calculateLayout, getClusterInfo, LayoutMode, LayoutOptions } from "../lib/layout";
import { getTheme } from "../lib/themes";

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

export function VoidScene({ 
  nodes, 
  edges, 
  onEnterNode, 
  onRightClickNode, 
  displaySettings = DEFAULT_DISPLAY,
  onNodePositionsUpdated,
}: VoidSceneProps) {
  // Track layout-computed positions (overrides node.position_* when layout is active)
  const [layoutPositions, setLayoutPositions] = useState<Map<number, [number, number, number]> | null>(null);
  const [prevLayoutMode, setPrevLayoutMode] = useState<LayoutMode>(displaySettings.layoutMode);

  // Get current theme
  const theme = useMemo(() => getTheme(displaySettings.theme), [displaySettings.theme]);

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

  // Calculate layout when mode changes or nodes change significantly
  useEffect(() => {
    const layoutMode = displaySettings.layoutMode;
    
    // Only recalculate if mode changed or we don't have positions yet
    if (layoutMode !== prevLayoutMode || !layoutPositions) {
      setPrevLayoutMode(layoutMode);
      
      if (layoutMode === "random") {
        // For random, just use existing node positions
        setLayoutPositions(null);
      } else {
        // Calculate new layout
        const options: LayoutOptions = {
          mode: layoutMode,
          iterations: layoutMode === "force" ? 150 : 100,
        };
        
        const newPositions = calculateLayout(nodes, edges, options);
        setLayoutPositions(newPositions);
        
        // Notify parent if needed
        if (onNodePositionsUpdated) {
          onNodePositionsUpdated(newPositions);
        }
      }
    }
  }, [displaySettings.layoutMode, nodes.length, prevLayoutMode]);

  // Get effective position for a node
  const getNodePosition = useCallback((node: VoidNode): [number, number, number] => {
    if (layoutPositions && layoutPositions.has(node.id)) {
      return layoutPositions.get(node.id)!;
    }
    return [node.position_x, node.position_y, node.position_z];
  }, [layoutPositions]);

  // Create node position lookup for connections (uses layout positions if available)
  const nodePositions = useMemo(() => {
    const map = new Map<number, [number, number, number]>();
    nodes.forEach(node => {
      map.set(node.id, getNodePosition(node));
    });
    return map;
  }, [nodes, getNodePosition]);

  // Create node color lookup (by domain, respecting theme)
  const nodeColors = useMemo(() => {
    const map = new Map<number, string>();
    nodes.forEach(node => {
      // Use theme-aware coloring
      map.set(node.id, getDomainColor(node.url));
    });
    return map;
  }, [nodes]);

  // Calculate cluster info for boundaries
  const clusterInfo = useMemo(() => {
    if (!displaySettings.showClusterBoundaries) return new Map();
    
    // Create temporary nodes with layout positions for cluster calculation
    const positionedNodes = nodes.map(node => ({
      ...node,
      position_x: nodePositions.get(node.id)?.[0] ?? node.position_x,
      position_y: nodePositions.get(node.id)?.[1] ?? node.position_y,
      position_z: nodePositions.get(node.id)?.[2] ?? node.position_z,
    }));
    
    return getClusterInfo(positionedNodes);
  }, [nodes, nodePositions, displaySettings.showClusterBoundaries]);

  // Decide which connection component to use
  const ConnectionComponent = displaySettings.animateEdges ? AnimatedConnection : Connection;

  return (
    <group>
      {/* Cluster boundaries (rendered first, behind nodes) */}
      {displaySettings.showClusterBoundaries && (
        <ClusterBoundaries 
          clusters={clusterInfo}
          showLabels={displaySettings.showLabels}
        />
      )}

      {/* Render all nodes */}
      {nodes.map((node) => {
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
      
      {/* Render all connections */}
      {displaySettings.showEdges && edges.map((edge) => {
        const startPos = nodePositions.get(edge.source_id);
        const endPos = nodePositions.get(edge.target_id);
        if (!startPos || !endPos) return null;
        
        // Get colors for gradient effect on edges
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
