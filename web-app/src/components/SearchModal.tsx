import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { VoidNode } from "../lib/types";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: VoidNode[];
  onTeleport: (nodeId: number, position: [number, number, number]) => void;
  onEnterNode?: (url: string, title: string) => void;
}

export function SearchModal({ isOpen, onClose, nodes, onTeleport, onEnterNode }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!query.trim()) return nodes.slice(0, 20); // Show recent nodes if no query
    
    const lowerQuery = query.toLowerCase();
    return nodes
      .filter(node => {
        const title = (node.title || "").toLowerCase();
        const url = node.url.toLowerCase();
        const domain = new URL(node.url).hostname.toLowerCase();
        
        return title.includes(lowerQuery) || 
               url.includes(lowerQuery) || 
               domain.includes(lowerQuery);
      })
      .slice(0, 20); // Limit results
  }, [query, nodes]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredNodes]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredNodes.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, filteredNodes.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredNodes.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredNodes[selectedIndex]) {
          handleSelect(filteredNodes[selectedIndex]);
        }
        break;
      case "Escape":
        onClose();
        break;
    }
  }, [filteredNodes, selectedIndex, onClose]);

  const handleSelect = useCallback((node: VoidNode) => {
    // Teleport camera to node position
    onTeleport(node.id, [node.position_x, node.position_y, node.position_z]);
    onClose();
  }, [onTeleport, onClose]);

  const handleEnter = useCallback((node: VoidNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEnterNode) {
      onEnterNode(node.url, node.title);
    }
    onClose();
  }, [onEnterNode, onClose]);

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return text;
    
    return (
      <>
        {text.slice(0, index)}
        <span style={{ background: "rgba(79, 195, 247, 0.3)", borderRadius: 2 }}>
          {text.slice(index, index + query.length)}
        </span>
        {text.slice(index + query.length)}
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 100,
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "rgba(10, 10, 30, 0.98)",
          border: "2px solid #4fc3f7",
          borderRadius: 12,
          width: "90%",
          maxWidth: 600,
          maxHeight: "70vh",
          overflow: "hidden",
          boxShadow: "0 0 60px rgba(79, 195, 247, 0.3)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{ padding: 16, borderBottom: "1px solid rgba(79, 195, 247, 0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20, opacity: 0.7 }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search nodes by title, URL, or domain..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#4fc3f7",
                fontSize: 18,
                fontFamily: "monospace",
              }}
            />
            <kbd style={{
              background: "rgba(79, 195, 247, 0.1)",
              border: "1px solid rgba(79, 195, 247, 0.3)",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 12,
              color: "#4fc3f7",
              opacity: 0.7,
            }}>
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            maxHeight: "calc(70vh - 80px)",
            overflowY: "auto",
          }}
        >
          {filteredNodes.length === 0 ? (
            <div style={{
              padding: 40,
              textAlign: "center",
              color: "#4fc3f7",
              opacity: 0.5,
              fontFamily: "monospace",
            }}>
              No nodes found matching "{query}"
            </div>
          ) : (
            filteredNodes.map((node, index) => (
              <div
                key={node.id}
                onClick={() => handleSelect(node)}
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  background: index === selectedIndex 
                    ? "rgba(79, 195, 247, 0.15)" 
                    : "transparent",
                  borderLeft: index === selectedIndex 
                    ? "3px solid #4fc3f7" 
                    : "3px solid transparent",
                  transition: "all 0.1s ease",
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {/* Favicon */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: "rgba(79, 195, 247, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {node.favicon ? (
                    <img 
                      src={node.favicon} 
                      alt=""
                      style={{ width: 20, height: 20, borderRadius: 2 }}
                      onError={e => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    <span style={{ fontSize: 16 }}>🌐</span>
                  )}
                </div>

                {/* Node Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 14,
                    fontWeight: "bold",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {highlightMatch(node.title || getDomain(node.url), query)}
                  </div>
                  <div style={{
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 11,
                    opacity: 0.6,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {highlightMatch(node.url, query)}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={(e) => handleEnter(node, e)}
                    style={{
                      background: "rgba(79, 195, 247, 0.2)",
                      border: "1px solid rgba(79, 195, 247, 0.4)",
                      borderRadius: 4,
                      padding: "4px 10px",
                      color: "#4fc3f7",
                      fontSize: 11,
                      fontFamily: "monospace",
                      cursor: "pointer",
                    }}
                  >
                    Open
                  </button>
                  <div style={{
                    background: "rgba(79, 195, 247, 0.1)",
                    borderRadius: 4,
                    padding: "4px 8px",
                    color: "#4fc3f7",
                    fontSize: 10,
                    fontFamily: "monospace",
                    opacity: 0.6,
                  }}>
                    ↵ Teleport
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(79, 195, 247, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: "#4fc3f7",
          opacity: 0.6,
          fontFamily: "monospace",
        }}>
          <span>{filteredNodes.length} node{filteredNodes.length !== 1 ? "s" : ""}</span>
          <div style={{ display: "flex", gap: 16 }}>
            <span>↑↓ Navigate</span>
            <span>↵ Teleport</span>
            <span>ESC Close</span>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        input::placeholder {
          color: rgba(79, 195, 247, 0.4);
        }
        div::-webkit-scrollbar {
          width: 8px;
        }
        div::-webkit-scrollbar-track {
          background: rgba(79, 195, 247, 0.05);
        }
        div::-webkit-scrollbar-thumb {
          background: rgba(79, 195, 247, 0.2);
          border-radius: 4px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 195, 247, 0.3);
        }
      `}</style>
    </div>
  );
}
