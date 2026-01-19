/**
 * Enhanced Import Modal - Import from multiple sources
 * - Crawler databases (.db)
 * - Browser bookmarks (Chrome JSON, Firefox HTML)
 * - Void exports (.json)
 */

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
// @ts-ignore - Tauri plugin may not be installed
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  parseBookmarks,
  parseVoidExport,
  BookmarkItem,
  ExportData,
} from "../lib/exportUtils";

interface ImportStats {
  nodes_imported: number;
  edges_imported: number;
  nodes_skipped: number;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type ImportSource = "crawler" | "bookmarks" | "void-export";

export function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
  const [source, setSource] = useState<ImportSource>("crawler");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // For bookmarks/void preview
  const [previewData, setPreviewData] = useState<{
    bookmarks?: BookmarkItem[];
    voidExport?: ExportData;
  } | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setResult(null);
      setError(null);
      setPreviewData(null);
      setSelectedFolders(new Set());
    }
  }, [isOpen]);

  const handleSelectFile = useCallback(async () => {
    try {
      let filters;
      switch (source) {
        case "crawler":
          filters = [{ name: "SQLite Database", extensions: ["db"] }];
          break;
        case "bookmarks":
          filters = [
            { name: "Bookmarks", extensions: ["json", "html", "htm"] },
          ];
          break;
        case "void-export":
          filters = [{ name: "Void Export", extensions: ["json"] }];
          break;
      }

      const file = await open({
        multiple: false,
        filters,
        title: `Select ${
          source === "crawler"
            ? "Crawler Database"
            : source === "bookmarks"
            ? "Bookmarks File"
            : "Void Export"
        }`,
      });

      if (file) {
        setSelectedFile(file as string);
        setError(null);
        setPreviewData(null);

        // Preview bookmarks or void export
        if (source === "bookmarks" || source === "void-export") {
          try {
            const content = await readTextFile(file as string);
            
            if (source === "bookmarks") {
              const bookmarks = parseBookmarks(content);
              setPreviewData({ bookmarks });
              
              // Auto-select all folders
              const folders = new Set(
                bookmarks
                  .map((b) => b.folder || "Uncategorized")
                  .filter(Boolean)
              );
              setSelectedFolders(folders);
            } else {
              const voidExport = parseVoidExport(content);
              if (voidExport) {
                setPreviewData({ voidExport });
              } else {
                setError("Invalid Void export file");
              }
            }
          } catch (err) {
            setError(`Failed to parse file: ${err}`);
          }
        }
      }
    } catch (err) {
      setError(`Failed to select file: ${err}`);
    }
  }, [source]);

  const handleImport = useCallback(async () => {
    if (!selectedFile) return;

    setImporting(true);
    setError(null);

    try {
      let stats: ImportStats;

      switch (source) {
        case "crawler":
          stats = await invoke<ImportStats>("import_crawler_db", {
            crawlerDbPath: selectedFile,
          });
          break;

        case "bookmarks":
          if (!previewData?.bookmarks) {
            throw new Error("No bookmarks loaded");
          }
          
          // Filter by selected folders
          const bookmarksToImport = previewData.bookmarks.filter(
            (b) => selectedFolders.has(b.folder || "Uncategorized")
          );
          
          // Add each bookmark as a node
          let imported = 0;
          let skipped = 0;
          
          for (const bookmark of bookmarksToImport) {
            try {
              await invoke("add_node_url", {
                url: bookmark.url,
                title: bookmark.title,
              });
              imported++;
            } catch {
              skipped++;
            }
          }
          
          stats = {
            nodes_imported: imported,
            edges_imported: 0,
            nodes_skipped: skipped,
          };
          break;

        case "void-export":
          if (!previewData?.voidExport) {
            throw new Error("No export data loaded");
          }
          
          // Import nodes and edges
          const exportData = previewData.voidExport;
          let nodesAdded = 0;
          let edgesAdded = 0;
          let nodesSkipped = 0;
          
          // Add nodes
          const idMap = new Map<number, number>();
          
          for (const node of exportData.nodes) {
            try {
              const newNode = await invoke<{ id: number }>("add_node_with_position", {
                url: node.url,
                title: node.title,
                x: node.position.x,
                y: node.position.y,
                z: node.position.z,
              });
              idMap.set(node.id, newNode.id);
              nodesAdded++;
            } catch {
              nodesSkipped++;
            }
          }
          
          // Add edges
          for (const edge of exportData.edges) {
            const newSourceId = idMap.get(edge.sourceId);
            const newTargetId = idMap.get(edge.targetId);
            
            if (newSourceId && newTargetId) {
              try {
                await invoke("add_edge", {
                  sourceId: newSourceId,
                  targetId: newTargetId,
                });
                edgesAdded++;
              } catch {}
            }
          }
          
          stats = {
            nodes_imported: nodesAdded,
            edges_imported: edgesAdded,
            nodes_skipped: nodesSkipped,
          };
          break;

        default:
          throw new Error("Unknown import source");
      }

      setResult(stats);
      onImportComplete();
    } catch (err) {
      setError(`Import failed: ${err}`);
    } finally {
      setImporting(false);
    }
  }, [selectedFile, source, previewData, selectedFolders, onImportComplete]);

  const toggleFolder = useCallback((folder: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  }, []);

  if (!isOpen) return null;

  // Get unique folders from bookmarks
  const bookmarkFolders = previewData?.bookmarks
    ? Array.from(
        new Set(previewData.bookmarks.map((b) => b.folder || "Uncategorized"))
      ).sort()
    : [];

  const sourceOptions: { id: ImportSource; label: string; icon: string; desc: string }[] = [
    { id: "crawler", label: "Crawler Database", icon: "🕷️", desc: "Import from crawler .db file" },
    { id: "bookmarks", label: "Browser Bookmarks", icon: "🔖", desc: "Chrome JSON or Firefox HTML" },
    { id: "void-export", label: "Void Export", icon: "📦", desc: "Import from exported .json" },
  ];

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
          background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
          border: "2px solid #4fc3f7",
          borderRadius: 12,
          padding: 24,
          width: 550,
          maxWidth: "90vw",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 0 40px rgba(79, 195, 247, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            color: "#4fc3f7",
            fontFamily: "monospace",
            margin: 0,
            marginBottom: 20,
            fontSize: 20,
          }}
        >
          📥 Import Data
        </h2>

        {/* Source Selection */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 12,
              marginBottom: 10,
              opacity: 0.8,
            }}
          >
            IMPORT SOURCE
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {sourceOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setSource(opt.id);
                  setSelectedFile(null);
                  setPreviewData(null);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background:
                    source === opt.id
                      ? "rgba(79, 195, 247, 0.2)"
                      : "rgba(79, 195, 247, 0.05)",
                  border: `1px solid ${
                    source === opt.id ? "#4fc3f7" : "rgba(79, 195, 247, 0.2)"
                  }`,
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 18 }}>{opt.icon}</div>
                <div style={{ marginTop: 4 }}>{opt.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* File Selection */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={handleSelectFile}
            disabled={importing}
            style={{
              padding: "12px 20px",
              background: "rgba(79, 195, 247, 0.1)",
              border: "1px solid #4fc3f7",
              borderRadius: 6,
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 14,
              cursor: importing ? "not-allowed" : "pointer",
              opacity: importing ? 0.5 : 1,
              width: "100%",
              textAlign: "left",
            }}
          >
            {selectedFile
              ? `📁 ${selectedFile.split(/[/\\]/).pop()}`
              : `📁 Select ${
                  source === "crawler"
                    ? "Database"
                    : source === "bookmarks"
                    ? "Bookmarks"
                    : "Export"
                } File...`}
          </button>
        </div>

        {/* Bookmark Folder Selection */}
        {source === "bookmarks" && previewData?.bookmarks && (
          <div
            style={{
              background: "rgba(79, 195, 247, 0.05)",
              border: "1px solid rgba(79, 195, 247, 0.2)",
              borderRadius: 6,
              padding: 16,
              marginBottom: 20,
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            <div
              style={{
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 12,
                marginBottom: 10,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>SELECT FOLDERS ({previewData.bookmarks.length} bookmarks)</span>
              <span>
                <button
                  onClick={() => setSelectedFolders(new Set(bookmarkFolders))}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 11,
                    cursor: "pointer",
                    textDecoration: "underline",
                    marginRight: 10,
                  }}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedFolders(new Set())}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 11,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  None
                </button>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bookmarkFolders.map((folder) => {
                const count = previewData.bookmarks!.filter(
                  (b) => (b.folder || "Uncategorized") === folder
                ).length;
                return (
                  <label
                    key={folder}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#4fc3f7",
                      fontFamily: "monospace",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFolders.has(folder)}
                      onChange={() => toggleFolder(folder)}
                    />
                    <span style={{ flex: 1 }}>{folder}</span>
                    <span style={{ opacity: 0.5 }}>({count})</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Void Export Preview */}
        {source === "void-export" && previewData?.voidExport && (
          <div
            style={{
              background: "rgba(79, 195, 247, 0.05)",
              border: "1px solid rgba(79, 195, 247, 0.2)",
              borderRadius: 6,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              EXPORT PREVIEW
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "6px 12px",
                color: "rgba(79, 195, 247, 0.8)",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              <span style={{ opacity: 0.6 }}>Session:</span>
              <span>{previewData.voidExport.sessionName || "Unknown"}</span>
              <span style={{ opacity: 0.6 }}>Nodes:</span>
              <span>{previewData.voidExport.nodes.length}</span>
              <span style={{ opacity: 0.6 }}>Edges:</span>
              <span>{previewData.voidExport.edges.length}</span>
              <span style={{ opacity: 0.6 }}>Exported:</span>
              <span>
                {new Date(previewData.voidExport.exportedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(255, 80, 80, 0.15)",
              border: "1px solid rgba(255, 80, 80, 0.5)",
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              color: "#ff8888",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            style={{
              background: "rgba(100, 255, 100, 0.1)",
              border: "1px solid rgba(100, 255, 100, 0.3)",
              borderRadius: 6,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                color: "#8f8",
                fontFamily: "monospace",
                fontSize: 14,
                fontWeight: "bold",
                marginBottom: 10,
              }}
            >
              ✓ Import Complete
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto auto",
                gap: "6px 16px",
                color: "rgba(100, 255, 100, 0.8)",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              <span style={{ opacity: 0.7 }}>Nodes imported:</span>
              <span>{result.nodes_imported}</span>
              <span style={{ opacity: 0.7 }}>Edges imported:</span>
              <span>{result.edges_imported}</span>
              <span style={{ opacity: 0.7 }}>Nodes skipped:</span>
              <span>{result.nodes_skipped}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              background: "transparent",
              border: "1px solid rgba(79, 195, 247, 0.3)",
              borderRadius: 6,
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 13,
              cursor: "pointer",
              opacity: 0.8,
            }}
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={
                !selectedFile ||
                importing ||
                (source === "bookmarks" && selectedFolders.size === 0)
              }
              style={{
                padding: "10px 24px",
                background:
                  selectedFile && !importing
                    ? "rgba(79, 195, 247, 0.2)"
                    : "rgba(79, 195, 247, 0.05)",
                border: "1px solid #4fc3f7",
                borderRadius: 6,
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 13,
                cursor:
                  selectedFile && !importing ? "pointer" : "not-allowed",
                opacity: selectedFile && !importing ? 1 : 0.4,
              }}
            >
              {importing
                ? "Importing..."
                : source === "bookmarks"
                ? `Import ${
                    previewData?.bookmarks
                      ? previewData.bookmarks.filter((b) =>
                          selectedFolders.has(b.folder || "Uncategorized")
                        ).length
                      : 0
                  } Bookmarks`
                : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
