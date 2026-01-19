import { useRef, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface TeleportTarget {
  position: THREE.Vector3;
  nodeId: number;
}

// Shared state for teleport
let teleportTarget: TeleportTarget | null = null;
let isTeleporting = false;

// Function to trigger teleport from outside React Three Fiber
export function triggerTeleport(nodeId: number, position: [number, number, number]) {
  teleportTarget = {
    position: new THREE.Vector3(position[0], position[1], position[2] + 15), // Offset to view node
    nodeId,
  };
  isTeleporting = true;
}

interface CameraTeleportProps {
  onTeleportComplete?: (nodeId: number) => void;
}

export function CameraTeleport({ onTeleportComplete }: CameraTeleportProps) {
  const { camera } = useThree();
  const progressRef = useRef(0);
  const startPosRef = useRef(new THREE.Vector3());
  const startRotRef = useRef(new THREE.Euler());
  
  useFrame((_, delta) => {
    if (!isTeleporting || !teleportTarget) return;
    
    // Initialize teleport
    if (progressRef.current === 0) {
      startPosRef.current.copy(camera.position);
      startRotRef.current.copy(camera.rotation);
    }
    
    // Smooth easing
    progressRef.current += delta * 2; // Speed of teleport
    const t = Math.min(progressRef.current, 1);
    const eased = easeInOutCubic(t);
    
    // Lerp position
    camera.position.lerpVectors(startPosRef.current, teleportTarget.position, eased);
    
    // Look at target
    const lookTarget = new THREE.Vector3(
      teleportTarget.position.x,
      teleportTarget.position.y,
      teleportTarget.position.z - 15 // Look at where the node is
    );
    
    // Smoothly rotate towards target
    const targetQuat = new THREE.Quaternion();
    const tempCamera = new THREE.Object3D();
    tempCamera.position.copy(camera.position);
    tempCamera.lookAt(lookTarget);
    targetQuat.setFromEuler(tempCamera.rotation);
    
    camera.quaternion.slerp(targetQuat, eased * 0.5);
    
    // Complete teleport
    if (t >= 1) {
      isTeleporting = false;
      progressRef.current = 0;
      
      if (onTeleportComplete) {
        onTeleportComplete(teleportTarget.nodeId);
      }
      teleportTarget = null;
    }
  });
  
  return null;
}

// Easing function for smooth movement
function easeInOutCubic(t: number): number {
  return t < 0.5 
    ? 4 * t * t * t 
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Hook for managing navigation history
export function useNavigationHistory() {
  const historyRef = useRef<Array<{ nodeId: number; position: [number, number, number] }>>([]);
  const currentIndexRef = useRef(-1);
  
  const addToHistory = useCallback((nodeId: number, position: [number, number, number]) => {
    // Remove any forward history when adding new entry
    historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1);
    historyRef.current.push({ nodeId, position });
    currentIndexRef.current = historyRef.current.length - 1;
    
    // Limit history size
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      currentIndexRef.current--;
    }
  }, []);
  
  const goBack = useCallback(() => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current--;
      const entry = historyRef.current[currentIndexRef.current];
      triggerTeleport(entry.nodeId, entry.position);
      return true;
    }
    return false;
  }, []);
  
  const goForward = useCallback(() => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      currentIndexRef.current++;
      const entry = historyRef.current[currentIndexRef.current];
      triggerTeleport(entry.nodeId, entry.position);
      return true;
    }
    return false;
  }, []);
  
  const getHistory = useCallback(() => {
    return {
      entries: historyRef.current,
      currentIndex: currentIndexRef.current,
      canGoBack: currentIndexRef.current > 0,
      canGoForward: currentIndexRef.current < historyRef.current.length - 1,
    };
  }, []);
  
  return {
    addToHistory,
    goBack,
    goForward,
    getHistory,
  };
}
