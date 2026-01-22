import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { VoidScene } from './components/VoidScene';
import { FlyControls } from './components/FlyControls';
import { SAMPLE_NODES, SAMPLE_EDGES, createDemoNode } from './lib/sampleData';
import { DemoNode, DemoEdge } from './lib/types';

function App() {
  const [nodes, setNodes] = useState<DemoNode[]>(SAMPLE_NODES);
  const [edges, setEdges] = useState<DemoEdge[]>(SAMPLE_EDGES);
  const [showUrlBar, setShowUrlBar] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);
  const [showEdges, setShowEdges] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [bloomIntensity, setBloomIntensity] = useState(1.2);
  const [isLocked, setIsLocked] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Void Browser theme color
  const themeColor = '#4fc3f7';

  // Handle opening a node - only when cursor locked
  const handleEnterNode = useCallback((url: string, title: string) => {
    if (document.pointerLockElement) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // Simulate a mini crawl
  const handleAddUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      setCrawlStatus('Fetching...');
      const newNode = createDemoNode(url);
      
      setCrawlStatus('Crawling ' + newNode.domain + '...');
      await new Promise(r => setTimeout(r, 800));
      
      const numLinks = Math.floor(Math.random() * 3) + 1;
      const newEdges: DemoEdge[] = [];
      const shuffled = [...nodes].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < numLinks && i < shuffled.length; i++) {
        newEdges.push({
          id: `e-new-${Date.now()}-${i}`,
          source: newNode.id,
          target: shuffled[i].id,
        });
      }
      
      setCrawlStatus(`Found ${numLinks} connections`);
      await new Promise(r => setTimeout(r, 500));
      
      setNodes(prev => [...prev, newNode]);
      setEdges(prev => [...prev, ...newEdges]);
      setUrlInput('');
      setShowUrlBar(false);
      setCrawlStatus(null);
      
    } catch (err) {
      setCrawlStatus('Failed to add URL');
      setTimeout(() => setCrawlStatus(null), 2000);
    }
  }, [urlInput, nodes]);

  const handleReset = useCallback(() => {
    setNodes(SAMPLE_NODES);
    setEdges(SAMPLE_EDGES);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddUrl();
    else if (e.key === 'Escape') {
      setShowUrlBar(false);
      setShowSettings(false);
      setCrawlStatus(null);
    }
  }, [handleAddUrl]);

  // Global keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowUrlBar(true);
        setTimeout(() => urlInputRef.current?.focus(), 50);
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowControls(prev => !prev);
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setShowSettings(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const anyModalOpen = showUrlBar || showSettings;

  // Glass panel style (like Void Browser desktop)
  const glassPanel = {
    background: 'rgba(10, 10, 30, 0.85)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(79, 195, 247, 0.3)',
    borderRadius: 8,
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a1a', overflow: 'hidden' }}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 5, 50], fov: 70 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0a0a1a']} />
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color={themeColor} />
        <fog attach="fog" args={['#0a0a1a', 30, 150]} />
        <Stars radius={200} depth={100} count={3000} factor={4} saturation={0} fade speed={0.3} />
        
        <Suspense fallback={null}>
          <VoidScene 
            nodes={nodes} 
            edges={edges} 
            onEnterNode={handleEnterNode}
            showEdges={showEdges}
            showLabels={showLabels}
            themeColor={themeColor}
          />
        </Suspense>
        
        <FlyControls 
          speed={20} 
          enabled={!anyModalOpen}
          onLockChange={setIsLocked}
        />
        
        <EffectComposer>
          <Bloom 
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            intensity={bloomIntensity}
          />
        </EffectComposer>
      </Canvas>

      {/* ========== TOP BAR (like Void Browser) ========== */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: 'rgba(10, 10, 30, 0.9)',
          borderBottom: '1px solid rgba(79, 195, 247, 0.2)',
          backdropFilter: 'blur(10px)',
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div
          style={{
            color: themeColor,
            fontFamily: 'monospace',
            fontSize: 16,
            fontWeight: 'bold',
            textShadow: `0 0 10px rgba(79, 195, 247, 0.5)`,
          }}
        >
          VOID
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'rgba(79, 195, 247, 0.2)' }} />

        {/* Session Name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'rgba(79, 195, 247, 0.1)',
            border: '1px solid rgba(79, 195, 247, 0.3)',
            borderRadius: 6,
            color: themeColor,
            fontFamily: 'monospace',
            fontSize: 13,
          }}
        >
          <span>Demo Session</span>
          <span style={{ 
            background: 'rgba(255, 150, 50, 0.3)', 
            color: '#ffaa55',
            padding: '2px 6px', 
            borderRadius: 4, 
            fontSize: 10,
            fontWeight: 'bold',
          }}>
            DEMO
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Stats */}
        <div
          style={{
            color: 'rgba(79, 195, 247, 0.7)',
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          {nodes.length} nodes · {edges.length} edges
        </div>

        {/* Download Button */}
        <a
          href="https://github.com/420247jake/void-browser/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '6px 14px',
            background: 'rgba(79, 195, 247, 0.15)',
            border: '1px solid rgba(79, 195, 247, 0.4)',
            borderRadius: 6,
            color: themeColor,
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: 'bold',
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(79, 195, 247, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(79, 195, 247, 0.15)';
          }}
        >
          ⬇️ Download Full App
        </a>
      </div>

      {/* ========== SETTINGS PANEL ========== */}
      {showSettings && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            right: 16,
            width: 280,
            ...glassPanel,
            padding: 16,
            zIndex: 150,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid rgba(79, 195, 247, 0.2)',
          }}>
            <span style={{ color: themeColor, fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14 }}>
              ⚙️ Settings
            </span>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(79, 195, 247, 0.5)',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              ✕
            </button>
          </div>

          {/* Display Options */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: 'rgba(79, 195, 247, 0.5)', fontFamily: 'monospace', fontSize: 10, marginBottom: 10 }}>
              DISPLAY
            </div>
            
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              color: themeColor,
              fontFamily: 'monospace',
              fontSize: 12,
              marginBottom: 8,
              cursor: 'pointer',
            }}>
              <span>Show Edges</span>
              <input
                type="checkbox"
                checked={showEdges}
                onChange={(e) => setShowEdges(e.target.checked)}
                style={{ accentColor: themeColor, cursor: 'pointer' }}
              />
            </label>
            
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              color: themeColor,
              fontFamily: 'monospace',
              fontSize: 12,
              marginBottom: 8,
              cursor: 'pointer',
            }}>
              <span>Show Labels</span>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                style={{ accentColor: themeColor, cursor: 'pointer' }}
              />
            </label>
          </div>

          {/* Effects */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: 'rgba(79, 195, 247, 0.5)', fontFamily: 'monospace', fontSize: 10, marginBottom: 10 }}>
              EFFECTS
            </div>
            
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                color: themeColor,
                fontFamily: 'monospace',
                fontSize: 12,
                marginBottom: 6,
              }}>
                <span>Bloom</span>
                <span style={{ opacity: 0.5 }}>{bloomIntensity.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={bloomIntensity}
                onChange={(e) => setBloomIntensity(parseFloat(e.target.value))}
                style={{ 
                  width: '100%',
                  accentColor: themeColor,
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div>
            <div style={{ color: 'rgba(79, 195, 247, 0.5)', fontFamily: 'monospace', fontSize: 10, marginBottom: 10 }}>
              ACTIONS
            </div>
            
            <button
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                border: '1px solid rgba(79, 195, 247, 0.3)',
                borderRadius: 6,
                color: themeColor,
                fontFamily: 'monospace',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(79, 195, 247, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              🔄 Reset Demo Data
            </button>
          </div>
        </div>
      )}

      {/* ========== DEMO INFO PANEL ========== */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 16,
          maxWidth: 260,
          ...glassPanel,
          padding: '14px 16px',
          zIndex: 90,
        }}
      >
        <div style={{ 
          color: themeColor, 
          fontFamily: 'monospace', 
          fontWeight: 'bold', 
          fontSize: 12,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          🎮 Web Demo
        </div>
        <p style={{ 
          color: 'rgba(79, 195, 247, 0.7)', 
          fontFamily: 'system-ui, sans-serif',
          fontSize: 11,
          lineHeight: 1.5,
          margin: 0,
        }}>
          Fly through a sample web graph. The full desktop app includes real crawling, screenshots, and database storage.
        </p>
        <div style={{ 
          marginTop: 12, 
          paddingTop: 10, 
          borderTop: '1px solid rgba(79, 195, 247, 0.2)',
          display: 'flex',
          gap: 12,
          fontFamily: 'monospace',
          fontSize: 11,
        }}>
          <span>
            <kbd style={{ 
              background: 'rgba(79, 195, 247, 0.2)', 
              color: themeColor,
              padding: '2px 6px', 
              borderRadius: 3,
              marginRight: 4,
            }}>N</kbd>
            <span style={{ color: 'rgba(79, 195, 247, 0.6)' }}>Add URL</span>
          </span>
          <span>
            <kbd style={{ 
              background: 'rgba(79, 195, 247, 0.2)', 
              color: themeColor,
              padding: '2px 6px', 
              borderRadius: 3,
              marginRight: 4,
            }}>F1</kbd>
            <span style={{ color: 'rgba(79, 195, 247, 0.6)' }}>Settings</span>
          </span>
        </div>
      </div>

      {/* ========== URL INPUT MODAL ========== */}
      {showUrlBar && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 200,
        }}>
          <div style={{
            ...glassPanel,
            border: `2px solid ${themeColor}`,
            padding: '20px 24px',
            boxShadow: `0 0 40px rgba(79, 195, 247, 0.3)`,
          }}>
            <div style={{ 
              color: themeColor, 
              fontFamily: 'monospace',
              fontSize: 14, 
              fontWeight: 'bold',
              marginBottom: 14,
            }}>
              🌐 Add URL to the Void
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                ref={urlInputRef}
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter URL (e.g., github.com)"
                style={{
                  width: 320,
                  padding: '12px 16px',
                  background: 'rgba(79, 195, 247, 0.1)',
                  border: '1px solid rgba(79, 195, 247, 0.3)',
                  borderRadius: 6,
                  color: themeColor,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  outline: 'none',
                }}
                autoFocus
              />
              <button
                onClick={handleAddUrl}
                style={{
                  padding: '12px 20px',
                  background: 'rgba(79, 195, 247, 0.2)',
                  border: '1px solid rgba(79, 195, 247, 0.5)',
                  borderRadius: 6,
                  color: themeColor,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setShowUrlBar(false); setCrawlStatus(null); }}
                style={{
                  padding: '12px 14px',
                  background: 'transparent',
                  border: '1px solid rgba(79, 195, 247, 0.3)',
                  borderRadius: 6,
                  color: themeColor,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: 0.7,
                }}
              >
                ✕
              </button>
            </div>
            {crawlStatus && (
              <div style={{
                marginTop: 12,
                color: themeColor,
                fontFamily: 'monospace',
                fontSize: 12,
              }}>
                🔄 {crawlStatus}
              </div>
            )}
            <div style={{
              marginTop: 12,
              color: 'rgba(79, 195, 247, 0.4)',
              fontFamily: 'monospace',
              fontSize: 10,
            }}>
              Demo: URLs added with simulated connections
            </div>
          </div>
        </div>
      )}

      {/* ========== CONTROLS PANEL ========== */}
      {showControls && !anyModalOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            ...glassPanel,
            padding: '14px 18px',
            zIndex: 90,
          }}
        >
          <div style={{ 
            color: themeColor, 
            fontFamily: 'monospace', 
            fontWeight: 'bold', 
            fontSize: 12,
            marginBottom: 10,
          }}>
            CONTROLS
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'auto auto', 
            gap: '4px 16px',
            fontFamily: 'monospace',
            fontSize: 11,
          }}>
            <span style={{ color: 'rgba(79, 195, 247, 0.5)' }}>Click</span>
            <span style={{ color: themeColor }}>Lock mouse / Open site</span>
            <span style={{ color: 'rgba(79, 195, 247, 0.5)' }}>WASD</span>
            <span style={{ color: themeColor }}>Move</span>
            <span style={{ color: 'rgba(79, 195, 247, 0.5)' }}>Space / Shift</span>
            <span style={{ color: themeColor }}>Up / Down</span>
            <span style={{ color: 'rgba(79, 195, 247, 0.5)' }}>Q / E</span>
            <span style={{ color: themeColor }}>Roll</span>
            <span style={{ color: 'rgba(79, 195, 247, 0.5)' }}>Ctrl</span>
            <span style={{ color: themeColor }}>Sprint</span>
            <span style={{ color: 'rgba(79, 195, 247, 0.5)' }}>N</span>
            <span style={{ color: themeColor }}>Add URL</span>
            <span style={{ color: 'rgba(79, 195, 247, 0.5)' }}>F1</span>
            <span style={{ color: themeColor }}>Settings</span>
            <span style={{ color: 'rgba(79, 195, 247, 0.5)' }}>H</span>
            <span style={{ color: themeColor }}>Toggle help</span>
            <span style={{ color: 'rgba(79, 195, 247, 0.5)' }}>ESC</span>
            <span style={{ color: themeColor }}>Unlock mouse</span>
          </div>
        </div>
      )}

      {/* ========== SETTINGS BUTTON ========== */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowSettings(prev => !prev);
        }}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          ...glassPanel,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: themeColor,
          fontFamily: 'monospace',
          fontSize: 12,
          cursor: 'pointer',
          zIndex: 100,
        }}
      >
        <span>⚙️</span>
        <span>Settings</span>
        <kbd style={{ 
          background: 'rgba(79, 195, 247, 0.2)', 
          padding: '2px 6px', 
          borderRadius: 3,
          fontSize: 10,
        }}>F1</kbd>
      </button>

      {/* ========== CROSSHAIR ========== */}
      {!anyModalOpen && isLocked && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 80,
        }}>
          <div style={{
            width: 24,
            height: 24,
            border: `2px solid rgba(79, 195, 247, 0.6)`,
            borderRadius: '50%',
            boxShadow: `0 0 10px rgba(79, 195, 247, 0.4)`,
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 4,
            height: 4,
            background: themeColor,
            borderRadius: '50%',
            boxShadow: `0 0 8px ${themeColor}`,
          }} />
        </div>
      )}

      {/* ========== CLICK TO FLY PROMPT ========== */}
      {!isLocked && !anyModalOpen && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 80,
        }}>
          <div style={{
            ...glassPanel,
            padding: '14px 28px',
            color: themeColor,
            fontFamily: 'monospace',
            fontSize: 16,
            fontWeight: 'bold',
            boxShadow: `0 0 30px rgba(79, 195, 247, 0.3)`,
          }}>
            Click to fly
          </div>
        </div>
      )}

      <style>{`
        input::placeholder {
          color: rgba(79, 195, 247, 0.4);
        }
        kbd {
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}

export default App;
