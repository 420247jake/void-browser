/**
 * Export Modal - Export void data to various formats
 */

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VoidNode, VoidEdge } from "../lib/types";
import {
  exportToJSON,
  exportNodesToCSV,
  exportEdgesToCSV,
} from "../lib/exportUtils";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: VoidNode[];
  edges: VoidEdge[];
  sessionName: string;
}

type ExportFormat = "json" | "csv-nodes" | "csv-edges" | "csv-both" | "image";

export function ExportModal({
  isOpen,
  onClose,
  nodes,
  edges,
  sessionName,
}: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("json");
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [includeScreenshots, setIncludeScreenshots] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      let filename: string;
      let content: string;
      const timestamp = new Date().toISOString().slice(0, 10);

      switch (selectedFormat) {
        case "json":
          filename = `void-export-${sessionName}-${timestamp}.json`;
          content = exportToJSON(nodes, edges, sessionName);
          break;

        case "csv-nodes":
          filename = `void-nodes-${sessionName}-${timestamp}.csv`;
          content = exportNodesToCSV(nodes);
          break;

        case "csv-edges":
          filename = `void-edges-${sessionName}-${timestamp}.csv`;
          content = exportEdgesToCSV(edges, nodes);
          break;

        case "csv-both":
          // Export both files
          const nodesFile = `void-nodes-${sessionName}-${timestamp}.csv`;
          const edgesFile = `void-edges-${sessionName}-${timestamp}.csv`;
          
          await invoke("export_file", {
            filename: nodesFile,
            content: exportNodesToCSV(nodes),
          });
          await invoke("export_file", {
            filename: edgesFile,
            content: exportEdgesToCSV(edges, nodes),
          });
          
          setExportResult(`Exported ${nodesFile} and ${edgesFile}`);
          setIsExporting(false);
          return;

        case "image":
          // Capture canvas
          const canvas = document.querySelector("canvas");
          if (!canvas) {
            throw new Error("Canvas not found");
          }
          const dataUrl = canvas.toDataURL("image/png");
          filename = `void-screenshot-${sessionName}-${timestamp}.png`;
          
          const savedPath = await invoke<string>("save_screenshot_as", {
            dataUrl,
            filename,
          });
          
          setExportResult(`Saved: ${savedPath}`);
          setIsExporting(false);
          return;

        default:
          throw new Error("Unknown format");
      }

      // Save file
      const savedPath = await invoke<string>("export_file", {
        filename,
        content,
      });

      setExportResult(`Exported: ${savedPath}`);
    } catch (err) {
      console.error("Export failed:", err);
      setExportResult(`Error: ${String(err)}`);
    } finally {
      setIsExporting(false);
    }
  }, [selectedFormat, nodes, edges, sessionName, includeScreenshots]);

  if (!isOpen) return null;

  const formats: { id: ExportFormat; label: string; desc: string }[] = [
    { id: "json", label: "JSON (Full)", desc: "Complete data with positions, edges, metadata" },
    { id: "csv-nodes", label: "CSV (Nodes)", desc: "Spreadsheet of all nodes/URLs" },
    { id: "csv-edges", label: "CSV (Edges)", desc: "Spreadsheet of all connections" },
    { id: "csv-both", label: "CSV (Both)", desc: "Export nodes and edges as separate files" },
    { id: "image", label: "PNG Image", desc: "Screenshot of current 3D view" },
  ];

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
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
          border: "2px solid #4fc3f7",
          borderRadius: 12,
          padding: 30,
          minWidth: 450,
          maxWidth: 500,
          boxShadow: "0 0 60px rgba(79, 195, 247, 0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 25,
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 20,
            }}
          >
            📤 Export Void Data
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#4fc3f7",
              fontSize: 24,
              cursor: "pointer",
              opacity: 0.7,
            }}
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div
          style={{
            background: "rgba(79, 195, 247, 0.1)",
            borderRadius: 8,
            padding: 15,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 13,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <span>Session: <strong>{sessionName}</strong></span>
            <span>Nodes: <strong>{nodes.length}</strong></span>
            <span>Edges: <strong>{edges.length}</strong></span>
            <span>
              Domains:{" "}
              <strong>
                {new Set(nodes.map((n) => {
                  try { return new URL(n.url).hostname; } catch { return ""; }
                })).size}
              </strong>
            </span>
          </div>
        </div>

        {/* Format Selection */}
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
            EXPORT FORMAT
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {formats.map((f) => (
              <label
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  background:
                    selectedFormat === f.id
                      ? "rgba(79, 195, 247, 0.2)"
                      : "rgba(79, 195, 247, 0.05)",
                  border: `1px solid ${
                    selectedFormat === f.id
                      ? "#4fc3f7"
                      : "rgba(79, 195, 247, 0.2)"
                  }`,
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <input
                  type="radio"
                  name="format"
                  checked={selectedFormat === f.id}
                  onChange={() => setSelectedFormat(f.id)}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div
                    style={{
                      color: "#4fc3f7",
                      fontFamily: "monospace",
                      fontSize: 14,
                      fontWeight: "bold",
                    }}
                  >
                    {f.label}
                  </div>
                  <div
                    style={{
                      color: "#4fc3f7",
                      fontFamily: "monospace",
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    {f.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Result Message */}
        {exportResult && (
          <div
            style={{
              background: exportResult.startsWith("Error")
                ? "rgba(255, 100, 100, 0.2)"
                : "rgba(100, 255, 100, 0.2)",
              border: `1px solid ${
                exportResult.startsWith("Error") ? "#f66" : "#6f6"
              }`,
              borderRadius: 6,
              padding: "10px 14px",
              marginBottom: 20,
              color: exportResult.startsWith("Error") ? "#f88" : "#8f8",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            {exportResult}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              background: "transparent",
              border: "1px solid rgba(79, 195, 247, 0.3)",
              borderRadius: 6,
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              padding: "10px 24px",
              background: "rgba(79, 195, 247, 0.2)",
              border: "1px solid #4fc3f7",
              borderRadius: 6,
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 14,
              fontWeight: "bold",
              cursor: isExporting ? "wait" : "pointer",
              opacity: isExporting ? 0.6 : 1,
            }}
          >
            {isExporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
