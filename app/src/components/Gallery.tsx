import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ScreenshotInfo {
  filename: string;
  path: string;
  created_at: string;
  size_bytes: number;
}

interface GalleryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Gallery({ isOpen, onClose }: GalleryProps) {
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ScreenshotInfo | null>(null);

  const loadScreenshots = useCallback(async () => {
    try {
      setLoading(true);
      const list = await invoke<ScreenshotInfo[]>("list_screenshots");
      setScreenshots(list);
    } catch (err) {
      console.error("Failed to load screenshots:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadScreenshots();
    }
  }, [isOpen, loadScreenshots]);

  const handleOpenFolder = async () => {
    try {
      await invoke("open_screenshots_folder");
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  };

  const handleDelete = async (screenshot: ScreenshotInfo) => {
    if (!confirm(`Delete ${screenshot.filename}?`)) return;
    
    try {
      await invoke("delete_screenshot", { path: screenshot.path });
      setScreenshots(prev => prev.filter(s => s.path !== screenshot.path));
      if (selectedImage?.path === screenshot.path) {
        setSelectedImage(null);
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(5, 5, 15, 0.95)",
      zIndex: 300,
      display: "flex",
      flexDirection: "column",
      fontFamily: "monospace",
      color: "#4fc3f7",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 30px",
        borderBottom: "1px solid rgba(79, 195, 247, 0.2)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>📸 Screenshot Gallery</h2>
          <p style={{ margin: "5px 0 0 0", fontSize: 12, opacity: 0.6 }}>
            {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleOpenFolder}
            style={{
              padding: "8px 16px",
              background: "rgba(79, 195, 247, 0.1)",
              border: "1px solid rgba(79, 195, 247, 0.3)",
              borderRadius: 4,
              color: "#4fc3f7",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            📁 Open Folder
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "rgba(79, 195, 247, 0.1)",
              border: "1px solid rgba(79, 195, 247, 0.3)",
              borderRadius: 4,
              color: "#4fc3f7",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ✕ Close (G)
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.6 }}>
            Loading...
          </div>
        ) : screenshots.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
            <div style={{ opacity: 0.6 }}>No screenshots yet</div>
            <div style={{ fontSize: 12, opacity: 0.4, marginTop: 8 }}>
              Press F2 to take a screenshot
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: 16,
          }}>
            {screenshots.map((screenshot) => (
              <div
                key={screenshot.path}
                style={{
                  background: "rgba(79, 195, 247, 0.05)",
                  border: "1px solid rgba(79, 195, 247, 0.2)",
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={() => setSelectedImage(screenshot)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(79, 195, 247, 0.5)";
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(79, 195, 247, 0.2)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <div style={{
                  aspectRatio: "16/9",
                  background: "#0a0a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <img
                    src={convertFileSrc(screenshot.path)}
                    alt={screenshot.filename}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: "bold",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {screenshot.filename}
                  </div>
                  <div style={{ 
                    fontSize: 10, 
                    opacity: 0.5, 
                    marginTop: 4,
                    display: "flex",
                    justifyContent: "space-between",
                  }}>
                    <span>{screenshot.created_at}</span>
                    <span>{formatSize(screenshot.size_bytes)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.9)",
            zIndex: 400,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={convertFileSrc(selectedImage.path)}
            alt={selectedImage.filename}
            style={{
              maxWidth: "90%",
              maxHeight: "80%",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 0 40px rgba(79, 195, 247, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{
            marginTop: 16,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {selectedImage.filename}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(selectedImage);
              }}
              style={{
                padding: "6px 12px",
                background: "rgba(255, 80, 80, 0.2)",
                border: "1px solid rgba(255, 80, 80, 0.5)",
                borderRadius: 4,
                color: "#f88",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              🗑️ Delete
            </button>
          </div>
          <div style={{
            position: "absolute",
            top: 20,
            right: 20,
            fontSize: 12,
            opacity: 0.5,
          }}>
            Click anywhere to close
          </div>
        </div>
      )}
    </div>
  );
}
