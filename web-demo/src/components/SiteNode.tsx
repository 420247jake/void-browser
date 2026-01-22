import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { DemoNode } from '../lib/types';

// Domain to color mapping
const domainColors: Record<string, string> = {
  'google.com': '#4285f4',
  'github.com': '#6e5494',
  'reddit.com': '#ff4500',
  'youtube.com': '#ff0000',
  'wikipedia.org': '#636363',
  'twitter.com': '#1da1f2',
  'x.com': '#ffffff',
  'discord.com': '#5865f2',
  'anthropic.com': '#d4a574',
  'claude.ai': '#d4a574',
  'openai.com': '#10a37f',
  'stackoverflow.com': '#f48024',
  'ycombinator.com': '#ff6600',
  'linkedin.com': '#0077b5',
  'facebook.com': '#1877f2',
  'instagram.com': '#e4405f',
  'twitch.tv': '#9146ff',
  'spotify.com': '#1db954',
  'netflix.com': '#e50914',
  'amazon.com': '#ff9900',
  'apple.com': '#555555',
  'microsoft.com': '#00a4ef',
  'mozilla.org': '#ff7139',
  'nodejs.org': '#339933',
  'python.org': '#3776ab',
  'rust-lang.org': '#dea584',
  'golang.org': '#00add8',
  'reactjs.org': '#61dafb',
  'vuejs.org': '#4fc08d',
  'angular.io': '#dd0031',
  'svelte.dev': '#ff3e00',
  'tailwindcss.com': '#06b6d4',
  'vercel.com': '#000000',
  'netlify.com': '#00c7b7',
  'cloudflare.com': '#f38020',
  'aws.amazon.com': '#ff9900',
  'docker.com': '#2496ed',
  'kubernetes.io': '#326ce5',
};

function getDomainColor(domain: string): string {
  if (domainColors[domain]) return domainColors[domain];
  for (const [key, value] of Object.entries(domainColors)) {
    if (domain.endsWith('.' + key) || domain === key) return value;
  }
  return '#4fc3f7';
}

function getThumbnailUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

interface SiteNodeProps {
  node: DemoNode;
  onClick?: (url: string, title: string) => void;
  size?: number;
  showLabel?: boolean;
  themeColor?: string;
  isHovered?: boolean;
  onRegisterMesh?: (mesh: THREE.Mesh | null) => void;
}

export function SiteNode({ 
  node, 
  onClick, 
  size = 1,
  showLabel = true,
  themeColor = '#4fc3f7',
  isHovered = false,
  onRegisterMesh,
}: SiteNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = getDomainColor(node.domain);
  
  // Register mesh with parent for raycasting
  useEffect(() => {
    if (onRegisterMesh) {
      onRegisterMesh(meshRef.current);
    }
    return () => {
      if (onRegisterMesh) {
        onRegisterMesh(null);
      }
    };
  }, [onRegisterMesh]);
  
  // Gentle pulsing animation
  useFrame((state) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2 + parseFloat(node.id)) * 0.05;
      meshRef.current.scale.setScalar(isHovered ? scale * 1.3 : scale);
    }
  });
  
  return (
    <group position={node.position}>
      {/* Glow sphere (outer) */}
      <Sphere args={[size * 0.8, 16, 16]}>
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={isHovered ? 0.35 : 0.15}
        />
      </Sphere>
      
      {/* Main node - clickable mesh */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(node.url, node.title);
        }}
      >
        <sphereGeometry args={[size * 0.5, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 1.0 : 0.4}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      
      {/* Label */}
      {showLabel && (
        <Html
          position={[0, size * 1.2, 0]}
          center
          style={{
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{
            background: 'rgba(10, 10, 30, 0.9)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${isHovered ? color : color + '55'}`,
            borderRadius: 6,
            padding: '5px 10px',
            color: '#fff',
            fontSize: 11,
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: isHovered 
              ? `0 2px 12px rgba(0,0,0,0.5), 0 0 30px ${color}50`
              : `0 2px 12px rgba(0,0,0,0.5), 0 0 20px ${color}30`,
            transition: 'all 0.2s ease',
            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
          }}>
            {node.favicon && (
              <img 
                src={node.favicon} 
                alt="" 
                style={{ width: 14, height: 14, borderRadius: 2 }}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <span style={{ 
              maxWidth: 150, 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              color: isHovered ? '#fff' : 'rgba(255,255,255,0.85)',
            }}>
              {node.title.length > 20 ? node.title.slice(0, 20) + '...' : node.title}
            </span>
          </div>
        </Html>
      )}
      
      {/* ========== HOVER INFO CARD (Glass Panel) ========== */}
      {isHovered && (
        <Html
          position={[size * 2.5, 0, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'rgba(10, 10, 30, 0.95)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${color}`,
            borderRadius: 12,
            padding: 0,
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
            width: 280,
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 40px ${color}40`,
            overflow: 'hidden',
          }}>
            {/* Thumbnail Preview Area */}
            <div style={{
              width: '100%',
              height: 100,
              background: `linear-gradient(135deg, ${color}22 0%, ${color}08 100%)`,
              borderBottom: `1px solid ${color}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Large favicon as placeholder */}
              <img 
                src={getThumbnailUrl(node.domain)} 
                alt=""
                style={{ 
                  width: 48, 
                  height: 48, 
                  opacity: 0.8,
                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              {/* Domain badge */}
              <div style={{
                position: 'absolute',
                top: 8,
                left: 8,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontFamily: 'monospace',
                color: color,
                border: `1px solid ${color}44`,
              }}>
                {node.domain}
              </div>
              {/* Status indicator */}
              <div style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px #22c55e',
              }} />
            </div>

            {/* Content Area */}
            <div style={{ padding: '12px 14px' }}>
              {/* Title */}
              <div style={{ 
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {node.favicon && (
                  <img 
                    src={node.favicon} 
                    alt=""
                    style={{ width: 14, height: 14, borderRadius: 3 }}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <span style={{ 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {node.title}
                </span>
              </div>

              {/* URL */}
              <div style={{ 
                fontSize: 10,
                color: 'rgba(79, 195, 247, 0.7)',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                marginBottom: 10,
                padding: '5px 7px',
                background: 'rgba(79, 195, 247, 0.08)',
                borderRadius: 4,
                border: '1px solid rgba(79, 195, 247, 0.15)',
                maxHeight: 36,
                overflow: 'hidden',
              }}>
                {node.url}
              </div>

              {/* Stats Row */}
              <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 10,
              }}>
                <div style={{
                  flex: 1,
                  padding: '6px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color }}>
                    {Math.floor(Math.random() * 10) + 1}
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    LINKS
                  </div>
                </div>
                <div style={{
                  flex: 1,
                  padding: '6px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#22c55e' }}>
                    ●
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    ALIVE
                  </div>
                </div>
                <div style={{
                  flex: 1,
                  padding: '6px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)' }}>
                    0
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    DEPTH
                  </div>
                </div>
              </div>

              {/* Action hint */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '7px',
                background: `${color}15`,
                borderRadius: 6,
                border: `1px solid ${color}33`,
              }}>
                <span style={{ fontSize: 10, color }}>
                  Click to open in new tab
                </span>
                <span style={{ fontSize: 12 }}>↗</span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
