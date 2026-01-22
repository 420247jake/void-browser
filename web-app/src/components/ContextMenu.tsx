import { useState, useEffect, useCallback, useRef } from "react";
import { VoidNode } from "../lib/types";

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  node: VoidNode | null;
  onClose: () => void;
  onCrawl?: (node: VoidNode) => void;
  onDelete?: (node: VoidNode) => void;
  onCopyUrl?: (url: string) => void;
  onEdit?: (node: VoidNode) => void;
  onFavorite?: (node: VoidNode) => void;
  onOpenInBrowser?: (url: string, title: string) => void;
  onTeleport?: (node: VoidNode) => void;
}

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export function ContextMenu({
  isOpen,
  position,
  node,
  onClose,
  onCrawl,
  onDelete,
  onCopyUrl,
  onEdit,
  onFavorite,
  onOpenInBrowser,
  onTeleport,
}: ContextMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Build menu items based on available callbacks
  const menuItems: MenuItem[] = node ? [
    {
      label: "Open in Browser",
      icon: "🌐",
      action: () => {
        if (onOpenInBrowser) onOpenInBrowser(node.url, node.title);
        onClose();
      },
      shortcut: "Enter",
    },
    {
      label: "Teleport Here",
      icon: "📍",
      action: () => {
        if (onTeleport) onTeleport(node);
        onClose();
      },
      shortcut: "T",
    },
    { label: "", icon: "", action: () => {}, divider: true },
    {
      label: "Copy URL",
      icon: "📋",
      action: async () => {
        try {
          await navigator.clipboard.writeText(node.url);
          setCopySuccess(true);
          setTimeout(() => {
            setCopySuccess(false);
            onClose();
          }, 800);
        } catch {
          if (onCopyUrl) onCopyUrl(node.url);
          onClose();
        }
      },
      shortcut: "C",
    },
    {
      label: "Crawl from Here",
      icon: "🕷️",
      action: () => {
        if (onCrawl) onCrawl(node);
        onClose();
      },
      shortcut: "R",
      disabled: !onCrawl,
    },
    {
      label: node.is_favorite ? "Remove Favorite" : "Add to Favorites",
      icon: node.is_favorite ? "💔" : "⭐",
      action: () => {
        if (onFavorite) onFavorite(node);
        onClose();
      },
      shortcut: "F",
    },
    { label: "", icon: "", action: () => {}, divider: true },
    {
      label: "Edit Node",
      icon: "✏️",
      action: () => {
        if (onEdit) onEdit(node);
        onClose();
      },
      shortcut: "E",
      disabled: !onEdit,
    },
    {
      label: "Delete Node",
      icon: "🗑️",
      action: () => {
        if (onDelete) onDelete(node);
        onClose();
      },
      shortcut: "Del",
      danger: true,
    },
  ] : [];

  // Filter out dividers for navigation, but keep for rendering
  const navigableItems = menuItems.filter(item => !item.divider && !item.disabled);

  // Reset selection when menu opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setCopySuccess(false);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    // Small delay to prevent immediate close from the right-click event
    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 10);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % navigableItems.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + navigableItems.length) % navigableItems.length);
          break;
        case "Enter":
          e.preventDefault();
          navigableItems[selectedIndex]?.action();
          break;
        // Shortcut keys
        case "t":
        case "T":
          e.preventDefault();
          const teleportItem = menuItems.find(i => i.shortcut === "T");
          teleportItem?.action();
          break;
        case "c":
        case "C":
          e.preventDefault();
          const copyItem = menuItems.find(i => i.shortcut === "C");
          copyItem?.action();
          break;
        case "r":
        case "R":
          e.preventDefault();
          const crawlItem = menuItems.find(i => i.shortcut === "R" && !i.disabled);
          crawlItem?.action();
          break;
        case "f":
        case "F":
          e.preventDefault();
          const favItem = menuItems.find(i => i.shortcut === "F");
          favItem?.action();
          break;
        case "e":
        case "E":
          e.preventDefault();
          const editItem = menuItems.find(i => i.shortcut === "E" && !i.disabled);
          editItem?.action();
          break;
        case "Delete":
          e.preventDefault();
          const deleteItem = menuItems.find(i => i.shortcut === "Del");
          deleteItem?.action();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, navigableItems, menuItems]);

  // Adjust position to keep menu on screen
  const adjustedPosition = useCallback(() => {
    if (!menuRef.current) return position;
    
    const menuWidth = 220;
    const menuHeight = menuItems.length * 36;
    const padding = 10;
    
    let x = position.x;
    let y = position.y;
    
    if (x + menuWidth + padding > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight + padding > window.innerHeight) {
      y = window.innerHeight - menuHeight - padding;
    }
    
    return { x: Math.max(padding, x), y: Math.max(padding, y) };
  }, [position, menuItems.length]);

  if (!isOpen || !node) return null;

  const pos = adjustedPosition();
  let navIndex = 0;

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: pos.y,
        left: pos.x,
        zIndex: 1000,
        background: "rgba(10, 10, 30, 0.98)",
        border: "1px solid rgba(79, 195, 247, 0.4)",
        borderRadius: 8,
        padding: "6px 0",
        minWidth: 200,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5), 0 0 30px rgba(79, 195, 247, 0.15)",
        fontFamily: "monospace",
        fontSize: 13,
        animation: "contextMenuFadeIn 0.15s ease",
      }}
    >
      {/* Node info header */}
      <div style={{
        padding: "8px 14px 10px",
        borderBottom: "1px solid rgba(79, 195, 247, 0.2)",
        marginBottom: 4,
      }}>
        <div style={{
          color: "#4fc3f7",
          fontWeight: "bold",
          fontSize: 12,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 180,
        }}>
          {node.title || "Untitled"}
        </div>
        <div style={{
          color: "rgba(79, 195, 247, 0.5)",
          fontSize: 10,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 180,
        }}>
          {node.url}
        </div>
      </div>

      {/* Menu items */}
      {menuItems.map((item, index) => {
        if (item.divider) {
          return (
            <div
              key={`divider-${index}`}
              style={{
                height: 1,
                background: "rgba(79, 195, 247, 0.15)",
                margin: "4px 10px",
              }}
            />
          );
        }

        const currentNavIndex = navIndex;
        navIndex++;
        const isSelected = currentNavIndex === selectedIndex;

        return (
          <div
            key={item.label}
            onClick={item.disabled ? undefined : item.action}
            style={{
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: item.disabled ? "not-allowed" : "pointer",
              background: isSelected ? "rgba(79, 195, 247, 0.15)" : "transparent",
              color: item.disabled 
                ? "rgba(79, 195, 247, 0.3)" 
                : item.danger 
                  ? "#f55" 
                  : "#4fc3f7",
              transition: "background 0.1s ease",
              opacity: item.disabled ? 0.5 : 1,
            }}
            onMouseEnter={() => !item.disabled && setSelectedIndex(currentNavIndex)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>
                {copySuccess && item.shortcut === "C" ? "Copied!" : item.label}
              </span>
            </span>
            {item.shortcut && (
              <span style={{
                fontSize: 10,
                opacity: 0.5,
                background: "rgba(79, 195, 247, 0.1)",
                padding: "2px 6px",
                borderRadius: 3,
              }}>
                {item.shortcut}
              </span>
            )}
          </div>
        );
      })}

      {/* CSS Animation */}
      <style>{`
        @keyframes contextMenuFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
