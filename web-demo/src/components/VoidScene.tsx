import { useRef, useState, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DemoNode, DemoEdge } from '../lib/types';
import { SiteNode } from './SiteNode';
import { Connections } from './Connection';

interface VoidSceneProps {
  nodes: DemoNode[];
  edges: DemoEdge[];
  onEnterNode?: (url: string, title: string) => void;
  showEdges?: boolean;
  showLabels?: boolean;
  themeColor?: string;
}

export function VoidScene({ 
  nodes, 
  edges, 
  onEnterNode,
  showEdges = true,
  showLabels = true,
  themeColor = '#4fc3f7',
}: VoidSceneProps) {
  const { camera, gl } = useThree();
  const [hoveredNode, setHoveredNode] = useState<DemoNode | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const nodeRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  // Raycast from screen center when pointer is locked
  useFrame(() => {
    if (!document.pointerLockElement) {
      // Not locked - clear hover if we had one from raycasting
      return;
    }

    // Cast ray from center of screen
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    // Get all node meshes
    const meshes: THREE.Mesh[] = [];
    nodeRefs.current.forEach((mesh) => {
      if (mesh) meshes.push(mesh);
    });

    const intersects = raycaster.current.intersectObjects(meshes, false);
    
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const nodeId = hitMesh.userData.nodeId;
      const node = nodes.find(n => n.id === nodeId);
      if (node && (!hoveredNode || hoveredNode.id !== nodeId)) {
        setHoveredNode(node);
      }
    } else if (hoveredNode) {
      setHoveredNode(null);
    }
  });

  // Handle click when pointer is locked
  useEffect(() => {
    const handleClick = () => {
      if (!document.pointerLockElement) return;
      
      if (hoveredNode && onEnterNode) {
        onEnterNode(hoveredNode.url, hoveredNode.title);
      }
    };

    gl.domElement.addEventListener('click', handleClick);
    return () => gl.domElement.removeEventListener('click', handleClick);
  }, [gl, hoveredNode, onEnterNode]);

  // Register node mesh ref
  const registerNodeRef = useCallback((nodeId: string, mesh: THREE.Mesh | null) => {
    if (mesh) {
      mesh.userData.nodeId = nodeId;
      nodeRefs.current.set(nodeId, mesh);
    } else {
      nodeRefs.current.delete(nodeId);
    }
  }, []);

  const handleClick = (url: string, title: string) => {
    // This is for non-locked mode clicks
    if (!document.pointerLockElement) {
      if (onEnterNode) {
        onEnterNode(url, title);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };
  
  return (
    <group>
      {/* Connections first (behind nodes) */}
      {showEdges && <Connections edges={edges} nodes={nodes} themeColor={themeColor} />}
      
      {/* Nodes */}
      {nodes.map(node => (
        <SiteNode
          key={node.id}
          node={node}
          onClick={handleClick}
          showLabel={showLabels}
          themeColor={themeColor}
          isHovered={hoveredNode?.id === node.id}
          onRegisterMesh={(mesh) => registerNodeRef(node.id, mesh)}
        />
      ))}
    </group>
  );
}
