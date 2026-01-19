/**
 * Session Merge Modal - Merge multiple void sessions together
 */

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface SessionInfo {
  name: string;
  path: string;
  nodeCount: number;
  edgeCount: number;
  selected: boolean;
}

interface MergeResult {
  nodes_merged: number;
  edges_merged: number;
  nodes_skipped: number;
  sessions_merged: number;
}

interface SessionMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMergeComplete: () => void;
  currentSession: string;
}

export function SessionMergeModal({
  isOpen,
  onClose,
  onMergeComplete,
  currentSession,
}: SessionMergeModalProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load available sessions on open
  useEffect(() => {
    if (!isOpen) {
      setSessions([]);
      setResult(null);
      setError(null);
      return;
    }

    loadSessions();
  }, [isOpen]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const sessionList = await invoke<
        { name: string; path: string; node_count: number; edge_count: number }[]
      >("list_sessions_with_stats");

      setSessions(
        sessionList.map((s) => ({
          name: s.name,
          path: s.path,
          nodeCount: s.node_count,
          edgeCount: s.edge_count,
          selected: false,
        }))
      );
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError(`Failed to load sessions: ${err}`);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleAddExternal = useCallback(async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
        title: "Select Void Session Database",
      });

      if (file) {
        // Get stats from external file
        const stats = await invoke<{ node_count: number; edge_count: number }>(
          "get_session_stats",
          { path: file as string }
        );

        const filename = (file as string).split(/[/\\]/).pop() || "External";
        
        setSessions((prev) => [
          ...prev,
          {
            name: filename.replace(".db", ""),
            path: file as string,
            nodeCount: stats.node_count,
            edgeCount: stats.edge_count,
            selected: true,
          },
        ]);
      }
    } catch (err) {
      setError(`Failed to add external session: ${err}`);
    }
  }, []);

  const toggleSession = useCallback((path: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.path === path ? { ...s, selected: !s.selected } : s
      )
    );
  }, []);

  const handleMerge = useCallback(async () => {
    const selected = sessions.filter((s) => s.selected);
    if (selected.length === 0) return;

    setMerging(true);
    setError(null);

    try {
      const mergeResult = await invoke<MergeResult>("merge_sessions", {
        sessionPaths: selected.map((s) => s.path),
      });

      setResult(mergeResult);
      onMergeComplete();
    } catch (err) {
      setError(`Merge failed: ${err}`);
    } finally {
      setMerging(false);
    }
  }, [sessions, onMergeComplete]);

  if (!isOpen) return null;

  const selectedCount = sessions.filter((s) => s.selected).length;
  const totalNodes = sessions
    .filter((s) => s.selected)
    .reduce((sum, s) => sum + s.nodeCount, 0);
  const totalEdges = sessions
    .filter((s) => s.selected)
    .reduce((sum, s) => sum + s.edgeCount, 0);

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
          maxHeight: "80vh",
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
            marginBottom: 10,
            fontSize: 20,
          }}
        >
          🔀 Merge Sessions
        </h2>

        <p
          style={{
            color: "rgba(79, 195, 247, 0.7)",
            fontFamily: "monospace",
            fontSize: 12,
            marginBottom: 20,
          }}
        >
          Merge nodes and edges from other sessions into{" "}
          <strong style={{ color: "#4fc3f7" }}>{currentSession}</strong>.
          Duplicate URLs will be skipped.
        </p>

        {/* Session List */}
        {loadingSessions ? (
          <div
            style={{
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 14,
              textAlign: "center",
              padding: 40,
            }}
          >
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div
            style={{
              color: "rgba(79, 195, 247, 0.6)",
              fontFamily: "monospace",
              fontSize: 13,
              textAlign: "center",
              padding: 30,
              background: "rgba(79, 195, 247, 0.05)",
              borderRadius: 6,
              marginBottom: 20,
            }}
          >
            No other sessions found. Add an external .db file below.
          </div>
        ) : (
          <div
            style={{
              background: "rgba(79, 195, 247, 0.05)",
              border: "1px solid rgba(79, 195, 247, 0.2)",
              borderRadius: 6,
              marginBottom: 20,
              maxHeight: 250,
              overflow: "auto",
            }}
          >
            {sessions.map((session) => (
              <label
                key={session.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderBottom: "1px solid rgba(79, 195, 247, 0.1)",
                  cursor: "pointer",
                  background: session.selected
                    ? "rgba(79, 195, 247, 0.1)"
                    : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={session.selected}
                  onChange={() => toggleSession(session.path)}
                  style={{ width: 16, height: 16 }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: "#4fc3f7",
                      fontFamily: "monospace",
                      fontSize: 14,
                      fontWeight: session.name === currentSession ? "bold" : "normal",
                    }}
                  >
                    {session.name}
                    {session.name === currentSession && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          opacity: 0.6,
                          background: "rgba(79, 195, 247, 0.2)",
                          padding: "2px 6px",
                          borderRadius: 3,
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      color: "rgba(79, 195, 247, 0.6)",
                      fontFamily: "monospace",
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    {session.nodeCount} nodes • {session.edgeCount} edges
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Add External Button */}
        <button
          onClick={handleAddExternal}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: "transparent",
            border: "1px dashed rgba(79, 195, 247, 0.4)",
            borderRadius: 6,
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          + Add External .db File
        </button>

        {/* Selection Summary */}
        {selectedCount > 0 && (
          <div
            style={{
              background: "rgba(79, 195, 247, 0.1)",
              border: "1px solid rgba(79, 195, 247, 0.3)",
              borderRadius: 6,
              padding: 14,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              Will merge <strong>{selectedCount}</strong> session(s): up to{" "}
              <strong>{totalNodes}</strong> nodes and{" "}
              <strong>{totalEdges}</strong> edges
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
              ✓ Merge Complete
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
              <span style={{ opacity: 0.7 }}>Sessions merged:</span>
              <span>{result.sessions_merged}</span>
              <span style={{ opacity: 0.7 }}>Nodes added:</span>
              <span>{result.nodes_merged}</span>
              <span style={{ opacity: 0.7 }}>Edges added:</span>
              <span>{result.edges_merged}</span>
              <span style={{ opacity: 0.7 }}>Duplicates skipped:</span>
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
              onClick={handleMerge}
              disabled={selectedCount === 0 || merging}
              style={{
                padding: "10px 24px",
                background:
                  selectedCount > 0 && !merging
                    ? "rgba(79, 195, 247, 0.2)"
                    : "rgba(79, 195, 247, 0.05)",
                border: "1px solid #4fc3f7",
                borderRadius: 6,
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 13,
                cursor: selectedCount > 0 && !merging ? "pointer" : "not-allowed",
                opacity: selectedCount > 0 && !merging ? 1 : 0.4,
              }}
            >
              {merging ? "Merging..." : `Merge ${selectedCount} Session(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
