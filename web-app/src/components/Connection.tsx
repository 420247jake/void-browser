import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Line } from "@react-three/drei";

interface ConnectionProps {
  start: [number, number, number];
  end: [number, number, number];
  startColor?: string;
  endColor?: string;
  color?: string;
  animated?: boolean;
  particleCount?: number;
  particleSpeed?: number;
}

export function Connection({ start, end, startColor, endColor, color = "#4fc3f7" }: ConnectionProps) {
  const lineColor = startColor || color;
  const lineEndColor = endColor || lineColor;
  
  const points = useMemo(() => [start, end], [start, end]);
  const colors = useMemo(() => [
    new THREE.Color(lineColor),
    new THREE.Color(lineEndColor)
  ], [lineColor, lineEndColor]);

  return (
    <Line
      points={points}
      vertexColors={colors}
      transparent
      opacity={0.4}
      lineWidth={1}
    />
  );
}

// Enhanced connection with flowing particles
export function AnimatedConnection({ 
  start, 
  end, 
  startColor, 
  endColor, 
  color = "#4fc3f7",
  particleCount = 3,
  particleSpeed = 0.5,
}: ConnectionProps) {
  const lineColor = startColor || color;
  const lineEndColor = endColor || lineColor;
  const particlesRef = useRef<THREE.Points>(null);
  const [particleOffsets] = useState(() => 
    Array.from({ length: particleCount }, () => Math.random())
  );
  
  const points = useMemo(() => [start, end], [start, end]);
  const colors = useMemo(() => [
    new THREE.Color(lineColor),
    new THREE.Color(lineEndColor)
  ], [lineColor, lineEndColor]);

  // Direction vector for particle movement
  const direction = useMemo(() => {
    return new THREE.Vector3(
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2]
    );
  }, [start, end]);

  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);

  // Particle geometry
  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = start[0];
      positions[i * 3 + 1] = start[1];
      positions[i * 3 + 2] = start[2];
      sizes[i] = 0.08 + Math.random() * 0.04;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geometry;
  }, [start, particleCount]);

  // Animate particles along the line
  useFrame((state) => {
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      const time = state.clock.elapsedTime * particleSpeed;
      
      for (let i = 0; i < particleCount; i++) {
        // Calculate position along line (0-1)
        const t = (time + particleOffsets[i]) % 1;
        
        // Interpolate position
        positions[i * 3] = startVec.x + direction.x * t;
        positions[i * 3 + 1] = startVec.y + direction.y * t;
        positions[i * 3 + 2] = startVec.z + direction.z * t;
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Base line */}
      <Line
        points={points}
        vertexColors={colors}
        transparent
        opacity={0.3}
        lineWidth={1}
      />
      
      {/* Flowing particles */}
      <points ref={particlesRef} geometry={particleGeometry}>
        <pointsMaterial
          color={lineColor}
          size={0.15}
          transparent
          opacity={0.9}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// Glowing tube connection (existing)
export function GlowConnection({ start, end, startColor, endColor: _endColor, color = "#4fc3f7" }: ConnectionProps) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const lineColor = startColor || color;

  const curve = useMemo(() => {
    return new THREE.LineCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    );
  }, [start, end]);

  useFrame((state) => {
    if (tubeRef.current) {
      const material = tubeRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
    }
  });

  return (
    <mesh ref={tubeRef}>
      <tubeGeometry args={[curve, 1, 0.02, 8, false]} />
      <meshBasicMaterial
        color={lineColor}
        transparent
        opacity={0.4}
      />
    </mesh>
  );
}

// Pulsing energy connection - energy waves travel along the line
export function EnergyConnection({ 
  start, 
  end, 
  color = "#4fc3f7",
}: ConnectionProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  
  const curve = useMemo(() => {
    return new THREE.LineCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    );
  }, [start, end]);

  const length = useMemo(() => {
    return new THREE.Vector3(...start).distanceTo(new THREE.Vector3(...end));
  }, [start, end]);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.2 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
    
    if (pulseRef.current) {
      // Move pulse along the tube
      const t = (state.clock.elapsedTime * 0.5) % 1;
      const pos = curve.getPoint(t);
      pulseRef.current.position.copy(pos);
      
      // Pulse size
      const pulseScale = 0.8 + Math.sin(state.clock.elapsedTime * 8) * 0.2;
      pulseRef.current.scale.setScalar(pulseScale);
    }
  });

  return (
    <group>
      {/* Base tube */}
      <mesh ref={meshRef}>
        <tubeGeometry args={[curve, Math.max(2, Math.floor(length / 2)), 0.015, 6, false]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.25}
        />
      </mesh>
      
      {/* Traveling pulse */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}
