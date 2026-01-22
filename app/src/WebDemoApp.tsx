/**
 * Void Browser - Web Demo
 * A standalone web version with demo data and limited features
 */

import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { VoidScene } from "./components/VoidSceneOptimized";
import { FlyControls } from "./components/FlyControls";
import { webDatabase, Site, Edge } from "./lib/web/webDatabase";
import { isWebDemo } from "./lib/web/webMock";
import { getDomainColor } from "./lib/colors";
import { VoidNode, VoidEdge } from "./lib/types";
import "./index.css";

// Demo banner component
function DemoBanner({ onReset }: { onReset: () => void }) {
  const [showInfo, setShowInfo] = useState(false);
  
  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-orange-600 to-amber-500 text-white py-2 px-4 text-center text-sm font-medium shadow-lg pointer-events-auto">
        <span className="mr-2">🎮</span>
        <strong>DEMO MODE</strong> - This is a preview with sample data. 
        <button 
          onClick={() => setShowInfo(true)}
          className="ml-2 underline hover:no-underline"
        >
          Learn more
        </button>
        <span className="mx-2">|</span>
        <a 
          href="https://github.com/420247jake/void-browser/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
        >
          Download full version
        </a>
      </div>
      
      {showInfo && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">About This Demo</h2>
            <div className="text-gray-300 space-y-3">
              <p>
                <strong className="text-white">This is a web demo</strong> of Void Browser. 
                The full desktop application includes:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Real web crawling with screenshot capture</li>
                <li>SQLite database for persistent storage</li>
                <li>Import/export functionality</li>
                <li>Advanced crawl settings</li>
                <li>Session management</li>
              </ul>
              <p className="text-sm text-gray-400">
                In this demo, you can fly around the 3D space and add URLs manually. 
                Crawling is limited due to browser restrictions.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowInfo(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onReset();
                  setShowInfo(false);
                }}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg transition"
              >
                Reset Demo
              </button>
              <a
                href="https://github.com/420247jake/void-browser/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition text-center"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Simple URL input modal
function AddUrlModal({ 
  isOpen, 
  onClose, 
  onAdd 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setLoading(true);
    try {
      let finalUrl = url.trim();
      if (!finalUrl.startsWith('http')) {
        finalUrl = 'https://' + finalUrl;
      }
      onAdd(finalUrl);
      setUrl("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-cyan-500/30 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-cyan-400 mb-4">Add URL</h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
          <p className="text-xs text-gray-500 mt-2">
            Note: In demo mode, only basic site info is added (no crawling)
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition"
            >
              {loading ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Controls help overlay
function ControlsHelp({ show }: { show: boolean }) {
  if (!show) return null;
  
  return (
    <div className="fixed bottom-4 left-4 z-[100] bg-black/80 backdrop-blur border border-cyan-500/30 rounded-lg p-4 text-sm pointer-events-none">
      <h3 className="text-cyan-400 font-bold mb-2">Controls</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-300">
        <span className="text-gray-500">WASD</span><span>Move</span>
        <span className="text-gray-500">Space / Shift</span><span>Up / Down</span>
        <span className="text-gray-500">Mouse</span><span>Look around</span>
        <span className="text-gray-500">Click</span><span>Lock cursor / Open site</span>
        <span className="text-gray-500">N</span><span>Add URL</span>
        <span className="text-gray-500">H</span><span>Toggle help</span>
        <span className="text-gray-500">ESC</span><span>Unlock cursor</span>
      </div>
    </div>
  );
}

// Stats overlay
function StatsOverlay({ sites, edges }: { sites: Site[]; edges: Edge[] }) {
  const domains = [...new Set(sites.map(s => s.domain))];
  
  return (
    <div className="fixed top-14 left-4 z-[100] bg-black/60 backdrop-blur border border-cyan-500/20 rounded-lg px-3 py-2 text-xs pointer-events-none">
      <div className="text-cyan-400">{sites.length} sites</div>
      <div className="text-gray-500">{edges.length} connections</div>
      <div className="text-gray-500">{domains.length} domains</div>
    </div>
  );
}

export default function WebDemoApp() {
  const [sites, setSites] = useState<Site[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [loadedSites, loadedEdges] = await Promise.all([
      webDatabase.getAllSites(),
      webDatabase.getAllEdges(),
    ]);
    setSites(loadedSites);
    setEdges(loadedEdges);
  };

  // Convert sites to VoidNode format
  const voidNodes: VoidNode[] = useMemo(() => {
    return sites.map(s => ({
      id: s.id,
      url: s.url,
      title: s.title,
      favicon: s.favicon,
      screenshot: s.screenshot,
      position_x: s.position_x,
      position_y: s.position_y,
      position_z: s.position_z,
      is_alive: true,
      is_favorite: false,
      last_crawled: s.crawled_at,
      created_at: s.crawled_at,
    }));
  }, [sites]);

  // Convert edges to VoidEdge format
  const voidEdges: VoidEdge[] = useMemo(() => {
    return edges.map((e, i) => ({
      id: i,
      source_id: e.from_id,
      target_id: e.to_id,
    }));
  }, [edges]);

  // Handle adding a new URL
  const handleAddUrl = useCallback(async (url: string) => {
    try {
      const newSite = await webDatabase.addSite(url);
      setSites(prev => [...prev, newSite]);
    } catch (err) {
      console.error("Failed to add site:", err);
    }
  }, []);

  // Handle reset
  const handleReset = useCallback(async () => {
    await webDatabase.resetDemo();
    await loadData();
  }, []);

  // Handle node click - only open in new tab if cursor is already locked
  const handleEnterNode = useCallback((url: string, title: string) => {
    // Only open site if we're already flying (cursor locked)
    if (document.pointerLockElement) {
      window.open(url, '_blank');
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key.toLowerCase() === 'n' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        setShowAddModal(true);
      }
      if (e.key.toLowerCase() === 'h' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        setShowHelp(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {/* Demo banner */}
      <DemoBanner onReset={handleReset} />
      
      {/* Stats */}
      <StatsOverlay sites={sites} edges={edges} />
      
      {/* Controls help */}
      <ControlsHelp show={showHelp && !isLocked} />
      
      {/* Add URL button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowAddModal(true);
        }}
        className="fixed bottom-4 right-4 z-[100] px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-medium transition shadow-lg pointer-events-auto"
      >
        + Add URL (N)
      </button>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 60], fov: 75 }}
      >
        <Suspense fallback={null}>
          {/* Stars background */}
          <Stars
            radius={200}
            depth={100}
            count={5000}
            factor={4}
            saturation={0}
            fade
            speed={0.5}
          />

          {/* Lighting */}
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />

          {/* Fly controls */}
          <FlyControls
            onLockChange={setIsLocked}
            enabled={true}
          />

          {/* Void Scene with sites and edges */}
          <VoidScene
            nodes={voidNodes}
            edges={voidEdges}
            onEnterNode={handleEnterNode}
            displaySettings={{
              showLabels: true,
              showEdges: true,
              nodeSize: 1.0,
              labelScale: 1.0,
              layoutMode: "random",
              showClusterBoundaries: false,
              theme: "cyan",
              animateEdges: false,
              showNodeImportance: false,
            }}
          />

          {/* Post-processing effects */}
          <EffectComposer>
            <Bloom
              intensity={0.5}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* Add URL modal */}
      <AddUrlModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddUrl}
      />

      {/* Click to fly instruction */}
      {!isLocked && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="bg-black/60 backdrop-blur px-6 py-3 rounded-full text-cyan-400 text-lg">
            Click to fly
          </div>
        </div>
      )}
    </div>
  );
}
