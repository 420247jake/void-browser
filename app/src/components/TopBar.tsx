import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

interface Session {
  name: string;
  path: string;
  lastModified: string;
  nodeCount: number;
}

interface TopBarProps {
  currentSession: string;
  nodeCount: number;
  edgeCount: number;
  onNewVoid: () => void;
  onLoadVoid: (path: string) => void;
  onSessionChange: (session: Session) => void;
}

export function TopBar({
  currentSession,
  nodeCount,
  edgeCount,
  onNewVoid,
  onLoadVoid,
  onSessionChange,
}: TopBarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newVoidName, setNewVoidName] = useState("");
  const [saving, setSaving] = useState(false);

  // Load available sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const sessionList = await invoke<Session[]>("list_sessions");
      setSessions(sessionList);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  const handleNewVoid = useCallback(() => {
    setShowNewModal(true);
    setNewVoidName("");
  }, []);

  const handleCreateNew = useCallback(async () => {
    if (!newVoidName.trim()) return;
    
    try {
      console.log("Creating new session:", newVoidName.trim());
      const result = await invoke("create_new_session", { name: newVoidName.trim() });
      console.log("Create result:", result);
      setShowNewModal(false);
      onNewVoid();
      loadSessions();
    } catch (err) {
      console.error("Failed to create new void:", err);
      alert(`Failed to create void: ${err}`);
    }
  }, [newVoidName, onNewVoid]);

  const handleSaveVoid = useCallback(async () => {
    setSaving(true);
    try {
      console.log("Saving current session...");
      await invoke("save_current_session");
      console.log("Save complete");
      loadSessions();
    } catch (err) {
      console.error("Failed to save:", err);
      alert(`Failed to save: ${err}`);
    }
    setSaving(false);
  }, []);

  const handleSaveAs = useCallback(async () => {
    try {
      const path = await save({
        defaultPath: `${currentSession}.void`,
        filters: [{ name: "Void Files", extensions: ["void", "db"] }],
      });
      
      if (path) {
        await invoke("save_session_as", { path });
        loadSessions();
      }
    } catch (err) {
      console.error("Failed to save as:", err);
    }
  }, [currentSession]);

  const handleLoadVoid = useCallback(async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Void Files", extensions: ["void", "db"] }],
      });
      
      if (path && typeof path === "string") {
        onLoadVoid(path);
        loadSessions();
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }, [onLoadVoid]);

  const handleSelectSession = useCallback(async (session: Session) => {
    console.log("handleSelectSession called with:", session);
    setShowDropdown(false);
    try {
      await onSessionChange(session);
    } catch (err) {
      console.error("Failed to switch session:", err);
      alert(`Failed to switch session: ${err}`);
    }
  }, [onSessionChange]);

  return (
    <>
      {/* Click outside to close dropdown - MUST be before TopBar */}
      {showDropdown && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 499 }}
          onClick={() => setShowDropdown(false)}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          background: "rgba(10, 10, 30, 0.95)",
          borderBottom: "1px solid rgba(79, 195, 247, 0.3)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          zIndex: 500,
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Logo/Title */}
        <div
          style={{
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 16,
            fontWeight: "bold",
            textShadow: "0 0 10px rgba(79, 195, 247, 0.5)",
            marginRight: 8,
          }}
        >
          VOID
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "rgba(79, 195, 247, 0.2)" }} />

        {/* Session Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              background: showDropdown ? "rgba(79, 195, 247, 0.15)" : "transparent",
              border: "1px solid rgba(79, 195, 247, 0.3)",
              borderRadius: 6,
              color: "#4fc3f7",
              fontFamily: "monospace",
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentSession || "Untitled"}
            </span>
            <span style={{ opacity: 0.5, fontSize: 10 }}>▼</span>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 4,
                minWidth: 220,
                background: "rgba(10, 10, 30, 0.98)",
                border: "1px solid rgba(79, 195, 247, 0.3)",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                zIndex: 1000,
              }}
            >
              {/* Recent Sessions */}
              <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(79, 195, 247, 0.1)" }}>
                <div style={{ color: "rgba(79, 195, 247, 0.5)", fontSize: 10, fontFamily: "monospace", marginBottom: 6 }}>
                  RECENT SESSIONS
                </div>
                {sessions.length === 0 ? (
                  <div style={{ color: "rgba(79, 195, 247, 0.3)", fontSize: 11, fontFamily: "monospace", padding: "4px 0" }}>
                    No saved sessions
                  </div>
                ) : (
                  sessions.slice(0, 5).map((session) => (
                    <button
                      key={session.path}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("Session button clicked:", session.name);
                        handleSelectSession(session);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(79, 195, 247, 0.2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = session.name === currentSession ? "rgba(79, 195, 247, 0.1)" : "transparent";
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 10px",
                        background: session.name === currentSession ? "rgba(79, 195, 247, 0.1)" : "transparent",
                        border: "none",
                        borderRadius: 4,
                        color: "#4fc3f7",
                        fontFamily: "monospace",
                        fontSize: 12,
                        textAlign: "left",
                        cursor: "pointer",
                        marginBottom: 2,
                        transition: "background 0.1s ease",
                        pointerEvents: "auto",
                        position: "relative",
                      }}
                    >
                      <div style={{ fontWeight: session.name === currentSession ? "bold" : "normal" }}>
                        {session.name}
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>
                        {session.nodeCount} nodes · {session.lastModified}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: 8 }}>
                <button
                  onClick={handleLoadVoid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 4,
                    color: "#4fc3f7",
                    fontFamily: "monospace",
                    fontSize: 12,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  📂 Open Void File...
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <button
          onClick={handleNewVoid}
          style={{
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid rgba(79, 195, 247, 0.3)",
            borderRadius: 6,
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 12,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Create new void"
        >
          + New
        </button>

        <button
          onClick={handleSaveVoid}
          disabled={saving}
          style={{
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid rgba(79, 195, 247, 0.3)",
            borderRadius: 6,
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 12,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.5 : 1,
            transition: "all 0.15s ease",
          }}
          title="Save current session"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        <button
          onClick={handleSaveAs}
          style={{
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid rgba(79, 195, 247, 0.3)",
            borderRadius: 6,
            color: "#4fc3f7",
            fontFamily: "monospace",
            fontSize: 12,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Save as new file"
        >
          Save As
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Stats */}
        <div
          style={{
            color: "rgba(79, 195, 247, 0.6)",
            fontFamily: "monospace",
            fontSize: 11,
          }}
        >
          {nodeCount} nodes · {edgeCount} edges
        </div>
      </div>

      {/* New Void Modal */}
      {showNewModal && (
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
          onClick={() => setShowNewModal(false)}
        >
          <div
            style={{
              background: "rgba(10, 10, 30, 0.98)",
              border: "2px solid #4fc3f7",
              borderRadius: 12,
              padding: 24,
              width: 360,
              boxShadow: "0 0 40px rgba(79, 195, 247, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                color: "#4fc3f7",
                fontFamily: "monospace",
                margin: "0 0 16px 0",
                fontSize: 18,
              }}
            >
              ✨ Create New Void
            </h3>
            <input
              type="text"
              value={newVoidName}
              onChange={(e) => setNewVoidName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateNew();
                if (e.key === "Escape") setShowNewModal(false);
              }}
              placeholder="Enter void name..."
              autoFocus
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "rgba(79, 195, 247, 0.1)",
                border: "1px solid rgba(79, 195, 247, 0.3)",
                borderRadius: 6,
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowNewModal(false)}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  border: "1px solid rgba(79, 195, 247, 0.3)",
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNew}
                disabled={!newVoidName.trim()}
                style={{
                  padding: "10px 20px",
                  background: newVoidName.trim() ? "rgba(79, 195, 247, 0.2)" : "transparent",
                  border: "1px solid #4fc3f7",
                  borderRadius: 6,
                  color: "#4fc3f7",
                  fontFamily: "monospace",
                  fontSize: 13,
                  cursor: newVoidName.trim() ? "pointer" : "not-allowed",
                  opacity: newVoidName.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles for hover effects */}
      <style>{`
        .top-bar button:hover {
          background: rgba(79, 195, 247, 0.1) !important;
        }
      `}</style>
    </>
  );
}
