/**
 * Performance Stats Overlay
 * 
 * Shows FPS, render stats, and graph visibility info.
 * Toggle with Shift+P
 */

import { useState, useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

export interface PerfStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memoryMB: number;
}

interface PerformanceOverlayProps {
  totalNodes: number;
  totalEdges: number;
  visibleNodes?: number;
  visibleEdges?: number;
  theme?: string;
}

/**
 * Performance Overlay - goes INSIDE Canvas
 * Uses Html from drei to render overlay
 */
export function PerformanceOverlay({
  totalNodes,
  totalEdges,
  visibleNodes,
  visibleEdges,
  theme = "cyan",
}: PerformanceOverlayProps) {
  const { gl } = useThree();
  const [isVisible, setIsVisible] = useState(false);
  const [stats, setStats] = useState<PerfStats>({
    fps: 60,
    frameTime: 16.67,
    drawCalls: 0,
    triangles: 0,
    memoryMB: 0,
  });
  
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());

  // Toggle visibility with Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toUpperCase() === "P" && e.shiftKey) {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Collect stats every frame
  useFrame(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;

    frameTimesRef.current.push(delta);
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }

    // Update stats every 10 frames
    if (frameTimesRef.current.length % 10 === 0) {
      const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      const info = gl.info;
      
      setStats({
        fps: Math.round(1000 / avgFrameTime),
        frameTime: avgFrameTime,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        memoryMB: (performance as any).memory 
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
          : 0,
      });
    }
  });

  // Color based on theme
  const colors: Record<string, string> = {
    cyan: "#4fc3f7",
    green: "#4caf50",
    purple: "#b388ff",
    orange: "#ff9800",
    pink: "#f48fb1",
    red: "#f44336",
    yellow: "#ffeb3b",
    white: "#ffffff",
  };
  const color = colors[theme] || colors.cyan;
  const fpsColor = stats.fps >= 55 ? "#4caf50" : stats.fps >= 30 ? "#ff9800" : "#f44336";

  const actualVisibleNodes = visibleNodes ?? totalNodes;
  const actualVisibleEdges = visibleEdges ?? totalEdges;

  return (
    <Html
      fullscreen
      style={{ pointerEvents: "none" }}
      zIndexRange={[1000, 0]}
    >
      {!isVisible ? (
        <div style={{
          position: "fixed",
          top: 50,
          right: 10,
          fontSize: 10,
          fontFamily: "monospace",
          color: "rgba(255,255,255,0.3)",
        }}>
          Shift+P for stats
        </div>
      ) : (
        <div style={{
          position: "fixed",
          top: 50,
          right: 10,
          background: "rgba(10, 10, 30, 0.9)",
          border: `1px solid ${color}`,
          borderRadius: 8,
          padding: "12px 16px",
          fontFamily: "monospace",
          fontSize: 11,
          color,
          minWidth: 180,
          boxShadow: `0 0 20px rgba(${parseInt(color.slice(1,3), 16)}, ${parseInt(color.slice(3,5), 16)}, ${parseInt(color.slice(5,7), 16)}, 0.3)`,
          pointerEvents: "auto",
        }}>
          <div style={{ 
            fontWeight: "bold", 
            marginBottom: 8, 
            fontSize: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span>⚡ PERFORMANCE</span>
            <span style={{ fontSize: 16, color: fpsColor, fontWeight: "bold" }}>
              {stats.fps} FPS
            </span>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 10px", opacity: 0.9 }}>
            <span style={{ opacity: 0.6 }}>Frame time:</span>
            <span>{stats.frameTime.toFixed(1)}ms</span>
            
            <span style={{ opacity: 0.6 }}>Draw calls:</span>
            <span>{stats.drawCalls}</span>
            
            <span style={{ opacity: 0.6 }}>Triangles:</span>
            <span>{(stats.triangles / 1000).toFixed(1)}k</span>
            
            {stats.memoryMB > 0 && (
              <>
                <span style={{ opacity: 0.6 }}>Memory:</span>
                <span>{stats.memoryMB} MB</span>
              </>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${color}33`, marginTop: 8, paddingTop: 8 }}>
            <div style={{ marginBottom: 4, fontWeight: "bold", fontSize: 10 }}>VISIBILITY</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 10px" }}>
              <span style={{ opacity: 0.6 }}>Nodes:</span>
              <span>
                {actualVisibleNodes} / {totalNodes}
                {actualVisibleNodes < totalNodes && (
                  <span style={{ color: "#4caf50", marginLeft: 4 }}>
                    ({Math.round((totalNodes - actualVisibleNodes) / totalNodes * 100)}% culled)
                  </span>
                )}
              </span>
              
              <span style={{ opacity: 0.6 }}>Edges:</span>
              <span>{actualVisibleEdges} / {totalEdges}</span>
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 9, opacity: 0.5, textAlign: "center" }}>
            Press Shift+P to hide
          </div>
        </div>
      )}
    </Html>
  );
}
