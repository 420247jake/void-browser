import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Suspense, useState, useCallback, useRef, useEffect } from "react";
import { VoidSceneOptimized } from "./components/VoidSceneOptimized";
import { FlyControls } from "./components/FlyControls";
import { SearchModal } from "./components/SearchModal";
import { VoidNode, VoidEdge } from "./lib/types";
import { CameraTeleport, triggerTeleport } from "./lib/navigation";

// Sample data to show off the visualization
const SAMPLE_NODES: VoidNode[] = [
  { id: 1, url: "https://github.com", title: "GitHub", favicon: "https://github.githubassets.com/favicons/favicon.svg", screenshot: null, position_x: 0, position_y: 0, position_z: 0, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 2, url: "https://reddit.com", title: "Reddit", favicon: "https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png", screenshot: null, position_x: 15, position_y: 5, position_z: -10, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 3, url: "https://youtube.com", title: "YouTube", favicon: "https://www.youtube.com/s/desktop/icon.png", screenshot: null, position_x: -20, position_y: -8, position_z: 5, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 4, url: "https://twitter.com", title: "Twitter / X", favicon: null, screenshot: null, position_x: 10, position_y: -12, position_z: 15, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 5, url: "https://wikipedia.org", title: "Wikipedia", favicon: "https://www.wikipedia.org/static/favicon/wikipedia.ico", screenshot: null, position_x: -12, position_y: 18, position_z: -8, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 6, url: "https://stackoverflow.com", title: "Stack Overflow", favicon: "https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico", screenshot: null, position_x: 25, position_y: -5, position_z: -20, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 7, url: "https://news.ycombinator.com", title: "Hacker News", favicon: "https://news.ycombinator.com/favicon.ico", screenshot: null, position_x: -8, position_y: 10, position_z: 22, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 8, url: "https://claude.ai", title: "Claude AI", favicon: null, screenshot: null, position_x: 5, position_y: 25, position_z: 5, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 9, url: "https://anthropic.com", title: "Anthropic", favicon: null, screenshot: null, position_x: 8, position_y: 20, position_z: 10, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 10, url: "https://openai.com", title: "OpenAI", favicon: null, screenshot: null, position_x: -15, position_y: -15, position_z: -15, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 11, url: "https://rust-lang.org", title: "Rust", favicon: null, screenshot: null, position_x: 30, position_y: 8, position_z: 12, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 12, url: "https://tauri.app", title: "Tauri", favicon: null, screenshot: null, position_x: 28, position_y: 5, position_z: 8, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 13, url: "https://threejs.org", title: "Three.js", favicon: null, screenshot: null, position_x: -25, position_y: 0, position_z: 18, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 14, url: "https://react.dev", title: "React", favicon: null, screenshot: null, position_x: -22, position_y: -5, position_z: 12, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
  { id: 15, url: "https://vercel.com", title: "Vercel", favicon: null, screenshot: null, position_x: 18, position_y: 15, position_z: -18, is_alive: true, last_crawled: null, created_at: new Date().toISOString() },
];

const SAMPLE_EDGES: VoidEdge[] = [
  { id: 1, source_id: 1, target_id: 2 },
  { id: 2, source_id: 1, target_id: 6 },
  { id: 3, source_id: 1, target_id: 7 },
  { id: 4, source_id: 1, target_id: 11 },
  { id: 5, source_id: 1, target_id: 12 },
  { id: 6, source_id: 2, target_id: 3 },
  { id: 7, source_id: 2, target_id: 4 },
  { id: 8, source_id: 5, target_id: 6 },
  { id: 9, source_id: 7, target_id: 1 },
  { id: 10, source_id: 7, target_id: 8 },
  { id: 11, source_id: 8, target_id: 9 },
  { id: 12, source_id: 9, target_id: 10 },
  { id: 13, source_id: 11, target_id: 12 },
  { id: 14, source_id: 12, target_id: 1 },
  { id: 15, source_id: 13, target_id: 14 },
  { id: 16, source_id: 14, target_id: 15 },
  { id: 17, source_id: 14, target_id: 1 },
  { id: 18, source_id: 6, target_id: 1 },
];

const DISPLAY_SETTINGS = {
  showLabels: true,
  showEdges: true,
  nodeSize: 1.0,
  labelScale: 1.0,
  layoutMode: "random" as const,
  showClusterBoundaries: false,
  theme: "cyan",
  animateEdges: false,
  showNodeImportance: false,
};

function DemoApp() {
  const [nodes, setNodes] = useState<VoidNode[]>(SAMPLE_NODES);
  const [edges, setEdges] = useState<VoidEdge[]>(SAMPLE_EDGES);
  const [showUrlBar, setShowUrlBar] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showDemoBanner, setShowDemoBanner] = useState(true);
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const nextId = useRef(100);

  const handleEnterNode = useCallback((url: string, _title: string) => {
    window.open(url, "_blank");
  }, []);

  const handleAddUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    
    let url = urlInput.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    setIsAdding(true);
    
    try {
      const newNode: VoidNode = {
        id: nextId.current++,
        url,
        title: new URL(url).hostname,
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`,
        screenshot: null,
        position_x: (Math.random() - 0.5) * 40,
        position_y: (Math.random() - 0.5) * 40,
        position_z: (Math.random() - 0.5) * 40,
        is_alive: true,
        last_crawled: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
          const titleMatch = data.contents.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            newNode.title = titleMatch[1].trim();
          }

          const linkRegex = /href=["']([^"']+)["']/gi;
          const newEdges: VoidEdge[] = [];
          let match;
          
          while ((match = linkRegex.exec(data.contents)) !== null) {
            try {
              const linkedUrl = new URL(match[1], url).href;
              const linkedDomain = new URL(linkedUrl).hostname;
              
              const existingNode = nodes.find(n => {
                try {
                  return new URL(n.url).hostname === linkedDomain;
                } catch {
                  return false;
                }
              });
              
              if (existingNode && !newEdges.find(e => e.target_id === existingNode.id)) {
                newEdges.push({
                  id: nextId.current++,
                  source_id: newNode.id,
                  target_id: existingNode.id,
                });
              }
            } catch {
              // Invalid URL, skip
            }
          }

          if (newEdges.length > 0) {
            setEdges(prev => [...prev, ...newEdges]);
          }
        }
      } catch (e) {
        console.log("Could not fetch page for link extraction:", e);
      }

      setNodes(prev => [...prev, newNode]);
      setUrlInput("");
      setShowUrlBar(false);
      setControlsEnabled(true);

      setTimeout(() => {
        triggerTeleport([newNode.position_x, newNode.position_y, newNode.position_z + 15]);
      }, 100);
      
    } catch (e) {
      console.error("Failed to add URL:", e);
      alert("Failed to add URL. Please check the format.");
    } finally {
      setIsAdding(false);
    }
  }, [urlInput, nodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          setShowUrlBar(false);
          setShowSearch(false);
          setControlsEnabled(true);
        }
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setShowUrlBar(true);
        setControlsEnabled(false);
      } else if (e.key === "Escape") {
        setShowUrlBar(false);
        setShowSearch(false);
        setControlsEnabled(true);
      } else if (e.key === "/" || (e.ctrlKey && e.key === "f")) {
        e.preventDefault();
        setShowSearch(true);
        setControlsEnabled(false);
      } else if (e.key === "h" || e.key === "H") {
        setShowControls(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      {/* Demo Banner */}
      {showDemoBanner && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-2 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">🚀</span>
            <span className="font-medium">
              Interactive demo of Void Browser. Press <kbd className="px-2 py-0.5 bg-white/20 rounded text-sm mx-1">N</kbd> to add sites. Download the app for full features!
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://github.com/420247jake/void-browser/releases/latest" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 bg-white text-cyan-700 rounded font-semibold hover:bg-cyan-50 transition-colors"
            >
              Download App
            </a>
            <button 
              onClick={() => setShowDemoBanner(false)}
              className="text-white/80 hover:text-white text-xl px-2"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Title */}
      <div className={`absolute ${showDemoBanner ? 'top-14' : 'top-4'} left-4 z-10 transition-all`}>
        <h1 className="text-2xl font-bold text-cyan-400 tracking-wider">VOID BROWSER</h1>
        <p className="text-gray-400 text-sm">{nodes.length} sites • Click to visit • WASD to fly</p>
      </div>

      {/* Controls Help */}
      {showControls && (
        <div className={`absolute ${showDemoBanner ? 'top-14' : 'top-4'} right-4 z-10 bg-black/60 backdrop-blur-sm border border-cyan-900/50 rounded-lg p-4 text-sm transition-all`}>
          <div className="text-cyan-400 font-semibold mb-2">Controls</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-300">
            <span><kbd className="px-1.5 py-0.5 bg-cyan-900/50 rounded text-xs">WASD</kbd> Move</span>
            <span><kbd className="px-1.5 py-0.5 bg-cyan-900/50 rounded text-xs">Space</kbd> Up</span>
            <span><kbd className="px-1.5 py-0.5 bg-cyan-900/50 rounded text-xs">Shift</kbd> Down</span>
            <span><kbd className="px-1.5 py-0.5 bg-cyan-900/50 rounded text-xs">Q/E</kbd> Roll</span>
            <span><kbd className="px-1.5 py-0.5 bg-cyan-900/50 rounded text-xs">Click</kbd> Visit site</span>
            <span><kbd className="px-1.5 py-0.5 bg-cyan-900/50 rounded text-xs">N</kbd> Add URL</span>
            <span><kbd className="px-1.5 py-0.5 bg-cyan-900/50 rounded text-xs">/</kbd> Search</span>
            <span><kbd className="px-1.5 py-0.5 bg-cyan-900/50 rounded text-xs">H</kbd> Toggle help</span>
          </div>
        </div>
      )}

      {/* Add URL Bar */}
      {showUrlBar && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-cyan-700/50 rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
            <h2 className="text-cyan-400 text-lg font-semibold mb-4">Add Website to Void</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
                placeholder="Enter URL (e.g., example.com)"
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                autoFocus
                disabled={isAdding}
              />
              <button
                onClick={handleAddUrl}
                disabled={isAdding}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                {isAdding ? "Adding..." : "Add"}
              </button>
            </div>
            <p className="text-gray-500 text-sm mt-3">
              The site will be added and connections to existing sites will be discovered.
            </p>
            <button 
              onClick={() => { setShowUrlBar(false); setControlsEnabled(true); }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearch && (
        <SearchModal
          isOpen={showSearch}
          nodes={nodes}
          onClose={() => { setShowSearch(false); setControlsEnabled(true); }}
          onTeleport={(nodeId, position) => {
            triggerTeleport(nodeId, position);
            setShowSearch(false);
            setControlsEnabled(true);
          }}
          onEnterNode={handleEnterNode}
        />
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 60], fov: 75, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#000010" }}
      >
        <Suspense fallback={null}>
          <Stars radius={300} depth={100} count={5000} factor={4} fade speed={0.5} />
          <ambientLight intensity={0.3} />
          
          <VoidSceneOptimized
            nodes={nodes}
            edges={edges}
            onEnterNode={handleEnterNode}
            displaySettings={DISPLAY_SETTINGS}
          />
          
          <FlyControls enabled={controlsEnabled} />
          <CameraTeleport />
          
          <EffectComposer>
            <Bloom 
              intensity={0.8}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
              radius={0.8}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* Click to fly hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-gray-500 text-sm pointer-events-none">
        Click anywhere to fly • Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">N</kbd> to add a site
      </div>
    </div>
  );
}

export default DemoApp;
