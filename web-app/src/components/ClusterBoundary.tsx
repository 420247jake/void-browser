/**
 * Visual boundary component for domain clusters
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

interface ClusterBoundaryProps {
  domain: string;
  center: [number, number, number];
  radius: number;
  color?: string;
  showLabel?: boolean;
}

export function ClusterBoundary({
  domain,
  center,
  radius,
  color = "#4fc3f7",
  showLabel = true,
}: ClusterBoundaryProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Group>(null);

  // Subtle rotation animation
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.05;
      meshRef.current.rotation.x += delta * 0.02;
    }
  });

  // Generate wireframe sphere geometry
  const geometry = useMemo(() => {
    return new THREE.IcosahedronGeometry(radius, 1);
  }, [radius]);

  return (
    <group position={center}>
      {/* Wireframe boundary sphere */}
      <mesh ref={meshRef} geometry={geometry}>
        <meshBasicMaterial
          color={color}
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Inner glow sphere */}
      <mesh scale={0.98}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Domain label */}
      {showLabel && (
        <group ref={labelRef} position={[0, radius + 3, 0]}>
          <Text
            fontSize={2}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.1}
            outlineColor="#000"
          >
            {domain}
          </Text>
          {/* Node count badge */}
          <Text
            position={[0, -2.5, 0]}
            fontSize={1}
            color={color}
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.6}
          >
            cluster
          </Text>
        </group>
      )}
    </group>
  );
}

interface ClusterBoundariesProps {
  clusters: Map<string, {
    domain: string;
    center: [number, number, number];
    radius: number;
    nodes: { id: number }[];
  }>;
  showLabels?: boolean;
}

/**
 * Render all cluster boundaries
 */
export function ClusterBoundaries({ clusters, showLabels = true }: ClusterBoundariesProps) {
  // Generate colors for each domain
  const domainColors = useMemo(() => {
    const colors = new Map<string, string>();
    const palette = [
      "#4fc3f7", // cyan
      "#81c784", // green
      "#ffb74d", // orange
      "#ba68c8", // purple
      "#f06292", // pink
      "#4db6ac", // teal
      "#aed581", // light green
      "#ff8a65", // coral
      "#9575cd", // violet
      "#4dd0e1", // light cyan
    ];
    
    let i = 0;
    clusters.forEach((_, domain) => {
      colors.set(domain, palette[i % palette.length]);
      i++;
    });
    
    return colors;
  }, [clusters]);

  return (
    <>
      {Array.from(clusters.values()).map(cluster => (
        <ClusterBoundary
          key={cluster.domain}
          domain={cluster.domain}
          center={cluster.center}
          radius={cluster.radius}
          color={domainColors.get(cluster.domain)}
          showLabel={showLabels}
        />
      ))}
    </>
  );
}
