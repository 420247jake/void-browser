import { useState, useCallback, useEffect, useRef } from "react";
import { ALL_THEMES } from "../lib/themes";

type LayoutMode = "random" | "force" | "cluster" | "depth";

interface DisplaySettings {
  showLabels: boolean;
  showEdges: boolean;
  nodeSize: number;
  labelScale: number;
  layoutMode: LayoutMode;
  showClusterBoundaries: boolean;
  theme: string;
  animateEdges: boolean;
  showNodeImportance: boolean;
}

interface CrawlerSettings {
  maxNodes: number;
  maxDepth: number;
  takeScreenshots: boolean;
  screenshotDelay: number;
}

export interface AutoCrawlSettings {
  enabled: boolean;
  intervalSeconds: number;
  staleDays: number;
  // Discovery settings
  discoveryEnabled: boolean;
  discoveryIntervalSeconds: number;
  maxNewNodesPerDiscovery: number;
  externalLinksOnly: boolean;
  maxTotalNodes: number;
}

export interface KeybindSettings {
  settings: string;
  addUrl: string;
  crawl: string;
  import: string;
  gallery: string;
  screenshot: string;
  toggleHelp: string;
}

interface AutoCrawlStatus {
  nodes_pending: number;
  last_crawled_url: string | null;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  displaySettings: DisplaySettings;
  crawlerSettings: CrawlerSettings;
  keybindSettings: KeybindSettings;
  autoCrawlSettings: AutoCrawlSettings;
  autoCrawlStatus?: AutoCrawlStatus;
  isAutoCrawling?: boolean;
  isDiscovering?: boolean;
  currentlyCrawling?: string | null;
  discoveryStats?: { totalDiscovered: number; lastDiscoveryTime: string | null };
  nodeCount?: number;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  onCrawlerSettingsChange: (settings: CrawlerSettings) => void;
  onKeybindSettingsChange: (settings: KeybindSettings) => void;
  onAutoCrawlSettingsChange: (settings: AutoCrawlSettings) => void;
  onCrawlNow?: () => void;
  onResetTimestamps?: () => Promise<number>;
  onDiscoverNow?: () => void;
}

// Helper to display key names nicely
function formatKeyName(key: string): string {
  const keyMap: Record<string, string> = {
    " ": "Space",
    "Backquote": "`",
    "Escape": "ESC",
    "ArrowUp": "↑",
    "ArrowDown": "↓",
    "ArrowLeft": "←",
    "ArrowRight": "→",
  };
  if (keyMap[key]) return keyMap[key];
  if (key.startsWith("Key")) return key.slice(3);
  if (key.startsWith("Digit")) return key.slice(5);
  return key;
}

// Helper to convert hex to RGB string
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "79, 195, 247";
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

export function SettingsPanel({
  isOpen,
  onClose,
  displaySettings,
  crawlerSettings,
  keybindSettings,
  autoCrawlSettings,
  autoCrawlStatus,
  isAutoCrawling,
  isDiscovering,
  currentlyCrawling,
  discoveryStats,
  nodeCount,
  onDisplaySettingsChange,
  onCrawlerSettingsChange,
  onKeybindSettingsChange,
  onAutoCrawlSettingsChange,
  onCrawlNow,
  onResetTimestamps,
  onDiscoverNow,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"display" | "crawler" | "keybinds" | "controls">("display");
  const [editingKey, setEditingKey] = useState<keyof KeybindSettings | null>(null);
  const [listeningForKey, setListeningForKey] = useState(false);
  const keybindButtonRef = useRef<HTMLButtonElement>(null);

  const handleDisplayChange = useCallback(
    (key: keyof DisplaySettings, value: boolean | number | string) => {
      onDisplaySettingsChange({ ...displaySettings, [key]: value });
    },
    [displaySettings, onDisplaySettingsChange]
  );

  const handleCrawlerChange = useCallback(
    (key: keyof CrawlerSettings, value: boolean | number) => {
      onCrawlerSettingsChange({ ...crawlerSettings, [key]: value });
    },
    [crawlerSettings, onCrawlerSettingsChange]
  );

  const handleAutoCrawlChange = useCallback(
    (key: keyof AutoCrawlSettings, value: boolean | number) => {
      onAutoCrawlSettingsChange({ ...autoCrawlSettings, [key]: value });
    },
    [autoCrawlSettings, onAutoCrawlSettingsChange]
  );

  // Handle keybind editing
  const startEditingKey = useCallback((keyName: keyof KeybindSettings) => {
    setEditingKey(keyName);
    setListeningForKey(true);
  }, []);

  // Listen for key press when editing
  useEffect(() => {
    if (!listeningForKey || !editingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Don't allow WASD, Space, Shift, Ctrl, Q, E (movement keys)
      const blockedKeys = ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "KeyQ", "KeyE"];
      if (blockedKeys.includes(e.code)) {
        // Show feedback that this key is reserved
        return;
      }

      // Use code for special keys, key for letters
      let keyValue = e.code;
      if (e.code.startsWith("Key")) {
        keyValue = e.key.toUpperCase();
      } else if (e.code.startsWith("Digit")) {
        keyValue = e.key;
      } else if (e.code === "Backquote") {
        keyValue = "`";
      } else if (e.code.startsWith("F") && e.code.length <= 3) {
        keyValue = e.code; // F1, F2, etc.
      }

      onKeybindSettingsChange({ ...keybindSettings, [editingKey]: keyValue });
      setEditingKey(null);
      setListeningForKey(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [listeningForKey, editingKey, keybindSettings, onKeybindSettingsChange]);

  // Cancel editing on click outside
  useEffect(() => {
    if (!listeningForKey) return;
    
    const handleClick = (e: MouseEvent) => {
      if (keybindButtonRef.current && !keybindButtonRef.current.contains(e.target as Node)) {
        setEditingKey(null);
        setListeningForKey(false);
      }
    };
    
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [listeningForKey]);

  if (!isOpen) return null;

  const tabStyle = (tab: string) => ({
    padding: "10px 14px",
    background: activeTab === tab ? "rgba(79, 195, 247, 0.2)" : "transparent",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #4fc3f7" : "2px solid transparent",
    color: activeTab === tab ? "#4fc3f7" : "rgba(79, 195, 247, 0.5)",
    fontFamily: "monospace",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s ease",
  });

  const toggleStyle = (enabled: boolean) => ({
    width: 44,
    height: 24,
    background: enabled ? "rgba(79, 195, 247, 0.4)" : "rgba(79, 195, 247, 0.1)",
    border: `1px solid ${enabled ? "#4fc3f7" : "rgba(79, 195, 247, 0.3)"}`,
    borderRadius: 12,
    position: "relative" as const,
    cursor: "pointer",
    transition: "all 0.2s ease",
  });

  const toggleKnobStyle = (enabled: boolean) => ({
    width: 18,
    height: 18,
    background: enabled ? "#4fc3f7" : "rgba(79, 195, 247, 0.5)",
    borderRadius: "50%",
    position: "absolute" as const,
    top: 2,
    left: enabled ? 22 : 2,
    transition: "all 0.2s ease",
    boxShadow: enabled ? "0 0 8px rgba(79, 195, 247, 0.6)" : "none",
  });

  const keybindLabels: Record<keyof KeybindSettings, { label: string; desc: string }> = {
    settings: { label: "Settings", desc: "Open this panel" },
    addUrl: { label: "Add URL", desc: "Add new URL manually" },
    crawl: { label: "Crawl", desc: "Start crawling a website" },
    import: { label: "Import", desc: "Import crawler database" },
    gallery: { label: "Gallery", desc: "Open screenshot gallery" },
    screenshot: { label: "Screenshot", desc: "Take a screenshot" },
    toggleHelp: { label: "Toggle Help", desc: "Show/hide controls overlay" },
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "rgba(10, 10, 30, 0.98)",
          border: "2px solid #4fc3f7",
          borderRadius: 12,
          width: 560,
          maxWidth: "90vw",
          maxHeight: "85vh",
          overflow: "hidden",
          boxShadow: "0 0 40px rgba(79, 195, 247, 0.3)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 0",
            borderBottom: "1px solid rgba(79, 195, 247, 0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2
              style={{
                color: "#4fc3f7",
                fontFamily: "monospace",
                margin: 0,
                fontSize: 20,
              }}
            >
              ⚙ Settings
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(79, 195, 247, 0.6)",
                fontSize: 20,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
            <button style={tabStyle("display")} onClick={() => setActiveTab("display")}>
              Display
            </button>
            <button style={tabStyle("crawler")} onClick={() => setActiveTab("crawler")}>
              Crawler
            </button>
            <button style={tabStyle("keybinds")} onClick={() => setActiveTab("keybinds")}>
              Keybinds
            </button>
            <button style={tabStyle("controls")} onClick={() => setActiveTab("controls")}>
              Controls
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {/* Display Settings Tab */}
          {activeTab === "display" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Show Labels */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Show Labels
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                    Display URL labels on nodes
                  </div>
                </div>
                <div
                  style={toggleStyle(displaySettings.showLabels)}
                  onClick={() => handleDisplayChange("showLabels", !displaySettings.showLabels)}
                >
                  <div style={toggleKnobStyle(displaySettings.showLabels)} />
                </div>
              </div>

              {/* Show Edges */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Show Connections
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                    Display edges between linked pages
                  </div>
                </div>
                <div
                  style={toggleStyle(displaySettings.showEdges)}
                  onClick={() => handleDisplayChange("showEdges", !displaySettings.showEdges)}
                >
                  <div style={toggleKnobStyle(displaySettings.showEdges)} />
                </div>
              </div>

              {/* Node Size */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Node Size
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                    {displaySettings.nodeSize.toFixed(1)}x
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={displaySettings.nodeSize}
                  onChange={(e) => handleDisplayChange("nodeSize", parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#4fc3f7" }}
                />
              </div>

              {/* Label Scale */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Label Size
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                    {displaySettings.labelScale.toFixed(1)}x
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={displaySettings.labelScale}
                  onChange={(e) => handleDisplayChange("labelScale", parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#4fc3f7" }}
                />
              </div>

              {/* Layout Mode */}
              <div>
                <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14, marginBottom: 8 }}>
                  Layout Mode
                </div>
                <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginBottom: 12 }}>
                  How nodes are positioned in 3D space
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {(["random", "force", "cluster", "depth"] as LayoutMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleDisplayChange("layoutMode", mode)}
                      style={{
                        padding: "10px 12px",
                        background: displaySettings.layoutMode === mode 
                          ? "rgba(79, 195, 247, 0.3)" 
                          : "rgba(79, 195, 247, 0.1)",
                        border: displaySettings.layoutMode === mode
                          ? "1px solid #4fc3f7"
                          : "1px solid rgba(79, 195, 247, 0.3)",
                        borderRadius: 6,
                        color: "#4fc3f7",
                        fontFamily: "monospace",
                        fontSize: 12,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {mode === "force" ? "Force-Directed" : 
                       mode === "cluster" ? "By Domain" :
                       mode === "depth" ? "Depth Shells" : "Random"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show Cluster Boundaries */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Show Cluster Boundaries
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                    Display sphere boundaries around domain clusters
                  </div>
                </div>
                <div
                  style={toggleStyle(displaySettings.showClusterBoundaries)}
                  onClick={() => handleDisplayChange("showClusterBoundaries", !displaySettings.showClusterBoundaries)}
                >
                  <div style={toggleKnobStyle(displaySettings.showClusterBoundaries)} />
                </div>
              </div>

              {/* Animate Edges */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Animate Edges
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                    Show flowing particles on connections
                  </div>
                </div>
                <div
                  style={toggleStyle(displaySettings.animateEdges)}
                  onClick={() => handleDisplayChange("animateEdges", !displaySettings.animateEdges)}
                >
                  <div style={toggleKnobStyle(displaySettings.animateEdges)} />
                </div>
              </div>

              {/* Node Importance */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Node Importance Sizing
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                    Size nodes by connection count
                  </div>
                </div>
                <div
                  style={toggleStyle(displaySettings.showNodeImportance)}
                  onClick={() => handleDisplayChange("showNodeImportance", !displaySettings.showNodeImportance)}
                >
                  <div style={toggleKnobStyle(displaySettings.showNodeImportance)} />
                </div>
              </div>

              {/* Theme Selector */}
              <div>
                <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14, marginBottom: 10 }}>
                  Color Theme
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {ALL_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => handleDisplayChange("theme", theme.id)}
                      style={{
                        padding: "10px 8px",
                        background: displaySettings.theme === theme.id 
                          ? `rgba(${hexToRgb(theme.primary)}, 0.2)` 
                          : "rgba(79, 195, 247, 0.05)",
                        border: displaySettings.theme === theme.id 
                          ? `2px solid ${theme.primary}` 
                          : "1px solid rgba(79, 195, 247, 0.2)",
                        borderRadius: 6,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: theme.primary,
                        boxShadow: `0 0 10px ${theme.primary}`,
                      }} />
                      <span style={{
                        color: displaySettings.theme === theme.id ? theme.primary : "rgba(79, 195, 247, 0.6)",
                        fontFamily: "monospace",
                        fontSize: 10,
                      }}>
                        {theme.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Crawler Settings Tab */}
          {activeTab === "crawler" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Max Nodes */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Max Pages
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                    {crawlerSettings.maxNodes}
                  </div>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={crawlerSettings.maxNodes}
                  onChange={(e) => handleCrawlerChange("maxNodes", parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#4fc3f7" }}
                />
                <div style={{ color: "rgba(79, 195, 247, 0.4)", fontFamily: "monospace", fontSize: 10, marginTop: 4 }}>
                  Maximum number of pages to crawl
                </div>
              </div>

              {/* Max Depth */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Crawl Depth
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                    {crawlerSettings.maxDepth} levels
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={crawlerSettings.maxDepth}
                  onChange={(e) => handleCrawlerChange("maxDepth", parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#4fc3f7" }}
                />
                <div style={{ color: "rgba(79, 195, 247, 0.4)", fontFamily: "monospace", fontSize: 10, marginTop: 4 }}>
                  How many link hops from the starting page
                </div>
              </div>

              {/* Screenshots */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Take Screenshots
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                    Capture page screenshots during crawl
                  </div>
                </div>
                <div
                  style={toggleStyle(crawlerSettings.takeScreenshots)}
                  onClick={() => handleCrawlerChange("takeScreenshots", !crawlerSettings.takeScreenshots)}
                >
                  <div style={toggleKnobStyle(crawlerSettings.takeScreenshots)} />
                </div>
              </div>

              {/* Screenshot Delay */}
              {crawlerSettings.takeScreenshots && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                      Screenshot Delay
                    </div>
                    <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                      {crawlerSettings.screenshotDelay}ms
                    </div>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    step="250"
                    value={crawlerSettings.screenshotDelay}
                    onChange={(e) => handleCrawlerChange("screenshotDelay", parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#4fc3f7" }}
                  />
                  <div style={{ color: "rgba(79, 195, 247, 0.4)", fontFamily: "monospace", fontSize: 10, marginTop: 4 }}>
                    Wait time before capturing (for page loading)
                  </div>
                </div>
              )}

              {/* Divider */}
              <div style={{ 
                borderTop: "1px solid rgba(79, 195, 247, 0.2)", 
                margin: "8px 0",
                paddingTop: 16,
              }}>
                <div style={{ 
                  color: "#4fc3f7", 
                  fontFamily: "monospace", 
                  fontSize: 12, 
                  fontWeight: "bold",
                  marginBottom: 16,
                  opacity: 0.8,
                }}>
                  🔄 AUTO-CRAWL
                </div>
              </div>

              {/* Auto-Crawl Enable */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                    Enable Auto-Crawl
                  </div>
                  <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                    Automatically fetch metadata for nodes
                  </div>
                </div>
                <div
                  style={toggleStyle(autoCrawlSettings.enabled)}
                  onClick={() => handleAutoCrawlChange("enabled", !autoCrawlSettings.enabled)}
                >
                  <div style={toggleKnobStyle(autoCrawlSettings.enabled)} />
                </div>
              </div>

              {/* Auto-Crawl Status */}
              {autoCrawlSettings.enabled && (
                <div style={{
                  padding: "10px 12px",
                  background: "rgba(79, 195, 247, 0.05)",
                  borderRadius: 6,
                  border: "1px solid rgba(79, 195, 247, 0.1)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 11 }}>
                      {isAutoCrawling ? (
                        <span style={{ color: "#4fc3f7" }}>
                          ⏳ Crawling: {currentlyCrawling ? new URL(currentlyCrawling).hostname : "..."}
                        </span>
                      ) : (
                        <span>
                          📊 {autoCrawlStatus?.nodes_pending || 0} nodes pending
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {onResetTimestamps && (
                        <button
                          onClick={onResetTimestamps}
                          disabled={isAutoCrawling}
                          title="Mark all nodes as needing re-crawl"
                          style={{
                            padding: "4px 10px",
                            background: isAutoCrawling ? "transparent" : "rgba(255, 152, 0, 0.1)",
                            border: "1px solid rgba(255, 152, 0, 0.4)",
                            borderRadius: 4,
                            color: "#ff9800",
                            fontFamily: "monospace",
                            fontSize: 10,
                            cursor: isAutoCrawling ? "not-allowed" : "pointer",
                            opacity: isAutoCrawling ? 0.5 : 1,
                          }}
                        >
                          Reset All
                        </button>
                      )}
                      {onCrawlNow && (
                        <button
                          onClick={onCrawlNow}
                          disabled={isAutoCrawling}
                          style={{
                            padding: "4px 10px",
                            background: isAutoCrawling ? "transparent" : "rgba(79, 195, 247, 0.1)",
                            border: "1px solid rgba(79, 195, 247, 0.3)",
                            borderRadius: 4,
                            color: "#4fc3f7",
                            fontFamily: "monospace",
                            fontSize: 10,
                            cursor: isAutoCrawling ? "not-allowed" : "pointer",
                            opacity: isAutoCrawling ? 0.5 : 1,
                          }}
                        >
                          Crawl Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Crawl Interval */}
              {autoCrawlSettings.enabled && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                      Crawl Interval
                    </div>
                    <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                      {autoCrawlSettings.intervalSeconds}s
                    </div>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={autoCrawlSettings.intervalSeconds}
                    onChange={(e) => handleAutoCrawlChange("intervalSeconds", parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#4fc3f7" }}
                  />
                  <div style={{ color: "rgba(79, 195, 247, 0.4)", fontFamily: "monospace", fontSize: 10, marginTop: 4 }}>
                    Time between each auto-crawl
                  </div>
                </div>
              )}

              {/* Stale Days */}
              {autoCrawlSettings.enabled && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                      Re-crawl After
                    </div>
                    <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                      {autoCrawlSettings.staleDays} days
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={autoCrawlSettings.staleDays}
                    onChange={(e) => handleAutoCrawlChange("staleDays", parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#4fc3f7" }}
                  />
                  <div style={{ color: "rgba(79, 195, 247, 0.4)", fontFamily: "monospace", fontSize: 10, marginTop: 4 }}>
                    Re-crawl nodes older than this
                  </div>
                </div>
              )}

              {/* === AUTO-DISCOVERY SECTION === */}
              {autoCrawlSettings.enabled && (
                <>
                  {/* Divider */}
                  <div style={{ 
                    borderTop: "1px solid rgba(79, 195, 247, 0.2)", 
                    margin: "12px 0",
                    paddingTop: 16,
                  }}>
                    <div style={{ 
                      color: "#4fc3f7", 
                      fontFamily: "monospace", 
                      fontSize: 12, 
                      fontWeight: "bold",
                      marginBottom: 16,
                      opacity: 0.8,
                    }}>
                      🌐 AUTO-DISCOVERY (Spawn New Nodes)
                    </div>
                  </div>

                  {/* Discovery Enable */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                        Enable Auto-Discovery
                      </div>
                      <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                        Automatically discover and add new nodes from links
                      </div>
                    </div>
                    <div
                      style={toggleStyle(autoCrawlSettings.discoveryEnabled)}
                      onClick={() => handleAutoCrawlChange("discoveryEnabled", !autoCrawlSettings.discoveryEnabled)}
                    >
                      <div style={toggleKnobStyle(autoCrawlSettings.discoveryEnabled)} />
                    </div>
                  </div>

                  {/* Discovery Status */}
                  {autoCrawlSettings.discoveryEnabled && (
                    <div style={{
                      padding: "10px 12px",
                      background: "rgba(79, 195, 247, 0.05)",
                      borderRadius: 6,
                      border: "1px solid rgba(79, 195, 247, 0.1)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 11 }}>
                          {isDiscovering ? (
                            <span style={{ color: "#4fc3f7" }}>
                              🔍 Discovering: {currentlyCrawling ? new URL(currentlyCrawling).hostname : "..."}
                            </span>
                          ) : (
                            <span>
                              🌐 {nodeCount || 0} nodes | {discoveryStats?.totalDiscovered || 0} discovered this session
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {onDiscoverNow && (
                            <button
                              onClick={onDiscoverNow}
                              disabled={isDiscovering}
                              style={{
                                padding: "4px 10px",
                                background: isDiscovering ? "transparent" : "rgba(79, 195, 247, 0.1)",
                                border: "1px solid rgba(79, 195, 247, 0.3)",
                                borderRadius: 4,
                                color: "#4fc3f7",
                                fontFamily: "monospace",
                                fontSize: 10,
                                cursor: isDiscovering ? "not-allowed" : "pointer",
                                opacity: isDiscovering ? 0.5 : 1,
                              }}
                            >
                              Discover Now
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Discovery Interval */}
                  {autoCrawlSettings.discoveryEnabled && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                          Discovery Interval
                        </div>
                        <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                          {autoCrawlSettings.discoveryIntervalSeconds}s
                        </div>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="300"
                        step="10"
                        value={autoCrawlSettings.discoveryIntervalSeconds}
                        onChange={(e) => handleAutoCrawlChange("discoveryIntervalSeconds", parseInt(e.target.value))}
                        style={{ width: "100%", accentColor: "#4fc3f7" }}
                      />
                      <div style={{ color: "rgba(79, 195, 247, 0.4)", fontFamily: "monospace", fontSize: 10, marginTop: 4 }}>
                        Time between each discovery crawl
                      </div>
                    </div>
                  )}

                  {/* Max New Nodes Per Discovery */}
                  {autoCrawlSettings.discoveryEnabled && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                          Nodes Per Discovery
                        </div>
                        <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                          {autoCrawlSettings.maxNewNodesPerDiscovery}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={autoCrawlSettings.maxNewNodesPerDiscovery}
                        onChange={(e) => handleAutoCrawlChange("maxNewNodesPerDiscovery", parseInt(e.target.value))}
                        style={{ width: "100%", accentColor: "#4fc3f7" }}
                      />
                      <div style={{ color: "rgba(79, 195, 247, 0.4)", fontFamily: "monospace", fontSize: 10, marginTop: 4 }}>
                        Max new nodes to add per discovery cycle
                      </div>
                    </div>
                  )}

                  {/* Max Total Nodes */}
                  {autoCrawlSettings.discoveryEnabled && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                          Max Total Nodes
                        </div>
                        <div style={{ color: "rgba(79, 195, 247, 0.7)", fontFamily: "monospace", fontSize: 13 }}>
                          {autoCrawlSettings.maxTotalNodes}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="2000"
                        step="50"
                        value={autoCrawlSettings.maxTotalNodes}
                        onChange={(e) => handleAutoCrawlChange("maxTotalNodes", parseInt(e.target.value))}
                        style={{ width: "100%", accentColor: "#4fc3f7" }}
                      />
                      <div style={{ color: "rgba(79, 195, 247, 0.4)", fontFamily: "monospace", fontSize: 10, marginTop: 4 }}>
                        Stop discovering when this limit is reached
                      </div>
                    </div>
                  )}

                  {/* External Links Only */}
                  {autoCrawlSettings.discoveryEnabled && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 14 }}>
                          External Links Only
                        </div>
                        <div style={{ color: "rgba(79, 195, 247, 0.5)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                          Only add links to different domains
                        </div>
                      </div>
                      <div
                        style={toggleStyle(autoCrawlSettings.externalLinksOnly)}
                        onClick={() => handleAutoCrawlChange("externalLinksOnly", !autoCrawlSettings.externalLinksOnly)}
                      >
                        <div style={toggleKnobStyle(autoCrawlSettings.externalLinksOnly)} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Keybinds Tab */}
          {activeTab === "keybinds" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ 
                color: "rgba(79, 195, 247, 0.6)", 
                fontFamily: "monospace", 
                fontSize: 11, 
                marginBottom: 8,
                padding: "8px 12px",
                background: "rgba(79, 195, 247, 0.05)",
                borderRadius: 6,
                border: "1px solid rgba(79, 195, 247, 0.1)",
              }}>
                💡 Click a key to change it. WASD, Space, Shift, Ctrl, Q, E are reserved for movement.
              </div>

              {(Object.keys(keybindLabels) as Array<keyof KeybindSettings>).map((key) => (
                <div 
                  key={key}
                  style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    padding: "10px 12px",
                    background: editingKey === key ? "rgba(79, 195, 247, 0.1)" : "transparent",
                    borderRadius: 6,
                    transition: "background 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 13 }}>
                      {keybindLabels[key].label}
                    </div>
                    <div style={{ color: "rgba(79, 195, 247, 0.4)", fontFamily: "monospace", fontSize: 10, marginTop: 2 }}>
                      {keybindLabels[key].desc}
                    </div>
                  </div>
                  <button
                    ref={editingKey === key ? keybindButtonRef : null}
                    onClick={() => startEditingKey(key)}
                    style={{
                      minWidth: 70,
                      padding: "8px 14px",
                      background: editingKey === key ? "rgba(79, 195, 247, 0.3)" : "rgba(79, 195, 247, 0.1)",
                      border: editingKey === key ? "2px solid #4fc3f7" : "1px solid rgba(79, 195, 247, 0.3)",
                      borderRadius: 6,
                      color: "#4fc3f7",
                      fontFamily: "monospace",
                      fontSize: 13,
                      fontWeight: "bold",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      animation: editingKey === key ? "pulse 1s infinite" : "none",
                    }}
                  >
                    {editingKey === key ? "Press key..." : formatKeyName(keybindSettings[key])}
                  </button>
                </div>
              ))}

              <style>{`
                @keyframes pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(79, 195, 247, 0.4); }
                  50% { box-shadow: 0 0 0 8px rgba(79, 195, 247, 0); }
                }
              `}</style>
            </div>
          )}

          {/* Controls Tab */}
          {activeTab === "controls" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "12px 24px",
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: "bold", gridColumn: "1 / -1", marginBottom: 4, fontSize: 14, opacity: 0.8 }}>
                Navigation (Fixed)
              </div>
              <span style={{ opacity: 0.5, textAlign: "right" }}>WASD</span>
              <span>Move forward/left/back/right</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>Space</span>
              <span>Move up</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>Shift</span>
              <span>Move down</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>Q / E</span>
              <span>Roll camera</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>Ctrl</span>
              <span>Sprint (2x speed)</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>Mouse</span>
              <span>Look around</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>Click</span>
              <span>Lock mouse / Enter node</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>ESC</span>
              <span>Unlock mouse / Close panels</span>

              <div style={{ fontWeight: "bold", gridColumn: "1 / -1", marginTop: 12, marginBottom: 4, fontSize: 14, opacity: 0.8 }}>
                Actions (Customizable)
              </div>
              <span style={{ opacity: 0.5, textAlign: "right" }}>{formatKeyName(keybindSettings.addUrl)}</span>
              <span>Add new URL manually</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>{formatKeyName(keybindSettings.crawl)}</span>
              <span>Crawl a website</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>{formatKeyName(keybindSettings.import)}</span>
              <span>Import crawler database</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>{formatKeyName(keybindSettings.gallery)}</span>
              <span>Open gallery</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>{formatKeyName(keybindSettings.screenshot)}</span>
              <span>Take screenshot</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>{formatKeyName(keybindSettings.settings)}</span>
              <span>Open settings</span>
              <span style={{ opacity: 0.5, textAlign: "right" }}>{formatKeyName(keybindSettings.toggleHelp)}</span>
              <span>Toggle controls overlay</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid rgba(79, 195, 247, 0.2)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px",
              background: "rgba(79, 195, 247, 0.15)",
              border: "1px solid #4fc3f7",
              borderRadius: 6,
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Export types for use in App.tsx
export type { DisplaySettings, CrawlerSettings, LayoutMode };
