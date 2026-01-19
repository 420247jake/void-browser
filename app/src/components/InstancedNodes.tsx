/**
 * Instanced Node Rendering for Void Browser
 * 
 * Uses GPU instancing to render thousands of nodes efficiently.
 * Falls back to individual rendering for small node counts.
 */

import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { VoidNode } from "../lib/types";
import { getLODLevel } from "../lib/performance";

// Threshold for switching to instanced rendering
const INSTANCING_THRESHOLD = 50;

interface InstancedNodesProps {
  nodes: VoidNode[];
  positions: Map<number, [number, number, number]>;
  colors: Map<number, string>;
  onEnterNode?: (url: string, title: string) => void;
  onRightClickNode?: (node: VoidNode, screenPos: { x: number; y: number }) => void;
  displaySettings: {
    nodeSize: number;
    showLabels: boolean;
    labelScale: number;
    theme: string;
  };
}

// Reusable objects to avoid GC pressure
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _cameraPos = new THREE.Vector3();

export function InstancedNodes({
  nodes,
  positions,
  colors,
  onEnterNode,
  onRightClickNode,
  displaySettings,
}: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowMeshRef = useRef<THREE.InstancedMesh>(null);
  const { camera, gl } = useThree();
  
  // Track which node is being looked at (for click handling)
  const lookedAtRef = useRef<number | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const centerScreen = useRef(new THREE.Vector2(0, 0));

  // Node ID to instance index mapping (reserved for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _nodeIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    nodes.forEach((node, index) => {
      map.set(node.id, index);
    });
    return map;
  }, [nodes]);

  // Instance index to node mapping (for raycasting)
  const indexNodeMap = useMemo(() => {
    return nodes.map(node => node);
  }, [nodes]);

  // Create shared geometry (cached)
  const sphereGeometry = useMemo(() => {
    return new THREE.SphereGeometry(0.5, 16, 16);
  }, []);

  const glowGeometry = useMemo(() => {
    return new THREE.SphereGeometry(0.75, 8, 8);
  }, []);

  // Create materials
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      roughness: 0.3,
      metalness: 0.7,
    });
  }, []);

  const glowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });
  }, []);

  // Update instance matrices and colors
  useEffect(() => {
    if (!meshRef.current || !glowMeshRef.current) return;

    const mesh = meshRef.current;
    const glowMesh = glowMeshRef.current;

    nodes.forEach((node, index) => {
      const pos = positions.get(node.id) || [node.position_x, node.position_y, node.position_z];
      const color = colors.get(node.id) || "#4fc3f7";
      const isAlive = node.is_alive;

      // Set position
      _position.set(pos[0], pos[1], pos[2]);
      _quaternion.identity();
      _scale.setScalar(displaySettings.nodeSize);

      _matrix.compose(_position, _quaternion, _scale);
      mesh.setMatrixAt(index, _matrix);

      // Set color
      _color.set(isAlive ? color : "#666");
      mesh.setColorAt(index, _color);

      // Glow - slightly larger
      _scale.setScalar(displaySettings.nodeSize * 1.5);
      _matrix.compose(_position, _quaternion, _scale);
      glowMesh.setMatrixAt(index, _matrix);
      
      _color.set(isAlive ? color : "#444");
      glowMesh.setColorAt(index, _color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    
    glowMesh.instanceMatrix.needsUpdate = true;
    if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
  }, [nodes, positions, colors, displaySettings.nodeSize]);

  // Animation frame - handle pulsing, LOD, and raycasting
  useFrame((state) => {
    if (!meshRef.current || !glowMeshRef.current) return;

    const mesh = meshRef.current;
    const glowMesh = glowMeshRef.current;
    const time = state.clock.elapsedTime;
    camera.getWorldPosition(_cameraPos);

    // Raycast to find looked-at node
    raycaster.current.setFromCamera(centerScreen.current, camera);
    const intersects = raycaster.current.intersectObject(mesh, false);
    
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      lookedAtRef.current = intersects[0].instanceId;
    } else {
      lookedAtRef.current = null;
    }

    // Update each instance
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const pos = positions.get(node.id) || [node.position_x, node.position_y, node.position_z];
      
      // Calculate distance for LOD
      _position.set(pos[0], pos[1], pos[2]);
      const distance = _position.distanceTo(_cameraPos);
      const lod = getLODLevel(distance);
      
      // Pulsing effect
      const pulse = 1 + Math.sin(time * 2 + node.id * 0.5) * 0.05;
      const isLookedAt = lookedAtRef.current === i;
      const scale = displaySettings.nodeSize * pulse * (isLookedAt ? 1.1 : 1);

      // Apply distance-based scaling to maintain visual consistency
      const baseDistance = 30;
      const distanceScale = Math.max(0.5, Math.min(2, distance / baseDistance));
      const finalScale = scale * distanceScale;

      _quaternion.identity();
      _scale.setScalar(finalScale);
      _matrix.compose(_position, _quaternion, _scale);
      mesh.setMatrixAt(i, _matrix);

      // Glow with LOD-based visibility
      if (lod.showGlow) {
        const glowScale = finalScale * 1.5 * (isLookedAt ? 1.2 : 1);
        _scale.setScalar(glowScale);
        _matrix.compose(_position, _quaternion, _scale);
        glowMesh.setMatrixAt(i, _matrix);
      } else {
        // Hide glow by scaling to 0
        _scale.setScalar(0);
        _matrix.compose(_position, _quaternion, _scale);
        glowMesh.setMatrixAt(i, _matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    glowMesh.instanceMatrix.needsUpdate = true;
  });

  // Click handler
  const handleClick = useCallback(() => {
    if (lookedAtRef.current !== null && onEnterNode) {
      const node = indexNodeMap[lookedAtRef.current];
      if (node) {
        onEnterNode(node.url, node.title || new URL(node.url).hostname);
      }
    }
  }, [onEnterNode, indexNodeMap]);

  // Register click handler
  useEffect(() => {
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [handleClick]);

  // Context menu handler
  const handleContextMenu = useCallback((event: MouseEvent) => {
    if (lookedAtRef.current !== null && onRightClickNode) {
      const node = indexNodeMap[lookedAtRef.current];
      if (node) {
        event.preventDefault();
        onRightClickNode(node, { x: event.clientX, y: event.clientY });
      }
    }
  }, [onRightClickNode, indexNodeMap]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("contextmenu", handleContextMenu);
    return () => canvas.removeEventListener("contextmenu", handleContextMenu);
  }, [gl, handleContextMenu]);

  return (
    <>
      {/* Main nodes - instanced */}
      <instancedMesh
        ref={meshRef}
        args={[sphereGeometry, material, nodes.length]}
        frustumCulled={true}
      />
      
      {/* Glow layer - instanced */}
      <instancedMesh
        ref={glowMeshRef}
        args={[glowGeometry, glowMaterial, nodes.length]}
        frustumCulled={true}
      />
    </>
  );
}

/**
 * Instanced Connections for efficient edge rendering
 */
interface InstancedConnectionsProps {
  edges: { source_id: number; target_id: number; id: number }[];
  positions: Map<number, [number, number, number]>;
  colors: Map<number, string>;
  visible?: boolean;
}

export function InstancedConnections({
  edges,
  positions,
  colors,
  visible = true,
}: InstancedConnectionsProps) {
  const linesRef = useRef<THREE.LineSegments>(null);

  // Create line geometry
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const vertexColors: number[] = [];

    edges.forEach(edge => {
      const start = positions.get(edge.source_id);
      const end = positions.get(edge.target_id);
      if (!start || !end) return;

      vertices.push(start[0], start[1], start[2]);
      vertices.push(end[0], end[1], end[2]);

      const startColor = new THREE.Color(colors.get(edge.source_id) || "#4fc3f7");
      const endColor = new THREE.Color(colors.get(edge.target_id) || "#4fc3f7");

      vertexColors.push(startColor.r, startColor.g, startColor.b);
      vertexColors.push(endColor.r, endColor.g, endColor.b);
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
    
    return geom;
  }, [edges, positions, colors]);

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
    });
  }, []);

  // Update geometry when positions change
  useEffect(() => {
    if (!linesRef.current) return;
    
    const geom = linesRef.current.geometry;
    const posAttr = geom.attributes.position;
    
    let idx = 0;
    edges.forEach(edge => {
      const start = positions.get(edge.source_id);
      const end = positions.get(edge.target_id);
      if (!start || !end) return;

      posAttr.setXYZ(idx, start[0], start[1], start[2]);
      posAttr.setXYZ(idx + 1, end[0], end[1], end[2]);
      idx += 2;
    });

    posAttr.needsUpdate = true;
  }, [positions, edges]);

  if (!visible) return null;

  return (
    <lineSegments ref={linesRef} geometry={geometry} material={material} frustumCulled={true} />
  );
}

/**
 * Hook to decide whether to use instanced rendering
 */
export function useInstancedRendering(nodeCount: number): boolean {
  return nodeCount >= INSTANCING_THRESHOLD;
}
