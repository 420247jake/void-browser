import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { DemoNode, DemoEdge } from '../lib/types';

interface ConnectionProps {
  edge: DemoEdge;
  nodes: Map<string, DemoNode>;
  color?: string;
  opacity?: number;
}

export function Connection({ edge, nodes, color = '#4fc3f7', opacity = 0.3 }: ConnectionProps) {
  const sourceNode = nodes.get(edge.source);
  const targetNode = nodes.get(edge.target);
  
  if (!sourceNode || !targetNode) return null;
  
  const points = useMemo(() => [
    sourceNode.position,
    targetNode.position,
  ], [sourceNode, targetNode]);
  
  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={opacity}
    />
  );
}

interface ConnectionsProps {
  edges: DemoEdge[];
  nodes: DemoNode[];
  themeColor?: string;
}

export function Connections({ edges, nodes, themeColor = '#4fc3f7' }: ConnectionsProps) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, DemoNode>();
    nodes.forEach(node => map.set(node.id, node));
    return map;
  }, [nodes]);
  
  return (
    <group>
      {edges.map(edge => (
        <Connection
          key={edge.id}
          edge={edge}
          nodes={nodeMap}
          color={themeColor}
        />
      ))}
    </group>
  );
}
