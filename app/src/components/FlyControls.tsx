import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FlyControlsProps {
  speed?: number;
  rollSpeed?: number;
  enabled?: boolean;
  onLockChange?: (locked: boolean) => void;
}

export function FlyControls({ speed = 15, rollSpeed = 2, enabled = true, onLockChange }: FlyControlsProps) {
  const { camera, gl } = useThree();
  
  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    rollLeft: false,
    rollRight: false,
    sprint: false,
  });
  
  const velocity = useRef(new THREE.Vector3());
  const rotation = useRef({ x: 0, y: 0 });
  const isPointerLocked = useRef(false);
  const enabledRef = useRef(enabled);

  // Keep enabled ref in sync
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const domElement = gl.domElement;

    // Keyboard handlers
    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      
      switch (e.code) {
        case "KeyW": moveState.current.forward = true; break;
        case "KeyS": moveState.current.backward = true; break;
        case "KeyA": moveState.current.left = true; break;
        case "KeyD": moveState.current.right = true; break;
        case "Space": moveState.current.up = true; break;
        case "ShiftLeft": 
        case "ShiftRight": 
          moveState.current.down = true; 
          break;
        case "KeyQ": moveState.current.rollLeft = true; break;
        case "KeyE": moveState.current.rollRight = true; break;
        case "ControlLeft":
        case "ControlRight":
          moveState.current.sprint = true;
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": moveState.current.forward = false; break;
        case "KeyS": moveState.current.backward = false; break;
        case "KeyA": moveState.current.left = false; break;
        case "KeyD": moveState.current.right = false; break;
        case "Space": moveState.current.up = false; break;
        case "ShiftLeft":
        case "ShiftRight":
          moveState.current.down = false;
          break;
        case "KeyQ": moveState.current.rollLeft = false; break;
        case "KeyE": moveState.current.rollRight = false; break;
        case "ControlLeft":
        case "ControlRight":
          moveState.current.sprint = false;
          break;
      }
    };

    // Mouse look (pointer lock)
    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked.current || !enabledRef.current) return;
      
      rotation.current.y -= e.movementX * 0.002;
      rotation.current.x -= e.movementY * 0.002;
      
      // Clamp vertical rotation
      rotation.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.current.x));
    };

    const onClick = () => {
      if (!isPointerLocked.current && enabledRef.current) {
        // Prevent rapid re-requests
        if (document.pointerLockElement) return;
        domElement.requestPointerLock().catch(() => {
          // Silently ignore pointer lock errors (user cancelled, etc.)
        });
      }
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === domElement;
      isPointerLocked.current = locked;
      onLockChange?.(locked);
    };

    const onPointerLockError = () => {
      console.error("Pointer lock failed");
    };

    // Add listeners
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    domElement.addEventListener("click", onClick);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("pointerlockerror", onPointerLockError);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      domElement.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("pointerlockerror", onPointerLockError);
    };
  }, [gl]);

  useFrame((_, delta) => {
    // Don't process movement if disabled
    if (!enabledRef.current) {
      velocity.current.set(0, 0, 0);
      return;
    }

    const actualSpeed = moveState.current.sprint ? speed * 2.5 : speed;
    
    // Calculate movement direction
    const direction = new THREE.Vector3();
    
    if (moveState.current.forward) direction.z -= 1;
    if (moveState.current.backward) direction.z += 1;
    if (moveState.current.left) direction.x -= 1;
    if (moveState.current.right) direction.x += 1;
    if (moveState.current.up) direction.y += 1;
    if (moveState.current.down) direction.y -= 1;
    
    direction.normalize();
    
    // Apply camera rotation to movement
    direction.applyQuaternion(camera.quaternion);
    
    // Smooth velocity
    velocity.current.lerp(direction.multiplyScalar(actualSpeed), 0.1);
    
    // Apply movement
    camera.position.add(velocity.current.clone().multiplyScalar(delta));
    
    // Apply rotation from mouse
    camera.rotation.order = "YXZ";
    camera.rotation.y = rotation.current.y;
    camera.rotation.x = rotation.current.x;
    
    // Roll
    if (moveState.current.rollLeft) {
      camera.rotation.z += rollSpeed * delta;
    }
    if (moveState.current.rollRight) {
      camera.rotation.z -= rollSpeed * delta;
    }
  });

  return null;
}
