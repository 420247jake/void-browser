import { useRef, useState, useCallback, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Billboard } from "@react-three/drei";
import * as THREE from "three";

// Convert hex color to rgba string
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface SiteNodeProps {
  id: string;
  url: string;
  title: string;
  position: [number, number, number];
  isAlive?: boolean;
  favicon?: string;
  screenshot?: string;
  lastCrawled?: string;
  color?: string;
  onEnter?: (url: string, title: string) => void;
  onRightClick?: (screenPos: { x: number; y: number }) => void;
  scale?: number;
  showLabel?: boolean;
  labelScale?: number;
}

const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);

const PREVIEW_START_DISTANCE = 30;
const PREVIEW_FULL_DISTANCE = 12;
const LABEL_DISTANCE = 40;

export function SiteNode({ 
  id, 
  url, 
  title, 
  position, 
  isAlive = true, 
  favicon,
  screenshot,
  lastCrawled,
  color = "#4fc3f7",
  onEnter,
  onRightClick,
  scale: nodeScale = 1.0,
  showLabel: labelEnabled = true,
  labelScale = 1.0,
}: SiteNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [lookedAt, setLookedAt] = useState(false);
  const [distance, setDistance] = useState(100);
  const [previewOpacity, setPreviewOpacity] = useState(0);
  const { camera } = useThree();

  useFrame((state) => {
    if (groupRef.current && meshRef.current) {
      // Calculate distance
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      const dist = worldPos.distanceTo(camera.position);
      setDistance(dist);
      
      // Scale group to maintain consistent visual size
      // Base size at distance 30, scale proportionally
      const baseDistance = 30;
      const distanceScale = Math.max(0.5, Math.min(2, dist / baseDistance));
      const finalScale = distanceScale * nodeScale;
      groupRef.current.scale.setScalar(finalScale);
      
      // Pulsing
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2 + parseInt(id) * 0.5) * 0.05;
      const isActive = hovered || lookedAt;
      meshRef.current.scale.setScalar(isActive ? pulse * 1.1 : pulse);
      
      // Preview opacity
      if (dist < PREVIEW_START_DISTANCE) {
        const opacity = Math.min(1, (PREVIEW_START_DISTANCE - dist) / (PREVIEW_START_DISTANCE - PREVIEW_FULL_DISTANCE));
        setPreviewOpacity(opacity);
      } else {
        setPreviewOpacity(0);
      }
      
      // Raycast
      raycaster.setFromCamera(centerScreen, camera);
      const intersects = raycaster.intersectObject(meshRef.current, true);
      
      if (intersects.length > 0 && intersects[0].distance < 60) {
        if (!lookedAt) setLookedAt(true);
      } else {
        if (lookedAt) setLookedAt(false);
      }
    }
    
    if (glowRef.current) {
      const isActive = hovered || lookedAt;
      const glowMat = glowRef.current.material as THREE.MeshBasicMaterial;
      const intensity = 0.3 + Math.sin(state.clock.elapsedTime * 1.5 + parseInt(id)) * 0.15;
      glowMat.opacity = isActive ? Math.min(0.5, intensity + 0.2) : intensity;
    }
  });

  useEffect(() => {
    const handleClick = () => {
      if (lookedAt && onEnter) {
        onEnter(url, title);
      }
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [lookedAt, onEnter, url, title]);

  const handlePointerOver = useCallback((e: any) => {
    e.stopPropagation?.();
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback((e: any) => {
    e.stopPropagation?.();
    setHovered(false);
    document.body.style.cursor = "default";
  }, []);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation?.();
    if (onEnter) onEnter(url, title);
  }, [url, title, onEnter]);

  const handleContextMenu = useCallback((e: any) => {
    e.stopPropagation?.();
    // Get native event for screen coordinates
    const nativeEvent = (e as any).nativeEvent as MouseEvent;
    if (onRightClick && nativeEvent) {
      onRightClick({ x: nativeEvent.clientX, y: nativeEvent.clientY });
    }
  }, [onRightClick]);

  const coreColor = isAlive ? color : "#666";
  const glowColor = isAlive ? color : "#444";
  
  const isActive = hovered || lookedAt;
  const showLabel = labelEnabled && (isActive || distance < LABEL_DISTANCE);
  const showPreview = previewOpacity > 0.1;

  const formatLastCrawled = (dateStr?: string) => {
    if (!dateStr) return "Never crawled";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  // Extract domain for fallback display
  const getDomain = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname.replace('www.', '');
    } catch {
      return urlStr;
    }
  };

  const previewSize = 140 + previewOpacity * 100;

  return (
    <group position={position} ref={groupRef}>
      {/* Core sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={isActive ? 0.8 : 0.5}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Glow */}
      <mesh ref={glowRef} scale={isActive ? 1.8 : 1.5}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.25}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Ring when active */}
      {isActive && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.0, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Site Preview - Billboard so it always faces camera */}
      {showPreview && (
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          <Html
            center
            zIndexRange={[50, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}
            distanceFactor={10}
          >
            <div style={{
              width: previewSize,
              height: previewSize * 0.65,
              borderRadius: 8,
              overflow: "hidden",
              opacity: previewOpacity,
              transition: "opacity 0.15s ease",
              boxShadow: `0 0 ${15 + previewOpacity * 15}px ${hexToRgba(color, 0.2 + previewOpacity * 0.3)}`,
              border: `2px solid ${hexToRgba(color, 0.3 + previewOpacity * 0.4)}`,
              background: "#0a0a1a",
            }}>
              {screenshot ? (
                // Use crawled screenshot
                <img 
                  src={screenshot} 
                  alt={title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                // Fallback card (no iframe - prevents CSP errors and visual glitches)
                <div style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #1a1a2e 0%, #0a0a1a 100%)",
                  color: color,
                  fontFamily: "monospace",
                  textAlign: "center",
                  padding: 10,
                }}>
                  {favicon ? (
                    <img 
                      src={favicon} 
                      alt="" 
                      style={{ width: 32, height: 32, marginBottom: 8, borderRadius: 4 }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🌐</div>
                  )}
                  <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 10, opacity: 0.6 }}>{getDomain(url)}</div>
                  <div style={{ 
                    fontSize: 9, 
                    opacity: 0.4, 
                    marginTop: 8,
                    padding: "4px 8px",
                    background: hexToRgba(color, 0.1),
                    borderRadius: 4,
                  }}>
                    Click to visit
                  </div>
                </div>
              )}
            </div>
          </Html>
        </Billboard>
      )}

      {/* Label - also billboard */}
      {showLabel && (
        <Billboard follow={true}>
          <Html
            position={[0, showPreview ? 2.2 : 1.0, 0]}
            center
            zIndexRange={[100, 0]}
            style={{ pointerEvents: "none", userSelect: "none", transform: `scale(${labelScale})` }}
            distanceFactor={10}
          >
            <div style={{
              background: isActive ? hexToRgba(color, 0.12) : "rgba(10, 10, 30, 0.85)",
              border: isActive ? `2px solid ${color}` : `1px solid ${hexToRgba(color, 0.4)}`,
              borderRadius: 6,
              padding: isActive ? "8px 14px" : "5px 10px",
              color: color,
              fontSize: isActive ? 13 : 11,
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              textShadow: `0 0 6px ${hexToRgba(color, 0.6)}`,
              boxShadow: isActive ? `0 0 15px ${hexToRgba(color, 0.3)}` : "none",
              transition: "all 0.15s ease",
            }}>
              <div style={{ 
                fontWeight: "bold", 
                marginBottom: isActive ? 3 : 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                {favicon && (
                  <img 
                    src={favicon} 
                    alt="" 
                    style={{ width: 14, height: 14, borderRadius: 2 }}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                {title}
              </div>
              {isActive && (
                <>
                  <div style={{ opacity: 0.6, fontSize: 10, marginBottom: 3 }}>{url}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 9, opacity: 0.4 }}>{formatLastCrawled(lastCrawled)}</span>
                    <span style={{ 
                      fontSize: 9, 
                      background: hexToRgba(color, 0.2),
                      padding: "2px 6px",
                      borderRadius: 3,
                    }}>
                      CLICK TO ENTER
                    </span>
                  </div>
                </>
              )}
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  );
}
