import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { VoidScene } from "./components/VoidSceneOptimized";
import { FlyControls } from "./components/FlyControls";
import { PerformanceOverlay } from "./components/PerformanceOverlay";
import { Gallery } from "./components/Gallery";
import { ImportModal } from "./components/ImportModal";
import { ExportModal } from "./components/ExportModal";
import { SessionMergeModal } from "./components/SessionMergeModal";
import { BrokenLinkPanel } from "./components/BrokenLinkPanel";
import { SitemapImportModal } from "./components/SitemapImportModal";
import { CrawlModal } from "./components/CrawlModal";
import { TopBar } from "./components/TopBar";
import { SettingsPanel, DisplaySettings, CrawlerSettings, KeybindSettings, AutoCrawlSettings } from "./components/SettingsPanel";
import { SearchModal } from "./components/SearchModal";
import { ContextMenu } from "./components/ContextMenu";
import { StatsPanel } from "./components/StatsPanel";
import { useVoidDatabase, resetDbConnection } from "./lib/database";
import { CameraTeleport, triggerTeleport } from "./lib/navigation";
import { useAutoCrawl, DEFAULT_AUTO_CRAWL_SETTINGS } from "./lib/useAutoCrawl";

// Default settings
const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showLabels: true,
  showEdges: true,
  nodeSize: 1.0,
  labelScale: 1.0,
  layoutMode: "random",
  showClusterBoundaries: false,
  theme: "cyan",
  animateEdges: false,
  showNodeImportance: false,
};

const DEFAULT_CRAWLER_SETTINGS: CrawlerSettings = {
  maxNodes: 50,
  maxDepth: 2,
  takeScreenshots: true,
  screenshotDelay: 2000,
};

const DEFAULT_KEYBIND_SETTINGS: KeybindSettings = {
  settings: "F1",
  addUrl: "N",
  crawl: "C",
  import: "I",
  export: "Shift+E",
  gallery: "G",
  screenshot: "F2",
  toggleHelp: "H",
};

// Helper to check if a key matches a keybind
function matchesKeybind(e: KeyboardEvent, keybind: string): boolean {
  // Handle Shift+ prefix
  if (keybind.startsWith("Shift+")) {
    if (!e.shiftKey) return false;
    const key = keybind.slice(6); // Remove "Shift+" prefix
    return e.key.toUpperCase() === key.toUpperCase();
  }
  
  if (keybind.startsWith("F") && keybind.length <= 3) {
    return e.code === keybind && !e.shiftKey;
  }
  if (keybind === "`") {
    return e.code === "Backquote" && !e.shiftKey;
  }
  if (keybind.length === 1 && /[A-Z]/i.test(keybind)) {
    return e.key.toUpperCase() === keybind.toUpperCase() && !e.shiftKey;
  }
  if (keybind.length === 1 && /[0-9]/.test(keybind)) {
    return e.key === keybind && !e.shiftKey;
  }
  return false;
}

// Helper to display key names nicely
function formatKeyDisplay(key: string): string {
  if (key === "`") return "~";
  if (key.startsWith("F") && key.length <= 3) return key;
  return key;
}

function App() {
  const [showControls, setShowControls] = useState(true);
  const [lastOpened, setLastOpened] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlBar, setShowUrlBar] = useState(false);
  const [screenshotNotice, setScreenshotNotice] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showBrokenLinks, setShowBrokenLinks] = useState(false);
  const [showSitemapImport, setShowSitemapImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCrawl, setShowCrawl] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    node: import("./lib/types").VoidNode | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, node: null });
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [crawlerSettings, setCrawlerSettings] = useState<CrawlerSettings>(DEFAULT_CRAWLER_SETTINGS);
  const [keybindSettings, setKeybindSettings] = useState<KeybindSettings>(DEFAULT_KEYBIND_SETTINGS);
  const [autoCrawlSettings, setAutoCrawlSettings] = useState<AutoCrawlSettings>(DEFAULT_AUTO_CRAWL_SETTINGS);
  const [currentSession, setCurrentSession] = useState("Default");
  const urlInputRef = useRef<HTMLInputElement>(null);
  const wasLockedRef = useRef(false);

  const { 
    nodes, 
    edges, 
    loading, 
    error, 
    addNode, 
    seedSampleData,
    reload,
    reloadWithReconnect 
  } = useVoidDatabase();

  // Ref to track last reload time to prevent flicker
  const lastReloadRef = useRef(0);
  
  // Debounced reload that prevents rapid consecutive reloads
  const debouncedReload = useCallback(() => {
    const now = Date.now();
    if (now - lastReloadRef.current > 2000) { // Minimum 2 seconds between reloads
      lastReloadRef.current = now;
      reload();
    }
  }, [reload]);

  // Auto-crawl hook - reloads data when a node is updated or discovered
  const {
    status: autoCrawlStatus,
    isCrawling: isAutoCrawling,
    isDiscovering,
    currentlyCrawling,
    discoveryStats,
    nodeCount,
    crawlNow,
    discoverNow,
    resetAllTimestamps,
  } = useAutoCrawl(
    autoCrawlSettings, 
    (_nodeId, _result) => {
      // Debounced reload when a node is updated by auto-crawl
      debouncedReload();
    },
    (_result) => {
      // Only reload for discovery if nodes were actually added
      if (_result.nodes_added > 0) {
        debouncedReload();
      }
    }
  );

  // Load current session name on mount
  useEffect(() => {
    invoke<string>("get_current_session").then(setCurrentSession).catch(console.error);
  }, []);

  // Check if any modal is open (defined early so it can be used in effects)
  const anyModalOpen = showGallery || showImport || showExport || showMerge || showBrokenLinks || showSitemapImport || showSettings || showCrawl || showUrlBar || showSearch || showStats || contextMenu.isOpen;

  // Listen for site window closed event and re-capture mouse
  useEffect(() => {
    const unlisten = listen("site-window-closed", () => {
      // Small delay to ensure the main window has focus
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (canvas && !anyModalOpen) {
          canvas.requestPointerLock();
        }
      }, 150);
    });
    
    return () => {
      unlisten.then(fn => fn());
    };
  }, [anyModalOpen]);

  // Auto-capture mouse when main window gains focus (after returning from site window)
  useEffect(() => {
    const handleWindowFocus = async () => {
      // Check if this is the main window and no modal is open
      const currentWindow = await getCurrentWindow();
      if (currentWindow.label === 'main' && !anyModalOpen) {
        // Small delay to ensure focus transition is complete
        setTimeout(() => {
          const canvas = document.querySelector('canvas');
          if (canvas && !document.pointerLockElement) {
            canvas.requestPointerLock();
          }
        }, 100);
      }
    };
    
    // Listen to Tauri window focus event
    const unlisten = listen("tauri://focus", handleWindowFocus);
    
    return () => {
      unlisten.then(fn => fn());
    };
  }, [anyModalOpen]);


  // Handle mouse lock/unlock when modals open/close
  useEffect(() => {
    if (anyModalOpen) {
      // Modal opened - unlock mouse if it was locked
      if (document.pointerLockElement) {
        wasLockedRef.current = true;
        document.exitPointerLock();
      }
    } else {
      // All modals closed - re-lock mouse if it was locked before
      if (wasLockedRef.current) {
        // Small delay to allow modal animations to complete
        setTimeout(() => {
          const canvas = document.querySelector('canvas');
          if (canvas) {
            canvas.requestPointerLock();
          }
        }, 100);
        wasLockedRef.current = false;
      }
    }
  }, [anyModalOpen]);

  // Seed sample data on first load if empty
  useEffect(() => {
    if (!loading && nodes.length === 0) {
      seedSampleData();
    }
  }, [loading, nodes.length, seedSampleData]);

  const handleEnterNode = useCallback(async (url: string, title: string) => {
    console.log(`Opening in new window: ${title} - ${url}`);
    setLastOpened(title);
    
    // Unlock mouse when opening a site
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    try {
      await invoke("open_site", { url, title });
    } catch (err) {
      console.error("Failed to open site:", err);
    }
    
    setTimeout(() => setLastOpened(null), 2000);
  }, []);

  const handleAddUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    
    let url = urlInput.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    
    try {
      const node = await addNode(url);
      if (node) {
        console.log("Added node:", node);
        setUrlInput("");
        setShowUrlBar(false);
      }
    } catch (err) {
      console.error("Failed to add URL:", err);
    }
  }, [urlInput, addNode]);

  // Screenshot function
  const takeScreenshot = useCallback(async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const savedPath = await invoke<string>("save_screenshot", { dataUrl });
      const filename = savedPath.split(/[/\\]/).pop();
      
      setScreenshotNotice(`Saved: ${filename}`);
      setTimeout(() => setScreenshotNotice(null), 2500);
    } catch (err) {
      console.error("Screenshot failed:", err);
      setScreenshotNotice("Screenshot failed");
      setTimeout(() => setScreenshotNotice(null), 2000);
    }
  }, []);

  // Teleport handler for search
  const handleTeleport = useCallback((nodeId: number, position: [number, number, number]) => {
    triggerTeleport(nodeId, position);
  }, []);

  // Context menu handlers
  const handleRightClickNode = useCallback((node: import("./lib/types").VoidNode, screenPos: { x: number; y: number }) => {
    // Exit pointer lock if active
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    setContextMenu({
      isOpen: true,
      position: screenPos,
      node,
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleDeleteNode = useCallback(async (node: import("./lib/types").VoidNode) => {
    try {
      await invoke("delete_node", { id: node.id });
      reload();
    } catch (err) {
      console.error("Failed to delete node:", err);
    }
  }, [reload]);

  const handleDeleteNodes = useCallback(async (nodes: import("./lib/types").VoidNode[]) => {
    try {
      for (const node of nodes) {
        await invoke("delete_node", { id: node.id });
      }
      reload();
    } catch (err) {
      console.error("Failed to delete nodes:", err);
    }
  }, [reload]);

  const handleTeleportToNode = useCallback((node: import("./lib/types").VoidNode) => {
    triggerTeleport(node.id, [node.position_x, node.position_y, node.position_z]);
  }, []);


  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const activeElement = document.activeElement;
      const isTyping = activeElement instanceof HTMLInputElement || 
                       activeElement instanceof HTMLTextAreaElement ||
                       activeElement?.getAttribute('contenteditable') === 'true';

      // If typing, only handle Escape to close modals
      if (isTyping) {
        if (e.key === "Escape") {
          if (showUrlBar) {
            setShowUrlBar(false);
            (activeElement as HTMLElement)?.blur();
          } else if (showCrawl) {
            setShowCrawl(false);
          } else if (showSettings) {
            setShowSettings(false);
          } else if (showImport) {
            setShowImport(false);
          } else if (showGallery) {
            setShowGallery(false);
          }
        }
        return; // Don't process other shortcuts while typing
      }

      // Gallery open - ESC or toggle key closes
      if (showGallery) {
        if (e.key === "Escape" || matchesKeybind(e, keybindSettings.gallery)) {
          setShowGallery(false);
        }
        return;
      }

      // Import modal open
      if (showImport) {
        if (e.key === "Escape" || matchesKeybind(e, keybindSettings.import)) {
          setShowImport(false);
        }
        return;
      }

      // Export modal open
      if (showExport) {
        if (e.key === "Escape" || e.key.toUpperCase() === "E") {
          setShowExport(false);
        }
        return;
      }

      // Merge modal open
      if (showMerge) {
        if (e.key === "Escape" || e.key.toUpperCase() === "M") {
          setShowMerge(false);
        }
        return;
      }

      // Broken links panel open
      if (showBrokenLinks) {
        if (e.key === "Escape" || e.key.toUpperCase() === "B") {
          setShowBrokenLinks(false);
        }
        return;
      }

      // Sitemap import open
      if (showSitemapImport) {
        if (e.key === "Escape") {
          setShowSitemapImport(false);
        }
        return;
      }

      // Settings panel open
      if (showSettings) {
        if (e.key === "Escape" || matchesKeybind(e, keybindSettings.settings)) {
          setShowSettings(false);
        }
        return;
      }

      // Crawl modal open
      if (showCrawl) {
        if (e.key === "Escape" || matchesKeybind(e, keybindSettings.crawl)) {
          setShowCrawl(false);
        }
        return;
      }

      // Search modal open
      if (showSearch) {
        if (e.key === "Escape") {
          setShowSearch(false);
        }
        return;
      }

      // Stats panel open
      if (showStats) {
        if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          setShowStats(false);
        }
        return;
      }

      // Ctrl+F for search
      if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // Customizable keybinds
      if (matchesKeybind(e, keybindSettings.screenshot)) {
        e.preventDefault();
        takeScreenshot();
      }
      if (matchesKeybind(e, keybindSettings.gallery)) {
        setShowGallery(true);
      }
      if (matchesKeybind(e, keybindSettings.settings)) {
        e.preventDefault();
        setShowSettings(true);
      }
      if (matchesKeybind(e, keybindSettings.import)) {
        setShowImport(true);
      }
      if (matchesKeybind(e, keybindSettings.crawl)) {
        setShowCrawl(true);
      }
      // Export keybind
      if (matchesKeybind(e, keybindSettings.export)) {
        setShowExport(true);
      }
      // M key for Merge Sessions
      if (e.key.toUpperCase() === "M" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShowMerge(true);
      }
      // B key for Broken Links Report
      if (e.key.toUpperCase() === "B" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShowBrokenLinks(true);
      }
      // S key for Sitemap Import (Shift+S)
      if (e.key.toUpperCase() === "S" && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowSitemapImport(true);
      }
      // Tab key for Stats
      if (e.key === "Tab") {
        e.preventDefault();
        setShowStats(true);
      }
      if (matchesKeybind(e, keybindSettings.toggleHelp)) {
        setShowControls(prev => !prev);
      }
      if (matchesKeybind(e, keybindSettings.addUrl)) {
        setShowUrlBar(true);
        setTimeout(() => urlInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setShowUrlBar(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [takeScreenshot, showGallery, showImport, showSettings, showCrawl, showStats, keybindSettings]);

  // Handle crawl complete - auto-import the new database
  const handleCrawlComplete = useCallback(async () => {
    // Reload the database to pick up any imported data
    reload();
  }, [reload]);

  // Session management handlers
  const handleNewVoid = useCallback(async () => {
    // Close DB connection first so Rust can modify the file
    await resetDbConnection();
    reloadWithReconnect();
    invoke<string>("get_current_session").then(setCurrentSession).catch(console.error);
  }, [reloadWithReconnect]);

  const handleLoadVoid = useCallback(async (path: string) => {
    try {
      // Close DB connection first so Rust can modify the file
      await resetDbConnection();
      await invoke("load_session", { path });
      reloadWithReconnect();
      const name = await invoke<string>("get_current_session");
      setCurrentSession(name);
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  }, [reloadWithReconnect]);

  const handleSessionChange = useCallback(async (session: { name: string; path: string }) => {
    try {
      // Close DB connection first so Rust can modify the file
      await resetDbConnection();
      await invoke("load_session", { path: session.path });
      reloadWithReconnect();
      setCurrentSession(session.name);
    } catch (err) {
      console.error("Failed to switch session:", err);
    }
  }, [reloadWithReconnect]);


  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a1a", overflow: "hidden" }}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 5, 25], fov: 70 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={["#0a0a1a"]} />
        
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4fc3f7" />
        
        {/* Environment */}
        <fog attach="fog" args={["#0a0a1a", 30, 150]} />
        <Stars radius={200} depth={100} count={3000} factor={4} saturation={0} fade speed={0.3} />
        
        {/* Main Scene */}
        <Suspense fallback={null}>
          {!loading && (
            <VoidScene 
              nodes={nodes} 
              edges={edges} 
              onEnterNode={handleEnterNode}
              onRightClickNode={handleRightClickNode}
              displaySettings={displaySettings}
              enablePerformanceMode={nodes.length > 50}
            />
          )}
        </Suspense>
        
        {/* Fly Controls - disable when modal is open */}
        <FlyControls speed={20} enabled={!anyModalOpen} />
        
        {/* Camera Teleport for search navigation */}
        <CameraTeleport />
        
        {/* Performance Overlay (inside Canvas for R3F hooks) */}
        <PerformanceOverlay
          totalNodes={nodes.length}
          totalEdges={edges.length}
          theme={displaySettings.theme}
        />
        
        {/* Post-processing */}
        <EffectComposer>
          <Bloom 
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            intensity={1.2}
          />
        </EffectComposer>
      </Canvas>
      
      {/* Top Bar */}
      <TopBar
        currentSession={currentSession}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        onNewVoid={handleNewVoid}
        onLoadVoid={handleLoadVoid}
        onSessionChange={handleSessionChange}
      />

      {/* URL Input Bar */}
      {showUrlBar && (
        <div style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 200,
        }}>
          <div style={{
            background: "rgba(10, 10, 30, 0.95)",
            border: "2px solid #4fc3f7",
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            gap: 10,
            boxShadow: "0 0 30px rgba(79, 195, 247, 0.3)",
          }}>
            <input
              ref={urlInputRef}
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddUrl();
              }}
              placeholder="Enter URL to add (e.g., github.com)"
              style={{
                width: 350,
                padding: "10px 14px",
                background: "rgba(79, 195, 247, 0.1)",
                border: "1px solid rgba(79, 195, 247, 0.3)",
                borderRadius: 4,
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={handleAddUrl}
              style={{
                padding: "10px 20px",
                background: "rgba(79, 195, 247, 0.2)",
                border: "1px solid #4fc3f7",
                borderRadius: 4,
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Add
            </button>
            <button
              onClick={() => setShowUrlBar(false)}
              style={{
                padding: "10px 14px",
                background: "transparent",
                border: "1px solid rgba(79, 195, 247, 0.3)",
                borderRadius: 4,
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 14,
                cursor: "pointer",
                opacity: 0.7,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Screenshot notification */}
      {screenshotNotice && (
        <div style={{
          position: "absolute",
          top: 60,
          right: 20,
          background: "rgba(10, 10, 30, 0.9)",
          border: "1px solid #4fc3f7",
          borderRadius: 6,
          padding: "10px 16px",
          color: "#4fc3f7",
          fontFamily: "monospace",
          fontSize: 12,
          boxShadow: "0 0 20px rgba(79, 195, 247, 0.3)",
          animation: "slideIn 0.2s ease",
        }}>
          📸 {screenshotNotice}
        </div>
      )}

      {/* "Site Opened" notification */}
      {lastOpened && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(10, 10, 30, 0.9)",
          border: "2px solid #4fc3f7",
          borderRadius: 12,
          padding: "20px 40px",
          color: "#4fc3f7",
          fontFamily: "monospace",
          fontSize: 16,
          textAlign: "center",
          boxShadow: "0 0 40px rgba(79, 195, 247, 0.4)",
          animation: "fadeInOut 2s ease",
          pointerEvents: "none",
          zIndex: 150,
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🌐</div>
          <div>Opening <strong>{lastOpened}</strong></div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 5 }}>in new window</div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          position: "absolute",
          top: 60,
          left: 20,
          background: "rgba(255, 50, 50, 0.2)",
          border: "1px solid #f55",
          borderRadius: 4,
          padding: "8px 12px",
          color: "#f88",
          fontFamily: "monospace",
          fontSize: 12,
        }}>
          Error: {error}
        </div>
      )}


      {/* Controls Help */}
      {showControls && !anyModalOpen && (
        <div 
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            background: "rgba(10, 10, 30, 0.85)",
            border: "1px solid rgba(79, 195, 247, 0.3)",
            borderRadius: 8,
            padding: "15px 20px",
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 12,
            textShadow: "0 0 5px rgba(79, 195, 247, 0.3)",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 10, fontSize: 14 }}>CONTROLS</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "5px 15px", opacity: 0.9 }}>
            <span style={{ opacity: 0.6 }}>Click</span><span>Lock mouse / Enter node</span>
            <span style={{ opacity: 0.6 }}>WASD</span><span>Move</span>
            <span style={{ opacity: 0.6 }}>Space</span><span>Up</span>
            <span style={{ opacity: 0.6 }}>Shift</span><span>Down</span>
            <span style={{ opacity: 0.6 }}>Q / E</span><span>Roll</span>
            <span style={{ opacity: 0.6 }}>Ctrl</span><span>Sprint</span>
            <span style={{ opacity: 0.6 }}>{formatKeyDisplay(keybindSettings.addUrl)}</span><span>Add new URL</span>
            <span style={{ opacity: 0.6 }}>{formatKeyDisplay(keybindSettings.crawl)}</span><span>Crawl website</span>
            <span style={{ opacity: 0.6 }}>{formatKeyDisplay(keybindSettings.import)}</span><span>Import data</span>
            <span style={{ opacity: 0.6 }}>E</span><span>Export data</span>
            <span style={{ opacity: 0.6 }}>M</span><span>Merge sessions</span>
            <span style={{ opacity: 0.6 }}>B</span><span>Broken link report</span>
            <span style={{ opacity: 0.6 }}>Shift+S</span><span>Sitemap import</span>
            <span style={{ opacity: 0.6 }}>{formatKeyDisplay(keybindSettings.settings)}</span><span>Settings</span>
            <span style={{ opacity: 0.6 }}>{formatKeyDisplay(keybindSettings.screenshot)}</span><span>Screenshot</span>
            <span style={{ opacity: 0.6 }}>{formatKeyDisplay(keybindSettings.gallery)}</span><span>Gallery</span>
            <span style={{ opacity: 0.6 }}>Tab</span><span>Stats dashboard</span>
            <span style={{ opacity: 0.6 }}>Ctrl+F</span><span>Search nodes</span>
            <span style={{ opacity: 0.6 }}>ESC</span><span>Unlock mouse</span>
            <span style={{ opacity: 0.6 }}>{formatKeyDisplay(keybindSettings.toggleHelp)}</span><span>Toggle help</span>
          </div>
        </div>
      )}

      {/* Crosshair - hide when modal is open */}
      {!anyModalOpen && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}>
          <div style={{
            width: 24,
            height: 24,
            border: "2px solid rgba(79, 195, 247, 0.5)",
            borderRadius: "50%",
          }} />
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 4,
            height: 4,
            background: "#4fc3f7",
            borderRadius: "50%",
            boxShadow: "0 0 10px rgba(79, 195, 247, 0.8)",
          }} />
        </div>
      )}

      {/* Gallery */}
      <Gallery isOpen={showGallery} onClose={() => setShowGallery(false)} />

      {/* Import Modal */}
      <ImportModal 
        isOpen={showImport} 
        onClose={() => setShowImport(false)} 
        onImportComplete={reload}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        nodes={nodes}
        edges={edges}
        sessionName={currentSession}
      />

      {/* Session Merge Modal */}
      <SessionMergeModal
        isOpen={showMerge}
        onClose={() => setShowMerge(false)}
        onMergeComplete={reload}
        currentSession={currentSession}
      />

      {/* Broken Link Panel */}
      <BrokenLinkPanel
        isOpen={showBrokenLinks}
        onClose={() => setShowBrokenLinks(false)}
        nodes={nodes}
        edges={edges}
        onTeleport={handleTeleportToNode}
        onDeleteNodes={handleDeleteNodes}
        onRecrawl={(nodeId) => {
          // Recrawl triggers a reload
          reload();
        }}
      />

      {/* Sitemap Import Modal */}
      <SitemapImportModal
        isOpen={showSitemapImport}
        onClose={() => setShowSitemapImport(false)}
        onImportComplete={reload}
      />

      {/* Crawl Modal */}
      <CrawlModal
        isOpen={showCrawl}
        onClose={() => setShowCrawl(false)}
        crawlerSettings={crawlerSettings}
        onCrawlComplete={handleCrawlComplete}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        displaySettings={displaySettings}
        crawlerSettings={crawlerSettings}
        keybindSettings={keybindSettings}
        autoCrawlSettings={autoCrawlSettings}
        autoCrawlStatus={autoCrawlStatus}
        isAutoCrawling={isAutoCrawling}
        isDiscovering={isDiscovering}
        currentlyCrawling={currentlyCrawling}
        discoveryStats={discoveryStats}
        nodeCount={nodeCount}
        onDisplaySettingsChange={setDisplaySettings}
        onCrawlerSettingsChange={setCrawlerSettings}
        onKeybindSettingsChange={setKeybindSettings}
        onAutoCrawlSettingsChange={setAutoCrawlSettings}
        onCrawlNow={crawlNow}
        onResetTimestamps={resetAllTimestamps}
        onDiscoverNow={discoverNow}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        nodes={nodes}
        onTeleport={handleTeleport}
        onEnterNode={handleEnterNode}
      />

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        node={contextMenu.node}
        onClose={handleCloseContextMenu}
        onOpenInBrowser={handleEnterNode}
        onTeleport={handleTeleportToNode}
        onDelete={handleDeleteNode}
      />

      {/* Stats Panel */}
      <StatsPanel
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        nodes={nodes}
        edges={edges}
        onTeleport={handleTeleportToNode}
        onDeleteNodes={handleDeleteNodes}
        onFilterDomain={setDomainFilter}
      />

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        input::placeholder {
          color: rgba(79, 195, 247, 0.5);
        }
      `}</style>
    </div>
  );
}

export default App;
